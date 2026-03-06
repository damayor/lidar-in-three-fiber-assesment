from nuscenes.nuscenes import NuScenes
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

def get_nusc() -> NuScenes:
    if nusc is None:
        raise RuntimeError("nuScenes dataset is not initialized.")
    return nusc
