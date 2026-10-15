import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MEMBERS, type Album, type MemberId } from "../albums";
import { sfx } from "../audio/sfx";
import { sampleTransition } from "../core/mdp";
import { ACTION_ARROW, ACTION_NAME, type Action, type MdpParams, type World } from "../core/types";
import type { Solution, Step } from "../core/valueIteration";
import { distancesToGold, isHazard, percepts } from "../core/world";
import { BREEZE, GLITTER, MEMBER_SPRITES, STENCH } from "../sprites/library";
import { Board } from "./Board";
import { fmt, Sprite, StateName } from "./ui";

interface Game {
  pos: number;
  visited: boolean[];
  status: "playing" | "dead" | "won";
  steps: Step[];
  facing: "left" | "right";
}

const newGame = (world: World): Game => ({
  pos: world.start,
  visited: world.cells.map((_, i) => i === world.start),
  status: "playing",
  steps: [],
  facing: "right",
});

const KEYS: Record<string, Action> = {
  ArrowUp: "N",
  ArrowDown: "S",
  ArrowRight: "E",
  ArrowLeft: "W",
  w: "N",
  s: "S",
  d: "E",
  a: "W",
};

interface Props {
  world: World;
  album: Album;
  params: MdpParams;
  solution: Solution;
  member: MemberId;
  onMember: (m: MemberId) => void;
  onBellman: () => void;
}

export function PlayView({ world, album, params, solution, member, onMember, onBellman }: Props) {
  const [game, setGame] = useState(() => newGame(world));
  const [reveal, setReveal] = useState(false);
  const [hint, setHint] = useState(false);
  const gameRef = useRef(game);

  const restart = useCallback(() => {
    const g = newGame(world);
    gameRef.current = g;
    setGame(g);
  }, [world]);

  const move = useCallback(
    (action: Action) => {
      const g = gameRef.current;
      if (g.status !== "playing") return;
      const tr = sampleTransition(world, params, g.pos, action, Math.random);
      const t = g.steps.length;
      const discount = params.gamma ** t;
      const prev = g.steps.at(-1)?.cumulative ?? 0;
      const step: Step = {
        t,
        s: g.pos,
        action,
        next: tr.next,
        reward: tr.reward,
        bump: tr.bump,
        discount,
        discounted: discount * tr.reward,
        cumulative: prev + discount * tr.reward,
      };
      const cell = world.cells[tr.next];
      const status = cell === "gold" ? "won" : isHazard(cell) ? "dead" : "playing";
      const visited = g.visited.slice();
      visited[tr.next] = true;
      const facing = tr.dir === "W" ? "left" : tr.dir === "E" ? "right" : g.facing;
      if (status === "won") sfx.win();
      else if (status === "dead") sfx.death();
      else if (tr.bump) sfx.bump();
      else sfx.step();
      const next: Game = { pos: tr.next, visited, status, steps: [...g.steps, step], facing };
      gameRef.current = next;
      setGame(next);
    },
    [world, params],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey) return;
      const action = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
      if (action) {
        e.preventDefault();
        move(action);
      } else if (e.key.toLowerCase() === "r") {
        restart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, restart]);

  const dist = useMemo(() => distancesToGold(world), [world]);
  const here = percepts(world, game.pos);
  const total = game.steps.reduce((sum, s) => sum + s.reward, 0);
  const G = game.steps.at(-1)?.cumulative ?? 0;
  const vStart = solution.V[world.start];
  const last = game.steps.at(-1);
  const cause = game.status === "dead" ? world.cells[game.pos] : null;
  const optimalLength = dist[world.start];

  const hintArrows = useMemo(() => {
    if (!hint || game.status !== "playing") return null;
    return world.cells.map((_, i) => (i === game.pos ? solution.ties[i] : null));
  }, [hint, game.pos, game.status, solution, world]);

  return (
    <section className="stage">
      <div className="stage-board">
        <Board
          world={world}
          album={album}
          agent={{ pos: game.pos, member, facing: game.facing, status: game.status }}
          revealed={reveal || game.status !== "playing" ? null : game.visited}
          perceived={game.visited}
          arrows={hintArrows}
          highlight={new Set(game.steps.map((s) => s.next))}
        />
        <div className="dpad" aria-label="Controles">
          <button className="dpad-n" onClick={() => move("N")} aria-label="Norte">▲</button>
          <button className="dpad-w" onClick={() => move("W")} aria-label="Oeste">◀</button>
          <button className="dpad-r" onClick={restart} aria-label="Reiniciar">↺</button>
          <button className="dpad-e" onClick={() => move("E")} aria-label="Este">▶</button>
          <button className="dpad-s" onClick={() => move("S")} aria-label="Sur">▼</button>
        </div>
      </div>

      <aside className="stage-side">
        <div className="panel">
          <h3>Elige a tu integrante</h3>
          <div className="lineup">
            {album.lineup.map((id) => (
              <button
                key={id}
                className={`member ${id === member ? "active" : ""}`}
                onClick={() => onMember(id)}
                title={MEMBERS[id].role}
              >
                <Sprite def={MEMBER_SPRITES[id]} />
                <span>{MEMBERS[id].name}</span>
              </button>
            ))}
          </div>
          <p className="hint-text">
            Flechas o WASD para moverte, <kbd>R</kbd> para reiniciar. Sal del amplificador en <StateName s={world.start} /> y
            encuentra la púa de oro en <StateName s={world.gold} /> sin caer en {album.pit.plural} ni toparte con{" "}
            {album.wumpus.name}.
          </p>
        </div>

        {game.status === "playing" ? (
          <div className="panel">
            <h3>
              Percepciones en <StateName s={game.pos} />
            </h3>
            <ul className="percept-list">
              {here.stench && (
                <li>
                  <Sprite def={STENCH} className="percept" /> <b>Hedor</b>: {album.stench}.
                </li>
              )}
              {here.breeze && (
                <li>
                  <Sprite def={BREEZE} className="percept" /> <b>Viento</b>: {album.breeze}.
                </li>
              )}
              {here.glitter && (
                <li>
                  <Sprite def={GLITTER} className="percept" /> <b>Brillo</b>: ¡la púa de oro está a un paso!
                </li>
              )}
              {!here.stench && !here.breeze && !here.glitter && <li className="muted">Silencio. Las celdas vecinas parecen seguras.</li>}
            </ul>
            {last && (
              <p className="last-move">
                Último movimiento: {ACTION_NAME[last.action]} {ACTION_ARROW[last.action]}{" "}
                {last.bump ? "— chocaste con el borde del escenario" : ""} · r = {fmt(last.reward, 0)}
              </p>
            )}
          </div>
        ) : (
          <div className={`panel result result-${game.status}`}>
            <h3>{game.status === "won" ? "¡Encontraste la púa de oro!" : "Fin de la canción"}</h3>
            <p>
              {game.status === "won"
                ? `Llegaste en ${game.steps.length} pasos (la ruta óptima tiene ${optimalLength}).`
                : cause === "pit"
                  ? album.deathByPit
                  : album.deathByWumpus}
            </p>
            <p>
              Tu ganancia descontada fue <b>G = {fmt(G)}</b>. Siguiendo π* desde <StateName s={world.start} /> se obtiene{" "}
              <b>V* = {fmt(vStart)}</b>.
              {game.status === "won" && game.steps.length === optimalLength && params.slip === 0 && " ¡Igualaste a Bellman!"}
            </p>
            <div className="row">
              <button className="btn" onClick={restart}>
                Tocar otra vez
              </button>
              <button className="btn btn-ghost" onClick={onBellman}>
                Ver cómo lo resuelve Bellman →
              </button>
            </div>
          </div>
        )}

        <div className="panel">
          <h3>Marcador</h3>
          <dl className="hud">
            <div>
              <dt>Pasos (t)</dt>
              <dd>{game.steps.length}</dd>
            </div>
            <div>
              <dt>Σ r</dt>
              <dd>{fmt(total, 0)}</dd>
            </div>
            <div>
              <dt>G = Σ γᵗ r</dt>
              <dd>{fmt(G)}</dd>
            </div>
            <div>
              <dt>V*(aquí)</dt>
              <dd>{world.cells[game.pos] === "empty" ? fmt(solution.V[game.pos]) : "0 (terminal)"}</dd>
            </div>
          </dl>
          <label className="check">
            <input type="checkbox" checked={hint} onChange={(e) => setHint(e.target.checked)} /> Consejo de Bellman (flecha de
            π* en tu celda)
          </label>
          <label className="check">
            <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} /> Revelar el mapa
          </label>
        </div>

        {game.steps.length > 0 && (
          <div className="panel">
            <h3>Bitácora</h3>
            <ol className="log" reversed>
              {game.steps
                .slice(-8)
                .reverse()
                .map((s) => (
                  <li key={s.t}>
                    t={s.t}: <StateName s={s.s} /> {ACTION_ARROW[s.action]} <StateName s={s.next} /> · r = {fmt(s.reward, 0)} · γ
                    <sup>{s.t}</sup>r = {fmt(s.discounted)}
                  </li>
                ))}
            </ol>
          </div>
        )}
      </aside>
    </section>
  );
}
