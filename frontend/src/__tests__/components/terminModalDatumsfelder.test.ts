import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Nutzerhinweis 16.09.2026 (im Browser gesehen): Im Termin-Fenster wurden
// Beschriftungen und Knoepfe abgeschnitten, Beschriftungen lagen unter den
// Datums-Knoepfen, und der Knopf "Zeitfenster hinzufuegen" war unten
// angeschnitten.
//
// Gemessen in der Produktion (Breite 390px und 1280px):
//
// 1. Ionic deckelt ein ion-item mit gestapelter Beschriftung auf
//    --min-height: 55px und setzt overflow: hidden auf .item-native. Das
//    passt fuer ein ion-input, das mitschrumpft. Ein ion-datetime-button ist
//    aber fest 31px hoch: 12px Versatz + 18px Beschriftung + 31px Knopf
//    = 61px. Sechs Pixel zu viel -- und die wurden weggeschnitten.
//
// 2. Die gestapelte Beschriftung wird per transform verschoben. Ihr Text
//    rutscht nach unten, ihr Layout-Kasten bleibt stehen. Ein margin-bottom
//    an der Beschriftung bleibt darum wirkungslos (gemessen: 0px). Der
//    Abstand muss vom Knopf kommen.
//
// 3. app-event-detail__add-button-wrapper zieht mit margin-bottom: -7px mehr
//    zurueck, als Ionic am ion-button setzt (4px). In einer Karte mit
//    overflow: hidden schneidet das die Unterkante des Knopfes ab.
//
// Gegenprobe zu 1 und 3: mit overflow: hidden beziehungsweise -7px war der
// Abstand unter dem Knopf 0px bzw. 3px -- sichtbar angeschnitten.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const ohneKommentare = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const css = ohneKommentare(lies('src/theme/variables.css'));
const modal = ohneKommentare(
  lies('src/components/admin/modals/EventModal.tsx')
);

const block = (quelle: string, selektor: string) => {
  const start = quelle.indexOf(selektor);
  expect(start, `Selektor ${selektor} fehlt`).toBeGreaterThan(-1);
  return quelle.slice(start, quelle.indexOf('}', start) + 1);
};

describe('Datums-Knopf unter gestapelter Beschriftung wird nicht abgeschnitten', () => {
  it('die Klasse app-datumsfeld existiert', () => {
    expect(css).toContain('.app-datumsfeld');
  });

  it('das Item ist nicht mehr auf Ionics 55px gedeckelt', () => {
    expect(block(css, '.app-datumsfeld {')).toContain('--min-height: 0');
  });

  it('das Item schneidet nichts mehr ab', () => {
    expect(block(css, '.app-datumsfeld {')).toContain('overflow: visible');
  });

  it('auch die innere Huelle waechst mit und schneidet nichts ab', () => {
    const teil = block(css, '.app-datumsfeld::part(native)');
    expect(teil).toContain('height: auto');
    expect(teil).toContain('min-height: 0');
    expect(teil).toContain('overflow: visible');
  });

  it('der Knopf haelt Abstand zur Beschriftung', () => {
    expect(block(css, '.app-datumsfeld ion-datetime-button')).toContain(
      'margin-top: 10px'
    );
  });

  it('jeder Datums-Knopf im Termin-Fenster traegt die Klasse', () => {
    const knoepfe = modal.match(/<IonDatetimeButton/g) ?? [];
    const felder = modal.match(/className="app-datumsfeld"/g) ?? [];
    expect(knoepfe.length).toBe(6);
    expect(felder.length).toBe(6);
  });

  it('kein Datums-Knopf steht mehr in einem ungeschuetzten Item', () => {
    // Jedes IonItem, das einen IonDatetimeButton enthaelt, muss die Klasse
    // tragen -- sonst schneidet Ionic dort weiter ab.
    const items = modal.split('<IonItem').slice(1);
    const mitKnopf = items.filter((s) => {
      const bis = s.indexOf('</IonItem>');
      return bis > -1 && s.slice(0, bis).includes('<IonDatetimeButton');
    });
    expect(mitKnopf.length).toBe(6);
    for (const item of mitKnopf) {
      expect(item.slice(0, item.indexOf('>'))).toContain('app-datumsfeld');
    }
  });
});

describe('Knopf am unteren Kartenrand wird nicht angeschnitten', () => {
  it('die Klasse app-modal-knopf-in-karte existiert', () => {
    expect(css).toContain('.app-modal-knopf-in-karte');
  });

  it('sie nimmt nur Ionics eigenen Rand zurueck, nicht mehr', () => {
    expect(block(css, '.app-modal-knopf-in-karte')).toContain(
      'margin-bottom: -4px'
    );
  });

  it('der Zeitfenster-Knopf nutzt sie statt des zu weiten Ausgleichs', () => {
    expect(modal).toContain('app-modal-knopf-in-karte');
    expect(modal).not.toContain('app-event-detail__add-button-wrapper');
  });

  it('der weitere Ausgleich bleibt fuer die Detail-Ansichten bestehen', () => {
    // Die alte Klasse wird anderswo benutzt und darf nicht verschwinden.
    expect(css).toContain('.app-event-detail__add-button-wrapper');
  });
});
