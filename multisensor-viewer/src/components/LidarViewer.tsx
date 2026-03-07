import { useMemo, type FC } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Stats } from "@react-three/drei";
import { PointCloud } from "./PointCloud";
import { AnnotationBoxes } from "./AnnotationBoxes";
import type { Annotation, Point3D } from "../interfaces/types";

interface LidarViewerProps {
  points: Point3D[] | null;
  annotations: Annotation[];
  highlightedToken: string | null;
}

export const LidarViewer: FC<LidarViewerProps> = ({ points, annotations, highlightedToken }) => {
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
