import type { QualitySummary } from "@interfaces/types";
import { QUALITY_STYLE } from "@config/constants";
import type { FC } from "react";

export const QualityBanner: FC<{ quality: QualitySummary }> = ({ quality }) => {
  if (quality.overall_status === "PASS") return null; // silent on PASS

  const s = QUALITY_STYLE[quality.overall_status];
  // Show only the failing/warning checks, not the passing ones
  const flagged = quality.checks.filter(c => c.status !== "PASS");

  return (
    <div className={`flex flex-col gap-1 px-4 py-2.5 border-b font-mono ${s.bar}`}>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-sm border ${s.badge}`}>
          {quality.overall_status}
        </span>
        <span className="text-[10px] text-[#636e7b]">Data quality issues detected</span>
      </div>
      {flagged.map(c => (
        <div key={c.name} className="flex items-start gap-2 text-[9px] pl-1">
          <span className={QUALITY_STYLE[c.status].text}>▸ {c.name}</span>
          <span className="text-[#636e7b] truncate">{c.message}</span>
        </div>
      ))}
    </div>
  );
};