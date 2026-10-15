import { mulberry32 } from "./rng";
import type { Action, MdpParams, World } from "./types";
import { backup, rollout, valueIteration, type ActionBackup, type Solution, type Step } from "./valueIteration";
import { distancesToGold, isHazard, isTerminal, neighbors, xy } from "./world";

/** Cálculo de V_k(s) a partir de V_{k-1}, desglosado acción por acción. */
export interface WorkedExample {
  s: number;
  k: number;
  backups: ActionBackup[];
  value: number;
  best: Action[];
}

export interface Walkthrough {
  sol: Solution;
  deterministic: boolean;
  dist: Int32Array;
  pits: number;
  wumpus: number;
  nonTerminal: number;
  /** Estados vacíos sin camino seguro al oro. */
  pockets: number[];
  /** Distancia más larga (en pasos) de un estado al oro. */
  maxDist: number;
  /** Ejemplos de la iteración 1: vecino del oro, vecino de un peligro, la entrada (esquina). */
  iteration1: WorkedExample[];
  /** Ejemplos de la iteración 2: celda a 2 pasos del oro y la entrada. */
  iteration2: WorkedExample[];
  /** Iteración en la que la entrada "se entera" del oro (k = d(S0,0)), si es determinista. */
  startLearns: WorkedExample | null;
  /** k que vale la pena mostrar como instantánea de V_k. */
  snapshots: number[];
  /** informed[k] = estados que ya recibieron la recompensa del oro en V_k (d(s) ≤ k). */
  informed: number[];
  /** Trayectoria siguiendo π* desde la entrada. */
  path: Step[];
  /** Comprobación de V*(S0,0) = max_a Q*(S0,0,a) con los valores convergidos. */
  startCheck: ActionBackup[];
  /** V*(s) = r_vida·(1−γ^(d−1))/(1−γ) + r_oro·γ^(d−1) (sólo MDP determinista). */
  closedForm: { maxError: number; rows: { d: number; value: number; count: number }[] } | null;
  /** Mayor |V*(s) − max_a Q*(s,a)|: debe ser ~0 en el punto fijo. */
  bellmanResidual: number;
}

export function closedFormValue(params: MdpParams, d: number): number {
  const g = params.gamma;
  const living = g === 1 ? params.stepReward * (d - 1) : (params.stepReward * (1 - g ** (d - 1))) / (1 - g);
  return living + params.goldReward * g ** (d - 1);
}

function example(world: World, sol: Solution, s: number, k: number): WorkedExample {
  const backups = backup(world, sol.params, sol.history[k - 1], s);
  const best = Math.max(...backups.map((b) => b.q));
  return {
    s,
    k,
    backups,
    value: sol.history[k][s],
    best: backups.filter((b) => b.q >= best - 1e-9).map((b) => b.action),
  };
}

export function buildWalkthrough(world: World, params: MdpParams): Walkthrough {
  const sol = valueIteration(world, params);
  const deterministic = params.slip === 0;
  const dist = distancesToGold(world);
  const n = world.size * world.size;
  const all = [...Array(n).keys()];
  const free = all.filter((s) => !isTerminal(world, s));
  const pockets = free.filter((s) => dist[s] < 0);
  const maxDist = Math.max(...dist);
  const K = sol.iterations;
  const at = (k: number, s: number) => (k <= K ? [example(world, sol, s, k)] : []);

  const goldNeighbor = neighbors(world.gold, world.size).find((s) => !isTerminal(world, s));
  const origin = xy(world.start, world.size);
  const manhattanFromStart = (s: number) => {
    const { x, y } = xy(s, world.size);
    return Math.abs(x - origin.x) + Math.abs(y - origin.y);
  };
  const nearHazard = free
    .filter(
      (s) =>
        s !== world.start &&
        !neighbors(s, world.size).includes(world.gold) &&
        neighbors(s, world.size).some((nb) => isHazard(world.cells[nb])),
    )
    .sort((a, b) => manhattanFromStart(a) - manhattanFromStart(b))[0];
  const twoAway = free.find((s) => dist[s] === 2);

  const iteration1 = [goldNeighbor, nearHazard, world.start]
    .filter((s): s is number => s !== undefined)
    .flatMap((s) => at(1, s));
  const iteration2 = [twoAway, world.start].filter((s): s is number => s !== undefined).flatMap((s) => at(2, s));
  const dStart = dist[world.start];
  const startLearns = deterministic && dStart > 2 && dStart <= K ? example(world, sol, world.start, dStart) : null;

  const snapshots = [...new Set([0, 1, 2, 5, 10, dStart, K].filter((k) => k >= 0 && k <= K))].sort((a, b) => a - b);
  const informed = sol.history.map((_, k) => free.filter((s) => dist[s] > 0 && dist[s] <= k).length);

  const path = rollout(world, params, sol.policy, world.start, mulberry32(world.seed));
  const startCheck = backup(world, params, sol.V, world.start);

  let bellmanResidual = 0;
  for (const s of free) {
    const best = Math.max(...backup(world, params, sol.V, s).map((b) => b.q));
    bellmanResidual = Math.max(bellmanResidual, Math.abs(best - sol.V[s]));
  }

  let closedForm: Walkthrough["closedForm"] = null;
  if (deterministic) {
    const rows: { d: number; value: number; count: number }[] = [];
    let maxError = 0;
    for (let d = 1; d <= maxDist; d++) {
      const cells = free.filter((s) => dist[s] === d);
      const value = closedFormValue(params, d);
      for (const s of cells) maxError = Math.max(maxError, Math.abs(sol.V[s] - value));
      rows.push({ d, value, count: cells.length });
    }
    closedForm = { maxError, rows };
  }

  return {
    sol,
    deterministic,
    dist,
    pits: world.cells.filter((c) => c === "pit").length,
    wumpus: world.cells.filter((c) => c === "wumpus").length,
    nonTerminal: free.length,
    pockets,
    maxDist,
    iteration1,
    iteration2,
    startLearns,
    snapshots,
    informed,
    path,
    startCheck,
    closedForm,
    bellmanResidual,
  };
}
