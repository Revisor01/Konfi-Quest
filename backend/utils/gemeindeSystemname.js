// Der Systemname einer neuen Gemeinde (organizations.name und .slug)
// (Nebenbefund Screens/Leitung BF-15, 29.09.2026; Paket I2)
//
// Die App bildet ihn aus dem Anzeigenamen (OrganizationManagementModal.tsx,
// generateSystemName): klein, alles ausser a-z, 0-9 und Leerraum weg,
// Leerraum zu Bindestrichen. Umlaute fallen dabei ersatzlos weg -- aus
// „Büsum" wurde `bsum`. Die ausgelieferten Apps schicken es weiter so; die
// verlorenen Buchstaben kann nur der Server aus dem Anzeigenamen
// zurueckholen.
//
// DESHALB DIESE REGEL fuer POST /organizations: Ist der geschickte Name genau
// der, den die App aus dem Anzeigenamen gebildet haette, bildet der Server
// ihn neu -- mit ä->ae, ö->oe, ü->ue, ß->ss, sonst Schritt fuer Schritt wie
// die App. Ein eigener Name (etwa ueber die Schnittstelle, `ks-sued` fuer
// „Kirchspiel Süd") bleibt, nur Umlaute darin werden ebenso umgeschrieben.
// Namen ohne Umlaute aendern sich nicht.
//
// BESTEHENDE GEMEINDEN WERDEN NICHT UMBENANNT: Keine Gemeinde bekommt einen
// neuen Systemnamen, nur weil es diese Regel gibt.
//
// BEIM BEARBEITEN (PUT /organizations/:id, 09.10.2026) gilt
// systemnameBeimBearbeiten: Die Store-App 2.2.x bildet den Namen bei JEDEM
// Speichern neu und ohne Umlaute -- aus `travemuende` wurde beim Speichern
// wieder `travemnde`. Ab 2.3.0 behaelt die App den gespeicherten Namen,
// solange der Anzeigename bleibt, und bildet ihn sonst mit ae/oe/ue/ss
// (frontend/src/utils/gemeindeSystemname.ts, systemnameZumSpeichern). Der
// Server macht aus dem, was die alte App schickt, dasselbe; was nicht wie die
// alte App gebildet ist, bleibt, wie es kommt.

const UMLAUTE = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', Ä: 'ae', Ö: 'oe', Ü: 'ue', ẞ: 'ss' };

/** ä->ae, ö->oe, ü->ue, ß->ss (auch grosse), sonst unveraendert. */
function umlauteUmschreiben(text) {
  return String(text).replace(/[äöüßÄÖÜẞ]/g, (z) => UMLAUTE[z]);
}

/** Wie die App den Systemnamen bildet (verliert Umlaute). */
function systemnameWieDieApp(anzeigename) {
  return String(anzeigename)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Derselbe Weg, aber Umlaute vorher umgeschrieben. */
function systemnameAusAnzeigename(anzeigename) {
  return systemnameWieDieApp(umlauteUmschreiben(anzeigename));
}

/**
 * Der Systemname, den eine neue Gemeinde bekommt.
 * @param {string} geschickt - name oder slug aus der Anfrage (getrimmt)
 * @param {string} anzeigename - display_name aus der Anfrage
 * @returns {string}
 */
function systemnameFuerNeueGemeinde(geschickt, anzeigename) {
  if (geschickt === systemnameWieDieApp(anzeigename)) {
    return systemnameAusAnzeigename(anzeigename);
  }
  return umlauteUmschreiben(geschickt);
}

/**
 * Der Systemname beim Bearbeiten einer Gemeinde -- dasselbe Ergebnis, ob die
 * Store-App 2.2.x (bildet immer neu, ohne Umlaute) oder eine neuere schickt.
 *
 * Ist der geschickte Name genau der, den die alte App aus dem Anzeigenamen
 * bildet: bei unveraendertem Anzeigenamen bleibt der gespeicherte Name (auch
 * ein alter ohne Umlaut oder ein eigener), sonst entsteht er mit ae/oe/ue/ss.
 * Alles andere bleibt, wie es geschickt wird.
 *
 * @param {string} geschickt - name oder slug aus der Anfrage (getrimmt)
 * @param {string} anzeigename - display_name aus der Anfrage (getrimmt)
 * @param {{wert: string, anzeigename: string}|null} gespeichert - der
 *   gespeicherte name bzw. slug und der gespeicherte Anzeigename; null, wenn
 *   die Gemeinde nicht gefunden wurde
 * @returns {string}
 */
function systemnameBeimBearbeiten(geschickt, anzeigename, gespeichert) {
  if (geschickt !== systemnameWieDieApp(anzeigename)) return geschickt;
  if (gespeichert && gespeichert.wert
      && String(anzeigename).trim() === String(gespeichert.anzeigename || '').trim()) {
    return gespeichert.wert;
  }
  return systemnameAusAnzeigename(anzeigename);
}

module.exports = {
  umlauteUmschreiben,
  systemnameWieDieApp,
  systemnameAusAnzeigename,
  systemnameFuerNeueGemeinde,
  systemnameBeimBearbeiten,
};
