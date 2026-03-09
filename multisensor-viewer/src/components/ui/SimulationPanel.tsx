import { useState, type FC } from "react";

// SimulationPanel.tsx
interface SimulationPanelProps {
  availableSensors: string[];
  onSimulate: (dropSensor: string | null, dropAnnotations: boolean) => void;
  mockState: { drop_sensor: string | null; drop_annotations: boolean } | null;
}

export const SimulationPanel: FC<SimulationPanelProps> = ({
  availableSensors, onSimulate, mockState
}) => {
  const [sensor, setSensor] = useState<string>("none");
  const [noAnns, setNoAnns] = useState(false);

  const isActive = mockState !== null;

  return (
    <div className={`border rounded p-3 text-xs font-mono ${
      isActive ? "border-[#ff6d00]/50 bg-[#ff6d00]/05" : "border-[#1c2532] bg-[#0d1117]"
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[9px] font-bold tracking-widest uppercase text-[#636e7b]">
          🧪 Simulate Degraded Data
        </span>
        {isActive && (
          <span className="text-[9px] text-[#ff6d00] border border-[#ff6d00]/40 bg-[#ff6d00]/10 px-1.5 py-0.5 rounded-full">
            MOCK ACTIVE
          </span>
        )}
      </div>

      {/* Drop sensor selector */}
      <div className="flex flex-col gap-1 mb-3">
        <label className="text-[9px] text-[#636e7b] uppercase tracking-wider">
          Drop sensor
        </label>
        <select
          value={sensor}
          onChange={e => setSensor(e.target.value)}
          className="bg-[#080c10] border border-[#1c2532] text-[#cdd9e5] text-[10px] px-2 py-1 rounded-sm"
        >
          <option value="none">— none —</option>
          {availableSensors.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Drop annotations toggle */}
      <label className="flex items-center gap-2 cursor-pointer mb-3">
        <input
          type="checkbox"
          checked={noAnns}
          onChange={e => setNoAnns(e.target.checked)}
          className="accent-[#ff6d00]"
        />
        <span className="text-[10px] text-[#cdd9e5]">Drop all annotations</span>
      </label>

      <div className="flex gap-2">
        <button
          onClick={() => onSimulate(sensor !== "none" ? sensor : null, noAnns)}
          className="flex-1 text-[10px] font-bold py-1.5 rounded-sm bg-[#ff6d00]/20 border border-[#ff6d00]/40 text-[#ff6d00] hover:bg-[#ff6d00]/30 transition-colors"
        >
          Run simulation
        </button>
        {isActive && (
          <button
            onClick={() => { setSensor("none"); setNoAnns(false); onSimulate(null, false); }}
            className="text-[10px] px-2 py-1.5 rounded-sm border border-[#1c2532] text-[#636e7b] hover:text-[#cdd9e5] transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
};