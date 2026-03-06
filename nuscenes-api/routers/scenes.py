from fastapi import APIRouter, HTTPException, Query
from database import get_nusc

router = APIRouter()


@router.get("/", summary="List all scenes")
def list_scenes(
    limit: int = Query(default=50, le=200, description="Max number of scenes to return"),
    offset: int = Query(default=0, description="Pagination offset"),
):
    """Returns a paginated list of all scenes in the dataset."""
    nusc = get_nusc()
    scenes = nusc.scene[offset : offset + limit]

    return {
        "total": len(nusc.scene),
        "offset": offset,
        "limit": limit,
        "scenes": [_format_scene(s) for s in scenes],
    }


@router.get("/{scene_token}", summary="Get a scene by token")
def get_scene(scene_token: str):
    """Returns full detail for a single scene."""
    nusc = get_nusc()
    try:
        scene = nusc.get("scene", scene_token)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Scene '{scene_token}' not found")

    log = nusc.get("log", scene["log_token"])

    return {
        **_format_scene(scene),
        "log": {
            "token": log["token"],
            "vehicle": log["vehicle"],
            "date_captured": log["date_captured"],
            "location": log["location"],
        },
    }


@router.get("/{scene_token}/samples", summary="List all frames (samples) in a scene")
def get_scene_samples(scene_token: str):
    """
    Returns ALL samples (keyframes) in a scene in chronological order.
    Navigates the linked list: first_sample_token → next → next → ...
    """
    nusc = get_nusc()

    try:
        scene = nusc.get("scene", scene_token)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Scene '{scene_token}' not found")

    samples = []
    current_token = scene["first_sample_token"]

    while current_token:
        sample = nusc.get("sample", current_token)
        samples.append(_format_sample(sample))
        current_token = sample["next"] if sample["next"] else None

    return {
        "scene_token": scene_token,
        "scene_name": scene["name"],
        "total_samples": len(samples),
        "samples": samples,
    }


# ── helpers ──────────────────────────────────────────────────────────────────

def _format_scene(scene: dict) -> dict:
    return {
        "token": scene["token"],
        "name": scene["name"],
        "description": scene["description"],
        "nbr_samples": scene["nbr_samples"],
        "first_sample_token": scene["first_sample_token"],
        "last_sample_token": scene["last_sample_token"],
        "log_token": scene["log_token"],
    }


def _format_sample(sample: dict) -> dict:
    return {
        "token": sample["token"],
        "timestamp": sample["timestamp"],
        "prev": sample["prev"],
        "next": sample["next"],
        "anns_count": len(sample["anns"]),
    }
