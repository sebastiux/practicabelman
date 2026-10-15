/** Sprite pixel-art: cada carácter es un píxel; '.' es transparente y el resto se busca en la paleta. */
export interface SpriteDef {
  palette: Record<string, string>;
  rows: string[];
}

/** Convierte un bloque de texto (una fila por línea) en filas de píxeles. */
export const grid = (text: string) =>
  text
    .trim()
    .split("\n")
    .map((row) => row.trim());

/** Superpone `top` sobre `base`: los píxeles '.' de `top` dejan ver la base. */
export function overlay(base: string[], top: string[]): string[] {
  return base.map((row, y) =>
    [...row].map((ch, x) => (top[y]?.[x] && top[y][x] !== "." ? top[y][x] : ch)).join(""),
  );
}

/** Refleja horizontalmente un sprite (para que el agente mire hacia donde camina). */
export const mirror = (rows: string[]) => rows.map((r) => [...r].reverse().join(""));

/** SVG con un <rect> por cada racha horizontal de píxeles del mismo color. */
export function spriteToSvg({ palette, rows }: SpriteDef): string {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  let rects = "";
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== ".") {
        const fill = palette[ch];
        if (!fill) throw new Error(`Color '${ch}' sin definir en la paleta`);
        rects += `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${fill}"/>`;
      }
      x = end;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`;
}

const cache = new Map<SpriteDef, string>();

export function spriteUri(def: SpriteDef): string {
  let uri = cache.get(def);
  if (!uri) {
    uri = `data:image/svg+xml;utf8,${encodeURIComponent(spriteToSvg(def))}`;
    cache.set(def, uri);
  }
  return uri;
}
