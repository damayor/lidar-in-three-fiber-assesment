import { useState, useEffect } from "react";
import {
  API,
  CAMERA_CHANNELS,
  getCategoryColor,
  QUALITY_STYLE,
  type CameraChannel,
} from "./config/constants";
import {
  type Scene,
  type SampleListItem,
  type SampleData,
  type ScenesResponse,
  type SceneSamplesResponse,
  type Point3D,
  type ActiveTab,
  type TransformData,
} from "./interfaces/types";
import { parsePCDBin } from "./utils/pcdParser";
import { SensorChip } from "@components/ui/SensorChip";
import { Timeline } from "@components/ui/Timeline";
import { LidarViewer } from "@components/three/LidarViewer";
import { SimulationPanel } from "@components/ui/SimulationPanel";
import { QualityBanner } from "@components/ui/QualityBanner";

export default function App() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [sceneSamples, setSceneSamples] = useState<SampleListItem[]>([]);
  const [selectedSample, setSelectedSample] = useState<SampleListItem | null>(
    null,
  );
  const [sampleData, setSampleData] = useState<SampleData | null>(null);
  const [lidarPoints, setLidarPoints] = useState<Point3D[] | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("cameras");
  const [loadingScenes, setLoadingScenes] = useState(true);
  const [highlightedToken, setHighlightedToken] = useState<string | null>(null);
  const [transformData, setTransformData] = useState<TransformData | null>(
    null,
  );
  const [serverDown,       setServerDown]       = useState(false);

  // Mock state additions
  const [mockSensor,      setMockSensor]      = useState<string | null>(null);
  const [mockDropAnns,    setMockDropAnns]    = useState<boolean>(false);

  useEffect(() => {
    fetch(`${API}/scenes?limit=20`)
      .then((r) => r.json() as Promise<ScenesResponse>)
      .then((d) => {
        setScenes(d.scenes ?? []);
        setLoadingScenes(false);
      })
      .catch(() => {
        setLoadingScenes(false)
        setServerDown(true)
      });
  }, []);

  const selectSample = (sample: SampleListItem, dropSensor?: string | null, dropAnns?: boolean): void => {
    console.log("sample token", sample.token);
    setSelectedSample(sample);
    setSampleData(null);
    setLidarPoints(null);
    setHighlightedToken(null);

    // Build query string only if mocking
    const params = new URLSearchParams();
    if (dropSensor)  params.set("drop_sensor", dropSensor);
    if (dropAnns)    params.set("drop_annotations", "true");
    const qs = params.size ? `?${params}` : "";

    fetch(`${API}/samples/${sample.token}${qs}`)
      .then((r) => r.json() as Promise<SampleData>)
      .then((d) => {
        const q = d.quality;
        //wow!
        const logFn = q.overall_status === "PASS"    ? console.info
                    : q.overall_status === "WARNING"  ? console.warn
                    : console.error;
        logFn(
          `[nuScenes quality] ${q.overall_status} — frame ${sample.token}`,
          q.checks.map(c => `${c.name}: ${c.status} — ${c.message}`)
        );

        setSampleData(d);
        const lidar = d.sensors?.LIDAR_TOP;
        if (lidar?.filename) {
          fetch(`${API}/data/${lidar.filename}`)
            .then((r) => r.arrayBuffer())
            .then((buf) => parsePCDBin(buf).then(setLidarPoints))
            .catch(() => setLidarPoints([]));
        }
      });

    fetch(`${API}/sensor-data/sample/${sample.token}/channel/LIDAR_TOP`)
      .then((r) => r.json())
      .then((sd) => {
        setTransformData({
          egoTranslation: sd.ego_pose.translation,
          sensorTranslation: sd.calibration.translation,
        });
      });
  };

  // Handler called by SimulationPanel
  const handleSimulate = (dropSensor: string | null, dropAnns: boolean): void => {
    setMockSensor(dropSensor);
    setMockDropAnns(dropAnns);
    if (selectedSample) selectSample(selectedSample, dropSensor, dropAnns);
  };

  //ToImport hook setXXX(null) is causing re render triggered by Eslint
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
        if (d.samples?.length) 
            selectSample(d.samples[0]);
      });
  }, [selectedScene]);

  const sensors = sampleData?.sensors ?? {};
  const annotations = sampleData?.annotations ?? [];
  const quality     = sampleData?.quality     ?? null;

  return (
    <div className="h-screen bg-[#080c10] text-[#cdd9e5] font-mono flex flex-col overflow-hidden">
      {/* ── HEADER ── */}
      <header className="flex items-center gap-4 px-6 h-14 bg-[#0d1117] border-b border-[#1c2532] shrink-0 z-10">
        <span className="font-['Montserrat'] font-extrabold text-lg tracking-tight text-white">
          nu<span className="text-cyan-400">SCENES</span>
        </span>
        <div className="w-px h-6 bg-[#1c2532]" />
        <span className="text-[11px] text-[#636e7b] flex-1 truncate">
          {selectedSample
            ? `FRAME · ${selectedSample.token}`
            : "Select a scene to begin"}
        </span>
        {/* NEW: overall quality badge in header when a frame is loaded */}
        {quality && (
          <span className={`text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-sm border font-mono ${QUALITY_STYLE[quality.overall_status].badge}`}>
            {quality.overall_status}
          </span>
        )}
        <div
          className="w-2 h-2 rounded-full bg-[#69f0ae] shadow-[0_0_8px_#69f0ae] animate-pulse"
          title="API connected"
        />
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
              <div className="w-5 h-5 border-2 border-[#1c2532] border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : (
            scenes.map((s) => (
              <button
                key={s.token}
                onClick={() => setSelectedScene(s)}
                className={`
                  w-full text-left px-4 py-3 border-l-2 transition-all text-xs
                  ${
                    selectedScene?.token === s.token
                      ? "border-cyan-400 bg-cyan-400/08 text-cyan-400"
                      : "border-transparent hover:border-cyan-400 hover:bg-cyan-400/05 text-[#cdd9e5]"
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
          {/* SIMULATION PANEL — bottom of right sidebar */}
          <div className="mt-auto border-t border-[#1c2532] p-3 shrink-0">
            <SimulationPanel
              availableSensors={Object.keys(sensors)}
              mockState={mockSensor || mockDropAnns
                ? { drop_sensor: mockSensor, drop_annotations: mockDropAnns }
                : null
              }
              onSimulate={handleSimulate}
            />
          </div>
        </aside>

        {/* CENTER — tabs + content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#080c10]">
          {serverDown ? (
            <div className="flex-1 flex items-center justify-center flex-col gap-3">
              <span className={`text-[11px] font-bold tracking-widest px-3 py-1 rounded-sm border ${QUALITY_STYLE.FAIL.badge}`}>FAIL</span>
              <span className="text-red-400 font-mono text-sm font-bold">API SERVER OFFLINE</span>
              <code className="text-[10px] text-[#2d3f55] mt-1">uvicorn main:app --reload --port 8000</code>
            </div>
          ) : !sampleData ? (
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
                {Object.keys(sensors).map((ch) => (
                  <SensorChip key={ch} channel={ch} />
                ))}
              </div>

              {/* NEW: Quality banner — only renders for WARNING or FAIL */}
              {quality && <QualityBanner quality={quality} />}

              {/* Tab bar */}
              <div className="flex border-b border-[#1c2532] bg-[#0d1117] px-4 shrink-0">
                {(["cameras", "lidar"] as ActiveTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`
                      px-4 py-3.5 text-[11px] font-bold tracking-widest uppercase border-b-2 transition-all
                      ${
                        activeTab === t
                          ? "text-cyan-400 border-cyan-400"
                          : "text-[#636e7b] border-transparent hover:text-[#cdd9e5]"
                      }
                    `}
                  >
                    {t === "cameras" ? "📷 Cameras" : "🔵 LiDAR + Boxes"}
                  </button>
                ))}
              </div>

              {/* Main Tab content */}
              <div className="flex-1 overflow-auto">
                {activeTab === "cameras" && (
                  <div className="grid grid-cols-3 gap-0.5 p-0.5 bg-[#1c2532]">
                    {CAMERA_CHANNELS.map((ch: CameraChannel) => {
                      const s = sensors[ch];
                      return (
                        <div
                          key={ch}
                          className="relative bg-[#0a0e14] aspect-video overflow-hidden group"
                        >
                          {s?.filename ? (
                            <img
                              src={`${API}/data/${s.filename}`}
                              alt={ch}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#636e7b] text-[10px]">
                              {`${ch} not provided`}
                            </div>
                          )}
                          <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm border border-cyan-400/30 text-cyan-400 text-[9px] font-bold tracking-[1.5px] px-1.5 py-0.5 rounded-sm">
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
                    transformData={transformData} 
                    quality={quality}                  
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
            <span className="font-['Montserrat'] font-semibold text-[13px] text-white">
              Annotations
            </span>
            {annotations.length > 0 && (
              <span className="text-[10px] text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-1.5 py-0.5 rounded-full">
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
              No annotations provided for this frame
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
                  ${
                    isHighlighted
                      ? "bg-cyan-400/06 border-l-cyan-400"
                      : "border-l-transparent hover:bg-white/[0.02] hover:border-l-[#2d3f55]"
                  }
                `}
              >
                <div
                  className="w-2 h-2 rounded-full mt-1 shrink-0"
                  style={{
                    background: color,
                    boxShadow: isHighlighted ? `0 0 6px ${color}` : "none",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-[#cdd9e5] truncate">
                    {ann.category}
                  </div>
                  <div className="flex gap-2 mt-0.5 text-[9px] text-[#636e7b]">
                    <span>🔵 {ann.num_lidar_pts} lidar</span>
                    <span>📡 {ann.num_radar_pts} radar</span>
                  </div>
                </div>
                {isHighlighted && (
                  <span className="text-cyan-400 text-[9px] mt-1 shrink-0">
                    ●
                  </span>
                )}
              </button>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
