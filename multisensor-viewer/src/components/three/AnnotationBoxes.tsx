import { type FC } from "react";
import { Html } from "@react-three/drei";
import { getCategoryColor } from "../config/constants";
import type { Annotation, TransformData } from "../interfaces/types";

interface AnnotationBoxesProps {
  annotations: Annotation[];
  highlightedToken: string | null;
  transform: TransformData ;
}

export const AnnotationBoxes: FC<AnnotationBoxesProps> = ({ annotations, highlightedToken, transform }) => {
  const { egoTranslation, sensorTranslation } = transform;

  return (
    <>
      {annotations.map((ann) => {
        const [gx, gy, gz] = ann.translation;
        const [ex, ey, ez] = egoTranslation;
        const [sx, sy, sz] = sensorTranslation;

        // Step 1: global → ego frame (simple translation, ignoring rotation for now)
        const ex2 = gx - ex;
        const ey2 = gy - ey;
        const ez2 = gz - ez;

        // Step 2: ego → sensor frame
        const lx = ex2 - sx;
        const ly = ey2 - sy;
        const lz = ez2 - sz;

        // Step 3: same axis swap as PointCloud
        const tx = lx;
        const ty = lz;
        const tz = -ly;

        const [w, l, h] = ann.size;
        const color = getCategoryColor(ann.category);
        const isHighlighted = ann.token === highlightedToken;

        return (
          <group key={ann.token} position={[tx, ty, tz]} onClick={()=> (console.log(`Clicked on ${ann.category}`))}>
            <mesh>
              <boxGeometry args={[w, h, l]} /> {/* swap h/l to match axis remap */}
              <meshBasicMaterial color={color} wireframe opacity={isHighlighted ? 1.0 : 0.5} />
            </mesh>
            {isHighlighted && (
              <Html center distanceFactor={25}>
                <div style={{ background:"rgba(0,0,0,.9)", border:`1px solid ${color}`, color, fontSize:9, fontFamily:"monospace", padding:"3px 8px", borderRadius:2, whiteSpace:"nowrap", pointerEvents:"none" }}>
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