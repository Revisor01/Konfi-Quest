// Konfi-Stammdaten bearbeiten -- gerendert (Audit Tests 26.09.2026, BF-02;
// vorher Quelltext-Test, 30.09.2026 umgestellt).
//
// Konfi-Stammdaten (Name, Jahrgang) waren nach dem Anlegen in KEINER Ansicht
// änderbar -- die Backend-Route gab es, sie hatte nur keinen Knopf. Gebaut am
// 27.08.2026 nach Simons Entscheidung: Bearbeiten für die Leitung, Name UND
// Jahrgang. Simons Leitsatz: "Neuer Jahrgang, die Regeln des Jahrgangs
// gelten."
//
// Die Warnungen beim Jahrgangswechsel sind die heikle Hälfte: Verschwände
// eine still, fiele es niemandem auf. Deshalb wird das ECHTE Modal gerendert
// und der Jahrgang gewechselt -- und geprüft, welche Warnung dann dasteht.
// Den Einstieg (Knopf, Route, Daten fürs Modal) prüft die gerenderte
// Personenansicht.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, konfi, oeffne, knopf, zuletztGeoeffnet, api, setSuccess, KONFI_ID,
} from './gerueste/leitungKonfiDetail';

beforeEach(zuruecksetzen);

describe('Stammdaten bearbeiten: der Einstieg in der Personenansicht', () => {
  it('die Leitung hat einen Bearbeiten-Knopf, er öffnet das Modal mit den Daten der Konfi', async () => {
    await oeffne();
    await act(async () => { fireEvent.click(knopf('Konfi bearbeiten')!); });
    const modal = zuletztGeoeffnet('KonfiModal')!;
    expect(modal.props.konfi).toEqual({
      id: KONFI_ID, display_name: 'Emilia Test', jahrgang_id: 3, gottesdienst_points: 4, gemeinde_points: 2,
    });
  });

  it('Speichern nutzt die vorhandene Route PUT /admin/konfis/:id und meldet Erfolg', async () => {
    await oeffne();
    await act(async () => { fireEvent.click(knopf('Konfi bearbeiten')!); });
    const onSave = zuletztGeoeffnet('KonfiModal')!.props.onSave as (d: { name: string; jahrgang_id: number }) => Promise<void>;
    await act(async () => { await onSave({ name: 'Emilia Test-Neu', jahrgang_id: 4 }); });
    expect(api.put).toHaveBeenCalledWith(`/admin/konfis/${KONFI_ID}`, { name: 'Emilia Test-Neu', jahrgang_id: 4 });
    expect(setSuccess).toHaveBeenCalledWith('Änderungen gespeichert');
  });

  it('bei Teamer:innen erscheint er nicht (ihre Stammdaten liegen in der Benutzerverwaltung)', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({ role_name: 'teamer' }));
    await oeffne();
    expect(knopf('Konfi bearbeiten')).toBeNull();
    // Stattdessen: Zertifikat zuweisen und Passwort -- die Kopfzeile ist da.
    expect(knopf('Zertifikat zuweisen')).not.toBeNull();
  });

  it('offline ist er gesperrt', async () => {
    zustand.online = false;
    zustand.cache.set('admin:konfis:1', [{ id: KONFI_ID, name: 'Emilia Test', jahrgang_id: 3 }]);
    await oeffne();
    expect((knopf('Konfi bearbeiten') as HTMLButtonElement).disabled).toBe(true);
  });

  it('die Jahrgänge samt Punktearten kommen aus /admin/jahrgaenge (nicht /jahrgaenge)', async () => {
    zustand.antworten.set('/admin/jahrgaenge', [
      { id: 3, name: 'Jahrgang 2026', gottesdienst_enabled: true },
      { id: 4, name: 'Jahrgang 2027', gottesdienst_enabled: false },
    ]);
    await oeffne();
    const pfade = api.get.mock.calls.map((c) => c[0]);
    expect(pfade).toContain('/admin/jahrgaenge');
    expect(pfade).not.toContain('/jahrgaenge');
    await act(async () => { fireEvent.click(knopf('Konfi bearbeiten')!); });
    expect(zuletztGeoeffnet('KonfiModal')!.props.jahrgaenge).toEqual([
      { id: 3, name: 'Jahrgang 2026', gottesdienst_enabled: true },
      { id: 4, name: 'Jahrgang 2027', gottesdienst_enabled: false },
    ]);
  });

  it('der Jahrgang der Konfi bleibt sichtbar, auch wenn die Liste ausfällt', async () => {
    zustand.antworten.set('/admin/jahrgaenge', new Error('Serverfehler'));
    await oeffne();
    await act(async () => { fireEvent.click(knopf('Konfi bearbeiten')!); });
    expect(zuletztGeoeffnet('KonfiModal')!.props.jahrgaenge).toEqual([{ id: 3, name: 'Jahrgang 2026' }]);
  });

  it('die eigenen Zuweisungen kommen aus dem Konto -- nur für admin, nur sichtbare', async () => {
    zustand.rolle = 'admin';
    zustand.zugewieseneJahrgaenge = [{ id: 3 }, { id: 4, can_view: false }, { id: 5, can_view: true }];
    const erste = await oeffne();
    await act(async () => { fireEvent.click(knopf('Konfi bearbeiten')!); });
    expect(zuletztGeoeffnet('KonfiModal')!.props.eigeneJahrgangIds).toEqual([3, 5]);
    erste.unmount();

    zuruecksetzen();
    zustand.rolle = 'org_admin';
    zustand.zugewieseneJahrgaenge = [{ id: 3 }];
    await oeffne();
    await act(async () => { fireEvent.click(knopf('Konfi bearbeiten')!); });
    expect(zuletztGeoeffnet('KonfiModal')!.props.eigeneJahrgangIds).toBeUndefined();
  });
});

// --- Das Modal selbst ---------------------------------------------------------

const ladeModal = async () =>
  (await vi.importActual<typeof import('../../components/admin/modals/KonfiModal')>('../../components/admin/modals/KonfiModal')).default;

const JAHRGAENGE = [
  { id: 3, name: 'Jahrgang 2026', gottesdienst_enabled: true, gemeinde_enabled: true },
  { id: 4, name: 'Jahrgang 2027', gottesdienst_enabled: false, gemeinde_enabled: false },
  { id: 5, name: 'Jahrgang 2028', gottesdienst_enabled: true, gemeinde_enabled: true },
];
const EMILIA = { id: KONFI_ID, display_name: 'Emilia Test', jahrgang_id: 3, gottesdienst_points: 4, gemeinde_points: 2 };

const zeigeModal = async (props: Record<string, unknown> = {}) => {
  const KonfiModal = await ladeModal();
  const onSave = vi.fn();
  render(<KonfiModal jahrgaenge={JAHRGAENGE} onClose={vi.fn()} onSave={onSave} konfi={EMILIA} {...props} />);
  return { onSave };
};
const waehle = (name: string) => fireEvent.click(screen.getByText(name).closest('[role="button"]')!);
const warnung = () => screen.queryByText('Was der Wechsel bewirkt');

describe('Stammdaten bearbeiten: EIN Modal für Anlegen und Bearbeiten', () => {
  it('beim Bearbeiten heißt es "Konfi bearbeiten", die Felder sind vorbelegt, und der Benutzername-Hinweis steht da', async () => {
    await zeigeModal();
    expect(screen.getByText('Konfi bearbeiten')).toBeInTheDocument();
    expect((screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('Emilia Test');
    expect(screen.getByText('Jahrgang 2026').closest('[role="button"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/Der Benutzername zum Anmelden ändert sich nicht/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Änderungen speichern' })).toBeInTheDocument();
  });

  it('beim Anlegen heißt es "Konfi erstellen", leer, ohne Benutzername-Hinweis', async () => {
    await zeigeModal({ konfi: undefined });
    expect(screen.getByText('Konfi erstellen')).toBeInTheDocument();
    expect((screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(/Der Benutzername zum Anmelden ändert sich nicht/)).toBeNull();
    expect(warnung()).toBeNull();
  });
});

describe('Stammdaten bearbeiten: die Warnungen beim Jahrgangswechsel', () => {
  it('ohne Wechsel (nur Name) keine Warnung', async () => {
    await zeigeModal();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Emilia Tést' } });
    expect(warnung()).toBeNull();
  });

  it('beim Wechsel: was sich ändert und was NICHT', async () => {
    await zeigeModal();
    waehle('Jahrgang 2028');
    expect(warnung()).not.toBeNull();
    for (const satz of [
      'Es gelten die Regeln des neuen Jahrgangs:',
      'Anmeldungen zu künftigen Events des alten Jahrgangs fallen weg.',
      'Pflicht-Events des neuen Jahrgangs kommen dazu.',
      'Der Jahrgangs-Chat wechselt mit.',
    ]) expect(screen.getByText(satz)).toBeInTheDocument();
    expect(screen.getByText(/Der Jahresrückblick erscheint erst wieder/)).toBeInTheDocument();
    expect(screen.getByText(/Bereits erfasste Anwesenheiten und vergangene Events bleiben/)).toBeInTheDocument();
    // Ziel hat beide Punktearten: keine Punkte-Warnung.
    expect(screen.queryByText(/werden dort nicht mehr angezeigt/)).toBeNull();
  });

  it('zurück auf den eigenen Jahrgang: die Warnung verschwindet', async () => {
    await zeigeModal();
    waehle('Jahrgang 2028');
    waehle('Jahrgang 2026');
    expect(warnung()).toBeNull();
  });

  it('bei abgeschalteter Punkteart warnt sie konkret, mit Zahl', async () => {
    await zeigeModal();
    waehle('Jahrgang 2027');
    expect(screen.getByText(/In Jahrgang 2027 sind diese Punktearten abgeschaltet/).textContent)
      .toContain('4 Gottesdienstpunkte und 2 Gemeindepunkte werden dort nicht mehr angezeigt.');
  });

  it('die Punkte-Warnung kommt nur, wenn es wirklich Punkte gibt', async () => {
    await zeigeModal({ konfi: { ...EMILIA, gottesdienst_points: 0, gemeinde_points: 2 } });
    waehle('Jahrgang 2027');
    const satz = screen.getByText(/In Jahrgang 2027 ist diese Punkteart abgeschaltet/).textContent!;
    expect(satz).toContain('2 Gemeindepunkte werden dort nicht mehr angezeigt.');
    expect(satz).not.toContain('Gottesdienstpunkte');
  });

  it('... und ganz ohne Punkte keine Punkte-Warnung', async () => {
    await zeigeModal({ konfi: { ...EMILIA, gottesdienst_points: 0, gemeinde_points: 0 } });
    waehle('Jahrgang 2027');
    expect(screen.queryByText(/werden dort nicht mehr angezeigt/)).toBeNull();
  });

  it('bei fremdem Jahrgang warnt sie vor dem Sichtverlust (admin mit Zuweisungen)', async () => {
    await zeigeModal({ eigeneJahrgangIds: [3] });
    waehle('Jahrgang 2028');
    expect(screen.getByText(/Du bist Jahrgang 2028 nicht zugewiesen/).textContent)
      .toContain('siehst du Emilia Test nicht mehr in deiner Liste');
  });

  it('keine Sicht-Warnung in einen eigenen Jahrgang und keine für die Leitung ohne Zuweisungsliste', async () => {
    await zeigeModal({ eigeneJahrgangIds: [3, 5] });
    waehle('Jahrgang 2028');
    expect(screen.queryByText(/nicht zugewiesen/)).toBeNull();
  });

  it('... auch nicht bei leerer Zuweisungsliste (dann gibt es nichts zu verlieren)', async () => {
    await zeigeModal({ eigeneJahrgangIds: [] });
    waehle('Jahrgang 2028');
    expect(screen.queryByText(/nicht zugewiesen/)).toBeNull();
  });

  it('... auch nicht, wenn eigeneJahrgangIds fehlt (org_admin sieht alle Jahrgänge)', async () => {
    await zeigeModal({ eigeneJahrgangIds: undefined });
    waehle('Jahrgang 2028');
    expect(screen.queryByText(/nicht zugewiesen/)).toBeNull();
  });

  it('keine der Warnungen blockiert das Speichern', async () => {
    const { onSave } = await zeigeModal({ eigeneJahrgangIds: [3] });
    waehle('Jahrgang 2027');
    expect(screen.getByText(/werden dort nicht mehr angezeigt/)).toBeInTheDocument();
    expect(screen.getByText(/nicht zugewiesen/)).toBeInTheDocument();
    const speichern = screen.getByRole('button', { name: 'Änderungen speichern' }) as HTMLButtonElement;
    expect(speichern.disabled).toBe(false);
    await act(async () => { fireEvent.click(speichern); });
    expect(onSave).toHaveBeenCalledWith({ name: 'Emilia Test', jahrgang_id: 4 });
  });

  it('ohne Namen lässt es sich nicht speichern', async () => {
    await zeigeModal();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: '   ' } });
    expect((screen.getByRole('button', { name: 'Änderungen speichern' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

void React;
