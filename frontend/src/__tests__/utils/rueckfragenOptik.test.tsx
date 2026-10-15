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
//   3. am Stylesheet theme/rueckfragen.css nur, was nicht Optik ist: nur
//      Tokens, Kontraste hell und dunkel nachgerechnet, sichtbarer Fokus.
//      Wie die Rückfragen aussehen, legt kein Test fest (Simon, 15.10.2026:
//      das Layout bleibt frei änderbar).
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, within, act } from '@testing-library/react';
import { IonApp, useIonAlert } from '@ionic/react';
import type { AlertOptions } from '@ionic/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  rueckfrageArt,
  rueckfrageKennzeichnen,
  rueckfragenOptikAnschalten,
  RUECKFRAGE_SYMBOL,
  type RueckfrageKnopf,
} from '../../utils/rueckfragenOptik';
import { ICON_LOESCHEN_GEFUELLT, ICON_WARNUNG_GEFUELLT } from '../../components/shared/icons';
import { regeln } from '../cssSpezifitaet';

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
  it('App.tsx schaltet den Beobachter an', () => {
    expect(lies('src/App.tsx')).toMatch(/useEffect\(\(\) => rueckfragenOptikAnschalten\(\), \[\]\);/);
  });

  it('nur Tokens: keine Hexwerte, keine rgb()/hsl(); Variablen nur --app-, --ion-, --web- und das Rot des iOS-Themes mit Rückfall', () => {
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(css.match(/\b(?:rgb|rgba|hsl|hsla)\(/g) ?? []).toEqual([]);
    const fremd = [...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]).filter((v) => !/^--(?:app|ion|web)-/.test(v));
    expect(fremd.filter((v) => v !== '--ios-theme-destructive-color')).toEqual([]);
    // Das Rot des iOS-Themes nur mit Rückfall auf Ionics Rot.
    expect(css.split('var(--ios-theme-destructive-color').length).toBe(css.split('var(--ios-theme-destructive-color, var(--ion-color-danger))').length);
    // Jedes gelesene --web-Token ist in web-ansicht.css definiert.
    const web = new Set([...lies('src/theme/web-ansicht.css').matchAll(/(--web-[\w-]+)\s*:/g)].map((m) => m[1]));
    const gelesen = [...new Set([...css.matchAll(/var\((--web-[\w-]+)/g)].map((m) => m[1]))];
    expect(gelesen.filter((t) => !web.has(t))).toEqual([]);
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
    // Die Anteile im Stylesheet sind die hier gerechneten.
    expect(css).toContain('color-mix(in srgb, var(--app-rueckfrage-farbe) 14%, transparent)');
    expect(css).toContain('color-mix(in srgb, var(--app-color-warning) 18%, transparent)');
  });

  it('im breiten Fenster zeigen die Knöpfe den Tastaturfokus', () => {
    const rumpf = alleRegeln.find(({ selektor }) => selektor === `${BREIT} ion-alert.app-rueckfrage:is(.ios, .md) .alert-wrapper .alert-button-group .alert-button:focus-visible`)?.rumpf ?? '';
    expect(rumpf).toMatch(/outline:\s*2px solid var\(--ion-color-primary\);/);
  });
});
