import type { Point3D } from "../interfaces/types";

export async function parsePCDBin(buffer: ArrayBuffer): Promise<Point3D[]> {
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
