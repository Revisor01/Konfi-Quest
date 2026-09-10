import { readFileSync } from 'fs';
import { resolve } from 'path';

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

/**
 * Der MD3-Look (Android) hat eigene Masse — und die deutschen Beschriftungen
 * sind laenger als die englischen, fuer die Material Design gemacht ist.
 *
 * Aufgefallen ist das erst am 09.09.2026, als die Play-Screenshots zum ersten
 * Mal WIRKLICH im MD3-Look entstanden: Bis dahin setzte das Skript keine
 * Android-Kennung, Ionic rendert dann im iOS-Modus, und die Bilder zeigten
 * den falschen Look. Drei Stellen liefen ueber, alle drei nur unter MD3:
 *
 *   Reiterleiste      "Materia" statt "Material" (Leiste 385px auf 360px)
 *   Segmente          "UNGELE...", "VERBUC...", "VERGAN..."
 *   Schwebender Knopf lag auf der letzten Terminkarte
 *
 * Geprueft wird hier die REGEL im Stylesheet, nicht das gerenderte Ergebnis:
 * Ein Browser-Test dafuer braeuchte eine laufende App und waere langsam. Die
 * Masse selbst sind am echten Geraet gemessen (360px, Pixel-8-Kennung) und in
 * den Kommentaren der Regeln festgehalten.
 */
describe('MD3-Layout: die deutschen Beschriftungen passen', () => {
  const css = lies('src/theme/variables.css');

  describe('Reiterleiste', () => {
    it('die MD3-Mindestbreite ist aufgehoben', () => {
      // Ohne das ergeben fuenf Reiter 410px auf einem 360px-Geraet, und die
      // Leiste laeuft ueber beide Raender hinaus.
      const block = css.match(/ion-tab-bar\.md ion-tab-button \{[^}]*\}/);
      expect(block).not.toBeNull();
      expect(block![0]).toMatch(/min-width:\s*0/);
      expect(block![0]).toMatch(/flex:\s*1 1 0/);
    });

    it('die Beschriftung nutzt die schmalste Stufe der Skala', () => {
      // Bei --app-text-winzig (0.6rem) fehlten "Challenges" und "Mitmachen"
      // je fuenf Pixel.
      const block = css.match(/ion-tab-bar\.md ion-tab-button ion-label,[^{]*\{[^}]*\}/);
      expect(block).not.toBeNull();
      expect(block![0]).toContain('var(--app-text-schmal)');
    });

    it('die Stufe steht in der Typografie-Skala', () => {
      expect(lies('src/theme/typografie.css')).toContain('--app-text-schmal');
    });

    it('der Kuerzungs-Schutz bleibt', () => {
      // Auf sehr schmalen Geraeten (320px) reicht auch das nicht — dort sind
      // Auslassungspunkte richtig, eine ueberlaufende Leiste waere schlimmer.
      const block = css.match(/ion-tab-bar\.md ion-tab-button ion-label,[^{]*\{[^}]*\}/);
      expect(block![0]).toMatch(/text-overflow:\s*ellipsis/);
    });
  });

  describe('Segmente', () => {
    it('keine Grossbuchstaben', () => {
      // MD3 setzt sie in Versalien; "Ungelesen" braucht so 92px statt 68.
      const block = css.match(/ion-segment\.md ion-segment-button \{[^}]*\}/);
      expect(block).not.toBeNull();
      expect(block![0]).toMatch(/text-transform:\s*none/);
    });

    it('die Beschriftung haengt an der Skala', () => {
      const block = css.match(/ion-segment\.md ion-segment-button ion-label \{[^}]*\}/);
      expect(block).not.toBeNull();
      expect(block![0]).toContain('var(--app-text-klein)');
    });
  });

  describe('Der iOS-Look bleibt unberuehrt', () => {
    it('alle MD3-Regeln sind auf .md eingegrenzt', () => {
      // Eine Regel ohne .md-Praefix traefe beide Looks — und die drei
      // Probleme gibt es unter iOS gar nicht.
      for (const regel of ['ion-tab-bar', 'ion-segment']) {
        const treffer = [...css.matchAll(new RegExp(`^${regel}[^,{\\n]*\\{`, 'gm'))]
          .map(m => m[0])
          .filter(z => z.includes('ion-tab-button') || z.includes('ion-segment-button'))
          .filter(z => !z.includes('.md'));
        expect(treffer).toEqual([]);
      }
    });
  });
});

describe('Der Challenge-Zaehler nennt Stempel, nicht Abzeichen', () => {
  it('die Konfi-Ansicht beschriftet ihn als STEMPEL', () => {
    // Er stand als "ABZEICHEN" direkt ueber einem Abschnitt "Deine Stempel".
    // Der bestehende Waechter (stempelStattAbzeichen) suchte nur nach
    // 'Abzeichen' in gemischter Schreibweise und liess die Versalien durch.
    const quelle = lies('src/components/konfi/views/ChallengesView.tsx');
    expect(quelle).toContain("label: 'STEMPEL'");
    expect(quelle).not.toContain("label: 'ABZEICHEN'");
  });
});
