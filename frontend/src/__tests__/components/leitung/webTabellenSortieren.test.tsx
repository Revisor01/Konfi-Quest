// Die Tabellen der Leitung sortieren nach Spalte (Simon, 07.10.2026: „bitte
// alle listen sortierbar machen durch klick auf den spaltennamen"). Je Seite:
// Klick auf den Kopf einer Spalte ordnet die Zeilen aufsteigend, der zweite
// Klick dreht. Gerendert werden die Web-Fassungen direkt mit ihren Props --
// Laden, Rechte und Fenster pruefen die Tests der Seiten.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { neuerStand } from './leitungTestHilfe';

const h = vi.hoisted(() => ({
  einladungen: [] as unknown[],
}));

vi.mock('@ionic/react', async () => (await import('./leitungTestHilfe')).ionicFuerLeitung(neuerStand()));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => true }));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/admin/useOffeneEinladungen', () => ({
  useOffeneEinladungen: () => ({ einladungen: h.einladungen, laeuft: null, zurueckziehen: vi.fn() }),
}));

import WebLevels from '../../../components/admin/web/leitung/WebLevels';
import WebKategorien from '../../../components/admin/web/leitung/WebKategorien';
import WebJahrgaenge from '../../../components/admin/web/leitung/WebJahrgaenge';
import WebEinladung from '../../../components/admin/web/leitung/WebEinladung';
import WebMaterialVerwaltung from '../../../components/admin/web/leitung/WebMaterialVerwaltung';
import WebRueckblick from '../../../components/admin/web/leitung/WebRueckblick';
import WebBenutzer from '../../../components/admin/web/leitung/WebBenutzer';
import WebOffeneEinladungen from '../../../components/admin/web/leitung/WebOffeneEinladungen';
import WebBetrieb from '../../../components/admin/web/leitung/WebBetrieb';
import WebAdminBadges from '../../../components/admin/web/start/WebAdminBadges';
import { AktivitaetenKarte, KonfiHistorieKarte, ZertifikateKarte } from '../../../components/admin/web/leitung/WebKonfiKarten';

const leer = () => undefined;

/** Text der ersten Zelle jeder Zeile der Tabelle `name`. */
const reihe = (name: string) => within(screen.getByRole('table', { name }))
  .getAllByRole('row').slice(1)
  .map((r) => (within(r).getAllByRole('cell')[0].textContent ?? '').trim());

/** Klick auf den Kopf der Spalte `kopf` in der Tabelle `name`. */
const klickKopf = (name: string, kopf: string) => {
  const th = within(screen.getByRole('table', { name })).getByRole('columnheader', { name: kopf });
  fireEvent.click(within(th).getByRole('button', { name: kopf }));
  return th;
};

/** Aufsteigend, dann absteigend -- mit den erwarteten Namen in der ersten Spalte. */
const pruefeSortierung = (name: string, kopf: string, auf: string[]) => {
  const th = klickKopf(name, kopf);
  expect(th).toHaveAttribute('aria-sort', 'ascending');
  expect(reihe(name)).toEqual(auf);
  klickKopf(name, kopf);
  expect(th).toHaveAttribute('aria-sort', 'descending');
  expect(reihe(name)).toEqual([...auf].reverse());
};

describe('Tabellen der Leitung: nach Spalte sortieren', () => {
  it('Level: nach "Ab Punkten"', () => {
    const level = (id: number, title: string, points_required: number) => ({ id, name: title, title, points_required, is_active: true, created_at: '', updated_at: '' });
    render(<WebLevels levels={[level(1, 'Silber', 50), level(2, 'Gold', 100), level(3, 'Bronze', 10)]} laedt={false} onAnlegen={leer} onBearbeiten={leer} onLoeschen={leer} />);
    expect(reihe('Level')).toEqual(['Silber', 'Gold', 'Bronze']);
    pruefeSortierung('Level', 'Ab Punkten', ['Bronze', 'Silber', 'Gold']);
  });

  it('Kategorien: nach Name', () => {
    const k = (id: number, name: string) => ({ id, name, created_at: '' });
    render(<WebKategorien kategorien={[k(1, 'Musik'), k(2, 'Diakonie'), k(3, 'Ökumene')]} laedt={false} darfAnlegen darfBearbeiten={false} darfLoeschen={false} onAnlegen={leer} onBearbeiten={leer} onLoeschen={leer} />);
    // Deutsche Ordnung: Ö steht bei O, nicht hinter Z.
    pruefeSortierung('Kategorien', 'Name', ['Diakonie', 'Musik', 'Ökumene']);
  });

  it('Jahrgänge: nach Zahl der Konfis', () => {
    const j = (id: number, name: string, konfi_count: number) => ({ id, name, created_at: '', konfi_count });
    render(<WebJahrgaenge jahrgaenge={[j(1, '2025/26', 18), j(2, '2026/27', 4), j(3, '2024/25', 31)]} laedt={false} darfAnlegen darfBearbeiten={false} darfLoeschen={false} onAnlegen={leer} onBearbeiten={leer} onLoeschen={leer} />);
    pruefeSortierung('Jahrgänge', 'Konfis', ['2026/27', '2025/26', '2024/25']);
  });

  it('Einladungscodes: nach "Verwendet"', () => {
    const c = (id: number, jahrgang_name: string, used_count: number) => ({ id, invite_code: `CODE${id}`, jahrgang_id: id, jahrgang_name, expires_at: '2026-12-01T00:00:00Z', used_count });
    render(
      <WebEinladung
        jahrgaenge={[]} codes={[c(1, 'Gruppe A', 7), c(2, 'Gruppe B', 0), c(3, 'Gruppe C', 12)]} laedt={false} isOnline
        jahrgangId={null} onJahrgang={leer} gueltigTage={30} onGueltigTage={leer} erzeugt={false} onErzeugen={leer}
        inviteCode={null} qrUrl={null} verlaengertId={null} onQrZeigen={leer} onVerlaengern={leer} onLoeschen={leer}
        onKopieren={leer} onTeilen={leer} ablaufSatz={() => 'Noch gültig'}
      />,
    );
    pruefeSortierung('Aktive Einladungscodes', 'Verwendet', ['Gruppe B', 'Gruppe A', 'Gruppe C']);
  });

  it('Material: nach Inhalt (Dateien, Links und Events zusammen)', () => {
    const m = (id: number, title: string, file_count: number, link_count: number) => ({ id, title, file_count, link_count, event_count: 0, ist_global: true });
    const alle = [m(1, 'Ablauf', 2, 1), m(2, 'Bibel', 0, 1), m(3, 'Chorheft', 5, 0)] as never[];
    render(
      <WebMaterialVerwaltung
        alle={alle} angezeigt={alle} jahrgaenge={[]} laedt={false} ohneJahrgang={false} suche="" onSuche={leer}
        filter="alle" onFilter={leer} darfBearbeiten={() => true} onAnlegen={leer} onOeffnen={leer} onLoeschen={leer}
      />,
    );
    pruefeSortierung('Materialien', 'Inhalt', ['Bibel', 'Ablauf', 'Chorheft']);
  });

  it('Rückblick: nach Zahl der Rückblicke', () => {
    const a = (id: number, titel: string, snapshots: number) => ({ id, typ: 'konfi' as const, jahrgang_id: 1, jahrgang_name: '2026', titel, zeitraum_start: '2026-01-01', zeitraum_ende: '2026-06-01', freigegeben: false, freigegeben_at: null, snapshots, created_at: '' });
    const dialog = { offen: false, teamJahre: [], jahr: 2026, jahrgangId: null, name: '', namensVorschlag: '' } as never;
    render(<WebRueckblick ausgaben={[a(1, 'Sommer', 9), a(2, 'Frühjahr', 22), a(3, 'Winter', 3)]} jahrgaenge={[]} laedt={false} ohneJahrgang={false} istLeitung reiter="konfi" onReiter={leer} dialog={dialog} onLoeschen={leer} />);
    const tabelle = screen.getAllByRole('table')[0].getAttribute('aria-label') ?? '';
    pruefeSortierung(tabelle, 'Rückblicke', ['Winter', 'Sommer', 'Frühjahr']);
  });

  it('Benutzer:innen: nach "Zuletzt angemeldet", ohne Anmeldung unten', () => {
    const u = (id: number, display_name: string, last_login_at: string | null) => ({ id, display_name, username: display_name.toLowerCase(), role_name: 'teamer', is_active: true, last_login_at });
    render(<WebBenutzer users={[u(1, 'Berta', '2026-09-01T10:00:00Z'), u(2, 'Anton', null), u(3, 'Clara', '2026-03-05T10:00:00Z')] as never[]} laedt={false} darfVerwalten={false} einladungenStand={0} onBearbeiten={leer} onLoeschen={leer} onAnlegen={leer} onEinladen={leer} />);
    // Vor dem Namen stehen die Initialen im Avatar, dahinter der Benutzername.
    const name = (t: string) => t.slice(2).split('@')[0];
    klickKopf('Benutzer:innen', 'Zuletzt angemeldet');
    expect(reihe('Benutzer:innen').map(name)).toEqual(['Clara', 'Berta', 'Anton']);
    klickKopf('Benutzer:innen', 'Zuletzt angemeldet');
    // Leere Werte bleiben in beiden Richtungen unten.
    expect(reihe('Benutzer:innen').map(name)).toEqual(['Berta', 'Clara', 'Anton']);
  });

  it('Offene Einladungen: nach "Gültig bis"', () => {
    const e = (id: number, display_name: string, expires_at: string) => ({ id, display_name, username: display_name.toLowerCase(), role_name: 'teamer', created_at: '2026-09-01T00:00:00Z', expires_at });
    h.einladungen = [e(1, 'Mia', '2026-10-20T00:00:00Z'), e(2, 'Lena', '2026-11-30T00:00:00Z'), e(3, 'Jonas', '2026-10-09T00:00:00Z')];
    render(<WebOffeneEinladungen aktualisierung={0} />);
    // Vor dem Namen stehen die Initialen im Avatar, dahinter der Benutzername.
    const name = (t: string) => t.slice(2).split('@')[0];
    klickKopf('Offene Einladungen', 'Gültig bis');
    expect(reihe('Offene Einladungen').map(name)).toEqual(['Jonas', 'Mia', 'Lena']);
    klickKopf('Offene Einladungen', 'Gültig bis');
    expect(reihe('Offene Einladungen').map(name)).toEqual(['Lena', 'Mia', 'Jonas']);
  });

  it('Betrieb, Routen: nach Aufrufen', () => {
    const r = (route: string, count: number) => ({ route, count, errors: 0, mitteMs: 10, schnittMs: 10, p95: 20, maxMs: 30, anteilProzent: 5, p95Duenn: false, stichproben: 50 });
    render(
      <WebBetrieb
        snap={{ fehlerGruppen: [], recentErrors: [], rps: 1, uptimeSeconds: 60, inFlight: 0, maxInFlight: 1, totalRequests: 100 } as never} laedt={false} fehler={null} tab="routen" onTab={leer}
        autoAktualisieren={false} onAutoAktualisieren={leer} routenSicht={'langsam' as never} onRoutenSicht={leer}
        zustand={{ stufe: 'gut', titel: 'Alles gut', satz: '' }} apdexInfo={{ text: '', farbe: '', rat: '' }} veraenderung={null as never}
        routenZeilen={[r('/b', 40), r('/a', 900), r('/c', 7)] as never[]} tage={[]} schritte={[]} onNeuLaden={leer}
      />,
    );
    pruefeSortierung('Routen', 'Aufrufe', ['/c', '/b', '/a']);
  });

  it('Badges: nach "Verliehen"', () => {
    const b = (id: number, name: string, earned_count: number) => ({ id, name, icon: 'trophy', color: '', criteria_type: 'total_points', criteria_value: 1, is_active: true, is_hidden: false, earned_count });
    const badges = [b(1, 'Frühaufsteher', 3), b(2, 'Sammler', 17), b(3, 'Helfer', 0)] as never[];
    render(
      <WebAdminBadges
        badges={badges} gefiltert={badges} suche="" onSuche={leer} filter="alle" onFilter={leer} gruppe={'konfi' as never}
        kriteriumText={() => 'Punkte'} kriteriumDetail={() => null} onBearbeiten={leer} onLoeschen={leer}
      />,
    );
    pruefeSortierung('Badges', 'Verliehen', ['Helfer', 'Frühaufsteher', 'Sammler']);
  });

  it('Konfi-Detail, Aktivitäten: sortiert die ganze Liste, nicht nur die ersten zehn Zeilen', () => {
    // 12 Aktivitaeten; die Karte zeigt die ersten 10. Die meisten Punkte hat die
    // zwoelfte -- nach dem Sortieren muss sie oben stehen.
    const aktivitaeten = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1, name: `Aktivität ${String(i + 1).padStart(2, '0')}`, points: i === 11 ? 50 : i + 1, type: 'gemeinde', date: '2026-09-01',
    })) as never[];
    render(<AktivitaetenKarte aktivitaeten={aktivitaeten} konfi={null} istTeamer={false} onEintragen={leer} onLoeschen={leer} onFoto={leer} />);
    expect(reihe('Aktivitäten')).toHaveLength(10);
    expect(reihe('Aktivitäten')[0]).toBe('Aktivität 01');
    klickKopf('Aktivitäten', 'Punkte');
    klickKopf('Aktivitäten', 'Punkte');
    expect(within(screen.getByRole('table', { name: 'Aktivitäten' })).getByRole('columnheader', { name: 'Punkte' })).toHaveAttribute('aria-sort', 'descending');
    expect(reihe('Aktivitäten').slice(0, 3)).toEqual(['Aktivität 12', 'Aktivität 11', 'Aktivität 10']);
    expect(reihe('Aktivitäten')).not.toContain('Aktivität 01');
  });

  it('Konfi-Detail, Zertifikate: nach Ablauf, ohne Ablauf unten', () => {
    const z = (id: number, name: string, expiry_date: string | null) => ({ id, name, icon: 'ribbon', issued_date: '2026-01-01', expiry_date, status: 'active' });
    render(<ZertifikateKarte zertifikate={[z(1, 'Juleica', '2028-05-01'), z(2, 'Erste Hilfe', '2027-02-01'), z(3, 'Kinderschutz', null)] as never[]} isOnline onZuweisen={leer} onEntfernen={leer} />);
    klickKopf('Zertifikate', 'Läuft ab');
    expect(reihe('Zertifikate')).toEqual(['Erste Hilfe', 'Juleica', 'Kinderschutz']);
    klickKopf('Zertifikate', 'Läuft ab');
    expect(reihe('Zertifikate')).toEqual(['Juleica', 'Erste Hilfe', 'Kinderschutz']);
  });

  it('Konfi-Historie: nach Eintrag, über die ganze Historie', () => {
    const e = (id: number, title: string, date: string) => ({ id, title, date, source_type: 'activity', category: 'gemeinde', points: 2 });
    const historie = { history: [e(1, 'Zeltlager', '2025-08-01'), e(2, 'Andacht', '2025-03-01'), e(3, 'Basar', '2025-11-01'), e(4, 'Chor', '2025-01-01')], totals: { gottesdienst: 0, gemeinde: 8, total: 8 } } as never;
    render(<KonfiHistorieKarte historie={historie} />);
    // Ohne Klick: neueste zuerst, nur drei Zeilen.
    expect(reihe('Konfi-Historie')).toEqual(['Basar', 'Zeltlager', 'Andacht']);
    klickKopf('Konfi-Historie', 'Eintrag');
    expect(reihe('Konfi-Historie')).toEqual(['Andacht', 'Basar', 'Chor']);
    klickKopf('Konfi-Historie', 'Eintrag');
    expect(reihe('Konfi-Historie')).toEqual(['Zeltlager', 'Chor', 'Basar']);
  });
});
