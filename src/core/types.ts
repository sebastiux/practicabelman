/** Acciones del agente (distancia Manhattan: un paso en una de las 4 direcciones). */
export type Action = "N" | "S" | "E" | "W";

export const ACTIONS: readonly Action[] = ["N", "S", "E", "W"];

export const ACTION_NAME: Record<Action, string> = {
  N: "Norte",
  S: "Sur",
  E: "Este",
  W: "Oeste",
};

/** Inicial en español (Oeste = O). */
export const ACTION_LETTER: Record<Action, string> = {
  N: "N",
  S: "S",
  E: "E",
  W: "O",
};

export const ACTION_ARROW: Record<Action, string> = {
  N: "↑",
  S: "↓",
  E: "→",
  W: "←",
};

/** Desplazamiento (dx, dy) de cada acción. y crece hacia el Norte: S0,0 es la esquina inferior izquierda. */
export const DELTA: Record<Action, readonly [number, number]> = {
  N: [0, 1],
  S: [0, -1],
  E: [1, 0],
  W: [-1, 0],
};

export type Cell = "empty" | "pit" | "wumpus" | "gold";

export interface World {
  size: number;
  /** Contenido de cada estado, indexado como y * size + x. */
  cells: Cell[];
  start: number;
  gold: number;
  seed: number;
}

/** Parámetros del MDP. Los valores por defecto (PRACTICE) son los de la práctica. */
export interface MdpParams {
  /** Tasa de descuento γ. */
  gamma: number;
  /** Umbral de convergencia: se itera hasta que ΔV < ε. */
  epsilon: number;
  /** Recompensa por llegar al oro (estado meta S9,9). */
  goldReward: number;
  /** Recompensa por caer en un pozo o encontrarse con un Wumpus. */
  hazardReward: number;
  /** Costo de vida: recompensa por cada movimiento a una celda vacía. */
  stepReward: number;
  /** Recompensa por chocar con la frontera (el agente permanece en s). */
  wallReward: number;
  /** Probabilidad de resbalar a una dirección perpendicular (0 = MDP determinista, como en la práctica). */
  slip: number;
}

export const PRACTICE: MdpParams = Object.freeze({
  gamma: 0.9,
  epsilon: 1e-4,
  goldReward: 100,
  hazardReward: -100,
  stepReward: -1,
  wallReward: -2,
  slip: 0,
});
