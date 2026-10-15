/**
 * Genera reporte/reporte.tex (listo para Overleaf) con los números calculados por el mismo código del juego.
 * Uso: npm run report:latex
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ALBUMS } from "../src/albums";
import { buildWalkthrough, closedFormValue, type WorkedExample } from "../src/core/explain";
import { mulberry32 } from "../src/core/rng";
import { ACTION_LETTER, ACTION_NAME, PRACTICE, type Action, type MdpParams } from "../src/core/types";
import { rollout, valueIteration, type ActionBackup } from "../src/core/valueIteration";
import { generateWorld, xy } from "../src/core/world";

const L = String.raw;
const P = PRACTICE;

/** Número en modo matemático: $-1.90$. */
const m = (v: number, d = 2) => `$${Math.abs(v) < 0.5 * 10 ** -d ? (0).toFixed(d) : v.toFixed(d)}$`;
const raw = (v: number, d = 2) => (Math.abs(v) < 0.5 * 10 ** -d ? (0).toFixed(d) : v.toFixed(d));
const S = (s: number) => {
  const { x, y } = xy(s);
  return `$S_{${x},${y}}$`;
};
const Sm = (s: number) => {
  const { x, y } = xy(s);
  return `S_{${x},${y}}`;
};
const ARROW: Record<Action, string> = { N: L`\uparrow`, S: L`\downarrow`, E: L`\rightarrow`, W: L`\leftarrow` };

/* ───────────────────────── Datos ───────────────────────── */

const album = ALBUMS[0];
const world = generateWorld(album.seed);
const w = buildWalkthrough(world, P);
const { sol } = w;
const K = sol.iterations;
const dStart = w.dist[world.start];
const [goldNb, hazardNb, startEx] = w.iteration1;
const [twoAway, startEx2] = w.iteration2;

const scenarios = ALBUMS.map((a, i) => {
  const wd = generateWorld(a.seed);
  const wt = buildWalkthrough(wd, P);
  return { level: i + 1, album: a, d: wt.dist[wd.start], dmax: wt.maxDist, K: wt.sol.iterations, v0: wt.sol.V[wd.start], residual: wt.bellmanResidual };
});

interface Sens {
  label: string;
  params: MdpParams;
}
const sensitivity: Sens[] = [
  { label: L`$\gamma = 0.5$`, params: { ...P, gamma: 0.5 } },
  { label: L`$\gamma = 0.7$`, params: { ...P, gamma: 0.7 } },
  { label: L`$\gamma = 0.9$ (práctica)`, params: P },
  { label: L`$\gamma = 0.99$`, params: { ...P, gamma: 0.99 } },
  { label: L`$\varepsilon = 10^{-2}$`, params: { ...P, epsilon: 1e-2 } },
  { label: L`$\varepsilon = 10^{-6}$`, params: { ...P, epsilon: 1e-6 } },
  { label: L`resbalón $0.1$`, params: { ...P, slip: 0.1 } },
  { label: L`resbalón $0.2$`, params: { ...P, slip: 0.2 } },
];
const RUNS = 2000;
function simulate(params: MdpParams, policy: (Action | null)[]) {
  const rng = mulberry32(7);
  let wins = 0;
  let total = 0;
  for (let i = 0; i < RUNS; i++) {
    const steps = rollout(world, params, policy, world.start, rng, 500);
    const last = steps.at(-1)!;
    if (world.cells[last.next] === "gold") wins++;
    total += last.cumulative;
  }
  return { win: (100 * wins) / RUNS, meanG: total / RUNS };
}
const sensRows = sensitivity.map(({ label, params }) => {
  const s = valueIteration(world, params);
  let changed = 0;
  for (let i = 0; i < 100; i++) if (world.cells[i] === "empty" && !sol.ties[i].includes(s.policy[i]!)) changed++;
  return { label, params, K: s.iterations, v0: s.V[world.start], changed, ...simulate(params, s.policy) };
});
const slip2 = sensRows.find((r) => r.params.slip === 0.2)!;
const slip1 = sensRows.find((r) => r.params.slip === 0.1)!;
const naiveUnderSlip = simulate({ ...P, slip: 0.2 }, sol.policy);
const g099 = sensRows.find((r) => r.params.gamma === 0.99)!;
const g05 = sensRows.find((r) => r.params.gamma === 0.5)!;

/* ───────────────────────── Tablas ───────────────────────── */

function backupTable(b: ActionBackup[], vRight: string, caption: string, label: string): string {
  const best = Math.max(...b.map((x) => x.q));
  const rows = b
    .map((x) => {
      const t = x.terms[0];
      const q = x.q >= best - 1e-9 ? L`$\mathbf{${raw(x.q)}}$` : m(x.q);
      return `${ACTION_NAME[x.action]} (${ACTION_LETTER[x.action]}) & ${S(t.next)}${t.bump ? " (borde)" : ""} & ${m(t.reward, 0)} & ${m(t.vNext)} & ${q} \\\\`;
    })
    .join("\n");
  return L`\begin{table}[H]
\centering
\small
\caption{${caption}}
\label{${label}}
\begin{tabular}{lcrrr}
\toprule
Acción $a$ & $s'$ & $r$ & $${vRight}(s')$ & $r + \gamma\,${vRight}(s')$ \\
\midrule
${rows}
\bottomrule
\end{tabular}
\end{table}`;
}

function qLines(ex: WorkedExample): string {
  const lines = ex.backups.map(
    (b) => `Q(${Sm(ex.s)},${ACTION_LETTER[b.action]}) &= ${raw(b.terms[0].reward, 0)} + 0.9\\cdot(${raw(b.terms[0].vNext)}) = ${raw(b.q)}`,
  );
  return L`\begin{align*}
${lines.join(" \\\\\n")} \\
V_{${ex.k}}(${Sm(ex.s)}) &= \max\{${ex.backups.map((b) => raw(b.q)).join(",\\ ")}\} = \mathbf{${raw(ex.value)}}
\end{align*}`;
}

function example(ex: WorkedExample, caption: string, label: string) {
  return `${backupTable(ex.backups, `V_{${ex.k - 1}}`, caption, label)}\n${qLines(ex)}`;
}

function gridTable(cell: (s: number) => string, caption: string, label: string): string {
  const rows: string[] = [];
  for (let y = world.size - 1; y >= 0; y--) {
    rows.push(`\\textbf{${y}} & ${[...Array(world.size).keys()].map((x) => cell(y * world.size + x)).join(" & ")} \\\\`);
  }
  return L`\begin{table}[H]
\centering
\footnotesize
\setlength{\tabcolsep}{3.5pt}
\caption{${caption}}
\label{${label}}
\begin{tabular}{c|cccccccccc}
$y \backslash x$ & ${[...Array(world.size).keys()].join(" & ")} \\
\hline
${rows.join("\n")}
\end{tabular}
\end{table}`;
}

const terminalMark = (s: number) =>
  ({ pit: L`\textcolor{ibero}{P}`, wumpus: L`\textcolor{ibero}{\textbf{W}}`, gold: L`\textcolor{oro}{\textbf{G}}`, empty: "" })[world.cells[s]];

const vStarTable = gridTable(
  (s) => (world.cells[s] === "empty" ? raw(sol.V[s], 1) : terminalMark(s)),
  L`Valores óptimos $V_*(s)$ del nivel 1 (P = pozo, W = Wumpus, G = oro; los terminales valen 0).`,
  "tab:vstar",
);
const policyTable = gridTable(
  (s) => (world.cells[s] === "empty" ? `$${sol.ties[s].map((a) => ARROW[a]).join("")}$` : terminalMark(s)),
  L`Política óptima $\pi_*(s)$ del nivel 1. Dos flechas indican un empate: ambas acciones alcanzan el máximo.`,
  "tab:pistar",
);

function deltaTable(): string {
  const half = Math.ceil(K / 2);
  const row = (k: number) =>
    k <= K
      ? `${k} & ${m(sol.deltas[k - 1], 4)} & ${k <= w.maxDist ? m(100 * P.gamma ** (k - 1), 4) : "--"} & ${w.informed[k]}`
      : " & & & ";
  const rows = [...Array(half).keys()].map((i) => `${row(i + 1)} & ${row(i + 1 + half)} \\\\`).join("\n");
  return L`\begin{table}[H]
\centering
\footnotesize
\caption{Cambio máximo por iteración $\Delta V_k$, la ley $100\,\gamma^{k-1}$ y el número de estados que ya \emph{conocen} el oro ($d(s) \le k$).}
\label{tab:deltas}
\begin{tabular}{rrrr|rrrr}
\toprule
$k$ & $\Delta V_k$ & $100\gamma^{k-1}$ & inf. & $k$ & $\Delta V_k$ & $100\gamma^{k-1}$ & inf. \\
\midrule
${rows}
\bottomrule
\end{tabular}
\end{table}`;
}

function pathTable(): string {
  const rows = w.path
    .map(
      (st) =>
        `${st.t} & ${S(st.s)} & ${ACTION_NAME[st.action]} & ${S(st.next)} & ${m(st.reward, 0)} & ${m(st.discount, 4)} & ${m(st.discounted, 4)} & ${m(st.cumulative, 4)} & ${m(sol.V[st.s], 4)} \\\\`,
    )
    .join("\n");
  return L`\begin{table}[H]
\centering
\footnotesize
\setlength{\tabcolsep}{4pt}
\caption{Trayectoria siguiendo $\pi_*$ desde la entrada. La ganancia acumulada final coincide con $V_*(S_{0,0})$.}
\label{tab:trayectoria}
\begin{tabular}{rcccrrrrr}
\toprule
$t$ & $s_t$ & $a_t$ & $s_{t+1}$ & $r_{t+1}$ & $\gamma^t$ & $\gamma^t r_{t+1}$ & $G$ acumulada & $V_*(s_t)$ \\
\midrule
${rows}
\bottomrule
\end{tabular}
\end{table}`;
}

function closedTable(): string {
  const rows = w.closedForm!.rows;
  const block = (part: typeof rows) => L`\begin{tabular}{l${"r".repeat(part.length)}}
\toprule
$d$ & ${part.map((r) => r.d).join(" & ")} \\
\midrule
$V_*(d)$ & ${part.map((r) => raw(r.value, 2)).join(" & ")} \\
\# estados & ${part.map((r) => r.count).join(" & ")} \\
\bottomrule
\end{tabular}`;
  const half = Math.ceil(rows.length / 2);
  return L`\begin{table}[H]
\centering
\scriptsize
\setlength{\tabcolsep}{3pt}
\caption{Fórmula cerrada $V_*(d) = -10 + 110\,(0.9)^{d-1}$ y número de estados a cada distancia $d$ del oro en el nivel 1.}
\label{tab:cerrada}
${block(rows.slice(0, half))}

\vspace{4pt}
${block(rows.slice(half))}
\end{table}`;
}

const scenarioTable = L`\begin{table}[H]
\centering
\small
\caption{Resultados de la iteración de valores en los cinco escenarios (parámetros de la práctica).}
\label{tab:escenarios}
\begin{tabular}{rlrrrrrc}
\toprule
Nivel & Disco & Semilla & $d(S_{0,0})$ & $d_{\max}$ & $K$ & $V_*(S_{0,0})$ & Residual \\
\midrule
${scenarios
  .map((s) => `${s.level} & \\textit{${s.album.title}} & ${s.album.seed} & ${s.d} & ${s.dmax} & ${s.K} & ${m(s.v0, 4)} & ${m(s.residual, 0)} \\\\`)
  .join("\n")}
\bottomrule
\end{tabular}
\end{table}`;

const sensTable = L`\begin{table}[H]
\centering
\small
\caption{Sensibilidad en el nivel 1: iteraciones $K$, valor de la entrada, estados cuya acción óptima cambia respecto a la práctica y resultados de ${RUNS} episodios simulados siguiendo la política óptima de cada caso.}
\label{tab:sensibilidad}
\begin{tabular}{lrrrrr}
\toprule
Parámetros & $K$ & $V_*(S_{0,0})$ & cambios en $\pi_*$ & llega al oro & $\bar G$ simulado \\
\midrule
${sensRows.map((r) => `${r.label} & ${r.K} & ${m(r.v0, 2)} & ${r.changed} & $${raw(r.win, 1)}\\%$ & ${m(r.meanG, 2)} \\\\`).join("\n")}
\bottomrule
\end{tabular}
\end{table}`;

/* ───────────────────────── Documento ───────────────────────── */

const fig = (file: string, caption: string, label: string, width = "0.62\\textwidth") => L`\begin{figure}[H]
\centering
\includegraphics[width=${width}]{figuras/${file}}
\caption{${caption}}
\label{${label}}
\end{figure}`;

const doc = L`% ============================================================
% Reporte: Ecuación de Optimalidad de Bellman en el Mundo del Wumpus
% Generado con "npm run report:latex" (scripts/report-latex.ts):
% todas las tablas y números provienen del mismo código del juego.
% Sube a Overleaf este archivo y la carpeta figuras/ (incluye ahí
% tu logo como figuras/logo_ibero.png).
% ============================================================
\documentclass[11pt,letterpaper]{article}

\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[spanish,es-tabla,es-nodecimaldot,es-noshorthands]{babel}
\usepackage{lmodern}
\usepackage[margin=2.5cm,headheight=14pt]{geometry}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage{float}
\usepackage{booktabs}
\usepackage[table]{xcolor}
\usepackage{caption}
\usepackage{enumitem}
\usepackage{fancyhdr}
\usepackage{titlesec}
\usepackage{algorithm}
\usepackage{algpseudocode}
\usepackage[most]{tcolorbox}
\usepackage[hidelinks]{hyperref}

\definecolor{ibero}{HTML}{D52B1E}
\definecolor{oro}{HTML}{B8860B}

\titleformat{\section}{\Large\bfseries\color{ibero}}{\thesection}{0.6em}{}
\titleformat{\subsection}{\large\bfseries\color{ibero}}{\thesubsection}{0.6em}{}
\titleformat{\subsubsection}{\normalsize\bfseries}{\thesubsubsection}{0.6em}{}
\captionsetup{font=small,labelfont={bf,color=ibero}}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small Aprendizaje Reforzado}
\fancyhead[R]{\small Bellman en el Mundo del Wumpus}
\fancyfoot[C]{\small\thepage}
\renewcommand{\headrule}{{\color{ibero}\hrule height 0.6pt}}

\floatname{algorithm}{Algoritmo}
\renewcommand{\algorithmicrequire}{\textbf{Entrada:}}
\renewcommand{\algorithmicensure}{\textbf{Salida:}}

\newtcolorbox{nota}[1][]{colback=ibero!5,colframe=ibero,boxrule=0.6pt,arc=2pt,left=6pt,right=6pt,top=4pt,bottom=4pt,#1}

\newcommand{\juego}{\url{https://sebastiux.github.io/practicabelman/}}
\newcommand{\repo}{\url{https://github.com/sebastiux/practicabelman}}

\begin{document}

% ------------------------------------------------------------ Portada
\begin{titlepage}
\centering
\IfFileExists{figuras/logo_ibero.png}{\includegraphics[width=0.42\textwidth]{figuras/logo_ibero.png}}{\fbox{\parbox[c][2.5cm][c]{0.42\textwidth}{\centering Logo Ibero\\ \footnotesize(figuras/logo\_ibero.png)}}}\par
\vspace{1.2cm}
{\Large\bfseries Universidad Iberoamericana}\par
\vspace{0.2cm}
{\large Aprendizaje Reforzado}\par
\vspace{1.6cm}
{\color{ibero}\rule{\linewidth}{1.2pt}}\par
\vspace{0.5cm}
{\Huge\bfseries Seek \& Bellman}\par
\vspace{0.4cm}
{\LARGE Ecuación de Optimalidad de Bellman\\[2pt] en el Mundo del Wumpus}\par
\vspace{0.4cm}
{\color{ibero}\rule{\linewidth}{1.2pt}}\par
\vspace{0.8cm}
{\large Práctica: Definiciones MDPs y Ecuaciones de Bellman}\par
\vfill
\begin{tabular}{rl}
\textbf{Alumno:} & \textit{Nombre del alumno} \\
\textbf{Profesores:} & Dr. Alexandro López González \\
 & Mtro. Julio Caballero Mora \\
\textbf{Fecha:} & \today \\
\end{tabular}\par
\vspace{1cm}
{\small Juego: \juego\\ Código: \repo}
\end{titlepage}

\tableofcontents
\newpage

% ------------------------------------------------------------
\section{Introducción}

Un agente que toma decisiones en secuencia no debe maximizar la recompensa inmediata, sino la ganancia acumulada que recibirá a lo largo del episodio. Los Procesos de Decisión de Markov (MDP) formalizan este problema y las ecuaciones de Bellman permiten calcular qué tan bueno es cada estado relacionando su valor con el de los estados futuros, sin tener que observar todas las recompensas hasta el final.

En esta práctica se implementa la \textbf{Ecuación de Optimalidad de Bellman} ($V_*$) mediante el algoritmo de \textbf{iteración de valores} para encontrar la política óptima de navegación en un \emph{Mundo del Wumpus} de $10 \times 10$ estados. Para hacerlo más didáctico, la solución se presenta como un juego web, \emph{Seek \& Bellman}, con temática de Metallica: cinco escenarios inspirados en los discos \emph{Kill 'Em All}, \emph{Ride the Lightning}, \emph{Master of Puppets}, \emph{\ldots And Justice for All} y el \emph{Black Album}. En el juego se puede jugar manualmente, ver iteración por iteración cómo se propaga el valor y consultar el cálculo de la ecuación en cualquier celda.

\begin{nota}
\textbf{Juego en línea:} \juego\qquad \textbf{Código fuente:} \repo
\end{nota}

% ------------------------------------------------------------
\section{Objetivos}

\textbf{General.} Implementar la Ecuación de Optimalidad de Bellman para obtener $V_*$ y la política óptima $\pi_*$ de un agente que navega en el Mundo del Wumpus de $10\times10$, maximizando la ganancia acumulada y evitando los estados terminales negativos.

\textbf{Específicos.}
\begin{enumerate}[leftmargin=*]
  \item Modelar el ambiente como un MDP con estados, acciones, recompensas, tasa de descuento y transiciones.
  \item Implementar la iteración de valores con el criterio de paro $\Delta V < \varepsilon$.
  \item Explicar paso a paso cómo se propaga el valor iteración tras iteración y verificar que $V_*$ es punto fijo de la ecuación.
  \item Extraer la política óptima y comprobar que la ganancia de la trayectoria óptima coincide con $V_*(S_{0,0})$.
  \item Construir una herramienta interactiva que permita a cualquier estudiante comprender el funcionamiento de Bellman.
\end{enumerate}

% ------------------------------------------------------------
\section{Marco teórico}

\subsection{Procesos de Decisión de Markov}
Un MDP se define por un conjunto de estados $S$, un conjunto de acciones $A$, una dinámica $P(s', r \mid s, a)$ que da la probabilidad de llegar a $s'$ con recompensa $r$ al tomar la acción $a$ en el estado $s$, y una tasa de descuento $\gamma \in [0,1]$. Una \emph{política} $\pi(a \mid s)$ asigna a cada estado una probabilidad de tomar cada acción y sólo depende del estado actual.

\subsection{Ganancia y descuento}
El agente busca maximizar la ganancia esperada
\begin{equation}
G_t = R_{t+1} + \gamma R_{t+2} + \gamma^2 R_{t+3} + \cdots = \sum_{k=0}^{\infty} \gamma^k R_{t+k+1} = R_{t+1} + \gamma\, G_{t+1}.
\end{equation}
Si $\gamma = 0$ sólo importa la recompensa inmediata; conforme $\gamma \to 1$ el agente toma más en cuenta el futuro.

\subsection{Funciones de valor}
La función de valor estado bajo una política $\pi$ es la ganancia esperada al partir de $s$ y seguir $\pi$:
\begin{equation}
V_\pi(s) = \mathbb{E}_\pi\left[\, G_t \mid S_t = s \,\right], \qquad q_\pi(s,a) = \mathbb{E}_\pi\left[\, G_t \mid S_t = s, A_t = a \,\right].
\end{equation}

\subsection{Ecuaciones de Bellman}
Las ecuaciones de Bellman son recursivas: el valor de hoy es la recompensa inmediata más el valor descontado del mañana. Para evaluar una política:
\begin{equation}
V_\pi(s) = \sum_a \pi(a\mid s) \sum_{s',r} P(s',r \mid s,a)\,\big[r + \gamma V_\pi(s')\big].
\end{equation}
Para encontrar la política óptima, el promedio sobre las acciones se reemplaza por el máximo, lo que da la \textbf{Ecuación de Optimalidad de Bellman}:
\begin{equation}
\label{eq:optimalidad}
V_*(s) = \max_a \sum_{s',r} P(s',r \mid s,a)\,\big[r + \gamma V_*(s')\big].
\end{equation}

\subsection{Iteración de valores}
La ecuación~\eqref{eq:optimalidad} contiene a $V_*$ en ambos lados y un máximo, así que no se despeja directamente. La iteración de valores la convierte en una regla de actualización que se aplica a todos los estados en barridos sucesivos, a partir de $V_0 = 0$:
\begin{equation}
\label{eq:vi}
V_{k+1}(s) = \max_a \sum_{s',r} P(s',r \mid s,a)\,\big[r + \gamma V_k(s')\big], \qquad \Delta V_{k+1} = \max_s \big|V_{k+1}(s) - V_k(s)\big|.
\end{equation}
Para $\gamma < 1$ esta regla es una contracción y $V_k$ converge a $V_*$; se itera hasta que $\Delta V < \varepsilon$. Finalmente, la política óptima es la acción que alcanza el máximo:
\begin{equation}
\pi_*(s) = \arg\max_a \sum_{s',r} P(s',r \mid s,a)\,\big[r + \gamma V_*(s')\big].
\end{equation}

% ------------------------------------------------------------
\section{Planteamiento del problema}

\subsection{Definición del MDP}
\begin{table}[H]
\centering
\small
\caption{Definición del MDP de la práctica.}
\label{tab:mdp}
\begin{tabular}{ll}
\toprule
Elemento & Definición \\
\midrule
Estados $S$ & 100 celdas, $S_{0,0}$ a $S_{9,9}$ ($x$ = columna, $y$ = fila; $S_{0,0}$ abajo a la izquierda) \\
Acciones $A$ & Norte, Sur, Este y Oeste (un paso con distancia Manhattan) \\
Estado meta & $S_{9,9}$ (oro) con $r = +100$, terminal \\
Peligros & 20 pozos y 5 Wumpus distribuidos aleatoriamente, $r = -100$, terminales \\
Costo de vida & $r = -1$ por cada movimiento a una celda vacía \\
Fronteras & si la acción saca al agente de la red, permanece en $s$ con $r = -2$ \\
Descuento & $\gamma = 0.9$ \\
Convergencia & iterar hasta que $\Delta V < \varepsilon$, con $\varepsilon = 10^{-4}$ \\
Transiciones & deterministas: $P(s', r \mid s, a) = 1$ para el único $s'$ al que lleva $a$ \\
\bottomrule
\end{tabular}
\end{table}

Los estados terminales (oro, pozos y Wumpus) valen 0, porque al entrar en ellos termina el episodio; su recompensa se cobra en la transición que llega a ellos. Como las transiciones son deterministas, la suma sobre $s'$ y $r$ desaparece y la ecuación se simplifica a
\begin{equation}
\label{eq:det}
V_*(s) = \max_{a \in \{N,S,E,O\}} \big[\, r(s,a) + 0.9\, V_*(s') \,\big].
\end{equation}

\subsection{Escenarios del juego}
Cada disco es un escenario con la misma definición del MDP y una distribución distinta de peligros (semilla fija), con dificultad creciente: la ruta segura más corta de la entrada al oro mide de 18 a 26 pasos. Al generar el mapa se garantiza que exista al menos un camino seguro de $S_{0,0}$ al oro. El agente es un integrante de la banda y los peligros cambian de apariencia en cada disco (figura~\ref{fig:personajes}).

${fig("fig_escenarios.png", L`Selector de escenarios del juego: un nivel por disco.`, "fig:escenarios", "\\textwidth")}

${fig("fig_personajes.png", L`Sprites pixel-art originales: agente, entrada, meta, percepciones y peligros de cada escenario.`, "fig:personajes", "0.95\\textwidth")}

% ------------------------------------------------------------
\section{Implementación}

\subsection{Arquitectura}
El proyecto es una aplicación web en TypeScript (Vite + React) separada en dos capas:
\begin{itemize}[leftmargin=*]
  \item \textbf{Núcleo del MDP} (\texttt{src/core}), sin dependencias de la interfaz: generación del mundo con semilla (\texttt{world.ts}), modelo $P(s',r \mid s,a)$ con las recompensas de la práctica (\texttt{mdp.ts}) e iteración de valores, extracción de la política y simulación de trayectorias (\texttt{valueIteration.ts}).
  \item \textbf{Interfaz} (\texttt{src/components}): tablero, modo de juego, modo Bellman con inspector de la ecuación y gráfica de convergencia, y la explicación paso a paso calculada en vivo.
\end{itemize}
El sitio se publica automáticamente en GitHub Pages con GitHub Actions, que antes de cada despliegue ejecuta 30 pruebas automáticas del núcleo.

\subsection{Algoritmo}
La actualización se hace de forma \emph{síncrona}: $V_{k+1}$ se calcula usando sólo los valores de $V_k$, de modo que cada iteración se puede explicar de manera aislada.

\begin{algorithm}[H]
\caption{Iteración de valores (Ecuación de Optimalidad de Bellman)}
\label{alg:vi}
\begin{algorithmic}[1]
\Require MDP $(S, A, P, \gamma)$, umbral $\varepsilon$
\Ensure $V_*$ y $\pi_*$
\State $V(s) \gets 0$ para todo $s \in S$
\Repeat
  \State $V' \gets V$
  \For{cada estado no terminal $s$}
    \State $V'(s) \gets \max_a \sum_{s',r} P(s',r \mid s,a)\,[\,r + \gamma V(s')\,]$
  \EndFor
  \State $\Delta \gets \max_s |V'(s) - V(s)|$
  \State $V \gets V'$
\Until{$\Delta < \varepsilon$}
\State $\pi_*(s) \gets \arg\max_a \sum_{s',r} P(s',r \mid s,a)\,[\,r + \gamma V(s')\,]$
\State \Return $V$, $\pi_*$
\end{algorithmic}
\end{algorithm}

\subsection{Verificación}
Las pruebas automáticas comprueban, entre otras cosas, que el mundo tiene 20 pozos y 5 Wumpus con la entrada y el oro libres, que el choque con la frontera deja al agente en $s$ con $r=-2$, que un mundo de $3\times3$ resuelto a mano coincide con el algoritmo, que en los cinco escenarios $V_*$ es punto fijo de la ecuación (residual $\approx 0$) y que la política óptima llega al oro por la ruta más corta sin pisar peligros.

% ------------------------------------------------------------
\section{Resultados paso a paso (nivel 1: \emph{Kill 'Em All})}

El mapa del nivel 1 (semilla ${album.seed}) tiene ${w.pits} pozos (charcos de sangre), ${w.wumpus} Wumpus (el Jinete), la entrada en $S_{0,0}$ y el oro en $S_{9,9}$. Quedan \textbf{${w.nonTerminal} estados no terminales} cuyo valor hay que calcular; los ${100 - w.nonTerminal} terminales valen 0.

${fig("fig_mapa.png", L`Mapa del nivel 1. Abajo a la izquierda, la entrada $S_{0,0}$; arriba a la derecha, el oro $S_{9,9}$.`, "fig:mapa", "0.55\\textwidth")}

\subsection{Paso 0: inicialización}
Se inicia con $V_0(s) = 0$ para los 100 estados. Por eso, en la primera iteración el término $\gamma V_0(s')$ vale 0 y sólo cuentan las recompensas inmediatas.

\subsection{Paso 1: primera iteración}
\paragraph{Vecino del oro (${S(goldNb.s)}).} Ir al Norte lleva al oro: $100 + 0.9\cdot 0 = 100$, que es el máximo.
${example(goldNb, L`Cálculo de $V_1(${Sm(goldNb.s)})$, vecino del oro.`, "tab:it1-oro")}

\paragraph{Junto a un peligro (${S(hazardNb.s)}).} Entrar al charco de sangre vale $-100$; moverse a una celda vacía, $-1$. Gana moverse y el estado todavía no \emph{sabe} nada del oro.
${example(hazardNb, L`Cálculo de $V_1(${Sm(hazardNb.s)})$, junto a un pozo.`, "tab:it1-peligro")}

\paragraph{La entrada (${S(startEx.s)}).} Es una esquina: Sur y Oeste chocan con la frontera ($-2$) y Norte y Este cuestan $-1$.
${example(startEx, L`Cálculo de $V_1(S_{0,0})$, esquina con dos fronteras.`, "tab:it1-entrada")}

Tras la primera iteración sólo los vecinos del oro valen 100; el resto de los estados no terminales vale $-1$, el costo de un paso (figura~\ref{fig:v1}).

${fig("fig_v1.png", L`$V_1$: sólo los vecinos del oro tienen valor positivo. Las flechas muestran la acción greedy respecto a $V_1$; varias flechas pequeñas indican empate.`, "fig:v1", "0.6\\textwidth")}

\subsection{Paso 2: segunda iteración}
\paragraph{A dos pasos del oro (${S(twoAway.s)}).} Su vecino ya vale $V_1 = 100$, así que moverse hacia él vale $-1 + 0.9 \cdot 100 = 89$.
${example(twoAway, L`Cálculo de $V_2(${Sm(twoAway.s)})$, a dos pasos del oro.`, "tab:it2-dos")}

\paragraph{La entrada.} Sigue lejos del oro: lo mejor es pagar otro paso, $-1 + 0.9\cdot(-1) = -1.9$.
${example(startEx2, L`Cálculo de $V_2(S_{0,0})$.`, "tab:it2-entrada")}

${fig("fig_v2.png", L`$V_2$: la zona dorada creció una celda alrededor del oro.`, "fig:v2", "0.6\\textwidth")}

\subsection{Paso 3: la onda de valor}
En cada barrido la información del oro avanza \textbf{exactamente una celda}: tras $k$ iteraciones la conocen los estados que están a $k$ pasos o menos por caminos seguros (figura~\ref{fig:onda}). Un estado a distancia $k$ que todavía no conoce el oro sólo acumula costo de vida, $V_{k-1}(s) = -\sum_{t=0}^{k-2}\gamma^t = -\frac{1-\gamma^{k-1}}{1-\gamma}$; en la iteración $k$ recibe el oro y pasa a valer $-\frac{1-\gamma^{k-1}}{1-\gamma} + 100\,\gamma^{k-1}$. La diferencia es exactamente
\begin{equation}
\Delta V_k = 100\,\gamma^{k-1},
\end{equation}
lo que explica la serie $100, 90, 81, 72.9, \ldots$ de la tabla~\ref{tab:deltas}.

${fig("fig_onda.png", L`Instantáneas de $V_k$ en $k = ${w.snapshots.filter((k) => k > 0).join(", ")}$: la onda dorada crece una celda por iteración desde el oro.`, "fig:onda", "\\textwidth")}

\subsection{Paso 4: la entrada se entera del oro (\texorpdfstring{$k = ${dStart}$}{k = ${dStart}})}
La ruta segura más corta de $S_{0,0}$ al oro mide $d = ${dStart}$ pasos. Hasta la iteración ${dStart - 1} su mejor plan era vagar ($V_{${dStart - 1}}(S_{0,0}) = ${raw(sol.history[dStart - 1][world.start])}$); en la iteración ${dStart} su vecino sobre la ruta ya trae el valor del oro y $V_{${dStart}}(S_{0,0})$ salta a su valor definitivo (figura~\ref{fig:inspector}).
${example(w.startLearns!, L`Cálculo de $V_{${dStart}}(S_{0,0})$: el valor del oro llega a la entrada.`, "tab:aprende")}

${fig("fig_inspector.png", L`Inspector de Bellman del juego en $k = ${dStart}$ para $S_{0,0}$.`, "fig:inspector", "0.6\\textwidth")}

\subsection{Paso 5: convergencia}
El estado más lejano del oro está a $d_{\max} = ${w.maxDist}$ pasos: recibe el valor del oro en la iteración ${w.maxDist} y en la iteración \textbf{$K = ${K}$} ya nada cambia ($\Delta V_{${K}} = ${raw(sol.deltas[K - 1], 4)} < \varepsilon$), así que el algoritmo se detiene. En un MDP determinista como éste, la iteración de valores termina exactamente en $d_{\max} + 1$ barridos.

${deltaTable()}

${fig("fig_convergencia.png", L`Convergencia: $\Delta V_k$ en escala logarítmica frente al umbral $\varepsilon = 10^{-4}$. La recta corresponde a $100\,\gamma^{k-1}$ y en $k = ${K}$ el cambio es 0.`, "fig:convergencia", "0.65\\textwidth")}

\subsection{Paso 6: valores óptimos y política óptima}
Con $V_*$ convergido, la política óptima elige en cada estado la acción que alcanza el máximo. Ninguna flecha apunta a un peligro ni a la frontera: entrar a un pozo o con un Wumpus ($-100$) o chocar ($-2$ sin avanzar) siempre es peor que dar un paso de $-1$.

${vStarTable}

${policyTable}

${fig("fig_vstar.png", L`$V_*$ (número y color) y $\pi_*$ (flechas). Resaltada, la trayectoria del agente desde la entrada hasta el oro.`, "fig:vstar", "0.62\\textwidth")}

\subsection{Paso 7: verificación del punto fijo}
Si se sustituye $V_*$ en el lado derecho de la ecuación en la entrada, el máximo debe devolver exactamente $V_*(S_{0,0})$:
${backupTable(w.startCheck, "V_*", L`Ecuación de optimalidad evaluada con $V_*$ en $S_{0,0}$.`, "tab:verificacion")}
El máximo es $${raw(Math.max(...w.startCheck.map((b) => b.q)), 4)} = V_*(S_{0,0})$, con empate entre Norte y Este. En los ${w.nonTerminal} estados no terminales, el residual máximo $\max_s |V_*(s) - \max_a Q_*(s,a)|$ es $${raw(w.bellmanResidual, 0)}$: $V_*$ es punto fijo de la ecuación de optimalidad.

\subsection{Paso 8: trayectoria óptima}
Siguiendo $\pi_*$ desde $S_{0,0}$, el agente llega al oro en ${w.path.length} pasos, la ruta segura más corta posible:

${pathTable()}

\begin{equation}
G_0 = \sum_{t=0}^{${w.path.length - 1}} \gamma^t r_{t+1} = ${w.path
  .slice(0, 3)
  .map((s) => `${raw(s.discount, 3)}(${raw(s.reward, 0)})`)
  .join(" + ")} + \cdots + ${raw(w.path.at(-1)!.discount, 4)}(${raw(w.path.at(-1)!.reward, 0)}) = ${raw(w.path.at(-1)!.cumulative, 4)} = V_*(S_{0,0}).
\end{equation}
La ganancia descontada de la trayectoria coincide con el valor calculado por Bellman, como dicta la definición $V(s) = \mathbb{E}[G_t \mid S_t = s]$. La última columna muestra que $V_*(s_t)$ crece conforme el agente se acerca al oro: es lo que le falta por cobrar desde ese estado.

\subsection{Paso 9: interpretación con una fórmula cerrada}
Como el MDP es determinista y cada paso cuesta lo mismo, el valor óptimo de un estado sólo depende de $d(s)$, el número de pasos de su ruta segura más corta al oro: paga $-1$ durante $d-1$ pasos y cobra $+100$ en el paso $d$:
\begin{equation}
V_*(s) = \sum_{t=0}^{d-2} \gamma^t (-1) + \gamma^{d-1}(100) = -\frac{1-\gamma^{d-1}}{1-\gamma} + 100\,\gamma^{d-1} = -10 + 110\,(0.9)^{d-1}.
\end{equation}
La expresión decrece con $d$, así que maximizar $V_*$ es exactamente tomar la ruta segura más corta. Para la entrada, $d = ${dStart}$ y $V_*(S_{0,0}) = -10 + 110\,(0.9)^{${dStart - 1}} = ${raw(closedFormValue(P, dStart), 4)}$. La diferencia máxima entre la fórmula y la iteración de valores en todo el mapa es del orden de $10^{${Math.floor(Math.log10(Math.max(w.closedForm!.maxError, 1e-16)))}}$ (error de redondeo).

${closedTable()}

% ------------------------------------------------------------
\section{Resultados en los cinco escenarios}

${scenarioTable}

${fig("fig_niveles.png", L`Valores y política óptima de los cinco niveles. Las flechas forman \emph{ríos} que fluyen hacia el oro rodeando los peligros.`, "fig:niveles", "\\textwidth")}

En todos los escenarios la iteración converge exactamente en $d_{\max}+1$ iteraciones, el residual de Bellman es 0 y la política óptima toma la ruta segura más corta. En los niveles 4 y 5 la ruta es tan larga ($d \ge 24$) que $V_*(S_{0,0})$ es negativo: el costo del camino supera al oro descontado. Aun así ir al oro sigue siendo óptimo, porque las alternativas son peores: vagar para siempre vale $\frac{-1}{1-\gamma} = -10$ y caer en un peligro, $-100$.

% ------------------------------------------------------------
\section{Análisis de sensibilidad}

El juego permite cambiar $\gamma$, $\varepsilon$ y agregar un \emph{resbalón}: con probabilidad $p$ el agente se mueve a una dirección perpendicular a la elegida ($p/2$ a cada lado), lo que vuelve estocástico al MDP. La tabla~\ref{tab:sensibilidad} resume el efecto en el nivel 1.

${sensTable}

\begin{itemize}[leftmargin=*]
  \item \textbf{Descuento.} Con $\gamma = 0.99$ el agente valora mucho el futuro y $V_*(S_{0,0})$ sube a $${raw(g099.v0, 2)}$; con $\gamma = 0.5$ el oro lejano casi no pesa y $V_*(S_{0,0}) = ${raw(g05.v0, 2)}$, prácticamente el valor de vagar ($-1/(1-0.5) = -2$). La ruta óptima sigue siendo la misma.
  \item \textbf{Umbral $\varepsilon$.} En el caso determinista no cambia el resultado: la iteración llega a $\Delta V = 0$ en $K = ${K}$.
  \item \textbf{Resbalón.} Con $p = 0.1$ la política cambia en ${slip1.changed} estados y llega al oro en el ${raw(slip1.win, 1)}\% de los episodios. Con $p = 0.2$ caminar entre tantos peligros es tan riesgoso que la política óptima prefiere quedarse en zonas seguras ($V_*(S_{0,0}) = ${raw(slip2.v0, 2)}$). Si en ese mundo se usara la política determinista, el agente llegaría al oro sólo el ${raw(naiveUnderSlip.win, 1)}\% de las veces y su ganancia media sería ${m(naiveUnderSlip.meanG, 2)}, mucho peor que ${m(slip2.meanG, 2)}. Además, la convergencia deja de ser exacta y $K$ depende de $\varepsilon$.
\end{itemize}

${fig("fig_resbalon.png", L`Política óptima con resbalón $p = 0.2$: cerca de la entrada el agente evita la zona de peligros.`, "fig:resbalon", "0.55\\textwidth")}

% ------------------------------------------------------------
\section{Guía de juego paso a paso para estudiantes}

Esta guía está pensada para cualquier estudiante que quiera entender la Ecuación de Optimalidad de Bellman jugando. Sólo se necesita un navegador: \juego.

\subsection{Las reglas del mundo}
\begin{itemize}[leftmargin=*]
  \item Eres un integrante de la banda y empiezas en el amplificador, $S_{0,0}$ (esquina inferior izquierda). La meta es la púa de oro en $S_{9,9}$ (esquina superior derecha).
  \item Cada celda es un estado $S_{x,y}$ y las acciones son Norte, Sur, Este y Oeste.
  \item Cada paso a una celda vacía cuesta $-1$; chocar con el borde cuesta $-2$ y no te mueves; caer en un pozo o toparte con un Wumpus vale $-100$ y termina el juego; llegar al oro vale $+100$.
  \item Con $\gamma = 0.9$, una recompensa que llega dentro de $t$ pasos vale $\gamma^t$ veces su valor: el oro \emph{vale menos} mientras más tardes en llegar.
\end{itemize}

\subsection{Juega tú primero (pestaña \emph{Jugar})}
\begin{enumerate}[leftmargin=*]
  \item Elige un disco en la parte superior; empieza por \emph{Kill 'Em All} (nivel 1).
  \item Elige a tu integrante y muévete con las flechas, con W-A-S-D o con el control en pantalla. La tecla R reinicia.
  \item Hay niebla: sólo ves las celdas que ya visitaste. Usa las percepciones para deducir dónde están los peligros: \textbf{hedor} = hay un Wumpus al lado, \textbf{viento} = hay un pozo al lado, \textbf{brillo} = el oro está al lado.
  \item Observa el marcador: $\Sigma r$ es la suma simple de recompensas y $G = \sum_t \gamma^t r_{t+1}$ es la ganancia descontada, la cantidad que el agente quiere maximizar.
  \item Al terminar compara tu $G$ con $V_*(S_{0,0})$. Si tu $G$ es menor es porque diste pasos de más o te arriesgaste.
  \item Activa \emph{Consejo de Bellman} para ver la flecha de $\pi_*$ en tu celda, o \emph{Revelar el mapa} para ver todos los peligros.
\end{enumerate}

${fig("fig_juego.png", L`Modo de juego: niebla de guerra, percepción de viento junto a un pozo, marcador con $G$ y $V_*$, y bitácora con cada $\gamma^t r$.`, "fig:juego", "0.95\\textwidth")}

\subsection{Mira cómo piensa Bellman (pestaña \emph{Bellman (IA)})}
\begin{enumerate}[leftmargin=*]
  \item Empiezas en $k = 0$: todos los valores valen $V_0 = 0$.
  \item Presiona el botón de siguiente iteración. En $k = 1$ sólo los vecinos del oro se vuelven dorados (valen 100) y el resto vale $-1$.
  \item Haz clic en $S_{9,8}$: el \emph{Inspector de Bellman} muestra $Q(S_{9,8},N) = 100 + 0.9\cdot 0 = 100$ y el máximo de las cuatro acciones.
  \item Avanza a $k = 2, 3, \ldots$: la zona dorada crece una celda por iteración ($89$, $79.1$, \ldots) y $\Delta V_k = 100, 90, 81, \ldots$
  \item Haz clic en $S_{0,0}$ y avanza: mientras el oro no llega su valor sólo acumula costo de vida ($-1$, $-1.9$, $-2.71$, \ldots) y en $k = d$ salta a su valor final.
  \item Presiona \emph{Iterar Bellman} para animar todo y observa la gráfica de convergencia: en la última iteración $\Delta V = 0 < \varepsilon$.
  \item Presiona \emph{Tocar $\pi_*$}: el agente sigue la política óptima y su $G$ coincide con $V_*(S_{0,0})$.
  \item Experimenta con $\gamma$ y con el resbalón en \emph{Parámetros del MDP} y explica qué cambia.
\end{enumerate}

\subsection{Lee la explicación (pestaña \emph{Explicación})}
Presenta, con los números del mapa elegido, el mismo desarrollo de la sección de resultados de este reporte: iteraciones desglosadas, onda de valor, convergencia, $V_*$, $\pi_*$, verificación y fórmula cerrada.

\subsection{Ejercicios sugeridos}
\begin{enumerate}[leftmargin=*]
  \item Calcula a mano $V_1$ y $V_2$ de una celda cualquiera y verifícalos con el inspector.
  \item Cuenta en el mapa los pasos $d$ de la entrada al oro, predice $V_*(S_{0,0}) = -10 + 110\,(0.9)^{d-1}$ y compáralo con el juego.
  \item En \emph{\ldots And Justice for All}, $V_*(S_{0,0})$ es negativo. ¿Por qué aun así conviene ir al oro?
  \item Con resbalón $0.2$, ¿qué celdas cambian de flecha y por qué?
\end{enumerate}

% ------------------------------------------------------------
\section{Conclusiones}
\begin{enumerate}[leftmargin=*]
  \item La iteración de valores aplica la Ecuación de Optimalidad de Bellman como regla de actualización y converge a $V_*$ en pocas decenas de iteraciones (${K} en el nivel 1) con el criterio $\Delta V < \varepsilon$.
  \item El valor del oro se propaga desde $S_{9,9}$ como una onda, una celda por iteración, descontado por $\gamma$ y penalizado por el costo de vida; por eso $\Delta V_k = 100\gamma^{k-1}$ y $K = d_{\max} + 1$.
  \item La política óptima evita los 25 estados terminales negativos y las fronteras, y lleva de $S_{0,0}$ al oro por la ruta segura más corta: $V_*(s) = -10 + 110\,(0.9)^{d(s)-1}$.
  \item $V_*$ es punto fijo de la ecuación (residual 0) y coincide con la ganancia descontada de la trayectoria óptima, $G_0 = V_*(S_{0,0}) = ${raw(sol.V[world.start], 4)}$.
  \item Cuando el ambiente es estocástico, la política óptima cambia: arriesgarse cerca de los peligros deja de valer la pena, lo que muestra que Bellman optimiza el valor \emph{esperado} y no sólo la ruta más corta.
\end{enumerate}

% ------------------------------------------------------------
\begin{thebibliography}{9}
\bibitem{sutton} R.~S. Sutton y A.~G. Barto, \emph{Reinforcement Learning: An Introduction}, 2.ª ed. Cambridge, MA: MIT Press, 2018.
\bibitem{bellman} R.~Bellman, \emph{Dynamic Programming}. Princeton, NJ: Princeton University Press, 1957.
\bibitem{russell} S.~Russell y P.~Norvig, \emph{Artificial Intelligence: A Modern Approach}, 4.ª ed. Pearson, 2021.
\bibitem{clase} A.~López González y J.~Caballero Mora, \emph{Aprendizaje reforzado: Definiciones MDPs}, Universidad Iberoamericana, notas del curso.
\end{thebibliography}

\end{document}
`;

const out = fileURLToPath(new URL("../reporte/reporte.tex", import.meta.url));
mkdirSync(fileURLToPath(new URL("../reporte/", import.meta.url)), { recursive: true });
writeFileSync(out, doc);
console.log(`Escrito ${out}`);
