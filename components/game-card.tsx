"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { Game } from "@/lib/types";

interface GameCardProps {
  game: Game;
}

export default function GameCard({ game }: GameCardProps) {
  const tiltRef = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
  };

  const onLeave = () => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.transform = "";
  };

  return (
    <div
      ref={tiltRef}
      className="card"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <Link href={`/juego/${game.id}`} className="cover-link">
        <div className="cover">
          <div className={`cover-bg ${game.cover}`}></div>
          <div className="label">{game.cat}</div>
        </div>
      </Link>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <div className="score-badge">
            <span>MEJOR PUNTUACIÓN</span>
            <b>{game.best ? game.best.toLocaleString("es-ES") : "—"}</b>
          </div>
          <Link
            href={`/juego/${game.id}`}
            className={`btn ${game.color === "magenta" ? "magenta" : game.color === "yellow" ? "yellow" : ""}`}
          >
            JUGAR
          </Link>
        </div>
      </div>
    </div>
  );
}
