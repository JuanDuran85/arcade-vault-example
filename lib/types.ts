export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string; // sufijo de clase CSS, p. ej. "cover-bricks"
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number; // max(scores.score) del juego, 0 si no hay ninguna
  plays: number; // count(scores) del juego
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/aaaa
  gameTitle: string; // para la columna JUEGO del tab GLOBAL
}

export interface SessionUser {
  name: string;
}
