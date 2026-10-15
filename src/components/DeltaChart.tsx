import { fmt } from "./ui";

interface Props {
  deltas: number[];
  epsilon: number;
  /** Iteración resaltada (k ≥ 1). */
  current?: number;
  onPick?: (k: number) => void;
}

/** ΔV_k = max_s |V_k(s) − V_{k−1}(s)| en escala logarítmica, con la línea de ε. */
export function DeltaChart({ deltas, epsilon, current, onPick }: Props) {
  const W = 520;
  const H = 190;
  const pad = { l: 44, r: 12, t: 12, b: 30 };
  const floor = epsilon / 10;
  const logs = deltas.map((d) => Math.log10(Math.max(d, floor)));
  const top = Math.ceil(Math.max(...logs, Math.log10(epsilon)));
  const bottom = Math.floor(Math.log10(floor));
  const K = deltas.length;
  const x = (k: number) => pad.l + ((k - 1) / Math.max(1, K - 1)) * (W - pad.l - pad.r);
  const y = (l: number) => pad.t + ((top - l) / Math.max(1, top - bottom)) * (H - pad.t - pad.b);
  const points = logs.map((l, i) => `${x(i + 1)},${y(l)}`).join(" ");
  const ticks = [];
  for (let e = bottom; e <= top; e++) ticks.push(e);
  const xTicks = [...new Set([1, Math.round(K / 4), Math.round(K / 2), Math.round((3 * K) / 4), K])].filter((k) => k >= 1);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Convergencia de ΔV por iteración">
      {ticks.map((e) => (
        <g key={e}>
          <line x1={pad.l} x2={W - pad.r} y1={y(e)} y2={y(e)} className="grid-line" />
          <text x={pad.l - 6} y={y(e) + 4} className="tick" textAnchor="end">
            {e === 0 ? "1" : `1e${e}`}
          </text>
        </g>
      ))}
      {xTicks.map((k) => (
        <text key={k} x={x(k)} y={H - 10} className="tick" textAnchor="middle">
          {k}
        </text>
      ))}
      <line x1={pad.l} x2={W - pad.r} y1={y(Math.log10(epsilon))} y2={y(Math.log10(epsilon))} className="eps-line" />
      <text x={W - pad.r} y={y(Math.log10(epsilon)) - 5} className="tick eps-label" textAnchor="end">
        ε = {epsilon}
      </text>
      {current !== undefined && current >= 1 && current <= K && (
        <line x1={x(current)} x2={x(current)} y1={pad.t} y2={H - pad.b} className="cursor-line" />
      )}
      <polyline points={points} className="delta-line" />
      {logs.map((l, i) => (
        <circle
          key={i}
          cx={x(i + 1)}
          cy={y(l)}
          r={i + 1 === current ? 4.5 : 2.6}
          className={`delta-dot ${deltas[i] < epsilon ? "ok" : ""}`}
          onClick={onPick ? () => onPick(i + 1) : undefined}
        >
          <title>{`k = ${i + 1}: ΔV = ${fmt(deltas[i], 4)}`}</title>
        </circle>
      ))}
      <text x={12} y={pad.t + 4} className="tick axis-title" transform={`rotate(-90 12 ${H / 2})`} textAnchor="middle">
        ΔV (log)
      </text>
    </svg>
  );
}
