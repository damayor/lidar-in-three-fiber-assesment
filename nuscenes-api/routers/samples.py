from fastapi import APIRouter, HTTPException
from database import get_nusc

router = APIRouter()


@router.get("/{sample_token}", summary="Get a single sample (frame)")
def get_sample(sample_token: str):
    nusc = get_nusc()

    try:
        sample = nusc.get("sample", sample_token)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Sample '{sample_token}' not found")

    # Resolve sensor channels available for this sample
    sensor_channels = {}
    for channel, sd_token in sample["data"].items():
        sd = nusc.get("sample_data", sd_token)
        sensor_channels[channel] = {
            "sample_data_token": sd_token,
            "filename": sd["filename"],
            "fileformat": sd["fileformat"],
            "is_key_frame": sd["is_key_frame"],
            "timestamp": sd["timestamp"],
        }

    # NOTE: sample_annotation stores category as 'category_name' (a flat string),
    # NOT via 'category_token'. The devkit denormalizes this field.
    annotations = []
    for ann_token in sample["anns"]:
        ann = nusc.get("sample_annotation", ann_token)
        annotations.append({
            "token": ann["token"],
            "category": ann["category_name"],
            "num_lidar_pts": ann["num_lidar_pts"],
            "num_radar_pts": ann["num_radar_pts"],
            "visibility_token": ann.get("visibility_token"),
            "translation": ann["translation"],
            "size": ann["size"],
            "rotation": ann["rotation"],
        })

    return {
        "token": sample["token"],
        "timestamp": sample["timestamp"],
        "scene_token": sample.get("scene_token"),
        "prev": sample["prev"],
        "next": sample["next"],
        "sensors": sensor_channels,
        "annotations": annotations,
    }


@router.get("/{sample_token}/annotations", summary="Get annotations for a frame")
def get_sample_annotations(sample_token: str):
    """Returns all bounding box annotations for a given frame."""
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
            "token": ann["token"],
            "category": ann["category_name"],
            "attributes": attributes,
            "translation": ann["translation"],
            "size": ann["size"],
            "rotation": ann["rotation"],
            "num_lidar_pts": ann["num_lidar_pts"],
            "num_radar_pts": ann["num_radar_pts"],
        })

    return {
        "sample_token": sample_token,
        "total_annotations": len(annotations),
        "annotations": annotations,
    }
