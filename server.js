// NACHTWACHE (Werwolf-Prinzip) – Deno-Server. Der Erzähler ist der Server:
// er teilt die Rollen aus, führt durch die Nacht und deckt am Tag auf.
//
// Der Name „Die Werwölfe von Düsterwald" ist geschützt, die Regeln sind es
// nicht – deshalb heißt das Spiel hier Nachtwache und alle Texte sind eigene.
//
// Fünf Rollen: Werwolf, Dorfbewohner, Seherin, Hexe, Amor.

import { darfRaumOeffnen, raumVermerkt } from "./bremse.js";
import { cleanName, raumverwaltung, shuffle } from "./raum.js";
import { starte } from "./statisch.js";

const PORT = Number(Deno.env.get("PORT") ?? 8067);
const HOST = Deno.env.get("HOST") ?? "0.0.0.0";
const PUBLIC = new URL("./public/", import.meta.url);

const MAX_PLAYERS = 12;
const MIN_PLAYERS = 4;

// Jede Nachtrolle bekommt eine Frist. Ohne sie hängt die ganze Runde an
// einer Person, die aufs Klo gegangen ist.
const FRIST = { amor: 60_000, wolf: 60_000, seher: 45_000, hexe: 45_000, wahl: 90_000 };
const TAG_MS = 150_000;   // Reden; der Host kann früher weiter
const KURZ_MS = 6_000;    // Aufdeckung stehen lassen

const {
  rooms, browsing,
  createRoom, clearTimers, anwesende,
  send, raw, broadcast,
  roomList, pushState, pushRoomList,
  makePlayer, attach, dropPlayer,
} = raumverwaltung({
  maxPlayers: MAX_PLAYERS,
  minPlayers: MIN_PLAYERS,
  einstellungen: { amor: true, hexe: true },
  raumfelder: () => ({
    schritt: "lobby",
    nachtNr: 0,
    opferStimmen: new Map(),   // Wolf-Id -> Ziel-Id
    stimmen: new Map(),        // Wähler-Id -> Ziel-Id
    opfer: null,
    gift: null,
    geheilt: false,
    hexeHeil: true,
    hexeGift: true,
    meldungen: [],
    ergebnis: null,
    frist: 0,
  }),
  spielerfelder: () => ({
    rolle: null, lebt: false, liebe: null, sehErgebnis: null, fertig: false,
  }),
  beimBeitritt: (room, player) => { if (room.phase === "playing") pushRunde(room, player); },
  nachVerlassen: (room) => { if (room.phase === "playing") pruefeFertig(room); },
  beimPlatzfrei: (room, id) => {
    if (room.phase !== "playing") return;
    const p = room.players.get(id);
    if (p) p.lebt = false;
    room.opferStimmen.delete(id);
    room.stimmen.delete(id);
    pruefeEnde(room) || pruefeFertig(room);
  },
  zurueckZurLobby: (room) => backToLobby(room),
});

const lebende = (room) => [...room.players.values()].filter((p) => p.lebt && p.connected);
const woelfe = (room) => lebende(room).filter((p) => p.rolle === "wolf");
const rolleVon = (room, r) => lebende(room).find((p) => p.rolle === r) ?? null;

// ---------------------------------------------------------------------------
// Rollen verteilen
// ---------------------------------------------------------------------------

function verteileRollen(room) {
  const leute = shuffle(anwesende(room));
  const n = leute.length;
  const anzahlWoelfe = n >= 12 ? 3 : n >= 8 ? 2 : 1;
  const rollen = [];
  for (let i = 0; i < anzahlWoelfe; i++) rollen.push("wolf");
  rollen.push("seher");
  if (room.settings.hexe && n >= 5) rollen.push("hexe");
  if (room.settings.amor && n >= 6) rollen.push("amor");
  while (rollen.length < n) rollen.push("dorf");
  shuffle(rollen);
  leute.forEach((p, i) => {
    p.rolle = rollen[i];
    p.lebt = true;
    p.liebe = null;
    p.sehErgebnis = null;
    p.fertig = false;
    p.punkte = 0;
  });
  for (const p of room.players.values()) {
    if (!leute.includes(p)) { p.rolle = null; p.lebt = false; }
  }
}

// ---------------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------------

function startGame(room) {
  clearTimers(room);
  room.phase = "playing";
  room.rundeNr = 0;
  room.nachtNr = 0;
  room.meldungen = [];
  room.hexeHeil = true;
  room.hexeGift = true;
  verteileRollen(room);
  for (const p of room.players.values()) p.ready = false;
  setzeSchritt(room, "rollen", 20_000);
  pushState(room);
  pushRoomList();
}

/** Schritt setzen und die Frist scharf machen. */
function setzeSchritt(room, schritt, ms) {
  clearTimers(room);
  room.schritt = schritt;
  room.frist = ms ? Date.now() + ms : 0;
  for (const p of room.players.values()) p.fertig = false;
  pushRunde(room);
  if (!ms) return;
  const id = setTimeout(() => {
    room.timers.delete(id);
    fristAbgelaufen(room, schritt);
  }, ms);
  room.timers.add(id);
}

function fristAbgelaufen(room, schritt) {
  if (room.phase !== "playing" || room.schritt !== schritt) return;
  switch (schritt) {
    case "rollen": return nachtStart(room);
    case "amor": {
      // Niemand verkuppelt? Dann eben nicht.
      return naechsteNachtrolle(room, "amor");
    }
    case "wolf": {
      if (!room.opferStimmen.size) {
        const ziele = lebende(room).filter((p) => p.rolle !== "wolf");
        if (ziele.length) room.opfer = ziele[Math.floor(Math.random() * ziele.length)].id;
      } else {
        room.opfer = mehrheit(room.opferStimmen);
      }
      return naechsteNachtrolle(room, "wolf");
    }
    case "seher": return naechsteNachtrolle(room, "seher");
    case "hexe": return naechsteNachtrolle(room, "hexe");
    case "morgen": return setzeSchritt(room, "tag", TAG_MS);
    case "abend": return nachtStart(room);
    case "tag": return setzeSchritt(room, "wahl", FRIST.wahl);
    case "wahl": return werteWahlAus(room);
    default: return;
  }
}

function mehrheit(stimmen) {
  const zaehler = new Map();
  for (const ziel of stimmen.values()) zaehler.set(ziel, (zaehler.get(ziel) ?? 0) + 1);
  let best = null, bestN = 0, gleich = [];
  for (const [id, n] of zaehler) {
    if (n > bestN) { best = id; bestN = n; gleich = [id]; }
    else if (n === bestN) gleich.push(id);
  }
  if (gleich.length > 1) return gleich[Math.floor(Math.random() * gleich.length)];
  return best;
}

function nachtStart(room) {
  room.nachtNr++;
  room.rundeNr = room.nachtNr;
  room.opfer = null;
  room.gift = null;
  room.geheilt = false;
  room.opferStimmen.clear();
  room.stimmen.clear();
  room.meldungen = [];
  const amor = room.nachtNr === 1 ? rolleVon(room, "amor") : null;
  if (amor) setzeSchritt(room, "amor", FRIST.amor);
  else setzeSchritt(room, "wolf", FRIST.wolf);
}

/** Reihenfolge der Nacht: Amor (nur einmal), Wölfe, Seherin, Hexe. */
function naechsteNachtrolle(room, fertig) {
  if (fertig === "amor") return setzeSchritt(room, "wolf", FRIST.wolf);
  if (fertig === "wolf") {
    if (rolleVon(room, "seher")) return setzeSchritt(room, "seher", FRIST.seher);
    fertig = "seher";
  }
  if (fertig === "seher") {
    const hexe = rolleVon(room, "hexe");
    if (hexe && (room.hexeHeil || room.hexeGift)) return setzeSchritt(room, "hexe", FRIST.hexe);
    fertig = "hexe";
  }
  return morgen(room);
}

/** Die Nacht auflösen: wer ist tot, und warum. */
function morgen(room) {
  const tote = [];
  if (room.opfer && !room.geheilt) tote.push(room.opfer);
  if (room.gift && !tote.includes(room.gift)) tote.push(room.gift);

  const meldungen = [];
  for (const id of tote) toeten(room, id, meldungen, "nacht");
  if (!tote.length) meldungen.unshift("Diese Nacht ist niemand gestorben.");

  room.meldungen = meldungen;
  room.ergebnis = { art: "nacht", tote: tote.map((id) => name(room, id)) };
  if (pruefeEnde(room, meldungen)) return;
  setzeSchritt(room, "morgen", KURZ_MS);
}

function name(room, id) {
  return room.players.get(id)?.name ?? "?";
}

/** Tötet und nimmt die verliebte Person mit – Liebeskummer. */
function toeten(room, id, meldungen, art) {
  const p = room.players.get(id);
  if (!p || !p.lebt) return;
  p.lebt = false;
  meldungen.push(
    art === "nacht"
      ? `${p.name} hat die Nacht nicht überlebt. Rolle: ${rollenName(p.rolle)}.`
      : `${p.name} wurde vom Dorf verurteilt. Rolle: ${rollenName(p.rolle)}.`,
  );
  if (p.liebe) {
    const l = room.players.get(p.liebe);
    if (l?.lebt) {
      l.lebt = false;
      meldungen.push(`${l.name} stirbt aus Liebeskummer. Rolle: ${rollenName(l.rolle)}.`);
    }
  }
}

const ROLLEN_NAMEN = {
  wolf: "Werwolf", dorf: "Dorfbewohner", seher: "Seherin", hexe: "Hexe", amor: "Amor",
};
const rollenName = (r) => ROLLEN_NAMEN[r] ?? "?";

function werteWahlAus(room) {
  const ziel = room.stimmen.size ? mehrheit(room.stimmen) : null;
  const meldungen = [];
  if (ziel) toeten(room, ziel, meldungen, "tag");
  else meldungen.push("Das Dorf konnte sich nicht einigen. Niemand stirbt.");
  room.meldungen = meldungen;
  room.ergebnis = {
    art: "tag",
    tote: ziel ? [name(room, ziel)] : [],
    stimmen: [...room.stimmen].map(([w, z]) => `${name(room, w)} → ${name(room, z)}`),
  };
  if (pruefeEnde(room, meldungen)) return;
  setzeSchritt(room, "abend", KURZ_MS);
}

/**
 * Gewonnen hat, wer allein übrig ist – oder das Liebespaar zu zweit.
 *
 * `meldungen` sind die Todesnachrichten, die zu diesem Ende geführt haben. Sie
 * müssen mit an den Endstand: mit dem Sieg wird der Morgen übersprungen, und
 * ohne sie erführe niemand, wer in der letzten Nacht gestorben ist und warum.
 */
function pruefeEnde(room, meldungen = []) {
  const leben = lebende(room);
  const w = leben.filter((p) => p.rolle === "wolf").length;
  const rest = leben.length - w;

  const paar = leben.filter((p) => p.liebe);
  if (paar.length === 2 && leben.length === 2) {
    return finishGame(room, "liebe", "Das Liebespaar bleibt übrig – die beiden gewinnen zusammen.", meldungen);
  }
  if (w === 0) return finishGame(room, "dorf", "Kein Werwolf mehr am Leben. Das Dorf gewinnt.", meldungen);
  if (w >= rest) return finishGame(room, "wolf", "Die Werwölfe sind in der Überzahl. Sie gewinnen.", meldungen);
  return false;
}

function pruefeFertig(room) {
  if (room.phase !== "playing") return;
  const s = room.schritt;
  if (s === "wolf") {
    const w = woelfe(room);
    if (w.length && w.every((p) => room.opferStimmen.has(p.id))) {
      room.opfer = mehrheit(room.opferStimmen);
      return naechsteNachtrolle(room, "wolf");
    }
  }
  if (s === "wahl") {
    const leben = lebende(room);
    if (leben.length && leben.every((p) => room.stimmen.has(p.id))) return werteWahlAus(room);
  }
  if (s === "rollen") {
    if (lebende(room).every((p) => p.fertig)) return nachtStart(room);
  }
  pushRunde(room);
}

/**
 * Der Rundenzustand geht an jeden einzeln: die Rolle, die Wahlmöglichkeiten
 * und das, was nur diese Person weiß, sind pro Spieler verschieden.
 */
function pushRunde(room, nurAn) {
  if (room.phase !== "playing") return;
  const leben = lebende(room);
  const alle = [...room.players.values()]
    .filter((p) => p.rolle)
    .map((p) => ({
      id: p.id, name: p.name, lebt: p.lebt, weg: !p.connected,
      // Die Rolle wird erst nach dem Tod öffentlich.
      rolle: p.lebt ? null : rollenName(p.rolle),
    }));

  const ziel = nurAn ? [nurAn] : [...room.players.values()];
  for (const p of ziel) {
    let aufgabe = null, wahl = [], zusatz = null;
    const dran = p.lebt && p.connected;

    if (room.schritt === "rollen") {
      aufgabe = "rolle";
    } else if (room.schritt === "amor" && dran && p.rolle === "amor") {
      aufgabe = "amor";
      wahl = leben.map((x) => ({ id: x.id, name: x.name }));
    } else if (room.schritt === "wolf" && dran && p.rolle === "wolf") {
      aufgabe = "wolf";
      wahl = leben.filter((x) => x.rolle !== "wolf").map((x) => ({ id: x.id, name: x.name }));
      zusatz = {
        rudel: woelfe(room).map((x) => x.name),
        gewaehlt: room.opferStimmen.get(p.id) ?? null,
        stand: [...room.opferStimmen].map(([w, z]) => `${name(room, w)} → ${name(room, z)}`),
      };
    } else if (room.schritt === "seher" && dran && p.rolle === "seher") {
      aufgabe = "seher";
      wahl = leben.filter((x) => x.id !== p.id).map((x) => ({ id: x.id, name: x.name }));
    } else if (room.schritt === "hexe" && dran && p.rolle === "hexe") {
      aufgabe = "hexe";
      wahl = leben.filter((x) => x.id !== p.id).map((x) => ({ id: x.id, name: x.name }));
      zusatz = {
        opfer: room.opfer ? name(room, room.opfer) : null,
        opferId: room.opfer,
        heil: room.hexeHeil,
        gift: room.hexeGift,
      };
    } else if (room.schritt === "wahl" && dran) {
      aufgabe = "wahl";
      wahl = leben.filter((x) => x.id !== p.id).map((x) => ({ id: x.id, name: x.name }));
      zusatz = { gewaehlt: room.stimmen.get(p.id) ?? null, ab: room.stimmen.size, von: leben.length };
    }

    send(p, {
      t: "runde",
      schritt: room.schritt,
      nacht: room.nachtNr,
      frist: room.frist,
      aufgabe,
      wahl,
      zusatz,
      meineRolle: p.rolle ? rollenName(p.rolle) : null,
      rolleKurz: p.rolle,
      lebe: p.lebt,
      liebe: p.liebe ? name(room, p.liebe) : null,
      sehErgebnis: p.sehErgebnis,
      spieler: alle,
      meldungen: room.meldungen,
      host: p.id === room.hostId,
    });
  }
}

function finishGame(room, sieger, text, meldungen = []) {
  clearTimers(room);
  room.phase = "final";
  room.schritt = "ende";
  const gewinnt = (p) =>
    sieger === "liebe" ? !!p.liebe && p.lebt : sieger === "wolf" ? p.rolle === "wolf" : p.rolle !== "wolf";
  const tabelle = [...room.players.values()]
    .filter((p) => p.rolle)
    .map((p) => ({
      name: p.name,
      wert: `${rollenName(p.rolle)}${gewinnt(p) ? " · gewonnen" : ""}`,
      punkte: gewinnt(p) ? 1 : 0,
    }))
    .sort((a, b) => b.punkte - a.punkte);
  for (const p of room.players.values()) p.ready = false;
  broadcast(room, { t: "final", tabelle, untertitel: text, meldungen });
  pushState(room);
  pushRoomList();
  return true;
}

function backToLobby(room) {
  clearTimers(room);
  room.phase = "lobby";
  room.schritt = "lobby";
  room.rundeNr = 0;
  room.nachtNr = 0;
  room.meldungen = [];
  room.opferStimmen.clear();
  room.stimmen.clear();
  for (const p of room.players.values()) {
    p.ready = false;
    p.rolle = null;
    p.lebt = false;
    p.liebe = null;
    p.sehErgebnis = null;
  }
  pushState(room);
}

// ---------------------------------------------------------------------------
// Nachrichten
// ---------------------------------------------------------------------------

function handle(ws, msg) {
  const room = ws._room;
  const player = ws._player;

  if (msg.t === "ping") return raw(ws, { t: "pong", c: msg.c, s: Date.now() });

  if (msg.t === "browse") {
    if (!ws._room) {
      browsing.add(ws);
      raw(ws, { t: "rooms", rooms: roomList() });
    }
    return;
  }

  if (msg.t === "create") {
    if (room) return;
    if (!darfRaumOeffnen(ws._ip)) {
      return raw(ws, { t: "error", msg: "Zu viele Räume in kurzer Zeit. Warte kurz." });
    }
    raumVermerkt(ws._ip);
    const r = createRoom(msg.isPublic);
    const p = makePlayer(msg.name, true);
    r.hostId = p.id;
    r.players.set(p.id, p);
    attach(ws, r, p);
    pushState(r);
    pushRoomList();
    return;
  }

  if (msg.t === "join") {
    if (room) return;
    const r = rooms.get(String(msg.code ?? "").toUpperCase().trim());
    if (!r) return raw(ws, { t: "error", msg: "Diesen Raum gibt es nicht" });
    if (msg.token) {
      const back = [...r.players.values()].find((p) => p.token === msg.token);
      if (back) {
        if (back.ws && back.ws !== ws && back.ws.readyState === WebSocket.OPEN) {
          try { back.ws.close(4001, "woanders geöffnet"); } catch { /* egal */ }
        }
        attach(ws, r, back);
        pushState(r);
        return;
      }
    }
    if (r.players.size >= MAX_PLAYERS) {
      return raw(ws, { t: "error", msg: `Der Raum ist voll (${MAX_PLAYERS} Spieler)` });
    }
    if (r.phase !== "lobby") return raw(ws, { t: "error", msg: "Die Runde läuft schon" });
    const p = makePlayer(msg.name, false);
    r.players.set(p.id, p);
    attach(ws, r, p);
    pushState(r);
    return;
  }

  if (!room || !player) return;
  room.lastActivity = Date.now();

  switch (msg.t) {
    case "name":
      player.name = cleanName(msg.name);
      pushState(room);
      break;

    case "ready":
      player.ready = !!msg.value;
      pushState(room);
      break;

    case "settings":
      if (player.id !== room.hostId || room.phase !== "lobby") break;
      if (typeof msg.amor === "boolean") room.settings.amor = msg.amor;
      if (typeof msg.hexe === "boolean") room.settings.hexe = msg.hexe;
      if (typeof msg.isPublic === "boolean") room.isPublic = msg.isPublic;
      pushState(room);
      pushRoomList();
      break;

    case "start": {
      if (player.id !== room.hostId || room.phase !== "lobby") break;
      const da = anwesende(room);
      if (da.length < MIN_PLAYERS) break;
      if (!da.every((p) => p.ready || p.id === room.hostId)) break;
      startGame(room);
      break;
    }

    // Rollenkarte gesehen – sonst redet jemand los, bevor alle wissen, wer
    // sie sind. Dasselbe Muster wie in Imposter.
    case "gesehen":
      if (room.schritt !== "rollen") break;
      player.fertig = true;
      pruefeFertig(room);
      break;

    case "amor": {
      if (room.schritt !== "amor" || player.rolle !== "amor" || !player.lebt) break;
      const a = room.players.get(String(msg.a ?? ""));
      const b = room.players.get(String(msg.b ?? ""));
      if (!a || !b || a === b || !a.lebt || !b.lebt) break;
      a.liebe = b.id;
      b.liebe = a.id;
      naechsteNachtrolle(room, "amor");
      break;
    }

    case "wolf": {
      if (room.schritt !== "wolf" || player.rolle !== "wolf" || !player.lebt) break;
      const z = room.players.get(String(msg.ziel ?? ""));
      if (!z || !z.lebt || z.rolle === "wolf") break;
      room.opferStimmen.set(player.id, z.id);
      pruefeFertig(room);
      break;
    }

    case "seher": {
      if (room.schritt !== "seher" || player.rolle !== "seher" || !player.lebt) break;
      const z = room.players.get(String(msg.ziel ?? ""));
      if (!z || !z.lebt || z.id === player.id) break;
      player.sehErgebnis = `${z.name}: ${z.rolle === "wolf" ? "ein Werwolf!" : "kein Werwolf."}`;
      naechsteNachtrolle(room, "seher");
      break;
    }

    case "hexe": {
      if (room.schritt !== "hexe" || player.rolle !== "hexe" || !player.lebt) break;
      if (msg.heilen && room.hexeHeil && room.opfer) {
        room.geheilt = true;
        room.hexeHeil = false;
      }
      if (msg.gift && room.hexeGift) {
        const z = room.players.get(String(msg.gift));
        if (z && z.lebt && z.id !== player.id) {
          room.gift = z.id;
          room.hexeGift = false;
        }
      }
      naechsteNachtrolle(room, "hexe");
      break;
    }

    case "wahl": {
      if (room.schritt !== "wahl" || !player.lebt) break;
      const z = room.players.get(String(msg.ziel ?? ""));
      if (!z || !z.lebt || z.id === player.id) break;
      room.stimmen.set(player.id, z.id);
      pruefeFertig(room);
      break;
    }

    // Weiter drücken: der Host bringt Morgen/Abend und das Reden voran.
    case "weiter": {
      if (player.id !== room.hostId) break;
      if (room.schritt === "morgen") setzeSchritt(room, "tag", TAG_MS);
      else if (room.schritt === "abend") nachtStart(room);
      else if (room.schritt === "tag") setzeSchritt(room, "wahl", FRIST.wahl);
      break;
    }

    case "ende":
      if (player.id !== room.hostId || room.phase !== "playing") break;
      finishGame(room, "dorf", "Der Host hat die Partie beendet.");
      break;

    case "again":
      if (player.id !== room.hostId || room.phase !== "final") break;
      backToLobby(room);
      break;

    case "leave":
      dropPlayer(ws, { immediate: true });
      break;
  }
}

starte({ port: PORT, host: HOST, publicDir: PUBLIC, titel: "NACHTWACHE", handle, dropPlayer });
