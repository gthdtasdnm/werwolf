// Türkisch und Englisch für Nachtwache.
//
// Deutsch steht im HTML und in den Aufrufen von `t()` bzw. als `text` in den
// Servermeldungen. Warteraum und Endstand kommen aus `schale-texte.js`.
//
// Die Rollennamen stehen unter `ww.rolle.*`: der Server schickt in seinen
// Meldungen die Kurzform der Rolle mit (`w.rk`), und erst der Client setzt den
// Namen in der Sprache ein, die dieser Mensch eingestellt hat.

import { SCHALE_WOERTER } from "./schale-texte.js";

const EIGEN = {
  tr: {
    "werwolf.tag": "Geceleri kurtlar avlanır. Gündüz köy tartışır.",

    // Rollen
    "ww.rolle.wolf": "Kurt adam",
    "ww.rolle.dorf": "Köylü",
    "ww.rolle.seher": "Kâhin",
    "ww.rolle.hexe": "Cadı",
    "ww.rolle.amor": "Amor",
    "ww.rollentext.wolf": "Geceleri sürüyle avlanırsın. Gündüzse köyün en masum insanısın.",
    "ww.rollentext.dorf": "Özel bir yeteneğin yok. Silahın dinlemek.",
    "ww.rollentext.seher": "Her gece bir kişiyi yoklayabilirsin: kurt adam mı, değil mi.",
    "ww.rollentext.hexe": "Bir şifa iksirin ve bir zehrin var – her biri bütün oyunda bir kez.",
    "ww.rollentext.amor": "İlk gece iki kişiyi âşık edersin. Sonrasında köylüsün.",

    // Schritte
    "ww.schritt.rollen": "Roller",
    "ww.schritt.amor": "Amor",
    "ww.schritt.wolf": "Kurt adamlar",
    "ww.schritt.seher": "Kâhin",
    "ww.schritt.hexe": "Cadı",
    "ww.schritt.morgen": "Sabah",
    "ww.schritt.tag": "Gündüz",
    "ww.schritt.abend": "Akşam",
    "ww.schritt.wahl": "Oylama",
    "ww.schritt.ende": "Son",

    // Der Spielbildschirm
    "ww.nacht": "Gece",
    "ww.deineRolle": "Senin rolün",
    "ww.zuschauer": "İzleyici",
    "ww.schaustZu": "Sen izliyorsun.",
    "ww.gesehen": "Gördüm",
    "ww.alleBestaetigen": "Herkes onaylayınca gece olur.",
    "ww.tot": "öldü",
    "ww.lebt": "yaşıyor",
    "ww.weg": "yok",
    "ww.gesehenErgebnis": "Görüldü – {was}",
    "ww.amorKopf": "Âşık olacak iki kişiyi seç.",
    "ww.rudel": "Sürü: {namen}",
    "ww.opferWaehlen": "Bir kurban üzerinde anlaşın.",
    "ww.seherKopf": "Bu gece kimi yokluyorsun?",
    "ww.opferIst": "Gecenin kurbanı: {name}",
    "ww.keinOpfer": "Bu gece kurban yok.",
    "ww.heilen": "İyileştir",
    "ww.nichtsTun": "Bir şey yapma",
    "ww.gift": "Ya da zehri kullan (oyunda bir kez):",
    "ww.werHaengt": "Kim asılsın?",
    "ww.abgestimmt": "{von} kişiden {ab} kişi oy verdi.",
    "ww.redet": "Konuşun.",
    "ww.redetTxt": "Kim yaptı? Oda sahibi oylamaya geçirir.",
    "ww.schlafen": "Herkes uyuyor …",
    "ww.schlafenTxt": "Telefonu bırak ve konuşma.",
    "ww.zurWahl": "Oylamaya",
    "ww.naechsteNacht": "Sonraki gece",
    "ww.weiter": "Devam",
    "ww.bistTot": "Öldün – izle ve sus.",
    "ww.dabei": "var",
    "ww.ohne": "yok",

    // Was der Server schickt
    "ww.niemandTot": "Bu gece kimse ölmedi.",
    "ww.totNacht": "{name} geceyi atlatamadı. Rolü: {rolle}.",
    "ww.totTag": "{name} köy tarafından asıldı. Rolü: {rolle}.",
    "ww.liebeskummer": "{name} aşk acısından öldü. Rolü: {rolle}.",
    "ww.keineEinigung": "Köy anlaşamadı. Kimse ölmüyor.",
    "ww.siegLiebe": "Geriye âşıklar kaldı – ikisi birlikte kazandı.",
    "ww.siegDorf": "Hayatta kurt adam kalmadı. Köy kazandı.",
    "ww.siegWolf": "Kurt adamlar sayıca üstün. Onlar kazandı.",
    "ww.wert": "{rolle}",
    "ww.wertGewonnen": "{rolle} · kazandı",

    // Die Hilfe
    "ww.h1": "<b>Anlatıcı sunucudur.</b> Rolleri o dağıtır ve geceleri kimin sırası olduğunu söyler.",
    "ww.h2": "<b>Geceleri</b> kurt adamlar uyanır ve bir kurban üzerinde anlaşır. Sonra kâhin (bir kişiyi yoklar) ve cadı (bir kez iyileştirebilir, bir kez zehirleyebilir).",
    "ww.h3": "<b>Amor</b> ilk gece iki kişiyi âşık eder. Biri ölürse diğeri aşk acısından ölür.",
    "ww.h4": "<b>Gündüz konuşulur</b> – yüksek sesle, odada, telefonda değil. Sonra herkes kimin şüpheli olduğunu oylar.",
    "ww.h5": "<b>Köy kazanır</b>, eğer hayatta kurt adam kalmazsa. Kurtlar sayıca üstün gelirse onlar kazanır.",
    "ww.h6": "<b>Ölenler izler</b> ve artık hiçbir şey söyleyemez. Rolleri açılır.",
  },

  en: {
    "werwolf.tag": "At night the wolves hunt. By day the village argues.",

    // Rollen
    "ww.rolle.wolf": "Werewolf",
    "ww.rolle.dorf": "Villager",
    "ww.rolle.seher": "Seer",
    "ww.rolle.hexe": "Witch",
    "ww.rolle.amor": "Cupid",
    "ww.rollentext.wolf": "At night you hunt with the pack. By day you are the most harmless person in the village.",
    "ww.rollentext.dorf": "You have no special ability. Listening is your weapon.",
    "ww.rollentext.seher": "Every night you may check one person: werewolf or not.",
    "ww.rollentext.hexe": "You have one healing potion and one poison – each once per game.",
    "ww.rollentext.amor": "On the first night you pair up two people. After that you are a villager.",

    // Schritte
    "ww.schritt.rollen": "Roles",
    "ww.schritt.amor": "Cupid",
    "ww.schritt.wolf": "Werewolves",
    "ww.schritt.seher": "Seer",
    "ww.schritt.hexe": "Witch",
    "ww.schritt.morgen": "Morning",
    "ww.schritt.tag": "Day",
    "ww.schritt.abend": "Evening",
    "ww.schritt.wahl": "Vote",
    "ww.schritt.ende": "End",

    // Der Spielbildschirm
    "ww.nacht": "Night",
    "ww.deineRolle": "Your role",
    "ww.zuschauer": "Spectator",
    "ww.schaustZu": "You are watching.",
    "ww.gesehen": "Got it",
    "ww.alleBestaetigen": "Once everyone confirms, night falls.",
    "ww.tot": "dead",
    "ww.lebt": "alive",
    "ww.weg": "away",
    "ww.gesehenErgebnis": "Seen – {was}",
    "ww.amorKopf": "Choose two people to fall in love.",
    "ww.rudel": "Pack: {namen}",
    "ww.opferWaehlen": "Agree on a victim.",
    "ww.seherKopf": "Who do you check tonight?",
    "ww.opferIst": "Tonight's victim: {name}",
    "ww.keinOpfer": "There is no victim tonight.",
    "ww.heilen": "Heal",
    "ww.nichtsTun": "Do nothing",
    "ww.gift": "Or use the poison (once per game):",
    "ww.werHaengt": "Who hangs?",
    "ww.abgestimmt": "{ab} of {von} have voted.",
    "ww.redet": "Talk.",
    "ww.redetTxt": "Who was it? The host moves on to the vote.",
    "ww.schlafen": "Everyone is asleep …",
    "ww.schlafenTxt": "Put the phone down and say nothing.",
    "ww.zurWahl": "To the vote",
    "ww.naechsteNacht": "Next night",
    "ww.weiter": "Next",
    "ww.bistTot": "You are dead – watch and keep quiet.",
    "ww.dabei": "in",
    "ww.ohne": "out",

    // Was der Server schickt
    "ww.niemandTot": "Nobody died tonight.",
    "ww.totNacht": "{name} did not survive the night. Role: {rolle}.",
    "ww.totTag": "{name} was condemned by the village. Role: {rolle}.",
    "ww.liebeskummer": "{name} dies of a broken heart. Role: {rolle}.",
    "ww.keineEinigung": "The village could not agree. Nobody dies.",
    "ww.siegLiebe": "The lovers are what is left – the two of them win together.",
    "ww.siegDorf": "No werewolf left alive. The village wins.",
    "ww.siegWolf": "The werewolves outnumber the rest. They win.",
    "ww.wert": "{rolle}",
    "ww.wertGewonnen": "{rolle} · won",

    // Die Hilfe
    "ww.h1": "<b>The server is the narrator.</b> It hands out the roles and says who is up at night.",
    "ww.h2": "<b>At night</b> the werewolves wake up and agree on a victim. Then the seer (who checks one person) and the witch (who can heal once and poison once).",
    "ww.h3": "<b>Cupid</b> pairs up two people on the first night. If one dies, the other dies of a broken heart.",
    "ww.h4": "<b>By day you talk</b> – out loud, in the room, not on the phone. Then everyone votes on who is suspicious.",
    "ww.h5": "<b>The village wins</b> once no werewolf is alive. The wolves win once they outnumber the rest.",
    "ww.h6": "<b>The dead watch on</b> and may not give anything away. Their role is revealed.",
  },
};

export const WOERTER = {
  tr: { ...SCHALE_WOERTER.tr, ...EIGEN.tr },
  en: { ...SCHALE_WOERTER.en, ...EIGEN.en },
};
