-- SPEC 07 — Segundo juego real: `caida` (Tetris).
-- Solo una fila más en el catálogo; no toca el esquema de SPEC 06.

insert into public.games (id, title, short, long, cat, cover, color) values
  ('caida', 'CAÍDA', 'Encaja las piezas antes de que te sepulten.',
   'Las piezas bajan cada vez más rápido y solo desaparecen cuando completas una línea entera. Entre ellas se cuela una tuerca con un agujero en el centro que no encaja con nada: colócala donde menos estorbe.',
   'PUZZLE', 'cover-tetro', 'cyan');
