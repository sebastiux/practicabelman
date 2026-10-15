/**
 * Genera RESULTADOS.md: la explicación paso a paso de los resultados de la práctica, calculada con
 * el mismo código que usa el juego (src/core). Uso: npm run report
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ALBUMS, type Album } from "../src/albums";
import { buildWalkthrough, closedFormValue, type Walkthrough, type WorkedExample } from "../src/core/explain";
import { ACTION_ARROW, ACTION_LETTER, ACTION_NAME, PRACTICE, type MdpParams, type World } from "../src/core/types";
import type { ActionBackup } from "../src/core/valueIteration";
import { generateWorld, xy } from "../src/core/world";

const P: MdpParams = PRACTICE;
const n2 = (v: number, d = 2) => (Math.abs(v) < 0.5 * 10 ** -d ? (0).toFixed(d) : v.toFixed(d));
const S = (s: number) => {
  const { x, y } = xy(s);
  return `S${x},${y}`;
};

function grid(world: World, cell: (s: number) => string): string {
  const header = `| y \\ x | ${[...Array(world.size).keys()].join(" | ")} |`;
  const sep = `|---|${"---|".repeat(world.size)}`;
  const rows: string[] = [];
  for (let y = world.size - 1; y >= 0; y--) {
    const cells = [...Array(world.size).keys()].map((x) => cell(y * world.size + x));
    rows.push(`| **${y}** | ${cells.join(" | ")} |`);
  }
  return [header, sep, ...rows].join("\n");
}

const mapCell = (world: World) => (s: number) =>
  ({ pit: "🕳️", wumpus: "👹", gold: "🏆", empty: s === world.start ? "🎸" : "·" })[world.cells[s]];

function policyGrid(world: World, w: Walkthrough) {
  return grid(world, (s) => (world.cells[s] === "empty" ? w.sol.ties[s].map((a) => ACTION_ARROW[a]).join("") : mapCell(world)(s)));
}

function valueGrid(world: World, V: ArrayLike<number>) {
  return grid(world, (s) => (world.cells[s] === "empty" ? n2(V[s], 1) : mapCell(world)(s)));
}

function backupTable(b: ActionBackup[], vRight: string): string {
  const best = Math.max(...b.map((x) => x.q));
  const lines = [`| a | s′ | r | ${vRight}(s′) | r + γ·${vRight}(s′) |`, "|---|---|---:|---:|---:|"];
  for (const x of b) {
    const t = x.terms[0];
    const mark = x.q >= best - 1e-9 ? "**" : "";
    lines.push(
      `| ${ACTION_ARROW[x.action]} ${ACTION_NAME[x.action]} | ${S(t.next)}${t.bump ? " (borde)" : ""} | ${n2(t.reward, 0)} | ${n2(t.vNext)} | ${mark}${n2(x.q)}${mark} |`,
    );
  }
  return lines.join("\n");
}

function example(ex: WorkedExample, text: string): string {
  const qs = ex.backups.map((b) => `Q(${S(ex.s)},${ACTION_LETTER[b.action]}) = ${n2(b.terms[0].reward, 0)} + ${P.gamma}·(${n2(b.terms[0].vNext)}) = ${n2(b.q)}`);
  return [
    `**${S(ex.s)}, iteración k = ${ex.k}.** ${text}`,
    "",
    backupTable(ex.backups, `V${ex.k - 1}`),
    "",
    "```",
    ...qs,
    `V${ex.k}(${S(ex.s)}) = max{${ex.backups.map((b) => n2(b.q)).join(", ")}} = ${n2(ex.value)}`,
    "```",
  ].join("\n");
}

function detailed(album: Album, level: number): string {
  const world = generateWorld(album.seed);
  const w = buildWalkthrough(world, P);
  const { sol } = w;
  const K = sol.iterations;
  const dStart = w.dist[world.start];
  const [goldNb, hazardNb, startEx] = w.iteration1;
  const [twoAway, startEx2] = w.iteration2;
  const out: string[] = [];
  const push = (...l: string[]) => out.push(...l, "");

  push(`## Nivel ${level} · ${album.title} (${album.year}) — explicación detallada`);
  push(
    `Mapa con semilla **${album.seed}**: ${w.pits} ${album.pit.plural} (pozos, 🕳️), ${w.wumpus} × ${album.wumpus.name} (Wumpus, 👹), la entrada 🎸 en S0,0 y la púa de oro 🏆 en S9,9. Quedan **${w.nonTerminal} estados no terminales**; los ${100 - w.nonTerminal} terminales valen 0.`,
  );
  push(grid(world, mapCell(world)));

  push("### Paso 1 · Inicialización (k = 0)", "V₀(s) = 0 para los 100 estados. Con esto, en la primera iteración el término γ·V₀(s′) vale 0.");

  push("### Paso 2 · Iteración 1: sólo cuentan las recompensas inmediatas");
  if (goldNb) push(example(goldNb, `Vecino del oro: ir hacia S9,9 vale ${P.goldReward} + ${P.gamma}·0 = ${P.goldReward}.`));
  if (hazardNb)
    push(example(hazardNb, `Junto a un peligro: entrar vale ${P.hazardReward}, chocar ${P.wallReward}, moverse a una celda vacía ${P.stepReward}. Gana moverse y todavía no sabe nada del oro.`));
  if (startEx) push(example(startEx, `La entrada es una esquina: Sur y Oeste chocan con la frontera (${P.wallReward}).`));
  push("Tras la iteración 1 sólo los vecinos del oro valen 100; el resto de los estados vale −1 (el costo de un paso):");
  push(valueGrid(world, sol.history[1]));

  push("### Paso 3 · Iteración 2: el oro se propaga una celda más");
  if (twoAway) push(example(twoAway, `A dos pasos del oro: su vecino ya vale V₁ = 100, así que ${P.stepReward} + ${P.gamma}·100 = 89.`));
  if (startEx2) push(example(startEx2, `La entrada sigue lejos: ${P.stepReward} + ${P.gamma}·(−1) = −1.9.`));

  push("### Paso 4 · La onda de valor y la ley de ΔV");
  push(
    `En cada barrido la información del oro avanza **exactamente una celda**: tras k iteraciones la conocen los estados a k pasos o menos. El estado recién alcanzado a distancia k pasa de valer −(1−γ^(k−1))/(1−γ) (vagar) a −(1−γ^(k−1))/(1−γ) + 100·γ^(k−1) (ir al oro), por eso **ΔV_k = 100·γ^(k−1)** mientras la onda avanza.`,
  );
  const deltaRows = ["| k | ΔV_k | 100·γ^(k−1) | estados que ya conocen el oro | ¿ΔV < ε? |", "|---:|---:|---:|---:|:---:|"];
  sol.deltas.forEach((d, i) => {
    const k = i + 1;
    deltaRows.push(`| ${k} | ${n2(d, 4)} | ${k <= w.maxDist ? n2(100 * P.gamma ** (k - 1), 4) : "—"} | ${w.informed[k]} | ${d < P.epsilon ? "sí → parar" : "no"} |`);
  });
  push(deltaRows.join("\n"));

  if (w.startLearns) {
    push(`### Paso 5 · La entrada se entera del oro (k = ${dStart})`);
    push(
      example(
        w.startLearns,
        `La ruta segura más corta mide d = ${dStart}. Hasta la iteración ${dStart - 1} su mejor plan era vagar (V${dStart - 1} = ${n2(sol.history[dStart - 1][world.start])}); en la ${dStart} su vecino sobre la ruta ya trae el valor del oro y salta a su valor definitivo.`,
      ),
    );
  }

  push("### Paso 6 · Convergencia");
  push(
    `El estado más lejano está a d_max = ${w.maxDist} pasos: recibe el valor del oro en la iteración ${w.maxDist} y en la **${K}** ya nada cambia (ΔV = ${n2(sol.deltas[K - 1], 4)} < ε = ${P.epsilon}). En un MDP determinista la iteración de valores termina exactamente en d_max + 1 barridos.`,
  );

  push("### Paso 7 · Resultado: V* y π*");
  push("V* (valor óptimo de cada estado):");
  push(valueGrid(world, sol.V));
  push("π* (acción óptima; dos flechas = empate entre acciones igual de buenas):");
  push(policyGrid(world, w));
  push(
    `Ninguna flecha apunta a un peligro ni a la frontera: entrar a un pozo o con un Wumpus (${P.hazardReward}) o chocar (${P.wallReward} sin avanzar) siempre es peor que un paso de ${P.stepReward}.`,
  );

  push("### Paso 8 · Verificación: V* es punto fijo de la ecuación");
  push(backupTable(w.startCheck, "V*"));
  push(
    `max = ${n2(Math.max(...w.startCheck.map((b) => b.q)), 4)} = V*(S0,0). En los ${w.nonTerminal} estados no terminales el residual máximo |V*(s) − max_a Q*(s,a)| es **${w.bellmanResidual.toExponential(2)}**.`,
  );

  push("### Paso 9 · Trayectoria óptima desde la entrada");
  const rows = ["| t | s_t | a_t | s_t+1 | r_t+1 | γ^t | γ^t·r | G acumulada | V*(s_t) |", "|---:|---|---|---|---:|---:|---:|---:|---:|"];
  for (const st of w.path)
    rows.push(
      `| ${st.t} | ${S(st.s)} | ${ACTION_ARROW[st.action]} ${ACTION_NAME[st.action]} | ${S(st.next)} | ${n2(st.reward, 0)} | ${n2(st.discount, 4)} | ${n2(st.discounted, 4)} | ${n2(st.cumulative, 4)} | ${n2(sol.V[st.s], 4)} |`,
    );
  push(rows.join("\n"));
  push(
    `G₀ = Σ γ^t·r_t+1 = **${n2(w.path.at(-1)!.cumulative, 4)} = V*(S0,0)**: la suma descontada de la trayectoria coincide con el valor que calculó Bellman.`,
  );

  push("### Paso 10 · Interpretación: fórmula cerrada");
  push(
    `Como el MDP es determinista y cada paso cuesta lo mismo, V* sólo depende de d(s), los pasos de la ruta segura más corta al oro: V*(s) = Σ_{t=0}^{d−2} γ^t·(−1) + γ^(d−1)·100 = **−10 + 110·0.9^(d−1)**. Es decreciente en d, así que π* es la ruta segura más corta. Error máximo frente a la iteración de valores: ${w.closedForm!.maxError.toExponential(1)}.`,
  );
  push(
    ["| d | " + w.closedForm!.rows.map((r) => r.d).join(" | ") + " |", "|---|" + "---:|".repeat(w.closedForm!.rows.length), "| V*(d) | " + w.closedForm!.rows.map((r) => n2(r.value, 2)).join(" | ") + " |", "| # estados | " + w.closedForm!.rows.map((r) => r.count).join(" | ") + " |"].join("\n"),
  );
  return out.join("\n");
}

function compact(album: Album, level: number): string {
  const world = generateWorld(album.seed);
  const w = buildWalkthrough(world, P);
  const dStart = w.dist[world.start];
  return [
    `### Nivel ${level} · ${album.title} (${album.year})`,
    "",
    `Semilla ${album.seed} · peligros: ${album.pit.plural} 🕳️ y ${album.wumpus.name} 👹 · ruta óptima de **${dStart} pasos** · converge en **K = ${w.sol.iterations}** iteraciones (d_max = ${w.maxDist}) · **V*(S0,0) = ${n2(w.sol.V[world.start], 4)}** = −10 + 110·0.9^${dStart - 1} = ${n2(closedFormValue(P, dStart), 4)}.`,
    "",
    "π*:",
    "",
    policyGrid(world, w),
    "",
    `Trayectoria: ${[world.start, ...w.path.map((s) => s.next)].map(S).join(" → ")}`,
    "",
  ].join("\n");
}

const summary = [
  "| Nivel | Disco | Semilla | d(S0,0) | d_max | Iteraciones K | V*(S0,0) | Residual de Bellman |",
  "|---:|---|---:|---:|---:|---:|---:|---:|",
  ...ALBUMS.map((a, i) => {
    const world = generateWorld(a.seed);
    const w = buildWalkthrough(world, P);
    return `| ${i + 1} | ${a.title} | ${a.seed} | ${w.dist[world.start]} | ${w.maxDist} | ${w.sol.iterations} | ${n2(w.sol.V[world.start], 4)} | ${w.bellmanResidual.toExponential(1)} |`;
  }),
].join("\n");

const doc = `# Resultados de la práctica: Mundo del Wumpus con la Ecuación de Optimalidad de Bellman

> Documento generado con \`npm run report\` (scripts/report.ts) usando exactamente el mismo código que el juego (\`src/core\`).
> La versión interactiva, con la misma explicación calculada en vivo para cualquier disco o mapa, está en la pestaña **Explicación** del juego.

## Enunciado (ejercicio de la práctica)

Implementar la **Ecuación de Optimalidad de Bellman (V\\*)** para encontrar la política óptima de navegación en un ambiente de 10 × 10. El agente debe aprender a navegar en el *Mundo del Wumpus*, maximizando la ganancia acumulada y evitando estados terminales negativos.

| Elemento | Definición del MDP |
|---|---|
| Estados S | 100 celdas, S0,0 … S9,9 (x = columna, y = fila; S0,0 abajo a la izquierda) |
| Acciones A | Norte, Sur, Este, Oeste (un paso Manhattan) |
| Estado meta | S9,9 (oro) con r = +100, terminal |
| Peligros | 20 pozos y 5 Wumpus distribuidos aleatoriamente, r = −100, terminales |
| Costo de vida | r = −1 por cada movimiento a una celda vacía |
| Fronteras | si la acción saca al agente de la red, permanece en s con r = −2 |
| Descuento | γ = 0.9 |
| Convergencia | iterar hasta que ΔV < ε (ε = 10⁻⁴) |
| Transiciones | deterministas: P(s′, r \\| s, a) = 1 para el único s′ al que lleva a |

Cada disco es un escenario distinto (semilla fija, dificultad creciente) con la misma definición del MDP; el juego también permite generar mapas aleatorios. Se garantiza que siempre exista un camino seguro de la entrada al oro.

## Ecuación y algoritmo

$$V_*(s) = \\max_a \\sum_{s',r} P(s',r \\mid s,a)\\,[r + \\gamma V_*(s')]$$

Con transiciones deterministas la suma desaparece: $V_*(s) = \\max_a [\\,r(s,a) + 0.9\\,V_*(s')\\,]$, con V = 0 en los estados terminales. La **iteración de valores** la convierte en una regla de actualización síncrona:

$$V_{k+1}(s) = \\max_a \\sum_{s',r} P(s',r \\mid s,a)\\,[r + \\gamma V_k(s')], \\qquad \\Delta V_{k+1} = \\max_s |V_{k+1}(s) - V_k(s)|$$

\`\`\`
V ← 0 para todos los estados
repetir
    V' ← V
    para cada estado no terminal s:
        V'(s) ← max_a Σ P(s',r|s,a)·[r + γ·V(s')]
    Δ ← max_s |V'(s) − V(s)|
    V ← V'
hasta que Δ < ε
π*(s) ← argmax_a Σ P(s',r|s,a)·[r + γ·V(s')]
\`\`\`

Implementación: \`src/core/valueIteration.ts\` (\`backup\`, \`bellmanSweep\`, \`valueIteration\`, \`greedyPolicy\`) y modelo del MDP en \`src/core/mdp.ts\`.

## Resumen de los 5 escenarios

${summary}

En todos los mapas la iteración de valores converge exactamente en d_max + 1 barridos, el residual de Bellman es 0 (V\\* es punto fijo de la ecuación) y π\\* lleva de S0,0 al oro por la ruta segura más corta.

${detailed(ALBUMS[0], 1)}

## Los otros escenarios

${ALBUMS.slice(1)
  .map((a, i) => compact(a, i + 2))
  .join("\n")}

## Conclusiones

1. La iteración de valores aplica la Ecuación de Optimalidad de Bellman como regla de actualización y converge a V\\* en pocas decenas de barridos (ΔV < ε).
2. El valor del oro se propaga desde S9,9 como una onda, **una celda por iteración**, descontado por γ y penalizado por el costo de vida; por eso ΔV_k = 100·γ^(k−1) mientras la onda avanza y K = d_max + 1.
3. La política óptima evita los 25 estados terminales negativos y las fronteras, y elige la ruta segura más corta: V\\*(s) = −10 + 110·0.9^(d(s)−1).
4. Cuando la ruta es larga (d ≥ 24) V\\*(S0,0) llega a ser negativo, pero ir al oro sigue siendo óptimo: vagar para siempre vale −10 y caer en un peligro −100.
5. V\\* coincide con la ganancia descontada G₀ = Σ γ^t·r_t+1 de la trayectoria óptima, como dicta su definición V(s) = E[G_t | S_t = s].
`;

const out = fileURLToPath(new URL("../RESULTADOS.md", import.meta.url));
writeFileSync(out, doc);
console.log(`Escrito ${out}`);
