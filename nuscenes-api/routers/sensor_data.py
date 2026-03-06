from fastapi import APIRouter, HTTPException, Query
from database import get_nusc

router = APIRouter()

VALID_CHANNELS = [
    "CAM_FRONT", "CAM_FRONT_LEFT", "CAM_FRONT_RIGHT",
    "CAM_BACK", "CAM_BACK_LEFT", "CAM_BACK_RIGHT",
    "LIDAR_TOP",
    "RADAR_FRONT", "RADAR_FRONT_LEFT", "RADAR_FRONT_RIGHT",
    "RADAR_BACK_LEFT", "RADAR_BACK_RIGHT",
]


@router.get("/{sample_data_token}", summary="Get sensor data record by token")
def get_sensor_data(sample_data_token: str):
    """
    Returns full metadata for a sample_data record (one sensor reading).
    Includes calibration and ego pose at the time of capture.
    """
    nusc = get_nusc()

    try:
        sd = nusc.get("sample_data", sample_data_token)
    except KeyError:
        raise HTTPException(
            status_code=404, detail=f"SampleData '{sample_data_token}' not found"
        )

    # Calibration (sensor extrinsics + intrinsics)
    cs = nusc.get("calibrated_sensor", sd["calibrated_sensor_token"])
    sensor = nusc.get("sensor", cs["sensor_token"])

    # Ego pose at this exact timestamp
    ego_pose = nusc.get("ego_pose", sd["ego_pose_token"])

    return {
        "token": sd["token"],
        "sample_token": sd["sample_token"],
        "channel": sd["channel"],
        "filename": sd["filename"],
        "fileformat": sd["fileformat"],
        "timestamp": sd["timestamp"],
        "is_key_frame": sd["is_key_frame"],
        "width": sd.get("width"),
        "height": sd.get("height"),
        "prev": sd["prev"],
        "next": sd["next"],
        "sensor": {
            "token": sensor["token"],
            "channel": sensor["channel"],
            "modality": sensor["modality"],   # camera | lidar | radar
        },
        "calibration": {
            "translation": cs["translation"],
            "rotation": cs["rotation"],
            "camera_intrinsic": cs.get("camera_intrinsic", []),
        },
        "ego_pose": {
            "token": ego_pose["token"],
            "timestamp": ego_pose["timestamp"],
            "translation": ego_pose["translation"],
            "rotation": ego_pose["rotation"],
        },
    }


@router.get(
    "/sample/{sample_token}/channel/{channel}",
    summary="Get sensor data for a specific channel in a frame",
)
def get_sensor_data_by_channel(sample_token: str, channel: str):
    """
    Shortcut: given a sample token + channel name, return the sensor data.
    Valid channels: CAM_FRONT, CAM_BACK, LIDAR_TOP, RADAR_FRONT, etc.
    """
    nusc = get_nusc()

    if channel not in VALID_CHANNELS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid channel '{channel}'. Valid: {VALID_CHANNELS}",
        )

    try:
        sample = nusc.get("sample", sample_token)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Sample '{sample_token}' not found")

    if channel not in sample["data"]:
        raise HTTPException(
            status_code=404,
            detail=f"Channel '{channel}' not available for sample '{sample_token}'",
        )

    sd_token = sample["data"][channel]
    # Reuse the existing endpoint logic
    return get_sensor_data(sd_token)


@router.get("/channels/list", summary="List all valid sensor channels")
def list_channels():
    return {"channels": VALID_CHANNELS}
