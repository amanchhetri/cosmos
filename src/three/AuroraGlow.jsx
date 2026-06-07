import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, AdditiveBlending } from "three";
import { EARTH_RADIUS } from "./orbital";

export function AuroraGlow({ intensity = 0.15 }) {
  const matRef = useRef();
  const target = 0.06 + intensity * 0.5; // map 0..1 → ~0.06..0.56 opacity
  useFrame((_, delta) => {
    const m = matRef.current;
    if (!m) return;
    m.opacity += (target - m.opacity) * Math.min(1, delta * 3);
  });
  return (
    <mesh scale={1.08}>
      <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
      <meshBasicMaterial
        ref={matRef}
        color="#3bf0a0"
        transparent
        opacity={0.06}
        side={BackSide}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
