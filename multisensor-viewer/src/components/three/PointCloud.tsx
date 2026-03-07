import { useRef, useMemo, type FC } from "react";
import * as THREE from "three";
import type { Point3D } from "../../interfaces/types";
import { POINTS_SIZE } from "@config/three-scene";

interface PointCloudProps {
  points: Point3D[];
}

export const PointCloud: FC<PointCloudProps> = ({ points }) => {
  const ref = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(points.length * 3);
    const col = new Float32Array(points.length * 3);
    const c = new THREE.Color();
    //Wooow! Seems like C++
    points.forEach((p, i) => {
      // console.log(`point pos ${i} [ ${p.x} ,${p.y} , ${p.z} ] ` )
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.z; // nuScenes Z (up) → Three.js Y (up) ✅
      pos[i * 3 + 2] = -p.y; // nuScenes Y (left) → Three.js -Z ✅

      const t = Math.min(Math.max((p.z + 2) / 5, 0), 1);
      c.setHSL(0.55 - t * 0.55, 1, 0.55);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    });
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return geo;
  }, [points]);

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={POINTS_SIZE}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.9}
      />
    </points>
  );
};
