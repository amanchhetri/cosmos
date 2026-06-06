import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { Suspense, useRef } from "react";
import { Globe } from "./Globe";
import { ISSMarker } from "./ISSMarker";
import { issPosition } from "./orbital";
import { usePerfTier } from "./usePerfTier";

function AutoFollow({ latitude, longitude, enabled }) {
  // Slowly orient the camera toward the ISS longitude; idle-spin when no fix.
  // The active camera is read from `state.camera` inside useFrame.
  const angle = useRef(0);
  useFrame((state, delta) => {
    if (!enabled) {
      angle.current += delta * 0.05; // idle spin
    } else {
      const p = issPosition(latitude, longitude);
      const targetAngle = Math.atan2(p.x, p.z);
      angle.current += (targetAngle - angle.current) * Math.min(1, delta * 0.5);
    }
    const r = 3;
    state.camera.position.set(
      Math.sin(angle.current) * r,
      0.6,
      Math.cos(angle.current) * r
    );
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export function Scene({ iss }) {
  const perf = usePerfTier();
  const hasFix = iss != null;
  return (
    <Canvas
      dpr={perf.dpr}
      camera={{ position: [0, 0.6, 3], fov: 45 }}
      gl={{ antialias: perf.tier === "high" }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 5]} intensity={1.5} />
      <Stars
        radius={50}
        depth={20}
        count={perf.tier === "high" ? 3000 : 1200}
        factor={4}
        fade
      />
      {/* Globe suspends while its texture loads; null fallback is fine since the
          HTML loading overlay is owned by App (handled in a later task). */}
      <Suspense fallback={null}>
        <Globe />
        {hasFix && (
          <ISSMarker latitude={iss.latitude} longitude={iss.longitude} />
        )}
      </Suspense>
      {/* Camera is fully auto-driven: AutoFollow sets camera.position every frame.
          OrbitControls is intentionally omitted — any user rotate/zoom would set
          the camera position too and fight AutoFollow, producing a janky camera. */}
      <AutoFollow
        latitude={hasFix ? iss.latitude : 0}
        longitude={hasFix ? iss.longitude : 0}
        enabled={hasFix}
      />
    </Canvas>
  );
}
