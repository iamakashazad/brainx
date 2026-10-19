import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import type { RegionScore } from "@/lib/api-types";
import { useWizardStore } from "@/stores/wizardStore";
import { computeColorBuffer } from "./colorBuffer";
import { NEUTRAL_BASE } from "./oklchToLinear";
import { useActivation } from "./useActivation";
import { useMeshGeometry } from "./useMeshGeometry";
import { useParcellation } from "./useParcellation";
import { ErrorBoundary } from "@/components/ErrorBoundary";

type BrainCanvasProps = {
  jobId: string | null;
  regions: RegionScore[];
  /** Screen to show. Callers pass the index they actually rendered (clamped to
   * this job's screens): the store's raw index can belong to a previous job and
   * fetch an activation that does not exist, leaving the brain grey. */
  screenIndex: number;
};

function makeNeutralBuffer() {
  const buf = new Float32Array(20484 * 3);
  for (let i = 0; i < 20484; i++) {
    buf[i * 3] = NEUTRAL_BASE[0];
    buf[i * 3 + 1] = NEUTRAL_BASE[1];
    buf[i * 3 + 2] = NEUTRAL_BASE[2];
  }
  return buf;
}

export function BrainCanvas({ jobId, regions, screenIndex }: BrainCanvasProps) {
  const activeCircuit = useWizardStore((state) => state.activeCircuit);
  const meshQuery = useMeshGeometry();
  const parcellationQuery = useParcellation();
  const activationQuery = useActivation(jobId, screenIndex);
  const [colorState, setColorState] = useState<{ buf: Float32Array; v: number }>(() => ({
    buf: makeNeutralBuffer(),
    v: 0,
  }));
  const [srSummary, setSrSummary] = useState("Brain activation preview loading.");

  useEffect(() => {
    if (!activeCircuit || !activationQuery.data || !parcellationQuery.data) {
      return;
    }

    const buf = computeColorBuffer({
      activations: activationQuery.data,
      circuitOfLabelIndex: parcellationQuery.data.circuitOfLabelIndex,
      vertexToLabelIndex: parcellationQuery.data.vertexToLabelIndex,
      activeCircuit,
    });
    setColorState((prev) => ({ buf, v: prev.v + 1 }));

    const topRegion = regions[0]?.atlas_label ?? "No ROI data";
    setSrSummary(`Active circuit: ${activeCircuit}. Top region: ${topRegion}.`);
  }, [activationQuery.data, activeCircuit, parcellationQuery.data, regions]);

  const positions = meshQuery.data?.positions ?? new Float32Array(20484 * 3);
  const indices = meshQuery.data?.indices ?? new Uint32Array();

  return (
    <div className="h-[60vh] overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
      <ErrorBoundary
        fallback={(error) => (
          <div role="alert" className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {`The 3D brain view could not start (${error.message}). Scores and recommendations below are unaffected.`}
          </div>
        )}
      >
      <Canvas>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 7]} intensity={0.9} />
        <PerspectiveCamera makeDefault position={[0, 0, 180]} fov={45} />
        <mesh>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            <bufferAttribute attach="index" args={[indices, 1]} />
            <bufferAttribute
              key={colorState.v}
              attach="attributes-color"
              args={[colorState.buf, 3]}
            />
          </bufferGeometry>
          <meshStandardMaterial vertexColors roughness={0.8} metalness={0} />
        </mesh>
        <OrbitControls enableDamping />
      </Canvas>
      </ErrorBoundary>
      {activationQuery.isError ? (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">
          {`Could not load activations for screen ${screenIndex + 1}: ${activationQuery.error.message}`}
        </p>
      ) : null}
      <div className="sr-only" aria-live="polite">
        {activationQuery.isLoading || meshQuery.isLoading || parcellationQuery.isLoading
          ? "Brain activation preview loading."
          : srSummary}
      </div>
    </div>
  );
}
