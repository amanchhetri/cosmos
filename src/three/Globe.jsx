import { useTexture } from "@react-three/drei";
import { EARTH_RADIUS } from "./orbital";

export function Globe() {
  const day = useTexture("/textures/earth-day.jpg");
  return (
    <group>
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        <meshStandardMaterial map={day} roughness={1} metalness={0} />
      </mesh>
      {/* atmosphere glow */}
      <mesh scale={1.03}>
        <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        <meshBasicMaterial
          color="#5b8bff"
          transparent
          opacity={0.12}
          side={2 /* BackSide */}
        />
      </mesh>
    </group>
  );
}
