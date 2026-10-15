import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";

/** Fórmula LaTeX renderizada con KaTeX (contenido generado por la app, no por el usuario). */
export function Tex({ math, block = false }: { math: string; block?: boolean }) {
  const html = useMemo(() => katex.renderToString(math, { displayMode: block, throwOnError: false }), [math, block]);
  return block ? (
    <div className="tex-block" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}
