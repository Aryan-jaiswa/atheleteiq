import { PropsWithChildren } from "react";

type GenericProps = PropsWithChildren<Record<string, any>>;

function Frame({ children }: PropsWithChildren) {
  return <div className="h-full w-full">{children}</div>;
}

export function ResponsiveContainer({ children }: GenericProps) {
  return <Frame>{children}</Frame>;
}

export function PieChart({ children }: GenericProps) {
  return <Frame>{children}</Frame>;
}

export function Pie({ data, dataKey }: GenericProps) {
  const total = (data ?? []).reduce((acc, item) => acc + Number(item[dataKey ?? "value"] ?? 0), 0);
  return <div className="text-center text-xs text-slate-500">Pie Chart · total {total.toFixed(1)}</div>;
}

export function Cell(_props: Record<string, any>) {
  return null;
}

export function Tooltip(_props: Record<string, any>) {
  return null;
}

export function BarChart({ children }: GenericProps) {
  return <Frame>{children}</Frame>;
}

export function Bar({ dataKey, data }: GenericProps) {
  const entries = (data ?? []).slice(0, 8);
  return (
    <div className="grid h-full grid-flow-col items-end gap-2 px-4 pb-4">
      {entries.map((item, idx) => (
        <div key={idx} className="rounded-t bg-cyan-500/70" style={{ height: `${Math.max(6, Number(item[dataKey ?? "value"] ?? 0))}%` }} />
      ))}
    </div>
  );
}

export function XAxis(_props: Record<string, any>) {
  return null;
}

export function YAxis(_props: Record<string, any>) {
  return null;
}

export function LineChart({ children }: GenericProps) {
  return <Frame>{children}</Frame>;
}

export function Line(_props: Record<string, any>) {
  return null;
}

export function RadarChart({ children }: GenericProps) {
  return <Frame>{children}</Frame>;
}

export function Radar(_props: Record<string, any>) {
  return null;
}

export function PolarGrid(_props: Record<string, any>) {
  return null;
}

export function PolarAngleAxis(_props: Record<string, any>) {
  return null;
}

export function PolarRadiusAxis(_props: Record<string, any>) {
  return null;
}
