import type { CSSProperties } from "react";
import { xy } from "../core/world";
import { spriteUri, type SpriteDef } from "../sprites/pixel";

/** Número con signo menos tipográfico. */
export function fmt(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "—";
  const s = Math.abs(v) < 0.5 * 10 ** -digits ? (0).toFixed(digits) : v.toFixed(digits);
  return s.replace("-", "−");
}

/** Número para fórmulas KaTeX. */
export function tex(v: number, digits = 2): string {
  return Math.abs(v) < 0.5 * 10 ** -digits ? (0).toFixed(digits) : v.toFixed(digits);
}

export const stateTex = (s: number, size = 10) => {
  const { x, y } = xy(s, size);
  return `S_{${x},${y}}`;
};

export function StateName({ s, size = 10 }: { s: number; size?: number }) {
  const { x, y } = xy(s, size);
  return (
    <span className="state-name">
      S<sub>{`${x},${y}`}</sub>
    </span>
  );
}

export function Sprite({
  def,
  className,
  style,
  alt = "",
}: {
  def: SpriteDef;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}) {
  return <img className={`sprite ${className ?? ""}`} src={spriteUri(def)} alt={alt} style={style} draggable={false} />;
}
