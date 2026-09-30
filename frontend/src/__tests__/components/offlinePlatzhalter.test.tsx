// Offline sagt die App, was fehlt -- gerendert (Audit Tests 26.09.2026,
// BF-02; vorher Quelltext-Test, 30.09.2026 umgestellt).
//
// Simons Kritik vom 29.08.2026: "nichtmal dann weiß ich, ob es richtig
// angezeigt wird". Detailansichten zeigten offline ihren Grundstand aus dem
// Listen-Cache, aber Abschnitte, deren Daten an der Detail-Route hängen,
// verschwanden wortlos -- die Bedingung lautete `length > 0`, und offline
// blieb die Liste leer. Wer die Seite so sah, konnte nicht unterscheiden, ob
// es keine Teilnehmer gibt oder ob sie nur nicht geladen wurden.
//
// DREI ANSICHTEN. Hier gerendert: die Konfi-Terminansicht (Teilnehmerliste
// und Zeitfenster) und der Platzhalter selbst. Die beiden Leitungsansichten
// prüfen adminEventDetailOffline (Teilnehmerliste) und
// adminKonfiDetailOffline (Punkte-Historie) gerendert -- dort jeweils auch
// "nur offline, nicht bei echter Leere".
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { zustand, zuruecksetzen, termin, oeffne } from './gerueste/konfiTerminDetail';
import OfflinePlatzhalter from '../../components/shared/OfflinePlatzhalter';
import { ICON_OFFLINE } from '../../components/shared/icons';

beforeEach(zuruecksetzen);

const TEILNEHMER = 'Die Teilnehmerliste ist offline nicht verfügbar.';
const ZEITFENSTER = 'Die Zeitfenster-Auswahl ist offline nicht verfügbar.';

describe('Konfi-Terminansicht: offline sagt sie, was fehlt', () => {
  it('Teilnehmerliste und Zeitfenster-Auswahl bekommen je ihren Platzhalter', async () => {
    zustand.online = false;
    await oeffne(termin({ has_timeslots: true }));
    expect(screen.getByText(TEILNEHMER)).toBeInTheDocument();
    expect(screen.getByText(ZEITFENSTER)).toBeInTheDocument();
  });

  it('ohne Zeitfenster im Termin kein Zeitfenster-Platzhalter', async () => {
    zustand.online = false;
    await oeffne(termin({ has_timeslots: false }));
    expect(screen.queryByText(ZEITFENSTER)).toBeNull();
    expect(screen.getByText(TEILNEHMER)).toBeInTheDocument();
  });

  it('NUR offline: online und wirklich leer steht kein Platzhalter da', async () => {
    zustand.teilnehmer = [];
    zustand.zeitfenster = [];
    await oeffne(termin({ has_timeslots: true }));
    expect(screen.queryByText(TEILNEHMER)).toBeNull();
    expect(screen.queryByText(ZEITFENSTER)).toBeNull();
  });
});

describe('Der Platzhalter selbst', () => {
  it('nennt, was fehlt, statt nur "offline"', () => {
    render(<OfflinePlatzhalter was="Die Punkte-Historie" />);
    expect(screen.getByText('Die Punkte-Historie ist offline nicht verfügbar.')).toBeInTheDocument();
  });

  it('ist als Information gestaltet, nicht als Fehler: Wolke statt Warnzeichen, keine Alarm-Rolle', () => {
    const { container } = render(<OfflinePlatzhalter was="Die Teilnehmerliste" />);
    expect(container.querySelector('i')!.getAttribute('data-icon')).toBe(ICON_OFFLINE);
    expect(container.firstElementChild).toHaveClass('app-offline-platzhalter');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('blendet das Symbol für Vorlesehilfen aus -- der Text spricht', () => {
    const { container } = render(<OfflinePlatzhalter was="Die Teilnehmerliste" />);
    expect(container.querySelector('i')!.getAttribute('aria-hidden')).toBe('true');
  });
});
