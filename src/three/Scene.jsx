import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Suspense, useRef } from "react";
import { Vector3 } from "three";
import { Globe } from "./Globe";
import { ISSMarker } from "./ISSMarker";
import { AuroraGlow } from "./AuroraGlow";
import { usePerfTier } from "./usePerfTier";

const CAMERA_RADIUS = 3;
const CAMERA_HEIGHT = 0.6;
const IDLE_SPIN_RATE = 0.05;
const FOLLOW_LERP_RATE = 0.5;
const RETURN_DAMP = 4; // how fast the camera glides back to the orbit on resume

function AutoFollow({ longitude, hasFix, active }) {
  // Drives the camera in auto mode: track the ISS longitude (or idle-spin with no
  // fix). Yields entirely to OrbitControls when `active` is false. The camera is
  // read from `state.camera` inside useFrame.
  const angle = useRef(0);
  const wasActive = useRef(true); // default mode is auto (active)
  const target = useRef();
  if (!target.current) target.current = new Vector3();

  useFrame((state, delta) => {
    if (!active) {
      wasActive.current = false;
      return; // manual mode: the user (via OrbitControls) owns the camera
    }
    // First active frame after a manual session: re-seed the orbit angle from the
    // camera's current azimuth so the glide-back is continuous (no azimuth snap).
    if (!wasActive.current) {
      angle.current = Math.atan2(state.camera.position.x, state.camera.position.z);
      wasActive.current = true;
    }

    if (!hasFix) {
      angle.current += delta * IDLE_SPIN_RATE; // idle spin
    } else {
      // Azimuth matches orbital.js's latLonToVector3 convention (atan2(p.x, p.z)
      // with the cos(lat) factor cancelling), computed directly from longitude to
      // avoid a per-frame Vector3 allocation.
      const lon = (longitude * Math.PI) / 180;
      const targetAngle = Math.atan2(Math.cos(lon), -Math.sin(lon));
      // Shortest signed arc so a fix arriving after idle spin doesn't over-rotate.
      let d = targetAngle - angle.current;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      angle.current += d * Math.min(1, delta * FOLLOW_LERP_RATE);
    }

    target.current.set(
      Math.sin(angle.current) * CAMERA_RADIUS,
      CAMERA_HEIGHT,
      Math.cos(angle.current) * CAMERA_RADIUS
    );
    // Lerp (frame-rate independent) toward the orbit target so resuming from a
    // zoomed/rotated manual view glides back to the default view instead of
    // snapping. At steady state the camera sits on the orbit and tracks the ISS.
    state.camera.position.lerp(target.current, 1 - Math.exp(-RETURN_DAMP * delta));
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export function Scene({ iss, mode, auroraIntensity, onBeginInteraction, onEndInteraction }) {
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
          HTML loading overlay is owned by App. */}
      <Suspense fallback={null}>
        <Globe />
        <AuroraGlow intensity={auroraIntensity} />
        {hasFix && (
          <ISSMarker latitude={iss.latitude} longitude={iss.longitude} />
        )}
      </Suspense>
      <AutoFollow
        longitude={hasFix ? iss.longitude : 0}
        hasFix={hasFix}
        active={mode === "auto"}
      />
      {/* OrbitControls stays enabled in BOTH modes so it can catch the user's grab
          (onStart) in auto mode. It does NOT fight AutoFollow: drei runs
          controls.update() at useFrame priority -1 (before AutoFollow), and three's
          update() re-derives its spherical state from the current camera.position,
          so AutoFollow's per-frame write becomes OrbitControls' synced state.
          onStart -> manual; onEnd -> start the idle-resume countdown. */}
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        enableDamping
        minDistance={2}
        maxDistance={6}
        onStart={onBeginInteraction}
        onEnd={onEndInteraction}
      />
    </Canvas>
  );
}
