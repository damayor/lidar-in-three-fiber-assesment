import { type FC } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  Stats,
  GizmoHelper,
  GizmoViewport,
  Html,
} from "@react-three/drei";
import { PointCloud } from "./PointCloud";
import { AnnotationBoxes } from "./AnnotationBoxes";
import type {
  Annotation,
  Point3D,
  QualitySummary,
  TransformData,
} from "../../interfaces/types";
import {
  CAMERA_INITIAL_POSITION,
  LIGHT_INTENSITY,
  ZOOM_MAX,
  ZOOM_MIN,
} from "@config/three-scene";
import { QUALITY_STYLE } from "@config/constants";

interface LidarViewerProps {
  points: Point3D[] | null;
  annotations: Annotation[];
  highlightedToken: string | null;
  transformData: TransformData | null;
  quality: QualitySummary | null;
}

export const LidarViewer: FC<LidarViewerProps> = ({
  points,
  annotations,
  highlightedToken,
  transformData,
  quality
}) => {

  if (quality?.overall_status === "FAIL") {
    const failedCheck = quality.checks.find(c => c.status === "FAIL");
    return (
      <div className="flex flex-col items-center justify-center h-[480px] bg-[#050810] gap-4 border border-red-500/20">
        <div className="text-center px-8">
          <div className={`text-[11px] font-bold tracking-widest px-3 py-1 rounded-sm border inline-block mb-3 ${QUALITY_STYLE.FAIL.badge}`}>
            FAIL
          </div>
          <div className="text-red-400 font-bold font-mono text-sm">LiDAR VIEW UNAVAILABLE</div>
          <div className="text-[#636e7b] text-xs mt-2 max-w-xs leading-relaxed">
            {failedCheck?.message ?? "Frame has critical data quality issues"}
          </div>
          <div className="text-[#2d3f55] text-[9px] mt-3 font-mono">
            {failedCheck?.name} · HTTP 422
          </div>
        </div>
      </div>
    );
  }

  if (!points)
    return (
      <div className="flex items-center justify-center h-120 bg-[#050810] flex-col gap-3">
        <div className="w-6 h-6 border-2 border-[#1c2532] border-t-cyan-400 rounded-full animate-spin" />
        <span className="text-[#636e7b] text-xs font-mono">
          Loading LiDAR...
        </span>
      </div>
    );

  if (points.length === 0)
    return (
      <div className="flex items-center justify-center h-120 bg-[#050810]">
        <span className="text-[#636e7b] text-xs font-mono">
          No LiDAR data for this frame
        </span>
      </div>
    );

  return (
    <div className="relative h-120 bg-[#050810]">
      <Canvas
        camera={{
          position: CAMERA_INITIAL_POSITION,
          fov: 60,
          near: 0.1,
          far: 1000,
        }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "#050810" }}
      >
        <Stats />
        <ambientLight intensity={LIGHT_INTENSITY} />
        <PointCloud points={points} />
        {transformData ? (
          <AnnotationBoxes
            annotations={annotations}
            highlightedToken={highlightedToken}
            transform={transformData}
          />
        ) : (
          <Html center distanceFactor={25}>
            <div
              style={{
                background: "rgba(0,0,0,.9)",
                border: `1px solid red`,
                color: "#f00",
                fontSize: 9,
                fontFamily: "monospace",
                padding: "3px 8px",
                borderRadius: 2,
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              ANY PROVIDED ANNOTATION DATA
            </div>
          </Html>
        )}

        <GizmoHelper alignment={"top-left"}>
          <GizmoViewport />
        </GizmoHelper>
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
          minDistance={ZOOM_MIN}
          maxDistance={ZOOM_MAX}
        />
      </Canvas>

      {/* HUD overlays */}
      <div className="absolute top-3 left-3 text-[10px] font-mono text-[#636e7b] pointer-events-none leading-relaxed">
        <span className="text-[#69f0ae]">LIDAR_TOP</span> ·{" "}
        {points.length.toLocaleString()} pts
        <br />
        <span className="text-cyan-400">BOXES</span> · {annotations.length}{" "}
        objects
         {quality?.overall_status === "WARNING" && (
          <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded-sm border ${QUALITY_STYLE.WARNING.badge}`}>
            WARNING
          </span>
        )}
      </div>
      <div className="absolute bottom-3 right-3 text-[9px] font-mono text-[#636e7b] pointer-events-none text-right leading-loose">
        Left drag → rotate
        <br />
        Right drag → pan
        <br />
        Scroll → zoom
      </div>
    </div>
  );
};
