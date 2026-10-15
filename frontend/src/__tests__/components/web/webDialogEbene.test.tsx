// Wo ein Dialog der Web-Fassung hängt (12.10.2026): in <ion-app>, nicht an
// <body>. ion-app bildet mit `contain` und `z-index: 0` eine eigene Ebene, und
// Ionic hängt seine Rückfragen (ion-alert) und Meldungen (ion-toast) dort
// hinein. Hing der Dialog an <body>, lag er über dieser ganzen Ebene: Eine
// Rückfrage aus dem Dialog („Gemeinde anlegen", „Eigenes Passwort setzen")
// stand unsichtbar dahinter, eine Fehlermeldung abgedunkelt und halb
// verdeckt. In ion-app entscheidet der z-index: Der Grund (1000) liegt unter
// Ionics Overlays (Modals ab 20000, Toasts ab 60000) und über der Seite.
// Gemessen im Browser: 0 von 384 Rasterpunkten über dem Fenster gehören der
// Seite (5 Fenster, 1440 und 1024 px), die Meldung steht obenauf.
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';

vi.mock('@ionic/react', async () => (await import('../support/ionicAttrappe')).ionicAttrappe({}));

import WebDialog from '../../../components/web/WebDialog';

const grund = (name: string) => screen.getByRole('dialog', { name }).parentElement!;

afterEach(() => {
  document.querySelectorAll('ion-app').forEach((a) => a.remove());
});

describe('WebDialog: in der Ebene von Ionics Rückfragen und Meldungen', () => {
  it('hängt in <ion-app>, wenn es eine gibt -- dort, wo Ionic ion-alert und ion-toast einhängt', () => {
    const app = document.createElement('ion-app');
    document.body.append(app);
    render(<WebDialog titel="Gemeinde anlegen" onSchliessen={() => {}}>{null}</WebDialog>);
    expect(grund('Gemeinde anlegen').parentElement).toBe(app);
  });

  it('ein zweites Fenster (Rückfrage) hängt dahinter in derselben Ebene und liegt damit obenauf', () => {
    const app = document.createElement('ion-app');
    document.body.append(app);
    render(
      <>
        <WebDialog titel="Gemeinde anlegen" onSchliessen={() => {}}>{null}</WebDialog>
        <WebDialog titel="Eingaben verwerfen?" onSchliessen={() => {}}>{null}</WebDialog>
      </>,
    );
    expect([...app.querySelectorAll(':scope > .web-dialog-grund h2')].map((h) => h.textContent)).toEqual(['Gemeinde anlegen', 'Eingaben verwerfen?']);
  });

  it('ohne <ion-app> (vor dem Start der App) an <body>', () => {
    render(<WebDialog titel="Gemeinde anlegen" onSchliessen={() => {}}>{null}</WebDialog>);
    expect(grund('Gemeinde anlegen').parentElement).toBe(document.body);
  });

  it('der Grund liegt unter Ionics Overlays: z-index unter 20000 (Modals), damit Rückfragen und Meldungen darüber stehen', () => {
    const css = readFileSync(resolve(__dirname, '../../../theme/web-ansicht.css'), 'utf8');
    const regel = /\.web-dialog-grund\s*\{([^}]*)\}/.exec(css);
    expect(regel).not.toBeNull();
    const z = /z-index:\s*(\d+)/.exec(regel![1]);
    expect(z).not.toBeNull();
    expect(Number(z![1])).toBeLessThan(20000);
  });
});
