import { mulberry32 } from "./rng";
import { ACTIONS, DELTA, type Cell, type World } from "./types";

export const SIZE = 10;
export const PITS = 20;
export const WUMPUS = 5;

export const idx = (x: number, y: number, size = SIZE) => y * size + x;

export const xy = (i: number, size = SIZE) => ({ x: i % size, y: Math.floor(i / size) });

/** Nombre del estado como en la práctica: S{x,y}. */
export function stateName(i: number, size = SIZE): string {
  const { x, y } = xy(i, size);
  return `S${x},${y}`;
}

export const isHazard = (c: Cell) => c === "pit" || c === "wumpus";

/** Oro, pozos y Wumpus terminan el episodio: su valor es 0 por definición. */
export const isTerminal = (world: World, i: number) => world.cells[i] !== "empty";

export function neighbors(i: number, size = SIZE): number[] {
  const { x, y } = xy(i, size);
  const out: number[] = [];
  for (const a of ACTIONS) {
    const [dx, dy] = DELTA[a];
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < size && ny < size) out.push(idx(nx, ny, size));
  }
  return out;
}

export interface WorldOptions {
  size?: number;
  pits?: number;
  wumpus?: number;
}

/**
 * Distribuye aleatoriamente (con semilla) los pozos y los Wumpus, dejando libres la entrada S0,0
 * y el oro S{n-1,n-1}. Si el azar encierra la entrada, se vuelve a sortear: siempre existe al menos
 * un camino seguro hacia el oro.
 */
export function generateWorld(seed: number, opts: WorldOptions = {}): World {
  const size = opts.size ?? SIZE;
  const pits = opts.pits ?? PITS;
  const wumpus = opts.wumpus ?? WUMPUS;
  const start = idx(0, 0, size);
  const gold = idx(size - 1, size - 1, size);
  const rng = mulberry32(seed);

  for (let attempt = 0; attempt < 1000; attempt++) {
    const cells: Cell[] = new Array(size * size).fill("empty");
    cells[gold] = "gold";
    const candidates: number[] = [];
    for (let i = 0; i < size * size; i++) if (i !== start && i !== gold) candidates.push(i);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    candidates.slice(0, pits).forEach((c) => (cells[c] = "pit"));
    candidates.slice(pits, pits + wumpus).forEach((c) => (cells[c] = "wumpus"));
    const world: World = { size, cells, start, gold, seed };
    if (distancesToGold(world)[start] > 0) return world;
  }
  throw new Error(`La semilla ${seed} no produjo un mundo con camino al oro`);
}

/**
 * Número mínimo de movimientos desde cada estado hasta el oro sin pisar peligros (BFS desde el oro).
 * -1 = el estado no tiene camino seguro al oro (o es un peligro).
 */
export function distancesToGold(world: World): Int32Array {
  const n = world.size * world.size;
  const dist = new Int32Array(n).fill(-1);
  dist[world.gold] = 0;
  const queue = [world.gold];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    for (const nb of neighbors(cur, world.size)) {
      if (dist[nb] === -1 && world.cells[nb] === "empty") {
        dist[nb] = dist[cur] + 1;
        queue.push(nb);
      }
    }
  }
  return dist;
}

export interface Percepts {
  /** Hedor: hay un Wumpus en una celda adyacente. */
  stench: boolean;
  /** Viento: hay un pozo en una celda adyacente. */
  breeze: boolean;
  /** Brillo: el oro está en una celda adyacente. */
  glitter: boolean;
}

export function percepts(world: World, i: number): Percepts {
  const around = neighbors(i, world.size).map((nb) => world.cells[nb]);
  return {
    stench: around.includes("wumpus"),
    breeze: around.includes("pit"),
    glitter: around.includes("gold"),
  };
}
