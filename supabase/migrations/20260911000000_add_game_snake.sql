-- SPEC 10 — Cuarto juego real: `snake`.
-- Solo una fila más en el catálogo; no toca el esquema de SPEC 06.
-- id en inglés ("snake"), rutas siguen en español (/juego/snake/jugar).

insert into public.games (id, title, short, long, cat, cover, color) values
  ('snake', 'SNAKE', 'Come frutas, crece y no te muerdas la cola.',
   'Guía a la serpiente por el tablero comiendo frutas que aparezcan aleatoriamente. Cada fruta que comes hace crecer tu cuerpo y sube tu puntuación. La partida termina si chocas contra una pared o contra ti mismo.',
   'ARCADE', 'cover-snake', 'green');
