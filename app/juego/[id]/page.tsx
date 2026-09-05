import Link from "next/link";
import { GAMES, seededScores } from "@/lib/data";
import { notFound } from "next/navigation";

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = GAMES.find(g => g.id === id);

  if (!game) {
    notFound();
  }

  const scores = seededScores(id.length, 10);

  return (
    <div className="av-detail fade-in">
      <div className="detail-left">
        <div className="detail-cover">
          <div className={`cover-bg ${game.cover}`}></div>
        </div>
        <div className="detail-actions">
          <Link href={`/juego/${game.id}/jugar`} className="btn pulse lg">
            JUGAR AHORA
          </Link>
          <Link href="/" className="btn ghost lg">
            VOLVER AL VAULT
          </Link>
        </div>
      </div>

      <div className="detail-info">
        <h2>{game.title}</h2>
        <div className="detail-tags">
          <span>{game.cat}</span>
          <span>{game.color.toUpperCase()}</span>
        </div>
        <p>{game.long}</p>

        <div className="stat-strip">
          <div>
            <div className="l">Récord</div>
            <div className="v">{game.best.toLocaleString("es-ES")}</div>
          </div>
          <div>
            <div className="l">Jugadas</div>
            <div className="v">{game.plays}</div>
          </div>
          <div>
            <div className="l">Dificultad</div>
            <div className="v">HARD</div>
          </div>
        </div>

        <div className="leaderboard">
          <h3> TOP SCORES </h3>
          {scores.map((row, i) => (
            <div key={i} className={`lb-row ${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : ""}`}>
              <div className="rk">#{row.rank}</div>
              <div className="pl">{row.name}</div>
              <div className="sc">{row.score.toLocaleString("es-ES")}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
