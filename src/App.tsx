import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ALBUMS, albumById, type Album, type MemberId } from "./albums";
import { isMuted, setMuted } from "./audio/sfx";
import { PlayView } from "./components/PlayView";
import { fmt, Sprite } from "./components/ui";
import { randomSeed } from "./core/rng";
import { PRACTICE, type MdpParams } from "./core/types";
import { valueIteration } from "./core/valueIteration";
import { distancesToGold, generateWorld } from "./core/world";
import { HAZARD_SPRITES, MEMBER_SPRITES } from "./sprites/library";

// Las vistas con fórmulas (KaTeX) se cargan bajo demanda.
const BellmanView = lazy(() => import("./components/BellmanView").then((m) => ({ default: m.BellmanView })));
const ExplanationView = lazy(() => import("./components/ExplanationView").then((m) => ({ default: m.ExplanationView })));

type Tab = "jugar" | "bellman" | "explicacion";

const TABS: { id: Tab; label: string; sub: string }[] = [
  { id: "jugar", label: "Jugar", sub: "con niebla y percepciones" },
  { id: "bellman", label: "Bellman (IA)", sub: "iteración de valores" },
  { id: "explicacion", label: "Explicación", sub: "resultados paso a paso" },
];

function readUrl() {
  const q = new URLSearchParams(window.location.search);
  const seed = Number(q.get("semilla"));
  const tab = q.get("vista");
  return {
    album: albumById(q.get("disco")).id,
    seed: q.get("semilla") !== null && Number.isInteger(seed) && seed >= 0 ? seed : null,
    tab: (TABS.some((t) => t.id === tab) ? tab : "jugar") as Tab,
  };
}

const themeStyle = (album: Album) =>
  Object.fromEntries(Object.entries(album.theme).map(([k, v]) => [`--${k}`, v])) as CSSProperties;

/** Al cambiar de disco, el bajista cambia de época (Cliff ↔ Jason). */
function memberFor(album: Album, wanted: MemberId): MemberId {
  if (album.lineup.includes(wanted)) return wanted;
  if (wanted === "cliff" && album.lineup.includes("jason")) return "jason";
  if (wanted === "jason" && album.lineup.includes("cliff")) return "cliff";
  return album.lineup[0];
}

export function App() {
  const initial = useMemo(readUrl, []);
  const [albumId, setAlbumId] = useState(initial.album);
  const [customSeed, setCustomSeed] = useState<number | null>(initial.seed);
  const [tab, setTab] = useState<Tab>(initial.tab);
  const [params, setParams] = useState<MdpParams>(PRACTICE);
  const [wantedMember, setWantedMember] = useState<MemberId>("james");
  const [muted, setMutedState] = useState(isMuted);

  const album = albumById(albumId);
  const member = memberFor(album, wantedMember);
  const seed = customSeed ?? album.seed;
  const world = useMemo(() => generateWorld(seed), [seed]);
  const solution = useMemo(() => valueIteration(world, params), [world, params]);
  const routeLength = useMemo(() => Object.fromEntries(ALBUMS.map((a) => [a.id, distancesToGold(generateWorld(a.seed))[0]])), []);

  useEffect(() => {
    const q = new URLSearchParams({ disco: album.id, vista: tab });
    if (customSeed !== null) q.set("semilla", String(customSeed));
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", album.theme.bg);
  }, [album, customSeed, tab]);

  const pickAlbum = (a: Album) => {
    setAlbumId(a.id);
    setCustomSeed(null);
  };

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  const viewKey = `${album.id}:${seed}:${JSON.stringify(params)}`;

  return (
    <div className="app" style={themeStyle(album)} data-album={album.id}>
      <header className="masthead">
        <div className="brand">
          <h1>
            Seek <span className="amp">&amp;</span> Bellman
          </h1>
          <p>El Mundo del Wumpus · Ecuación de Optimalidad de Bellman · gira por 5 discos</p>
        </div>
        <button className="btn btn-ghost mute" onClick={toggleMute} aria-pressed={!muted}>
          {muted ? "🔇 Sonido apagado" : "🔊 Sonido"}
        </button>
      </header>

      <nav className="albums" aria-label="Discos">
        {ALBUMS.map((a, i) => (
          <button
            key={a.id}
            className={`album ${a.id === album.id ? "active" : ""}`}
            onClick={() => pickAlbum(a)}
            style={themeStyle(a)}
          >
            <span className="album-art">
              <Sprite def={HAZARD_SPRITES[a.wumpus.sprite]} />
            </span>
            <span className="album-text">
              <span className="album-title">{a.title}</span>
              <span className="album-meta">
                {a.year} · Nivel {i + 1} · ruta de {routeLength[a.id]} pasos
              </span>
            </span>
          </button>
        ))}
      </nav>

      <section className="album-banner">
        <div className="banner-cast">
          <Sprite def={MEMBER_SPRITES[member]} className="banner-sprite" />
          <Sprite def={HAZARD_SPRITES[album.wumpus.sprite]} className="banner-sprite" />
          <Sprite def={HAZARD_SPRITES[album.pit.sprite]} className="banner-sprite" />
        </div>
        <div className="banner-text">
          <h2>
            {album.title} <span className="year">({album.year})</span>
          </h2>
          <p>{album.tagline}</p>
          <p className="setlist">Setlist: {album.tracks.join(" · ")}</p>
        </div>
        <div className="map-controls">
          <span className="seed">
            Mapa: semilla <b>{seed}</b>
            {customSeed !== null ? " (aleatoria)" : " (del disco)"} · V*(S<sub>0,0</sub>) = {fmt(solution.V[world.start])}
          </span>
          <div className="row">
            <button className="btn btn-ghost" onClick={() => setCustomSeed(randomSeed())}>
              🎲 Mapa aleatorio
            </button>
            {customSeed !== null && (
              <button className="btn btn-ghost" onClick={() => setCustomSeed(null)}>
                Mapa del disco
              </button>
            )}
          </div>
        </div>
      </section>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            <span>{t.label}</span>
            <small>{t.sub}</small>
          </button>
        ))}
      </nav>

      <main>
        <Suspense fallback={<p className="panel muted">Afinando las guitarras…</p>}>
        {tab === "jugar" && (
          <PlayView
            key={viewKey}
            world={world}
            album={album}
            params={params}
            solution={solution}
            member={member}
            onMember={setWantedMember}
            onBellman={() => setTab("bellman")}
          />
        )}
        {tab === "bellman" && (
          <BellmanView key={viewKey} world={world} album={album} params={params} onParams={setParams} solution={solution} member={member} />
        )}
        {tab === "explicacion" && <ExplanationView world={world} album={album} params={params} />}
        </Suspense>
      </main>

      <footer className="footer">
        <p>
          Práctica de Aprendizaje Reforzado (MDPs y Ecuaciones de Bellman) · Universidad Iberoamericana. Proyecto académico hecho por
          fans, sin afiliación con Metallica: los sprites son pixel-art original y sólo se mencionan títulos de discos y canciones.
        </p>
      </footer>
    </div>
  );
}
