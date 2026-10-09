import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
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
import { ICON_ABZEICHEN_GEFUELLT, ICON_CHALLENGE_GEFUELLT } from '../../components/shared/icons';
import { ICON_CHOICES, ICON_MAP, getIconFromString } from '../../utils/badgeIcons';
import { getChallengeIcon } from '../../components/admin/modals/ChallengeManageModal';
import { getChallengeBadgeIcon } from '../../components/konfi/views/ChallengesView';
import AdminCertificatesPage from '../../components/admin/pages/AdminCertificatesPage';

// Fuer die gerenderte Zertifikats-Seite (seit 09.10.2026 statt der Suche
// nach dem Aufruf im Quelltext): Server, Anmeldung und Kopfzeile
// nachgestellt; das Symbol als lesbares Element.
vi.mock('../../services/api', () => ({ default: { get: vi.fn(async () => ({ data: [] })) } }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 3, type: 'admin', role_name: 'org_admin', organization_id: 1 }, setError: vi.fn(), setSuccess: vi.fn() }),
}));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true, subscribe: () => () => {} } }));
vi.mock('../../navigation/breitesLayout', () => ({ useBreitesLayout: () => false }));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({
    data: [
      { id: 1, name: 'Juleica', icon: 'gibtesnicht', is_active: true, created_at: '2026-01-01T10:00:00Z' },
      { id: 2, name: 'Erste Hilfe', icon: 'medal', is_active: true, created_at: '2026-01-01T10:00:00Z' },
    ],
    loading: false, error: null, refresh: vi.fn(), refreshLive: vi.fn(),
  }),
}));
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  IonIcon: ({ icon }: { icon?: string }) => <i data-icon={icon} />,
  useIonModal: () => [vi.fn(), vi.fn()],
  useIonAlert: () => [vi.fn(), vi.fn()],
}));

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

  it('Zertifikats-Seite faellt weiterhin auf das Band zurueck', async () => {
    // AdminCertificatesPage rendert ueber getIconFromString(icon, <Rueckfall>).
    // Der Rueckfall heisst seit der Icon-Konsolidierung (05.09.2026)
    // ICON_ABZEICHEN_GEFUELLT statt `ribbon` -- dasselbe Zeichen, nur
    // zentral tauschbar. Geprueft wird an der gerenderten Liste: ein
    // unbekannter Name zeigt das Band, keine Trophaee; ein bekannter sein
    // eigenes Symbol.
    const { container } = render(<AdminCertificatesPage />);
    await act(async () => { await Promise.resolve(); });
    const symbolVon = (name: string) => [...container.querySelectorAll('.app-list-item')]
      .find((e) => e.textContent?.includes(name))
      ?.querySelector('.app-icon-circle i')
      ?.getAttribute('data-icon');
    expect(symbolVon('Juleica')).toBe(ICON_ABZEICHEN_GEFUELLT);
    expect(symbolVon('Juleica')).not.toBe(trophy);
    expect(symbolVon('Erste Hilfe')).toBe(medal);
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
    // 14.09.2026: 54 -> 95. Simons Wunsch: "dass fuer Badges und Stempel eine
    // groessere passende Auswahl da sein soll. Das man einfach mehr Vielfalt
    // hat." 41 Symbole dazu, verteilt auf die bestehenden Kategorien.
    expect(Object.keys(ICON_CHOICES)).toHaveLength(95);
  });

  it('enthaelt die Symbole, die frueher nur die Challenge-Liste fuehrte', () => {
    expect(ICON_CHOICES.compass.icon).toBe(compass);
    expect(ICON_CHOICES.rocket.icon).toBe(rocket);
    expect(ICON_CHOICES.flag.icon).toBe(flag);
  });
});
