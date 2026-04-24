import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { BufferAttribute } from "three";
import type { RegionScore } from "@/lib/api-types";
import { useWizardStore } from "@/stores/wizardStore";
import { computeColorBuffer } from "./colorBuffer";
import { useActivation } from "./useActivation";
import { useMeshGeometry } from "./useMeshGeometry";
import { useParcellation } from "./useParcellation";

type BrainCanvasProps = {
  jobId: string | null;
  regions: RegionScore[];
};

export function BrainCanvas({ jobId, regions }: BrainCanvasProps) {
  const activeCircuit = useWizardStore((state) => state.activeCircuit);
  const activeScreenIndex = useWizardStore((state) => state.activeScreenIndex);
  const meshQuery = useMeshGeometry();
  const parcellationQuery = useParcellation();
  const activationQuery = useActivation(jobId, activeScreenIndex);
  const colorAttributeRef = useRef<BufferAttribute | null>(null);
  const [srSummary, setSrSummary] = useState("Brain activation preview loading.");

  useEffect(() => {
    if (!activeCircuit || !activationQuery.data || !parcellationQuery.data) {
      return;
    }

    const nextBuffer = computeColorBuffer({
      activations: activationQuery.data,
      circuitOfLabelIndex: parcellationQuery.data.circuitOfLabelIndex,
      vertexToLabelIndex: parcellationQuery.data.vertexToLabelIndex,
      activeCircuit,
    });

    const attribute = colorAttributeRef.current;
    if (attribute && "array" in attribute && attribute.array instanceof Float32Array) {
      (attribute.array as Float32Array).set(nextBuffer);
      attribute.needsUpdate = true;
    }

    const topRegion = regions[0]?.atlas_label ?? "No ROI data";
    setSrSummary(`Active circuit: ${activeCircuit}. Top region: ${topRegion}.`);
  }, [activationQuery.data, activeCircuit, parcellationQuery.data, regions]);

  const positions = meshQuery.data?.positions ?? new Float32Array(20484 * 3);
  const indices = meshQuery.data?.indices ?? new Uint32Array();

  return (
    <div className="h-[60vh] overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
      <Canvas>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 7]} intensity={0.9} />
        <PerspectiveCamera makeDefault position={[0, 0, 180]} fov={45} />
        <mesh>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            <bufferAttribute attach="index" args={[indices, 1]} />
            <bufferAttribute
              ref={colorAttributeRef}
              attach="attributes-color"
              args={[new Float32Array(20484 * 3), 3]}
            />
          </bufferGeometry>
          <meshStandardMaterial vertexColors roughness={0.8} metalness={0} />
        </mesh>
        <OrbitControls enableDamping />
      </Canvas>
      <div className="sr-only" aria-live="polite">
        {activationQuery.isLoading || meshQuery.isLoading || parcellationQuery.isLoading
          ? "Brain activation preview loading."
          : srSummary}
      </div>
    </div>
  );
}
