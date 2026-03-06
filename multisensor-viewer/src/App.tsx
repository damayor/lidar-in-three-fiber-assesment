import { useState, useEffect, useRef, useMemo, type FC } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Stats, Html } from "@react-three/drei";
import * as THREE from "three";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const API = "http://localhost:8000";

const CAMERA_CHANNELS = [
  "CAM_FRONT_LEFT", "CAM_FRONT", "CAM_FRONT_RIGHT",
  "CAM_BACK_LEFT",  "CAM_BACK",  "CAM_BACK_RIGHT",
] as const;

type CameraChannel = typeof CAMERA_CHANNELS[number];

const CATEGORY_COLORS: Record<string, string> = {
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

const getCategoryColor = (cat: string): string => {
  for (const [key, val] of Object.entries(CATEGORY_COLORS)) {
    const [ns, sub] = key.split(".");
    if (cat.startsWith(`${ns}.${sub}`)) return val;
  }
  return "#ffffff";
};

// ── TYPES ─────────────────────────────────────────────────────────────────────
interface Scene {
  token: string;
  name: string;
  description: string;
  nbr_samples: number;
  first_sample_token: string;
  last_sample_token: string;
  log_token: string;
}

interface SampleListItem {
  token: string;
  timestamp: number;
  prev: string;
  next: string;
  anns_count: number;
}

interface SensorInfo {
  sample_data_token: string;
  filename: string;
  fileformat: string;
  is_key_frame: boolean;
  timestamp: number;
}

interface Annotation {
  token: string;
  category: string;
  num_lidar_pts: number;
  num_radar_pts: number;
  visibility_token: string;
  translation: [number, number, number];
  size: [number, number, number];
  rotation: [number, number, number, number];
}

interface SampleData {
  token: string;
  timestamp: number;
  scene_token: string;
  prev: string;
  next: string;
  sensors: Record<string, SensorInfo>;
  annotations: Annotation[];
}

interface ScenesResponse {
  total: number;
  offset: number;
  limit: number;
  scenes: Scene[];
}

interface SceneSamplesResponse {
  scene_token: string;
  scene_name: string;
  total_samples: number;
  samples: SampleListItem[];
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

// ── GLOBAL STYLES ─────────────────────────────────────────────────────────────
const GlobalStyles: FC = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #080c10; --surface: #0d1117; --border: #1c2532;
      --border-bright: #2d3f55; --accent: #00e5ff; --accent2: #ff6d00;
      --text: #cdd9e5; --muted: #636e7b;
      --font-display: 'Syne', sans-serif; --font-mono: 'Space Mono', monospace;
    }
    body { background: var(--bg); color: var(--text); font-family: var(--font-mono); }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: var(--surface); }
    ::-webkit-scrollbar-thumb { background: var(--border-bright); border-radius: 2px; }

    .app { display: grid; grid-template-rows: 56px 1fr; height: 100vh; overflow: hidden; }

    .header { display: flex; align-items: center; gap: 16px; padding: 0 24px; background: var(--surface); border-bottom: 1px solid var(--border); position: relative; z-index: 10; }
    .header-logo { font-family: var(--font-display); font-weight: 800; font-size: 18px; letter-spacing: -0.5px; color: #fff; }
    .header-logo span { color: var(--accent); }
    .header-sep { width: 1px; height: 24px; background: var(--border); }
    .header-token { font-size: 11px; color: var(--muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #69f0ae; box-shadow: 0 0 8px #69f0ae; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

    .main { display: grid; grid-template-columns: 280px 1fr 300px; overflow: hidden; }

    .sidebar { background: var(--surface); border-right: 1px solid var(--border); overflow-y: auto; display: flex; flex-direction: column; }
    .sidebar-section { border-bottom: 1px solid var(--border); }
    .sidebar-label { font-size: 10px; font-weight: 700; letter-spacing: 2px; color: var(--muted); text-transform: uppercase; padding: 14px 16px 8px; }
    .scene-item { padding: 10px 16px; cursor: pointer; border-left: 2px solid transparent; transition: all .15s; font-size: 12px; }
    .scene-item:hover { background: rgba(0,229,255,.05); border-left-color: var(--accent); }
    .scene-item.active { background: rgba(0,229,255,.08); border-left-color: var(--accent); color: var(--accent); }
    .scene-name { font-weight: 700; font-size: 11px; }
    .scene-meta { color: var(--muted); font-size: 10px; margin-top: 2px; }

    .sample-list { max-height: 220px; overflow-y: auto; }
    .sample-item { padding: 8px 16px; cursor: pointer; font-size: 11px; color: var(--muted); border-left: 2px solid transparent; transition: all .15s; display: flex; justify-content: space-between; align-items: center; }
    .sample-item:hover { background: rgba(0,229,255,.04); color: var(--text); }
    .sample-item.active { border-left-color: var(--accent); color: var(--accent); background: rgba(0,229,255,.06); }
    .sample-idx { font-size: 10px; opacity: .5; }

    .content { overflow-y: auto; display: flex; flex-direction: column; background: var(--bg); }

    .tab-bar { display: flex; border-bottom: 1px solid var(--border); background: var(--surface); padding: 0 16px; flex-shrink: 0; }
    .tab { padding: 14px 18px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; color: var(--muted); border-bottom: 2px solid transparent; transition: all .15s; }
    .tab:hover { color: var(--text); }
    .tab.active { color: var(--accent); border-bottom-color: var(--accent); }

    .camera-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; padding: 2px; background: var(--border); }
    .camera-cell { position: relative; background: #0a0e14; aspect-ratio: 16/9; overflow: hidden; }
    .camera-cell img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .3s; }
    .camera-cell:hover img { transform: scale(1.03); }
    .camera-label { position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,.75); backdrop-filter: blur(4px); border: 1px solid rgba(0,229,255,.3); color: var(--accent); font-size: 9px; font-weight: 700; letter-spacing: 1.5px; padding: 3px 7px; border-radius: 2px; }
    .camera-missing { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 10px; }

    .lidar-wrapper { position: relative; height: 480px; background: #050810; }
    .lidar-hud { position: absolute; top: 12px; left: 12px; font-size: 10px; color: #636e7b; pointer-events: none; line-height: 1.8; }
    .lidar-hint { position: absolute; bottom: 12px; right: 12px; font-size: 9px; color: #636e7b; pointer-events: none; text-align: right; line-height: 1.8; }

    .ann-sidebar { background: var(--surface); border-left: 1px solid var(--border); overflow-y: auto; display: flex; flex-direction: column; }
    .ann-header { padding: 14px 16px 8px; border-bottom: 1px solid var(--border); display: flex; align-items: baseline; gap: 8px; }
    .ann-title { font-family: var(--font-display); font-weight: 600; font-size: 13px; color: #fff; }
    .ann-count { font-size: 10px; color: var(--accent); background: rgba(0,229,255,.1); border: 1px solid rgba(0,229,255,.2); padding: 1px 6px; border-radius: 10px; }
    .ann-item { padding: 10px 14px; border-bottom: 1px solid var(--border); display: flex; gap: 10px; align-items: flex-start; transition: background .1s; cursor: pointer; }
    .ann-item:hover { background: rgba(255,255,255,.03); }
    .ann-item.highlighted { background: rgba(0,229,255,.06); border-left: 2px solid var(--accent); }
    .ann-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 3px; flex-shrink: 0; }
    .ann-body { flex: 1; min-width: 0; }
    .ann-cat { font-size: 11px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ann-pts { font-size: 9px; color: var(--muted); margin-top: 3px; display: flex; gap: 8px; }
    .ann-pts span { display: flex; align-items: center; gap: 3px; }

    .sensor-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 14px 16px; border-bottom: 1px solid var(--border); }
    .chip { font-size: 9px; font-weight: 700; letter-spacing: 1px; padding: 4px 8px; border-radius: 2px; border: 1px solid; }
    .chip-cam   { color: var(--accent); border-color: rgba(0,229,255,.3);   background: rgba(0,229,255,.07); }
    .chip-lidar { color: #69f0ae;       border-color: rgba(105,240,174,.3); background: rgba(105,240,174,.07); }
    .chip-radar { color: #ffd740;       border-color: rgba(255,215,64,.3);  background: rgba(255,215,64,.07); }

    .loading { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--muted); font-size: 12px; flex-direction: column; gap: 12px; }
    .spinner { width: 24px; height: 24px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `}</style>
);

// ── PCD BINARY PARSER ─────────────────────────────────────────────────────────
async function parsePCDBin(buffer: ArrayBuffer): Promise<Point3D[]> {
  const view = new DataView(buffer);
  const FLOATS_PER_PT = 5; // x y z intensity ring
  const count = Math.floor(buffer.byteLength / (FLOATS_PER_PT * 4));
  const pts: Point3D[] = [];
  for (let i = 0; i < count; i++) {
    const o = i * FLOATS_PER_PT * 4;
    pts.push({
      x: view.getFloat32(o,     true),
      y: view.getFloat32(o + 4, true),
      z: view.getFloat32(o + 8, true),
    });
  }
  return pts;
}

// ── R3F: POINT CLOUD MESH ─────────────────────────────────────────────────────
// This inner component runs INSIDE the <Canvas> context.
// useMemo builds the BufferGeometry once per points array change.
// useFrame is available here because we're inside Canvas.
interface PointCloudProps {
  points: Point3D[];
}

const PointCloud: FC<PointCloudProps> = ({ points }) => {
  const meshRef = useRef<THREE.Points>(null);

  // Build BufferGeometry from raw Point3D array
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    const colors    = new Float32Array(points.length * 3);
    const c         = new THREE.Color();

    points.forEach((p, i) => {
      positions[i * 3]     = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      // Height-based HSL coloring: blue (low) → green → red (high)
      const t = Math.min(Math.max((p.z + 2) / 5, 0), 1);
      c.setHSL(0.55 - t * 0.55, 1.0, 0.55);
      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    });

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [points]);

  // Slow idle rotation — stops when user interacts (OrbitControls takes over)
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * 0.03;
    }
  });

  return (
    <points ref={meshRef} geometry={geometry}>
      <pointsMaterial
        size={0.07}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.9}
      />
    </points>
  );
};

// ── R3F: ANNOTATION BOXES ─────────────────────────────────────────────────────
// Renders wireframe bounding boxes for each annotation in 3D space.
interface AnnotationBoxesProps {
  annotations: Annotation[];
  highlightedToken: string | null;
}

const AnnotationBoxes: FC<AnnotationBoxesProps> = ({ annotations, highlightedToken }) => {
  return (
    <>
      {annotations.map((ann) => {
        const [w, l, h] = ann.size;          // width, length, height
        const [x, y, z] = ann.translation;   // world position
        const color = getCategoryColor(ann.category);
        const isHighlighted = ann.token === highlightedToken;

        return (
          <group key={ann.token} position={[x - 400, y - 1150, z]}>
            {/* Wireframe box */}
            <mesh>
              <boxGeometry args={[w, l, h]} />
              <meshBasicMaterial
                color={color}
                wireframe
                opacity={isHighlighted ? 1 : 0.5}
                transparent
              />
            </mesh>
            {/* Label visible on highlight */}
            {isHighlighted && (
              <Html center distanceFactor={30}>
                <div style={{
                  background: "rgba(0,0,0,.85)",
                  border: `1px solid ${color}`,
                  color,
                  fontSize: 9,
                  fontFamily: "Space Mono, monospace",
                  padding: "3px 7px",
                  borderRadius: 2,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}>
                  {ann.category}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
};

// ── R3F: LIDAR SCENE (inside Canvas) ─────────────────────────────────────────
interface LidarSceneProps {
  points: Point3D[];
  annotations: Annotation[];
  highlightedToken: string | null;
}

const LidarScene: FC<LidarSceneProps> = ({ points, annotations, highlightedToken }) => {
  return (
    <>
      {/* Ambient + directional light (needed for future mesh objects) */}
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />

      {/* The actual point cloud */}
      <PointCloud points={points} />

      {/* Bounding box annotations */}
      <AnnotationBoxes annotations={annotations} highlightedToken={highlightedToken} />

      {/* Reference ground grid from drei */}
      <Grid
        args={[100, 100]}
        cellSize={2}
        cellThickness={0.4}
        cellColor="#1c2532"
        sectionSize={10}
        sectionThickness={0.8}
        sectionColor="#2d3f55"
        fadeDistance={80}
        fadeStrength={1}
        followCamera={false}
        position={[0, 0, -2]}
      />

      {/* Full orbit controls from drei — replaces manual mouse math */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        zoomSpeed={0.8}
        minDistance={5}
        maxDistance={120}
      />
    </>
  );
};

// ── LIDAR VIEWER (wrapper with Canvas) ───────────────────────────────────────
interface LidarViewerProps {
  points: Point3D[] | null;
  annotations: Annotation[];
  highlightedToken: string | null;
}

const LidarViewer: FC<LidarViewerProps> = ({ points, annotations, highlightedToken }) => {
  if (!points) {
    return (
      <div className="lidar-wrapper">
        <div className="loading"><div className="spinner" /><span>Loading LiDAR...</span></div>
      </div>
    );
  }
  if (points.length === 0) {
    return (
      <div className="lidar-wrapper">
        <div className="loading"><span>No LiDAR data available for this frame</span></div>
      </div>
    );
  }

  return (
    <div className="lidar-wrapper">
      {/* React Three Fiber Canvas — declarative WebGL */}
      <Canvas
        camera={{ position: [0, -40, 25], fov: 60, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "#050810" }}
      >
        {/* Stats overlay (FPS / draw calls) — remove in production */}
        <Stats className="r3f-stats" />

        <LidarScene
          points={points}
          annotations={annotations}
          highlightedToken={highlightedToken}
        />
      </Canvas>

      <div className="lidar-hud">
        LIDAR_TOP · {points.length.toLocaleString()} pts<br />
        BOXES · {annotations.length} objects
      </div>
      <div className="lidar-hint">
        Left drag → rotate<br />
        Right drag → pan<br />
        Scroll → zoom
      </div>
    </div>
  );
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
type ActiveTab = "cameras" | "lidar";

const getChipClass = (channel: string): string => {
  if (channel.startsWith("CAM"))   return "chip chip-cam";
  if (channel.startsWith("LIDAR")) return "chip chip-lidar";
  return "chip chip-radar";
};

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [scenes,           setScenes]           = useState<Scene[]>([]);
  const [selectedScene,    setSelectedScene]    = useState<Scene | null>(null);
  const [sceneSamples,     setSceneSamples]     = useState<SampleListItem[]>([]);
  const [selectedSample,   setSelectedSample]   = useState<SampleListItem | null>(null);
  const [sampleData,       setSampleData]       = useState<SampleData | null>(null);
  const [lidarPoints,      setLidarPoints]      = useState<Point3D[] | null>(null);
  const [activeTab,        setActiveTab]        = useState<ActiveTab>("cameras");
  const [loadingScenes,    setLoadingScenes]    = useState<boolean>(true);
  const [highlightedToken, setHighlightedToken] = useState<string | null>(null);

  // Load scenes
  useEffect(() => {
    fetch(`${API}/scenes?limit=20`)
      .then((r) => r.json() as Promise<ScenesResponse>)
      .then((d) => { setScenes(d.scenes ?? []); setLoadingScenes(false); })
      .catch(() => setLoadingScenes(false));
  }, []);

  // Load samples when scene changes
  useEffect(() => {
    if (!selectedScene) return;
    setSceneSamples([]);
    setSampleData(null);
    setSelectedSample(null);
    setLidarPoints(null);
    fetch(`${API}/scenes/${selectedScene.token}/samples`)
      .then((r) => r.json() as Promise<SceneSamplesResponse>)
      .then((d) => {
        setSceneSamples(d.samples ?? []);
        if (d.samples?.length) selectSample(d.samples[0]);
      });
  }, [selectedScene]);

  const selectSample = (sample: SampleListItem): void => {
    setSelectedSample(sample);
    setSampleData(null);
    setLidarPoints(null);
    setHighlightedToken(null);
    fetch(`${API}/samples/${sample.token}`)
      .then((r) => r.json() as Promise<SampleData>)
      .then((d) => {
        setSampleData(d);
        const lidar = d.sensors?.LIDAR_TOP;
        if (lidar?.filename) {
          fetch(`${API}/data/${lidar.filename}`)
            .then((r) => r.arrayBuffer())
            .then((buf) => parsePCDBin(buf).then(setLidarPoints))
            .catch(() => setLidarPoints([]));
        }
      });
  };

  const sensors     = sampleData?.sensors     ?? {};
  const annotations = sampleData?.annotations ?? [];

  return (
    <>
      <GlobalStyles />
      <div className="app">

        {/* HEADER */}
        <header className="header">
          <div className="header-logo">nu<span>SCENES</span></div>
          <div className="header-sep" />
          <div className="header-token">
            {selectedSample ? `FRAME · ${selectedSample.token}` : "Select a scene to begin"}
          </div>
          <div className="status-dot" title="API connected" />
        </header>

        <div className="main">

          {/* LEFT SIDEBAR */}
          <aside className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-label">Scenes</div>
              {loadingScenes
                ? <div className="loading" style={{ height: 80 }}><div className="spinner" /></div>
                : scenes.map((s) => (
                    <div
                      key={s.token}
                      className={`scene-item ${selectedScene?.token === s.token ? "active" : ""}`}
                      onClick={() => setSelectedScene(s)}
                    >
                      <div className="scene-name">{s.name}</div>
                      <div className="scene-meta">{s.nbr_samples} frames · {s.description?.slice(0, 40) || "—"}</div>
                    </div>
                  ))
              }
            </div>

            {sceneSamples.length > 0 && (
              <div className="sidebar-section">
                <div className="sidebar-label">Frames ({sceneSamples.length})</div>
                <div className="sample-list">
                  {sceneSamples.map((s, i) => (
                    <div
                      key={s.token}
                      className={`sample-item ${selectedSample?.token === s.token ? "active" : ""}`}
                      onClick={() => selectSample(s)}
                    >
                      <span>Frame {String(i + 1).padStart(3, "0")}</span>
                      <span className="sample-idx">{s.anns_count} ann</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* CENTER CONTENT */}
          <main className="content">
            {!sampleData ? (
              <div className="loading" style={{ height: "100%" }}>
                {selectedScene
                  ? <><div className="spinner" /><span>Loading frame data...</span></>
                  : <span style={{ color: "var(--muted)", fontSize: 13 }}>← Pick a scene</span>
                }
              </div>
            ) : (
              <>
                <div className="sensor-chips">
                  {Object.keys(sensors).map((ch) => (
                    <span key={ch} className={getChipClass(ch)}>{ch.replace(/_/g, " ")}</span>
                  ))}
                </div>

                <div className="tab-bar">
                  {(["cameras", "lidar"] as ActiveTab[]).map((t) => (
                    <div
                      key={t}
                      className={`tab ${activeTab === t ? "active" : ""}`}
                      onClick={() => setActiveTab(t)}
                    >
                      {t === "cameras" ? "📷 Cameras" : "🔵 LiDAR + Boxes"}
                    </div>
                  ))}
                </div>

                {activeTab === "cameras" && (
                  <div className="camera-grid">
                    {CAMERA_CHANNELS.map((ch: CameraChannel) => {
                      const s = sensors[ch];
                      return (
                        <div key={ch} className="camera-cell">
                          {s?.filename
                            ? <img src={`${API}/data/${s.filename}`} alt={ch} loading="lazy" />
                            : <div className="camera-missing">No image</div>
                          }
                          <div className="camera-label">{ch.replace("CAM_", "").replace(/_/g, " ")}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === "lidar" && (
                  <LidarViewer
                    points={lidarPoints}
                    annotations={annotations}
                    highlightedToken={highlightedToken}
                  />
                )}
              </>
            )}
          </main>

          {/* RIGHT SIDEBAR — ANNOTATIONS */}
          <aside className="ann-sidebar">
            <div className="ann-header">
              <span className="ann-title">Annotations</span>
              {annotations.length > 0 && <span className="ann-count">{annotations.length}</span>}
            </div>

            {annotations.length === 0 ? (
              <div className="loading" style={{ height: 120 }}>
                <span>No frame selected</span>
              </div>
            ) : (
              annotations.map((ann: Annotation, i: number) => (
                <div
                  key={ann.token || i}
                  className={`ann-item ${highlightedToken === ann.token ? "highlighted" : ""}`}
                  onClick={() => {
                    setHighlightedToken(highlightedToken === ann.token ? null : ann.token);
                    setActiveTab("lidar");
                  }}
                >
                  <div className="ann-dot" style={{ background: getCategoryColor(ann.category) }} />
                  <div className="ann-body">
                    <div className="ann-cat" title={ann.category}>{ann.category}</div>
                    <div className="ann-pts">
                      <span>🔵 {ann.num_lidar_pts} lidar</span>
                      <span>📡 {ann.num_radar_pts} radar</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </aside>
        </div>
      </div>
    </>
  );
}