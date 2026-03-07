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
  TransformData,
} from "../../interfaces/types";
import {
  CAMERA_INITIAL_POSITION,
  LIGHT_INTENSITY,
  ZOOM_MAX,
  ZOOM_MIN,
} from "@config/three-scene";

interface LidarViewerProps {
  points: Point3D[] | null;
  annotations: Annotation[];
  highlightedToken: string | null;
  transformData: TransformData | null;
}

export const LidarViewer: FC<LidarViewerProps> = ({
  points,
  annotations,
  highlightedToken,
  transformData,
}) => {
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
