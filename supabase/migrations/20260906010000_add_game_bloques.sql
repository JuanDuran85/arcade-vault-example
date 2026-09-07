-- SPEC 08 — Tercer juego real: `bloques` (Arkanoid).
-- Solo una fila más en el catálogo; no toca el esquema de SPEC 06.

insert into public.games (id, title, short, long, cat, cover, color) values
  ('bloques', 'BLOQUES', 'Rompe el muro sin que la bola te pase de largo.',
   'Cinco muros, cada uno más rápido que el anterior. La paleta responde a las flechas o al ratón, la bola rebota con el ángulo que le des, y cada bloque que revienta vale diez puntos. Tres vidas, ni una más.',
   'ARCADE', 'cover-bricks', 'magenta');
