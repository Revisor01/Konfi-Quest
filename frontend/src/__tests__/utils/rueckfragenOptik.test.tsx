// Rückfragen vor dem Löschen: Symbol und roter Knopf (13.10.2026, Simon im
// Seiten-Interview: „die loeschenmodal duerften ein symbol haben und einen
// roten button").
//
// Geprüft wird an drei Stellen:
//   1. die Einordnung der Knöpfe (reine Funktion, Tabelle mit den Fällen
//      aus dem Code);
//   2. der Beobachter mit ECHTEN Rückfragen: ion-alert rendert in jsdom
//      vollständig (wie in mindestversionHinweis.test.tsx), geöffnet über
//      useIonAlert wie an den rund 70 Stellen der App;
//   3. das Stylesheet theme/rueckfragen.css: nur Tokens, Kontraste hell und
//      dunkel nachgerechnet, und die Regeln schlagen die der Themes ios27 und
//      md3 an Spezifität. Wie es aussieht, rechnet jsdom nicht; angesehen in
//      Chromium (md und ios, hell und dunkel, App und breites Fenster) am
//      13.10.2026.
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, within, act } from '@testing-library/react';
import { IonApp, useIonAlert } from '@ionic/react';
import type { AlertOptions } from '@ionic/react';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import {
  rueckfrageArt,
  rueckfrageKennzeichnen,
  rueckfragenOptikAnschalten,
  RUECKFRAGE_SYMBOL,
  type RueckfrageKnopf,
} from '../../utils/rueckfragenOptik';
import { ICON_LOESCHEN_GEFUELLT, ICON_WARNUNG_GEFUELLT } from '../../components/shared/icons';
import { regeln, spezifitaet, vergleich, teileObersteEbene, letzterVerbund } from '../cssSpezifitaet';

const abbrechen = { text: 'Abbrechen', role: 'cancel' };
const gefahr = (text: string) => [abbrechen, { text, role: 'destructive' }];

describe('rueckfrageArt: welche Rückfrage die Knöpfe ergeben', () => {
  it.each<[string, RueckfrageKnopf[] | undefined, ReturnType<typeof rueckfrageArt>]>([
    ['„Löschen" (Aktivität, Badge, Jahrgang …)', gefahr('Löschen'), 'loeschen'],
    ['„Entfernen" (Mitglied, Zertifikat, Anmeldung)', gefahr('Entfernen'), 'loeschen'],
    ['„Endgültig löschen" (Konfi, Challenge, Beitrag)', gefahr('Endgültig löschen'), 'loeschen'],
    ['„Konto löschen"', gefahr('Konto löschen'), 'loeschen'],
    ['„Trotzdem löschen" (Chat mit Nachrichten)', gefahr('Trotzdem löschen'), 'loeschen'],
    ['„Ganze Serie löschen (12 Events)"', gefahr('Ganze Serie löschen (12 Events)'), 'loeschen'],
    ['„Endgültig leeren" (Team-Chat)', gefahr('Endgültig leeren'), 'loeschen'],
    ['„Leeren" (Zwischenspeicher)', gefahr('Leeren'), 'loeschen'],
    ['„Abmelden"', gefahr('Abmelden'), 'warnung'],
    ['„Verwerfen" (ungespeicherte Änderungen)', gefahr('Verwerfen'), 'warnung'],
    ['„Sperren" (Support-Konto)', gefahr('Sperren'), 'warnung'],
    ['„Chat verlassen"', gefahr('Chat verlassen'), 'warnung'],
    ['„Ausblenden" (Beitrag)', gefahr('Ausblenden'), 'warnung'],
    ['„Deaktivieren" (Gemeinde)', gefahr('Deaktivieren'), 'warnung'],
    ['„Zurückziehen" (Einladung)', gefahr('Zurückziehen'), 'warnung'],
    ['„Löschung beantragen" ist kein Löschen-Wort', gefahr('Löschung beantragen'), 'warnung'],
    ['ohne destructive: Einmalpasswort (Kopieren, Fertig)', [{ text: 'Kopieren' }, { text: 'Fertig', role: 'cancel' }], null],
    ['„Löschen" ohne destructive zählt nicht', [abbrechen, { text: 'Löschen' }], null],
    ['nur Texte („OK")', ['OK'], null],
    ['keine Knöpfe', [], null],
    ['Knöpfe nicht gesetzt', undefined, null],
  ])('%s', (_fall, knoepfe, erwartet) => {
    expect(rueckfrageArt(knoepfe)).toBe(erwartet);
  });

  it('mehrere destructive-Knöpfe: Löschen, sobald einer löscht', () => {
    expect(rueckfrageArt([{ text: 'Verwerfen', role: 'destructive' }, { text: 'Löschen', role: 'destructive' }])).toBe('loeschen');
  });
});

describe('rueckfrageKennzeichnen: Klassen und Symbol am ion-alert', () => {
  const alert = (knoepfe: RueckfrageKnopf[]) => Object.assign(document.createElement('ion-alert'), { buttons: knoepfe });

  it('Löschen: Klassen und der Mülleimer aus der zentralen Icon-Datei', () => {
    const el = alert(gefahr('Löschen'));
    expect(rueckfrageKennzeichnen(el)).toBe('loeschen');
    expect([...el.classList]).toEqual(['app-rueckfrage', 'app-rueckfrage--loeschen']);
    expect(el.style.getPropertyValue(RUECKFRAGE_SYMBOL)).toBe(`url("${ICON_LOESCHEN_GEFUELLT}")`);
  });

  it('Warnung: das Warndreieck', () => {
    const el = alert(gefahr('Abmelden'));
    expect(rueckfrageKennzeichnen(el)).toBe('warnung');
    expect([...el.classList]).toEqual(['app-rueckfrage', 'app-rueckfrage--warnung']);
    expect(el.style.getPropertyValue(RUECKFRAGE_SYMBOL)).toBe(`url("${ICON_WARNUNG_GEFUELLT}")`);
  });

  it('wiederverwendetes Element: neue Knöpfe ohne destructive räumen Klassen und Symbol ab, fremde Klassen bleiben', () => {
    const el = alert(gefahr('Löschen'));
    el.classList.add('md', 'eigene-klasse');
    rueckfrageKennzeichnen(el);
    Object.assign(el, { buttons: [{ text: 'OK' }] });
    expect(rueckfrageKennzeichnen(el)).toBeNull();
    expect([...el.classList]).toEqual(['md', 'eigene-klasse']);
    expect(el.style.getPropertyValue(RUECKFRAGE_SYMBOL)).toBe('');
  });
});

/** Ein Knopf der App, der eine Rückfrage öffnet -- wie an den Aufrufstellen. */
function Oeffner({ optionen }: { optionen: AlertOptions }) {
  const [zeige] = useIonAlert();
  return <button type="button" onClick={() => { void zeige(optionen); }}>Öffnen</button>;
}

/**
 * Öffnet die Rückfrage und wartet, bis sie fertig da ist (Ionic setzt am Ende
 * den Fokus hinein). Ihr Name beginnt mit dem Titel; ein Untertitel hängt
 * sich an (aria-labelledby nennt beide).
 */
async function oeffne(optionen: AlertOptions): Promise<HTMLElement> {
  render(<IonApp><Oeffner optionen={optionen} /></IonApp>);
  fireEvent.click(screen.getByRole('button', { name: 'Öffnen' }));
  const dialog = await screen.findByRole('alertdialog', { name: (name) => name.startsWith(optionen.header ?? '') });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return dialog.closest('ion-alert') as HTMLElement;
}

const LOESCHEN: AlertOptions = { header: 'Aktivität löschen', message: 'Aktivität wirklich löschen?', buttons: gefahr('Löschen') };
const EINMALPASSWORT: AlertOptions = {
  header: 'Einmalpasswort erstellt',
  subHeader: 'Psalm-23-Hirte',
  message: 'Kopiere das Passwort und gib es dem Konfi weiter.',
  buttons: [{ text: 'Kopieren', handler: () => false }, { text: 'Fertig', role: 'cancel' }],
};

describe('rueckfragenOptikAnschalten: echte Rückfragen aus useIonAlert', () => {
  let abschalten: (() => void) | null = null;

  beforeEach(() => { abschalten = rueckfragenOptikAnschalten(); });

  afterEach(() => {
    abschalten?.();
    abschalten = null;
    cleanup();
    document.querySelectorAll('ion-alert').forEach((el) => el.remove());
  });

  it('kennzeichnet die Rückfrage, bevor sie erscheint (beim Ereignis trägt sie noch overlay-hidden)', async () => {
    const beimZeigen: string[] = [];
    const mitschreiben = (e: Event) => { beimZeigen.push((e.target as HTMLElement).className); };
    // Nach dem Beobachter angemeldet: läuft also nach ihm, beim selben Ereignis.
    document.addEventListener('ionAlertWillPresent', mitschreiben);
    try {
      const alert = await oeffne(LOESCHEN);
      expect(alert).toHaveClass('app-rueckfrage', 'app-rueckfrage--loeschen');
      expect(alert.style.getPropertyValue(RUECKFRAGE_SYMBOL)).toBe(`url("${ICON_LOESCHEN_GEFUELLT}")`);
      expect(beimZeigen).toHaveLength(1);
      expect(beimZeigen[0].split(' ')).toEqual(expect.arrayContaining(['overlay-hidden', 'app-rueckfrage', 'app-rueckfrage--loeschen']));
    } finally {
      document.removeEventListener('ionAlertWillPresent', mitschreiben);
    }
  });

  it('die Klasse übersteht ein erneutes Rendern durch Ionic (Stencil gleicht nur eigene Klassen ab)', async () => {
    const alert = await oeffne(LOESCHEN);
    expect(alert).not.toHaveClass('overlay-hidden');
    // header ist eine Eigenschaft des ion-alert: Ändern rendert ihn neu.
    await act(async () => { Object.assign(alert, { header: 'Wirklich löschen?' }); });
    await screen.findByRole('alertdialog', { name: 'Wirklich löschen?' });
    expect(alert).toHaveClass('app-rueckfrage', 'app-rueckfrage--loeschen', 'hydrated');
    expect(alert).not.toHaveClass('overlay-hidden');
    expect(alert.style.getPropertyValue(RUECKFRAGE_SYMBOL)).toBe(`url("${ICON_LOESCHEN_GEFUELLT}")`);
    // Ionics eigener Stil am Element bleibt daneben stehen.
    expect(alert.style.zIndex).not.toBe('');
  });

  it('Warnung: „Verwerfen" bekommt das Warndreieck; die Knöpfe bleiben, wie sie waren', async () => {
    const alert = await oeffne({ header: 'Ungespeicherte Änderungen', message: 'Verwerfen?', buttons: gefahr('Verwerfen') });
    expect(alert).toHaveClass('app-rueckfrage', 'app-rueckfrage--warnung');
    expect(alert).not.toHaveClass('app-rueckfrage--loeschen');
    const knoepfe = within(screen.getByRole('alertdialog')).getAllByRole('button');
    expect(knoepfe.map((k) => k.textContent)).toEqual(['Abbrechen', 'Verwerfen']);
    expect(knoepfe[1]).toHaveClass('alert-button-role-destructive');
  });

  it('ohne destructive bleibt die Rückfrage unverändert: Einmalpasswort ohne Klasse und ohne Symbol', async () => {
    const alert = await oeffne(EINMALPASSWORT);
    expect([...alert.classList].filter((k) => k.startsWith('app-'))).toEqual([]);
    expect(alert.getAttribute('style') ?? '').not.toContain(RUECKFRAGE_SYMBOL);
  });

  it('ohne Anschalten keine Kennzeichnung -- die Klasse kommt vom Beobachter', async () => {
    abschalten?.();
    abschalten = null;
    const alert = await oeffne(LOESCHEN);
    expect([...alert.classList].filter((k) => k.startsWith('app-'))).toEqual([]);
    expect(alert.style.getPropertyValue(RUECKFRAGE_SYMBOL)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Das Stylesheet
// ---------------------------------------------------------------------------

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const ohneKommentare = (quelle: string) => quelle.replace(/\/\*[\s\S]*?\*\//g, '');
const css = ohneKommentare(lies('src/theme/rueckfragen.css'));
const alleRegeln = regeln(css);
const BREIT = "html[data-layout='breit']";

/** Ein Token aus einer CSS-Datei: der erste Wert, der in der Datei steht (hell), oder der im Dunkelblock. */
function token(datei: string, name: string, dunkel = false): string {
  const quelle = ohneKommentare(lies(datei));
  const start = dunkel ? quelle.indexOf('@media (prefers-color-scheme: dark)') : 0;
  const treffer = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,6})\\b`).exec(quelle.slice(Math.max(0, start)));
  if (!treffer) throw new Error(`${name} fehlt in ${datei}`);
  const hex = treffer[1];
  return hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
}

const linear = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const leuchtdichte = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * linear(n >> 16) + 0.7152 * linear((n >> 8) & 255) + 0.0722 * linear(n & 255);
};
const kontrast = (a: string, b: string) => {
  const [x, y] = [leuchtdichte(a), leuchtdichte(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** color-mix(in srgb, farbe anteil%, transparent) über einem Grund. */
const gemischt = (farbe: string, anteil: number, grund: string) => {
  const f = parseInt(farbe.slice(1), 16);
  const g = parseInt(grund.slice(1), 16);
  const kanal = (s: number) => Math.round(((f >> s) & 255) * anteil + ((g >> s) & 255) * (1 - anteil));
  return `#${[16, 8, 0].map((s) => kanal(s).toString(16).padStart(2, '0')).join('')}`;
};

const VARIABLEN = 'src/theme/variables.css';
const IONIC = 'node_modules/@ionic/core/css/core.css';
const IONIC_DUNKEL = 'node_modules/@ionic/react/css/palettes/dark.system.css';

describe('theme/rueckfragen.css', () => {
  it('wird global eingebunden, nach web-ansicht.css (deren --web-Aliasse es liest); App.tsx schaltet den Beobachter an', () => {
    const app = lies('src/App.tsx');
    const zeile = "import './theme/rueckfragen.css';";
    expect(app).toContain(zeile);
    expect(app.indexOf(zeile)).toBeGreaterThan(app.indexOf("import './theme/web-ansicht.css';"));
    expect(app.indexOf(zeile)).toBeGreaterThan(app.indexOf("import './theme/variables.css';"));
    expect(app).toMatch(/useEffect\(\(\) => rueckfragenOptikAnschalten\(\), \[\]\);/);
  });

  it('nur Tokens: keine Hexwerte, keine rgb()/hsl(); Variablen nur --app-, --ion-, --web- und das Rot des iOS-Themes', () => {
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(css.match(/\b(?:rgb|rgba|hsl|hsla)\(/g) ?? []).toEqual([]);
    const fremd = [...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]).filter((v) => !/^--(?:app|ion|web)-/.test(v));
    expect(fremd).toEqual(['--ios-theme-destructive-color']);
    // Das Rot des iOS-Themes nur mit Rückfall auf Ionics Rot.
    expect(css).toContain('var(--ios-theme-destructive-color, var(--ion-color-danger))');
    // Jedes gelesene --web-Token ist in web-ansicht.css definiert.
    const web = new Set([...lies('src/theme/web-ansicht.css').matchAll(/(--web-[\w-]+)\s*:/g)].map((m) => m[1]));
    const gelesen = [...new Set([...css.matchAll(/var\((--web-[\w-]+)/g)].map((m) => m[1]))];
    expect(gelesen.length).toBeGreaterThan(4);
    expect(gelesen.filter((t) => !web.has(t))).toEqual([]);
  });

  it('keine Übergänge und Animationen', () => {
    expect(css).not.toMatch(/(?:^|[\s;{])(?:transition|animation)(?:-[a-z]+)?\s*:/);
    expect(css).not.toContain('@keyframes');
  });

  it('die App berührt es nur an zwei Stellen: am destructive-Knopf (md) und an gekennzeichneten Rückfragen; alles andere nur im breiten Fenster oder an Klassen der Web-Fassung', () => {
    const teile = alleRegeln.flatMap(({ selektor }) => teileObersteEbene(selektor).map((t) => t.trim()));
    expect(teile.length).toBeGreaterThan(20);
    const ohneBreit = teile.filter((t) => !t.startsWith(`${BREIT} `));
    // Die Rückfragen der Web-Fenster (Teil 4) hängen an .web-rueckfrage und
    // .web-rueckfrage-symbol -- Klassen, die nur Bausteine der Web-Fassung
    // setzen (geprüft im nächsten Test).
    expect(ohneBreit.filter((t) => t.startsWith('.web-rueckfrage')).length).toBeGreaterThan(5);
    expect(ohneBreit.filter((t) => !t.startsWith('ion-alert.app-rueckfrage') && !/^ion-alert\.ios\.app-rueckfrage--/.test(t) && !t.startsWith('.web-rueckfrage')))
      .toEqual(['ion-alert.md .alert-button.alert-button-role-destructive']);
    // Die Web-Optik nur für gekennzeichnete Rückfragen -- das Einmalpasswort bleibt auch im Browser, wie es ist.
    expect(teile.filter((t) => t.startsWith(`${BREIT} `) && !t.startsWith(`${BREIT} ion-alert.app-rueckfrage`))).toEqual([]);
  });

  it('Android: der destructive-Knopf ist rot und schlägt Ionics Farbe für .alert-button im md-Modus', () => {
    const regel = alleRegeln.find(({ selektor }) => selektor === 'ion-alert.md .alert-button.alert-button-role-destructive');
    expect(regel?.rumpf).toMatch(/color:\s*var\(--app-color-danger\);/);
    // Ionics md-Stil ist auf das Bauteil beschränkt: Stencil hängt an jeden
    // Verbund eine Klasse (.sc-ion-alert-md), also eine Klasse mehr je Verbund.
    const ionic = regeln(ohneKommentare(lies('node_modules/@ionic/core/dist/collection/components/alert/alert.md.css')))
      .filter(({ rumpf }) => /(?:^|[;\s])color\s*:/.test(rumpf))
      .flatMap(({ selektor }) => teileObersteEbene(selektor).map((t) => t.trim()))
      .filter((t) => /\.alert-button(?![\w-])/.test(letzterVerbund(t)));
    expect(ionic.length).toBeGreaterThan(0);
    const mitBereich = (sel: string): [number, number, number] => {
      const [a, b, c] = spezifitaet(sel);
      return [a, b + sel.trim().split(/\s*[\s>+~]\s*/).length, c];
    };
    const eigene = spezifitaet('ion-alert.md .alert-button.alert-button-role-destructive');
    expect(ionic.filter((t) => vergleich(eigene, mitBereich(t)) <= 0)).toEqual([]);
  });

  it('iOS: das Theme färbt den destructive-Knopf selbst rot -- fällt das bei einem Update weg, fällt es hier auf', () => {
    const theme = lies('node_modules/@rdlabo/ionic-theme-ios27/dist/css/components/ion-alert.css');
    expect(theme).toMatch(/\.alert-button\.alert-button-role-destructive\{color:var\(--ios-theme-destructive-color, var\(--ion-color-danger/);
  });

  it('Kontraste hell und dunkel: roter Text auf der Karte und gefüllter Knopf mindestens 4,5:1, Symbol auf seinem Kreis mindestens 3:1', () => {
    const karte = { hell: token(VARIABLEN, '--app-surface-card'), dunkel: token(VARIABLEN, '--app-surface-card', true) };
    // Die Karte ist auch der Grund der Rückfragen auf Android: dunkel per --ion-overlay-background-color.
    expect(lies(VARIABLEN)).toMatch(/--ion-overlay-background-color:\s*var\(--app-surface-card\);/);
    const appRot = { hell: token(VARIABLEN, '--app-color-danger'), dunkel: token(VARIABLEN, '--app-color-danger', true) };
    const ionRot = { hell: token(IONIC, '--ion-color-danger'), dunkel: token(IONIC_DUNKEL, '--ion-color-danger') };
    const ionAuf = { hell: token(IONIC, '--ion-color-danger-contrast'), dunkel: token(IONIC_DUNKEL, '--ion-color-danger-contrast') };
    const bernstein = { hell: token(VARIABLEN, '--app-text-warnung'), dunkel: token(VARIABLEN, '--app-text-warnung', true) };
    const orange = { hell: token(VARIABLEN, '--app-color-warning'), dunkel: token(VARIABLEN, '--app-color-warning', true) };

    for (const modus of ['hell', 'dunkel'] as const) {
      const k = karte[modus];
      expect(kontrast(appRot[modus], k), `roter Text auf Android, ${modus}`).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(ionAuf[modus], ionRot[modus]), `gefüllter Knopf, ${modus}`).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(appRot[modus], gemischt(appRot[modus], 0.14, k)), `Mülleimer App, ${modus}`).toBeGreaterThanOrEqual(3);
      expect(kontrast(ionRot[modus], gemischt(ionRot[modus], 0.14, k)), `Mülleimer Browser, ${modus}`).toBeGreaterThanOrEqual(3);
      expect(kontrast(bernstein[modus], gemischt(orange[modus], 0.18, k)), `Warndreieck, ${modus}`).toBeGreaterThanOrEqual(3);
    }
    // Warum nicht Ionics Rot für den Text: dunkel auf der Karte zu schwach.
    expect(kontrast(ionRot.dunkel, karte.dunkel)).toBeLessThan(4.5);
    // Die Anteile im Stylesheet sind die hier gerechneten.
    expect(css).toContain('color-mix(in srgb, var(--app-rueckfrage-farbe) 14%, transparent)');
    expect(css).toContain('color-mix(in srgb, var(--app-color-warning) 18%, transparent)');
  });

  // Das Fenster im Browser: auf dem iPad (ios) und am Rechner (md) gelten die
  // Themes ios27 bzw. md3 mit eigenen Regeln für Fenster, Kopf und Knöpfe.
  // Für jedes Element und jede Eigenschaft, die beide setzen, muss die eigene
  // Regel echt schlagen -- dann ist die Ladereihenfolge egal.
  it('im breiten Fenster schlägt jede Regel die der Themes ios27 und md3, je Element und Eigenschaft', () => {
    const ELEMENTE = ['alert-wrapper', 'alert-head', 'alert-title', 'alert-sub-title', 'alert-message', 'alert-input-group', 'alert-input', 'alert-button-group', 'alert-button-inner', 'alert-button'];
    const element = (sel: string) => {
      const verbund = letzterVerbund(sel.trim());
      return ELEMENTE.find((e) => new RegExp(`\\.${e}(?![\\w-])`).test(verbund)) ?? (verbund.startsWith('ion-alert') ? 'host' : `anderes:${verbund}`);
    };
    const familie = (eigenschaft: string) => eigenschaft
      .replace(/^-webkit-/, '')
      .replace(/^(padding|margin)-.*/, '$1')
      .replace(/^border-(?:top|right|bottom|left|color|style|width)$/, 'border')
      .replace(/^background-color$/, 'background');
    const eigenschaften = (rumpf: string) => new Set(rumpf.split(';').map((d) => d.split(':')[0].trim()).filter(Boolean).map(familie));
    const zerlegt = (quelle: string) => regeln(quelle).flatMap(({ selektor, rumpf }) =>
      teileObersteEbene(selektor).map((sel) => ({ sel: sel.trim(), element: element(sel), eigenschaften: eigenschaften(rumpf) })));

    const themes = [
      ...zerlegt(lies('node_modules/@rdlabo/ionic-theme-ios27/dist/css/components/ion-alert.css')),
      ...zerlegt(lies('node_modules/@rdlabo/ionic-theme-md3/dist/css/components/ion-alert.css')),
    ]
      // role 'preferred' setzt die App nirgends (geprüft unten).
      .filter(({ sel }) => !sel.includes('alert-button-role-preferred'));
    const eigene = zerlegt(css).filter(({ sel }) => sel.startsWith(`${BREIT} `));
    expect(eigene.length).toBeGreaterThan(15);
    expect(themes.length).toBeGreaterThan(15);

    const verlierer: string[] = [];
    let verglichen = 0;
    for (const e of eigene) {
      for (const t of themes) {
        if (t.element !== e.element) continue;
        if (![...e.eigenschaften].some((x) => t.eigenschaften.has(x))) continue;
        verglichen++;
        if (vergleich(spezifitaet(e.sel), spezifitaet(t.sel)) <= 0) verlierer.push(`${e.sel}  <=  ${t.sel}`);
      }
    }
    expect(verglichen).toBeGreaterThan(15);
    expect(verlierer).toEqual([]);
  });

  it('role „preferred" (vom Vergleich oben ausgenommen) kommt in der App nicht vor', () => {
    const dateien = (ordner: string): string[] => readdirSync(ordner).flatMap((n) => {
      const p = join(ordner, n);
      if (statSync(p).isDirectory()) return n === '__tests__' ? [] : dateien(p);
      return /\.tsx?$/.test(n) ? [p] : [];
    });
    const quellen = dateien(resolve(process.cwd(), 'src'));
    expect(quellen.length).toBeGreaterThan(300);
    expect(quellen.filter((d) => /role:\s*['"]preferred['"]/.test(readFileSync(d, 'utf8')))).toEqual([]);
  });

  it('im breiten Fenster wie der WebDialog: Karte, Knopfleiste rechts unter einer Linie, „Abbrechen" sekundär, destructive rot gefüllt', () => {
    const rumpf = (ende: string) => alleRegeln.find(({ selektor }) => selektor === `${BREIT} ion-alert.app-rueckfrage:is(.ios, .md)${ende}`)?.rumpf ?? '';
    expect(rumpf(' .alert-wrapper')).toMatch(/background:\s*var\(--web-karte\);/);
    expect(rumpf(' .alert-wrapper')).toMatch(/border-radius:\s*var\(--app-radius-karte\);/);
    expect(rumpf(' .alert-wrapper')).toMatch(/box-shadow:\s*var\(--app-schatten-modal\);/);
    const leiste = rumpf(' .alert-wrapper .alert-button-group');
    expect(leiste).toMatch(/flex-direction:\s*row;/);
    expect(leiste).toMatch(/justify-content:\s*flex-end;/);
    expect(leiste).toMatch(/border-top:\s*1px solid var\(--web-linie-leise\);/);
    expect(rumpf(' .alert-wrapper .alert-button-group .alert-button:not(.alert-button-role-destructive)')).toMatch(/color:\s*var\(--web-text\);/);
    const rot = rumpf(' .alert-wrapper .alert-button-group .alert-button.alert-button-role-destructive');
    expect(rot).toMatch(/background:\s*var\(--ion-color-danger\);/);
    expect(rot).toMatch(/color:\s*var\(--ion-color-danger-contrast\);/);
    expect(rumpf(' .alert-wrapper .alert-button-group .alert-button')).toMatch(/text-transform:\s*none;/);
    expect(rumpf(' .alert-wrapper .alert-button-group .alert-button:focus-visible')).toMatch(/outline:\s*2px solid var\(--ion-color-primary\);/);
  });

  it('das Symbol: Kreis und Maske im Kopf, die Maske liest das Symbol des Beobachters', () => {
    const rumpf = (sel: string) => alleRegeln.find(({ selektor }) => selektor === sel)?.rumpf ?? '';
    expect(rumpf('ion-alert.app-rueckfrage .alert-head')).toMatch(/display:\s*grid;/);
    expect(rumpf('ion-alert.app-rueckfrage .alert-head::before')).toMatch(/background:\s*var\(--app-rueckfrage-kreis\);/);
    const symbol = rumpf('ion-alert.app-rueckfrage .alert-head::after');
    expect(symbol).toContain(`mask: var(${RUECKFRAGE_SYMBOL}) center`);
    expect(symbol).toContain(`-webkit-mask: var(${RUECKFRAGE_SYMBOL}) center`);
    expect(rumpf('ion-alert.app-rueckfrage--warnung')).toMatch(/--app-rueckfrage-farbe:\s*var\(--app-text-warnung\);/);
  });

  // Teil 4: Rückfragen, die selbst ein Fenster der Web-Fassung sind
  // (WebDialog mit `rueckfrage`) oder eine Zeile darin (Datei löschen im
  // Material). Sie sollen aussehen wie die ion-alerts im breiten Fenster.
  describe('Rückfragen der Web-Fenster (.web-rueckfrage)', () => {
    const rumpf = (sel: string) => alleRegeln.find(({ selektor }) => selektor === sel)?.rumpf ?? '';
    /** Die Erklärungen eines Rumpfs als Eigenschaft -> Wert. */
    const erklaerungen = (text: string) => Object.fromEntries(text.split(';').map((d) => d.split(':')).filter((t) => t.length === 2).map(([e, w]) => [e.trim(), w.trim()]));
    const ALERT_ROT = `${BREIT} ion-alert.app-rueckfrage:is(.ios, .md) .alert-wrapper .alert-button-group .alert-button.alert-button-role-destructive`;

    it('die Klassen setzen nur Bausteine der Web-Fassung -- die App unter 992 px bleibt unberührt', () => {
      const dateien = (ordner: string): string[] => readdirSync(ordner).flatMap((n) => {
        const p = join(ordner, n);
        if (statSync(p).isDirectory()) return n === '__tests__' ? [] : dateien(p);
        return /\.tsx?$/.test(n) ? [p] : [];
      });
      const mitKlasse = dateien(resolve(process.cwd(), 'src')).filter((d) => readFileSync(d, 'utf8').includes('web-rueckfrage'));
      const relativ = mitKlasse.map((d) => d.slice(resolve(process.cwd(), 'src').length + 1).replace(/\\/g, '/')).sort();
      expect(relativ).toEqual([
        'components/admin/web/leitung/WebMaterialDialog.tsx',
        'components/web/WebDialog.tsx',
        'components/web/WebRueckfrageSymbol.tsx',
      ]);
    });

    it('der folgenreiche Knopf ist rot gefüllt -- dasselbe Rot wie bei den Rückfragen der App im Browser, mit dunklerem Rot beim Überfahren', () => {
      const rot = erklaerungen(rumpf('.web-rueckfrage .web-knopf--gefahr'));
      const alert = erklaerungen(rumpf(ALERT_ROT));
      expect(rot).toEqual({
        'border-color': 'var(--ion-color-danger)',
        background: 'var(--ion-color-danger)',
        color: 'var(--ion-color-danger-contrast)',
      });
      expect(alert).toEqual(rot);
      const ueber = erklaerungen(rumpf('.web-rueckfrage .web-knopf--gefahr:hover'));
      expect(ueber).toEqual({ 'border-color': 'var(--ion-color-danger-shade)', background: 'var(--ion-color-danger-shade)' });
      expect(erklaerungen(rumpf(`${ALERT_ROT}:hover`))).toEqual(ueber);
    });

    it('der rote Knopf schlägt jede Regel der Web-Fassung für .web-knopf, die Farbe, Grund oder Rand setzt -- die Ladereihenfolge ist egal', () => {
      const FARBE = /^(?:color|background(?:-color)?|border(?:-color)?)$/;
      const webDateien = [
        'src/theme/web-ansicht.css',
        ...readdirSync(resolve(process.cwd(), 'src/theme/web')).filter((n) => n.endsWith('.css')).map((n) => `src/theme/web/${n}`),
      ];
      const fremde = webDateien.flatMap((datei) => regeln(ohneKommentare(lies(datei))).flatMap(({ selektor, rumpf: r }) => {
        const setztFarbe = Object.keys(erklaerungen(r)).some((e) => FARBE.test(e));
        return setztFarbe ? teileObersteEbene(selektor).map((t) => t.trim()) : [];
      }))
        // Was einen Knopf trifft: .web-knopf selbst oder eine Art davon, nicht .web-knopf__text.
        .filter((sel) => /\.web-knopf(?:--[\w-]+)?(?![\w_-])/.test(letzterVerbund(sel)))
        // Primär und Text sind eigene Arten; ein Gefahr-Knopf ist keins von beiden.
        .filter((sel) => !/\.web-knopf--(?:primaer|text)\b/.test(sel));
      expect(fremde).toEqual(expect.arrayContaining(['.web-knopf', '.web-knopf:hover', '.web-knopf--gefahr']));
      const eigen = spezifitaet('.web-rueckfrage .web-knopf--gefahr');
      const eigenUeber = spezifitaet('.web-rueckfrage .web-knopf--gefahr:hover');
      const verlierer = fremde.filter((sel) => vergleich(sel.includes(':hover') ? eigenUeber : eigen, spezifitaet(sel)) <= 0);
      expect(verlierer).toEqual([]);
    });

    it('das Symbol: Kreis in derselben Größe und denselben Farben wie bei den Rückfragen der App im Browser', () => {
      const symbol = erklaerungen(rumpf('.web-rueckfrage-symbol'));
      const imBrowser = erklaerungen(rumpf(`${BREIT} ion-alert.app-rueckfrage:is(.ios, .md)`));
      const kreis = erklaerungen(rumpf('ion-alert.app-rueckfrage'))['--app-rueckfrage-kreis'];
      expect(kreis).toBe('color-mix(in srgb, var(--app-rueckfrage-farbe) 14%, transparent)');
      expect(symbol).toMatchObject({
        // Löschen: das Rot, das die Rückfrage der App im Browser trägt.
        '--app-rueckfrage-farbe': erklaerungen(rumpf(`${BREIT} ion-alert.app-rueckfrage--loeschen:is(.ios, .md)`))['--app-rueckfrage-farbe'],
        '--app-rueckfrage-kreis': kreis,
        width: imBrowser['--app-rueckfrage-groesse'],
        height: imBrowser['--app-rueckfrage-groesse'],
        'font-size': imBrowser['--app-rueckfrage-symbolgroesse'],
        'border-radius': 'var(--app-radius-kreis)',
        background: 'var(--app-rueckfrage-kreis)',
        color: 'var(--app-rueckfrage-farbe)',
      });
      expect(symbol['--app-rueckfrage-farbe']).toBe('var(--ion-color-danger)');
      // Warnung: Bernstein auf Orange, wie bei der App (Kontraste oben gerechnet).
      const warnung = erklaerungen(rumpf('ion-alert.app-rueckfrage--warnung'));
      expect(erklaerungen(rumpf('.web-rueckfrage-symbol--warnung'))).toEqual({
        '--app-rueckfrage-farbe': warnung['--app-rueckfrage-farbe'],
        '--app-rueckfrage-kreis': warnung['--app-rueckfrage-kreis'],
      });
    });

    it('im Kopf des Fensters: Symbol und X in der ersten Zeile, der Titel darunter über die ganze Breite', () => {
      expect(rumpf('.web-rueckfrage .web-dialog__kopf')).toMatch(/display:\s*grid;/);
      expect(rumpf('.web-rueckfrage .web-dialog__kopf > .web-rueckfrage-symbol')).toMatch(/grid-area:\s*1 \/ 1;/);
      expect(rumpf('.web-rueckfrage .web-dialog__kopf > .web-knopf')).toMatch(/grid-area:\s*1 \/ 2;/);
      expect(rumpf('.web-rueckfrage .web-dialog__kopf > .web-dialog__titel')).toMatch(/grid-area:\s*2 \/ 1 \/ 3 \/ 3;/);
      // Schlägt das flex des Kopfs aus web-ansicht.css.
      expect(vergleich(spezifitaet('.web-rueckfrage .web-dialog__kopf'), spezifitaet('.web-dialog__kopf'))).toBeGreaterThan(0);
    });
  });
});
