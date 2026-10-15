import { useEffect, useMemo, useState } from "react";
import type { Album, MemberId } from "../albums";
import { sfx } from "../audio/sfx";
import { ACTION_ARROW, ACTION_NAME, PRACTICE, type MdpParams, type World } from "../core/types";
import { backup, greedyPolicy, rollout, type Solution, type Step } from "../core/valueIteration";
import { isHazard, isTerminal } from "../core/world";
import { BackupTable } from "./BackupTable";
import { Board, type AgentView } from "./Board";
import { DeltaChart } from "./DeltaChart";
import { Tex } from "./Tex";
import { fmt, StateName } from "./ui";

interface Props {
  world: World;
  album: Album;
  params: MdpParams;
  onParams: (p: MdpParams) => void;
  solution: Solution;
  member: MemberId;
}

const SPEEDS = { lento: 700, normal: 320, rápido: 110 } as const;
const EPSILONS = [1e-1, 1e-2, 1e-3, 1e-4, 1e-6];

export function BellmanView({ world, album, params, onParams, solution, member }: Props) {
  const K = solution.iterations;
  const [k, setK] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<keyof typeof SPEEDS>("normal");
  const [selected, setSelected] = useState(world.start);
  const [show, setShow] = useState({ values: true, arrows: true, heat: true });
  const [run, setRun] = useState<{ steps: Step[]; i: number } | null>(null);

  useEffect(() => {
    if (!playing) return;
    if (k >= K) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => {
      setK(k + 1);
      sfx.tick();
    }, SPEEDS[speed]);
    return () => clearTimeout(id);
  }, [playing, k, K, speed]);

  useEffect(() => {
    if (!run || run.i >= run.steps.length) return;
    const id = setTimeout(() => {
      const step = run.steps[run.i];
      const cell = world.cells[step.next];
      if (cell === "gold") sfx.win();
      else if (isHazard(cell)) sfx.death();
      else if (step.bump) sfx.bump();
      else sfx.step();
      setRun({ ...run, i: run.i + 1 });
    }, 240);
    return () => clearTimeout(id);
  }, [run, world]);

  const V = solution.history[k];
  const greedy = useMemo(() => greedyPolicy(world, params, V), [world, params, V]);
  const backups = useMemo(() => {
    if (isTerminal(world, selected)) return null;
    return k === 0
      ? { from: 0, list: backup(world, params, solution.history[0], selected) }
      : { from: k - 1, list: backup(world, params, solution.history[k - 1], selected) };
  }, [world, params, solution, selected, k]);

  const delta = k >= 1 ? solution.deltas[k - 1] : null;
  const done = k === K;
  const modified = (Object.keys(PRACTICE) as (keyof MdpParams)[]).some((key) => PRACTICE[key] !== params[key]);

  const runFinished = run !== null && run.i >= run.steps.length;
  const agent = useMemo((): AgentView | null => {
    if (!run) return null;
    const last = run.i > 0 ? run.steps[run.i - 1] : null;
    const pos = last ? last.next : world.start;
    const cell = world.cells[pos];
    const facing = run.steps.slice(0, run.i).findLast((s) => s.action === "E" || s.action === "W")?.action === "W" ? "left" : "right";
    return { pos, member, facing, status: cell === "gold" ? "won" : isHazard(cell) ? "dead" : "playing" };
  }, [run, world, member]);
  const path = useMemo(() => new Set(run ? run.steps.slice(0, run.i).map((s) => s.next) : []), [run]);

  const startRun = () => {
    setK(K);
    setPlaying(false);
    setRun({ steps: rollout(world, params, solution.policy, world.start), i: 0 });
  };

  return (
    <section className="stage">
      <div className="stage-board">
        <div className="pun">
          <span>{album.pun}</span>
        </div>
        <Board
          world={world}
          album={album}
          values={V}
          arrows={show.arrows && k > 0 ? greedy.ties : null}
          showValues={show.values}
          showHeat={show.heat}
          selected={selected}
          onSelect={setSelected}
          highlight={path}
          agent={agent}
        />
        <div className="toolbar">
          <button className="btn btn-icon" onClick={() => { setPlaying(false); setK(0); setRun(null); }} title="Reiniciar (V₀ = 0)">⏮</button>
          <button className="btn btn-icon" onClick={() => { setPlaying(false); setK(Math.max(0, k - 1)); }} disabled={k === 0} title="Iteración anterior">◀</button>
          <button className="btn btn-play" onClick={() => { if (k >= K) setK(0); setRun(null); setPlaying(!playing); }}>
            {playing ? "❚❚ Pausa" : k === 0 ? "▶ Iterar Bellman" : "▶ Continuar"}
          </button>
          <button className="btn btn-icon" onClick={() => { setPlaying(false); setK(Math.min(K, k + 1)); sfx.tick(); }} disabled={k >= K} title="Siguiente iteración">▶</button>
          <button className="btn btn-icon" onClick={() => { setPlaying(false); setK(K); }} disabled={k >= K} title="Ir a la convergencia">⏭</button>
          <select value={speed} onChange={(e) => setSpeed(e.target.value as keyof typeof SPEEDS)} aria-label="Velocidad">
            {Object.keys(SPEEDS).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <input
          className="slider"
          type="range"
          min={0}
          max={K}
          value={k}
          onChange={(e) => { setPlaying(false); setK(+e.target.value); }}
          aria-label="Iteración"
        />
        <div className="toggles">
          <label className="check">
            <input type="checkbox" checked={show.values} onChange={(e) => setShow({ ...show, values: e.target.checked })} /> Valores
          </label>
          <label className="check">
            <input type="checkbox" checked={show.arrows} onChange={(e) => setShow({ ...show, arrows: e.target.checked })} /> Política
            greedy
          </label>
          <label className="check">
            <input type="checkbox" checked={show.heat} onChange={(e) => setShow({ ...show, heat: e.target.checked })} /> Mapa de calor
          </label>
        </div>
      </div>

      <aside className="stage-side">
        <div className="panel status-panel">
          <div className="big-k">
            <span className="label">Iteración</span>
            <span className="num">
              k = {k}
              <small> / {K}</small>
            </span>
          </div>
          <div className="big-k">
            <span className="label">ΔV<sub>k</sub></span>
            <span className="num">{delta === null ? "—" : fmt(delta, delta < 0.01 ? 6 : 3)}</span>
          </div>
          <div className={`badge ${done ? (solution.converged ? "ok" : "warn") : ""}`}>
            {done ? (solution.converged ? `Convergió: ΔV < ε = ${params.epsilon}` : "Tope de iteraciones") : "Iterando…"}
          </div>
          <Tex block math={"V_{k+1}(s) = \\max_a \\sum_{s',r} P(s',r\\mid s,a)\\,\\big[r + \\gamma V_k(s')\\big]"} />
          <p className="muted small">
            Haz clic en cualquier celda para ver cómo se calculó su valor. Flechas = acción greedy respecto a V<sub>k</sub>; varias
            flechas pequeñas = empate.
          </p>
        </div>

        <div className="panel">
          <h3>
            Inspector de Bellman · <StateName s={selected} />
          </h3>
          {backups ? (
            <>
              <p className="muted small">
                {k === 0 ? (
                  <>
                    Con V<sub>0</sub> = 0 en todas partes, la siguiente iteración calculará V<sub>1</sub> así:
                  </>
                ) : (
                  <>
                    Así se obtuvo V<sub>{k}</sub>(<StateName s={selected} />) usando los valores de la iteración anterior V
                    <sub>{k - 1}</sub>:
                  </>
                )}
              </p>
              <BackupTable
                s={selected}
                params={params}
                backups={backups.list}
                vRight={`V_{${backups.from}}`}
                vLeft={`V_{${backups.from + 1}}`}
              />
              <p className="small">
                Valor final <b>V*(<StateName s={selected} />) = {fmt(solution.V[selected])}</b> · π* ={" "}
                {solution.ties[selected].map((a) => `${ACTION_ARROW[a]} ${ACTION_NAME[a]}`).join(" o ")}
              </p>
            </>
          ) : (
            <p className="muted">
              Estado terminal ({world.cells[selected] === "gold" ? "oro" : world.cells[selected] === "pit" ? album.pit.name : album.wumpus.name}
              ): el episodio termina al entrar, así que V(s) = 0. La recompensa ({fmt(world.cells[selected] === "gold" ? params.goldReward : params.hazardReward, 0)}) se
              cobra en la transición que llega aquí.
            </p>
          )}
        </div>

        <div className="panel">
          <h3>Convergencia</h3>
          <DeltaChart deltas={solution.deltas} epsilon={params.epsilon} current={k} onPick={(i) => { setPlaying(false); setK(i); }} />
        </div>

        <div className="panel">
          <h3>Ejecutar la política óptima π*</h3>
          <p className="muted small">
            El agente sale de <StateName s={world.start} /> y en cada estado toma π*(s) = argmax<sub>a</sub> Q*(s,a).
          </p>
          <button className="btn" onClick={startRun}>
            ▶ Tocar π* desde <StateName s={world.start} />
          </button>
          {run && runFinished && (
            <p className="small">
              {run.steps.length} pasos · G = Σ γ<sup>t</sup> r<sub>t+1</sub> = <b>{fmt(run.steps.at(-1)?.cumulative ?? 0)}</b> ·
              V*(<StateName s={world.start} />) = <b>{fmt(solution.V[world.start])}</b>
              {params.slip > 0 && " (con resbalón, G varía en cada ejecución; V* es su valor esperado)"}
            </p>
          )}
        </div>

        <div className="panel">
          <h3>Parámetros del MDP {modified && <span className="tag">modificado</span>}</h3>
          <div className="params">
            <label>
              γ = {params.gamma.toFixed(2)}
              <input type="range" min={0.5} max={0.99} step={0.01} value={params.gamma} onChange={(e) => onParams({ ...params, gamma: +e.target.value })} />
            </label>
            <label>
              ε
              <select value={params.epsilon} onChange={(e) => onParams({ ...params, epsilon: +e.target.value })}>
                {EPSILONS.map((eps) => (
                  <option key={eps} value={eps}>
                    {eps}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Resbalón = {params.slip.toFixed(2)}
              <input type="range" min={0} max={0.4} step={0.05} value={params.slip} onChange={(e) => onParams({ ...params, slip: +e.target.value })} />
            </label>
          </div>
          <p className="muted small">
            Recompensas de la práctica: oro +{params.goldReward}, pozo/Wumpus {fmt(params.hazardReward, 0)}, costo de vida {fmt(params.stepReward, 0)},
            frontera {fmt(params.wallReward, 0)} (sin moverse). Resbalón = probabilidad de moverse a una dirección perpendicular (0 en la
            práctica: MDP determinista).
          </p>
          {modified && (
            <button className="btn btn-ghost" onClick={() => onParams(PRACTICE)}>
              Restablecer valores de la práctica
            </button>
          )}
        </div>
      </aside>
    </section>
  );
}
