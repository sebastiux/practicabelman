import { useMemo, useState, type ReactNode } from "react";
import type { Album } from "../albums";
import { buildWalkthrough, closedFormValue, type WorkedExample } from "../core/explain";
import { ACTION_ARROW, ACTION_NAME, type MdpParams, type World } from "../core/types";
import { greedyPolicy } from "../core/valueIteration";
import { neighbors } from "../core/world";
import { BackupTable } from "./BackupTable";
import { Board } from "./Board";
import { DeltaChart } from "./DeltaChart";
import { Tex } from "./Tex";
import { fmt, StateName, stateTex, tex } from "./ui";

/** Entero si lo es (−10, 110), si no con dos decimales. */
const num = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : tex(v));

interface Props {
  world: World;
  album: Album;
  params: MdpParams;
}

function Example({ ex, params, children }: { ex: WorkedExample; params: MdpParams; children: ReactNode }) {
  return (
    <div className="example">
      <h4>
        <StateName s={ex.s} /> en la iteración k = {ex.k}
      </h4>
      <p>{children}</p>
      <BackupTable s={ex.s} backups={ex.backups} params={params} vRight={`V_{${ex.k - 1}}`} vLeft={`V_{${ex.k}}`} />
    </div>
  );
}

export function ExplanationView({ world, album, params }: Props) {
  const w = useMemo(() => buildWalkthrough(world, params), [world, params]);
  const [allDeltas, setAllDeltas] = useState(false);
  const { sol } = w;
  const K = sol.iterations;
  const g = params.gamma;
  const dStart = w.dist[world.start];
  const vStart = sol.V[world.start];
  const pathSet = useMemo(() => new Set(w.path.map((s) => s.next)), [w]);
  // Flechas sólo donde el oro ya "llegó" (d(s) ≤ k); en el resto todas las acciones empatan.
  const arrowsAt = (k: number) => {
    const ties = greedyPolicy(world, params, sol.history[k]).ties;
    return ties.map((t, s) => (w.dist[s] > 0 && w.dist[s] <= k ? t : null));
  };
  const wander = params.stepReward / (1 - g);
  const goldBonus = params.goldReward - wander;
  const firstNegative = useMemo(() => {
    for (let d = 1; d <= 200; d++) if (closedFormValue(params, d) < 0) return d;
    return null;
  }, [params]);
  const [goldNb, hazardNb, startEx] = w.iteration1;
  const [twoAway, startEx2] = w.iteration2;

  return (
    <article className="explain">
      <header className="panel explain-intro">
        <h2>Resultados de la práctica, paso a paso</h2>
        <p>
          Ejercicio: implementar la <b>Ecuación de Optimalidad de Bellman (V*)</b> para encontrar la política óptima de navegación en
          un Mundo del Wumpus de 10 × 10. Todo lo que sigue se calcula en vivo sobre el mapa de <b>{album.title}</b> (semilla{" "}
          {world.seed}) con los parámetros actuales{w.deterministic && params.gamma === 0.9 ? ", que son los de la práctica" : ""}.
        </p>
      </header>

      <section className="panel">
        <h3>0 · Definición del MDP</h3>
        <div className="two-col">
          <div>
            <ul className="facts">
              <li>
                <b>Estados S</b>: 100 celdas, de <StateName s={0} /> (entrada, abajo a la izquierda) a <StateName s={99} /> (oro,
                arriba a la derecha). <StateName s={0} /> tiene x = columna, y = fila.
              </li>
              <li>
                <b>Acciones A</b>: Norte ↑, Sur ↓, Este →, Oeste ← (un paso Manhattan).
              </li>
              <li>
                <b>Peligros</b>: {w.pits} {album.pit.plural} (pozos) y {w.wumpus} × {album.wumpus.name} (Wumpus),
                distribuidos al azar con la semilla; r = {fmt(params.hazardReward, 0)} y el episodio termina.
              </li>
              <li>
                <b>Meta</b>: la púa de oro en <StateName s={world.gold} />, r = +{params.goldReward}, terminal.
              </li>
              <li>
                <b>Costo de vida</b>: r = {fmt(params.stepReward, 0)} por moverse a una celda vacía.
              </li>
              <li>
                <b>Fronteras</b>: si la acción saca al agente de la red, permanece en s con r = {fmt(params.wallReward, 0)}.
              </li>
              <li>
                <b>Descuento</b> γ = {g} y <b>convergencia</b> cuando ΔV &lt; ε = {params.epsilon}.
              </li>
              <li>
                {w.deterministic ? (
                  <>
                    <b>Transiciones deterministas</b>: P(s′, r | s, a) = 1 para el único s′ al que lleva a.
                  </>
                ) : (
                  <>
                    <b>Transiciones con resbalón</b>: la acción elegida ocurre con probabilidad {fmt(1 - params.slip)} y cada
                    perpendicular con {fmt(params.slip / 2)}.
                  </>
                )}
              </li>
            </ul>
            <p>
              Quedan <b>{w.nonTerminal}</b> estados no terminales (100 − {w.pits} − {w.wumpus} − 1 oro) cuyo valor hay que
              calcular; los terminales valen 0 porque desde ellos ya no se acumula recompensa.
            </p>
          </div>
          <Board world={world} album={album} variant="mini" caption={`Mapa de ${album.title}`} />
        </div>
      </section>

      <section className="panel">
        <h3>1 · La ecuación y cómo se vuelve algoritmo</h3>
        <p>La Ecuación de Optimalidad de Bellman dice que el valor óptimo de un estado es lo mejor que puedo obtener tomando la mejor acción ahora y actuando óptimamente después:</p>
        <Tex block math={"V_*(s) = \\max_a \\sum_{s',r} P(s',r \\mid s,a)\\,\\big[r + \\gamma V_*(s')\\big]"} />
        {w.deterministic && (
          <>
            <p>
              Como en la práctica cada acción lleva a un único s′ con una única recompensa r, la suma sobre s′, r desaparece (igual
              que en la simplificación de V<sub>π</sub> de la clase):
            </p>
            <Tex block math={`V_*(s) = \\max_{a \\in \\{N,S,E,O\\}} \\big[\\, r(s,a) + ${g}\\, V_*(s') \\,\\big]`} />
          </>
        )}
        <p>
          V* aparece en ambos lados, así que no se puede despejar directamente para 74+ incógnitas con un máximo de por medio. La{" "}
          <b>iteración de valores</b> convierte la ecuación en una regla de actualización y la aplica a todos los estados a la vez
          (barrido síncrono), partiendo de V<sub>0</sub> = 0:
        </p>
        <Tex
          block
          math={"V_{k+1}(s) = \\max_a \\sum_{s',r} P(s',r\\mid s,a)\\big[r + \\gamma V_k(s')\\big], \\qquad \\Delta V_{k+1} = \\max_s \\big|V_{k+1}(s) - V_k(s)\\big|"}
        />
        <pre className="code">{`V ← 0 para todos los estados
repetir
    V' ← V
    para cada estado no terminal s:
        V'(s) ← max_a Σ P(s',r|s,a)·[r + γ·V(s')]
    Δ ← max_s |V'(s) − V(s)|
    V ← V'
hasta que Δ < ε
π*(s) ← argmax_a Σ P(s',r|s,a)·[r + γ·V(s')]`}</pre>
        <p className="muted small">
          Implementación: <code>src/core/valueIteration.ts</code> (funciones <code>backup</code>, <code>bellmanSweep</code> y{" "}
          <code>valueIteration</code>).
        </p>
      </section>

      <section className="panel">
        <h3>2 · Iteración 1: sólo cuentan las recompensas inmediatas</h3>
        <p>
          Con V<sub>0</sub>(s′) = 0, el término γ·V<sub>0</sub>(s′) vale 0 y cada estado se queda con la mejor recompensa de un
          solo paso.
        </p>
        {goldNb && (
          <Example ex={goldNb} params={params}>
            Vecino del oro: moverse hacia <StateName s={world.gold} /> da {params.goldReward} + {g}·0 = {params.goldReward}. Es el
            máximo, así que V<sub>1</sub> = {fmt(goldNb.value)}.
          </Example>
        )}
        {hazardNb && (
          <Example ex={hazardNb} params={params}>
            Junto a un peligro: la acción que entra en un peligro ({album.pit.name.toLowerCase()} o {album.wumpus.name}) vale{" "}
            {fmt(params.hazardReward, 0)}; chocar con el borde {fmt(params.wallReward, 0)}; moverse a una celda vacía {fmt(params.stepReward, 0)}. Gana
            moverse: V<sub>1</sub> = {fmt(hazardNb.value)}. Todavía no "sabe" nada del oro.
          </Example>
        )}
        {startEx && (
          <Example ex={startEx} params={params}>
            La entrada es una esquina: Sur y Oeste chocan con la frontera ({fmt(params.wallReward, 0)}); Norte y Este cuestan{" "}
            {fmt(params.stepReward, 0)}. V<sub>1</sub>(<StateName s={world.start} />) = {fmt(startEx.value)}.
          </Example>
        )}
        <Board
          world={world}
          album={album}
          variant="mini"
          values={sol.history[1]}
          showValues
          showHeat
          arrows={arrowsAt(1)}
          caption="V₁: sólo los vecinos del oro tienen valor positivo; los demás valen el costo de un paso."
        />
      </section>

      {w.iteration2.length > 0 && (
        <section className="panel">
          <h3>3 · Iteración 2: el oro se propaga una celda más</h3>
          {twoAway && (
            <Example ex={twoAway} params={params}>
              A dos pasos del oro: su vecino ya vale V<sub>1</sub> = {fmt(params.goldReward)}, así que moverse hacia él vale{" "}
              {fmt(params.stepReward, 0)} + {g}·{params.goldReward} = {fmt(twoAway.value)}.
            </Example>
          )}
          {startEx2 && (
            <Example ex={startEx2} params={params}>
              La entrada sigue lejos: lo mejor es pagar otro paso, {fmt(params.stepReward, 0)} + {g}·({fmt(sol.history[1][world.start])}) ={" "}
              {fmt(startEx2.value)}.
            </Example>
          )}
          <Board
            world={world}
            album={album}
            variant="mini"
            values={sol.history[2]}
            showValues
            showHeat
            arrows={arrowsAt(2)}
            caption="V₂: la zona dorada creció un paso alrededor del oro."
          />
        </section>
      )}

      <section className="panel">
        <h3>4 · La onda de valor</h3>
        <p>
          En cada barrido, la información del oro avanza exactamente una celda: tras k iteraciones la "conocen" los estados que
          están a k pasos o menos (por caminos seguros). Los demás siguen acumulando costo de vida y tienden a{" "}
          r<sub>vida</sub>/(1−γ) = {fmt(wander)}.
        </p>
        <div className="snapshots">
          {w.snapshots
            .filter((k) => k > 0)
            .map((k) => (
              <Board
                key={k}
                world={world}
                album={album}
                variant="mini"
                values={sol.history[k]}
                showHeat
                arrows={arrowsAt(k)}
                caption={
                  <>
                    k = {k} · {w.informed[k]} estados informados{k === dStart ? " · llega a la entrada" : ""}
                    {k === K ? " · convergido" : ""}
                  </>
                }
              />
            ))}
        </div>
        {w.deterministic && w.pockets.length === 0 && (
          <p>
            Por eso el cambio máximo de cada barrido sigue la ley ΔV<sub>k</sub> = {params.goldReward}·γ
            <sup>k−1</sup>: el estado recién alcanzado a distancia k pasa de valer −(1−γ<sup>k−1</sup>)/(1−γ) (vagar) a
            −(1−γ<sup>k−1</sup>)/(1−γ) + {params.goldReward}·γ<sup>k−1</sup> (ir al oro); la diferencia es exactamente{" "}
            {params.goldReward}·γ<sup>k−1</sup>. En este mapa: ΔV<sub>1</sub> = {fmt(sol.deltas[0])}, ΔV<sub>2</sub> ={" "}
            {fmt(sol.deltas[1])}, ΔV<sub>3</sub> = {fmt(sol.deltas[2])}…
          </p>
        )}
      </section>

      {w.startLearns && (
        <section className="panel">
          <h3>5 · La entrada se entera del oro (k = {w.startLearns.k})</h3>
          <Example ex={w.startLearns} params={params}>
            La ruta segura más corta de <StateName s={world.start} /> al oro tiene d = {dStart} pasos, así que hasta la iteración{" "}
            {dStart - 1} su mejor plan era vagar (V<sub>{dStart - 1}</sub> = {fmt(sol.history[dStart - 1][world.start])}). En la
            iteración {dStart} su vecino sobre la ruta ya trae el valor del oro y V<sub>{dStart}</sub>(<StateName s={world.start} />)
            salta a {fmt(w.startLearns.value)}. Ese ya es su valor definitivo.
          </Example>
        </section>
      )}

      <section className="panel">
        <h3>6 · Convergencia: ΔV &lt; ε</h3>
        <DeltaChart deltas={sol.deltas} epsilon={params.epsilon} />
        <p>
          {sol.converged ? (
            <>
              El algoritmo se detuvo en la iteración <b>K = {K}</b>, con ΔV<sub>{K}</sub> = {fmt(sol.deltas[K - 1], 6)} &lt; ε ={" "}
              {params.epsilon}.{" "}
            </>
          ) : (
            <>No convergió dentro del tope de iteraciones. </>
          )}
          {w.deterministic && w.pockets.length === 0 && (
            <>
              El estado más lejano del oro está a d<sub>max</sub> = {w.maxDist} pasos: en la iteración {w.maxDist} recibe el valor
              del oro y en la {w.maxDist + 1} ya nada cambia (ΔV = 0). En un MDP determinista sin ciclos útiles, la iteración de
              valores termina de forma exacta en d<sub>max</sub> + 1 barridos.
            </>
          )}
          {w.pockets.length > 0 && (
            <>
              Hay {w.pockets.length} estado(s) encerrados sin camino seguro al oro (
              {w.pockets.map((s, i) => (
                <span key={s}>
                  {i > 0 && ", "}
                  <StateName s={s} />
                </span>
              ))}
              ). Su valor converge sólo asintóticamente a {fmt(wander)} (vagar para siempre es mejor que morir), con ΔV que se
              reduce en un factor γ cada barrido: por eso K depende de ε.
            </>
          )}
        </p>
        <button className="btn btn-ghost" onClick={() => setAllDeltas(!allDeltas)}>
          {allDeltas ? "Ocultar" : "Ver"} la tabla de ΔV<sub>k</sub>
        </button>
        {allDeltas && (
          <table className="data-table compact">
            <thead>
              <tr>
                <th>k</th>
                <th>ΔV_k</th>
                <th>estados informados</th>
                <th>¿ΔV &lt; ε?</th>
              </tr>
            </thead>
            <tbody>
              {sol.deltas.map((d, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{fmt(d, 4)}</td>
                  <td>{w.informed[i + 1]}</td>
                  <td>{d < params.epsilon ? "sí → parar" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h3>7 · Resultado: V* y la política óptima π*</h3>
        <p>
          Con V* convergido, la política óptima se obtiene eligiendo en cada estado la acción que alcanza el máximo de la ecuación:{" "}
          <Tex math={"\\pi_*(s) = \\arg\\max_a \\sum_{s',r} P(s',r\\mid s,a)[r + \\gamma V_*(s')]"} />. Las flechas pequeñas indican
          empates (varias acciones igual de buenas).
        </p>
        <Board
          world={world}
          album={album}
          values={sol.V}
          showValues
          showHeat
          arrows={sol.ties}
          highlight={pathSet}
          caption="V* (número y color) y π* (flechas). Resaltada: la trayectoria desde la entrada."
        />
        <p>
          <b>V*(<StateName s={world.start} />) = {fmt(vStart)}</b>. El valor máximo lo tienen los vecinos del oro (
          {fmt(Math.max(...neighbors(world.gold).map((s) => sol.V[s])))}) y decrece con la distancia. Ninguna flecha apunta a un
          peligro ni hacia el borde: entrar a un pozo o con un Wumpus ({fmt(params.hazardReward, 0)}) o chocar ({fmt(params.wallReward, 0)} sin
          avanzar) siempre es peor que dar un paso de {fmt(params.stepReward, 0)}.
        </p>
      </section>

      <section className="panel">
        <h3>8 · Verificación: V* es punto fijo de Bellman</h3>
        <p>
          Si sustituimos V* en el lado derecho de la ecuación en la entrada, el máximo debe devolver exactamente V*(
          <StateName s={world.start} />
          ):
        </p>
        <BackupTable s={world.start} backups={w.startCheck} params={params} vRight="V_*" vLeft="V_*" />
        <p>
          En los {w.nonTerminal} estados no terminales, el residual máximo |V*(s) − max<sub>a</sub> Q*(s,a)| es{" "}
          <b>{w.bellmanResidual.toExponential(2)}</b>: la ecuación de optimalidad se cumple.
        </p>
      </section>

      <section className="panel">
        <h3>9 · La trayectoria óptima desde la entrada</h3>
        <p>
          Siguiendo π* desde <StateName s={world.start} />, el agente llega al oro en {w.path.length} pasos
          {w.deterministic ? ` (la ruta segura más corta posible: d = ${dStart})` : " (una ejecución muestreada)"}. La ganancia
          descontada <Tex math={"G_0 = \\sum_t \\gamma^t r_{t+1}"} /> coincide con V*(<StateName s={world.start} />):
        </p>
        <div className="table-scroll">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>t</th>
                <th>
                  s<sub>t</sub>
                </th>
                <th>a</th>
                <th>
                  s<sub>t+1</sub>
                </th>
                <th>
                  r<sub>t+1</sub>
                </th>
                <th>
                  γ<sup>t</sup>
                </th>
                <th>
                  γ<sup>t</sup>r
                </th>
                <th>G acumulada</th>
                <th>
                  V*(s<sub>t</sub>)
                </th>
              </tr>
            </thead>
            <tbody>
              {w.path.map((st) => (
                <tr key={st.t}>
                  <td>{st.t}</td>
                  <td>
                    <StateName s={st.s} />
                  </td>
                  <td>
                    {ACTION_ARROW[st.action]} {ACTION_NAME[st.action]}
                  </td>
                  <td>
                    <StateName s={st.next} />
                  </td>
                  <td>{fmt(st.reward, 0)}</td>
                  <td>{fmt(st.discount, 4)}</td>
                  <td>{fmt(st.discounted, 4)}</td>
                  <td>{fmt(st.cumulative, 4)}</td>
                  <td>{fmt(sol.V[st.s], 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Tex
          block
          math={`G_0 = ${w.path
            .slice(0, 3)
            .map((s) => `${tex(s.discount, 3)}(${tex(s.reward, 0)})`)
            .join(" + ")} + \\cdots + ${tex(w.path.at(-1)?.discount ?? 0, 4)}(${tex(w.path.at(-1)?.reward ?? 0, 0)}) = ${tex(
            w.path.at(-1)?.cumulative ?? 0,
            4,
          )} = V_*(${stateTex(world.start)})`}
        />
        <p className="muted small">
          La última columna muestra que V*(s<sub>t</sub>) crece conforme el agente se acerca al oro: es la ganancia descontada que
          le falta por cobrar desde ese estado. En cada fila se cumple G acumulada + γ<sup>t+1</sup>·V*(s<sub>t+1</sub>) = V*(
          <StateName s={world.start} />
          ).
        </p>
      </section>

      {w.closedForm && (
        <section className="panel">
          <h3>10 · Interpretación: una fórmula cerrada para V*</h3>
          <p>
            Como el MDP es determinista y cada paso cuesta lo mismo, el valor óptimo de un estado sólo depende de d(s), el número de
            pasos de su ruta segura más corta al oro: paga {fmt(params.stepReward, 0)} durante d − 1 pasos y cobra +{params.goldReward} en el
            paso d.
          </p>
          <Tex
            block
            math={`V_*(s) = \\sum_{t=0}^{d-2} \\gamma^t (${params.stepReward}) + \\gamma^{d-1}(${params.goldReward}) = ${num(wander)} + ${num(goldBonus)}\\,\\gamma^{\\,d-1}`}
          />
          <p>
            La expresión decrece con d, así que maximizar V* es exactamente tomar la <b>ruta segura más corta</b>: eso es lo que
            hace π*. Comparando con lo calculado por iteración de valores, el error máximo es{" "}
            <b>{w.closedForm.maxError.toExponential(1)}</b>.
          </p>
          <div className="table-scroll">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>d (pasos al oro)</th>
                  {w.closedForm.rows.map((r) => (
                    <th key={r.d}>{r.d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>V*(d)</td>
                  {w.closedForm.rows.map((r) => (
                    <td key={r.d}>{fmt(r.value, 2)}</td>
                  ))}
                </tr>
                <tr>
                  <td># estados</td>
                  {w.closedForm.rows.map((r) => (
                    <td key={r.d}>{r.count}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="facts">
            {firstNegative && (
              <li>
                V* se vuelve negativo a partir de d = {firstNegative}: al agente le cuesta más el camino de lo que el oro descontado le
                devuelve. Aun así conviene ir, porque las alternativas son peores: vagar para siempre vale {fmt(wander)} y caer en un
                peligro {fmt(params.hazardReward, 0)}.
              </li>
            )}
            <li>
              La entrada está a d = {dStart} pasos → V*(<StateName s={world.start} />) = {fmt(wander)} + {fmt(goldBonus)}·
              {g}
              <sup>{dStart - 1}</sup> = {fmt(closedFormValue(params, dStart), 4)}.
            </li>
            <li>
              Con γ = {g} el oro "pesa" {params.goldReward}·γ<sup>d−1</sup>: a 10 pasos sólo vale{" "}
              {fmt(params.goldReward * g ** 9)} y a 20 pasos {fmt(params.goldReward * g ** 19)}. Un γ más cercano a 1 hace que el
              agente valore más el futuro (puedes probarlo en la pestaña Bellman).
            </li>
          </ul>
        </section>
      )}

      <section className="panel">
        <h3>Conclusiones</h3>
        <ul className="facts">
          <li>
            La iteración de valores aplica la Ecuación de Optimalidad de Bellman como regla de actualización y converge a V* en{" "}
            {K} iteraciones para este mapa (ΔV &lt; ε = {params.epsilon}).
          </li>
          <li>
            El valor del oro se propaga desde <StateName s={world.gold} /> como una onda, una celda por iteración, descontado por γ y
            penalizado por el costo de vida.
          </li>
          <li>
            La política óptima π* evita los {w.pits + w.wumpus} estados terminales negativos y las fronteras, y lleva de{" "}
            <StateName s={world.start} /> al oro por la ruta segura más corta ({dStart} pasos) con ganancia esperada V* ={" "}
            {fmt(vStart)}.
          </li>
          <li>
            V* es punto fijo de la ecuación (residual ≈ 0) y coincide con la suma descontada de recompensas de la trayectoria óptima.
          </li>
        </ul>
      </section>
    </article>
  );
}
