import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import ts from 'typescript';
import {
  FRONTEND,
  REPO,
  sichtbareTexteDerApp,
  nutzertexteDesBackendsGesamt,
  type SichtbarerText,
} from './sichtbareTexte';

// ---------------------------------------------------------------------------
// Eine Sprache für App und Handbuch (UI-Audit 26.09.2026, BF-10).
//
// Die Oberfläche sagte „Events" und „Badges", das Handbuch „Termine" und
// „Abzeichen" — gezählt 92:41 und 72:33 in der App, 17:102 und 11:148 im
// Handbuch. Simons Entscheidung (27.09.2026): „Ich denke, dass Events,
// Badges, Challenges und Stempel so ein modernes App-Wording treffen."
//
// DIE REGEL (Glossar im Handbuch, Kapitel „Die App bedienen"):
//   - Wo ein Text das DING in der App benennt, heißt es Event(s), Badge(s),
//     Challenge(s), Stempel — „das Event", „das Badge", „die Challenge",
//     „der Stempel".
//   - „Termin" nur, wo der ZEITPUNKT gemeint ist (Datum, Uhrzeit).
//   - „Abzeichen" gibt es als Name nicht mehr.
//   - Zusammensetzungen mit Bindestrich: „Pflicht-Event", „Event-Name".
//
// Ob „Termin" einen Zeitpunkt meint, kann kein Test entscheiden. Deshalb
// steht jede verbleibende Stelle unten in einer Liste, mit Grund. Kommt eine
// neue dazu, fällt dieser Test — und wer ihn liest, entscheidet: Event oder
// Zeitpunkt?
// ---------------------------------------------------------------------------

// seiten/: die gemeinsamen Beschreibungen von App und Web (Reiter, Filter, Leertexte), seit 09.10.2026.
const APP = sichtbareTexteDerApp(['components', 'seiten', 'services', 'navigation', 'utils', 'contexts', 'hooks']);
const BACKEND = nutzertexteDesBackendsGesamt();
const ALLE = [...APP, ...BACKEND];

/**
 * Stellen, an denen „Termin" den Zeitpunkt meint -- jede mit Grund. Geprüft
 * wird gegen den ganzen Text, damit ein neuer Satz mit „Termin" nicht unter
 * eine alte Ausnahme rutscht.
 */
const TERMIN_ALS_ZEITPUNKT: Array<[RegExp, string]> = [
  [/^Konfirmationstermin$/, 'Beschriftung des Konfirmationsdatums in der Konfi-Detailansicht'],
  [/^Noch kein Termin festgelegt$/, 'Konfirmationsdatum fehlt noch'],
  [/^Noch kein Termin gebucht$/, 'Konfirmationsdatum im Konfi-Profil'],
  [/^Konfirmationstermin bereits gebucht$/, 'Sperre bei der zweiten Konfirmation: es geht um das Datum'],
  [/^Du hast bereits einen Konfirmationstermin gebucht\. Bitte melde dich zuerst vom bisherigen Termin ab, bevor du einen neuen buchst\.$/, 'dieselbe Sperre, ausführlich'],
  [/^Keine Konfirmationstermine verfügbar$/, 'Liste der Konfirmationsdaten ist leer'],
  [/^Anderer Termin$/, 'Kennzeichnung: ein anderes Konfirmationsdatum ist gewählt'],
  [/^Letzter Termin:$/, 'Serienvorschau im Formular: Datum des letzten Events'],
  [/^Monate umfassen \(letzter Termin wäre$/, 'Serien-Obergrenze: das Datum des letzten Events'],
  [/^Du bist bereits zu einem Konfirmationstermin angemeldet \("$/, 'Konfirmationssperre im Backend (Text bis zum Namen)'],
  [/^Melde dich dort zuerst ab, um einen anderen Termin zu wählen\.$/, 'dieselbe Sperre, Fortsetzung'],
];

const terminStellen = () => ALLE.filter(({ text }) => /termin/i.test(text));

describe('Begriffe: eine Sprache für App und Backend', () => {
  it('„Abzeichen" steht in keinem sichtbaren Text mehr', () => {
    const treffer = ALLE.filter(({ text }) => /abzeichen/i.test(text)).map(({ ort, text }) => `${ort}: ${text}`);
    expect(treffer).toEqual([]);
  });

  it('„Termin" steht nur noch dort, wo der Zeitpunkt gemeint ist', () => {
    const offen = terminStellen()
      .filter(({ text }) => !TERMIN_ALS_ZEITPUNKT.some(([muster]) => muster.test(text)))
      .map(({ ort, text }) => `${ort}: ${text}`);
    expect(offen).toEqual([]);
  });

  it('jede Zeitpunkt-Ausnahme wird noch gebraucht', () => {
    // Sonst deckt eine veraltete Ausnahme beim nächsten Mal einen echten
    // Rückfall zu.
    const texte = terminStellen().map(({ text }) => text);
    const ungenutzt = TERMIN_ALS_ZEITPUNKT
      .filter(([muster]) => !texte.some((t) => muster.test(t)))
      .map(([muster, grund]) => `${muster} (${grund})`);
    expect(ungenutzt).toEqual([]);
  });

  it('Zusammensetzungen stehen mit Bindestrich', () => {
    // „Event Name", „Pflichtevent", „Serie-Event" standen nebeneinander.
    const muster = /\b(Event|Badge|Challenge|Stempel) (Name|Details|Grunddaten|Datum|Serie|Chat|Punkte|Status|Farbe)\b|Pflicht(event|termin)|Serie-Event/i;
    const treffer = ALLE.filter(({ text }) => muster.test(text)).map(({ ort, text }) => `${ort}: ${text}`);
    expect(treffer).toEqual([]);
  });

  it('das Muster erkennt die alten Schreibungen (Gegenprobe)', () => {
    const muster = /\b(Event|Badge|Challenge|Stempel) (Name|Details|Grunddaten|Datum|Serie|Chat|Punkte|Status|Farbe)\b|Pflicht(event|termin)|Serie-Event/i;
    for (const alt of ['Event Name *', 'Event Details', 'Keine Pflichtevents', 'Pflichttermin', 'Serie-Event löschen']) {
      expect(muster.test(alt), alt).toBe(true);
    }
    for (const neu of ['Event-Name *', 'Event-Details', 'Pflicht-Event', 'Event einer Serie löschen', 'Event absagen']) {
      expect(muster.test(neu), neu).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// „Gemeinde" statt „Organisation" (Simon, 28.09.2026: „Vielleicht sprechen
// wir statt von org von Gemeinde.").
//
// Wer die App nutzt, gehört zu einer Gemeinde — so heißt es in Oberfläche,
// Server-Meldungen, Mails und Handbuch. „Organisation" bleibt nur in
// Bezeichnern (organization_id, /organizations/…) und Kommentaren.
//
// Dasselbe für die Rolle (Simon, 29.09.2026: „Ja, umbenennen."): `org_admin`
// heißt „Gemeindeleitung" statt „Org-Leitung" oder „Org-Admin", und das
// Bedienelement zum Wechseln heißt „Gemeinde-Umschalter" statt
// „Org-Wechsler".
// ---------------------------------------------------------------------------

/** Die alten Wörter für Rolle und Umschalter. */
const ALTE_ORG_BEGRIFFE = /\bOrg[- ]?(Leitung|Admin|Wechsler)/i;

/**
 * Server-Texte, die noch „Organisation" sagen müssen — jede mit Grund.
 * Geprüft wird gegen den ganzen Text.
 */
const ORGANISATION_BLEIBT: Array<[RegExp, string]> = [
  [/^Kein Zugriff auf diese Organisation$/,
    'Die Store-Apps 2.2.0 und 2.3.0 vergleichen den 403 wörtlich (services/api.ts) und fallen nur damit in die Stamm-Gemeinde zurück. Erst ändern, wenn keine App ohne error_code-Prüfung mehr ruft.'],
];

/** Alle Zeichenketten einer Backend-Datei außer console.* — für Mail-Vorlagen, die in lokalen Konstanten stehen. */
function zeichenkettenOhneKonsole(pfad: string): SichtbarerText[] {
  const quelle = readFileSync(pfad, 'utf8');
  const datei = ts.createSourceFile(pfad, quelle, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const raus: SichtbarerText[] = [];
  const geh = (x: ts.Node) => {
    if (ts.isCallExpression(x) && /^console\./.test(x.expression.getText())) return;
    if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)
      || ts.isTemplateHead(x) || ts.isTemplateMiddle(x) || ts.isTemplateTail(x)) {
      const zeile = datei.getLineAndCharacterOfPosition(x.getStart()).line + 1;
      raus.push({ ort: `${relative(REPO, pfad)}:${zeile}`, text: x.text.replace(/\s+/g, ' ').trim() });
    }
    ts.forEachChild(x, geh);
  };
  geh(datei);
  return raus;
}

describe('Begriffe: „Gemeinde" statt „Organisation"', () => {
  const organisationStellen = () => ALLE.filter(({ text }) => /organisation/i.test(text));

  it('kein sichtbarer Text in App und Server-Meldungen sagt „Organisation"', () => {
    const offen = organisationStellen()
      .filter(({ text }) => !ORGANISATION_BLEIBT.some(([muster]) => muster.test(text)))
      .map(({ ort, text }) => `${ort}: ${text}`);
    expect(offen).toEqual([]);
  });

  it('jede Ausnahme wird noch gebraucht', () => {
    const texte = organisationStellen().map(({ text }) => text);
    expect(ORGANISATION_BLEIBT.filter(([muster]) => !texte.some((t) => muster.test(t))).map(([, grund]) => grund)).toEqual([]);
  });

  it('die Mails sagen „Gemeinde"', () => {
    const texte = zeichenkettenOhneKonsole(join(REPO, 'backend/services/emailService.js'));
    // Gegenprobe gegen einen leeren Scan: die Lizenz-Mail wird gefunden.
    expect(texte.some(({ text }) => text.includes('die Lizenz für eure Gemeinde'))).toBe(true);
    expect(texte.filter(({ text }) => /organisation/i.test(text)).map(({ ort, text }) => `${ort}: ${text}`)).toEqual([]);
  });

  it('die Rolle heißt „Gemeindeleitung", der Umschalter „Gemeinde-Umschalter" — in App, Server-Meldungen und Mails', () => {
    const mails = zeichenkettenOhneKonsole(join(REPO, 'backend/services/emailService.js'));
    const treffer = [...ALLE, ...mails]
      .filter(({ text }) => ALTE_ORG_BEGRIFFE.test(text))
      .map(({ ort, text }) => `${ort}: ${text}`);
    expect(treffer).toEqual([]);
  });

  it('das Muster erkennt die alten Wörter (Gegenprobe)', () => {
    for (const alt of ['Die Org-Leitung kann', 'Org-Admin', 'per Org-Wechsler hierher', 'Nur die org-leitung']) {
      expect(ALTE_ORG_BEGRIFFE.test(alt), alt).toBe(true);
    }
    for (const neu of ['Die Gemeindeleitung kann', 'per Gemeinde-Umschalter hierher', 'organization_id', 'Multi-Org']) {
      expect(ALTE_ORG_BEGRIFFE.test(neu), neu).toBe(false);
    }
  });
});

describe('Begriffe: dieselbe Suche in allen drei Rollen', () => {
  // Konfi und Team hatten „Events durchsuchen...", die Leitung „Event
  // suchen..."; bei den Badges ebenso. Ein Feld, das dasselbe tut, heißt
  // überall gleich.
  const lies = (pfad: string) => readFileSync(join(FRONTEND, 'src/components', pfad), 'utf8');
  const suchfelder = (quelle: string, wort: RegExp) =>
    [...quelle.matchAll(/(?:placeholder|aria-label)="([^"]*such[^"]*)"/g)].map((m) => m[1]).filter((t) => wort.test(t));

  it.each([
    ['Leitung', 'admin/EventsView.tsx'],
    ['Konfi', 'konfi/views/EventsView.tsx'],
    ['Team', 'teamer/pages/TeamerEventsPage.tsx'],
  ])('Events, %s: „Events durchsuchen..."', (_rolle, pfad) => {
    expect(suchfelder(lies(pfad), /Event/)).toEqual(['Events durchsuchen', 'Events durchsuchen...']);
  });

  it.each([
    ['Leitung', 'admin/BadgesView.tsx'],
    ['Konfi', 'konfi/views/BadgesView.tsx'],
  ])('Badges, %s: „Badges durchsuchen..."', (_rolle, pfad) => {
    expect(suchfelder(lies(pfad), /Badge/)).toEqual(['Badges durchsuchen', 'Badges durchsuchen...']);
  });
});

describe('Begriffe: die Mitteilungsgruppen heißen wie die Bereiche', () => {
  // Die Android-Kanäle stehen wörtlich in den Systemeinstellungen, die
  // Push-Auswahl in der App kommt vom Server (pushGruppen.js). Dass beide
  // Wort für Wort gleich sind, prüft backend/tests/utils/pushKanaele.test.js.
  it('die App legt die Kanäle „Events" und „Punkte und Badges" an', () => {
    const quelle = readFileSync(join(FRONTEND, 'src/services/notifications.ts'), 'utf8');
    expect(quelle).toContain("name: 'Events',");
    expect(quelle).toContain("name: 'Punkte und Badges',");
    expect(quelle).toContain("description: 'Punkte, Badges, Level, Challenges und der Rückblick',");
  });
});

describe('Begriffe: das Handbuch spricht wie die App', () => {
  // Dieselbe Regel für docs/handbuch/. Gezählt am 27.09.2026 vorher:
  // „Abzeichen" 150-mal, „Termine" 105-mal (dazu Termin, Terminen, Termins
  // und 75 Zusammensetzungen), „Badges" 13-mal, „Events" 17-mal.
  const HANDBUCH = join(FRONTEND, '../docs/handbuch');
  const kapitel = readdirSync(HANDBUCH).filter((d) => d.endsWith('.md'));
  /** Zeilen ohne Link-Ziele: "(70-termine.md#…)" ist ein Dateiname, kein Text. */
  const zeilen = kapitel.flatMap((d) => readFileSync(join(HANDBUCH, d), 'utf8').split('\n')
    .map((z, i) => ({ ort: `${d}:${i + 1}`, text: z.replace(/\]\([^()\s]+\)/g, ']') })));

  /** „Termin" als Zeitpunkt — jede Form mit Grund. */
  const ZEITPUNKT: Array<[RegExp, string]> = [
    [/Konfirmationstermin/, 'Datum der Konfirmation, wie in der App'],
    [/Terminbeginn/, 'Uhrzeit, ab der das Check-in-Fenster rechnet'],
    [/vor dem Termin/, 'Frist, gerechnet vom Datum'],
    [/^Termin näher/, 'der Beginn liegt näher (Anmeldeschluss-Vorschlag)'],
    [/„Anderer Termin"/, 'Beschriftung in der App: ein anderes Konfirmationsdatum'],
    [/Termin und Konfispruch/, 'Konfirmationsdatum in der Detailansicht'],
    [/Terminabfrage/, 'Umfrage nach einem passenden Zeitpunkt'],
    [/Fototermin/, 'Beispiel für ein Event mit Zeitfenstern — der Name, den die Gemeinde vergibt'],
    [/\*\*Termin\*\* heißt nur der Zeitpunkt|„Termin" meint hier nur/, 'das Glossar selbst'],
  ];

  it('findet die Kapitel', () => {
    expect(kapitel.length).toBe(14);
  });

  it('„Abzeichen" kommt nicht mehr vor', () => {
    expect(zeilen.filter(({ text }) => /abzeichen/i.test(text)).map(({ ort, text }) => `${ort}: ${text}`)).toEqual([]);
  });

  it('„Organisation" kommt nicht vor — es heißt „Gemeinde"', () => {
    expect(zeilen.filter(({ text }) => /organisation/i.test(text)).map(({ ort, text }) => `${ort}: ${text}`)).toEqual([]);
  });

  it('die Rolle heißt „Gemeindeleitung" — auch in Überschriften und Verweisen', () => {
    // Ohne die Link-Ziel-Bereinigung: Ein Anker wie #verwaltung-nur-org-leitung
    // zeigte auf eine Überschrift, die es nicht mehr gibt.
    const roh = kapitel.flatMap((d) => readFileSync(join(HANDBUCH, d), 'utf8').split('\n')
      .map((z, i) => ({ ort: `${d}:${i + 1}`, text: z })));
    expect(roh.filter(({ text }) => ALTE_ORG_BEGRIFFE.test(text)).map(({ ort, text }) => `${ort}: ${text}`)).toEqual([]);
  });

  it('„Termin" steht nur für den Zeitpunkt', () => {
    const offen = zeilen
      .filter(({ text }) => /termin/i.test(text))
      .filter(({ text }) => !ZEITPUNKT.some(([muster]) => muster.test(text)))
      .map(({ ort, text }) => `${ort}: ${text}`);
    expect(offen).toEqual([]);
  });

  it('jede Zeitpunkt-Ausnahme wird noch gebraucht', () => {
    const texte = zeilen.map(({ text }) => text);
    expect(ZEITPUNKT.filter(([muster]) => !texte.some((t) => muster.test(t))).map(([, grund]) => grund)).toEqual([]);
  });

  it('das Glossar steht in „Die App bedienen" und nennt alle vier Wörter', () => {
    const bedienung = readFileSync(join(HANDBUCH, '03-bedienung.md'), 'utf8');
    const abschnitt = bedienung.slice(bedienung.indexOf('### Die Begriffe der App kennen'));
    expect(abschnitt.length).toBeLessThan(bedienung.length);
    for (const wort of ['**das Event**', '**das Badge**', '**die Challenge**', '**der Stempel**']) {
      expect(abschnitt).toContain(wort);
    }
    // Wo die Begriffe zuerst auftauchen, führt ein Verweis dorthin.
    expect(readFileSync(join(HANDBUCH, '00-start.md'), 'utf8')).toContain('(03-bedienung.md#die-begriffe-der-app-kennen)');
  });
});

// Die Landingpage spricht wie App und Handbuch (Simon, 29.09.2026:
// "Landingpage auch umstellen"). Geprueft wird der sichtbare Text: ohne
// HTML-Kommentare (dort steht der schema.org-Typ "Organization" als
// Fachwort). Der Tarif fuer mehrere Gemeinden heisst "Verbund".
describe('Begriffe: die Landingpage spricht wie die App', () => {
  const roh = readFileSync(join(FRONTEND, 'public/landing.html'), 'utf8');
  // Wiederholt, bis nichts mehr wegfaellt: Ein einmaliges replace liesse aus
  // verschachtelten Resten wie "<!-<!---->-" wieder ein "<!--" entstehen
  // (CodeQL js/incomplete-multi-character-sanitization, Meldung 128).
  let sichtbar = roh;
  for (let vorher = ''; vorher !== sichtbar;) {
    vorher = sichtbar;
    sichtbar = sichtbar.replace(/<!--[\s\S]*?-->/g, '');
  }

  it('„Organisation" kommt nicht vor — auch nicht in Lizenz und Rollen', () => {
    expect(sichtbar.match(/Organisation\w*/g) ?? []).toEqual([]);
  });

  it('die Rolle heißt „Gemeindeleitung", nicht „Org-Admin" oder „Organisations-Admin"', () => {
    expect(sichtbar.match(ALTE_ORG_BEGRIFFE) ?? []).toEqual([]);
    expect(sichtbar).toContain('Worin unterscheiden sich Gemeindeleitung und Leitung?');
  });

  it('der Tarif für mehrere Gemeinden heißt überall „Verbund"', () => {
    expect(sichtbar).toContain('<div class="tier">Verbund</div>');
    expect(sichtbar).toContain('"name": "Verbund – bis 4 Gemeinden"');
    expect(sichtbar.match(/Verbundlizenz/g)).toHaveLength(2);
  });
});
