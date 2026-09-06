import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
// Kontur-Varianten: Seit dem Nur-Kontur-Modus (06.09.2026) bildet
// ICON_CHOICES die gespeicherten Namen auf die Outline-Glyphen ab. Der
// DATENVERTRAG sind die Schluessel ('trophy', 'medal', ...), nicht das
// Bild -- die Tests pruefen weiter, dass jeder Name sein Icon findet.
import { flagOutline as flag, ribbonOutline as ribbon, trophyOutline as trophy,
  medalOutline as medal, compassOutline as compass, rocketOutline as rocket } from 'ionicons/icons';
// ICON_CHALLENGE_GEFUELLT zeigt seit dem Nur-Kontur-Modus (06.09.2026) auf
// flagOutline. Die Rueckfall-Tests unten pruefen deshalb gegen die zentrale
// Konstante statt gegen 'flag' aus ionicons -- die Aussage ist "der
// Rueckfall ist die Challenge-Flagge", nicht "es ist genau dieses Glyph".
import { ICON_CHALLENGE_GEFUELLT } from '../../components/shared/icons';
import { ICON_CHOICES, ICON_MAP, getIconFromString } from '../../utils/badgeIcons';
import { getChallengeIcon } from '../../components/admin/modals/ChallengeManageModal';
import { getChallengeBadgeIcon } from '../../components/konfi/views/ChallengesView';

// Der Icon-Vorrat lag bis 31.08. viermal im Baum (Challenge-Modal,
// Zertifikats-Seite, Zertifikats-Zuweisung, Konfi-Challenges). Beim
// Zusammenzug auf utils/badgeIcons war der Rueckfall der Knackpunkt: die
// Kopien fielen auf `flag` bzw. `ribbon` zurueck, die zentrale Funktion auf
// `trophy`. Diese Tests halten beides fest — einen Vorrat, unveraenderte
// Rueckfaelle.

const quelltext = (relativerPfad: string): string =>
  readFileSync(resolve(__dirname, '../..', relativerPfad), 'utf-8');

const AUFRUFSTELLEN = [
  'components/admin/modals/ChallengeManageModal.tsx',
  'components/admin/pages/AdminCertificatesPage.tsx',
  'components/admin/modals/CertificateAssignModal.tsx',
  'components/konfi/views/ChallengesView.tsx'
];

describe('getIconFromString', () => {
  it('loest einen bekannten Namen auf', () => {
    expect(getIconFromString('medal')).toBe(medal);
  });

  it('faellt ohne eigene Angabe auf die Trophaee zurueck', () => {
    expect(getIconFromString('gibtesnicht')).toBe(trophy);
    expect(getIconFromString(undefined)).toBe(trophy);
    expect(getIconFromString(null)).toBe(trophy);
  });

  it('nimmt einen mitgegebenen Rueckfall statt der Trophaee', () => {
    expect(getIconFromString('gibtesnicht', ribbon)).toBe(ribbon);
    expect(getIconFromString(undefined, flag)).toBe(flag);
  });

  it('zieht den bekannten Namen dem mitgegebenen Rueckfall vor', () => {
    expect(getIconFromString('medal', ribbon)).toBe(medal);
  });
});

describe('Rueckfall-Symbole der Aufrufstellen', () => {
  it('Challenge-Verwaltung faellt weiterhin auf die Flagge zurueck', () => {
    expect(getChallengeIcon('gibtesnicht')).toBe(ICON_CHALLENGE_GEFUELLT);
    expect(getChallengeIcon(undefined)).toBe(ICON_CHALLENGE_GEFUELLT);
  });

  it('Konfi-Challenges fallen weiterhin auf die Flagge zurueck', () => {
    expect(getChallengeBadgeIcon('gibtesnicht')).toBe(ICON_CHALLENGE_GEFUELLT);
    expect(getChallengeBadgeIcon(null)).toBe(ICON_CHALLENGE_GEFUELLT);
  });

  it('Zertifikats-Seite faellt weiterhin auf das Band zurueck', () => {
    // AdminCertificatesPage rendert ueber getIconFromString(icon, <Rueckfall>).
    // Der Rueckfall heisst seit der Icon-Konsolidierung (05.09.2026)
    // ICON_ABZEICHEN_GEFUELLT statt `ribbon` -- dasselbe Zeichen, nur
    // zentral tauschbar. Geprueft wird weiter, DASS ein Rueckfall uebergeben
    // wird, nicht wie er buchstabiert ist.
    const seite = quelltext('components/admin/pages/AdminCertificatesPage.tsx');
    expect(seite).toContain('getIconFromString(certType.icon, ICON_ABZEICHEN_GEFUELLT)');
    expect(getIconFromString('gibtesnicht', ribbon)).toBe(ribbon);
  });

  it('loest bekannte Namen an allen Aufrufstellen gleich auf', () => {
    expect(getChallengeIcon('compass')).toBe(compass);
    expect(getChallengeBadgeIcon('compass')).toBe(compass);
    expect(getIconFromString('compass', ribbon)).toBe(compass);
  });
});

describe('ein gemeinsamer Vorrat', () => {
  it('haelt keine Aufrufstelle mehr eine eigene Icon-Liste', () => {
    for (const pfad of AUFRUFSTELLEN) {
      const inhalt = quelltext(pfad);
      // Eine eigene Liste erkennt man an Eintraegen der Form
      // `name: { icon: x, name: '...', category: '...' }`.
      expect(inhalt, `${pfad} traegt wieder eine eigene Icon-Liste`).not.toMatch(/category:\s*'/);
      expect(inhalt, `${pfad} schoepft nicht aus utils/badgeIcons`).toMatch(/utils\/badgeIcons/);
    }
  });

  it('bietet allen Aufrufstellen denselben Umfang an', () => {
    // Der Vorrat ist die eine Quelle — ICON_MAP wird daraus abgeleitet.
    expect(Object.keys(ICON_MAP).sort()).toEqual(Object.keys(ICON_CHOICES).sort());
    expect(Object.keys(ICON_CHOICES)).toHaveLength(54);
  });

  it('enthaelt die Symbole, die frueher nur die Challenge-Liste fuehrte', () => {
    expect(ICON_CHOICES.compass.icon).toBe(compass);
    expect(ICON_CHOICES.rocket.icon).toBe(rocket);
    expect(ICON_CHOICES.flag.icon).toBe(flag);
  });
});
