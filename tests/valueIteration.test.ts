import { describe, expect, it } from "vitest";
import { ALBUMS } from "../src/albums";
import { buildWalkthrough, closedFormValue } from "../src/core/explain";
import { transitions } from "../src/core/mdp";
import { PRACTICE, type Cell, type World } from "../src/core/types";
import { backup, rollout, valueIteration } from "../src/core/valueIteration";
import { distancesToGold, generateWorld, idx, isHazard, percepts } from "../src/core/world";

/** Mundo 3×3 hecho a mano: oro en S2,2 y un pozo en S1,1. */
function tinyWorld(): World {
  const cells: Cell[] = new Array(9).fill("empty");
  cells[idx(2, 2, 3)] = "gold";
  cells[idx(1, 1, 3)] = "pit";
  return { size: 3, cells, start: 0, gold: idx(2, 2, 3), seed: 0 };
}

describe("generación del mundo 10×10", () => {
  it("coloca 20 pozos y 5 Wumpus, deja libres la entrada S0,0 y pone el oro en S9,9", () => {
    const world = generateWorld(123);
    expect(world.cells.filter((c) => c === "pit")).toHaveLength(20);
    expect(world.cells.filter((c) => c === "wumpus")).toHaveLength(5);
    expect(world.cells[world.start]).toBe("empty");
    expect(world.start).toBe(idx(0, 0));
    expect(world.gold).toBe(idx(9, 9));
    expect(world.cells[world.gold]).toBe("gold");
  });

  it("es reproducible por semilla y siempre deja un camino seguro al oro", () => {
    expect(generateWorld(7).cells).toEqual(generateWorld(7).cells);
    for (let seed = 1; seed <= 200; seed++) {
      expect(distancesToGold(generateWorld(seed))[0]).toBeGreaterThan(0);
    }
  });

  it("calcula las percepciones (hedor junto al Wumpus, viento junto al pozo)", () => {
    const world = tinyWorld();
    expect(percepts(world, idx(1, 0, 3))).toEqual({ stench: false, breeze: true, glitter: false });
    expect(percepts(world, idx(2, 1, 3))).toEqual({ stench: false, breeze: true, glitter: true });
  });
});

describe("modelo del MDP", () => {
  const world = tinyWorld();
  it("chocar con la frontera deja al agente en s con r = −2", () => {
    expect(transitions(world, PRACTICE, 0, "S")).toEqual([{ dir: "S", prob: 1, next: 0, bump: true, reward: -2 }]);
    expect(transitions(world, PRACTICE, 0, "W")[0]).toMatchObject({ next: 0, reward: -2 });
  });

  it("r = −1 en celdas vacías, −100 en peligros y +100 en el oro", () => {
    expect(transitions(world, PRACTICE, 0, "E")[0]).toMatchObject({ next: 1, reward: -1, bump: false });
    expect(transitions(world, PRACTICE, idx(1, 0, 3), "N")[0]).toMatchObject({ reward: -100 });
    expect(transitions(world, PRACTICE, idx(2, 1, 3), "N")[0]).toMatchObject({ reward: 100 });
  });

  it("con resbalón las probabilidades suman 1", () => {
    const ts = transitions(world, { ...PRACTICE, slip: 0.2 }, 0, "N");
    expect(ts.map((t) => t.dir)).toEqual(["N", "W", "E"]);
    expect(ts.reduce((s, t) => s + t.prob, 0)).toBeCloseTo(1);
  });
});

describe("iteración de valores (Ecuación de Optimalidad de Bellman)", () => {
  it("resuelve a mano el mundo 3×3", () => {
    const sol = valueIteration(tinyWorld(), PRACTICE);
    const V = (x: number, y: number) => sol.V[idx(x, y, 3)];
    expect(V(2, 1)).toBeCloseTo(100); // un paso al oro
    expect(V(1, 2)).toBeCloseTo(100);
    expect(V(2, 0)).toBeCloseTo(-1 + 0.9 * 100); // 89
    expect(V(0, 2)).toBeCloseTo(89);
    expect(V(1, 0)).toBeCloseTo(-1 + 0.9 * 89); // 79.1
    expect(V(0, 0)).toBeCloseTo(-1 + 0.9 * 79.1); // 70.19
    expect(sol.policy[idx(0, 0, 3)]).toMatch(/[NE]/);
    expect(sol.ties[idx(0, 0, 3)]).toEqual(["N", "E"]);
  });

  it("la primera iteración desde V0 = 0 usa sólo recompensas inmediatas", () => {
    const sol = valueIteration(generateWorld(ALBUMS[0].seed), PRACTICE);
    expect(sol.history[0].every((v) => v === 0)).toBe(true);
    const [north, , east] = backup(sol.world, PRACTICE, sol.history[0], idx(9, 8)).map((b) => b.q);
    expect(north).toBe(100); // r(oro) + γ·V0(S9,9) = 100 + 0.9·0
    expect(east).toBe(-2); // frontera
    expect(sol.history[1][idx(9, 8)]).toBe(100);
    expect(sol.history[1][idx(0, 0)]).toBe(-1);
  });

  for (const album of ALBUMS) {
    describe(`${album.title} (semilla ${album.seed})`, () => {
      const world = generateWorld(album.seed);
      const w = buildWalkthrough(world, PRACTICE);
      const { sol } = w;

      it("no tiene estados aislados del oro y converge en K = d_max + 1 iteraciones", () => {
        expect(w.pockets).toEqual([]);
        expect(sol.converged).toBe(true);
        expect(sol.iterations).toBe(w.maxDist + 1);
        expect(sol.deltas.at(-1)).toBe(0);
      });

      it("ΔV_k = 100·γ^(k−1): el valor del oro avanza una celda por iteración", () => {
        for (let k = 1; k <= w.maxDist; k++) expect(sol.deltas[k - 1]).toBeCloseTo(100 * 0.9 ** (k - 1), 9);
      });

      it("V* cumple la forma cerrada −10 + 110·γ^(d−1) y es punto fijo de Bellman", () => {
        expect(w.closedForm!.maxError).toBeLessThan(1e-9);
        expect(w.bellmanResidual).toBeLessThan(1e-9);
      });

      it("π* lleva de S0,0 al oro por la ruta más corta sin pisar peligros", () => {
        expect(w.path.at(-1)!.next).toBe(world.gold);
        expect(w.path).toHaveLength(w.dist[world.start]);
        expect(w.path.some((s) => isHazard(world.cells[s.next]) || s.bump)).toBe(false);
        expect(w.path.at(-1)!.cumulative).toBeCloseTo(sol.V[world.start], 9);
        expect(sol.V[world.start]).toBeCloseTo(closedFormValue(PRACTICE, w.dist[world.start]), 9);
      });
    });
  }

  it("los estados sin salida valen r_vida/(1−γ) = −10: vagar es mejor que morir", () => {
    // Entrada encerrada por la frontera y un muro de pozos, con una segunda celda libre.
    const cells: Cell[] = new Array(9).fill("empty");
    cells[idx(2, 2, 3)] = "gold";
    for (const [x, y] of [[2, 0], [2, 1], [0, 1], [1, 1]] as const) cells[idx(x, y, 3)] = "pit";
    const world: World = { size: 3, cells, start: 0, gold: idx(2, 2, 3), seed: 0 };
    const sol = valueIteration(world, PRACTICE);
    expect(sol.V[0]).toBeCloseTo(-10, 2);
    expect(sol.policy[0]).toBe("E");
  });

  it("con resbalón converge (ΔV < ε) y el residual de Bellman queda por debajo de ε", () => {
    const params = { ...PRACTICE, slip: 0.2 };
    const world = generateWorld(ALBUMS[2].seed);
    const sol = valueIteration(world, params);
    expect(sol.converged).toBe(true);
    let residual = 0;
    for (let s = 0; s < 100; s++) {
      if (world.cells[s] !== "empty") continue;
      residual = Math.max(residual, Math.abs(Math.max(...backup(world, params, sol.V, s).map((b) => b.q)) - sol.V[s]));
    }
    expect(residual).toBeLessThan(params.epsilon);
    const steps = rollout(world, params, sol.policy, world.start, () => 0.5);
    expect(steps.length).toBeGreaterThan(0);
  });
});
