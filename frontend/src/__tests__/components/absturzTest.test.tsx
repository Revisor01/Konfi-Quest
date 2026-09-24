import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/*
 * Der Knopf schiesst die App ab — die Sperre davor ist das Eigentliche.
 *
 * Geprueft wird deshalb vor allem, WER ihn NICHT sieht: im Browser niemand,
 * und in der App nur super_admin. Ein Knopf, der die App beendet, darf
 * Konfis und Teamenden nie erreichen; bei einem Ausrollen an viele tausend
 * Menschen waere ein versehentlicher Treffer teuer.
 *
 * Die Rollenpruefung hat eine Falle, die hier mitgesichert ist: super_admins
 * tragen meist `role_name = 'org_admin'` und das FLAG `is_super_admin = true`
 * (siehe navigation/rollenBaeume.ts). Eine Pruefung allein auf
 * `role_name === 'super_admin'` wuerde gerade die Konten uebersehen, um die
 * es geht.
 */

let istNativ = true;
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => istNativ,
    getPlatform: () => (istNativ ? 'ios' : 'web'),
  },
}));

const crash = vi.fn();
vi.mock('@capacitor-firebase/crashlytics', () => ({
  FirebaseCrashlytics: {
    crash: (...a: unknown[]) => crash(...a),
  },
}));

// Der Alert-Haken gibt die Knopf-Liste heraus, damit der Test den
// Bestaetigungsweg nachlaufen kann, ohne eine echte Oberflaeche zu brauchen.
let letzterAlert: { header?: string; buttons?: unknown[] } | null = null;
vi.mock('@ionic/react', () => ({
  IonIcon: () => null,
  useIonAlert: () => [
    (opts: { header?: string; buttons?: unknown[] }) => {
      letzterAlert = opts;
    },
  ],
}));

let angemeldeterNutzer: Record<string, unknown> | null = null;
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: angemeldeterNutzer }),
}));

vi.mock('../../components/shared/icons', () => ({
  ICON_WARNUNG_GEFUELLT: 'warnung',
}));

import AbsturzTest from '../../components/shared/AbsturzTest';

beforeEach(() => {
  istNativ = true;
  crash.mockReset();
  letzterAlert = null;
  angemeldeterNutzer = { is_super_admin: true, role_name: 'org_admin' };
});

describe('AbsturzTest: wer den Knopf sieht', () => {
  it('zeigt ihn super_admins per Flag, auch mit role_name org_admin', () => {
    angemeldeterNutzer = { is_super_admin: true, role_name: 'org_admin' };
    render(<AbsturzTest />);
    expect(screen.getByText('Absturzmeldung prüfen')).toBeInTheDocument();
  });

  it('zeigt ihn auch bei role_name super_admin', () => {
    angemeldeterNutzer = { role_name: 'super_admin' };
    render(<AbsturzTest />);
    expect(screen.getByText('Absturzmeldung prüfen')).toBeInTheDocument();
  });

  it('zeigt ihn einem Konfi NICHT — der verbotene Fall', () => {
    angemeldeterNutzer = { role_name: 'konfi', is_super_admin: false };
    render(<AbsturzTest />);
    expect(screen.queryByText('Absturzmeldung prüfen')).not.toBeInTheDocument();
  });

  it('zeigt ihn einer Teamer:in NICHT', () => {
    angemeldeterNutzer = { role_name: 'teamer' };
    render(<AbsturzTest />);
    expect(screen.queryByText('Absturzmeldung prüfen')).not.toBeInTheDocument();
  });

  it('zeigt ihn einer normalen Leitung NICHT', () => {
    angemeldeterNutzer = { role_name: 'org_admin', is_super_admin: false };
    render(<AbsturzTest />);
    expect(screen.queryByText('Absturzmeldung prüfen')).not.toBeInTheDocument();
  });

  it('zeigt ihn ohne Anmeldung NICHT', () => {
    angemeldeterNutzer = null;
    render(<AbsturzTest />);
    expect(screen.queryByText('Absturzmeldung prüfen')).not.toBeInTheDocument();
  });

  it('zeigt ihn im Browser NICHT, auch nicht super_admins', () => {
    istNativ = false;
    angemeldeterNutzer = { is_super_admin: true };
    render(<AbsturzTest />);
    expect(screen.queryByText('Absturzmeldung prüfen')).not.toBeInTheDocument();
  });
});

describe('AbsturzTest: der Weg zum Absturz', () => {
  it('stuerzt beim Antippen NICHT sofort ab, sondern fragt nach', () => {
    render(<AbsturzTest />);
    screen.getByText('Absturzmeldung prüfen').click();
    expect(crash).not.toHaveBeenCalled();
    expect(letzterAlert?.header).toBe('Absturz auslösen?');
  });

  it('weist im Hinweis auf den naechsten Start hin', () => {
    // Ohne diesen Satz sieht ein gelungener Test wie ein Fehlschlag aus:
    // Crashlytics sendet den Bericht erst beim naechsten Oeffnen.
    render(<AbsturzTest />);
    screen.getByText('Absturzmeldung prüfen').click();
    const alert = letzterAlert as unknown as { message: string };
    expect(alert.message).toContain('nächsten');
  });

  it('bietet Abbrechen an erster Stelle', () => {
    render(<AbsturzTest />);
    screen.getByText('Absturzmeldung prüfen').click();
    const knoepfe = letzterAlert?.buttons as Array<{ text: string; role?: string }>;
    expect(knoepfe[0].text).toBe('Abbrechen');
    expect(knoepfe[0].role).toBe('cancel');
  });

  it('stuerzt erst nach der Bestaetigung ab', () => {
    render(<AbsturzTest />);
    screen.getByText('Absturzmeldung prüfen').click();
    const knoepfe = letzterAlert?.buttons as Array<{
      text: string;
      handler?: () => void;
    }>;
    const bestaetigen = knoepfe.find((k) => k.text === 'Wirklich abstürzen');
    expect(bestaetigen).toBeDefined();
    bestaetigen?.handler?.();
    expect(crash).toHaveBeenCalledTimes(1);
    expect(crash).toHaveBeenCalledWith({ message: 'Testabsturz aus dem Profil' });
  });
});
