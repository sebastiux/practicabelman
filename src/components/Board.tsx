import type { CSSProperties, ReactNode } from "react";
import type { Album, MemberId } from "../albums";
import type { Action, World } from "../core/types";
import { percepts, xy } from "../core/world";
import { AMP, BREEZE, GLITTER, GOLD_PICK, HAZARD_SPRITES, MEMBER_SPRITES, STENCH } from "../sprites/library";
import { fmt, Sprite } from "./ui";

export interface AgentView {
  pos: number;
  member: MemberId;
  facing: "left" | "right";
  status: "playing" | "dead" | "won";
}

interface BoardProps {
  world: World;
  album: Album;
  agent?: AgentView | null;
  /** Valores a mostrar (mapa de calor y/o números). */
  values?: ArrayLike<number> | null;
  /** Acciones a dibujar por celda: una flecha grande, o varias pequeñas si hay empate en el máximo. */
  arrows?: readonly (readonly Action[] | null | undefined)[] | null;
  showValues?: boolean;
  showHeat?: boolean;
  /** Niebla de guerra: sólo se ven las celdas en true. null = todo visible. */
  revealed?: boolean[] | null;
  /** Celdas donde se dibujan las percepciones (hedor/viento/brillo). */
  perceived?: boolean[] | null;
  highlight?: ReadonlySet<number>;
  selected?: number | null;
  onSelect?: (s: number) => void;
  variant?: "full" | "mini";
  caption?: ReactNode;
}

const ROTATION: Record<Action, number> = { N: 0, E: 90, S: 180, W: 270 };

/** Escala fija (oro = 100, vagar sin rumbo ≈ −10) para que los colores sean comparables entre iteraciones. */
function heat(v: number, maxPos: number, maxNeg: number): string | undefined {
  if (v > 0 && maxPos > 0) return `rgba(255, 196, 46, ${0.1 + 0.55 * Math.min(1, v / maxPos)})`;
  if (v < 0 && maxNeg > 0) return `rgba(230, 32, 48, ${0.1 + 0.5 * Math.min(1, -v / maxNeg)})`;
  return undefined;
}

export function Board({
  world,
  album,
  agent,
  values,
  arrows,
  showValues = false,
  showHeat = false,
  revealed = null,
  perceived = null,
  highlight,
  selected = null,
  onSelect,
  variant = "full",
  caption,
}: BoardProps) {
  const n = world.size;
  let maxPos = 100;
  let maxNeg = 20;
  if (values) {
    for (let i = 0; i < values.length; i++) {
      if (world.cells[i] !== "empty") continue;
      maxPos = Math.max(maxPos, values[i]);
      maxNeg = Math.max(maxNeg, -values[i]);
    }
  }

  const order: number[] = [];
  for (let y = n - 1; y >= 0; y--) for (let x = 0; x < n; x++) order.push(y * n + x);

  const agentXY = agent ? xy(agent.pos, n) : null;

  return (
    <figure className={`board-wrap board-${variant}`}>
      <div className="board-frame">
        {variant === "full" && (
          <div className="axis axis-y" aria-hidden>
            {Array.from({ length: n }, (_, i) => (
              <span key={i}>{n - 1 - i}</span>
            ))}
          </div>
        )}
        <div
          className="board"
          style={{ "--n": n } as CSSProperties}
          role={onSelect ? "grid" : undefined}
          aria-label={`Mundo del Wumpus ${n}×${n}`}
        >
          {order.map((s) => {
            const { x, y } = xy(s, n);
            const cell = world.cells[s];
            const visible = !revealed || revealed[s];
            const v = values ? values[s] : 0;
            const p = perceived?.[s] ? percepts(world, s) : null;
            const acts = arrows?.[s];
            const classes = [
              "cell",
              (x + y) % 2 ? "tile-a" : "tile-b",
              visible ? "" : "fog",
              highlight?.has(s) ? "on-path" : "",
              selected === s ? "selected" : "",
              onSelect ? "clickable" : "",
            ].join(" ");
            return (
              <div
                key={s}
                className={classes}
                onClick={onSelect ? () => onSelect(s) : undefined}
                title={`S${x},${y}`}
              >
                {showHeat && values && cell === "empty" && (
                  <span className="heat" style={{ background: heat(v, maxPos, maxNeg) }} />
                )}
                {visible && s === world.start && cell === "empty" && <Sprite def={AMP} className="cell-sprite start" />}
                {visible && cell === "gold" && <Sprite def={GOLD_PICK} className="cell-sprite gold" alt="Oro" />}
                {visible && cell === "pit" && (
                  <Sprite def={HAZARD_SPRITES[album.pit.sprite]} className="cell-sprite hazard" alt={album.pit.name} />
                )}
                {visible && cell === "wumpus" && (
                  <Sprite def={HAZARD_SPRITES[album.wumpus.sprite]} className="cell-sprite hazard wumpus" alt={album.wumpus.name} />
                )}
                {!visible && <span className="fog-mark">?</span>}
                {acts &&
                  acts.length > 0 &&
                  acts.map((a) => (
                    <svg
                      key={a}
                      className={`arrow ${acts.length > 1 ? `arrow-tie arrow-${a}` : ""}`}
                      viewBox="0 0 10 10"
                      style={{ "--rot": `${ROTATION[a]}deg` } as CSSProperties}
                      aria-hidden
                    >
                      <path d="M5 0.8 L9 5.2 H6.4 V9.2 H3.6 V5.2 H1 Z" />
                    </svg>
                  ))}
                {showValues && values && cell === "empty" && <span className="value">{fmt(v, Math.abs(v) >= 99.95 ? 0 : 1)}</span>}
                {p && (
                  <span className="percepts">
                    {p.stench && <Sprite def={STENCH} className="percept" alt="Hedor" />}
                    {p.breeze && <Sprite def={BREEZE} className="percept" alt="Viento" />}
                    {p.glitter && <Sprite def={GLITTER} className="percept" alt="Brillo" />}
                  </span>
                )}
              </div>
            );
          })}
          {agent && agentXY && (
            <div
              className={`agent agent-${agent.status} facing-${agent.facing}`}
              style={{ transform: `translate(${agentXY.x * 100}%, ${(n - 1 - agentXY.y) * 100}%)` }}
            >
              <Sprite def={MEMBER_SPRITES[agent.member]} alt="Agente" />
            </div>
          )}
        </div>
        {variant === "full" && (
          <div className="axis axis-x" aria-hidden>
            {Array.from({ length: n }, (_, i) => (
              <span key={i}>{i}</span>
            ))}
          </div>
        )}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
