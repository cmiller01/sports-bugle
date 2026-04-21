import { useState, useEffect, useCallback, useRef } from "react";

/* ═══════════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════════ */

const LEAGUES = {
  nba: {
    name: "NBA",
    path: "basketball/nba",
    sport: "basketball",
    logo: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nba.png&h=40&w=40",
    daysBack: 1,
    daysForward: 1,
    playoffs: true,
  },
  ncaam: {
    name: "NCAA",
    path: "basketball/mens-college-basketball",
    sport: "basketball",
    logo: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/ncaab.png&h=40&w=40",
    daysBack: 3,
    daysForward: 18,
    noStandings: true,
    tournamentOnly: true,
  },
  nfl: {
    name: "NFL",
    path: "football/nfl",
    sport: "football",
    logo: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nfl.png&h=40&w=40",
    daysBack: 1,
    daysForward: 1,
  },
  mlb: {
    name: "MLB",
    path: "baseball/mlb",
    sport: "baseball",
    logo: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/mlb.png&h=40&w=40",
    daysBack: 1,
    daysForward: 1,
  },
  nhl: {
    name: "NHL",
    path: "hockey/nhl",
    sport: "hockey",
    logo: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nhl.png&h=40&w=40",
    daysBack: 1,
    daysForward: 1,
    playoffs: true,
  },
  epl: {
    name: "EPL",
    path: "soccer/eng.1",
    sport: "soccer",
    logo: null,
    daysBack: 7,
    daysForward: 7,
  },
};

const API = "https://site.api.espn.com/apis/site/v2/sports";
const today = new Date();
const dateStr = today.toLocaleDateString("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

/* ─── URL params for headless mode ─── */
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const leagues = params.get("leagues");
  const favs = params.get("favs");
  return {
    leagues: leagues ? leagues.split(",").filter((l) => LEAGUES[l]) : null,
    favs: favs ? favs.split(",") : null,
    headless: params.has("headless"),
  };
}
const URL_PARAMS = getUrlParams();

/* ─── storage ─── */
const mem = {};
const store = {
  get(k) {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch {
      return mem[k] ?? null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      mem[k] = v;
    }
  },
};

async function apiFetch(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw r.status;
    return r.json();
  } catch (e) {
    console.error(url, e);
    return null;
  }
}

/* ═══════════════════════════════════════════
   DATA FETCHERS
   ═══════════════════════════════════════════ */

function formatYMD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function parseEvent(ev) {
  const c = ev.competitions?.[0];
  const teams = (c?.competitors || []).map((t) => ({
    id: t.team?.id,
    abbr: t.team?.abbreviation,
    name: t.team?.displayName,
    short: t.team?.shortDisplayName,
    score: t.score,
    winner: t.winner,
    homeAway: t.homeAway,
    record: t.records?.[0]?.summary || "",
    linescores: (t.linescores || []).map((l) => l.value),
    seed: t.curatedRank?.current || null,
  }));

  const oddsData = c?.odds?.[0];
  let odds = null;
  if (oddsData) {
    odds = {
      details: oddsData.details || "",
      overUnder: oddsData.overUnder,
      spread: oddsData.spread,
      overOdds: oddsData.overOdds,
      underOdds: oddsData.underOdds,
      awayMLOdds: oddsData.awayTeamOdds?.moneyLine,
      homeMLOdds: oddsData.homeTeamOdds?.moneyLine,
      provider: oddsData.provider?.name || "",
    };
  }

  // Extract highlights/notes
  const headline = c?.headlines?.[0]?.shortLinkText || c?.headlines?.[0]?.description || "";
  const note = c?.notes?.[0]?.headline || "";

  const rawRound = c?.notes?.[0]?.headline || "";
  const round = rawRound.replace(/^NCAA\s+(?:Men['']s\s+)?(?:Basketball\s+)?Tournament\s*[-–]\s*/i, "");

  const seriesRaw = c?.series;
  let series = null;
  if (seriesRaw && seriesRaw.type === "playoff") {
    const wins = {};
    (seriesRaw.competitors || []).forEach((x) => {
      if (x.id != null) wins[x.id] = x.wins || 0;
    });
    series = {
      summary: seriesRaw.summary || "",
      bestOf: seriesRaw.totalCompetitions || 7,
      completed: !!seriesRaw.completed,
      wins,
      roundAbbr: c?.type?.abbreviation || "",
      note,
    };
  }

  return {
    id: ev.id,
    name: ev.name,
    date: ev.date,
    detail: c?.status?.type?.shortDetail || "",
    completed: c?.status?.type?.completed,
    live: c?.status?.type?.state === "in",
    notStarted: c?.status?.type?.state === "pre",
    venue: c?.venue?.fullName || "",
    teams,
    odds,
    round,
    series,
    headline: headline || note,
    leaders: (c?.leaders || []).map((cat) => ({
      category: cat.name,
      leaders: (cat.leaders || []).slice(0, 1).map((l) => ({
        name: l.athlete?.shortName || l.athlete?.displayName,
        value: l.displayValue,
      })),
    })),
  };
}

async function fetchScores(league) {
  const daysBack = LEAGUES[league].daysBack ?? 1;
  const daysForward = LEAGUES[league].daysForward ?? 1;

  const today = new Date();

  // Generate array of dates to fetch
  const dates = [];
  for (let i = -daysBack; i <= daysForward; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    dates.push(formatYMD(date));
  }

  // Fetch all days in parallel
  const responses = await Promise.all(
    dates.map(date => apiFetch(`${API}/${LEAGUES[league].path}/scoreboard?dates=${date}`))
  );

  // Combine all events
  const allEvents = responses.flatMap(d => d?.events || []);

  return allEvents.map(parseEvent);
}

async function fetchPlayoffs(league) {
  if (!LEAGUES[league]?.playoffs) return [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 21);
  const end = new Date(today);
  end.setDate(end.getDate() + 21);
  const range = `${formatYMD(start)}-${formatYMD(end)}`;
  const d = await apiFetch(
    `${API}/${LEAGUES[league].path}/scoreboard?seasontype=3&limit=300&dates=${range}`
  );
  return (d?.events || []).map(parseEvent).filter((g) => g.series);
}

async function fetchStandings(league) {
  const d = await apiFetch(`https://site.web.api.espn.com/apis/v2/sports/${LEAGUES[league].path}/standings`);
  if (!d?.children) return [];
  return d.children.map((g) => ({
    name: g.name || g.abbreviation,
    teams: (g.standings?.entries || [])
      .map((e) => {
        const s = {};
        (e.stats || []).forEach((x) => (s[x.name] = x.displayValue));
        return {
          id: e.team?.id,
          abbr: e.team?.abbreviation,
          short: e.team?.shortDisplayName,
          logo: e.team?.logos?.[0]?.href,
          w: s.wins || "0",
          l: s.losses || "0",
          t: s.ties,
          d: s.ties || s.draws,
          mp: s.gamesPlayed,
          pct: s.winPercent || "",
          gb: s.gamesBehind || "",
          streak: s.streak || "",
          l10: s["Last Ten Games"] ? s["Last Ten Games"].split(',')[0] : "",
          otl: s.OTLosses || s.otLosses,
          pts: s.points,
          pf: s.pointsFor,
          pa: s.pointsAgainst,
          gp: s.gamesPlayed,
          gd: s.pointDifferential || s.differential,
          gf: s.pointsFor,
          ga: s.pointsAgainst,
        };
      })
      .sort((a, b) => {
        if ((league === "nhl" || league === "epl") && a.pts && b.pts)
          return parseInt(b.pts) - parseInt(a.pts);
        return (
          (parseFloat(b.pct) || 0) - (parseFloat(a.pct) || 0) ||
          parseInt(b.w) - parseInt(a.w)
        );
      }),
  }));
}

async function fetchTeams(league) {
  const d = await apiFetch(`${API}/${LEAGUES[league].path}/teams`);
  if (!d?.sports?.[0]?.leagues?.[0]?.teams) return [];
  return d.sports[0].leagues[0].teams.map((t) => ({
    id: t.team.id,
    abbr: t.team.abbreviation,
    short: t.team.shortDisplayName,
    logo: t.team.logos?.[0]?.href,
  }));
}

/* ─── helpers ─── */
function periodLabels(league, count) {
  const labels = [];
  for (let i = 1; i <= count; i++) {
    if (league === "nhl")
      labels.push(i <= 3 ? `P${i}` : i === 4 ? "OT" : `OT${i - 3}`);
    else if (league === "nba")
      labels.push(i <= 4 ? `Q${i}` : i === 5 ? "OT" : `OT${i - 4}`);
    else if (league === "nfl")
      labels.push(i <= 4 ? `Q${i}` : "OT");
    else if (league === "epl")
      labels.push(i === 1 ? "1H" : "2H");
    else if (league === "ncaam")
      labels.push(i <= 2 ? `H${i}` : i === 3 ? "OT" : `OT${i - 2}`);
    else labels.push(String(i));
  }
  return labels;
}

function stCols(league) {
  switch (league) {
    case "nba":
      return { h: ["W", "L", "PCT", "GB", "L10", "STRK"], k: ["w", "l", "pct", "gb", "l10", "streak"] };
    case "ncaam":
      return { h: ["W", "L", "PCT", "GB", "STRK"], k: ["w", "l", "pct", "gb", "streak"] };
    case "nfl":
      return { h: ["W", "L", "T", "PCT", "PF", "PA"], k: ["w", "l", "t", "pct", "pf", "pa"] };
    case "mlb":
      return { h: ["W", "L", "PCT", "GB", "L10", "STRK"], k: ["w", "l", "pct", "gb", "l10", "streak"] };
    case "nhl":
      return { h: ["W", "L", "OTL", "PTS", "L10", "STRK"], k: ["w", "l", "otl", "pts", "l10", "streak"] };
    case "epl":
      return { h: ["MP", "W", "D", "L", "PTS", "GF", "GA", "GD"], k: ["mp", "w", "d", "l", "pts", "gf", "ga", "gd"] };
    default:
      return { h: ["W", "L"], k: ["w", "l"] };
  }
}

function formatOdds(odds) {
  if (!odds) return null;
  const parts = [];
  if (odds.details) parts.push(odds.details);
  if (odds.overUnder) parts.push(`O/U ${odds.overUnder}`);
  return parts.length ? parts.join("  ·  ") : null;
}

function formatMoneyLine(odds) {
  if (!odds || (!odds.awayMLOdds && !odds.homeMLOdds)) return null;
  const fmt = (v) => (v > 0 ? `+${v}` : `${v}`);
  const parts = [];
  if (odds.awayMLOdds) parts.push(fmt(odds.awayMLOdds));
  if (odds.homeMLOdds) parts.push(fmt(odds.homeMLOdds));
  return parts;
}

/* ═══════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════ */

function Header({ onSettings, headless }) {
  return (
    <header style={{ textAlign: "center", marginBottom: 28 }}>
      <div className="thick-rule" />
      <div className="header-meta">
        <span>DAILY EDITION</span>
        <span>{dateStr.toUpperCase()}</span>
      </div>
      <h1 className="mast">THE SPORTS BUGLE 📣</h1>
      <p className="tagline">Yesterday · Today · Tomorrow · Standings · Box Scores</p>
      {!headless && (
        <div className="header-actions no-print">
          <button className="btn" onClick={onSettings}>
            ★ MY TEAMS
          </button>
          <button className="btn" onClick={() => window.print()}>
            ⎙ PRINT
          </button>
        </div>
      )}
      <div className="thick-rule" />
    </header>
  );
}

function TeamPicker({ allTeams, favorites, setFavorites, onClose }) {
  const toggle = (league, id) => {
    const key = `${league}:${id}`;
    setFavorites((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      store.set("fav_teams", next);
      return next;
    });
  };

  const favStr = favorites.join(",");
  const exampleUrl = `${window.location.origin}${window.location.pathname}?favs=${favStr}&headless`;

  return (
    <div
      className="overlay no-print"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="picker">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <h2 className="picker-title">Select Favorite Teams</h2>
          <button className="btn" onClick={onClose}>
            ✕ CLOSE
          </button>
        </div>
        <p className="picker-hint">
          Favorites get detailed box scores. Others show summary scores.
        </p>
        {Object.entries(LEAGUES).map(([key, lg]) => (
          <div key={key} style={{ marginBottom: 18 }}>
            <h3 className="picker-league-name">{lg.name}</h3>
            <div className="picker-grid">
              {(allTeams[key] || []).map((t) => {
                const on = favorites.includes(`${key}:${t.id}`);
                return (
                  <button
                    key={t.id}
                    className={`picker-team ${on ? "active" : ""}`}
                    onClick={() => toggle(key, t.id)}
                  >
                    {t.logo && (
                      <img src={t.logo} alt="" className="picker-logo" />
                    )}
                    <span>{t.short || t.abbr}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {favorites.length > 0 && (
          <div className="headless-url">
            <h4>Headless / Cron URL</h4>
            <p>Use this URL with Puppeteer for automated printing:</p>
            <code>{exampleUrl}</code>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ game, league, isFav, showDate = true }) {
  const home = game.teams.find((t) => t.homeAway === "home");
  const away = game.teams.find((t) => t.homeAway === "away");
  if (!home || !away) return null;

  // Show box scores for favorite games that are completed or live
  const showBox =
    isFav &&
    (game.completed || game.live) &&
    Math.max(home.linescores.length, away.linescores.length) > 0;

  const maxP = Math.max(home.linescores.length, away.linescores.length);
  const labels = periodLabels(league, maxP);
  const oddsLine = game.notStarted ? formatOdds(game.odds) : null;
  const mlParts = game.notStarted ? formatMoneyLine(game.odds) : null;

  const gameDate = new Date(game.date);
  const dateStr = gameDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const timeStr = gameDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className={`sc ${game.live ? "sc-live" : ""} ${isFav ? "sc-fav" : ""}`}>
      {game.live && <span className="live-badge">● LIVE</span>}
      {showDate && <div className="sc-date">{dateStr}</div>}
      <div style={{ marginBottom: 4 }}>
        {[away, home].map((t, idx) => (
          <div key={t.id || idx} className={`sc-row ${t.winner ? "sc-won" : ""}`}>
            {league === "ncaam" && t.seed ? (
              <span className="sc-seed">#{t.seed}</span>
            ) : null}
            <span className="sc-abbr">{t.abbr}</span>
            <span className="sc-name">{t.short}</span>
            <span className="sc-rec">{t.record}</span>
            {mlParts && <span className="sc-ml">{mlParts[idx]}</span>}
            <span className="sc-score">{game.notStarted ? "—" : (t.score ?? "—")}</span>
          </div>
        ))}
      </div>
      <div className="sc-status">
        {game.completed
          ? "FINAL"
          : game.live
          ? game.detail
          : timeStr}
      </div>
      {oddsLine && <div className="sc-odds">{oddsLine}</div>}
      {isFav && game.venue && <div className="sc-venue">{game.venue}</div>}
      {game.headline && <div className="sc-headline">{game.headline}</div>}
      {showBox && (
        <div className="box">
          <table>
            <thead>
              <tr>
                <th></th>
                {labels.map((l, i) => (
                  <th key={i}>{l}</th>
                ))}
                <th className="box-total">T</th>
              </tr>
            </thead>
            <tbody>
              {[away, home].map((t) => (
                <tr key={t.id}>
                  <td className="box-tm">{t.abbr}</td>
                  {labels.map((_, i) => (
                    <td key={i}>{t.linescores[i] ?? "-"}</td>
                  ))}
                  <td className="box-total">{t.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {isFav && game.completed && game.leaders.length > 0 && (
        <div className="leaders">
          {game.leaders.slice(0, 3).map(
            (cat, i) =>
              cat.leaders[0] && (
                <span key={i} className="ldr">
                  {cat.category?.replace(/([A-Z])/g, " $1")?.trim()}:{" "}
                  {cat.leaders[0].name} {cat.leaders[0].value}
                </span>
              )
          )}
        </div>
      )}
    </div>
  );
}

function StandingsTable({ group, league }) {
  const cfg = stCols(league);
  return (
    <div style={{ breakInside: "avoid" }}>
      <h4 className="stg-name">{group.name}</h4>
      <table className="st-table">
        <thead>
          <tr>
            <th className="st-rk">#</th>
            <th className="st-tm-h">TEAM</th>
            {cfg.h.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {group.teams.map((t, i) => (
            <tr key={t.id}>
              <td className="st-rk">{i + 1}</td>
              <td className="st-tm">
                {t.logo && (
                  <img src={t.logo} alt="" className="st-logo" />
                )}
                <span className="st-ab">{t.abbr}</span>
                <span className="st-sn">{t.short}</span>
              </td>
              {cfg.k.map((k) => (
                <td key={k}>{t[k] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const BRACKET_ROUND_ORDER = [
  "First Four",
  "First Round",
  "Second Round",
  "Sweet 16",
  "Elite Eight",
  "Final Four",
  "National Championship",
];

const SERIES_ROUND_ORDER = ["RD16", "RD8", "RD4", "RD2"];

const SERIES_ROUND_NAMES = {
  nba: {
    RD16: "First Round",
    RD8: "Conference Semifinals",
    RD4: "Conference Finals",
    RD2: "NBA Finals",
  },
  nhl: {
    RD16: "First Round",
    RD8: "Second Round",
    RD4: "Conference Finals",
    RD2: "Stanley Cup Final",
  },
};

function seriesRoundLabel(league, abbr) {
  return SERIES_ROUND_NAMES[league]?.[abbr] || abbr || "Playoffs";
}

function seriesConference(note) {
  const m = /^(east|west|eastern|western)/i.exec(note || "");
  if (!m) return null;
  return m[1].toLowerCase().startsWith("east") ? "East" : "West";
}

function seriesGameNumber(game) {
  const m = /Game\s+(\d+)/i.exec(game?.round || "");
  return m ? parseInt(m[1], 10) : null;
}

function buildSeries(games) {
  const byKey = {};
  games.forEach((g) => {
    if (!g.series) return;
    const ids = g.teams.map((t) => t.id).filter(Boolean);
    if (ids.length !== 2) return;
    const sorted = [...ids].sort();
    const key = `${g.series.roundAbbr}:${sorted.join("-")}`;
    if (!byKey[key]) {
      const [aId, bId] = sorted;
      const teamA = g.teams.find((t) => t.id === aId);
      const teamB = g.teams.find((t) => t.id === bId);
      byKey[key] = {
        id: key,
        roundAbbr: g.series.roundAbbr,
        conference: seriesConference(g.series.note),
        bestOf: g.series.bestOf,
        completed: g.series.completed,
        summary: g.series.summary,
        teamA: {
          id: aId,
          abbr: teamA?.abbr,
          name: teamA?.name,
          short: teamA?.short,
          wins: g.series.wins[aId] || 0,
        },
        teamB: {
          id: bId,
          abbr: teamB?.abbr,
          name: teamB?.name,
          short: teamB?.short,
          wins: g.series.wins[bId] || 0,
        },
        games: [],
      };
    }
    const s = byKey[key];
    if (g.series.summary) s.summary = g.series.summary;
    s.completed = s.completed || g.series.completed;
    s.teamA.wins = Math.max(s.teamA.wins, g.series.wins[s.teamA.id] || 0);
    s.teamB.wins = Math.max(s.teamB.wins, g.series.wins[s.teamB.id] || 0);
    if (!s.conference) s.conference = seriesConference(g.series.note);
    s.games.push(g);
  });
  return Object.values(byKey).map((s) => {
    s.games.sort((x, y) => new Date(x.date) - new Date(y.date));
    const past = s.games.filter((g) => g.completed);
    const live = s.games.find((g) => g.live);
    const upcoming = s.games.filter((g) => !g.completed && !g.live);
    const realNext = upcoming.find((g) => !/if necessary/i.test(g.round || ""));
    s.lastGame = past[past.length - 1] || null;
    s.nextGame = live || realNext || upcoming[0] || null;
    return s;
  });
}

function BracketView({ games, league, favorites }) {
  const favIds = favorites
    .filter((f) => f.startsWith(league + ":"))
    .map((f) => f.split(":")[1]);

  const byRound = {};
  games.forEach((g) => {
    const r = g.round || "Tournament";
    if (!byRound[r]) byRound[r] = [];
    byRound[r].push(g);
  });

  const sortedRounds = Object.entries(byRound).sort(([a], [b]) => {
    const ai = BRACKET_ROUND_ORDER.findIndex((r) =>
      a.toLowerCase().includes(r.toLowerCase())
    );
    const bi = BRACKET_ROUND_ORDER.findIndex((r) =>
      b.toLowerCase().includes(r.toLowerCase())
    );
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <div>
      {sortedRounds.map(([roundName, roundGames]) => {
        const favGames = roundGames.filter((g) =>
          g.teams.some((t) => favIds.includes(t.id))
        );
        const otherGames = roundGames.filter((g) => !favGames.includes(g));
        return (
          <div key={roundName} style={{ marginBottom: 16 }}>
            <h4 className="bracket-round-name">{roundName.toUpperCase()}</h4>
            {favGames.length > 0 && (
              <>
                {otherGames.length > 0 && (
                  <div className="fav-label">★ MY TEAMS</div>
                )}
                <div
                  className="scores-grid fav-grid"
                  style={{ marginBottom: otherGames.length > 0 ? 12 : 0 }}
                >
                  {favGames.map((g) => (
                    <ScoreCard
                      key={g.id}
                      game={g}
                      league={league}
                      isFav={true}
                      showDate={false}
                    />
                  ))}
                </div>
              </>
            )}
            {otherGames.length > 0 && (
              <>
                {favGames.length > 0 && (
                  <div className="other-label">OTHER GAMES</div>
                )}
                <div className="scores-grid">
                  {otherGames.map((g) => (
                    <ScoreCard
                      key={g.id}
                      game={g}
                      league={league}
                      isFav={false}
                      showDate={false}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SeriesCard({ series: s, league, isFav }) {
  const leaderId =
    s.teamA.wins > s.teamB.wins
      ? s.teamA.id
      : s.teamB.wins > s.teamA.wins
      ? s.teamB.id
      : null;

  const fmtTime = (iso) =>
    new Date(iso).toLocaleString("en-US", {
      weekday: "short",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const lg = s.lastGame;
  const ng = s.nextGame;

  let lastLine = null;
  if (lg) {
    const winT = lg.teams.find((t) => t.winner);
    const loseT = lg.teams.find((t) => !t.winner);
    const gn = seriesGameNumber(lg);
    if (winT && loseT) {
      lastLine = `${gn ? `G${gn} · ` : ""}${winT.abbr} ${winT.score}–${loseT.score} ${loseT.abbr}`;
    }
  }

  let nextLine = null;
  let nextLabel = "NEXT";
  if (ng && !s.completed) {
    const gn = seriesGameNumber(ng);
    if (ng.live) {
      nextLabel = "LIVE";
      nextLine = `${gn ? `G${gn} · ` : ""}${ng.detail}`;
    } else {
      const ifNec = /if necessary/i.test(ng.round || "");
      nextLine = `${gn ? `G${gn}${ifNec ? "*" : ""} · ` : ""}${fmtTime(ng.date)}`;
    }
  }

  return (
    <div
      className={`series-card${isFav ? " series-fav" : ""}${s.completed ? " series-done" : ""}${ng && ng.live ? " series-live" : ""}`}
    >
      {s.conference && <div className="series-conf">{s.conference.toUpperCase()}</div>}
      {[s.teamA, s.teamB].map((t) => (
        <div
          key={t.id}
          className={`series-row${leaderId === t.id ? " series-lead" : ""}${s.completed && leaderId === t.id ? " series-winner" : ""}`}
        >
          <span className="series-abbr">{t.abbr}</span>
          <span className="series-name">{t.short || t.name}</span>
          <span className="series-wins">{t.wins}</span>
        </div>
      ))}
      <div className="series-summary">
        {s.summary || `Best of ${s.bestOf}`}
      </div>
      {lastLine && (
        <div className="series-meta">
          <span className="series-meta-lbl">LAST</span>
          <span>{lastLine}</span>
        </div>
      )}
      {nextLine && (
        <div className="series-meta">
          <span className="series-meta-lbl">{nextLabel}</span>
          <span>{nextLine}</span>
        </div>
      )}
    </div>
  );
}

function SeriesView({ series, league, favorites }) {
  const favIds = favorites
    .filter((f) => f.startsWith(league + ":"))
    .map((f) => f.split(":")[1]);

  const byRound = {};
  series.forEach((s) => {
    if (!byRound[s.roundAbbr]) byRound[s.roundAbbr] = [];
    byRound[s.roundAbbr].push(s);
  });

  const rounds = SERIES_ROUND_ORDER.filter((r) => byRound[r]);

  return (
    <div>
      {rounds.map((roundAbbr) => {
        const list = byRound[roundAbbr].slice().sort((a, b) => {
          if (a.conference !== b.conference) {
            if (a.conference === "East") return -1;
            if (b.conference === "East") return 1;
          }
          return (b.teamA.wins + b.teamB.wins) - (a.teamA.wins + a.teamB.wins)
            || (a.teamA.abbr || "").localeCompare(b.teamA.abbr || "");
        });
        return (
          <div key={roundAbbr} className="series-round">
            <h4 className="bracket-round-name">
              {seriesRoundLabel(league, roundAbbr).toUpperCase()}
            </h4>
            <div className="series-grid">
              {list.map((s) => {
                const isFav =
                  favIds.includes(s.teamA.id) || favIds.includes(s.teamB.id);
                return (
                  <SeriesCard
                    key={s.id}
                    series={s}
                    league={league}
                    isFav={isFav}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeagueSection({ league, scores, standings, playoffs, favorites }) {
  const favIds = favorites
    .filter((f) => f.startsWith(league + ":"))
    .map((f) => f.split(":")[1]);

  // Group games by date
  const groupByDate = (games) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // For EPL, use specific date grouping. For other sports, use yesterday/today/tomorrow
    if (league === 'epl') {
      const dateGroups = {};
      games.forEach((g) => {
        const gameDate = new Date(g.date);
        gameDate.setHours(0, 0, 0, 0);
        const time = gameDate.getTime();

        let key;
        if (time === today.getTime()) {
          key = 'TODAY';
        } else if (time < today.getTime()) {
          key = gameDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
        } else {
          key = gameDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
        }

        if (!dateGroups[key]) dateGroups[key] = [];
        dateGroups[key].push(g);
      });

      // Sort groups by date
      const sortedGroups = Object.entries(dateGroups).sort((a, b) => {
        if (a[0] === 'TODAY') return 0;
        if (b[0] === 'TODAY') return 0;
        const dateA = a[1][0] ? new Date(a[1][0].date) : new Date();
        const dateB = b[1][0] ? new Date(b[1][0].date) : new Date();
        return dateA - dateB;
      });

      return Object.fromEntries(sortedGroups);
    }

    const groups = { yesterday: [], today: [], tomorrow: [] };

    games.forEach((g) => {
      const gameDate = new Date(g.date);
      gameDate.setHours(0, 0, 0, 0);
      const time = gameDate.getTime();

      if (time === yesterday.getTime()) groups.yesterday.push(g);
      else if (time === today.getTime()) groups.today.push(g);
      else if (time === tomorrow.getTime()) groups.tomorrow.push(g);
      else if (time < today.getTime()) groups.yesterday.push(g);
      else groups.tomorrow.push(g);
    });

    return groups;
  };

  const renderDateSection = (label, favGames, otherGames) => {
    const totalGames = favGames.length + otherGames.length;
    if (totalGames === 0) return null;

    return (
      <div key={label} style={{ marginBottom: 14 }}>
        <h4 className="date-header">{label}</h4>
        {favGames.length > 0 && (
          <>
            {favGames.length > 0 && otherGames.length > 0 && (
              <div className="fav-label">★ MY TEAMS</div>
            )}
            <div className="scores-grid fav-grid" style={{ marginBottom: favGames.length > 0 && otherGames.length > 0 ? 12 : 0 }}>
              {favGames.map((g) => (
                <ScoreCard key={g.id} game={g} league={league} isFav={true} showDate={false} />
              ))}
            </div>
          </>
        )}
        {otherGames.length > 0 && (
          <>
            {favGames.length > 0 && otherGames.length > 0 && (
              <div className="other-label">OTHER GAMES</div>
            )}
            <div className="scores-grid">
              {otherGames.map((g) => (
                <ScoreCard key={g.id} game={g} league={league} isFav={false} showDate={false} />
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const favGames = scores.filter((g) => g.teams.some((t) => favIds.includes(t.id)));
  const otherGames = scores.filter((g) => !favGames.includes(g));

  const favByDate = groupByDate(favGames);
  const otherByDate = groupByDate(otherGames);

  return (
    <section style={{ marginBottom: 36, breakInside: "avoid" }}>
      <div className="lg-header">
        <h2 className="lg-name">
          {LEAGUES[league].logo && (
            <img src={LEAGUES[league].logo} alt={LEAGUES[league].name} className="lg-logo" />
          )}
          {LEAGUES[league].name}
        </h2>
        <div className="lg-rule" />
      </div>
      {playoffs && playoffs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 className="sec-label">PLAYOFFS</h3>
          <SeriesView
            series={buildSeries(playoffs)}
            league={league}
            favorites={favorites}
          />
        </div>
      )}
      {playoffs && playoffs.length > 0 ? null : scores.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          {league === 'ncaam' ? (() => {
            const tourneyGames = scores.filter((g) => g.round);
            return (
              <>
                {tourneyGames.length > 0 ? (
                  <>
                    <h3 className="sec-label">NCAA TOURNAMENT</h3>
                    <BracketView
                      games={tourneyGames}
                      league={league}
                      favorites={favorites}
                    />
                  </>
                ) : (
                  <p className="no-games">No tournament games scheduled.</p>
                )}
              </>
            );
          })() : league === 'epl' ? (
            // For EPL, render all date groups dynamically
            <>
              <h3 className="sec-label">SCOREBOARD</h3>
              {Object.keys(favByDate).length > 0 || Object.keys(otherByDate).length > 0 ? (
                [...new Set([...Object.keys(favByDate), ...Object.keys(otherByDate)])].map(dateLabel =>
                  renderDateSection(dateLabel, favByDate[dateLabel] || [], otherByDate[dateLabel] || [])
                )
              ) : null}
            </>
          ) : (
            // For other sports, use standard yesterday/today/tomorrow
            <>
              <h3 className="sec-label">SCOREBOARD</h3>
              {renderDateSection("YESTERDAY", favByDate.yesterday, otherByDate.yesterday)}
              {renderDateSection("TODAY", favByDate.today, otherByDate.today)}
              {renderDateSection("TOMORROW", favByDate.tomorrow, otherByDate.tomorrow)}
            </>
          )}
        </div>
      ) : (
        <p className="no-games">No games scheduled in the next {league === 'epl' ? '2 weeks' : '3 days'}.</p>
      )}
      {standings.length > 0 && (
        <div>
          <h3 className="sec-label">STANDINGS</h3>
          <div className="st-grid">
            {standings.map((g) => (
              <StandingsTable key={g.name} group={g} league={league} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════ */

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Source+Serif+4:opsz,wght@8..60,300;8..60,400;8..60,600&family=JetBrains+Mono:wght@400;500;600&display=swap');

  :root {
    --ink: #1a1a1a;
    --paper: #f7f4ee;
    --rule: #2a2a2a;
    --faint: #c8c0b4;
    --accent: #8b0000;
    --mid: #777;
    --bg-alt: #ece8df;
    --serif: 'Playfair Display', Georgia, serif;
    --body: 'Source Serif 4', Georgia, serif;
    --mono: 'JetBrains Mono', monospace;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--paper);
    color: var(--ink);
    font-family: var(--body);
    font-size: 14px;
    line-height: 1.5;
  }

  .app {
    max-width: 1100px;
    margin: 0 auto;
    padding: 20px 24px 60px;
  }

  /* ── Header ── */
  .thick-rule { height: 3px; background: var(--ink); margin: 6px 0; }

  .header-meta {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font: 11px/1 var(--mono);
    letter-spacing: 0.12em;
    color: var(--mid);
  }

  .mast {
    font: 900 clamp(36px, 7vw, 64px)/1.05 var(--serif);
    letter-spacing: -0.02em;
    margin: 8px 0 2px;
  }

  .tagline {
    font: 300 14px/1 var(--body);
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--mid);
  }

  .header-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 14px;
  }

  .btn {
    font: 11px var(--mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: var(--ink);
    color: var(--paper);
    border: none;
    padding: 7px 16px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn:hover { background: var(--accent); }

  /* ── Tabs ── */
  .tabs {
    display: flex;
    gap: 4px;
    justify-content: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .tab {
    font: 12px var(--mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 6px 18px;
    border: 1.5px solid var(--ink);
    background: none;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tab.on { background: var(--ink); color: var(--paper); }
  .tab:hover:not(.on) { background: var(--bg-alt); }

  /* ── Status ── */
  .refresh {
    text-align: center;
    font: 10px var(--mono);
    color: var(--faint);
    margin-bottom: 20px;
    letter-spacing: 0.05em;
  }

  .refresh button {
    background: none;
    border: none;
    color: var(--accent);
    font: 10px var(--mono);
    cursor: pointer;
    text-decoration: underline;
    margin-left: 8px;
  }

  .loading-msg {
    text-align: center;
    padding: 60px 0;
    font: italic 18px var(--serif);
    color: var(--mid);
  }

  /* ── League ── */
  .lg-header { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
  .lg-name {
    font: 900 28px var(--serif);
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .lg-logo {
    width: 32px;
    height: 32px;
    object-fit: contain;
    filter: grayscale(100%) contrast(1.2);
  }
  .lg-rule { flex: 1; height: 2px; background: var(--ink); }

  .sec-label {
    font: 10px var(--mono);
    letter-spacing: 0.15em;
    color: var(--mid);
    margin-bottom: 10px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--faint);
  }

  .date-header {
    font: 600 12px var(--mono);
    letter-spacing: 0.12em;
    color: var(--ink);
    margin-bottom: 8px;
    padding: 6px 10px;
    background: var(--bg-alt);
    border-left: 3px solid var(--ink);
    text-transform: uppercase;
  }

  .fav-label, .other-label {
    font: 500 9px var(--mono);
    letter-spacing: 0.1em;
    color: var(--mid);
    margin-bottom: 6px;
    margin-top: 4px;
    text-transform: uppercase;
  }

  .fav-label {
    color: var(--ink);
    font-weight: 600;
  }

  .sec-div { border: none; border-top: 1px dashed var(--faint); margin: 12px 0; }
  .no-games { font-style: italic; color: var(--mid); font-size: 13px; margin: 8px 0 16px; }

  /* ── Bracket ── */
  .bracket-round-name {
    font: 700 11px var(--mono);
    letter-spacing: 0.14em;
    color: var(--paper);
    background: var(--ink);
    padding: 5px 10px;
    margin-bottom: 8px;
    text-transform: uppercase;
    display: inline-block;
  }

  /* ── Playoff Series ── */
  .series-round { margin-bottom: 18px; }
  .series-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }
  .series-card {
    border: 1px solid var(--faint);
    padding: 10px 12px 8px;
    background: #fff;
    position: relative;
  }
  .series-fav {
    border: 2px solid var(--ink);
    background: var(--paper);
    box-shadow: 0 2px 4px rgba(0,0,0,0.08);
  }
  .series-live { border-left: 4px solid var(--accent); }
  .series-done { background: var(--bg-alt); }
  .series-conf {
    position: absolute;
    top: 6px;
    right: 10px;
    font: 9px var(--mono);
    letter-spacing: 0.14em;
    color: var(--mid);
  }
  .series-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 3px 0;
    font-size: 14px;
  }
  .series-lead .series-abbr,
  .series-lead .series-wins { font-weight: 900; }
  .series-lead .series-name { font-weight: 600; }
  .series-winner .series-abbr,
  .series-winner .series-name,
  .series-winner .series-wins { color: var(--accent); }
  .series-abbr { font: 600 12px var(--mono); width: 40px; }
  .series-name { flex: 1; }
  .series-wins {
    font: 700 18px var(--mono);
    min-width: 22px;
    text-align: right;
  }
  .series-summary {
    font: 10px var(--mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--mid);
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px dashed var(--faint);
  }
  .series-done .series-summary { color: var(--ink); font-weight: 600; }
  .series-meta {
    display: flex;
    gap: 8px;
    font: 10px var(--mono);
    color: var(--mid);
    margin-top: 3px;
    letter-spacing: 0.03em;
  }
  .series-meta-lbl {
    letter-spacing: 0.12em;
    color: var(--ink);
    font-weight: 600;
    min-width: 30px;
  }

  /* ── Score Cards ── */
  .scores-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }

  .fav-grid { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }

  .sc {
    border: 1px solid var(--faint);
    padding: 10px 12px;
    background: #fff;
    position: relative;
  }

  .sc-fav {
    border: 2px solid var(--ink);
    background: var(--paper);
    box-shadow: 0 2px 4px rgba(0,0,0,0.08);
  }
  .sc-live { border-left: 4px solid var(--accent); }

  .live-badge {
    position: absolute;
    top: 6px;
    right: 8px;
    font: 9px var(--mono);
    color: var(--accent);
    letter-spacing: 0.08em;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

  .sc-date { font: 10px var(--mono); color: var(--mid); letter-spacing: 0.05em; margin-bottom: 4px; text-transform: uppercase; }
  .sc-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 13px; }
  .sc-won .sc-abbr, .sc-won .sc-score { font-weight: 900; }
  .sc-won .sc-name { font-weight: 600; }
  .sc-seed { font: 600 9px var(--mono); color: var(--accent); width: 20px; text-align: right; flex-shrink: 0; }
  .sc-abbr { font: 600 12px var(--mono); width: 36px; }
  .sc-name { flex: 1; }
  .sc-rec { font: 10px var(--mono); color: var(--mid); }
  .sc-ml { font: 10px var(--mono); color: var(--mid); min-width: 38px; text-align: right; }
  .sc-score { font: 15px var(--mono); width: 32px; text-align: right; }
  .sc-status { font: 10px var(--mono); color: var(--mid); letter-spacing: 0.08em; text-transform: uppercase; }
  .sc-odds { font: 10px var(--mono); color: var(--accent); margin-top: 2px; letter-spacing: 0.03em; }
  .sc-venue { font: 9px var(--mono); color: var(--mid); margin-top: 3px; letter-spacing: 0.03em; }
  .sc-headline { font: 11px var(--body); color: var(--ink); margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--faint); font-style: italic; line-height: 1.3; }

  /* ── Box Score ── */
  .box { margin-top: 8px; border-top: 1px solid var(--faint); padding-top: 6px; overflow-x: auto; }
  .box table { width: 100%; border-collapse: collapse; font: 11px var(--mono); }
  .box th { font-weight: 500; color: var(--mid); text-align: center; padding: 2px 6px; font-size: 9px; letter-spacing: 0.05em; }
  .box td { text-align: center; padding: 2px 6px; }
  .box-tm { text-align: left !important; font-weight: 600; }
  .box-total { font-weight: 700; border-left: 1.5px solid var(--faint); }

  .leaders { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px 12px; }
  .ldr { font: 10px var(--mono); color: var(--mid); }

  /* ── Standings ── */
  .st-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
  .stg-name { font: 700 15px var(--serif); margin-bottom: 6px; border-bottom: 1.5px solid var(--ink); padding-bottom: 3px; }

  .st-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .st-table th { font: 500 9px var(--mono); letter-spacing: 0.1em; color: var(--mid); text-align: center; padding: 3px 5px; border-bottom: 1px solid var(--faint); }
  .st-table th.st-rk, .st-table th.st-tm-h { text-align: left; }
  .st-table td { padding: 3px 5px; text-align: center; border-bottom: 1px solid #eee; font: 11px var(--mono); }
  .st-table td.st-rk { text-align: left; color: var(--mid); font-size: 10px; width: 20px; }
  .st-table td.st-tm { text-align: left; display: flex; align-items: center; gap: 5px; font: 12px var(--body); }
  .st-logo { width: 16px; height: 16px; object-fit: contain; }
  .st-ab { font: 600 11px var(--mono); }
  .st-sn { color: var(--mid); font-size: 11px; }
  .st-table tr:hover { background: var(--bg-alt); }

  /* ── Team Picker ── */
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .picker { background: var(--paper); max-width: 700px; width: 100%; max-height: 85vh; overflow-y: auto; padding: 28px; border: 2px solid var(--ink); }
  .picker-title { font: 900 22px var(--serif); }
  .picker-hint { font-size: 12px; color: var(--mid); margin-bottom: 18px; }
  .picker-league-name { font: 700 16px var(--serif); margin-bottom: 8px; border-bottom: 1px solid var(--faint); padding-bottom: 3px; }
  .picker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; }

  .picker-team {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 1px solid var(--faint);
    background: #fff;
    cursor: pointer;
    font: 12px var(--body);
    transition: all 0.15s;
  }

  .picker-team:hover { border-color: var(--ink); }
  .picker-team.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .picker-logo { width: 18px; height: 18px; object-fit: contain; }
  .picker-team.active .picker-logo { filter: brightness(10); }

  .headless-url { margin-top: 20px; padding: 14px; background: var(--bg-alt); border: 1px solid var(--faint); }
  .headless-url h4 { font: 700 13px var(--serif); margin-bottom: 4px; }
  .headless-url p { font-size: 11px; color: var(--mid); margin-bottom: 6px; }
  .headless-url code { font: 11px var(--mono); word-break: break-all; color: var(--accent); display: block; padding: 8px; background: #fff; border: 1px solid var(--faint); user-select: all; }

  /* ── Footer ── */
  .footer {
    text-align: center;
    margin-top: 30px;
    padding-top: 12px;
    border-top: 2px solid var(--ink);
    font: 9px var(--mono);
    color: var(--mid);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .footer-github { color: var(--mid); margin-left: 6px; opacity: 0.6; }
  .footer-github:hover { opacity: 1; }
  .footer-reset { margin-top: 10px; }
  .footer-reset button {
    background: none;
    border: none;
    color: var(--faint);
    font: 9px var(--mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    text-decoration: underline;
  }
  .footer-reset button:hover { color: var(--accent); }

  /* ── Print ── */
  @media print {
    .no-print { display: none !important; }
    body { background: #fff; font-size: 11px; }
    .app { max-width: 100%; padding: 0; }

    /* Compact header for print */
    header { margin-bottom: 10px; page-break-after: avoid; }
    .thick-rule { height: 1px; margin: 1px 0; }
    .header-meta { padding: 1px 0; font-size: 7px; }
    .mast { font-size: 18px; margin: 2px 0 1px 0; letter-spacing: -0.02em; line-height: 1; }
    .tagline { display: none; }

    /* Optimize spacing */
    section { page-break-inside: auto; }
    .lg-header { margin-bottom: 8px; gap: 8px; page-break-after: avoid; }
    .lg-name { font-size: 18px; }
    .lg-logo { width: 20px; height: 20px; }
    .sec-label { margin-bottom: 5px; padding-bottom: 2px; font-size: 9px; }
    .date-header { padding: 3px 6px; margin-bottom: 5px; font-size: 9px; page-break-after: avoid; }

    /* Score cards */
    .sc { border: 1px solid #999; break-inside: avoid; padding: 8px 10px; }
    .sc-fav { border: 2px solid #333; }
    .scores-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .fav-grid { grid-template-columns: repeat(2, 1fr); }

    /* Series cards */
    .series-grid { grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .series-card { break-inside: avoid; padding: 6px 8px; }
    .series-round { margin-bottom: 10px; }

    /* Standings */
    .st-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .st-table { font-size: 9px; }
    .st-table td, .st-table th { padding: 2px 3px; }
    .st-logo { width: 12px; height: 12px; }

    /* Footer */
    .footer { margin-top: 16px; padding-top: 8px; font-size: 8px; }

    .live-badge { animation: none; }
    @page { margin: 0.75in; }
  }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .app { padding: 12px; }
    .mast { font-size: 32px; }
    .scores-grid, .fav-grid, .series-grid { grid-template-columns: 1fr; }
    .st-grid { grid-template-columns: 1fr; }
    .picker { padding: 16px; }
    .picker-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
  }
`;

/* ═══════════════════════════════════════════
   APP
   ═══════════════════════════════════════════ */

export default function App() {
  const [scores, setScores] = useState({});
  const [standings, setStandings] = useState({});
  const [playoffs, setPlayoffs] = useState({});
  const [allTeams, setAllTeams] = useState({});
  const [favorites, setFavorites] = useState(
    () => URL_PARAMS.favs || store.get("fav_teams") || []
  );
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeLeagues, setActiveLeagues] = useState(
    () =>
      URL_PARAMS.leagues ||
      store.get("active_leagues") ||
      Object.keys(LEAGUES)
  );
  const [lastRefresh, setLastRefresh] = useState(null);

  // Track whether the user has explicitly chosen which leagues to show.
  // If not, we auto-select only leagues that have games after data loads.
  const userHasSetLeagues = useRef(
    URL_PARAMS.leagues !== null || store.get("active_leagues") !== null
  );

  const headless = URL_PARAMS.headless;

  const toggleLeague = (lg) => {
    userHasSetLeagues.current = true;
    setActiveLeagues((prev) => {
      const next = prev.includes(lg)
        ? prev.filter((l) => l !== lg)
        : [...prev, lg];
      store.set("active_leagues", next);
      return next;
    });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const keys = Object.keys(LEAGUES);
    const [sc, st, tm, po] = await Promise.all([
      Promise.all(keys.map(async (lg) => [lg, await fetchScores(lg)])),
      Promise.all(keys.map(async (lg) => [lg, LEAGUES[lg].noStandings ? [] : await fetchStandings(lg)])),
      Promise.all(keys.map(async (lg) => [lg, await fetchTeams(lg)])),
      Promise.all(keys.map(async (lg) => [lg, LEAGUES[lg].playoffs ? await fetchPlayoffs(lg) : []])),
    ]);
    const scoreMap = Object.fromEntries(sc);
    const playoffMap = Object.fromEntries(po);
    setScores(scoreMap);
    setStandings(Object.fromEntries(st));
    setAllTeams(Object.fromEntries(tm));
    setPlayoffs(playoffMap);
    setLoading(false);
    setLastRefresh(new Date());

    // Auto-select only leagues with games when no user preference is stored.
    // Playoff series count as activity even if no games are scheduled in the scoreboard window.
    if (!userHasSetLeagues.current) {
      const leaguesWithGames = keys.filter(
        (lg) => (scoreMap[lg] || []).length > 0 || (playoffMap[lg] || []).length > 0
      );
      setActiveLeagues(leaguesWithGames.length > 0 ? leaguesWithGames : keys);
    }

    // Signal to Puppeteer / automation that data is ready
    window.__SPORTS_PAGE_READY__ = true;
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 5 minutes (skip in headless mode)
  useEffect(() => {
    if (!headless) {
      const iv = setInterval(loadData, 5 * 60 * 1000);
      return () => clearInterval(iv);
    }
  }, [loadData, headless]);

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <Header onSettings={() => setShowPicker(true)} headless={headless} />

        {!headless && (
          <div className="tabs no-print">
            {Object.entries(LEAGUES).map(([k, lg]) => (
              <button
                key={k}
                className={`tab ${activeLeagues.includes(k) ? "on" : ""}`}
                onClick={() => toggleLeague(k)}
              >
                {lg.name}
              </button>
            ))}
          </div>
        )}

        {lastRefresh && !headless && (
          <div className="refresh no-print">
            Updated{" "}
            {lastRefresh.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
            <button onClick={loadData}>Refresh</button>
          </div>
        )}

        {loading ? (
          <div className="loading-msg">
            Fetching today&apos;s scores &amp; standings…
          </div>
        ) : (
          activeLeagues
            .filter((l) => LEAGUES[l])
            .map((lg) => (
              <LeagueSection
                key={lg}
                league={lg}
                scores={scores[lg] || []}
                standings={standings[lg] || []}
                playoffs={playoffs[lg] || []}
                favorites={favorites}
              />
            ))
        )}

        <div className="footer">
          The Sports Bugle · {dateStr} · Data via ESPN · {" "}
          {headless
            ? "Generated automatically"
            : "Auto-refreshes every 5 minutes"}{" "}
          · v{__APP_VERSION__}{" "}
          <a
            href="https://github.com/cmiller01/sports-bugle"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-github no-print"
            aria-label="View source on GitHub"
          >
            <svg height="16" width="16" viewBox="0 0 16 16" aria-hidden="true" style={{display:"inline",verticalAlign:"middle"}}>
              <path fillRule="evenodd" fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
          </a>
          {!headless && (
            <div className="footer-reset no-print">
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem("active_leagues");
                    localStorage.removeItem("fav_teams");
                  } catch {}
                  userHasSetLeagues.current = false;
                  setFavorites([]);
                  loadData();
                }}
              >
                Reset preferences
              </button>
            </div>
          )}
        </div>

        {showPicker && (
          <TeamPicker
            allTeams={allTeams}
            favorites={favorites}
            setFavorites={setFavorites}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    </>
  );
}
