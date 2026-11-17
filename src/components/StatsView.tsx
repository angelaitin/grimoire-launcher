import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Cell as PieCell,
} from "recharts";
import type { Game } from "../lib/types";
import { api } from "../lib/api";
import {
  heatmapData, currentStreak, secondsThisWeek, achievementStats,
  topGamesByPlaytime, playByWeekday, playByHour, playByGenre,
  type Session,
} from "../lib/stats";
import { formatPlaytime, globalStats } from "../lib/format";

interface Props {
  games: Game[];
}

// Paleta de rojos del tema para los gráficos.
const REDS = ["#cc4450", "#a8313f", "#8b2535", "#6b1d28", "#b5503a", "#7a3540", "#963042"];

export function StatsView({ games }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    api.getSessionHistory().then(setSessions).catch(console.error);
  }, []);

  const { total, totalSeconds, mostPlayed } = globalStats(games);
  const streak = currentStreak(sessions);
  const weekSecs = secondsThisWeek(sessions);
  const ach = achievementStats(games);
  const grid = heatmapData(sessions, 26);

  const topGames = topGamesByPlaytime(games, 8);
  const byWeekday = playByWeekday(sessions);
  const byHour = playByHour(sessions);
  const byGenre = playByGenre(games, 6);

  const hasSessions = sessions.length > 0;

  function cellColor(secs: number): string {
    if (secs === 0) return "var(--obsidian-deep)";
    const hours = secs / 3600;
    if (hours < 0.5) return "rgba(168, 49, 63, 0.25)";
    if (hours < 1.5) return "rgba(168, 49, 63, 0.45)";
    if (hours < 3) return "rgba(168, 49, 63, 0.7)";
    return "var(--blood-bright)";
  }

  // Tooltip oscuro a juego con el tema.
  const tooltipStyle = {
    background: "#160e10",
    border: "1px solid #a8313f",
    borderRadius: "2px",
    fontFamily: "monospace",
    fontSize: "12px",
    color: "#e6dcd0",
  };

  return (
    <div className="stats-view">
      {/* Tarjetas resumen */}
      <div className="stats-cards">
        <div className="stat-card">
          <span className="stat-card-num">{total}</span>
          <span className="stat-card-cap">Juegos</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-num">{Math.round(totalSeconds / 3600)} h</span>
          <span className="stat-card-cap">Tiempo total</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-num">{formatPlaytime(weekSecs)}</span>
          <span className="stat-card-cap">Esta semana</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-num accent">{streak}</span>
          <span className="stat-card-cap">Racha (días)</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-num plat">{ach.platinums} ✦</span>
          <span className="stat-card-cap">Platinos</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-num">{ach.pct}%</span>
          <span className="stat-card-cap">Logros ({ach.unlockedAch}/{ach.totalAch})</span>
        </div>
      </div>

      {/* A QUÉ JUEGAS: top juegos por horas */}
      {topGames.length > 0 && (
        <div className="chart-block">
          <h3>A qué juegas · top por horas</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, topGames.length * 38)}>
            <BarChart data={topGames} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" stroke="#8a796f" tick={{ fontSize: 11, fontFamily: "monospace" }} />
              <YAxis type="category" dataKey="name" width={130} stroke="#8a796f"
                tick={{ fontSize: 12, fill: "#e6dcd0", fontFamily: "Cormorant Garamond, serif" }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(168,49,63,0.08)" }}
                formatter={(v: any) => [`${v} h`, "Jugado"]} />
              <Bar dataKey="horas" radius={[0, 3, 3, 0]}>
                {topGames.map((_, i) => <Cell key={i} fill={REDS[i % REDS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* CUÁNDO JUEGAS: por día de semana y por hora */}
      <div className="chart-row">
        <div className="chart-block half">
          <h3>Cuándo juegas · día de la semana</h3>
          {hasSessions ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byWeekday} margin={{ left: -10 }}>
                <XAxis dataKey="dia" stroke="#8a796f" tick={{ fontSize: 11, fontFamily: "monospace" }} />
                <YAxis stroke="#8a796f" tick={{ fontSize: 10, fontFamily: "monospace" }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(168,49,63,0.08)" }}
                  formatter={(v: any) => [`${v} h`, "Jugado"]} />
                <Bar dataKey="horas" fill="#a8313f" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="chart-empty">Sin datos aún.</p>}
        </div>

        <div className="chart-block half">
          <h3>Cuándo juegas · hora del día</h3>
          {hasSessions ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byHour} margin={{ left: -10 }}>
                <XAxis dataKey="hora" stroke="#8a796f" interval={3}
                  tick={{ fontSize: 9, fontFamily: "monospace" }} />
                <YAxis stroke="#8a796f" tick={{ fontSize: 10, fontFamily: "monospace" }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(168,49,63,0.08)" }}
                  formatter={(v: any) => [`${v} min`, "Jugado"]} />
                <Bar dataKey="minutos" fill="#cc4450" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="chart-empty">Sin datos aún.</p>}
        </div>
      </div>

      {/* Géneros */}
      {byGenre.length > 0 && (
        <div className="chart-block">
          <h3>Reparto por género</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byGenre} dataKey="horas" nameKey="name" cx="50%" cy="50%"
                outerRadius={90} innerRadius={45} paddingAngle={2}
                label={(e: any) => `${e.name} (${e.horas}h)`}
                labelLine={{ stroke: "#8a796f" }}
                style={{ fontFamily: "monospace", fontSize: "11px" }}>
                {byGenre.map((_, i) => <PieCell key={i} fill={REDS[i % REDS.length]} stroke="#070405" />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v} h`, "Jugado"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Heatmap de actividad */}
      <div className="heatmap-section">
        <h3>Actividad · últimas 26 semanas</h3>
        <div className="heatmap">
          <div className="heatmap-days">
            {["L", "", "X", "", "V", "", "D"].map((d, i) => (
              <span key={i} className="heatmap-day-label">{d}</span>
            ))}
          </div>
          <div className="heatmap-grid">
            {grid.map((week, wi) => (
              <div className="heatmap-week" key={wi}>
                {week.map((day, di) => (
                  <div key={di} className="heatmap-cell"
                    style={{ background: cellColor(day.secs) }}
                    title={day.secs > 0 ? `${day.key}: ${formatPlaytime(day.secs)}` : `${day.key}: sin jugar`} />
                ))}
              </div>
            ))}
          </div>
        </div>
        {!hasSessions && (
          <p className="heatmap-empty">
            Aún no hay actividad registrada. Las partidas que juegues desde
            Grimoire irán apareciendo en estos gráficos.
          </p>
        )}
      </div>

      {mostPlayed && (
        <div className="stats-highlight">
          <span className="stats-highlight-cap">Tu obsesión</span>
          <span className="stats-highlight-name">{mostPlayed.name}</span>
          <span className="stats-highlight-time">{formatPlaytime(mostPlayed.seconds_played)}</span>
        </div>
      )}
    </div>
  );
}
