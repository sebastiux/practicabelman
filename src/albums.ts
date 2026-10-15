export type MemberId = "james" | "kirk" | "lars" | "cliff" | "jason";

export interface Member {
  id: MemberId;
  name: string;
  role: string;
}

export const MEMBERS: Record<MemberId, Member> = {
  james: { id: "james", name: "James", role: "Voz y guitarra rítmica" },
  kirk: { id: "kirk", name: "Kirk", role: "Guitarra líder" },
  lars: { id: "lars", name: "Lars", role: "Batería" },
  cliff: { id: "cliff", name: "Cliff", role: "Bajo (1982–1986)" },
  jason: { id: "jason", name: "Jason", role: "Bajo (1986–2001)" },
};

export type HazardSprite =
  | "horseman"
  | "bloodPool"
  | "reaper"
  | "electricChair"
  | "puppeteer"
  | "grave"
  | "justice"
  | "landmine"
  | "snake"
  | "void";

export interface Theme {
  bg: string;
  bg2: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  tileA: string;
  tileB: string;
  fog: string;
}

export interface Album {
  id: string;
  title: string;
  year: number;
  /** Semilla del escenario: cada disco es un mapa distinto (dificultad creciente). */
  seed: number;
  /** Juego de palabras para el modo Bellman. */
  pun: string;
  tagline: string;
  tracks: string[];
  lineup: MemberId[];
  wumpus: { name: string; sprite: HazardSprite };
  pit: { name: string; plural: string; sprite: HazardSprite };
  /** Cómo se "siente" cada percepción en este escenario. */
  stench: string;
  breeze: string;
  deathByPit: string;
  deathByWumpus: string;
  theme: Theme;
}

const CLASSIC: MemberId[] = ["james", "kirk", "cliff", "lars"];
const NEWSTED: MemberId[] = ["james", "kirk", "jason", "lars"];

export const ALBUMS: Album[] = [
  {
    id: "kill-em-all",
    title: "Kill 'Em All",
    year: 1983,
    seed: 1,
    pun: "Seek & Bellman",
    tagline: "El debut: velocidad pura, un martillo y charcos de sangre.",
    tracks: ["Hit the Lights", "The Four Horsemen", "Motorbreath", "Whiplash", "Seek & Destroy"],
    lineup: CLASSIC,
    wumpus: { name: "El Jinete", sprite: "horseman" },
    pit: { name: "Charco de sangre", plural: "charcos de sangre", sprite: "bloodPool" },
    stench: "huele a azufre: el Jinete anda cerca",
    breeze: "corre un viento frío junto a un charco",
    deathByPit: "Resbalaste en un charco de sangre.",
    deathByWumpus: "Te alcanzó el Jinete.",
    theme: {
      bg: "#0b0303",
      bg2: "#3a0808",
      panel: "rgba(26, 6, 6, 0.86)",
      border: "#5c1414",
      text: "#f5e9e4",
      muted: "#bfa3a0",
      accent: "#e3262d",
      accent2: "#d9d9d9",
      tileA: "#1d0f0e",
      tileB: "#241311",
      fog: "#0e0606",
    },
  },
  {
    id: "ride-the-lightning",
    title: "Ride the Lightning",
    year: 1984,
    seed: 1109,
    pun: "For Whom the Bellman Tolls",
    tagline: "Relámpagos, sillas eléctricas y la muerte que se arrastra.",
    tracks: ["Fight Fire with Fire", "Ride the Lightning", "For Whom the Bell Tolls", "Fade to Black", "Creeping Death"],
    lineup: CLASSIC,
    wumpus: { name: "Creeping Death", sprite: "reaper" },
    pit: { name: "Silla eléctrica", plural: "sillas eléctricas", sprite: "electricChair" },
    stench: "hedor a muerte que se arrastra",
    breeze: "zumbido eléctrico en el aire",
    deathByPit: "Te sentaste en la silla eléctrica.",
    deathByWumpus: "Creeping Death te alcanzó.",
    theme: {
      bg: "#020816",
      bg2: "#0c2c66",
      panel: "rgba(4, 14, 36, 0.86)",
      border: "#1d4a8f",
      text: "#e8f4ff",
      muted: "#9ab4d6",
      accent: "#59d2ff",
      accent2: "#fff27a",
      tileA: "#0a1630",
      tileB: "#0d1c3c",
      fog: "#040b1c",
    },
  },
  {
    id: "master-of-puppets",
    title: "Master of Puppets",
    year: 1986,
    seed: 6942,
    pun: "Master of Policies",
    tagline: "Un campo de cruces bajo un cielo naranja y unos hilos que lo controlan todo.",
    tracks: ["Battery", "Master of Puppets", "The Thing That Should Not Be", "Welcome Home (Sanitarium)", "Orion"],
    lineup: CLASSIC,
    wumpus: { name: "El Titiritero", sprite: "puppeteer" },
    pit: { name: "Tumba", plural: "tumbas abiertas", sprite: "grave" },
    stench: "se sienten los hilos del Titiritero",
    breeze: "viento helado de cementerio",
    deathByPit: "Caíste en una tumba abierta.",
    deathByWumpus: "El Titiritero tomó tus hilos.",
    theme: {
      bg: "#120602",
      bg2: "#6b2408",
      panel: "rgba(28, 10, 4, 0.86)",
      border: "#7a3410",
      text: "#fff0e2",
      muted: "#d8b49a",
      accent: "#ff8a2b",
      accent2: "#f4f1ea",
      tileA: "#22110a",
      tileB: "#29150c",
      fog: "#0f0603",
    },
  },
  {
    id: "and-justice-for-all",
    title: "...And Justice for All",
    year: 1988,
    seed: 21491,
    pun: "...And Bellman for All",
    tagline: "La justicia agrietada y un campo minado en tonos grises.",
    tracks: ["Blackened", "...And Justice for All", "Eye of the Beholder", "One", "Harvester of Sorrow"],
    lineup: NEWSTED,
    wumpus: { name: "La Justicia rota", sprite: "justice" },
    pit: { name: "Mina terrestre", plural: "minas terrestres", sprite: "landmine" },
    stench: "polvo de mármol: la estatua está cerca",
    breeze: "tierra removida: hay una mina al lado",
    deathByPit: "Pisaste una mina.",
    deathByWumpus: "La Justicia rota cayó sobre ti.",
    theme: {
      bg: "#0a0c0b",
      bg2: "#2e3a33",
      panel: "rgba(16, 20, 18, 0.88)",
      border: "#46554b",
      text: "#eef1ea",
      muted: "#a9b5a8",
      accent: "#b5d1a6",
      accent2: "#d9cfa3",
      tileA: "#171b19",
      tileB: "#1c211e",
      fog: "#0b0d0c",
    },
  },
  {
    id: "black-album",
    title: "Metallica (The Black Album)",
    year: 1991,
    seed: 13782,
    pun: "Enter Bellman",
    tagline: "Negro sobre negro: una serpiente enroscada y agujeros negros.",
    tracks: ["Enter Sandman", "Sad but True", "The Unforgiven", "Wherever I May Roam", "Nothing Else Matters"],
    lineup: NEWSTED,
    wumpus: { name: "La Serpiente", sprite: "snake" },
    pit: { name: "Agujero negro", plural: "agujeros negros", sprite: "void" },
    stench: "un cascabel suena en la oscuridad",
    breeze: "una corriente fría sale de un agujero negro",
    deathByPit: "Caíste en un agujero negro.",
    deathByWumpus: "La Serpiente te mordió.",
    theme: {
      bg: "#020202",
      bg2: "#1a1a1a",
      panel: "rgba(10, 10, 10, 0.9)",
      border: "#2f2f2f",
      text: "#ececec",
      muted: "#9a9a9a",
      accent: "#c9c9c9",
      accent2: "#7d7d7d",
      tileA: "#0c0c0c",
      tileB: "#111111",
      fog: "#050505",
    },
  },
];

export const albumById = (id: string | null | undefined) => ALBUMS.find((a) => a.id === id) ?? ALBUMS[0];
