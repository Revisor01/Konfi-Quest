import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { istWebLink, hostAus } from '../../utils/linkDisplay';

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

describe('Material als Link: Anlegen (Leitung)', () => {
  it('beim Anlegen wird zwischen Datei und Link gewaehlt', () => {
    expect(formular).toContain("useState<'datei' | 'link'>");
    expect(formular).toContain('<IonSegmentButton value="datei">');
    expect(formular).toContain('<IonSegmentButton value="link">');
  });

  it('ein bestehender Link waehlt die Link-Art vor', () => {
    expect(formular).toContain("material?.link_url ? 'link' : 'datei'");
  });

  it('der Link wird mitgeschickt, bei Art "Datei" geleert', () => {
    expect(formular).toContain("link_url: art === 'link' ? linkUrl.trim() : ''");
  });

  it('das Formular prueft die Adresse schon vor dem Absenden', () => {
    expect(formular).toContain('istWebLink');
    expect(formular).toContain('Der Link muss mit http:// oder https:// beginnen');
  });

  it('bei Art "Link" werden keine Dateien hochgeladen', () => {
    expect(formular).toContain("if (art === 'datei' && newFiles.length > 0 && materialId)");
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
