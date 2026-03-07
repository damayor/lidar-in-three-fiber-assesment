import { useState, useEffect, useRef, useMemo, type FC } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Html, Stats } from "@react-three/drei";
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
interface ScenesResponse { total: number; offset: number; limit: number; scenes: Scene[]; }
interface SceneSamplesResponse { scene_token: string; scene_name: string; total_samples: number; samples: SampleListItem[]; }
interface Point3D { x: number; y: number; z: number; }

// ── PCD PARSER ────────────────────────────────────────────────────────────────
async function parsePCDBin(buffer: ArrayBuffer): Promise<Point3D[]> {
  const view = new DataView(buffer);
  const FLOATS = 5; // x y z intensity ring
  const count = Math.floor(buffer.byteLength / (FLOATS * 4));
  const pts: Point3D[] = [];
  for (let i = 0; i < count; i++) {
    const o = i * FLOATS * 4;
    pts.push({
      x: view.getFloat32(o,     true),
      y: view.getFloat32(o + 4, true),
      z: view.getFloat32(o + 8, true),
    });
  }
  return pts;
}

// ── R3F: POINT CLOUD ─────────────────────────────────────────────────────────
const PointCloud: FC<{ points: Point3D[] }> = ({ points }) => {
  const ref = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(points.length * 3);
    const col = new Float32Array(points.length * 3);
    const c   = new THREE.Color();
    points.forEach((p, i) => {
      pos[i*3]=p.x; pos[i*3+1]=p.y; pos[i*3+2]=p.z;
      const t = Math.min(Math.max((p.z + 2) / 5, 0), 1);
      c.setHSL(0.55 - t * 0.55, 1, 0.55);
      col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
    });
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(col, 3));
    return geo;
  }, [points]);

  // Slow idle rotation — OrbitControls pauses this when user interacts
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.z += dt * 0.025; });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial size={0.07} vertexColors sizeAttenuation transparent opacity={0.9} />
    </points>
  );
};

// ── R3F: BOUNDING BOXES ───────────────────────────────────────────────────────
// FIX: compute centroid of point cloud to offset annotation world coords
const AnnotationBoxes: FC<{
  annotations: Annotation[];
  highlightedToken: string | null;
  centroid: [number, number, number];
}> = ({ annotations, highlightedToken, centroid }) => (
  <>
    {annotations.map((ann) => {
      const [w, l, h] = ann.size;
      // Offset world coords by point cloud centroid so boxes align with points
      const x = ann.translation[0] - centroid[0];
      const y = ann.translation[1] - centroid[1];
      const z = ann.translation[2] - centroid[2];
      const color = getCategoryColor(ann.category);
      const isHighlighted = ann.token === highlightedToken;

      return (
        <group key={ann.token} position={[x, y, z]}>
          <mesh>
            <boxGeometry args={[w, l, h]} />
            <meshBasicMaterial
              color={color}
              wireframe
              transparent
              opacity={isHighlighted ? 1.0 : 0.45}
            />
          </mesh>
          {isHighlighted && (
            <Html center distanceFactor={25}>
              <div style={{
                background: "rgba(0,0,0,.9)",
                border: `1px solid ${color}`,
                color,
                fontSize: 9,
                fontFamily: "monospace",
                padding: "3px 8px",
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

// ── R3F: LIDAR VIEWER ────────────────────────────────────────────────────────
interface LidarViewerProps {
  points: Point3D[] | null;
  annotations: Annotation[];
  highlightedToken: string | null;
}

const LidarViewer: FC<LidarViewerProps> = ({ points, annotations, highlightedToken }) => {
  // Compute centroid once so boxes align with the point cloud
  const centroid = useMemo((): [number, number, number] => {
    if (!points || points.length === 0) return [0, 0, 0];
    let sx = 0, sy = 0, sz = 0;
    for (const p of points) { sx += p.x; sy += p.y; sz += p.z; }
    const n = points.length;
    return [sx / n, sy / n, sz / n];
  }, [points]);

  if (!points) return (
    <div className="flex items-center justify-center h-[480px] bg-[#050810] flex-col gap-3">
      <div className="w-6 h-6 border-2 border-[#1c2532] border-t-[#00e5ff] rounded-full animate-spin" />
      <span className="text-[#636e7b] text-xs font-mono">Loading LiDAR...</span>
    </div>
  );

  if (points.length === 0) return (
    <div className="flex items-center justify-center h-[480px] bg-[#050810]">
      <span className="text-[#636e7b] text-xs font-mono">No LiDAR data for this frame</span>
    </div>
  );

  return (
    <div className="relative h-[480px] bg-[#050810]">
      <Canvas
        camera={{ position: [0, -40, 25], fov: 60, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "#050810" }}
      >
        <Stats />
        <ambientLight intensity={0.3} />
        <PointCloud points={points} />
        <AnnotationBoxes
          annotations={annotations}
          highlightedToken={highlightedToken}
          centroid={centroid}
        />
        <Grid
          args={[120, 120]}
          cellSize={2}
          cellColor="#1c2532"
          sectionSize={10}
          sectionColor="#2d3f55"
          fadeDistance={90}
          position={[0, 0, -3]}
        />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.6}
          zoomSpeed={0.8}
          minDistance={4}
          maxDistance={140}
        />
      </Canvas>

      {/* HUD overlays */}
      <div className="absolute top-3 left-3 text-[10px] font-mono text-[#636e7b] pointer-events-none leading-relaxed">
        <span className="text-[#69f0ae]">LIDAR_TOP</span> · {points.length.toLocaleString()} pts<br />
        <span className="text-[#00e5ff]">BOXES</span> · {annotations.length} objects
      </div>
      <div className="absolute bottom-3 right-3 text-[9px] font-mono text-[#636e7b] pointer-events-none text-right leading-loose">
        Left drag → rotate<br />
        Right drag → pan<br />
        Scroll → zoom
      </div>
    </div>
  );
};

// ── CHIP helper ───────────────────────────────────────────────────────────────
const SensorChip: FC<{ channel: string }> = ({ channel }) => {
  const isCam   = channel.startsWith("CAM");
  const isLidar = channel.startsWith("LIDAR");
  const base = "text-[9px] font-bold tracking-widest px-2 py-1 rounded-sm border font-mono";
  const variant = isCam
    ? "text-[#00e5ff] border-[#00e5ff]/30 bg-[#00e5ff]/07"
    : isLidar
      ? "text-[#69f0ae] border-[#69f0ae]/30 bg-[#69f0ae]/07"
      : "text-[#ffd740] border-[#ffd740]/30 bg-[#ffd740]/07";
  return <span className={`${base} ${variant}`}>{channel.replace(/_/g, " ")}</span>;
};

// ── TIMELINE ─────────────────────────────────────────────────────────────────
interface TimelineProps {
  samples: SampleListItem[];
  selectedToken: string | null;
  onSelect: (s: SampleListItem) => void;
}

const Timeline: FC<TimelineProps> = ({ samples, selectedToken, onSelect }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedIdx = samples.findIndex(s => s.token === selectedToken);

  // Auto-scroll selected frame into view
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-active="true"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedToken]);

  if (samples.length === 0) return null;

  return (
    <div className="border-t border-[#1c2532] bg-[#0d1117] flex-shrink-0">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1c2532]">
        <span className="text-[9px] font-bold tracking-[2px] text-[#636e7b] uppercase font-mono">Timeline</span>
        <div className="flex-1 h-px bg-[#1c2532]" />
        <span className="text-[9px] font-mono text-[#636e7b]">
          {selectedIdx + 1} / {samples.length}
        </span>
        {/* Prev / Next buttons */}
        <button
          onClick={() => selectedIdx > 0 && onSelect(samples[selectedIdx - 1])}
          disabled={selectedIdx <= 0}
          className="text-[10px] font-mono text-[#636e7b] hover:text-[#00e5ff] disabled:opacity-20 px-1 transition-colors"
        >
          ◀
        </button>
        <button
          onClick={() => selectedIdx < samples.length - 1 && onSelect(samples[selectedIdx + 1])}
          disabled={selectedIdx >= samples.length - 1}
          className="text-[10px] font-mono text-[#636e7b] hover:text-[#00e5ff] disabled:opacity-20 px-1 transition-colors"
        >
          ▶
        </button>
      </div>

      {/* Scrollable frame strip */}
      <div ref={scrollRef} className="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-thin">
        {/* Timeline track line */}
        <div className="absolute left-0 right-0 h-px bg-[#1c2532] pointer-events-none" style={{ top: "50%" }} />

     {/* //aca va */}






      {samples.map((s, i) => {
          const isActive = s.token === selectedToken;
          return (
            <button
              key={s.token}
              data-active={isActive}
              onClick={() => onSelect(s)}
              title={`Frame ${i + 1} · ${s.anns_count} ann`}
              className="relative flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full transition-all duration-150 group"
            >
              <div className={`w-2.5 h-2.5 rounded-full border transition-all duration-150 ${
                isActive
                  ? "bg-[#00e5ff] border-[#00e5ff] scale-125 shadow-[0_0_6px_#00e5ff]"
                  : "bg-[#1c2532] border-[#2d3f55] group-hover:bg-[#636e7b] group-hover:border-[#636e7b]"
              }`} />
            </button>
        )}
      )}








      </div>
    </div>
  );
};

// ── MAIN APP ──────────────────────────────────────────────────────────────────
type ActiveTab = "cameras" | "lidar";

export default function App() {
  const [scenes,           setScenes]           = useState<Scene[]>([]);
  const [selectedScene,    setSelectedScene]    = useState<Scene | null>(null);
  const [sceneSamples,     setSceneSamples]     = useState<SampleListItem[]>([]);
  const [selectedSample,   setSelectedSample]   = useState<SampleListItem | null>(null);
  const [sampleData,       setSampleData]       = useState<SampleData | null>(null);
  const [lidarPoints,      setLidarPoints]      = useState<Point3D[] | null>(null);
  const [activeTab,        setActiveTab]        = useState<ActiveTab>("cameras");
  const [loadingScenes,    setLoadingScenes]    = useState(true);
  const [highlightedToken, setHighlightedToken] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/scenes?limit=20`)
      .then(r => r.json() as Promise<ScenesResponse>)
      .then(d => { setScenes(d.scenes ?? []); setLoadingScenes(false); })
      .catch(() => setLoadingScenes(false));
  }, []);

  useEffect(() => {
    if (!selectedScene) return;
    setSceneSamples([]);
    setSampleData(null);
    setSelectedSample(null);
    setLidarPoints(null);
    fetch(`${API}/scenes/${selectedScene.token}/samples`)
      .then(r => r.json() as Promise<SceneSamplesResponse>)
      .then(d => {
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
      .then(r => r.json() as Promise<SampleData>)
      .then(d => {
        setSampleData(d);
        const lidar = d.sensors?.LIDAR_TOP;
        if (lidar?.filename) {
          fetch(`${API}/data/${lidar.filename}`)
            .then(r => r.arrayBuffer())
            .then(buf => parsePCDBin(buf).then(setLidarPoints))
            .catch(() => setLidarPoints([]));
        }
      });
  };

  const sensors     = sampleData?.sensors     ?? {};
  const annotations = sampleData?.annotations ?? [];

  return (
    <div className="h-screen bg-[#080c10] text-[#cdd9e5] font-mono flex flex-col overflow-hidden">

      {/* ── HEADER ── */}
      <header className="flex items-center gap-4 px-6 h-14 bg-[#0d1117] border-b border-[#1c2532] shrink-0 z-10">
        <span className="font-['Syne'] font-extrabold text-lg tracking-tight text-white">
          nu<span className="text-[#00e5ff]">SCENES</span>
        </span>
        <div className="w-px h-6 bg-[#1c2532]" />
        <span className="text-[11px] text-[#636e7b] flex-1 truncate">
          {selectedSample ? `FRAME · ${selectedSample.token}` : "Select a scene to begin"}
        </span>
        <div className="w-2 h-2 rounded-full bg-[#69f0ae] shadow-[0_0_8px_#69f0ae] animate-pulse" title="API connected" />
      </header>

      {/* ── BODY (sidebar + content + annotations) ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT SIDEBAR — only scenes now */}
        <aside className="w-64 bg-[#0d1117] border-r border-[#1c2532] flex flex-col overflow-y-auto shrink-0">
          <div className="px-4 py-3 text-[10px] font-bold tracking-[2px] text-[#636e7b] uppercase border-b border-[#1c2532]">
            Scenes
          </div>
          {loadingScenes ? (
            <div className="flex items-center justify-center h-20">
              <div className="w-5 h-5 border-2 border-[#1c2532] border-t-[#00e5ff] rounded-full animate-spin" />
            </div>
          ) : (
            scenes.map(s => (
              <button
                key={s.token}
                onClick={() => setSelectedScene(s)}
                className={`
                  w-full text-left px-4 py-3 border-l-2 transition-all text-xs
                  ${selectedScene?.token === s.token
                    ? "border-[#00e5ff] bg-[#00e5ff]/08 text-[#00e5ff]"
                    : "border-transparent hover:border-cya [#00e5ff] hover:bg-[#00e5ff]/05 text-[#cdd9e5]"
                  }
                `}
              >
                <div className="font-bold text-[11px]">{s.name}</div>
                <div className="text-[#636e7b] text-[10px] mt-0.5">
                  {s.nbr_samples} frames · {s.description?.slice(0, 36) || "—"}
                </div>
              </button>
            ))
          )}
        </aside>

        {/* CENTER — tabs + content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#080c10]">
          {!sampleData ? (
            <div className="flex-1 flex items-center justify-center flex-col gap-3">
              {selectedScene
                ? <><div className="w-6 h-6 border-2 border-[#1c2532] border-t-[#00e5ff] rounded-full animate-spin" /><span className="text-[#636e7b] text-xs">Loading frame...</span></>
                : <span className="text-[#636e7b] text-sm">← Pick a scene from the left</span>
              }
            </div>
          ) : (
            <>
              {/* Sensor chips */}
              <div className="flex flex-wrap gap-1.5 px-4 py-3 border-b border-[#1c2532] shrink-0">
                {Object.keys(sensors).map(ch => <SensorChip key={ch} channel={ch} />)}
              </div>

              {/* Tab bar */}
              <div className="flex border-b border-[#1c2532] bg-[#0d1117] px-4 shrink-0">
                {(["cameras", "lidar"] as ActiveTab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`
                      px-4 py-3.5 text-[11px] font-bold tracking-widest uppercase border-b-2 transition-all
                      ${activeTab === t
                        ? "text-[#00e5ff] border-[#00e5ff]"
                        : "text-[#636e7b] border-transparent hover:text-[#cdd9e5]"
                      }
                    `}
                  >
                    {t === "cameras" ? "📷 Cameras" : "🔵 LiDAR + Boxes"}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-auto">
                {activeTab === "cameras" && (
                  <div className="grid grid-cols-3 gap-0.5 p-0.5 bg-[#1c2532]">
                    {CAMERA_CHANNELS.map((ch: CameraChannel) => {
                      const s = sensors[ch];
                      return (
                        <div key={ch} className="relative bg-[#0a0e14] aspect-video overflow-hidden group">
                          {s?.filename
                            ? <img src={`${API}/data/${s.filename}`} alt={ch} loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                            : <div className="w-full h-full flex items-center justify-center text-[#636e7b] text-[10px]">No image</div>
                          }
                          <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm border border-[#00e5ff]/30 text-[#00e5ff] text-[9px] font-bold tracking-[1.5px] px-1.5 py-0.5 rounded-sm">
                            {ch.replace("CAM_", "").replace(/_/g, " ")}
                          </div>
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
              </div>
            </>
          )}

          {/* ── TIMELINE at the bottom of center ── */}
          <Timeline
            samples={sceneSamples}
            selectedToken={selectedSample?.token ?? null}
            onSelect={selectSample}
          />
        </main>

        {/* RIGHT SIDEBAR — annotations */}
        <aside className="w-72 bg-[#0d1117] border-l border-[#1c2532] flex flex-col overflow-y-auto shrink-0">
          <div className="flex items-baseline gap-2 px-4 py-3 border-b border-[#1c2532] shrink-0">
            <span className="font-['Syne'] font-semibold text-[13px] text-white">Annotations</span>
            {annotations.length > 0 && (
              <span className="text-[10px] text-[#00e5ff] bg-[#00e5ff]/10 border border-[#00e5ff]/20 px-1.5 py-0.5 rounded-full">
                {annotations.length}
              </span>
            )}
            {highlightedToken && (
              <button
                onClick={() => setHighlightedToken(null)}
                className="ml-auto text-[9px] text-[#636e7b] hover:text-[#ff6d00] transition-colors"
              >
                ✕ clear
              </button>
            )}
          </div>

          {annotations.length === 0 ? (
            <div className="flex items-center justify-center h-28 text-[#636e7b] text-xs">
              No frame selected
            </div>
          ) : (
            <div className="text-[10px] text-[#636e7b] px-4 py-2 border-b border-[#1c2532]">
              Click an annotation to highlight it in the LiDAR view
            </div>
          )}

          {annotations.map((ann, i) => {
            const color = getCategoryColor(ann.category);
            const isHighlighted = highlightedToken === ann.token;
            return (
              <button
                key={ann.token || i}
                onClick={() => {
                  setHighlightedToken(isHighlighted ? null : ann.token);
                  setActiveTab("lidar");
                }}
                className={`
                  w-full text-left flex gap-2.5 items-start px-3.5 py-2.5
                  border-b border-[#1c2532] border-l-2 transition-all
                  ${isHighlighted
                    ? "bg-[#00e5ff]/06 border-l-[#00e5ff]"
                    : "border-l-transparent hover:bg-white/[0.02] hover:border-l-[#2d3f55]"
                  }
                `}
              >
                <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: color, boxShadow: isHighlighted ? `0 0 6px ${color}` : "none" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-[#cdd9e5] truncate">{ann.category}</div>
                  <div className="flex gap-2 mt-0.5 text-[9px] text-[#636e7b]">
                    <span>🔵 {ann.num_lidar_pts} lidar</span>
                    <span>📡 {ann.num_radar_pts} radar</span>
                  </div>
                </div>
                {isHighlighted && <span className="text-[#00e5ff] text-[9px] mt-1 shrink-0">●</span>}
              </button>
            );
          })}
        </aside>
      </div>
    </div>
  );
}