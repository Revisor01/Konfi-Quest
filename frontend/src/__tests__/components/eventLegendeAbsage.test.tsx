// Die gemeinsame Legende der Events (shared/EventLegendModal.tsx) erklaert
// jeder Rolle die Absage in Worten: "Absage / Abmeldung" mit einem Satz dazu.
//
// Die Legende ist die Text-Erklaerung des Farbcodes der Event-Listen -- sie
// traegt die Information, die sonst nur die Farbe gibt (nicht allein ueber
// Farbe, WCAG 1.4.1). Sie zeigt je Rolle andere Eintraege
// (ENTRIES.filter nach variant); dieser Test rendert sie fuer alle drei.
// Welche Farbe der Eintrag traegt, legt er nicht fest -- das ist Gestaltung
// (Simon, 15.10.2026).
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import EventLegendModal, { type EventLegendVariant } from '../../components/shared/EventLegendModal';

afterEach(() => cleanup());

describe('Legende der Events: die Absage steht in jeder Rolle in Worten', () => {
  it.each(['konfi', 'teamer', 'admin'] as EventLegendVariant[])(
    'die Legende fuer %s nennt "Absage / Abmeldung" genau einmal, mit Erklaerung',
    (variante) => {
      render(<EventLegendModal variant={variante} onClose={() => undefined} />);
      expect(screen.getAllByText('Absage / Abmeldung')).toHaveLength(1);
      expect(screen.getByText('Abgesagt, abgemeldet oder nicht anwesend gewesen.')).toBeInTheDocument();
    },
  );
});
