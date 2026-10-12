// Der Vorgang „Lizenz und Abrechnung" in der App (docs/planung/
// support-detailseiten.md, Lizenz-Vorgang; Simon, 11.10.2026: „Antrag meint
// bitte um Lizenz"): Abschnitt „Lizenz" vor dem Kontakt mit Tarif, Konfis,
// Laufzeit und Wunsch bei der Anmeldung; in der Karte „Stand" die Zeile
// „Lizenz heute" und „Lizenz ändern" neben dem Hauptknopf; das Modal „Lizenz
// ändern" (Abbrechen | Lizenz ändern | Speichern) speichert nur über die
// bestehenden Gemeinde-Routen: PATCH …/limit für den Tarif, GET und PUT
// /organizations/:id mit dem vollen Körper für die Laufzeit. Dieselben Aufrufe
// prüft webLizenzVorgang.test.tsx für den Browser.
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';
import { vorgang, vorgaengeServer, type ServerOptionen } from './vorgaengeServer';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  push: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  alert: null as null | AlertOptionen,
  online: true,
}));

// Das Modal wie Ionic: Schließen läuft über dismiss() und fragt canDismiss.
vi.mock('@ionic/react', async () => {
  const basis = (await import('./ionicAttrappe')).ionicAttrappe({
    presentAlert: (o) => { h.alert = o; },
    router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
  });
  const { createElement, forwardRef, useImperativeHandle } = await import('react');
  type ModalProps = { isOpen?: boolean; children?: unknown; 'aria-label'?: string; canDismiss?: boolean | (() => Promise<boolean>); onDidDismiss?: () => void };
  const IonModal = forwardRef<unknown, ModalProps>((p, ref) => {
    useImperativeHandle(ref, () => ({
      dismiss: async () => {
        const darf = typeof p.canDismiss === 'function' ? await p.canDismiss() : p.canDismiss !== false;
        if (darf) p.onDidDismiss?.();
        return darf;
      },
    }));
    return p.isOpen ? createElement('div', { role: 'dialog', 'aria-label': p['aria-label'] }, p.children as never) : null;
  });
  return { ...basis, IonModal };
});
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch, put: h.apiPut, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 9, role_name: 'super_admin', is_super_admin: true }, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => false }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ pathname: '/admin/support/vorgaenge/7', search: '', state: null }) }));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

import SupportVorgangDetailPage from '../../../components/support/SupportVorgangDetailPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

let server: ReturnType<typeof vorgaengeServer>;

/** Zwei Lizenz-Vorgänge: Nr. 7 mit Gemeinde 7 (Testphase bis 02.11., 3 von 5 Konfis), Nr. 8 ohne Zuordnung. */
const aufbauen = (gemeinden: ServerOptionen['gemeinden'] = {}) => {
  server = vorgaengeServer({
    gemeindeNameWieServer: true,
    gemeinden,
    vorgaenge: [
      vorgang(7, { art: 'lizenz', bereich: null, betreff: 'Lizenz verlängern', organization_id: 7, kontakt_name: 'Pastorin Lena Probe',
        kontakt_email: 'lena.probe@example.org', beschreibung: 'Wir möchten auf Standard wechseln.' }),
      vorgang(8, { art: 'lizenz', bereich: null, betreff: 'Rechnung', organization_id: null, kontakt_name: 'Anna Beispiel',
        kontakt_email: 'anna@example.org', gemeinde_angabe: 'Kirchengemeinde Heide', beschreibung: 'Wo ist die Rechnung?' }),
    ],
    mails: [],
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, put: h.apiPut, delete: h.apiDelete });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T09:00:00Z'));
  h.alert = null;
  h.online = true;
  supportMailZaehlerZuruecksetzen();
  aufbauen();
});

afterEach(() => { vi.useRealTimers(); });

const oeffnen = async (id = 7) => {
  render(<SupportVorgangDetailPage vorgangId={id} />);
  await screen.findByRole('region', { name: 'Stand' });
};
const stand = () => within(screen.getByRole('region', { name: 'Stand' }));
const knoepfe = () => [...document.querySelectorAll('.support-stand__knoepfe button')].map((k) => k.textContent);
const wert = (karte: string, label: string): string | null => {
  const zeile = [...document.querySelectorAll(`[data-karte="${karte}"] .support-angabe`)]
    .find((z) => z.querySelector('.support-angabe__label')?.textContent === label);
  return zeile?.querySelector('.support-angabe__wert')?.firstChild?.textContent ?? null;
};
const labels = (karte: string) => [...document.querySelectorAll(`[data-karte="${karte}"] .support-angabe__label`)].map((l) => l.textContent);
/** Der Knopf unter dem Abschnitt „Lizenz". */
const kartenKnopf = () => document.querySelector('[data-karte="lizenz"]')!.nextElementSibling as HTMLButtonElement;
const klicken = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };
const bestaetigen = async (knopf: string) => { await act(async () => { h.alert?.buttons?.find((b) => b.text === knopf)?.handler?.(); }); };
const modalOeffnen = () => {
  fireEvent.click(stand().getByRole('button', { name: 'Lizenz ändern' }));
  return within(screen.getByRole('dialog', { name: 'Lizenz ändern' }));
};
const schreibende = () => [...server.aufrufe('patch'), ...server.aufrufe('put'), ...server.aufrufe('post')];

describe('Lizenz-Vorgang (App): Abschnitt „Lizenz" und Stand', () => {
  it('der Abschnitt „Lizenz" steht vor dem Kontakt: Tarif, Konfis, Laufzeit; die Gemeinde-Karte ohne Laufzeit und Konfis', async () => {
    await oeffnen();
    expect([...document.querySelectorAll('[data-karte]')].map((k) => k.getAttribute('data-karte'))).toEqual(['lizenz', 'kontakt', 'gemeinde']);
    expect(wert('lizenz', 'Tarif')).toBe('Testphase — bis 5 Konfis · kostenlos');
    expect(wert('lizenz', 'Konfis')).toBe('3 von 5');
    expect(wert('lizenz', 'Laufzeit')).toBe('Testphase bis 02.11.');
    expect(labels('gemeinde')).toEqual(['Kreis']);
    // Die Aktion des Abschnitts steht direkt unter seinen Zeilen.
    expect(kartenKnopf()).toHaveTextContent('Lizenz ändern');
    expect(kartenKnopf()).toBeEnabled();
  });

  it('der Wunsch bei der Anmeldung steht in der Karte und in der Zeile „Lizenz heute"', async () => {
    aufbauen({ 7: { wunsch_lizenz: 'standard' } });
    await oeffnen();
    expect(wert('lizenz', 'Wunsch bei der Anmeldung')).toBe('Standard — bis 50 Konfis · 99\u00a0€ pro Jahr');
    expect(stand().getByText('Lizenz heute: Testphase bis 02.11. · bei der Anmeldung gewünscht: Standard.')).toBeInTheDocument();
  });

  it('die Karte „Stand": Hauptknopf „Antworten", darunter „Lizenz ändern" und „Erledigt"', async () => {
    await oeffnen();
    expect(knoepfe()).toEqual(['Antworten', 'Lizenz ändern', 'Erledigt']);
    expect(stand().getByText('Lizenz heute: Testphase bis 02.11.')).toBeInTheDocument();
  });

  it('ohne Gemeinde: „Nicht zugeordnet" in der Karte, „Lizenz ändern" gesperrt, im Stand „Gemeinde zuordnen"', async () => {
    await oeffnen(8);
    expect(wert('lizenz', 'Gemeinde')).toBe('Nicht zugeordnet – laut Formular: Kirchengemeinde Heide');
    expect(kartenKnopf()).toHaveTextContent('Lizenz ändern');
    expect(kartenKnopf()).toBeDisabled();
    expect(knoepfe()).toEqual(['Antworten', 'Gemeinde zuordnen', 'Erledigt']);
    expect(stand().getByText('Die Lizenz lässt sich erst ändern, wenn eine Gemeinde zugeordnet ist – laut Formular: Kirchengemeinde Heide.')).toBeInTheDocument();
    fireEvent.click(stand().getByRole('button', { name: 'Gemeinde zuordnen' }));
    expect(screen.getByRole('dialog', { name: 'Einordnen' })).toBeInTheDocument();
  });
});

describe('Lizenz-Vorgang (App): Modal „Lizenz ändern"', () => {
  it('Kopf „Abbrechen | Lizenz ändern | Speichern"; Speichern erst nach einer Änderung; oben der heutige Stand', async () => {
    await oeffnen();
    const modal = modalOeffnen();
    expect(modal.getByRole('button', { name: 'Abbrechen' })).toBeEnabled();
    expect(modal.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    expect(modal.getByText('Kirchengemeinde Musterdorf · heute: Testphase bis 02.11. · 3 von 5 Konfis')).toBeInTheDocument();
    fireEvent.change(modal.getByLabelText('Tarif'), { target: { value: '15' } });
    expect(modal.getByRole('button', { name: 'Speichern' })).toBeEnabled();
  });

  it('nur der Tarif: genau PATCH …/limit, kein GET und kein PUT der Gemeinde', async () => {
    await oeffnen();
    const modal = modalOeffnen();
    fireEvent.change(modal.getByLabelText('Tarif'), { target: { value: '15' } });
    await klicken(modal.getByRole('button', { name: 'Speichern' }));
    expect(server.aufrufe('patch').map((a) => [a.pfad, a.koerper])).toEqual([['/organizations/7/limit', { max_konfis: 15 }]]);
    expect(server.aufrufe('get', '/organizations/7')).toHaveLength(0);
    expect(server.aufrufe('put')).toHaveLength(0);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('„Wunschlizenz übernehmen": Vorschau Standard; Speichern: Tarif, dann GET und PUT mit dem vollen Körper', async () => {
    aufbauen({ 7: { wunsch_lizenz: 'standard', contact_email: 'buero@musterdorf.example' } });
    await oeffnen();
    const modal = modalOeffnen();
    fireEvent.click(modal.getByRole('button', { name: 'Wunschlizenz übernehmen: Standard' }));
    expect(modal.getByText('Danach: Standard — bis 50 Konfis · 99 € pro Jahr · Lizenz bis 02.11.2027.')).toBeInTheDocument();
    await klicken(modal.getByRole('button', { name: 'Speichern' }));
    expect(server.aufrufe('patch').map((a) => [a.pfad, a.koerper])).toEqual([['/organizations/7/limit', { max_konfis: 50 }]]);
    expect(server.aufrufe('get', '/organizations/7')).toHaveLength(1);
    expect(server.aufrufe('put').map((a) => [a.pfad, a.koerper])).toEqual([['/organizations/7', {
      name: 'musterdorf', slug: 'musterdorf', display_name: 'Kirchengemeinde Musterdorf', description: null, contact_name: null,
      contact_email: 'buero@musterdorf.example', contact_phone: null, address: null, website_url: null, kirchenkreis: 'Dithmarschen',
      is_active: true, kirchenkreis_id: 11, trial_ends_at: '2027-11-02T00:00:00.000Z', is_trial: false,
    }]]);
    expect(h.setSuccess).toHaveBeenCalledWith('Lizenz geändert: Standard bis 02.11.2027');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Standard — bis 50 Konfis · 99 € pro Jahr')).toBeInTheDocument();
  });

  it('scheitert die Laufzeit nach dem Tarif: Teilmeldung, das Modal bleibt mit dem Entwurf offen', async () => {
    aufbauen({ 7: { wunsch_lizenz: 'standard' } });
    await oeffnen();
    const modal = modalOeffnen();
    fireEvent.click(modal.getByRole('button', { name: 'Wunschlizenz übernehmen: Standard' }));
    server.stand.fehler.set('PUT /organizations/7', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    await klicken(modal.getByRole('button', { name: 'Speichern' }));
    expect(h.setError).toHaveBeenCalledWith('Tarif gespeichert, Laufzeit nicht – bitte erneut speichern.');
    expect(screen.getByRole('dialog', { name: 'Lizenz ändern' })).toBeInTheDocument();
  });

  it('ein ungültiges eigenes Limit: der Fehler steht statt der Vorschau -- sie rechnete sonst mit dem alten Limit (wie im Browser)', async () => {
    await oeffnen();
    const modal = modalOeffnen();
    fireEvent.change(modal.getByLabelText('Tarif'), { target: { value: '__eigen__' } });
    fireEvent.change(modal.getByLabelText('Konfi-Limit'), { target: { value: 'abc' } });
    expect(modal.getByText('Das Konfi-Limit muss eine ganze Zahl ab 1 sein')).toBeInTheDocument();
    expect(modal.queryByText(/^Danach:/)).toBeNull();
    expect(modal.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    fireEvent.change(modal.getByLabelText('Konfi-Limit'), { target: { value: '40' } });
    expect(modal.queryByText('Das Konfi-Limit muss eine ganze Zahl ab 1 sein')).toBeNull();
    expect(modal.getByText('Danach: Eigenes Limit — 40 Konfis · Testphase bis 02.11.')).toBeInTheDocument();
  });

  it('eine gesperrte Gemeinde: die Vorschau sagt, dass der Zugang gesperrt bleibt', async () => {
    aufbauen({ 7: { wunsch_lizenz: 'standard', is_active: false } });
    await oeffnen();
    const modal = modalOeffnen();
    fireEvent.click(modal.getByRole('button', { name: 'Wunschlizenz übernehmen: Standard' }));
    expect(modal.getByText('Der Zugang der Gemeinde bleibt gesperrt – freigeben lässt er sich im Formular der Gemeinde.')).toBeInTheDocument();
  });

  it('Abbrechen ohne Änderung: kein Aufruf; mit Änderung erst die Rückfrage', async () => {
    await oeffnen();
    await klicken(modalOeffnen().getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(h.alert).toBeNull();
    const modal = modalOeffnen();
    fireEvent.change(modal.getByLabelText('Tarif'), { target: { value: '15' } });
    await klicken(modal.getByRole('button', { name: 'Abbrechen' }));
    expect(h.alert?.header).toBe('Ungespeicherte Änderungen');
    await bestaetigen('Verwerfen');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(schreibende().filter((a) => a.pfad !== '/support/mail/gelesen')).toHaveLength(0);
  });

  it('auch der Abschnitt „Lizenz" öffnet das Modal; der Link führt ins Formular der Gemeinde', async () => {
    await oeffnen();
    fireEvent.click(kartenKnopf());
    const modal = within(screen.getByRole('dialog', { name: 'Lizenz ändern' }));
    await klicken(modal.getByRole('button', { name: 'Alle Angaben der Gemeinde bearbeiten' }));
    expect(h.push).toHaveBeenCalledWith('/admin/organizations?gemeinde=7&bearbeiten=1');
  });
});
