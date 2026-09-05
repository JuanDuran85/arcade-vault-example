# SPEC 03 — Envío real del formulario de contacto con Resend

> **Status:** Implementado
> **Depends on:** SPEC 02
> **Date:** 2026-09-05
> **Objective:** Conectar el formulario de contacto ya existente en `/acerca-de` a un envío real de correo con Resend a través de un Route Handler `POST /api/contact`, conservando exactamente la UI del prototipo `references/home-about/about.jsx`.

---

## Por qué existe este spec

`/acerca-de` ya está implementado (SPEC 02) y replica `about.jsx` al pie de la letra, incluida la maqueta del formulario y la animación de terminal de éxito. Lo único que falta es que el submit deje de simularse en el cliente y realmente envíe un correo. Este spec cubre solo eso: el backend de envío y los estados de carga/error que un envío real exige.

## Scope

**In:**

- Dependencia `resend` en `package.json`.
- `app/api/contact/route.ts`: Route Handler `POST` que valida el cuerpo JSON y envía el correo vía Resend del lado del servidor. Es el único lugar donde se toca la API de Resend.
- Validación en servidor: nombre, correo y mensaje no vacíos; formato de correo válido; límites de longitud (nombre ≤ 80, correo ≤ 160, mensaje ≤ 2000).
- Variable de entorno `RESEND_API_KEY`, documentada en `.env.example` con un valor dummy (`re_dummy_key_replace_me`) hasta que el usuario provea la clave real.
- Remitente `onboarding@resend.dev`, destinatario fijo `jcduran@urbe.edu.ve` (constante en el código, no variable de entorno), `replyTo` = correo que escribió la persona.
- Cambios mínimos en `app/acerca-de/page.tsx`: `fetch("/api/contact", { method: "POST" })` con el formulario como JSON, estado `sending` (botón deshabilitado con texto "ENVIANDO…") y estado de error visible sobre el formulario si el envío falla, conservando los datos escritos. El `shake` por campos vacíos y la terminal de éxito se mantienen intactos.
- Nota en `CLAUDE.md` sobre las dos variables de entorno requeridas.

**Out of scope (for future specs):**

- Rediseñar o retocar cualquier otra parte de `/acerca-de` — la UI ya coincide con la referencia.
- Rate limiting, captcha, honeypot u otro anti-abuso.
- Persistir los mensajes (base de datos, log, panel de administración).
- Correo de confirmación automático a quien escribe.
- Plantilla HTML/React Email del correo: se envía texto plano.
- Dominio propio verificado en Resend; se usa el remitente de pruebas.
- Usar Resend en cualquier otro flujo (auth, notificaciones de puntuaciones).

## Data model

Ninguna entidad nueva ni persistencia. Solo el contrato HTTP de `POST /api/contact`:

```ts
// request body
{ name: string; email: string; msg: string }

// response body
{ ok: true }                        // 200
{ ok: false; error: string }        // 400 datos inválidos · 500 fallo de Resend o config
```

`error` es un mensaje en español listo para mostrar (p. ej. `"CORREO INVÁLIDO"`, `"NO SE PUDO ENVIAR. INTENTA DE NUEVO."`). Nunca se filtra al cliente el detalle del error de Resend; ese se registra con `console.error` en el servidor. El cliente lee `ok` del cuerpo, no el código de estado, y trata cualquier `fetch` fallido (red caída, respuesta no-JSON) como `"NO SE PUDO ENVIAR. INTENTA DE NUEVO."`.

## Implementation plan

1. `npm install resend`. `npm run build` sigue pasando.
2. Crear `.env.example` con `RESEND_API_KEY=re_dummy_key_replace_me` y `.env.local` con el mismo dummy, y agregar la nota correspondiente en `CLAUDE.md`. Confirmar que `.env*.local` está ignorado en `.gitignore`. Con la clave dummy el envío falla de forma controlada y muestra el estado de error — es el comportamiento esperado hasta que se coloque la clave real.
3. Crear `app/api/contact/route.ts` con el handler `POST`: parsea el JSON, valida el input, responde `400 { ok: false, error }` en caso de datos inválidos y `500 { ok: false, error }` si falta `RESEND_API_KEY`, y en caso válido llama a `resend.emails.send` hacia `jcduran@urbe.edu.ve` con asunto `"[Arcade Vault] Mensaje de <nombre>"`, cuerpo en texto plano con nombre, correo y mensaje, y `replyTo` con el correo del usuario. Errores de Resend → `console.error` + `500 { ok: false, error: "NO SE PUDO ENVIAR. INTENTA DE NUEVO." }`.
4. Editar `app/acerca-de/page.tsx`: hacer `onSubmit` asíncrono y llamar a `fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })` dentro de un `try/catch`; agregar `sending` y `error` como estado; mantener el `shake` para campos vacíos, deshabilitar el botón y mostrar "ENVIANDO…" mientras corre la petición, mostrar la terminal de éxito solo con `ok: true`, y renderizar el error dentro del formulario cuando `ok: false` o cuando el `fetch` lance.
5. Pasada manual: con la clave dummy, confirmar que el formulario muestra el estado de error sin romperse. Cuando el usuario coloque la `RESEND_API_KEY` real, enviar un mensaje y confirmar que llega a `jcduran@urbe.edu.ve` con el `reply-to` correcto. Confirmar que `npm run lint` y `npm run build` terminan sin errores.

## Acceptance criteria

- [x] `npm run lint` y `npm run build` terminan sin errores.
- [x] Enviar el formulario con los tres campos llenos y una `RESEND_API_KEY` válida entrega un correo a `jcduran@urbe.edu.ve` con asunto `[Arcade Vault] Mensaje de <nombre>`, el mensaje en el cuerpo y `reply-to` igual al correo escrito.
- [x] Tras un envío exitoso se muestra la misma animación de terminal de SPEC 02, con el nombre en mayúsculas.
- [x] `POST /api/contact` con un cuerpo válido responde `200 { ok: true }`; con datos inválidos responde `400 { ok: false, error }` (verificable con `curl`, sin pasar por la UI).
- [x] Con campos vacíos el formulario hace `shake` y no llama a `/api/contact`.
- [x] Con un correo mal formado (p. ej. `abc`) el endpoint responde error y el formulario lo muestra sin perder lo escrito.
- [x] Si Resend falla o falta `RESEND_API_KEY`, el formulario muestra "NO SE PUDO ENVIAR. INTENTA DE NUEVO." y el detalle real aparece solo en la consola del servidor.
- [x] Mientras se envía, el botón está deshabilitado y dice "ENVIANDO…"; no es posible enviar dos veces con un doble clic.
- [x] Con la `RESEND_API_KEY` dummy, el formulario muestra el estado de error y `npm run build` sigue pasando (la clave nunca se valida en build time).
- [x] `RESEND_API_KEY` no aparece en el bundle del cliente (sin prefijo `NEXT_PUBLIC_`).
- [x] `/acerca-de` se ve igual que antes en todo lo demás: hero, highlights, banner divisor y estilos sin cambios.

## Decisions taken and discarded

- **Route Handler `POST /api/contact` en vez de una Server Action**: decisión explícita del usuario. Cuesta un `fetch` y un contrato JSON más que una acción, y a cambio deja un endpoint HTTP inspeccionable con `curl` y consumible desde fuera de la página. La clave de Resend nunca sale del servidor en ninguna de las dos opciones.
- **Remitente `onboarding@resend.dev`**: funciona sin verificar dominio, así el spec no queda bloqueado por DNS. Migrar a un remitente del dominio propio es un cambio de una línea más la verificación en Resend.
- **Sin rate limiting ni captcha**: un limitador en memoria no sobrevive a reinicios ni a varias instancias serverless, y un captcha suma dependencia y claves. Se agrega cuando haya spam real.
- **Destinatario `jcduran@urbe.edu.ve` como constante en el código, no variable de entorno**: es un valor que no cambia entre entornos; una variable extra solo agrega una forma más de que producción quede mal configurada. Si algún día hay más de un destinatario, se promueve a variable.
- **`RESEND_API_KEY` arranca con un valor dummy**: permite implementar y compilar todo el flujo antes de tener la clave real. La acción falla de forma controlada y visible, no en silencio.
- **Sin persistencia de mensajes**: el buzón de correo ya es el registro. Guardar en base de datos exige elegir una, y no hay ninguna en el proyecto.
- **Texto plano en vez de plantilla React Email**: es un correo interno para el equipo; el HTML no aporta nada y suma una dependencia más.
- **Validación solo en servidor** (además del `shake` de campos vacíos que ya existe en cliente): duplicar reglas en ambos lados es código que se desincroniza; el servidor es el único límite de confianza que cuenta.

## Identified risks

- **La clave sigue en dummy**: mientras `RESEND_API_KEY` sea el placeholder, ningún mensaje llega a `jcduran@urbe.edu.ve`. Mitigación: el endpoint responde error visible en vez de fingir éxito, y el criterio de aceptación lo cubre explícitamente.
- **`/api/contact` queda expuesto públicamente**, a diferencia de una Server Action: cualquiera puede hacerle POST directamente. Sin rate limiting (fuera de alcance), el techo es el límite diario de Resend. Aceptado; el endpoint no lee ni devuelve datos, solo envía correo al buzón fijo.
- **Límite del plan gratuito de Resend** (100 correos/día): sin anti-abuso, un bot puede agotarlo. Aceptado a conciencia; el riesgo se materializa como formulario caído, no como fuga de datos.
- **`onboarding@resend.dev` puede caer en spam** en algunos buzones. Mitigación: verificar dominio propio cuando el formulario se use en serio.
