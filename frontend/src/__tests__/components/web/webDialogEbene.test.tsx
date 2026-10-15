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
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
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

  it('... und ueber jeder Ebene der Seite: z-index hoeher als alles, was Seite, Leiste und Chat stapeln', () => {
    // Laege der Grund niedriger, deckte etwa die Ablage im Chat-Raum oder ein
    // offenes Menue Teile des Fensters ab -- es waere verdeckt und nicht
    // bedienbar. Verglichen wird mit jeder Stufe der Stylesheets von Seite,
    // Seitenleiste und Web-Bereichen unterhalb von Ionics Overlays (Modals ab
    // 20000); Sperrbildschirm und Abdeckung liegen bewusst darueber. Welcher
    // Wert, legt der Test nicht fest.
    const theme = resolve(__dirname, '../../../theme');
    const dateien = [
      join(theme, 'variables.css'),
      join(theme, 'web-ansicht.css'),
      resolve(__dirname, '../../../components/layout/Seitenleiste.css'),
      ...readdirSync(join(theme, 'web')).filter((d) => d.endsWith('.css')).map((d) => join(theme, 'web', d)),
    ];
    let grund = NaN;
    const seite: string[] = [];
    for (const datei of dateien) {
      const css = readFileSync(datei, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const [, selektor, rumpf] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const z = /z-index:\s*(-?\d+)/.exec(rumpf);
        if (!z) continue;
        if (/^\.web-dialog-grund$/.test(selektor.trim())) grund = Number(z[1]);
        else if (Number(z[1]) < 20000) seite.push(`${selektor.trim()}: ${z[1]}`);
      }
    }
    expect(seite.length).toBeGreaterThan(5);
    const hoechste = Math.max(...seite.map((r) => Number(r.split(': ').pop())));
    expect(grund, `hoechste Stufe der Seite: ${seite.find((r) => r.endsWith(`: ${hoechste}`))}`).toBeGreaterThan(hoechste);
  });
});
