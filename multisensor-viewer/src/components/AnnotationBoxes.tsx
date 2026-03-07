import { type FC } from "react";
import { Html } from "@react-three/drei";
import { getCategoryColor } from "../config/constants";
import type { Annotation } from "../interfaces/types";

interface AnnotationBoxesProps {
  annotations: Annotation[];
  highlightedToken: string | null;
  centroid: [number, number, number];
}

export const AnnotationBoxes: FC<AnnotationBoxesProps> = ({ 
  annotations, 
  highlightedToken, 
  centroid 
}) => (
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
