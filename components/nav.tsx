"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useSession();

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    if (path === "/biblioteca") {
      return pathname === "/biblioteca" || pathname.startsWith("/juego");
    }
    return pathname === path;
  };

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={() => setOpen(false)}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>

        <div className="links">
          <Link
            href="/"
            className={isActive("/") ? "active" : ""}
            onClick={() => setOpen(false)}
          >
            Inicio
          </Link>
          <Link
            href="/biblioteca"
            className={isActive("/biblioteca") ? "active" : ""}
            onClick={() => setOpen(false)}
          >
            Biblioteca
          </Link>
          <Link
            href="/salon-de-la-fama"
            className={isActive("/salon-de-la-fama") ? "active" : ""}
            onClick={() => setOpen(false)}
          >
            Salón de la Fama
          </Link>
          <Link
            href="/acerca-de"
            className={isActive("/acerca-de") ? "active" : ""}
            onClick={() => setOpen(false)}
          >
            Acerca de
          </Link>
        </div>

        <div className="spacer"></div>

        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>

        {user ? (
          <button className="btn ghost auth-btn" onClick={logout}>
            {user.name} ▾
          </button>
        ) : (
          <Link href="/iniciar-sesion" className="btn auth-btn" onClick={() => setOpen(false)}>
            Iniciar Sesión
          </Link>
        )}

        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={`av-mobile-backdrop ${open ? "open" : ""}`}
        onClick={() => setOpen(false)}
      ></div>

      <aside className={`av-mobile-panel ${open ? "open" : ""}`}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link
          href="/"
          className={isActive("/") ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          Inicio
        </Link>
        <Link
          href="/biblioteca"
          className={isActive("/biblioteca") ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          Biblioteca
        </Link>
        <Link
          href="/salon-de-la-fama"
          className={isActive("/salon-de-la-fama") ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          Salón de la Fama
        </Link>
        <Link
          href="/acerca-de"
          className={isActive("/acerca-de") ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          Acerca de
        </Link>
        <Link
          href="/iniciar-sesion"
          className={isActive("/iniciar-sesion") ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          {user ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }}></div>
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
