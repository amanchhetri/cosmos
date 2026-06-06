import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { Suspense, useRef } from "react";
import { Globe } from "./Globe";
import { ISSMarker } from "./ISSMarker";
import { usePerfTier } from "./usePerfTier";

const CAMERA_RADIUS = 3;
const CAMERA_HEIGHT = 0.6;
const IDLE_SPIN_RATE = 0.05;
const FOLLOW_LERP_RATE = 0.5;

function AutoFollow({ latitude, longitude, enabled }) {
  // Slowly orient the camera toward the ISS longitude; idle-spin when no fix.
  // The active camera is read from `state.camera` inside useFrame.
  const angle = useRef(0);
  useFrame((state, delta) => {
    if (!enabled) {
      angle.current += delta * IDLE_SPIN_RATE; // idle spin
    } else {
      // Azimuth matches orbital.js's latLonToVector3 convention
      // (atan2(p.x, p.z) with the cos(lat) factor cancelling), computed
      // directly from longitude to avoid a per-frame Vector3 allocation.
      const lon = (longitude * Math.PI) / 180;
      const targetAngle = Math.atan2(Math.cos(lon), -Math.sin(lon));
      // Normalize the delta to the shortest signed arc so a fix arriving
      // after unbounded idle spin doesn't sweep through extra rotations.
      let d = targetAngle - angle.current;
      d = Math.atan2(Math.sin(d), Math.cos(d)); // shortest signed delta
      angle.current += d * Math.min(1, delta * FOLLOW_LERP_RATE);
    }
    state.camera.position.set(
      Math.sin(angle.current) * CAMERA_RADIUS,
      CAMERA_HEIGHT,
      Math.cos(angle.current) * CAMERA_RADIUS
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
      camera={{ position: [0, CAMERA_HEIGHT, CAMERA_RADIUS], fov: 45 }}
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
