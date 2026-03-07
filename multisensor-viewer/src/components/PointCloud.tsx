import { useRef, useMemo, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Point3D } from "../interfaces/types";

interface PointCloudProps {
  points: Point3D[];
}

export const PointCloud: FC<PointCloudProps> = ({ points }) => {
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

  useFrame((_, dt) => { if (ref.current) ref.current.rotation.z += dt * 0.025; });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial size={0.07} vertexColors sizeAttenuation transparent opacity={0.9} />
    </points>
  );
};
