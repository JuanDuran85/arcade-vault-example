import { GAMES, seededScores } from "@/lib/data";
import { notFound } from "next/navigation";
import React from "react";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function GameLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);

  if (!game) {
    notFound();
  }

  const scores = seededScores(id.length * 17 + 3, 10);

  return (
    <div className="av-detail fade-in">
      <main>{children}</main>
      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {scores.map((r, i) => (
            <div
              key={r.name}
              className={`lb-row ${
                i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : ""
              }`}
            >
              <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
              <div className="pl">
                {r.name}
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--ink-faint)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {r.date}
                </div>
              </div>
              <div className="sc">{r.score.toLocaleString("es-ES")}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
