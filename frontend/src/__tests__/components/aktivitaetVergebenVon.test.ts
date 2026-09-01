import { describe, it, expect } from 'vitest';
import type { Activity } from '../../components/admin/views/KonfiDetailSections';

// Befund 31.08.2026 (Simon): In der Konfi-Detailansicht der Leitung steht bei
// Bonuspunkten und bei Events, wer sie eingetragen hat -- bei den
// AKTIVITAETEN stand nur das Datum.
//
// Ursache: dieselbe wie bei den Bonuspunkten einen Tag zuvor. Die Liste las
// `activity.admin`. Die Antwort (GET /admin/konfis/:id -> activities) liefert
// den Namen aber als `admin_name` -- die Abfrage aliast
// `u.display_name as admin_name` (backend/routes/konfi-management.js:543).
//
// Gemessen an Produktion am 31.08.2026 (Demo-Gemeinde, Konfis 150/153/158):
// Jeder Aktivitaets-Eintrag traegt `admin_name`, `admin` fehlt vollstaendig.
// Anders als bei den Bonuspunkten gab es hier KEINEN Rueckfall auf 'Admin' --
// die Zeile blieb also schlicht leer.

// So liefert das Backend einen Eintrag (Feldnamen aus der Produktionsantwort):
const eintrag: Activity = {
  id: 42,
  name: 'Gottesdienst besucht',
  points: 2,
  type: 'gottesdienst',
  date: '2026-08-20',
  completed_date: '2026-08-20',
  admin_name: 'Simon Luthe',
};

// FALSCH (bis 31.08.2026)
const alteAnzeige = (a: Activity) =>
  (a as unknown as { admin?: string }).admin;
// RICHTIG
const eingetragenVon = (a: Activity) => a.admin || a.admin_name || 'Admin';

describe('Aktivitaeten: wer hat eingetragen', () => {
  it('zeigt den Namen aus admin_name', () => {
    expect(eingetragenVon(eintrag)).toBe('Simon Luthe');
  });

  it('blieb mit dem alten Feldnamen leer', () => {
    expect(alteAnzeige(eintrag)).toBeUndefined();
  });

  it('faellt ohne Namen auf "Admin" zurueck', () => {
    const ohneNamen: Activity = { ...eintrag, admin_name: undefined };
    expect(eingetragenVon(ohneNamen)).toBe('Admin');
  });

  it('behaelt bei offenen Antraegen den Wartetext aus `admin`', () => {
    // Offene Antraege baut die Ansicht selbst zusammen
    // (KonfiDetailView.tsx) und setzt dort `admin` als Statustext. Der darf
    // durch die Korrektur nicht verlorengehen.
    const wartend: Activity = {
      id: 'request-9',
      name: 'Konfitag (gemeldet)',
      points: 3,
      type: 'pending',
      date: '2026-08-29',
      admin: 'Wartend auf Genehmigung',
      isPending: true,
    };
    expect(eingetragenVon(wartend)).toBe('Wartend auf Genehmigung');
  });
});
