"use client";

import React, { useState } from "react";
import { useSession } from "@/lib/session";

export default function RecuperarPasswordPage() {
  const { resetPasswordForEmail } = useSession();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await resetPasswordForEmail(email);
    setSubmitting(false);
    setSent(true);
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            RECUPERAR CONTRASEÑA
          </div>
        </div>

        {sent ? (
          <div className="field" role="status">
            Si el correo existe, vas a recibir un link.
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
                required
              />
            </div>

            <button
              className="btn lg"
              type="submit"
              disabled={submitting}
              style={{ width: "100%", marginTop: 8 }}
            >
              {submitting ? "ENVIANDO…" : "ENVIAR LINK"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
