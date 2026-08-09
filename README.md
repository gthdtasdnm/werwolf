# Nachtwache 🌙

Werwolf ohne Erzähler. Der Server teilt die Rollen aus, führt durch die Nacht
und deckt am Morgen auf – niemand muss die Augen zuhalten und trotzdem alles
mitbekommen. Geredet wird trotzdem laut im Raum; das Handy ist nur die
Kartenhand.

Der Name „Die Werwölfe von Düsterwald" ist geschützt, die Regeln sind es nicht.
Deshalb heißt das Spiel hier **Nachtwache**, und alle Texte sind eigene.

Läuft auf **Deno**, ohne eine einzige externe Abhängigkeit. Kein Build-Schritt,
kein `node_modules`, ein Prozess.

---

## Starten

```bash
deno task dev          # http://localhost:8067/
PORT=9000 deno task dev
deno task check        # Typprüfung
deno task probe        # spielt eine ganze Partie durch (Server muss laufen)
```

Zum Ausprobieren allein: die Seite in **mehreren Browserfenstern** öffnen. Jedes
Fenster ist ein eigener Spieler (die Sitzung hängt am `sessionStorage`, ein
zweiter Tab im selben Fenster wäre dieselbe Person).

## An den Tisch kommen

Name eintippen, **Raum eröffnen** oder über die Liste bzw. den vierstelligen
**Code** beitreten. Der geteilte Link mit `#CODE` führt direkt hinein.

**Vier bis zwölf** Leute. Vier ist die Untergrenze, weil mit weniger die erste
Nacht schon fast entscheidet. Die Rollen hängen an der Gruppengröße:

| Leute | Werwölfe | Seherin | Hexe | Amor |
|---|---|---|---|---|
| 4 | 1 | ja | – | – |
| 5–7 | 1 | ja | ja | ab 6 |
| 8–11 | 2 | ja | ja | ja |
| 12 | 3 | ja | ja | ja |

Hexe und Amor kann der Host vor dem Start abschalten.

## Eine Nacht

1. **Rollenkarte.** Jeder sieht seine eigene und bestätigt. Erst wenn alle
   bestätigt haben, wird es Nacht – sonst redet jemand los, bevor der Rest
   weiß, wer er ist.
2. **Amor** (nur in der ersten Nacht) verkuppelt zwei Leute. Stirbt einer,
   stirbt der andere aus Liebeskummer. Bleiben die beiden allein übrig,
   gewinnen sie zusammen – gegen alle.
3. **Die Werwölfe** einigen sich auf ein Opfer. Sie sehen ihr Rudel und den
   Zwischenstand der Abstimmung; sonst sieht das niemand.
4. **Die Seherin** prüft eine Person: Werwolf oder nicht. Das Ergebnis steht
   nur auf ihrem Bildschirm.
5. **Die Hexe** erfährt als Einzige, wen es getroffen hat. Sie hat einen
   Heiltrank und ein Gift, jedes einmal in der ganzen Partie.
6. **Morgen.** Der Server sagt, wer gestorben ist und welche Rolle er hatte.
7. **Tag.** Reden. Danach stimmen alle Lebenden ab, wer verurteilt wird.

Das Dorf gewinnt, wenn kein Werwolf mehr lebt. Die Wölfe gewinnen, wenn sie in
der Überzahl sind.

## Fristen

Ohne sie hängt die ganze Runde an einer Person, die aufs Klo gegangen ist.

| Schritt | Frist |
|---|---|
| Rollenkarte | 20 s |
| Amor, Wölfe | 60 s |
| Seherin, Hexe | 45 s |
| Reden | 150 s (der Host kann früher weiter) |
| Abstimmung | 90 s |

Läuft die Wolfsfrist ab, ohne dass jemand gewählt hat, sucht der Server ein
Opfer aus. Alles andere verfällt einfach.

## Was nur der Server weiß

Die Rollenverteilung liegt vollständig im Server, und der Rundenzustand geht an
**jeden einzeln**: die Rolle, die Wahlmöglichkeiten und das, was nur diese
Person weiß, sind pro Spieler verschieden. Im Browser eines Dorfbewohners steht
nichts über die Wölfe. Solange jemand lebt, steht seine Rolle bei niemandem in
der Spielerliste; erst der Tod deckt sie auf.

`probe.js` prüft genau das mit sieben Clients – der kleinsten Besetzung, in der
alle fünf Rollen gleichzeitig vorkommen.

## Wenn jemand geht

- Wer die Verbindung verliert, behält seinen Platz eine Minute lang.
- Wer den Raum verlässt, gilt als tot; seine Stimmen verfallen und die Nacht
  bzw. die Abstimmung löst auf, sobald der Rest durch ist. Sie hängt nicht bis
  zum Ablauf der Frist.
- Der Host wandert weiter, wenn er geht.

## Dateien

| Datei | Was |
|---|---|
| `server.js` | Rollen, Nachtablauf, Fristen, Siegprüfung |
| `probe.js` | spielt eine ganze Partie mit sieben Clients durch |
| `bremse.js`, `raum.js`, `statisch.js` | gemeinsam, **wortgleich in allen Spielen** |
| `public/index.html` | alle vier Bildschirme plus die Hilfe |
| `public/schale.js` | gemeinsame Client-Schale (Verbindung, Lobby) |
| `public/style.css` | Lobby-Basis, gemeinsamer Rahmen, darunter das Eigene |
| `public/app.js` | Rollenkarte, Nachtaufgaben, Dorfliste, Endstand |

Die gemeinsamen Teile werden mit `node werkzeug/verteilen.mjs` aus
`/var/www/html/gemeinsam/` verteilt, nicht von Hand gepflegt.

## Betrieb

Port **8067**, gebunden auf `127.0.0.1`, davor Apache als Reverse Proxy unter
`/werwolf/`. Dienst: `werwolf.service` (systemd, läuft als `www-data`).

```bash
systemctl status werwolf
journalctl -u werwolf -f
```

Der Zustand liegt vollständig im RAM. Ein Neustart wirft alle laufenden Partien
weg – das ist gewollt, es gibt nichts zu sichern.
