import { ACTION_ARROW, ACTION_LETTER, ACTION_NAME, type MdpParams } from "../core/types";
import type { ActionBackup } from "../core/valueIteration";
import { Tex } from "./Tex";
import { fmt, StateName, stateTex, tex } from "./ui";

interface Props {
  s: number;
  backups: ActionBackup[];
  params: MdpParams;
  /** Etiqueta de la función de valor usada a la derecha (p. ej. "V_0", "V_{k-1}", "V^*"). */
  vRight: string;
  /** Etiqueta del resultado (p. ej. "V_1", "V^*"). */
  vLeft: string;
}

/** Desglose del lado derecho de la Ecuación de Optimalidad de Bellman para un estado. */
export function BackupTable({ s, backups, params, vRight, vLeft }: Props) {
  const best = Math.max(...backups.map((b) => b.q));
  const stochastic = backups.some((b) => b.terms.length > 1);
  const g = params.gamma;
  const qTex = (b: ActionBackup) =>
    b.terms
      .map((t) =>
        stochastic
          ? `${tex(t.prob)}\\,[${tex(t.reward, 0)} + ${g}\\cdot(${tex(t.vNext)})]`
          : `${tex(t.reward, 0)} + ${g}\\cdot(${tex(t.vNext)})`,
      )
      .join(" + ");

  return (
    <div className="backup">
      <table className="backup-table">
        <thead>
          <tr>
            <th>a</th>
            {stochastic && <th>P</th>}
            <th>s′</th>
            <th>r</th>
            <th>
              <Tex math={`${vRight}(s')`} />
            </th>
            <th>
              <Tex math={`r + \\gamma ${vRight}(s')`} />
            </th>
            <th>
              <Tex math="Q(s,a)" />
            </th>
          </tr>
        </thead>
        <tbody>
          {backups.map((b) =>
            b.terms.map((t, i) => (
              <tr key={`${b.action}-${i}`} className={b.q >= best - 1e-9 ? "best" : ""}>
                {i === 0 && (
                  <td rowSpan={b.terms.length} className="act">
                    {ACTION_ARROW[b.action]} {ACTION_NAME[b.action]}
                  </td>
                )}
                {stochastic && <td>{fmt(t.prob, 2)}</td>}
                <td>
                  <StateName s={t.next} />
                  {t.bump && <span className="tag">borde</span>}
                </td>
                <td>{fmt(t.reward, 0)}</td>
                <td>{fmt(t.vNext)}</td>
                <td>{fmt(t.target)}</td>
                {i === 0 && (
                  <td rowSpan={b.terms.length} className="q">
                    {fmt(b.q)}
                  </td>
                )}
              </tr>
            )),
          )}
        </tbody>
      </table>
      <Tex
        block
        math={`\\begin{aligned}${backups
          .map((b) => `Q(${stateTex(s)}, ${ACTION_LETTER[b.action]}) &= ${qTex(b)} = ${tex(b.q)}`)
          .join(" \\\\ ")} \\\\[4pt] ${vLeft}(${stateTex(s)}) &= \\max_a Q = \\max\\{${backups.map((b) => tex(b.q)).join(",\\ ")}\\} = \\mathbf{${tex(best)}}\\end{aligned}`}
      />
    </div>
  );
}
