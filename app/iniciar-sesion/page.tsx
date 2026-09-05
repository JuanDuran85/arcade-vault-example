"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

export default function AuthPage() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const { login } = useSession();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    login({ name: user });
    router.push("/");
  };

  const handleGuest = () => {
    router.push("/");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-mark"></div>
          <h2>SISTEMA DE ACCESO</h2>
        </div>

        <div className="auth-tabs">
          <button className={tab === "login" ? "on" : ""} onClick={() => setTab("login")}>
            ENTRAR
          </button>
          <button className={tab === "signup" ? "on" : ""} onClick={() => setTab("signup")}>
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Usuario</label>
            <input
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder="PX_USER"
              autoFocus
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="********"
            />
          </div>
          <button className="btn pulse lg" style={{ width: "100%", margin: "16px 0" }} type="submit">
            {tab === "login" ? "ACCEDER" : "REGISTRARSE"}
          </button>
        </form>

        <div className="auth-divider">O ACCEDER CON</div>

        <div className="social">
          <button className="btn ghost">Google</button>
          <button className="btn ghost">GitHub</button>
        </div>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button className="btn ghost" style={{ fontSize: 9 }} onClick={handleGuest}>
            JUGAR COMO INVITADO
          </button>
        </div>
      </div>
    </div>
  );
}
