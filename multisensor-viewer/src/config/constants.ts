import type { QualityStatus } from "@interfaces/types";

export const API = "http://localhost:8000";

export const CAMERA_CHANNELS = [
  "CAM_FRONT_LEFT",
  "CAM_FRONT",
  "CAM_FRONT_RIGHT",
  "CAM_BACK_LEFT",
  "CAM_BACK",
  "CAM_BACK_RIGHT",
] as const;

export type CameraChannel = (typeof CAMERA_CHANNELS)[number];

export const CATEGORY_COLORS: Record<string, string> = {
  "vehicle.car": "#00e5ff",
  "vehicle.truck": "#00b0ff",
  "vehicle.bus": "#2979ff",
  "vehicle.motorcycle": "#7c4dff",
  "vehicle.bicycle": "#b388ff",
  "human.pedestrian.adult": "#ff6d00",
  "human.pedestrian.child": "#ffab40",
  "movable_object.barrier": "#69f0ae",
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

export const QUALITY_STYLE: Record<QualityStatus, { bar: string; badge: string; text: string }> = {
  PASS:    { bar: "bg-green-950/40 border-green-500/30",   badge: "bg-green-500/20 text-green-400 border-green-500/40",   text: "text-green-400"  },
  WARNING: { bar: "bg-yellow-950/40 border-yellow-500/30", badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40", text: "text-yellow-400" },
  FAIL:    { bar: "bg-red-950/40 border-red-500/30",       badge: "bg-red-500/20 text-red-400 border-red-500/40",         text: "text-red-400"    },
};