import { useMemo, useState } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { Edges, Html, OrbitControls } from '@react-three/drei';
import { ExtrudeGeometry, Shape } from 'three';
import type { AlarmEvent, SystemName, SystemStatus } from '../../shared/types';

interface ShipModelProps {
  systems: SystemStatus[];
  alarms: AlarmEvent[];
  selected: SystemName | null;
  onSelect: (system: SystemName) => void;
}

type Box = { position: [number, number, number]; size: [number, number, number] };

/**
 * Where each system physically sits. Bow is +x, keel y = 0, beam along z.
 * Schematic proportions, not a general arrangement drawing.
 */
const COMPARTMENTS: Record<SystemName, Box[]> = {
  'Main Engine': [{ position: [-3.2, 0.75, 0], size: [1.6, 0.9, 0.8] }],
  Generators: [{ position: [-3.2, 0.45, 0.75], size: [1.3, 0.45, 0.4] }],
  'Fuel System': [{ position: [-1.85, 0.75, 0], size: [0.5, 1.2, 1.9] }],
  'Cooling Water': [{ position: [-4.5, 0.5, -0.55], size: [0.9, 0.5, 0.6] }],
  'Steering Gear': [{ position: [-5.6, 1.15, 0], size: [0.5, 0.45, 0.8] }],
  HVAC: [{ position: [-4.5, 3.05, 0], size: [1.3, 0.35, 1.3] }],
  'Ballast System': [
    { position: [1.3, 0.12, 0], size: [5.6, 0.18, 1.9] },
    { position: [5.05, 0.75, 0], size: [0.6, 0.9, 0.9] },
  ],
};

function colourOf(status: SystemStatus | undefined, alarms: AlarmEvent[]): string {
  if (!status) return '#475569';
  if (status.state === 'Fault') return '#ef4444';
  const active = alarms.filter((a) => a.source === status.name && a.active);
  if (active.some((a) => a.severity === 'Warning')) return '#fb923c';
  if (active.some((a) => a.severity === 'Caution')) return '#facc15';
  return status.state === 'Standby' ? '#38bdf8' : '#22c55e';
}

function Hull() {
  const geometry = useMemo(() => {
    const profile = new Shape();
    profile.moveTo(-5.6, 0);
    profile.lineTo(4.6, 0);
    profile.lineTo(6.0, 1.5); // raked stem
    profile.lineTo(-6.0, 1.5);
    profile.lineTo(-6.0, 0.7); // transom
    profile.closePath();
    const g = new ExtrudeGeometry(profile, { depth: 2.2, bevelEnabled: false });
    g.translate(0, 0, -1.1);
    return g;
  }, []);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#1e293b" transparent opacity={0.18} depthWrite={false} />
        <Edges color="#64748b" />
      </mesh>
      {/* accommodation, funnel and hatch covers */}
      <mesh position={[-4.5, 2.4, 0]}>
        <boxGeometry args={[1.6, 1.8, 1.8]} />
        <meshStandardMaterial color="#334155" transparent opacity={0.25} depthWrite={false} />
        <Edges color="#64748b" />
      </mesh>
      <mesh position={[-4.3, 3.65, 0]}>
        <boxGeometry args={[0.5, 0.7, 0.5]} />
        <meshStandardMaterial color="#475569" transparent opacity={0.5} />
        <Edges color="#94a3b8" />
      </mesh>
      {[-2.4, 0.1, 2.6].map((x) => (
        <mesh key={x} position={[x, 1.6, 0]}>
          <boxGeometry args={[2.1, 0.2, 1.6]} />
          <meshStandardMaterial color="#334155" transparent opacity={0.35} />
          <Edges color="#475569" />
        </mesh>
      ))}
      {/* sea surface at the loaded waterline */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.95, 0]}>
        <planeGeometry args={[24, 12]} />
        <meshBasicMaterial color="#0c4a6e" transparent opacity={0.25} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Compartment({ name, colour, highlighted, onSelect, onHover }: {
  name: SystemName;
  colour: string;
  highlighted: boolean;
  onSelect: (system: SystemName) => void;
  onHover: (system: SystemName | null) => void;
}) {
  const boxes = COMPARTMENTS[name];
  const top = boxes[0];
  return (
    <group
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(name);
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover(name);
      }}
      onPointerOut={() => onHover(null)}
    >
      {boxes.map((box) => (
        <mesh key={box.position.join()} position={box.position}>
          <boxGeometry args={box.size} />
          <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={highlighted ? 0.7 : 0.2} transparent opacity={highlighted ? 0.95 : 0.7} />
          <Edges color={highlighted ? '#f8fafc' : colour} />
        </mesh>
      ))}
      {highlighted && (
        <Html position={[top.position[0], top.position[1] + top.size[1] / 2 + 0.35, top.position[2]]} center>
          <div className="px-2 py-0.5 rounded bg-slate-950/90 border border-slate-600 text-[11px] text-slate-100 whitespace-nowrap pointer-events-none">
            {name}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Schematic section of the ship: each machinery space is coloured by its system state. Click to open it. */
export default function ShipModel({ systems, alarms, selected, onSelect }: ShipModelProps) {
  const [hovered, setHovered] = useState<SystemName | null>(null);

  return (
    <div className="w-full h-72 bg-slate-950 rounded-md overflow-hidden relative" style={{ cursor: hovered ? 'pointer' : 'grab' }}>
      <Canvas camera={{ position: [3.5, 5, 12], fov: 36 }} dpr={[1, 2]} frameloop="demand">
        <ambientLight intensity={0.6} />
        <directionalLight position={[6, 10, 6]} intensity={0.9} />
        <Hull />
        {(Object.keys(COMPARTMENTS) as SystemName[]).map((name) => (
          <Compartment
            key={name}
            name={name}
            colour={colourOf(systems.find((s) => s.name === name), alarms)}
            highlighted={hovered === name || selected === name}
            onSelect={onSelect}
            onHover={setHovered}
          />
        ))}
        <OrbitControls target={[-0.5, 1, 0]} enablePan={false} minDistance={7} maxDistance={20} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
      <div className="absolute bottom-2 left-3 text-[10px] text-slate-500">Drag to rotate · scroll to zoom · click a space to open its system</div>
    </div>
  );
}
