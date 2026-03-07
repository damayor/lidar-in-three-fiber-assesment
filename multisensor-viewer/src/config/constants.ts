export const API = "http://localhost:8000";

export const CAMERA_CHANNELS = [
  "CAM_FRONT_LEFT", "CAM_FRONT", "CAM_FRONT_RIGHT",
  "CAM_BACK_LEFT",  "CAM_BACK",  "CAM_BACK_RIGHT",
] as const;

export type CameraChannel = typeof CAMERA_CHANNELS[number];

export const CATEGORY_COLORS: Record<string, string> = {
  "vehicle.car":                "#00e5ff",
  "vehicle.truck":              "#00b0ff",
  "vehicle.bus":                "#2979ff",
  "vehicle.motorcycle":         "#7c4dff",
  "vehicle.bicycle":            "#b388ff",
  "human.pedestrian.adult":     "#ff6d00",
  "human.pedestrian.child":     "#ffab40",
  "movable_object.barrier":     "#69f0ae",
  "movable_object.trafficcone": "#ffd740",
  "static_object.bicycle_rack": "#e040fb",
};

export const getCategoryColor = (cat: string): string => {
  for (const [key, val] of Object.entries(CATEGORY_COLORS)) {
    const [ns, sub] = key.split(".");
    if (cat.startsWith(`${ns}.${sub}`)) return val;
  }
  return "#ffffff";
};
