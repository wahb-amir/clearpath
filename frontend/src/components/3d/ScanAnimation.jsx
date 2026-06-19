"use client";
import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function ScanParticles({ scanning }) {
  const meshRef = useRef(null);
  const lineRef = useRef(null);

  const { positions } = useMemo(() => {
    const count = 200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (((Math.sin(i * 123.456) * 10000) % 1) - 0.5) * 4;
      positions[i * 3 + 1] = (((Math.cos(i * 234.567) * 10000) % 1) - 0.5) * 4;
      positions[i * 3 + 2] = (((Math.sin(i * 345.678) * 10000) % 1) - 0.5) * 2;
    }
    return { positions };
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.z = t * (scanning ? 0.8 : 0.2);
      meshRef.current.rotation.y = t * (scanning ? 0.5 : 0.1);
      const material = meshRef.current.material;
      material.opacity = scanning ? 0.8 + Math.sin(t * 4) * 0.2 : 0.3;
      material.color.set(scanning ? "#7fb08c" : "#2563eb");
    }
    if (lineRef.current && scanning) {
      lineRef.current.position.y = Math.sin(t * 2) * 1.8;
      const mat = lineRef.current.material;
      mat.opacity = 0.6 + Math.sin(t * 6) * 0.3;
    }
  });

  return (
    <>
      <points ref={meshRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.06}
          transparent
          opacity={0.3}
          sizeAttenuation
          color="#2563eb"
        />
      </points>

      {scanning && (
        <mesh ref={lineRef} position={[0, 0, 0]}>
          <boxGeometry args={[4, 0.04, 0.01]} />
          <meshBasicMaterial color="#7fb08c" transparent opacity={0.7} />
        </mesh>
      )}
    </>
  );
}

function DocGrid({ scanning }) {
  const groupRef = useRef(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    if (scanning) {
      groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.2;
    }
  });

  const rows = 8;
  const cols = 5;

  return (
    <group ref={groupRef}>
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: cols }).map((_, col) => (
          <mesh
            key={`${row}-${col}`}
            position={[
              (col - cols / 2 + 0.5) * 0.55,
              (row - rows / 2 + 0.5) * 0.35,
              0,
            ]}
          >
            <boxGeometry args={[0.45, 0.08, 0.02]} />
            <meshBasicMaterial
              color={scanning && row < 4 ? "#7fb08c" : "#2563eb"}
              transparent
              opacity={scanning && row < 4 ? 0.7 : 0.2}
            />
          </mesh>
        )),
      )}
    </group>
  );
}

export default function ScanAnimation({ scanning, className }) {
  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <pointLight
          position={[3, 3, 3]}
          intensity={scanning ? 1.2 : 0.5}
          color={scanning ? "#7fb08c" : "#2563eb"}
        />
        <ScanParticles scanning={scanning} />
        <DocGrid scanning={scanning} />
      </Canvas>
    </div>
  );
}
