// NACHTWACHE – Client. Jeder sieht nur, was seine Rolle sehen darf; was das
// ist, entscheidet der Server – hier wird nur gezeichnet, was ankommt.
import { $, binHost, el, S, schicke, starteSchale, zeige } from "./schale.js";

const HILFE = [
  "<b>Der Server ist der Erzähler.</b> Er teilt die Rollen aus und sagt, wer nachts dran ist.",
  "<b>Nachts</b> wachen die Werwölfe auf und einigen sich auf ein Opfer. Danach die Seherin (sie prüft eine Person) und die Hexe (sie kann einmal heilen und einmal vergiften).",
  "<b>Amor</b> verkuppelt in der ersten Nacht zwei Leute. Stirbt einer, stirbt der andere aus Liebeskummer.",
  "<b>Tagsüber wird geredet</b> – laut, im Raum, nicht im Handy. Danach stimmen alle ab, wer verdächtig ist.",
  "<b>Das Dorf gewinnt</b>, wenn kein Werwolf mehr lebt. Die Wölfe gewinnen, wenn sie in der Überzahl sind.",
  "<b>Tote schauen zu</b> und dürfen nichts mehr verraten. Ihre Rolle wird aufgedeckt.",
];

const ROLLENTEXT = {
  wolf: "Du jagst nachts mit dem Rudel. Am Tag bist du der harmloseste Mensch im Dorf.",
  dorf: "Du hast keine Sonderfähigkeit. Deine Waffe ist Zuhören.",
  seher: "Jede Nacht darfst du eine Person prüfen: Werwolf oder nicht.",
  hexe: "Du hast einen Heiltrank und ein Gift – jeweils einmal in der ganzen Partie.",
  amor: "In der ersten Nacht verkuppelst du zwei Leute. Danach bist du Dorfbewohner.",
};

let amorWahl = [];
let uhrZiel = 0;

function uhr() {
  const u = $("uhr");
  if (!u) return;
  const rest = Math.max(0, Math.ceil((uhrZiel - Date.now()) / 1000));
  u.textContent = uhrZiel ? rest + "s" : "";
}
setInterval(uhr, 500);

function wahlGitter(wahl, klick, gewaehlt) {
  const g = el("div", "wahlgitter");
  for (const w of wahl) {
    const b = el("button", "btn wahl" + (gewaehlt === w.id ? " on" : ""), w.name);
    b.onclick = () => klick(w);
    g.append(b);
  }
  return g;
}

function zeichneSpiel(m) {
  zeige("game");
  uhrZiel = m.frist || 0;
  const nacht = ["amor", "wolf", "seher", "hexe"].includes(m.schritt);
  document.body.classList.toggle("istnacht", nacht);

  $("tbLinks").innerHTML = `Nacht <strong>${m.nacht}</strong> <span id="uhr"></span>`;
  $("tbTag").textContent = {
    rollen: "Rollen", amor: "Amor", wolf: "Werwölfe", seher: "Seherin", hexe: "Hexe",
    morgen: "Morgen", tag: "Tag", abend: "Abend", wahl: "Abstimmung", ende: "Ende",
  }[m.schritt] ?? m.schritt;
  uhr();

  const b = $("buehne");
  b.innerHTML = "";

  // Rollenkarte
  if (m.schritt === "rollen") {
    const k = el("div", "rollenkarte " + m.rolleKurz);
    k.append(el("p", "rk-klein", "Deine Rolle"));
    k.append(el("h2", "rk-name", m.meineRolle ?? "Zuschauer"));
    k.append(el("p", "rk-text", ROLLENTEXT[m.rolleKurz] ?? "Du schaust zu."));
    b.append(k);
    const ok = el("button", "btn primary big", "Habe ich gesehen");
    ok.onclick = () => { schicke({ t: "gesehen" }); ok.disabled = true; };
    b.append(ok);
    $("rundenHint").textContent = "Alle bestätigen, dann wird es Nacht.";
    return;
  }

  // Meldungen des Erzählers
  if (m.meldungen?.length && ["morgen", "abend", "tag", "wahl"].includes(m.schritt)) {
    const box = el("div", "erzaehler");
    for (const t of m.meldungen) box.append(el("p", null, t));
    b.append(box);
  }

  // Eigene Rolle als Streifen
  const streifen = el("div", "meinerolle");
  streifen.append(el("span", "mr-name", m.meineRolle ?? "Zuschauer"));
  if (m.liebe) streifen.append(el("span", "mr-liebe", "💘 " + m.liebe));
  if (!m.lebe) streifen.append(el("span", "mr-tot", "tot"));
  b.append(streifen);
  if (m.sehErgebnis) b.append(el("div", "seherbox", "Gesehen – " + m.sehErgebnis));

  // Aufgabe
  const auf = el("div", "aufgabe");
  if (m.aufgabe === "amor") {
    auf.append(el("p", "auf-kopf", "Wähle zwei Personen, die sich verlieben."));
    auf.append(wahlGitter(m.wahl, (w) => {
      if (amorWahl.includes(w.id)) amorWahl = amorWahl.filter((x) => x !== w.id);
      else if (amorWahl.length < 2) amorWahl.push(w.id);
      if (amorWahl.length === 2) schicke({ t: "amor", a: amorWahl[0], b: amorWahl[1] });
      zeichneSpiel(m);
    }, null));
    for (const btn of auf.querySelectorAll(".wahl")) {
      const w = m.wahl.find((x) => x.name === btn.textContent);
      if (w && amorWahl.includes(w.id)) btn.classList.add("on");
    }
  } else if (m.aufgabe === "wolf") {
    auf.append(el("p", "auf-kopf", "Rudel: " + m.zusatz.rudel.join(", ")));
    auf.append(el("p", "auf-txt", "Einigt euch auf ein Opfer."));
    auf.append(wahlGitter(m.wahl, (w) => schicke({ t: "wolf", ziel: w.id }), m.zusatz.gewaehlt));
    if (m.zusatz.stand.length) auf.append(el("p", "auf-txt", m.zusatz.stand.join(" · ")));
  } else if (m.aufgabe === "seher") {
    auf.append(el("p", "auf-kopf", "Wen prüfst du heute Nacht?"));
    auf.append(wahlGitter(m.wahl, (w) => schicke({ t: "seher", ziel: w.id }), null));
  } else if (m.aufgabe === "hexe") {
    const z = m.zusatz;
    auf.append(el("p", "auf-kopf", z.opfer ? `Das Opfer der Nacht: ${z.opfer}` : "Diese Nacht gibt es kein Opfer."));
    const reihe = el("div", "row gap");
    if (z.heil && z.opferId) {
      const h = el("button", "btn primary", "Heilen");
      h.onclick = () => schicke({ t: "hexe", heilen: true });
      reihe.append(h);
    }
    const w = el("button", "btn ghost", "Nichts tun");
    w.onclick = () => schicke({ t: "hexe" });
    reihe.append(w);
    auf.append(reihe);
    if (z.gift) {
      auf.append(el("p", "auf-txt", "Oder das Gift benutzen (einmal pro Partie):"));
      auf.append(wahlGitter(m.wahl, (x) => schicke({ t: "hexe", gift: x.id }), null));
    }
  } else if (m.aufgabe === "wahl") {
    auf.append(el("p", "auf-kopf", "Wer soll hängen?"));
    auf.append(wahlGitter(m.wahl, (w) => schicke({ t: "wahl", ziel: w.id }), m.zusatz.gewaehlt));
    auf.append(el("p", "auf-txt", `${m.zusatz.ab}/${m.zusatz.von} haben abgestimmt.`));
  } else if (m.schritt === "tag") {
    auf.append(el("p", "auf-kopf", "Redet."));
    auf.append(el("p", "auf-txt", "Wer war es? Der Host schaltet zur Abstimmung."));
  } else if (["amor", "wolf", "seher", "hexe"].includes(m.schritt)) {
    auf.append(el("p", "auf-kopf", "Alle schlafen …"));
    auf.append(el("p", "auf-txt", "Handy weglegen und nichts sagen."));
  }
  if (auf.childNodes.length) b.append(auf);

  // Dorfliste
  const liste = el("div", "dorf");
  for (const p of m.spieler) {
    const d = el("div", "dp" + (p.lebt ? "" : " tot"));
    d.append(el("span", "dp-nm", p.name));
    d.append(el("span", "dp-rl", p.lebt ? (p.weg ? "weg" : "lebt") : (p.rolle ?? "tot")));
    liste.append(d);
  }
  b.append(liste);

  // Weiter-Knopf für den Host
  const akt = $("aktionen");
  akt.innerHTML = "";
  if (m.host && ["morgen", "abend", "tag"].includes(m.schritt)) {
    const w = el("button", "btn primary big",
      m.schritt === "tag" ? "Zur Abstimmung" : m.schritt === "abend" ? "Nächste Nacht" : "Weiter");
    w.onclick = () => schicke({ t: "weiter" });
    akt.append(w);
  }
  $("rundenHint").textContent = m.lebe ? "" : "Du bist tot – zuschauen und schweigen.";
}

/**
 * Der Endstand mit dem Bericht der letzten Nacht davor.
 *
 * Ohne den Bericht endet die Partie mit einem Satz („Das Dorf gewinnt"), und
 * wer in der letzten Nacht gestorben ist – und ob am Gift, am Rudel oder am
 * Liebeskummer – erführe niemand mehr: der Sieg überspringt den Morgen.
 */
function zeichneFinal(m) {
  zeige("final");
  const sub = $("finalSub");
  sub.innerHTML = "";
  for (const t of m.meldungen ?? []) sub.append(el("p", null, t));
  sub.append(el("p", "final-sieg", m.untertitel ?? ""));

  const ol = $("podium");
  ol.innerHTML = "";
  for (const z of m.tabelle ?? []) {
    const li = el("li");
    li.append(el("span", "pd-name", z.name));
    li.append(el("span", "pd-pt", String(z.wert ?? z.punkte ?? "")));
    ol.append(li);
  }
  $("againBtn").hidden = !binHost();
}

$("helpList").innerHTML = HILFE.map((h) => `<li>${h}</li>`).join("");

const extra = $("hostExtra");
extra.innerHTML = `
  <div class="setting"><span class="setting-label">Hexe</span>
    <div class="segmented">
      <button class="seg" data-hexe="1">dabei</button><button class="seg" data-hexe="0">ohne</button>
    </div></div>
  <div class="setting"><span class="setting-label">Amor</span>
    <div class="segmented">
      <button class="seg" data-amor="1">dabei</button><button class="seg" data-amor="0">ohne</button>
    </div></div>`;
for (const b of extra.querySelectorAll("[data-hexe]")) {
  b.onclick = () => schicke({ t: "settings", hexe: b.dataset.hexe === "1" });
}
for (const b of extra.querySelectorAll("[data-amor]")) {
  b.onclick = () => schicke({ t: "settings", amor: b.dataset.amor === "1" });
}

starteSchale({
  key: "werwolf",
  zeichneSpiel,
  zeichneFinal,
  zeichneRaum: (r) => {
    for (const b of extra.querySelectorAll("[data-hexe]")) {
      b.classList.toggle("sel", (b.dataset.hexe === "1") === !!r.settings.hexe);
    }
    for (const b of extra.querySelectorAll("[data-amor]")) {
      b.classList.toggle("sel", (b.dataset.amor === "1") === !!r.settings.amor);
    }
  },
});
void S;
