import { useRef, useEffect, type FC } from "react";
import type { SampleListItem } from "@interfaces/types";

interface TimelineProps {
  samples: SampleListItem[];
  selectedToken: string | null;
  onSelect: (s: SampleListItem) => void;
}

export const Timeline: FC<TimelineProps> = ({
  samples,
  selectedToken,
  onSelect,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedIdx = samples.findIndex((s) => s.token === selectedToken);

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current.querySelector(
      `[data-active="true"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [selectedToken]);

  if (samples.length === 0) return null;

  return (
    <div className="border-t border-[#1c2532] bg-[#0d1117] shrink-0">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1c2532]">
        <span className="text-[9px] font-bold tracking-[2px] text-[#636e7b] uppercase font-mono">
          Timeline
        </span>
        <div className="flex-1 h-px bg-[#1c2532]" />
        <span className="text-[9px] font-mono text-[#636e7b]">
          {selectedIdx + 1} / {samples.length}
        </span>
        {/* Prev / Next buttons */}
        <button
          onClick={() => selectedIdx > 0 && onSelect(samples[selectedIdx - 1])}
          disabled={selectedIdx <= 0}
          className="text-[10px] font-mono text-[#636e7b] hover:text-cyan-400 disabled:opacity-20 px-1 transition-colors"
        >
          ◀
        </button>
        <button
          onClick={() =>
            selectedIdx < samples.length - 1 &&
            onSelect(samples[selectedIdx + 1])
          }
          disabled={selectedIdx >= samples.length - 1}
          className="text-[10px] font-mono text-[#636e7b] hover:text-cyan-400 disabled:opacity-20 px-1 transition-colors"
        >
          ▶
        </button>
      </div>

      {/* Scrollable frame strip */}
      <div
        ref={scrollRef}
        className="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-thin"
      >
        {samples.map((s, i) => {
          const isActive = s.token === selectedToken;
          return (
            <button
              key={s.token}
              data-active={isActive}
              onClick={() => onSelect(s)}
              title={`Frame ${i + 1} · ${s.anns_count} ann`}
              className="relative flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full transition-all duration-150 group cursor-pointer"
            >
              <div
                className={`w-2.5 h-2.5 rounded-full border transition-all duration-150 ${
                  isActive
                    ? "bg-cyan-400 border-cyan-400 scale-125 shadow-[0_0_6px_#00e5ff]"
                    : "bg-[#1c2532] border-[#2d3f55] group-hover:bg-[#636e7b] group-hover:border-[#636e7b]"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
