import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { flag, ribbon, trophy, medal, compass, rocket } from 'ionicons/icons';
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
    expect(getChallengeIcon('gibtesnicht')).toBe(flag);
    expect(getChallengeIcon(undefined)).toBe(flag);
  });

  it('Konfi-Challenges fallen weiterhin auf die Flagge zurueck', () => {
    expect(getChallengeBadgeIcon('gibtesnicht')).toBe(flag);
    expect(getChallengeBadgeIcon(null)).toBe(flag);
  });

  it('Zertifikats-Seite faellt weiterhin auf das Band zurueck', () => {
    // AdminCertificatesPage rendert ueber getIconFromString(icon, ribbon).
    const seite = quelltext('components/admin/pages/AdminCertificatesPage.tsx');
    expect(seite).toContain('getIconFromString(certType.icon, ribbon)');
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
