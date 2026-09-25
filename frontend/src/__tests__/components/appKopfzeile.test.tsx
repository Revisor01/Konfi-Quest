import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
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
  IonHeader: (props: StubProps & { collapse?: string }) => <div data-testid={props.collapse ? 'kopfzeile-gross' : 'kopfzeile'}>{props.children}</div>,
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

  it('der schwebende Warteschlangen-Knopf bleibt nur fuer die Leitung', () => {
    // Die Glocke uebernimmt ihn fuer Konfis und Team; die Leitung behaelt ihn,
    // bis ihre Kopfzeilen umgestellt sind (gestufte Umstellung).
    const app = lies('src/App.tsx');
    expect(app).toContain("{user?.type !== 'konfi' && user?.type !== 'teamer' && <WartendeVorgaengeLeiste />}");
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
