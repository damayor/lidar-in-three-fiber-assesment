export interface Scene {
  token: string;
  name: string;
  description: string;
  nbr_samples: number;
  first_sample_token: string;
  last_sample_token: string;
  log_token: string;
}

export interface SampleListItem {
  token: string;
  timestamp: number;
  prev: string;
  next: string;
  anns_count: number;
}

export interface SensorInfo {
  sample_data_token: string;
  filename: string;
  fileformat: string;
  is_key_frame: boolean;
  timestamp: number;
}

export interface Annotation {
  token: string;
  category: string;
  num_lidar_pts: number;
  num_radar_pts: number;
  visibility_token: string;
  translation: [number, number, number];
  size: [number, number, number];
  rotation: [number, number, number, number];
}

export interface SampleData {
  token: string;
  timestamp: number;
  scene_token: string;
  prev: string;
  next: string;
  sensors: Record<string, SensorInfo>;
  annotations: Annotation[];
}

export interface ScenesResponse {
  total: number;
  offset: number;
  limit: number;
  scenes: Scene[];
}

export interface SceneSamplesResponse {
  scene_token: string;
  scene_name: string;
  total_samples: number;
  samples: SampleListItem[];
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type ActiveTab = "cameras" | "lidar";
