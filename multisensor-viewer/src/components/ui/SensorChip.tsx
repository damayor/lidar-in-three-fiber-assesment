import { type FC } from "react";

interface SensorChipProps {
  channel: string;
}

export const SensorChip: FC<SensorChipProps> = ({ channel }) => {
  const isCam = channel.startsWith("CAM");
  const isLidar = channel.startsWith("LIDAR");
  const base =
    "text-[9px] font-bold tracking-widest px-2 py-1 rounded-sm border font-mono ";
  const variant = isCam
    ? "text- border-cyan-400/30 bg-cyan-400/07 "
    : isLidar
      ? "text-[#69f0ae] border-[#69f0ae]/30 bg-[#69f0ae]/07 "
      : "text-[#ffd740] border-[#ffd740]/30 bg-[#ffd740]/07 ";

  return (
    <span className={`${base} ${variant}`}>{channel.replace(/_/g, " ")}</span>
  );
};
