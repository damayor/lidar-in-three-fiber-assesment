from nuscenes.nuscenes import NuScenes
from fastapi import HTTPException
from config import settings

nusc: NuScenes = None

def init_nuscenes():
    global nusc
    print(f"Loading nuScenes {settings.NUSCENES_VERSION} from {settings.NUSCENES_DATAROOT} ...")
    nusc = NuScenes(
        version=settings.NUSCENES_VERSION,
        dataroot=settings.NUSCENES_DATAROOT,
        verbose=True,
    )
    print(f"Loaded {len(nusc.scene)} scenes and {len(nusc.sample)} samples.")

def get_nusc():
    if nusc is None:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "NUSCENES_UNAVAILABLE",
                "message": "nuScenes SDK failed to initialize. The dataset may be unreachable.",
            }
        )
    return nusc
