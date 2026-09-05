import { Resend } from "resend";

const TO = "your_email@arcadevault.com";
const FROM = "onboarding@resend.dev";
const GENERIC_ERROR = "NO SE PUDO ENVIAR. INTENTA DE NUEVO.";

function validate(body: unknown) {
  if (typeof body !== "object" || body === null) return "DATOS INVÁLIDOS";
  const { name, email, msg } = body as Record<string, unknown>;
  if (typeof name !== "string" || typeof email !== "string" || typeof msg !== "string")
    return "DATOS INVÁLIDOS";
  if (!name.trim() || !email.trim() || !msg.trim()) return "TODOS LOS CAMPOS SON OBLIGATORIOS";
  if (name.length > 80) return "NOMBRE DEMASIADO LARGO";
  if (email.length > 160) return "CORREO DEMASIADO LARGO";
  if (msg.length > 2000) return "MENSAJE DEMASIADO LARGO";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "CORREO INVÁLIDO";
  return null;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "DATOS INVÁLIDOS" }, { status: 400 });
  }

  const error = validate(body);
  if (error) return Response.json({ ok: false, error }, { status: 400 });

  const { name, email, msg } = body as { name: string; email: string; msg: string };

  if (!process.env.RESEND_API_KEY) {
    console.error("[contact] falta RESEND_API_KEY");
    return Response.json({ ok: false, error: GENERIC_ERROR }, { status: 500 });
  }

  try {
    const { error: sendError } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: FROM,
      to: TO,
      replyTo: email.trim(),
      subject: `[Arcade Vault] Mensaje de ${name.trim()}`,
      text: `Nombre: ${name.trim()}\nCorreo: ${email.trim()}\n\n${msg.trim()}`,
    });
    if (sendError) throw sendError;
  } catch (e) {
    console.error("[contact] fallo de Resend:", e);
    return Response.json({ ok: false, error: GENERIC_ERROR }, { status: 500 });
  }

  return Response.json({ ok: true });
}
