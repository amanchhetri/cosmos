import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { issPosition } from "./orbital";

const MAX_TRAIL = 120;
// Squared threshold: only append a trail point once the ISS has moved enough.
const MOVE_THRESHOLD_SQ = 0.01 * 0.01;

export function ISSMarker({ latitude, longitude }) {
  const markerRef = useRef();
  const lineRef = useRef();

  // Number of valid points currently in the trail.
  const countRef = useRef(0);
  // Preallocated flat [x,y,z,...] buffer reused every frame (no per-frame alloc).
  const flat = useMemo(() => new Float32Array(MAX_TRAIL * 3), []);

  const target = useMemo(
    () => issPosition(latitude, longitude),
    [latitude, longitude]
  );

  useFrame(() => {
    const t = target;
    if (markerRef.current) markerRef.current.position.copy(t);

    const count = countRef.current;
    // Distance check against the last stored point (squared, alloc-free).
    let append = count === 0;
    if (!append) {
      const i = (count - 1) * 3;
      const dx = flat[i] - t.x;
      const dy = flat[i + 1] - t.y;
      const dz = flat[i + 2] - t.z;
      append = dx * dx + dy * dy + dz * dz > MOVE_THRESHOLD_SQ;
    }
    if (!append) return;

    let n = count;
    if (n >= MAX_TRAIL) {
      // Drop the oldest point: shift the buffer left by one vertex.
      flat.copyWithin(0, 3, MAX_TRAIL * 3);
      n = MAX_TRAIL - 1;
    }
    const o = n * 3;
    flat[o] = t.x;
    flat[o + 1] = t.y;
    flat[o + 2] = t.z;
    n += 1;
    countRef.current = n;

    // Need at least 2 points to draw a segment.
    if (lineRef.current && n > 1) {
      const geom = lineRef.current.geometry; // LineGeometry
      // setPositions wants a flat number array of exactly the active vertices.
      // setPositions allocates internally (three.js fat-line API); our own
      // per-frame code stays alloc-free.
      geom.setPositions(flat.subarray(0, n * 3));
    }
  });

  return (
    <group>
      <mesh ref={markerRef}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshStandardMaterial
          color="#5eead4"
          emissive="#5eead4"
          emissiveIntensity={2}
        />
      </mesh>
      {/* Seed with a degenerate 2-point line; trail is updated imperatively in
          useFrame via geometry.setPositions (LineGeometry API, not setFromPoints). */}
      <Line
        ref={lineRef}
        points={[target, target]}
        color="#5eead4"
        lineWidth={1}
        transparent
        opacity={0.5}
      />
    </group>
  );
}
