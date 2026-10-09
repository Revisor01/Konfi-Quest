// Laeuft die Support-Mail? (10.10.2026)
//
// Am 08.10.2026 verlor Portainer bei einem Neustart die Stack-Variablen; der
// naechste Deploy rollte ohne MAIL_IMAP_HOST und die Zugaenge der Postfaecher
// aus. Die Backends starteten, das Abholen fiel still aus -- 46 Stunden lang,
// bis es jemand am Posteingang bemerkte. Die Support-Ansicht zeigte zwar
// "zuletzt abgeholt", aber nur dort, wo man ohnehin Mails liest.
//
// Diese Stelle beantwortet die Frage fuer den Betrieb: GET /api/status meldet
// den Gesamtzustand als ein Wort (fuer eine Ueberwachung von aussen),
// GET /api/metrics die Einzelheiten je Postfach (Seite "Betrieb").
//
// Je Postfach:
//   nicht_eingerichtet  Benutzer, Passwort oder IMAP-Host fehlen in der
//                       Umgebung (utils/mailPostfaecher.js, eingerichtet)
//   veraltet            eingerichtet, aber noch nie abgeholt oder der letzte
//                       erfolgreiche Abruf liegt laenger als GRENZE_MINUTEN
//                       zurueck (abgeholt wird alle zwei Minuten,
//                       services/backgroundService.js)
//   ok                  sonst
// Gesamt: ok nur, wenn beide ok sind; fehlt eine Einrichtung, zaehlt das vor
// einem veralteten Abruf (die Ursache vor der Folge).
//
// Das Alter rechnet die Datenbank (NOW() - abgeholt_am), damit eine falsch
// gehende Uhr im Container nichts verfaelscht. Keine Adressen, keine
// Zugangsdaten: Der gespeicherte Fehlertext ist schon ohne Adressen
// (services/mailAbholung.js, fehlerText).

const { allePostfaecher } = require('./mailPostfaecher');

const GRENZE_MINUTEN = 30;

/**
 * @param {{query: Function}} db
 * @param {object} [opt]
 * @param {object} [opt.env]  process.env (Parameter fuer die Tests)
 * @returns {Promise<{
 *   zustand: 'ok'|'nicht_eingerichtet'|'veraltet',
 *   grenzeMinuten: number,
 *   postfaecher: Array<{postfach: string, eingerichtet: boolean, abgeholt_am: string|null,
 *     alter_minuten: number|null, fehler: string|null, zustand: 'ok'|'nicht_eingerichtet'|'veraltet'}>
 * }>}  Wirft, wenn die Tabelle fehlt -- die Aufrufer lassen das Feld dann weg.
 */
async function supportMailZustand(db, { env = process.env } = {}) {
  const { rows } = await db.query(
    `SELECT postfach, abgeholt_am, fehler,
            FLOOR(EXTRACT(EPOCH FROM (NOW() - abgeholt_am)) / 60)::int AS alter_minuten
       FROM mail_abholstand`);
  const stand = new Map(rows.map((r) => [r.postfach, r]));
  const postfaecher = allePostfaecher(env).map((k) => {
    const s = stand.get(k.postfach) || {};
    const alter = s.alter_minuten === undefined || s.alter_minuten === null ? null : Number(s.alter_minuten);
    let zustand = 'ok';
    if (!k.eingerichtet) zustand = 'nicht_eingerichtet';
    else if (alter === null || alter > GRENZE_MINUTEN) zustand = 'veraltet';
    return {
      postfach: k.postfach,
      eingerichtet: k.eingerichtet,
      abgeholt_am: s.abgeholt_am || null,
      alter_minuten: alter,
      fehler: s.fehler || null,
      zustand,
    };
  });
  let zustand = 'ok';
  if (postfaecher.some((p) => p.zustand === 'nicht_eingerichtet')) zustand = 'nicht_eingerichtet';
  else if (postfaecher.some((p) => p.zustand === 'veraltet')) zustand = 'veraltet';
  return { zustand, grenzeMinuten: GRENZE_MINUTEN, postfaecher };
}

module.exports = { supportMailZustand, GRENZE_MINUTEN };
