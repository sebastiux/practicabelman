import { sampleTransition, transitions, type Transition } from "./mdp";
import { ACTIONS, type Action, type MdpParams, type World } from "./types";
import { isTerminal } from "./world";

/** Término P(s',r|s,a)·[r + γ·V(s')] de la suma de Bellman, con sus piezas para poder explicarlo. */
export interface BackupTerm extends Transition {
  vNext: number;
  /** r + γ·V(s') */
  target: number;
  /** P(s',r|s,a)·[r + γ·V(s')] */
  contribution: number;
}

export interface ActionBackup {
  action: Action;
  /** Q(s,a) = Σ_{s',r} P(s',r|s,a)·[r + γ·V(s')] */
  q: number;
  terms: BackupTerm[];
}

const TIE = 1e-9;

/** Lado derecho de la Ecuación de Optimalidad de Bellman para cada acción de s, evaluado con V. */
export function backup(world: World, params: MdpParams, V: ArrayLike<number>, s: number): ActionBackup[] {
  return ACTIONS.map((action) => {
    const terms = transitions(world, params, s, action).map((t) => {
      const vNext = V[t.next];
      const target = t.reward + params.gamma * vNext;
      return { ...t, vNext, target, contribution: t.prob * target };
    });
    return { action, q: terms.reduce((sum, t) => sum + t.contribution, 0), terms };
  });
}

/**
 * Un barrido síncrono de iteración de valores:
 *   V_{k+1}(s) = max_a Σ_{s',r} P(s',r|s,a)·[r + γ·V_k(s')]
 * Los estados terminales (oro, pozos, Wumpus) valen 0: ahí termina el episodio.
 */
export function bellmanSweep(world: World, params: MdpParams, V: Float64Array): Float64Array {
  const next = new Float64Array(V.length);
  for (let s = 0; s < V.length; s++) {
    if (isTerminal(world, s)) continue;
    let best = -Infinity;
    for (const b of backup(world, params, V, s)) if (b.q > best) best = b.q;
    next[s] = best;
  }
  return next;
}

export function maxAbsDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i]));
  return d;
}

export interface Greedy {
  /** π(s) = argmax_a Q(s,a); null en estados terminales. */
  policy: (Action | null)[];
  /** Todas las acciones empatadas en el máximo (π* puede no ser única). */
  ties: Action[][];
}

export function greedyPolicy(world: World, params: MdpParams, V: Float64Array): Greedy {
  const policy: (Action | null)[] = [];
  const ties: Action[][] = [];
  for (let s = 0; s < V.length; s++) {
    if (isTerminal(world, s)) {
      policy.push(null);
      ties.push([]);
      continue;
    }
    const backups = backup(world, params, V, s);
    const best = Math.max(...backups.map((b) => b.q));
    const argmax = backups.filter((b) => b.q >= best - TIE).map((b) => b.action);
    policy.push(argmax[0]);
    ties.push(argmax);
  }
  return { policy, ties };
}

export interface Solution {
  world: World;
  params: MdpParams;
  /** history[k] = V_k. history[0] es la inicialización V_0 = 0. */
  history: Float64Array[];
  /** deltas[k-1] = ΔV_k = max_s |V_k(s) − V_{k-1}(s)| */
  deltas: number[];
  /** Número de barridos realizados (K): el último cumplió ΔV < ε. */
  iterations: number;
  converged: boolean;
  /** V* ≈ V_K */
  V: Float64Array;
  policy: (Action | null)[];
  ties: Action[][];
}

/** Iteración de valores: aplica la Ecuación de Optimalidad de Bellman hasta que ΔV < ε. */
export function valueIteration(world: World, params: MdpParams, maxIterations = 5000): Solution {
  let V: Float64Array = new Float64Array(world.size * world.size);
  const history: Float64Array[] = [V];
  const deltas: number[] = [];
  let converged = false;
  while (history.length <= maxIterations) {
    const next = bellmanSweep(world, params, V);
    const delta = maxAbsDiff(next, V);
    history.push(next);
    deltas.push(delta);
    V = next;
    if (delta < params.epsilon) {
      converged = true;
      break;
    }
  }
  return { world, params, history, deltas, iterations: deltas.length, converged, V, ...greedyPolicy(world, params, V) };
}

export interface Step {
  t: number;
  s: number;
  action: Action;
  next: number;
  reward: number;
  bump: boolean;
  /** γ^t */
  discount: number;
  /** γ^t · r_{t+1} */
  discounted: number;
  /** G acumulada descontada hasta este paso. */
  cumulative: number;
}

/**
 * Sigue una política desde `start` hasta un estado terminal (o maxSteps).
 * Con slip = 0 la trayectoria es determinista; con slip > 0 se muestrea con `rng`.
 */
export function rollout(
  world: World,
  params: MdpParams,
  policy: (Action | null)[],
  start = world.start,
  rng: () => number = Math.random,
  maxSteps = 200,
): Step[] {
  const steps: Step[] = [];
  let s = start;
  let discount = 1;
  let cumulative = 0;
  for (let t = 0; t < maxSteps && !isTerminal(world, s); t++) {
    const action = policy[s];
    if (!action) break;
    const tr = sampleTransition(world, params, s, action, rng);
    const discounted = discount * tr.reward;
    cumulative += discounted;
    steps.push({ t, s, action, next: tr.next, reward: tr.reward, bump: tr.bump, discount, discounted, cumulative });
    s = tr.next;
    discount *= params.gamma;
  }
  return steps;
}
