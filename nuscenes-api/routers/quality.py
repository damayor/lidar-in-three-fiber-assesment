import logging
from fastapi import APIRouter, HTTPException, Query
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional
from fastapi.responses import JSONResponse
from database import get_nusc

router = APIRouter()

# ── Logger (no persistence, stdout only) ─────────────────────────────────────
logger = logging.getLogger("nuscenes.quality")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s"
)

# ── Domain types ──────────────────────────────────────────────────────────────
class CheckStatus(str, Enum):
    PASS    = "PASS"
    WARNING = "WARNING"
    FAIL    = "FAIL"

@dataclass
class QualityCheck:
    name: str
    status: CheckStatus
    message: str
    detail: Optional[dict] = field(default=None)

EXPECTED_SENSORS = [
    "CAM_FRONT", "CAM_FRONT_LEFT", "CAM_FRONT_RIGHT",
    "CAM_BACK",  "CAM_BACK_LEFT",  "CAM_BACK_RIGHT",
    "LIDAR_TOP",
    "RADAR_FRONT", "RADAR_FRONT_LEFT", "RADAR_FRONT_RIGHT",
    "RADAR_BACK_LEFT", "RADAR_BACK_RIGHT",
]

CRITICAL_SENSORS = {"LIDAR_TOP", "CAM_FRONT"}  # missing these → FAIL

# Max allowed drift between any sensor and the sample timestamp (microseconds)
TIMESTAMP_DRIFT_WARN_US  = 50_000   # 50 ms
TIMESTAMP_DRIFT_FAIL_US  = 200_000  # 200 ms

# ── Individual checks ─────────────────────────────────────────────────────────

def check_sensor_completeness(nusc, sample: dict) -> QualityCheck:
    present  = set(sample["data"].keys())
    missing  = [s for s in EXPECTED_SENSORS if s not in present]
    critical = [s for s in missing if s in CRITICAL_SENSORS]

    if critical:
        return QualityCheck(
            name="sensor_completeness",
            status=CheckStatus.FAIL,
            message=f"Critical sensors missing: {critical}",
            detail={"missing": missing, "critical_missing": critical},
        )
    if missing:
        return QualityCheck(
            name="sensor_completeness",
            status=CheckStatus.WARNING,
            message=f"Non-critical sensors missing: {missing}",
            detail={"missing": missing},
        )
    return QualityCheck(
        name="sensor_completeness",
        status=CheckStatus.PASS,
        message="All expected sensors present",
    )


def check_timestamp_consistency(nusc, sample: dict) -> QualityCheck:
    ref_ts = sample["timestamp"]
    drifts = {}
    max_drift = 0

    for channel, sd_token in sample["data"].items():
        sd = nusc.get("sample_data", sd_token)
        drift = abs(sd["timestamp"] - ref_ts)
        drifts[channel] = drift
        max_drift = max(max_drift, drift)

    if max_drift > TIMESTAMP_DRIFT_FAIL_US:
        return QualityCheck(
            name="timestamp_consistency",
            status=CheckStatus.FAIL,
            message=f"Max timestamp drift {max_drift/1000:.1f}ms exceeds 200ms threshold",
            detail={"max_drift_us": max_drift, "per_sensor": drifts},
        )
    if max_drift > TIMESTAMP_DRIFT_WARN_US:
        return QualityCheck(
            name="timestamp_consistency",
            status=CheckStatus.WARNING,
            message=f"Max timestamp drift {max_drift/1000:.1f}ms exceeds 50ms threshold",
            detail={"max_drift_us": max_drift, "per_sensor": drifts},
        )
    return QualityCheck(
        name="timestamp_consistency",
        status=CheckStatus.PASS,
        message=f"All sensors within drift tolerance (max {max_drift/1000:.1f}ms)",
        detail={"max_drift_us": max_drift},
    )


def check_annotation_availability(nusc, sample: dict) -> QualityCheck:
    ann_count = len(sample["anns"])

    if ann_count == 0:
        return QualityCheck(
            name="annotation_availability",
            status=CheckStatus.WARNING,
            message="Frame has zero annotations — may be valid for empty scenes",
        )

    # Check annotations are resolvable (no broken token references)
    broken = []
    for ann_token in sample["anns"]:
        try:
            nusc.get("sample_annotation", ann_token)
        except KeyError:
            broken.append(ann_token)

    if broken:
        return QualityCheck(
            name="annotation_availability",
            status=CheckStatus.FAIL,
            message=f"{len(broken)} annotation tokens cannot be resolved",
            detail={"broken_tokens": broken},
        )

    return QualityCheck(
        name="annotation_availability",
        status=CheckStatus.PASS,
        message=f"{ann_count} annotations present and resolvable",
        detail={"count": ann_count},
    )


# ── Aggregator ────────────────────────────────────────────────────────────────

def aggregate_status(checks: list[QualityCheck]) -> CheckStatus:
    statuses = {c.status for c in checks}
    if CheckStatus.FAIL    in statuses: return CheckStatus.FAIL
    if CheckStatus.WARNING in statuses: return CheckStatus.WARNING
    return CheckStatus.PASS

STATUS_TO_HTTP = {
    CheckStatus.PASS:    200,
    CheckStatus.WARNING: 207,
    CheckStatus.FAIL:    422,
}

# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/frames/{sample_token}", summary="Inspect data quality for a frame")
def inspect_quality(sample_token: str):

    nusc = get_nusc()

    try:
        sample = nusc.get("sample", sample_token)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Sample '{sample_token}' not found")

    checks = [
        check_sensor_completeness(nusc, sample),
        check_timestamp_consistency(nusc, sample),
        check_annotation_availability(nusc, sample),

    ]

    overall = aggregate_status(checks)
    http_status = STATUS_TO_HTTP[overall]

    # Log at appropriate level — no persistence, stdout only
    log_fn = {
        CheckStatus.PASS:    logger.info,
        CheckStatus.WARNING: logger.warning,
        CheckStatus.FAIL:    logger.error,
    }[overall]

    log_fn("Quality inspection [%s] sample=%s → %s", overall, sample_token,
           [f"{c.name}:{c.status}" for c in checks])

    payload = {
        "sample_token": sample_token,
        "overall_status": overall,
        "http_status": http_status,
        "checks": [
            {
                "name": c.name,
                "status": c.status,
                "message": c.message,
                **({"detail": c.detail} if c.detail else {}),
            }
            for c in checks
        ],
    }

    return JSONResponse(content=payload, status_code=http_status)

@router.get("/frames/mock/{sample_token}", summary="Inspect with simulated missing sensor or annotations")
def inspect_quality_mock(

    sample_token: str,
    drop_sensor: Optional[str] = Query(default=None, description="Sensor to remove, e.g. LIDAR_TOP"),
    drop_annotations: bool = Query(default=False, description="Set true to simulate zero annotations"),
):
    nusc = get_nusc()
    try:
        sample = nusc.get("sample", sample_token)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Sample '{sample_token}' not found")

    # Deep copy and remove the sensor from the data dict
    import copy
    mock_sample = copy.deepcopy(sample)

    if drop_sensor:  # solo ejecuta si vino un valor, no si es None
        mock_sample["data"].pop(drop_sensor, None)

    # CAMBIO 3: vaciar annotations si el flag está activo
    if drop_annotations:
        mock_sample["anns"] = []

    checks = [
        check_sensor_completeness(nusc, mock_sample),
        check_timestamp_consistency(nusc, mock_sample),
        check_annotation_availability(nusc, mock_sample),
    ]
    overall = aggregate_status(checks)

    return JSONResponse(
        content={
            "sample_token": sample_token,
            "mock": True,
            "dropped_sensor": drop_sensor,
            "overall_status": overall,
            "http_status": STATUS_TO_HTTP[overall],
            "checks": [{"name": c.name, "status": c.status, "message": c.message} for c in checks],
        },
        status_code=STATUS_TO_HTTP[overall],
    )
    