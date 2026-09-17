-- SPEC 01 (game-jam/rana) — Quinto juego real: `rana` (Frogger).
-- Solo una fila más en el catálogo; no toca el esquema de SPEC 06.
-- "Frogger" es marca de Konami: se sigue la convención de rocas/caida/bloques
-- y se nombra por mecánica/tema, no por título comercial.

insert into public.games (id, title, short, long, cat, cover, color) values
  ('rana', 'RANA', 'Cruza la carretera y el río sin que te aplasten.',
   'Guía a la rana carril por carril: esquiva los coches de la carretera, salta de tronco en tronco sin caer al agua y llega a un nenúfar libre en la otra orilla. Llenar los cinco nenúfares sube de nivel y acelera todos los carriles. Tres vidas, ni una más.',
   'ARCADE', 'cover-rana', 'green');
