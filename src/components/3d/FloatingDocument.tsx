"use client";
import { useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sphere, Box, Torus } from "@react-three/drei";
import * as THREE from "three";

// Floating Document Mesh
function DocumentMesh({ hovered }: { hovered: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const linesRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.rotation.y = Math.sin(t * 0.4) * 0.15;
    meshRef.current.rotation.x = Math.cos(t * 0.3) * 0.08;
    if (hovered) {
      meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, 0.3, 0.05);
    } else {
      meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, 0, 0.05);
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.8}>
      <group ref={meshRef}>
        {/* Main document body */}
        <mesh castShadow>
          <boxGeometry args={[1.6, 2.1, 0.06]} />
          <meshStandardMaterial
            color={hovered ? "#06b6d4" : "#2563eb"}
            metalness={0.1}
            roughness={0.2}
            emissive={hovered ? "#0891b2" : "#1e3a8a"}
            emissiveIntensity={0.15}
          />
        </mesh>

        {/* Document lines */}
        {[-0.5, -0.2, 0.1, 0.4, 0.65].map((y, i) => (
          <mesh key={i} position={[0, y, 0.04]}>
            <boxGeometry args={[i === 0 ? 1.0 : 1.2, 0.06, 0.01]} />
            <meshStandardMaterial
              color="white"
              transparent
              opacity={i === 0 ? 0.9 : 0.35}
              emissive="white"
              emissiveIntensity={0.1}
            />
          </mesh>
        ))}

        {/* Highlight strip at top */}
        <mesh position={[0, 0.85, 0.035]}>
          <boxGeometry args={[1.6, 0.28, 0.01]} />
          <meshStandardMaterial
            color="#06b6d4"
            transparent
            opacity={0.85}
            emissive="#06b6d4"
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* Checkmark icon area */}
        <mesh position={[-0.5, -0.75, 0.04]}>
          <circleGeometry args={[0.12, 16]} />
          <meshStandardMaterial color="#7fb08c" emissive="#7fb08c" emissiveIntensity={0.4} />
        </mesh>

        {/* Orbit ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.5, 0.015, 16, 64]} />
          <meshStandardMaterial
            color="#06b6d4"
            transparent
            opacity={0.15}
            emissive="#06b6d4"
            emissiveIntensity={0.3}
          />
        </mesh>
      </group>
    </Float>
  );
}

// Particle field
function Particles({ count = 120 }: { count?: number }) {
  const mesh = useRef<THREE.Points>(null);

  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = ((Math.sin(i * 123.456) * 10000) % 1 - 0.5) * 12;
      positions[i * 3 + 1] = ((Math.cos(i * 234.567) * 10000) % 1 - 0.5) * 12;
      positions[i * 3 + 2] = ((Math.sin(i * 345.678) * 10000) % 1 - 0.5) * 8;
      speeds[i] = 0.2 + Math.abs((Math.cos(i * 456.789) * 10000) % 1) * 0.6;
    }
    return { positions, speeds };
  }, [count]);

  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.getElapsedTime();
    const pos = mesh.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += speeds[i] * 0.005;
      if (pos[i * 3 + 1] > 6) pos[i * 3 + 1] = -6;
    }
    mesh.current.geometry.attributes.position.needsUpdate = true;
    mesh.current.rotation.y = t * 0.02;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#06b6d4"
        transparent
        opacity={0.5}
        sizeAttenuation
      />
    </points>
  );
}

// Ambient glow spheres
function GlowOrbs() {
  const orbRef1 = useRef<THREE.Mesh>(null);
  const orbRef2 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (orbRef1.current) {
      orbRef1.current.position.x = Math.sin(t * 0.5) * 2.5;
      orbRef1.current.position.y = Math.cos(t * 0.4) * 1.5;
    }
    if (orbRef2.current) {
      orbRef2.current.position.x = Math.cos(t * 0.4) * -2;
      orbRef2.current.position.y = Math.sin(t * 0.6) * 2;
    }
  });

  return (
    <>
      <mesh ref={orbRef1} position={[2, 0, -2]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <MeshDistortMaterial
          color="#1e3a8a"
          transparent
          opacity={0.12}
          distort={0.4}
          speed={2}
        />
      </mesh>
      <mesh ref={orbRef2} position={[-2, 1, -3]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <MeshDistortMaterial
          color="#06b6d4"
          transparent
          opacity={0.1}
          distort={0.5}
          speed={1.5}
        />
      </mesh>
    </>
  );
}

interface FloatingDocumentProps {
  className?: string;
}

export default function FloatingDocument({ className }: FloatingDocumentProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ width: "100%", height: "100%", cursor: "grab" }}
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} color="#ffffff" />
        <pointLight position={[-3, 3, 3]} intensity={0.6} color="#06b6d4" />
        <pointLight position={[3, -3, 2]} intensity={0.4} color="#1e3a8a" />
        <DocumentMesh hovered={hovered} />
        <Particles count={100} />
        <GlowOrbs />
      </Canvas>
    </div>
  );
}
