import copy
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from database import get_nusc
# Re-use the exact same check functions and types from quality.py
# No logic duplication — single source of truth
from routers.quality import (
    CheckStatus,
    check_sensor_completeness,
    check_timestamp_consistency,
    check_annotation_availability,
    aggregate_status,
    STATUS_TO_HTTP,
)

router = APIRouter()
logger = logging.getLogger("nuscenes.samples")


# ── helpers ───────────────────────────────────────────────────────────────────

def resolve_sensors(nusc, sample: dict) -> dict:
    sensor_channels = {}
    for channel, sd_token in sample["data"].items():
        sd = nusc.get("sample_data", sd_token)
        sensor_channels[channel] = {
            "sample_data_token": sd_token,
            "filename":    sd["filename"],
            "fileformat":  sd["fileformat"],
            "is_key_frame": sd["is_key_frame"],
            "timestamp":   sd["timestamp"],
        }
    return sensor_channels


def resolve_annotations(nusc, sample: dict) -> list:
    annotations = []
    for ann_token in sample["anns"]:
        ann = nusc.get("sample_annotation", ann_token)
        annotations.append({
            "token":            ann["token"],
            "category":         ann["category_name"],
            "num_lidar_pts":    ann["num_lidar_pts"],
            "num_radar_pts":    ann["num_radar_pts"],
            "visibility_token": ann.get("visibility_token"),
            "translation":      ann["translation"],
            "size":             ann["size"],
            "rotation":         ann["rotation"],
        })
    return annotations


def build_quality_summary(nusc, sample: dict) -> dict:
    """Run all checks and return a compact quality block to embed in the response."""
    checks = [
        check_sensor_completeness(nusc, sample),
        check_timestamp_consistency(nusc, sample),
        check_annotation_availability(nusc, sample)
    ]
    overall = aggregate_status(checks)
    return {
        "overall_status": overall,
        "checks": [
            {
                "name":    c.name,
                "status":  c.status,
                "message": c.message,
                **({"detail": c.detail} if c.detail else {}),
            }
            for c in checks
        ],
    }


# ── GET /samples/{sample_token} ───────────────────────────────────────────────

@router.get("/{sample_token}", summary="Get a single sample (frame)")
def get_sample(
    sample_token: str,
    drop_sensor: Optional[str] = Query(
        default=None,
        description="Simulate a missing sensor (e.g. LIDAR_TOP, CAM_FRONT)",
    ),
    drop_annotations: bool = Query(
        default=False,
        description="Simulate a frame with zero annotations",
    ),
):
    nusc = get_nusc()

    try:
        sample = nusc.get("sample", sample_token)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Sample '{sample_token}' not found")

    # ── simulation layer (non-destructive) ────────────────────────────────────
    is_mocked = drop_sensor is not None or drop_annotations
    if is_mocked:
        sample = copy.deepcopy(sample)

    if drop_sensor:
        valid = list(sample["data"].keys())
        if drop_sensor not in valid:
            raise HTTPException(
                status_code=400,
                detail=f"Sensor '{drop_sensor}' not available. Valid: {valid}",
            )
        sample["data"].pop(drop_sensor)

    if drop_annotations:
        sample["anns"] = []

    # ── resolve data ──────────────────────────────────────────────────────────
    sensor_channels = resolve_sensors(nusc, sample)
    annotations     = resolve_annotations(nusc, sample)
    quality         = build_quality_summary(nusc, sample)

    overall_status  = quality["overall_status"]
    http_status     = STATUS_TO_HTTP[overall_status]

    log_fn = {
        CheckStatus.PASS:    logger.info,
        CheckStatus.WARNING: logger.warning,
        CheckStatus.FAIL:    logger.error,
    }[overall_status]
    log_fn(
        "Sample [%s] token=%s mock=%s → %s",
        overall_status, sample_token, is_mocked,
        [f"{c['name']}:{c['status']}" for c in quality["checks"]],
    )

    payload = {
        "token":       sample["token"],
        "timestamp":   sample["timestamp"],
        "scene_token": sample.get("scene_token"),
        "prev":        sample["prev"],
        "next":        sample["next"],
        "sensors":     sensor_channels,
        "annotations": annotations,
        "quality":     quality,
        **({"mock": {"drop_sensor": drop_sensor, "drop_annotations": drop_annotations}}
           if is_mocked else {}),
    }

    return JSONResponse(content=payload, status_code=http_status)


# ── GET /samples/{sample_token}/annotations ───────────────────────────────────

@router.get("/{sample_token}/annotations", summary="Get annotations for a frame")
def get_sample_annotations(sample_token: str):
    nusc = get_nusc()

    try:
        sample = nusc.get("sample", sample_token)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Sample '{sample_token}' not found")

    annotations = []
    for ann_token in sample["anns"]:
        ann = nusc.get("sample_annotation", ann_token)
        attributes = [
            nusc.get("attribute", attr_token)["name"]
            for attr_token in ann["attribute_tokens"]
        ]
        annotations.append({
            "token":         ann["token"],
            "category":      ann["category_name"],
            "attributes":    attributes,
            "translation":   ann["translation"],
            "size":          ann["size"],
            "rotation":      ann["rotation"],
            "num_lidar_pts": ann["num_lidar_pts"],
            "num_radar_pts": ann["num_radar_pts"],
        })

    return {
        "sample_token":      sample_token,
        "total_annotations": len(annotations),
        "annotations":       annotations,
    }