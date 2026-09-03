import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { istWebLink, hostAus, materialLinks } from '../../utils/linkDisplay';

// Material kann seit dem 31.08.2026 statt Dateien auch einen Link tragen
// (Simons Entscheidung). Anlass: Fuer das inhaltliche Programm entstehen
// eigene Seiten (konfi-quest.de/gottesbilder), die sich direkt am Material
// verknuepfen lassen sollen.
//
// Diese Tests halten drei Dinge fest, die sonst leicht wieder verloren gehen:
//   1. Der Link bekommt ein EIGENES Icon, damit er sich vom Dateianhang
//      unterscheidet (Vorgabe: IonIcon, keine Emojis).
//   2. Er wird nur gerendert, wenn er http/https ist (istWebLink) -- sonst
//      koennte ein praeparierter Wert in ein href geraten.
//   3. Er oeffnet EXTERN im Browser, auf demselben Weg wie Kartenlinks und
//      Links in Chatnachrichten (window.open mit _blank).

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const formular = lies('src/components/admin/modals/MaterialFormModal.tsx');
const leitungsListe = lies('src/components/admin/pages/AdminMaterialPage.tsx');
const teamerListe = lies('src/components/teamer/pages/TeamerMaterialPage.tsx');
const teamerDetail = lies('src/components/teamer/pages/TeamerMaterialDetailPage.tsx');
const leitungTermin = lies('src/components/admin/views/EventDetailSections.tsx');
const teamerTermin = lies('src/components/teamer/pages/TeamerEventsPage.tsx');

// Seit dem 01.09.2026 gilt Simons Regel: Links und Dateien PARALLEL, mehrere
// Links pro Material, kein Entweder-Oder-Umschalter mehr. Und: kein
// Sichtbarkeits-Umschalter mehr -- die Sichtbarkeit haengt allein an der
// Jahrgangs-Zuordnung, der Server leitet ist_global daraus ab.
describe('Material anlegen: Links und Dateien parallel (Leitung)', () => {
  it('es gibt KEINEN Datei-oder-Link-Umschalter mehr', () => {
    expect(formular).not.toContain("useState<'datei' | 'link'>");
    expect(formular).not.toContain('IonSegmentButton');
  });

  it('es gibt KEINEN Sichtbarkeits-Umschalter mehr und ist_global wird nicht gesendet', () => {
    // Simons Regel vom 01.09.2026: "wenn kein Jahrgang dann global.
    // Fertig. Sonst nur Jahrgang." Der Server leitet ist_global ab.
    expect(formular).not.toContain('setIstGlobal');
    expect(formular).not.toContain('ist_global: istGlobal');
    expect(formular).not.toContain('ist_global:');
  });

  it('mehrere Links werden als Liste gefuehrt und als link_urls gesendet', () => {
    expect(formular).toContain('useState<string[]>');
    expect(formular).toContain('link_urls: bereinigt');
    expect(formular).toContain('Link hinzufügen');
    expect(formular).toContain('aria-label="Link entfernen"');
  });

  it('bestehende Links kommen aus dem Array, mit link_url als Rueckfall', () => {
    expect(formular).toContain('material?.links?.map(l => l.url)');
    expect(formular).toContain("material?.link_url ? [material.link_url] : []");
  });

  it('das Formular prueft jede Adresse schon vor dem Absenden', () => {
    expect(formular).toContain('bereinigt.some(l => !istWebLink(l))');
    expect(formular).toContain('Der Link muss mit http:// oder https:// beginnen');
  });

  it('Dateien werden unabhaengig von den Links hochgeladen', () => {
    expect(formular).toContain('if (newFiles.length > 0 && materialId)');
  });
});

describe('materialLinks buendelt neue und alte Antwortform', () => {
  it('liefert alle Links des Arrays in Reihenfolge', () => {
    const m = {
      links: [
        { url: 'https://konfi-quest.de/gottesbilder' },
        { url: 'https://www.youtube.com/watch?v=abc' },
        { url: 'https://www.youtube.com/watch?v=def' },
      ],
      link_url: 'https://konfi-quest.de/gottesbilder',
    };
    expect(materialLinks(m)).toEqual([
      'https://konfi-quest.de/gottesbilder',
      'https://www.youtube.com/watch?v=abc',
      'https://www.youtube.com/watch?v=def',
    ]);
  });

  it('faellt ohne Array auf das Alt-Feld link_url zurueck (gecachte Eintraege)', () => {
    expect(materialLinks({ link_url: 'https://konfi-quest.de/seite' }))
      .toEqual(['https://konfi-quest.de/seite']);
  });

  it('liefert ohne Links ein leeres Array', () => {
    expect(materialLinks({})).toEqual([]);
    expect(materialLinks({ links: [], link_url: null })).toEqual([]);
  });

  it('filtert alles heraus, was kein http/https ist', () => {
    const m = {
      links: [
        { url: 'javascript:alert(1)' },
        { url: 'https://konfi-quest.de/ok' },
      ],
    };
    expect(materialLinks(m)).toEqual(['https://konfi-quest.de/ok']);
  });
});

describe('Material als Link: Anzeige', () => {
  it('die Leitungsliste kennzeichnet Link-Material mit eigenem Icon', () => {
    expect(leitungsListe).toContain('mat.link_url ? linkOutline : documentIcon');
  });

  it('die Teamer-Liste ebenso', () => {
    expect(teamerListe).toContain('mat.link_url ? linkOutline : documentIcon');
  });

  it.each([
    ['Teamer-Detailseite', () => teamerDetail],
    ['Teamer-Liste (Detailbereich)', () => teamerListe],
  ])('%s rendert den Link nur, wenn er http/https ist', (_name, quelle) => {
    const inhalt = quelle();
    expect(inhalt).toContain('istWebLink(');
    expect(inhalt).toContain('linkOutline');
  });

  it.each([
    ['Teamer-Detailseite', () => teamerDetail],
    ['Teamer-Liste (Detailbereich)', () => teamerListe],
  ])('%s oeffnet den Link extern im Browser', (_name, quelle) => {
    expect(quelle()).toContain("window.open(url, '_blank')");
  });

  it('die Material-Liste am Termin zeigt Link statt Dateizahl', () => {
    expect(leitungTermin).toContain('mat.link_url ? linkOutline : documentIcon');
    expect(teamerTermin).toContain('mat.link_url ? linkOutline : documentIcon');
  });

  it('nirgends stehen Emojis fuer den Link', () => {
    // Vorgabe: IonIcon, keine Emojis.
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const quelle of [formular, leitungsListe, teamerListe, teamerDetail]) {
      const zeilen = quelle.split('\n').filter(z => z.includes('link_url') || z.includes('linkOutline'));
      expect(zeilen.some(z => emoji.test(z))).toBe(false);
    }
  });
});

describe('istWebLink bleibt der Waechter vor dem Oeffnen', () => {
  it('laesst http und https durch', () => {
    expect(istWebLink('https://konfi-quest.de/gottesbilder')).toBe(true);
    expect(istWebLink('http://gemeinde.example/seite')).toBe(true);
  });

  it('weist alles andere ab', () => {
    expect(istWebLink('javascript:alert(1)')).toBe(false);
    expect(istWebLink('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(istWebLink('file:///etc/passwd')).toBe(false);
    expect(istWebLink('konfi-quest.de/gottesbilder')).toBe(false);
    expect(istWebLink(null)).toBe(false);
    expect(istWebLink('')).toBe(false);
  });

  it('beschriftet wird mit der Domain, nicht der vollen Adresse', () => {
    expect(hostAus('https://konfi-quest.de/gottesbilder')).toBe('konfi-quest.de');
    expect(hostAus('https://www.konfi-quest.de/gottesbilder')).toBe('konfi-quest.de');
  });
});

describe('Link-Zeilen im Material-Modal: entfernen per Wischen', () => {
  // Simons Hinweis 03.09.2026: Im Material-Modal stand als letzte Stelle
  // noch ein Muelleimer-Knopf direkt in der Link-Zeile. Ueberall sonst in
  // der App -- auch bei den Dateien im selben Modal -- liegt das Loeschen
  // unter der Wischgeste. Ein Loeschknopf neben dem Eingabefeld trifft man
  // zu leicht.
  const linkAbschnitt = formular.slice(
    formular.indexOf('<IonLabel>Links</IonLabel>'),
    formular.indexOf('Dateien hinzufügen') > 0
      ? formular.indexOf('Dateien hinzufügen')
      : formular.length
  );

  it('die Link-Zeile liegt in einer Wischzeile', () => {
    expect(linkAbschnitt).toContain('<IonItemSliding');
    expect(linkAbschnitt).toContain('IonItemOptions');
  });

  it('das Entfernen haengt an der Wisch-Option', () => {
    expect(linkAbschnitt).toContain('aria-label="Link entfernen"');
    const option = linkAbschnitt.slice(
      linkAbschnitt.indexOf('<IonItemOption'),
      linkAbschnitt.indexOf('</IonItemOption>')
    );
    expect(option).toContain('setLinkUrls');
    expect(option).toContain('closeOpenSlidingItems');
  });

  it('in der Zeile steht kein Loeschknopf mehr', () => {
    // Gegenprobe: Der alte Muelleimer sass als IonButton mit slot="end"
    // direkt neben dem Eingabefeld.
    const zeile = linkAbschnitt.slice(
      linkAbschnitt.indexOf('<IonItem\n'),
      linkAbschnitt.indexOf('</IonItem>')
    );
    expect(zeile).not.toContain('slot="end"');
    expect(zeile).not.toContain('icon={trash}');
  });

  it('nutzt dieselbe Darstellung wie die Datei-Zeilen darunter', () => {
    // app-swipe-actions/app-swipe-action und der rote Kreis -- nicht
    // selbstgebaut.
    expect(linkAbschnitt).toContain('app-swipe-actions');
    expect(linkAbschnitt).toContain('app-swipe-action');
    expect(linkAbschnitt).toContain('app-icon-circle--danger');
  });

  it('im Lese-Modus laesst sich nicht gewischt werden', () => {
    // Ohne Bearbeitungsrecht gibt es nichts zu entfernen.
    expect(linkAbschnitt).toContain('disabled={nurLesen}');
  });
});
