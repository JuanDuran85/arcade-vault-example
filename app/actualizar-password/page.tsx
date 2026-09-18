"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

export default function ActualizarPasswordPage() {
  const router = useRouter();
  const { updatePassword } = useSession();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pass !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    const { error } = await updatePassword(pass);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    router.push("/");
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
            NUEVA CONTRASEÑA
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Contraseña nueva</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <div className="field">
            <label>Confirmar contraseña</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <div
              className="field"
              role="alert"
              style={{ color: "var(--magenta, #ff3ea5)" }}
            >
              &gt; {error}
            </div>
          )}

          <button
            className="btn lg"
            type="submit"
            disabled={submitting}
            style={{ width: "100%", marginTop: 8 }}
          >
            {submitting ? "GUARDANDO…" : "GUARDAR CONTRASEÑA"}
          </button>
        </form>
      </div>
    </div>
  );
}
