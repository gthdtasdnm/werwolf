// Spielt eine ganze Nachtwache mit sieben Clients durch: Rollen austeilen,
// Amor, Wölfe, Seherin, Hexe (heilen und vergiften), Morgen, Tagwahl,
// Liebeskummer, Sieg des Dorfes, Endstand, Neustart.
//
// Kein Testrahmen, keine Abhaengigkeit – das Skript wirft, wenn etwas nicht
// stimmt, und schreibt sonst mit, was passiert ist. Der Server muss dafuer
// laufen:
//
//   deno task dev            (in einer zweiten Sitzung)
//   deno task probe
// Gegen die Live-Fassung statt gegen den lokalen Server:
//   WS_URL=wss://inf-zeus.de/werwolf/ws deno task probe
//
// Sieben Leute sind die kleinste Besetzung, in der alle fuenf Rollen
// gleichzeitig vorkommen: die Hexe ab fuenf, Amor ab sechs, und einer muss
// uebrig sein, der mitten in der Wahl geht – daran haengt die Pruefung, dass
// eine Abstimmung nicht an einer verschwundenen Person haengen bleibt.

const PORT = Deno.env.get("PORT") ?? "8067";
const URL_WS = Deno.env.get("WS_URL") ?? `ws://127.0.0.1:${PORT}/ws`;

function client(name) {
  const c = {
    name, ws: new WebSocket(URL_WS), you: null, room: null, runde: null,
    final: null, fehler: [],
  };
  c.ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === "joined") c.you = m.you;
    if (m.t === "room") c.room = m;
    if (m.t === "runde") c.runde = m;
    if (m.t === "final") c.final = m;
    if (m.t === "error") c.fehler.push(m.msg);
  };
  c.send = (m) => c.ws.send(JSON.stringify(m));
  c.offen = new Promise((res) => { c.ws.onopen = res; });
  return c;
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

async function bis(bedingung, was, ms = 4000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (bedingung()) return;
    await warte(25);
  }
  throw new Error("Zeitüberschreitung: " + was);
}

const muss = (bedingung, text) => { if (!bedingung) throw new Error(text); };

// --- Sieben Clients in einen Raum -------------------------------------------

const namen = ["Anna", "Ben", "Cem", "Dana", "Emil", "Fee", "Gil"];
const alleC = namen.map(client);
const [erster] = alleC;
await Promise.all(alleC.map((c) => c.offen));

// Nicht oeffentlich: die Probe laeuft auch gegen live, und dort soll kein
// Geisterraum in der Liste stehen.
erster.send({ t: "create", name: namen[0], isPublic: false });
await bis(() => erster.room, "Raum angelegt");
const code = erster.room.code;
console.log("Raum:", code);

for (const c of alleC.slice(1)) c.send({ t: "join", code, name: c.name });
await bis(() => erster.room.players.length === 7, "sieben Spieler");

erster.send({ t: "start" });
await warte(150);
muss(erster.room.phase === "lobby", "Start ging ohne Bereit durch");
console.log("ok  Start blockiert, solange nicht alle bereit sind");

for (const c of alleC.slice(1)) c.send({ t: "ready", value: true });
await bis(() => erster.room.players.every((p) => p.ready || p.host), "alle bereit");

erster.send({ t: "start" });
await bis(() => alleC.every((c) => c.runde?.schritt === "rollen"), "Rollen ausgeteilt");

// --- Die Rollen: Anzahl, Geheimhaltung --------------------------------------

const zaehler = {};
for (const c of alleC) zaehler[c.runde.rolleKurz] = (zaehler[c.runde.rolleKurz] ?? 0) + 1;
muss(zaehler.wolf === 1, `Bei sieben Leuten gehört genau ein Wolf ins Spiel, ausgeteilt: ${zaehler.wolf}`);
muss(zaehler.seher === 1, "Keine oder mehr als eine Seherin");
muss(zaehler.hexe === 1, "Keine Hexe, obwohl ab fünf Leuten eine dabei ist");
muss(zaehler.amor === 1, "Kein Amor, obwohl ab sechs Leuten einer dabei ist");
muss(zaehler.dorf === 3, "Der Rest müsste Dorf sein: " + JSON.stringify(zaehler));

const mit = (r) => alleC.filter((c) => c.runde.rolleKurz === r);
const [W] = mit("wolf"), [S] = mit("seher"), [H] = mit("hexe"), [A] = mit("amor");
const [D1, D2, D3] = mit("dorf");
console.log(`Rollen: Wolf ${W.name} · Seherin ${S.name} · Hexe ${H.name} · Amor ${A.name}` +
  ` · Dorf ${[D1, D2, D3].map((c) => c.name).join(", ")}`);

// Solange jemand lebt, steht seine Rolle bei niemandem in der Spielerliste.
for (const c of alleC) {
  muss(c.runde.spieler.length === 7, "Die Spielerliste ist unvollständig");
  muss(c.runde.spieler.every((s) => s.lebt && s.rolle === null),
    `${c.name} sieht fremde Rollen: ` + JSON.stringify(c.runde.spieler));
}
console.log("ok  jeder kennt nur die eigene Rolle, keine fremde steht in der Liste");

// --- Nacht 1: Amor ----------------------------------------------------------

for (const c of alleC) c.send({ t: "gesehen" });
await bis(() => A.runde.schritt === "amor", "Amor ist dran");
muss(A.runde.aufgabe === "amor", "Amor bekommt keine Aufgabe");
muss(A.runde.wahl.length === 7, "Amor kann nicht alle verkuppeln");
for (const c of alleC.filter((x) => x !== A)) {
  muss(c.runde.aufgabe === null, `${c.name} bekommt eine Aufgabe, obwohl Amor dran ist`);
  muss(c.runde.wahl.length === 0, `${c.name} bekommt Amors Wahlliste`);
}
console.log("ok  in der Amornacht hat nur Amor eine Aufgabe");

// Fremder Zugriff: ein Dorfbewohner verkuppelt niemanden.
D3.send({ t: "amor", a: D1.you, b: D2.you });
await warte(150);
muss(A.runde.schritt === "amor", "Ein Dorfbewohner konnte verkuppeln");
console.log("ok  nur Amor darf verkuppeln");

// Zwei Dorfbewohner verlieben sich – so haengt am Liebeskummer spaeter keine
// Rolle, die das Spielende verschiebt.
A.send({ t: "amor", a: D1.you, b: D2.you });
await bis(() => W.runde.schritt === "wolf", "die Wölfe sind dran");
await bis(() => D1.runde.liebe === D2.name && D2.runde.liebe === D1.name, "verliebt");
muss(D3.runde.liebe === null, "Ein Unbeteiligter erfährt vom Liebespaar");
muss(A.runde.liebe === null, "Amor selbst wurde mitverkuppelt");
console.log(`ok  ${D1.name} und ${D2.name} sind verliebt, und nur sie beide wissen es`);

// --- Nacht 1: die Wölfe -----------------------------------------------------

muss(W.runde.aufgabe === "wolf", "Der Wolf bekommt keine Aufgabe");
muss(W.runde.wahl.length === 6, "Der Wolf kann nicht alle sechs anderen reißen");
muss(!W.runde.wahl.some((z) => z.id === W.you), "Der Wolf steht in seiner eigenen Wahlliste");
muss(W.runde.zusatz.rudel.length === 1 && W.runde.zusatz.rudel[0] === W.name,
  "Das Rudel stimmt nicht: " + JSON.stringify(W.runde.zusatz?.rudel));
for (const c of alleC.filter((x) => x !== W)) {
  muss(c.runde.aufgabe === null, `${c.name} bekommt die Wolfsaufgabe`);
  muss(c.runde.zusatz === null, `${c.name} sieht, was die Wölfe sehen`);
}
console.log("ok  nur der Wolf sieht das Rudel und die Opferliste");

S.send({ t: "wolf", ziel: D1.you });
await warte(150);
muss(W.runde.schritt === "wolf", "Die Seherin konnte ein Opfer bestimmen");
console.log("ok  wer kein Wolf ist, reißt auch niemanden");

W.send({ t: "wolf", ziel: D1.you });
await bis(() => S.runde.schritt === "seher", "die Seherin ist dran");

// --- Nacht 1: die Seherin ---------------------------------------------------

muss(S.runde.aufgabe === "seher", "Die Seherin bekommt keine Aufgabe");
muss(!S.runde.wahl.some((z) => z.id === S.you), "Die Seherin darf sich selbst prüfen");
S.send({ t: "seher", ziel: W.you });
await bis(() => H.runde.schritt === "hexe", "die Hexe ist dran");
muss(/ein Werwolf!$/.test(S.runde.sehErgebnis ?? ""),
  "Die Seherin hat den Wolf nicht erkannt: " + S.runde.sehErgebnis);
muss(S.runde.sehErgebnis.startsWith(W.name), "Im Sehergebnis steht der falsche Name");
for (const c of alleC.filter((x) => x !== S)) {
  muss(c.runde.sehErgebnis === null, `${c.name} sieht das Ergebnis der Seherin`);
}
console.log(`ok  die Seherin erkennt den Wolf („${S.runde.sehErgebnis}“), sonst niemand`);

// --- Nacht 1: die Hexe heilt ------------------------------------------------

muss(H.runde.aufgabe === "hexe", "Die Hexe bekommt keine Aufgabe");
muss(H.runde.zusatz.opfer === D1.name,
  `Die Hexe sieht das falsche Opfer: ${H.runde.zusatz.opfer} statt ${D1.name}`);
muss(H.runde.zusatz.heil === true && H.runde.zusatz.gift === true,
  "Die Hexe startet nicht mit beiden Tränken");
for (const c of alleC.filter((x) => x !== H)) {
  muss(c.runde.zusatz === null, `${c.name} erfährt vor dem Morgen, wen es getroffen hat`);
}
console.log(`ok  nur die Hexe erfährt in der Nacht, dass es ${D1.name} getroffen hat`);

H.send({ t: "hexe", heilen: true });
await bis(() => erster.runde.schritt === "morgen", "Morgen");
muss(erster.runde.meldungen.some((m) => /niemand gestorben/i.test(m)),
  "Trotz Heiltrank ist jemand gestorben: " + JSON.stringify(erster.runde.meldungen));
muss(erster.runde.spieler.every((s) => s.lebt), "Es lebt nicht mehr jeder");
console.log("ok  der Heiltrank hat gewirkt: „" + erster.runde.meldungen[0] + "“");

// --- Tag 1: reden und wählen ------------------------------------------------

D3.send({ t: "weiter" });
await warte(150);
muss(erster.runde.schritt === "morgen", "Ein Gast konnte weiterschalten");
console.log("ok  nur der Host bringt den Morgen weiter");

erster.send({ t: "weiter" });
await bis(() => erster.runde.schritt === "tag", "Tag");
erster.send({ t: "weiter" });
await bis(() => erster.runde.schritt === "wahl", "Abstimmung");

muss(erster.runde.aufgabe === "wahl", "Der Host darf nicht mitwählen");
muss(erster.runde.wahl.length === 6, "Man kann nicht alle sechs anderen wählen");
muss(!erster.runde.wahl.some((z) => z.id === erster.you), "Man steht in der eigenen Wahlliste");

// Sich selbst wählen geht nicht.
D3.send({ t: "wahl", ziel: D3.you });
await warte(150);
muss(D3.runde.zusatz.ab === 0, "Eine Stimme auf sich selbst wurde gezählt");
console.log("ok  niemand wählt sich selbst");

// Alle ausser Gil stimmen fuer Amor; Amor stimmt fuer den Wolf.
for (const c of [W, S, H, D1, D2]) c.send({ t: "wahl", ziel: A.you });
A.send({ t: "wahl", ziel: W.you });
await bis(() => erster.runde.zusatz?.ab === 6, "sechs Stimmen");
muss(erster.runde.schritt === "wahl", "Ohne die siebte Stimme aufgelöst");
console.log("ok  die Abstimmung wartet auf die letzte Stimme");

// Gil geht, statt zu stimmen – die Runde darf nicht daran haengen bleiben.
D3.send({ t: "leave" });
await bis(() => erster.runde.schritt === "abend", "nach Gils Abgang aufgelöst");
console.log(`ok  ${D3.name} geht mitten in der Abstimmung, die Runde löst trotzdem auf`);

const totA = erster.runde.spieler.find((s) => s.id === A.you);
muss(totA && !totA.lebt, "Der Meistgewählte lebt noch");
muss(totA.rolle === "Amor", "Nach dem Tod steht die Rolle nicht in der Liste: " + totA.rolle);
muss(erster.runde.spieler.filter((s) => s.lebt).length === 5, "Es sind nicht fünf übrig");
console.log(`ok  ${A.name} wurde verurteilt, die Rolle steht jetzt offen da`);

// --- Nacht 2: kein Amor mehr, dafür der Gifttrank ---------------------------

erster.send({ t: "weiter" });
await bis(() => W.runde.schritt === "wolf", "zweite Nacht, die Wölfe");
muss(W.runde.nacht === 2, "Die Nacht wurde nicht weitergezählt");
console.log("ok  in der zweiten Nacht kommt Amor nicht noch einmal dran");

W.send({ t: "wolf", ziel: D1.you });
await bis(() => S.runde.schritt === "seher", "die Seherin, zweite Nacht");
S.send({ t: "seher", ziel: D2.you });
await bis(() => H.runde.schritt === "hexe", "die Hexe, zweite Nacht");

muss(/kein Werwolf\.$/.test(S.runde.sehErgebnis ?? ""),
  "Ein Dorfbewohner wurde als Wolf gemeldet: " + S.runde.sehErgebnis);
muss(H.runde.zusatz.heil === false, "Der Heiltrank ist noch da, obwohl er verbraucht ist");
muss(H.runde.zusatz.gift === true, "Der Gifttrank fehlt");
console.log("ok  der verbrauchte Heiltrank kommt nicht wieder, der Gifttrank ist noch da");

H.send({ t: "hexe", gift: W.you });
await bis(() => erster.final, "Endstand");

// --- Was die Nacht angerichtet hat ------------------------------------------

// Der Bericht muss am Endstand hängen, nicht am letzten Rundenzustand: mit dem
// Sieg wird der Morgen übersprungen, eine weitere `runde` kommt nie.
const meldungen = erster.final.meldungen ?? [];
console.log("  " + meldungen.join("\n  "));
muss(meldungen.some((m) => m.startsWith(D1.name)), `${D1.name} fehlt in den Meldungen`);
muss(meldungen.some((m) => m.startsWith(D2.name) && /Liebeskummer/.test(m)),
  `${D2.name} stirbt nicht an Liebeskummer`);
muss(meldungen.some((m) => m.startsWith(W.name)), "Der vergiftete Wolf fehlt in den Meldungen");
for (const c of alleC.filter((x) => x !== D3)) {
  muss((c.final?.meldungen ?? []).length === meldungen.length,
    `${c.name} bekommt den Bericht der letzten Nacht nicht`);
}
console.log("ok  Opfer, Liebeskummer und Gift stehen bei allen im Schlussbericht");

// --- Endstand ---------------------------------------------------------------

const f = erster.final;
muss(/Dorf gewinnt/.test(f.untertitel), "Falscher Sieger: " + f.untertitel);
muss(f.tabelle.length === 6, "Der Endstand hat nicht sechs Zeilen (Gil ist raus)");
const wolfZeile = f.tabelle.find((z) => z.name === W.name);
muss(wolfZeile.punkte === 0, "Der Wolf hat gewonnen, obwohl das Dorf gewinnt");
muss(!/gewonnen/.test(wolfZeile.wert), `Beim Wolf steht „gewonnen“`);
muss(f.tabelle.filter((z) => z.punkte === 1).length === 5, "Es haben nicht fünf gewonnen");
for (let i = 1; i < f.tabelle.length; i++) {
  muss(f.tabelle[i - 1].punkte >= f.tabelle[i].punkte, "Der Endstand ist nicht sortiert");
}
console.log("\nEndstand: " + f.untertitel);
for (const z of f.tabelle) console.log(`  ${z.name.padEnd(6)} ${z.wert}`);
console.log("ok  Endstand vollständig, sortiert, jede Rolle offen");

erster.send({ t: "again" });
await bis(() => erster.room.phase === "lobby", "zurück im Warteraum");
muss(erster.room.players.every((p) => !p.ready), "Bereit wurde nicht zurückgesetzt");
console.log("ok  Nochmal setzt alles zurück");

const uebrig = alleC.filter((c) => c !== D3);
if (uebrig.some((c) => c.fehler.length)) {
  throw new Error("Fehlermeldungen: " + JSON.stringify(uebrig.map((c) => c.fehler)));
}
console.log("\nALLES GRÜN");
Deno.exit(0);
