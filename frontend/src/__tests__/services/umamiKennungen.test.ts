/**
 * Trennung der beiden Umami-Kennungen — und die Orte im Quelltext.
 *
 * Zwei Befunde vom 14.09.2026, beide hier festgenagelt:
 *
 * 1. `main.tsx` — der Einstieg der ANWENDUNG — lud das Umami-Script mit der
 *    Kennung der WERBESEITE. Im Browser zaehlten dadurch beide Kennungen
 *    gleichzeitig; die Zahlen der Werbeseite enthielten App-Nutzung.
 * 2. Vier Stellen setzten denselben Text "Fehler beim Öffnen der Datei" und
 *    kamen als ein einziger Messwert an.
 *
 * Beides laesst sich nur am Quelltext pruefen: die Kennungen stehen in
 * verschiedenen Dateitypen (HTML-Script-Tag vs. Modulkonstante), und ob eine
 * Aufrufstelle ihren Ort mitgibt, sieht man dem Laufzeitverhalten einer
 * einzelnen Komponente nicht an.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WURZEL = resolve(__dirname, '../../..');
const lies = (p: string) => readFileSync(resolve(WURZEL, p), 'utf8');

const APP_KENNUNG = '72da966c-4b34-41f8-9dbe-e7fb7397f6d6';
const WERBE_KENNUNG = 'dfd37276-5ad4-474d-8306-bf3ed9a3a5d3';

describe('In der App zaehlt nur die App-Kennung', () => {
  it('main.tsx laedt kein Umami-Script mehr', () => {
    const main = lies('src/main.tsx');
    expect(main).not.toContain(WERBE_KENNUNG);
    expect(main).not.toContain('t.godsapp.de/script.js');
    expect(main).not.toContain('data-website-id');
  });

  it('die Werbe-Kennung kommt im gesamten App-Quelltext nicht vor', () => {
    // src/ ist die Anwendung. Steht die Werbe-Kennung dort irgendwo, zaehlen
    // wieder zwei Kennungen parallel — genau der behobene Fehler.
    const treffer = sucheInSrc(WERBE_KENNUNG);
    expect(treffer).toEqual([]);
  });

  it('analytics.ts nutzt genau die App-Kennung', () => {
    const analytics = lies('src/services/analytics.ts');
    expect(analytics).toContain(APP_KENNUNG);
    expect(analytics).not.toContain(WERBE_KENNUNG);
  });

  it('die App-Kennung steht an genau einer Stelle im Quelltext', () => {
    // Eine Kennung an mehreren Stellen faellt beim Aendern auseinander.
    expect(sucheInSrc(APP_KENNUNG)).toEqual(['src/services/analytics.ts']);
  });
});

describe('Die Werbeseiten zaehlen unveraendert weiter', () => {
  const werbeseiten = [
    'public/landing.html',
    'public/impressum.html',
    'public/datenschutz.html',
    'public/konto-loeschen.html',
  ];

  it.each(werbeseiten)('%s laedt die Werbe-Kennung selbst', (seite) => {
    const html = lies(seite);
    expect(html).toContain(`data-website-id="${WERBE_KENNUNG}"`);
    expect(html).toContain('https://t.godsapp.de/script.js');
  });

  it.each(werbeseiten)('%s laedt NICHT die App-Kennung', (seite) => {
    expect(lies(seite)).not.toContain(APP_KENNUNG);
  });

  /**
   * Ohne `data-domains` zaehlt Umami von JEDER Domain, unter der die Datei
   * geoeffnet wird. Gemessen am 14.09.2026 ueber 30 Tage: 590 Aufrufe unter
   * der Werbe-Kennung kamen von localhost. Dazu kopiert Capacitor genau diese
   * vier Dateien ins App-Bundle — ein Aufruf im WebView (https://localhost)
   * waere sonst ein "Werbeseiten-Besuch".
   *
   * Das Script vergleicht den Hostnamen EXAKT gegen die Liste (im Tracker:
   * `O && !P.includes(h)`), deshalb wird hier auf die genauen Werte geprueft
   * und nicht bloss auf die Anwesenheit des Attributs.
   */
  it.each(werbeseiten)('%s zaehlt nur von der echten Domain', (seite) => {
    const html = lies(seite);
    expect(html).toContain('data-domains="konfi-quest.de,www.konfi-quest.de"');
  });

  it.each(werbeseiten)('%s traegt data-domains am Umami-Script selbst', (seite) => {
    // Das Attribut muss IM Script-Tag stehen — irgendwo sonst im Dokument
    // (etwa in einem Kommentar) liest der Tracker es nicht.
    const html = lies(seite);
    const scriptTag = html.match(
      /<script[^>]*t\.godsapp\.de\/script\.js[^>]*><\/script>/
    );
    expect(scriptTag).not.toBeNull();
    expect(scriptTag![0]).toContain(`data-website-id="${WERBE_KENNUNG}"`);
    expect(scriptTag![0]).toContain('data-domains="konfi-quest.de,www.konfi-quest.de"');
  });

  it.each(werbeseiten)('%s sperrt localhost aus', (seite) => {
    // Gegenprobe zur Messung: der Hostname, unter dem die 590 Aufrufe
    // entstanden sind, darf in der Freigabeliste NICHT vorkommen — auch nicht
    // der des App-WebViews, der ebenfalls "localhost" heisst.
    const liste = lies(seite).match(/data-domains="([^"]*)"/);
    expect(liste).not.toBeNull();
    const domains = liste![1].split(',').map((d) => d.trim());
    expect(domains).toEqual(['konfi-quest.de', 'www.konfi-quest.de']);
    expect(domains).not.toContain('localhost');
    expect(domains).not.toContain('127.0.0.1');
  });
});

/**
 * Die Startseite ist zweierlei zugleich: Werbung fuer Neue und die Tuer zum
 * Login fuer Bestandsnutzer:innen. Gemessen (30 Tage, Stand 14.09.2026): von
 * 396 Sitzungen waren 86 Durchlaeufer (21,7 %), 67 gingen von hier direkt nach
 * /login oder /register.
 *
 * Markiert wird ueber `data-tag`, weil Umami den Tag an JEDES Ereignis der
 * Sitzung haengt — auch an den Seitenaufruf. Das vorhandene Ereignis
 * `app-oeffnen` reicht dafuer nicht: es entsteht erst beim Klick, da ist der
 * Seitenaufruf laengst als Werbe-Aufruf gezaehlt.
 */
describe('Durchlaeufer werden auf der Startseite markiert', () => {
  const landing = () => lies('public/landing.html');

  it('der Tag wird gesetzt, bevor der Tracker laeuft', () => {
    const html = landing();
    // Der Tracker liest `data-tag` EINMAL beim Ausfuehren (currentScript).
    // Er traegt `defer`, der markierende Block ist ein normales Inline-Script
    // — nur deshalb laeuft die Markierung vorher. Faellt das `defer` weg,
    // liest der Tracker das Attribut, bevor es gesetzt ist.
    const trackerTag = html.match(
      /<script[^>]*t\.godsapp\.de\/script\.js[^>]*><\/script>/
    );
    expect(trackerTag).not.toBeNull();
    expect(trackerTag![0]).toContain('defer');
    expect(trackerTag![0]).toContain('id="umami-script"');

    // Und der markierende Block steht NACH dem Tracker-Tag im Dokument.
    const posTracker = html.indexOf(trackerTag![0]);
    const posMarkierung = html.indexOf("getElementById('umami-script')");
    expect(posMarkierung).toBeGreaterThan(posTracker);

    // Beides noch im <head>, also vor jedem Ereignis.
    expect(posMarkierung).toBeLessThan(html.indexOf('</head>'));
  });

  it('es gibt genau zwei Markierungen, und zwar diese', () => {
    const html = landing();
    const gesetzt = [...html.matchAll(/'(durchlauf|werbung)'/g)].map((m) => m[1]);
    expect(new Set(gesetzt)).toEqual(new Set(['durchlauf', 'werbung']));
    expect(html).toContain(
      "s.setAttribute('data-tag', (angemeldet || ausDerApp) ? 'durchlauf' : 'werbung');"
    );
  });

  it('geprueft wird nur die EXISTENZ des Schluessels, nie sein Wert', () => {
    const html = landing();
    // Beide Schreibweisen: heutiger Praefix und der alte Name, den
    // migrateStorage.ts als Rueckfallebene stehen laesst.
    expect(html).toContain("localStorage.getItem('CapacitorStorage.konfi_token') !== null");
    expect(html).toContain("localStorage.getItem('konfi_token') !== null");

    // Datenschutz: Der Token darf die Seite nie verlassen. Es gibt keine
    // Stelle, an der ein gelesener Wert weitergereicht wird.
    const markierung = html.slice(
      html.indexOf("getElementById('umami-script')"),
      html.indexOf('</head>')
    );
    expect(markierung).not.toMatch(/track\(/);
    expect(markierung).not.toMatch(/fetch\(/);

    // Der Wert wird nirgends uebernommen: JEDER getItem-Aufruf wird direkt
    // gegen null verglichen und ergibt damit ein Ja/Nein. Ein blosses
    // "steht kein '= localStorage.getItem' im Text" wuerde hier nicht
    // greifen — `angemeldet = localStorage.getItem(x) !== null` ist genau
    // das Erlaubte und saehe fuer so eine Regel wie ein Verstoss aus.
    const aufrufe = [...markierung.matchAll(/localStorage\.getItem\([^)]*\)\s*(.{0,9})/g)];
    expect(aufrufe.length).toBe(2);
    for (const treffer of aufrufe) {
      expect(treffer[1].trimStart().startsWith('!== null')).toBe(true);
    }
  });

  it('ein fehlgeschlagener Zugriff faellt auf "nicht erkannt" zurueck', () => {
    // localStorage wirft im Privatmodus und bei gesperrten Websitedaten.
    // Dann gilt "nicht angemeldet" — die Seite zaehlt als Werbung, nicht als
    // Durchlauf. Lieber eine zu niedrige Durchlauf-Zahl als eine erfundene.
    const html = landing();
    expect(html).toContain('catch(_){ angemeldet = false; }');
    expect(html).toContain('catch(_){ ausDerApp = false; }');
  });

  it('der Verweis aus der App zaehlt nur bei gleicher Herkunft', () => {
    const html = landing();
    expect(html).toContain('new URL(document.referrer).origin === location.origin');
  });

  it('die Markierung enthaelt keinerlei Personenbezug', () => {
    const html = landing();
    const markierung = html.slice(
      html.indexOf("getElementById('umami-script')"),
      html.indexOf('</head>')
    );
    // Die Nutzenden sind ueberwiegend minderjaehrig: gesendet wird genau eines
    // von zwei festen Woertern, sonst nichts.
    for (const verboten of [
      'konfi_user', 'jahrgang', 'organisation', 'org_id',
      'user_id', 'email', 'name', 'rolle',
    ]) {
      expect(markierung).not.toContain(verboten);
    }
  });

  it('das Kontroll-Ereignis app-oeffnen bleibt bestehen', () => {
    // Die Markierung ist eine UNTERGRENZE (wer sich nie angemeldet hat, faellt
    // unter "werbung"). Das Klick-Ereignis bleibt als zweite, unabhaengige
    // Messung daneben stehen.
    expect(landing()).toContain("track('app-oeffnen', basis)");
  });
});

describe('Nur die Startseite markiert — die Rechtstexte nicht', () => {
  // Impressum, Datenschutz und Kontoloeschung sind Pflichtseiten, keine
  // Werbung. Dort gibt es keinen Login-Weg und nichts zu trennen.
  it.each(['public/impressum.html', 'public/datenschutz.html', 'public/konto-loeschen.html'])(
    '%s setzt keinen data-tag',
    (seite) => {
      expect(lies(seite)).not.toContain('data-tag');
    }
  );
});

describe('Die vier Datei-Stellen geben je einen eigenen Ort mit', () => {
  // Datei -> erwarteter Ort. Alle vier setzen denselben Nutzertext.
  const stellen: Array<[string, string]> = [
    ['src/components/chat/useChatDateien.ts', 'chat-datei'],
    ['src/components/teamer/pages/TeamerMaterialPage.tsx', 'material-teamer-liste'],
    ['src/components/teamer/pages/TeamerMaterialDetailPage.tsx', 'material-teamer-detail'],
    ['src/components/admin/modals/MaterialFormModal.tsx', 'material-admin-formular'],
  ];

  it.each(stellen)('%s meldet den Ort %s', (datei, ort) => {
    const quelle = lies(datei);
    // Der Nutzertext ist unveraendert — echte Umlaute, kein technischer Zusatz.
    expect(quelle).toContain('Fehler beim Öffnen der Datei');
    expect(quelle).toContain(`ort: '${ort}'`);
    // Und der gefangene Fehler wird mitgegeben, sonst bliebe `art` leer.
    expect(quelle).toMatch(
      new RegExp(`ort: '${ort}',\\s*fehler:`)
    );
  });

  it('die vier Orte sind paarweise verschieden', () => {
    const orte = stellen.map(([, ort]) => ort);
    expect(new Set(orte).size).toBe(4);
  });

  it('keine der vier Stellen setzt die Meldung noch ohne Diagnose', () => {
    for (const [datei] of stellen) {
      const quelle = lies(datei);
      // Frueher: setError('Fehler beim Öffnen der Datei'); — also die Meldung
      // direkt gefolgt von der schliessenden Klammer.
      expect(quelle).not.toMatch(/setError\('Fehler beim Öffnen der Datei'\s*\)/);
    }
  });
});

describe('Nutzertexte bleiben Nutzertexte', () => {
  it('kein technischer Zusatz in der Meldung', () => {
    for (const datei of [
      'src/components/chat/useChatDateien.ts',
      'src/components/teamer/pages/TeamerMaterialPage.tsx',
      'src/components/teamer/pages/TeamerMaterialDetailPage.tsx',
      'src/components/admin/modals/MaterialFormModal.tsx',
    ]) {
      const quelle = lies(datei);
      expect(quelle).not.toMatch(/setError\('Fehler beim Öffnen der Datei[^']*(HTTP|http-|\[|\()/);
    }
  });

  it('echte Umlaute, keine Umschreibung', () => {
    const quelle = lies('src/components/chat/useChatDateien.ts');
    expect(quelle).toContain('Öffnen');
    expect(quelle).not.toContain('Oeffnen der Datei');
  });
});

/**
 * Alle Dateien unter src/, die die gesuchte Zeichenkette enthalten —
 * ohne die Tests. Diese Datei fuehrt beide Kennungen als Sollwerte und wuerde
 * sich sonst selbst als Treffer melden; geprueft werden soll der ausgelieferte
 * Code.
 */
function sucheInSrc(suche: string): string[] {
  const { execFileSync } = require('node:child_process') as typeof import('node:child_process');
  try {
    const ausgabe = execFileSync(
      'grep',
      ['-rl', '--exclude-dir=__tests__', suche, 'src'],
      { cwd: WURZEL, encoding: 'utf8' }
    );
    return ausgabe.trim().split('\n').filter(Boolean).sort();
  } catch {
    // grep meldet Exit-Code 1, wenn es nichts findet.
    return [];
  }
}
