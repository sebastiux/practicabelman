import { DELTA, type Action, type MdpParams, type World } from "./types";
import { idx, isHazard, xy } from "./world";

/** Un resultado posible (s', r) de tomar la acción a en s, con su probabilidad P(s', r | s, a). */
export interface Transition {
  /** Dirección en la que realmente se movió el agente (difiere de a si resbaló). */
  dir: Action;
  prob: number;
  next: number;
  reward: number;
  /** El movimiento lo sacaba de la red: permanece en s. */
  bump: boolean;
}

const PERPENDICULAR: Record<Action, readonly [Action, Action]> = {
  N: ["W", "E"],
  S: ["E", "W"],
  E: ["N", "S"],
  W: ["S", "N"],
};

export function move(world: World, s: number, a: Action): { next: number; bump: boolean } {
  const { x, y } = xy(s, world.size);
  const [dx, dy] = DELTA[a];
  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= world.size || ny >= world.size) return { next: s, bump: true };
  return { next: idx(nx, ny, world.size), bump: false };
}

/** r(s, a, s'): la recompensa depende del estado al que se llega. */
export function reward(world: World, params: MdpParams, next: number, bump: boolean): number {
  if (bump) return params.wallReward;
  const cell = world.cells[next];
  if (cell === "gold") return params.goldReward;
  if (isHazard(cell)) return params.hazardReward;
  return params.stepReward;
}

/**
 * Modelo P(s', r | s, a). En la práctica el MDP es determinista (slip = 0): un único s' con
 * probabilidad 1. Con slip > 0 el agente resbala a cada perpendicular con probabilidad slip/2.
 */
export function transitions(world: World, params: MdpParams, s: number, a: Action): Transition[] {
  const outcomes: [Action, number][] =
    params.slip > 0
      ? [
          [a, 1 - params.slip],
          [PERPENDICULAR[a][0], params.slip / 2],
          [PERPENDICULAR[a][1], params.slip / 2],
        ]
      : [[a, 1]];
  return outcomes.map(([dir, prob]) => {
    const { next, bump } = move(world, s, dir);
    return { dir, prob, next, bump, reward: reward(world, params, next, bump) };
  });
}

/** Muestrea una transición (para jugar o simular la política con slip > 0). */
export function sampleTransition(
  world: World,
  params: MdpParams,
  s: number,
  a: Action,
  rng: () => number,
): Transition {
  const options = transitions(world, params, s, a);
  let u = rng();
  for (const t of options) {
    if (u < t.prob) return t;
    u -= t.prob;
  }
  return options[options.length - 1];
}
