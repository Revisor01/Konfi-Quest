import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';

// Die gemeinsame Kopfzeile (25.09.2026). Simon: "Könnte man in dem Zuge auf
// ne gemeinsame Zeile per Rolle umstellen? Und dann nur pro Seite ein und
// ausblenden." -- "Dann kann der Gemeindeumschalter auch auf jede Seite,
// dann weiß ich wo ich bin."
//
// Umstellung gestuft: zuerst die Konfi-Rolle. Dieser Test haelt fest, dass
// die Konfi-Seiten keine eigene Kopfzeile mehr bauen -- sonst fehlt dort die
// Glocke, und genau das war der Zustand, den die Kopfzeile beenden soll.

type StubProps = { children?: ReactNode };

vi.mock('@ionic/react', () => ({
  IonHeader: (props: StubProps & { collapse?: string; translucent?: boolean }) =>
    <div data-testid={props.collapse ? 'kopfzeile-gross' : 'kopfzeile'} data-translucent={String(props.translucent)}>{props.children}</div>,
  IonToolbar: (props: StubProps) => <div>{props.children}</div>,
  IonTitle: (props: StubProps & { size?: string }) => <div data-testid={props.size === 'large' ? 'titel-gross' : 'titel'}>{props.children}</div>,
  IonButtons: (props: StubProps & { slot?: string }) => <div data-testid={`knoepfe-${props.slot}`}>{props.children}</div>,
  IonButton: (props: StubProps & { onClick?: () => void; 'aria-label'?: string }) =>
    <button type="button" onClick={props.onClick} aria-label={props['aria-label']}>{props.children}</button>,
  IonIcon: (props: { icon?: string }) => <span data-testid="icon" data-icon={props.icon} />,
}));

vi.mock('../../components/shared/OrgSwitcherButton', () => ({
  default: () => <span data-testid="gemeinde-umschalter" />,
}));
vi.mock('../../components/shared/PostfachGlocke', () => ({
  default: () => <span data-testid="glocke" />,
}));

import AppKopfzeile, { AppKopfzeileGross } from '../../components/shared/AppKopfzeile';

const lies = (relativ: string) => readFileSync(join(process.cwd(), relativ), 'utf8');

describe('AppKopfzeile', () => {
  it('zeigt Titel, Gemeinde-Umschalter und Glocke -- ohne dass die Seite etwas dazu sagen muss', () => {
    render(<AppKopfzeile titel="Badges" />);
    expect(screen.getByTestId('titel').textContent).toBe('Badges');
    expect(screen.getByTestId('gemeinde-umschalter')).toBeTruthy();
    expect(screen.getByTestId('glocke')).toBeTruthy();
    // Kein Zurueck-Knopf und keine linken Knoepfe -> kein leerer Start-Slot.
    expect(screen.queryByTestId('knoepfe-start')).toBeNull();
  });

  it('beides laesst sich pro Seite abschalten', () => {
    render(<AppKopfzeile titel="Detail" glocke={false} gemeindeUmschalter={false} />);
    expect(screen.queryByTestId('glocke')).toBeNull();
    expect(screen.queryByTestId('gemeinde-umschalter')).toBeNull();
    // Ohne Glocke und ohne rechte Knoepfe auch kein leerer End-Slot.
    expect(screen.queryByTestId('knoepfe-end')).toBeNull();
  });

  it('die Knoepfe der Seite stehen rechts VOR der Glocke', () => {
    render(<AppKopfzeile titel="Mitmachen" rechts={<button type="button" aria-label="QR-Code scannen" />} />);
    const ende = screen.getByTestId('knoepfe-end');
    const kinder = Array.from(ende.children);
    expect(kinder.length).toBe(2);
    expect(kinder[0].getAttribute('aria-label')).toBe('QR-Code scannen');
    expect(kinder[1].getAttribute('data-testid')).toBe('glocke');
  });

  it('der Zurueck-Knopf ruft die uebergebene Funktion', () => {
    const zurueck = vi.fn();
    render(<AppKopfzeile titel="Profil" onZurueck={zurueck} />);
    fireEvent.click(screen.getByLabelText('Zurück'));
    expect(zurueck).toHaveBeenCalledTimes(1);
  });

  it('ist durchscheinend, solange die Seite nichts anderes sagt -- der Chat schaltet das ab', () => {
    // Ein Chatraum hat unten die Fusszeile mit dem Eingabefeld, sein Inhalt
    // ist nicht fullscreen; mit durchscheinender Kopfzeile sass sie unter
    // Notch und Statusleiste (f40e3687). Deshalb pro Seite abschaltbar.
    const { unmount } = render(<AppKopfzeile titel="Chat" />);
    expect(screen.getByTestId('kopfzeile').getAttribute('data-translucent')).toBe('true');
    unmount();
    render(<AppKopfzeile titel="Jahrgang 2026" translucent={false} />);
    expect(screen.getByTestId('kopfzeile').getAttribute('data-translucent')).toBe('false');
  });

  it('die grosse Zweitzeile traegt denselben Titel im Condense-Kopf', () => {
    render(<AppKopfzeileGross titel="Challenges" />);
    expect(screen.getByTestId('kopfzeile-gross')).toBeTruthy();
    expect(screen.getByTestId('titel-gross').textContent).toBe('Challenges');
  });
});

describe('Die Konfi-Rolle baut keine eigene Kopfzeile mehr', () => {
  const konfiSeiten = [
    'src/components/konfi/pages/KonfiDashboardPage.tsx',
    'src/components/konfi/pages/KonfiEventsPage.tsx',
    'src/components/konfi/pages/KonfiBadgesPage.tsx',
    'src/components/konfi/pages/KonfiChallengesPage.tsx',
    'src/components/konfi/pages/KonfiProfilePage.tsx',
    'src/components/konfi/views/EventDetailView.tsx',
  ];

  it('alle sechs Konfi-Seiten nutzen AppKopfzeile und AppKopfzeileGross', () => {
    for (const seite of konfiSeiten) {
      const quelle = lies(seite);
      expect(quelle, seite).toContain('<AppKopfzeile');
      expect(quelle, seite).toContain('<AppKopfzeileGross');
      expect(quelle, seite).not.toContain('<IonHeader');
    }
  });

  it('der schwebende Warteschlangen-Knopf ist aus der App verschwunden -- alle drei Rollen haben die Glocke', () => {
    // Dritte und letzte Stufe (25.09.2026): Mit der Leitung tragen Konfi, Team
    // und Leitung die Glocke auf jeder Seite; der runde Knopf unten links
    // ("sitzt an einer komischen Stelle") hat keine Aufgabe mehr.
    const app = lies('src/App.tsx');
    expect(app).not.toContain('<WartendeVorgaengeLeiste');
    expect(app).not.toContain("import WartendeVorgaengeLeiste");
    expect(app).toContain('<PostfachModal />');
  });
});

describe('Die Teamer-Rolle baut keine eigene Kopfzeile mehr', () => {
  // Zweite Stufe der Umstellung (25.09.2026): die sieben Teamer-Dateien mit
  // eigener IonHeader. Sechs sind Seiten mit eingeklappter Zweitzeile, die
  // siebte (TeamerMaterialDetailPage) wird als Modal praesentiert und hatte
  // nie eine Zweitzeile -- sie bekommt die Kopfzeile OHNE Glocke und
  // Gemeinde-Umschalter (siehe Kommentar dort).
  const teamerSeiten: Array<[string, number]> = [
    // [Datei, Anzahl der Kopfzeilen-Zustaende in der Datei]
    ['src/components/teamer/pages/TeamerDashboardPage.tsx', 2],   // Laden + Inhalt
    ['src/components/teamer/pages/TeamerEventsPage.tsx', 3],      // Detail, Liste, Jahrgang-Hinweis
    ['src/components/teamer/pages/TeamerBadgesPage.tsx', 1],
    ['src/components/teamer/pages/TeamerKonfiStatsPage.tsx', 2],  // keine Daten + Inhalt
    ['src/components/teamer/pages/TeamerMaterialPage.tsx', 2],    // Detail + Liste
    ['src/components/teamer/pages/TeamerProfilePage.tsx', 1],
  ];
  const materialModal = 'src/components/teamer/pages/TeamerMaterialDetailPage.tsx';
  const zaehle = (quelle: string, muster: string) => quelle.split(muster).length - 1;
  // <AppKopfzeile ...> ohne die Zweitzeile <AppKopfzeileGross ...>.
  const zaehleKopfzeilen = (quelle: string) => zaehle(quelle, '<AppKopfzeile') - zaehle(quelle, '<AppKopfzeileGross');

  it('alle sechs Teamer-Seiten nutzen AppKopfzeile und AppKopfzeileGross -- fuer jeden Zustand', () => {
    for (const [seite, zustaende] of teamerSeiten) {
      const quelle = lies(seite);
      expect(zaehleKopfzeilen(quelle), seite).toBe(zustaende);
      expect(quelle, seite).toContain('<AppKopfzeileGross');
      expect(quelle, seite).not.toContain('<IonHeader');
      expect(quelle, seite).not.toContain('IonToolbar');
    }
  });

  it('das Material-Modal traegt die Kopfzeile ohne Glocke und ohne Gemeinde-Umschalter', () => {
    const quelle = lies(materialModal);
    expect(zaehleKopfzeilen(quelle)).toBe(1);
    expect(quelle).not.toContain('<IonHeader');
    expect(quelle).toContain('glocke={false}');
    expect(quelle).toContain('gemeindeUmschalter={false}');
    // Der Schliessen-Knopf des Modals steht weiter links, mit seiner Klasse.
    expect(quelle).toContain('links={(');
    expect(quelle).toContain('className="app-modal-close-btn" onClick={onClose} aria-label="Schließen"');
    // Ein Modal hat keine eingeklappte Zweitzeile -- hatte es nie.
    expect(quelle).not.toContain('AppKopfzeileGross');
  });

  it('die seitenspezifischen Knoepfe sind in die Slots gewandert', () => {
    const dashboard = lies('src/components/teamer/pages/TeamerDashboardPage.tsx');
    // Profil-Knopf: vorher ProfileHeaderButton mit eigener IonButtons-Gruppe,
    // jetzt ein IonButton im rechts-Slot mit derselben Farbe und demselben Ziel.
    expect(dashboard).not.toContain('<ProfileHeaderButton');
    expect(dashboard).not.toMatch(/import \{[^}]*ProfileHeaderButton/);
    expect(dashboard).toContain(`onClick={() => router.push('/teamer/profile')} aria-label="Profil öffnen"`);
    expect(dashboard).toContain('className="app-icon-color--teamer"');

    const events = lies('src/components/teamer/pages/TeamerEventsPage.tsx');
    // Detail: Zurueck nur ohne Split-View, rechts Event-Chat (nur mit Raum) und QR-Code.
    expect(events).toContain('onZurueck={hideBackButton ? undefined : () => setSelectedEvent(null)}');
    expect(events).toMatch(/\{selectedEvent\.chat_room_id && \(/);
    expect(events).toContain('aria-label="Event-Chat öffnen"');
    expect(events).toContain('aria-label="QR-Code zum Einchecken anzeigen"');
    // Liste: Melden nur bei Antraegen, Scannen nur bei Terminen.
    expect(events).toContain('aria-label="Neue Aktivität melden"');
    expect(events).toContain('aria-label="QR-Code scannen"');
    expect(zaehle(events, '{isAntraege && (')).toBeGreaterThanOrEqual(1);
    expect(zaehle(events, '{!isAntraege && (')).toBeGreaterThanOrEqual(1);
    // Jahrgang-Hinweis: Zurueck fuehrt zur Liste.
    expect(events).toContain('onZurueck={() => setJahrgangHinweis(false)}');
    // Unangetastet: die Warteschlangen-Karte bei den Antraegen (Glocke sagt
    // "da ist noch was", Karte sagt "und zwar das").
    expect(zaehle(events, '<WartendeVorgaengeKarte')).toBe(1);

    const material = lies('src/components/teamer/pages/TeamerMaterialPage.tsx');
    expect(material).toContain('onZurueck={hideBackButton ? undefined : () => setSelectedMaterial(null)}');
    expect(material).toContain('onZurueck={istEigenerTab ? undefined : () => window.history.back()}');

    // Badges, Profil und Konfi-Historie: schlichtes Zurueck in der Historie.
    expect(zaehle(lies('src/components/teamer/pages/TeamerBadgesPage.tsx'), 'onZurueck={() => window.history.back()}')).toBe(1);
    expect(zaehle(lies('src/components/teamer/pages/TeamerProfilePage.tsx'), 'onZurueck={() => window.history.back()}')).toBe(1);
    expect(zaehle(lies('src/components/teamer/pages/TeamerKonfiStatsPage.tsx'), 'onZurueck={() => window.history.back()}')).toBe(2);
  });

  it('kein ICON_ZURUECK mehr in den Teamer-Seiten -- den Zurueck-Knopf baut die Kopfzeile', () => {
    for (const [seite] of teamerSeiten) {
      expect(lies(seite), seite).not.toContain('ICON_ZURUECK');
    }
  });
});

describe('Die Leitung baut keine eigene Kopfzeile mehr', () => {
  // Dritte Stufe der Umstellung (25.09.2026): die 18 Leitungs-Seiten unter
  // components/admin mit eigener IonHeader. Simon: "Dann kann der
  // Gemeindeumschalter auch auf jede Seite, dann weiß ich wo ich bin super."
  // Der Umschalter stand bis dahin NUR auf AdminKonfisPage -- wer per Push in
  // eine andere Gemeinde wechselte, kam von den uebrigen Seiten nicht zurueck
  // (Audit-Befund C3). Jetzt bringt ihn das Geruest auf jede Seite mit.
  //
  // Fuenf Dateien enthalten zusaetzlich ein Modal mit eigener Kopfzeile
  // (Kategorie/Zertifikat/Jahrgang anlegen, Foto, Neuer Rueckblick). Ein
  // Modal bekommt weder Glocke noch Umschalter -- diese <IonHeader> bleiben,
  // und zwar genau so viele, wie hier stehen. Ein <IonHeader translucent>
  // oder collapse="condense" darf es in keiner der 18 Dateien mehr geben.
  const leitungsSeiten: Array<[string, number, number]> = [
    // [Datei, Kopfzeilen-Zustaende (<AppKopfzeile ), verbleibende Modal-Kopfzeilen (<IonHeader)]
    ['src/components/admin/pages/AdminActivitiesPage.tsx', 1, 0],
    ['src/components/admin/pages/AdminBadgesPage.tsx', 1, 0],
    ['src/components/admin/pages/AdminCategoriesPage.tsx', 2, 1],        // Laden + Liste; CategoryModal
    ['src/components/admin/pages/AdminCertificatesPage.tsx', 2, 1],      // Laden + Liste; CertificateModal
    ['src/components/admin/pages/AdminDashboardSettingsPage.tsx', 2, 0], // Laden + Inhalt
    ['src/components/admin/pages/AdminEventsPage.tsx', 1, 0],
    ['src/components/admin/pages/AdminJahrgaengeePage.tsx', 1, 1],       // JahrgangModal
    ['src/components/admin/pages/AdminKonfisPage.tsx', 1, 0],
    ['src/components/admin/pages/AdminLevelsPage.tsx', 1, 0],
    ['src/components/admin/pages/AdminMaterialPage.tsx', 1, 0],
    ['src/components/admin/pages/AdminMetricsPage.tsx', 1, 0],
    ['src/components/admin/pages/AdminOrganizationsPage.tsx', 1, 0],
    ['src/components/admin/pages/AdminProfilePage.tsx', 1, 0],
    ['src/components/admin/pages/AdminSettingsPage.tsx', 1, 0],
    ['src/components/admin/pages/AdminUsersPage.tsx', 1, 0],
    ['src/components/admin/pages/AdminWrappedPage.tsx', 1, 1],           // Modal "Neuer Rückblick"
    ['src/components/admin/views/EventDetailView.tsx', 3, 0],            // Laden, Termin-Hinweis, Inhalt
    ['src/components/admin/views/KonfiDetailView.tsx', 2, 1],            // Laden + Inhalt; Foto-Modal
  ];
  // KonfiDetailView hatte nie eine eingeklappte Zweitzeile; alle anderen haben sie.
  const ohneGross = new Set(['src/components/admin/views/KonfiDetailView.tsx']);
  const zaehle = (quelle: string, muster: string) => quelle.split(muster).length - 1;
  // <AppKopfzeile steht mal mit Props in derselben Zeile, mal mit Zeilenumbruch
  // danach -- gezaehlt wird der Tag mit folgendem Leerraum, NICHT AppKopfzeileGross.
  const zaehleKopfzeilen = (quelle: string) => (quelle.match(/<AppKopfzeile\s/g) || []).length;

  it('alle 18 Leitungs-Seiten nutzen AppKopfzeile -- fuer jeden Zustand, Modal-Kopfzeilen bleiben', () => {
    expect(leitungsSeiten.length).toBe(18);
    for (const [seite, zustaende, modale] of leitungsSeiten) {
      const quelle = lies(seite);
      expect(zaehleKopfzeilen(quelle), seite).toBe(zustaende);
      expect(quelle, seite).not.toContain('<IonHeader translucent');
      expect(quelle, seite).not.toContain('collapse="condense"');
      expect(zaehle(quelle, '<IonHeader'), seite).toBe(modale);
      if (ohneGross.has(seite)) {
        expect(quelle, seite).not.toContain('AppKopfzeileGross');
      } else {
        expect(zaehle(quelle, '<AppKopfzeileGross '), seite).toBe(1);
      }
    }
  });

  // DER UMSCHALTER GEHOERT AUF DIE REITER-SEITEN, SONST NIRGENDS.
  //
  // Simon am Geraet, dreimal in drei Tagen: "Im Admin muss der Switcher weg
  // auf den Unterseiten: Profil / Benutzerinnen / Organisationen / Betrieb"
  // (25.09.), "In Events Details kein org switcher zeigen", "Material sub
  // Seiten auch weg damit", "Konfi Details im Admin hat auch nen switcher
  // noch" (26.09.) -- und schliesslich: "auf den ganzen Subseiten fuer
  // Aktivitaeten, Jahrgaenge, Badges und so unter Mehr ueberall nicht der
  // Organisations-Switcher oben drin. Der ist aber ueberall oben drin."
  //
  // Dass er dreimal kam, lag an diesem Test: Er fuehrte ZWEI Ausnahmelisten
  // und verlangte von allem, was nicht darin stand, `0` Abschaltungen --
  // schrieb den Fehler also fest. Nachgezaehlt am 26.09.: sechs Unterseiten
  // (Aktivitaeten, Badges, Jahrgaenge, Level, Material, Jahresrueckblick)
  // trugen ihn weiterhin, weil sie in keiner Liste standen.
  //
  // Deshalb jetzt umgekehrt, als REGEL statt als Liste: Den Umschalter
  // tragen nur die drei Seiten, die als Reiter unten in der Leiste stehen.
  // Dort ist man in einer Gemeinde unterwegs und der Wechsel ist der Zweck.
  // Jede Unterseite und jede Detailansicht zeigt dagegen Dinge EINER
  // Gemeinde -- ein Wechsel mitten darin fuehrt auf fremde Datensaetze oder
  // ins Leere. Eine neue Unterseite faellt damit von selbst unter die Regel;
  // niemand muss an eine Liste denken.
  const reiterSeiten = new Set([
    'src/components/admin/pages/AdminKonfisPage.tsx',
    'src/components/admin/pages/AdminEventsPage.tsx',
    'src/components/admin/pages/AdminSettingsPage.tsx',  // "Mehr" selbst
  ]);

  it('den Umschalter tragen genau die drei Reiter-Seiten, jede Unterseite schaltet ihn ab', () => {
    const tragen: string[] = [];
    for (const [seite, zustaende] of leitungsSeiten) {
      const quelle = lies(seite);
      // Er kommt aus dem Geruest -- keine Seite baut ihn selbst.
      expect(quelle, seite).not.toContain('OrgSwitcherButton');
      expect(quelle, seite).not.toContain('glocke={false}');

      const abgeschaltet = zaehle(quelle, 'gemeindeUmschalter={false}');
      if (reiterSeiten.has(seite)) {
        expect(abgeschaltet, `${seite} ist eine Reiter-Seite und behaelt ihn`).toBe(0);
        tragen.push(seite);
      } else {
        // JEDE Kopfzeile der Seite schaltet ab, nicht nur die erste: Sonst
        // taucht er im Ladezustand oder auf der Fehlerseite wieder auf.
        expect(
          abgeschaltet,
          `${seite} ist eine Unterseite -- alle ${zustaende} Kopfzeilen muessen abschalten`
        ).toBe(zustaende);
      }
    }
    expect(tragen.sort()).toEqual([...reiterSeiten].sort());
  });

  it('der Zurueck-Knopf kommt aus der Kopfzeile -- kein ICON_ZURUECK mehr in den Leitungs-Seiten', () => {
    for (const [seite] of leitungsSeiten) {
      expect(lies(seite), seite).not.toContain('ICON_ZURUECK');
    }
    // Unterseiten (aus "Mehr" heraus): Zurueck in der Historie, je Zustand einmal.
    const historieZurueck: Array<[string, number]> = [
      ['src/components/admin/pages/AdminActivitiesPage.tsx', 1],
      ['src/components/admin/pages/AdminBadgesPage.tsx', 1],
      ['src/components/admin/pages/AdminCategoriesPage.tsx', 2],
      ['src/components/admin/pages/AdminCertificatesPage.tsx', 2],
      ['src/components/admin/pages/AdminDashboardSettingsPage.tsx', 2],
      ['src/components/admin/pages/AdminJahrgaengeePage.tsx', 1],
      ['src/components/admin/pages/AdminLevelsPage.tsx', 1],
      ['src/components/admin/pages/AdminMaterialPage.tsx', 1],
      ['src/components/admin/pages/AdminMetricsPage.tsx', 1],
      ['src/components/admin/pages/AdminOrganizationsPage.tsx', 1],
      ['src/components/admin/pages/AdminProfilePage.tsx', 1],
      ['src/components/admin/pages/AdminUsersPage.tsx', 1],
      ['src/components/admin/pages/AdminWrappedPage.tsx', 1],
    ];
    for (const [seite, anzahl] of historieZurueck) {
      expect(zaehle(lies(seite), 'onZurueck={() => window.history.back()}'), seite).toBe(anzahl);
    }
    // Reiter-Seiten haben keinen Zurueck-Knopf.
    for (const seite of ['src/components/admin/pages/AdminKonfisPage.tsx', 'src/components/admin/pages/AdminEventsPage.tsx', 'src/components/admin/pages/AdminSettingsPage.tsx']) {
      expect(lies(seite), seite).not.toContain('onZurueck=');
    }
    // Detailansichten: Zurueck nur ohne Split-View, in jedem Zustand.
    expect(zaehle(lies('src/components/admin/views/EventDetailView.tsx'), 'onZurueck={hideBackButton ? undefined : onBack}')).toBe(3);
    expect(zaehle(lies('src/components/admin/views/KonfiDetailView.tsx'), 'onZurueck={hideBackButton ? undefined : onBack}')).toBe(2);
  });

  it('die seitenspezifischen Knoepfe und ihre Berechtigungen sind in den rechts-Slot gewandert', () => {
    const konfis = lies('src/components/admin/pages/AdminKonfisPage.tsx');
    expect(konfis).toContain("rechts={['org_admin', 'admin'].includes(user?.role_name || '') ? (");
    expect(konfis).toContain('aria-label="Anwesenheit und Konfisprüche anzeigen"');
    expect(konfis).toContain("aria-label={viewMode === 'teamer' ? 'Neue Teamer:in anlegen' : 'Neuen Konfi anlegen'}");
    expect(konfis).toContain('presentMatrixModal({ presentingElement: presentingElement })');

    const mehr = lies('src/components/admin/pages/AdminSettingsPage.tsx');
    expect(mehr).toContain('rechts={user?.is_super_admin ? (');
    expect(mehr).toContain('aria-label="Organisationen verwalten"');
    expect(mehr).toContain('aria-label="Performance anzeigen"');

    const termine = lies('src/components/admin/pages/AdminEventsPage.tsx');
    expect(termine).toContain('rechts={!isAntraege && canCreate ? (');
    expect(termine).toContain('aria-label="Neues Event anlegen"');

    // Anlegen-Knoepfe nur mit Recht: canCreate / isAdmin / org_admin.
    expect(lies('src/components/admin/pages/AdminActivitiesPage.tsx')).toContain('rechts={canCreate ? (');
    expect(lies('src/components/admin/pages/AdminCategoriesPage.tsx')).toContain('rechts={canCreate ? (');
    expect(lies('src/components/admin/pages/AdminJahrgaengeePage.tsx')).toContain('rechts={canCreate ? (');
    expect(lies('src/components/admin/pages/AdminCertificatesPage.tsx')).toContain('rechts={isAdmin ? (');
    expect(lies('src/components/admin/pages/AdminUsersPage.tsx')).toContain("rechts={user?.role_name === 'org_admin' ? (");

    const terminDetail = lies('src/components/admin/views/EventDetailView.tsx');
    for (const knopf of ['Event-Chat öffnen', 'QR-Code anzeigen', 'Termin kopieren', 'Event bearbeiten']) {
      expect(zaehle(terminDetail, `aria-label="${knopf}"`), knopf).toBe(1);
    }
    expect(terminDetail).toContain('{(eventData?.chat_room_id || darfVerwalten) && (');
    // Kopieren und Bearbeiten nur fuer die Leitung -- gezaehlt INNERHALB der
    // Kopfzeile (die Datei prueft darfVerwalten auch weiter unten).
    const kopf = terminDetail.slice(terminDetail.lastIndexOf('<AppKopfzeile\n'), terminDetail.indexOf('<AppKopfzeileGross'));
    expect(zaehle(kopf, '{darfVerwalten && (')).toBe(2);

    const konfiDetail = lies('src/components/admin/views/KonfiDetailView.tsx');
    for (const knopf of ['Konfi bearbeiten', 'Zertifikat zuweisen', 'Passwort zurücksetzen']) {
      expect(zaehle(konfiDetail, `aria-label="${knopf}"`), knopf).toBe(1);
    }
    expect(konfiDetail).toContain('{!isTeamer && (');
    expect(konfiDetail).toContain('{isTeamer && (');

    expect(lies('src/components/admin/pages/AdminMetricsPage.tsx')).toContain('aria-label="Daten neu laden"');
    expect(lies('src/components/admin/pages/AdminWrappedPage.tsx')).toContain("disabled={!istLeitung && segment === 'teamer'}");
  });

  it('AdminInvitePage ist ein Modal und behaelt bewusst seine eigene Kopfzeile', () => {
    // Liegt unter pages/, wird aber aus "Mehr" per useIonModal praesentiert
    // (AdminSettingsPage) und hat einen Schliessen-Knopf. In einem Modal
    // haetten Glocke und Gemeinde-Umschalter nichts zu suchen -- ein
    // Gemeinde-Wechsel unter einem offenen Modal fuehrt ins Leere.
    const einladen = lies('src/components/admin/pages/AdminInvitePage.tsx');
    expect(einladen).not.toContain('AppKopfzeile');
    expect(zaehle(einladen, '<IonHeader>')).toBe(1);
    expect(einladen).toContain('aria-label="Schließen"');
    expect(lies('src/components/admin/pages/AdminSettingsPage.tsx')).toContain('useIonModal(AdminInvitePage, {');
  });
});

describe('Chat und Challenges bauen keine eigene Kopfzeile mehr', () => {
  // Simon am Geraet (25.09.2026): "Chat und challenges hat keinen org
  // switcher." Die drei Umstellungen liefen verzeichnisweise (konfi/, teamer/,
  // admin/) -- der Chat liegt aber unter components/chat, die gemeinsame
  // Challenge-Seite von Leitung und Team unter components/shared. Beide
  // fielen durch. Dieser Block haelt die Nachzuegler fest.
  const zaehle = (quelle: string, muster: string) => quelle.split(muster).length - 1;
  const zaehleKopfzeilen = (quelle: string) => (quelle.match(/<AppKopfzeile\s/g) || []).length;

  const nachzuegler: Array<[string, number]> = [
    // [Datei, Kopfzeilen-Zustaende (<AppKopfzeile )]
    ['src/components/chat/ChatOverview.tsx', 1],
    ['src/components/shared/ChallengesPage.tsx', 1],
    ['src/components/chat/views/ChatRoomView.tsx', 1],   // Fehlerseite
    ['src/components/chat/ChatRoom.tsx', 1],             // Ladezustand
    ['src/components/chat/ChatRoomSections.tsx', 1],     // ChatHeader (der Raum)
  ];

  it('alle fuenf Dateien nutzen AppKopfzeile -- fuer jeden Zustand, keine baut mehr selbst', () => {
    expect(nachzuegler.length).toBe(5);
    for (const [datei, zustaende] of nachzuegler) {
      const quelle = lies(datei);
      expect(zaehleKopfzeilen(quelle), datei).toBe(zustaende);
      expect(quelle, datei).not.toContain('<IonHeader');
      expect(quelle, datei).not.toContain('<IonTitle');
      expect(quelle, datei).not.toContain('collapse="condense"');
      expect(quelle, datei).not.toContain('ICON_ZURUECK');
      // Seiten, keine Modale: niemand schaltet die Glocke ab.
      expect(quelle, datei).not.toContain('glocke={false}');
      // Der Umschalter dagegen schon -- seit 26.09.2026 traegt ihn der
      // EINZELNE Chatraum nicht mehr (Simon: "Switcher raus"), weil ein Raum
      // zu genau einer Gemeinde gehoert. Die Chat-UEBERSICHT behaelt ihn;
      // das prueft der Test darunter.
      if (!/ChatRoom(View|Sections)?\.tsx$/.test(datei)) {
        expect(quelle, datei).not.toContain('gemeindeUmschalter={false}');
      }
      expect(quelle, datei).not.toContain('OrgSwitcherButton');
    }
  });

  it('Chat-Liste und Challenge-Liste sind Reiter-Seiten: Zweitzeile, Plus-Knopf rechts, kein Zurueck', () => {
    const chat = lies('src/components/chat/ChatOverview.tsx');
    expect(zaehle(chat, '<AppKopfzeileGross titel="Chat" />')).toBe(1);
    expect(chat).toContain('aria-label="Neuen Chat starten" onClick={handleCreateNewChat}');
    expect(chat).not.toContain('onZurueck=');
    // Der rote Zaehler an den einzelnen Raeumen bleibt unangetastet.
    expect(zaehle(chat, '<ZaehlerKugel')).toBe(1);

    const challenges = lies('src/components/shared/ChallengesPage.tsx');
    expect(zaehle(challenges, '<AppKopfzeileGross titel="Challenges" />')).toBe(1);
    expect(challenges).toContain('aria-label="Neue Challenge anlegen" onClick={openCreate} title="Neue Challenge"');
    expect(challenges).not.toContain('onZurueck=');
    // Leitung UND Team kommen ueber diese eine Datei (Befund N7); die Huellen
    // bauen keine Kopfzeile.
    for (const huelle of ['src/components/admin/pages/AdminChallengesPage.tsx', 'src/components/teamer/pages/TeamerChallengesPage.tsx']) {
      expect(lies(huelle), huelle).not.toContain('IonHeader');
      expect(lies(huelle), huelle).not.toContain('AppKopfzeile');
    }
  });

  it('der Chatraum traegt Raumname, Zurueck und alle Knoepfe -- opak, weil der Inhalt nicht fullscreen ist', () => {
    const kopf = lies('src/components/chat/ChatRoomSections.tsx');
    expect(kopf).toContain('titel={roomName}');
    expect(kopf).toContain('onZurueck={onBack}');
    expect(zaehle(kopf, 'translucent={false}')).toBe(1);
    // Nichts verloren: vier Knoepfe mit ihren Bedingungen, wie vorher.
    expect(kopf).toContain("{roomType !== 'direct' && (");
    expect(kopf).toContain('aria-label="Mitglieder anzeigen" onClick={onOpenMembers}');
    expect(kopf).toContain('{isAdmin && (');
    expect(kopf).toContain('aria-label="Umfrage erstellen" onClick={onOpenPoll}');
    expect(kopf).toContain('{onClearChat && (');
    expect(kopf).toContain('aria-label={isOnline ? "Team-Chat leeren" : "Team-Chat leeren — Ohne Internetverbindung nicht möglich"}');
    expect(kopf).toContain('{canLeave && (');
    expect(kopf).toContain('aria-label={isOnline ? "Weitere Chat-Optionen" : "Weitere Chat-Optionen — Ohne Internetverbindung nicht möglich"}');
    // Die Knoepfe stehen im rechts-Slot, VOR der Glocke (die Kopfzeile haengt
    // sie hinten an).
    const rechts = kopf.slice(kopf.indexOf('rechts={('), kopf.indexOf('</>', kopf.indexOf('rechts={(')));
    expect(zaehle(rechts, '<IonButton ')).toBe(4);
    // Die Fusszeile mit dem Eingabefeld behaelt ihre eigene Toolbar.
    expect(zaehle(kopf, '<IonFooter')).toBe(1);
    expect(zaehle(kopf, '<IonToolbar')).toBe(1);

    // Ladezustand und Fehlerseite: derselbe Zurueck-Weg, ebenfalls opak --
    // sonst springt die Kopfzeile beim Wechsel zum Raum.
    expect(lies('src/components/chat/ChatRoom.tsx')).toContain('<AppKopfzeile titel="Chat wird geladen..." onZurueck={onBack} translucent={false} gemeindeUmschalter={false} />');
    expect(lies('src/components/chat/views/ChatRoomView.tsx')).toContain('<AppKopfzeile titel="Fehler" onZurueck={onBack} translucent={false} gemeindeUmschalter={false} />');
    // Der Raum ist eine Seite mit Route (kein Modal), darum Glocke und Umschalter.
    expect(lies('src/navigation/rollenBaeume.ts')).toContain("page: ChatRoomView, param: 'roomId', propName: 'roomId'");
  });

  it('im ganzen Frontend hat keine Seite mehr eine eigene Kopfzeile -- nur Modale und das Geruest selbst', () => {
    // Die Umstellung lief verzeichnisweise und liess zwei Verzeichnisse aus.
    // Deshalb hier die Gesamtprobe ueber ALLE Komponenten: Wo noch ein
    // <IonHeader steht, muss es ein Modal sein (per useIonModal praesentiert,
    // eine *Modal.tsx oder eine Modal-Komponente innerhalb einer Seite) oder
    // die Kopfzeile selbst. Ein <IonHeader translucent (das Kennzeichen einer
    // Seite) darf es ausserhalb von AppKopfzeile nicht mehr geben.
    const sammle = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
      const voll = join(dir, name);
      return statSync(voll).isDirectory() ? sammle(voll) : voll.endsWith('.tsx') ? [voll] : [];
    });
    const dateien = sammle(join(process.cwd(), 'src/components'));
    expect(dateien.length).toBeGreaterThan(100);
    const mitTranslucent = dateien
      .filter((d) => readFileSync(d, 'utf8').includes('<IonHeader translucent'))
      .map((d) => d.slice(process.cwd().length + 1));
    expect(mitTranslucent).toEqual(['src/components/shared/AppKopfzeile.tsx']);
    const mitCondense = dateien
      .filter((d) => readFileSync(d, 'utf8').includes('collapse="condense"'))
      .map((d) => d.slice(process.cwd().length + 1));
    expect(mitCondense).toEqual(['src/components/shared/AppKopfzeile.tsx']);

    // Die verbliebenen <IonHeader> ausserhalb von modals/-Ordnern und
    // *Modal.tsx-Dateien: genau diese, alle mit Begruendung.
    const verbliebene = dateien
      .filter((d) => !d.includes('/modals/') && !/Modal\.tsx$/.test(d))
      .filter((d) => readFileSync(d, 'utf8').includes('<IonHeader'))
      .map((d) => d.slice(process.cwd().length + 1))
      .sort();
    expect(verbliebene).toEqual([
      'src/components/admin/pages/AdminCategoriesPage.tsx',    // CategoryModal (Innen-Komponente)
      'src/components/admin/pages/AdminCertificatesPage.tsx',  // CertificateModal (Innen-Komponente)
      'src/components/admin/pages/AdminInvitePage.tsx',        // per useIonModal aus "Mehr"
      'src/components/admin/pages/AdminJahrgaengeePage.tsx',   // JahrgangModal (Innen-Komponente)
      'src/components/admin/pages/AdminWrappedPage.tsx',       // <IonModal> "Neuer Rückblick"
      'src/components/admin/views/KonfiDetailView.tsx',        // PhotoModal (Innen-Komponente)
      'src/components/shared/AppKopfzeile.tsx',                // das Geruest selbst
      'src/components/shared/PushAuswahl.tsx',                 // <IonModal> Mitteilungs-Auswahl
    ]);
  });
});
