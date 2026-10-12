// Die Attrappe vorgaengeServer.ts antwortet wie der echte Server, wo die
// Detailseiten davon abhängen (docs/planung/support-detailseiten.md,
// Abweichung 5): Empfänger mit den Schlüsseln und der Reihenfolge des Servers,
// status_seit, erstellt_von_name, die Gemeinde mit Wunschlizenz, eine Mail aus
// einem Vorgang wandert beim Einsortieren allein, und die Lizenz-Routen
// GET/PUT /organizations/:id und PATCH …/limit. Der PUT leert, was im Körper
// fehlt -- genau deshalb schickt „Lizenz ändern" den vollen Körper
// (utils/lizenzAendern.ts, lizenzPutKoerper). Seit 12.10.2026 (Paket 6) die
// Antwort im Vorgang mit `status` und `antwort_auf` und ihre Form
// `{ nachricht, vorgang }` -- und ein älterer Server, der beides übergeht.
import { describe, it, expect, vi } from 'vitest';
import { mail, vorgang, vorgaengeServer } from './vorgaengeServer';
import { antwortVorgangLesen, vorgangDetailLesen } from '../../../utils/supportVorgaenge';
import { gemeindeStammLesen, lizenzPutKoerper } from '../../../utils/lizenzAendern';

const api = () => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() });

describe('Attrappe wie der Server', () => {
  it('das Detail: Empfänger (absender, kontakt, leitung), status_seit, erstellt_von_name, Gemeinde mit Wunschlizenz', async () => {
    const a = api();
    const server = vorgaengeServer({
      gemeinden: { 7: { wunsch_lizenz: 'standard', max_konfis: 50 } },
      vorgaenge: [vorgang(1, { organization_id: 7, kontakt_email: 'Sekretariat@example.org', kontakt_name: 'Sekretariat', erstellt_von_name: 'Test Super-Admin' })],
      mails: [mail(11, 1, { von_adresse: 'anna@example.org', von_name: 'Anna', gesendet_am: '2026-10-03T08:00:00Z' }), mail(12, 1, { gesendet_am: '2026-10-03T08:30:00Z' })],
    });
    server.installieren(a);
    const d = vorgangDetailLesen((await a.get('/support/vorgaenge/1')).data);
    expect(d?.empfaenger).toEqual([
      { adresse: 'lena.probe@example.org', name: 'Pastorin Lena Probe', herkunft: 'absender' },
      { adresse: 'anna@example.org', name: 'Anna', herkunft: 'absender' },
      { adresse: 'sekretariat@example.org', name: 'Sekretariat', herkunft: 'kontakt' },
    ]);
    expect(d).toMatchObject({ status_seit: '2026-10-03T07:00:00Z', erstellt_von_name: 'Test Super-Admin' });
    expect(d?.gemeinde).toMatchObject({ wunsch_lizenz: 'standard', max_konfis: 50, kirchenkreis_id: 11, intern: false });
  });

  it('eine Antwort trägt das Konto (verfasst_von); ein Statuswechsel setzt status_seit neu', async () => {
    const a = api();
    const server = vorgaengeServer({ vorgaenge: [vorgang(1, { organization_id: 7 })] });
    server.installieren(a);
    await a.post('/support/vorgaenge/1/antworten', { text: 'Hallo', betreff: 'Re: X', an: 'lena.probe@example.org' });
    await a.patch('/support/vorgaenge/1', { status: 'wartet' });
    const d = vorgangDetailLesen((await a.get('/support/vorgaenge/1')).data);
    expect(d?.verlauf[0]).toMatchObject({ richtung: 'aus', verfasst_von: 9, verfasst_von_name: 'Test Super-Admin', an_adressen: ['lena.probe@example.org'] });
    expect(d).toMatchObject({ status: 'wartet', status_seit: server.stand.jetzt });
  });

  it('die Antwort im Vorgang (seit 12.10.2026): `status` in derselben Transaktion, Antwort `{ nachricht, vorgang }` mit dem Stand danach', async () => {
    const a = api();
    const server = vorgaengeServer({ vorgaenge: [vorgang(1, { organization_id: 7, status: 'neu' })], mails: [mail(11, 1)] });
    server.installieren(a);
    const antwort = (await a.post('/support/vorgaenge/1/antworten', { text: 'Hallo', betreff: 'Re: X', an: 'lena.probe@example.org', status: 'erledigt' })).data;
    expect(antwortVorgangLesen(antwort)).toEqual({ id: 1, status: 'erledigt', status_seit: server.stand.jetzt, archiviert_am: server.stand.jetzt });
    expect(antwort).toMatchObject({ nachricht: { richtung: 'aus', vorgang_id: 1, text: 'Hallo', verfasst_von: 9 } });
    expect(server.aufrufe('patch')).toEqual([]);
    // Ohne `status` wie bisher: „neu" geht auf „in Arbeit" -- und `vorgang` ist trotzdem dabei.
    const zweiter = vorgaengeServer({ vorgaenge: [vorgang(2, { status: 'neu', kontakt_email: 'anna@example.org' })] });
    zweiter.installieren(a);
    expect(antwortVorgangLesen((await a.post('/support/vorgaenge/2/antworten', { text: 'Hallo' })).data)).toMatchObject({ id: 2, status: 'in_arbeit', archiviert_am: null });
  });

  it('die Antwort im Vorgang prüft `status` und `antwort_auf` vor dem Versand: 400, nichts geht hinaus', async () => {
    const a = api();
    const server = vorgaengeServer({ vorgaenge: [vorgang(1, { organization_id: 7 }), vorgang(2)], mails: [mail(11, 1), mail(21, 2), mail(31, null)] });
    server.installieren(a);
    await expect(a.post('/support/vorgaenge/1/antworten', { text: 'Hallo', status: 'archiviert' })).rejects.toMatchObject({ response: { status: 400, data: { error: 'Validierungsfehler' } } });
    for (const fremd of [21, 31, 999]) {
      await expect(a.post('/support/vorgaenge/1/antworten', { text: 'Hallo', antwort_auf: fremd }))
        .rejects.toMatchObject({ response: { status: 400, data: { error: 'Die beantwortete Mail gehört nicht zu diesem Vorgang' } } });
    }
    expect(server.stand.mails.filter((m) => m.richtung === 'aus')).toEqual([]);
    expect(server.stand.vorgaenge[0].status).toBe('neu');
  });

  it('`antwort_auf` ist der Bezug (In-Reply-To, References); ohne die jüngste Mail gleich welcher Richtung', async () => {
    const a = api();
    const server = vorgaengeServer({
      vorgaenge: [vorgang(1, { organization_id: 7 })],
      mails: [
        mail(11, 1, { message_id: '<m11@ex>', gesendet_am: '2026-10-03T07:00:00Z' }),
        mail(12, 1, { richtung: 'aus', message_id: '<m12@kq>', in_reply_to: '<m11@ex>', referenzen: ['<m11@ex>'], gesendet_am: '2026-10-03T08:00:00Z' }),
      ],
    });
    server.installieren(a);
    const mitBezug = (await a.post('/support/vorgaenge/1/antworten', { text: 'A', antwort_auf: 11 })).data as { nachricht: Record<string, unknown> };
    expect(mitBezug.nachricht).toMatchObject({ in_reply_to: '<m11@ex>', referenzen: ['<m11@ex>'] });
    const ohne = (await a.post('/support/vorgaenge/1/antworten', { text: 'B' })).data as { nachricht: Record<string, unknown> };
    // Die jüngste ist jetzt die eben gesendete A (der Server vergibt jeder Antwort eine Message-ID).
    expect(ohne.nachricht).toMatchObject({ in_reply_to: mitBezug.nachricht.message_id });
  });

  it('ein älterer Server (alterServer): übergeht `status` und `antwort_auf`, antwortet nur `{ nachricht }`', async () => {
    const a = api();
    const server = vorgaengeServer({ alterServer: true, vorgaenge: [vorgang(1, { organization_id: 7, status: 'neu' })], mails: [mail(11, 1)] });
    server.installieren(a);
    const antwort = (await a.post('/support/vorgaenge/1/antworten', { text: 'Hallo', status: 'wartet', antwort_auf: 999 })).data;
    expect(Object.keys(antwort as object)).toEqual(['nachricht']);
    expect(antwortVorgangLesen(antwort)).toBeNull();
    expect(server.stand.vorgaenge[0].status).toBe('in_arbeit');
  });

  it('die Antwort im Posteingang: `{ nachricht }` an den Absender der Mail aus der Adresse', async () => {
    const a = api();
    const server = vorgaengeServer({ mails: [mail(31, null, { von_adresse: 'anna@example.org' })] });
    server.installieren(a);
    const antwort = (await a.post('/support/mail/nachrichten/31/antworten', { text: 'Hallo', betreff: 'Re: X' })).data;
    expect(antwort).toMatchObject({ nachricht: { richtung: 'aus', an_adressen: ['anna@example.org'], text: 'Hallo' } });
    expect(Object.keys(antwort as object)).toEqual(['nachricht']);
  });

  it('Einsortieren: eine Mail aus einem Vorgang geht allein; aus dem Posteingang der Faden', async () => {
    const a = api();
    const server = vorgaengeServer({
      vorgaenge: [vorgang(1), vorgang(2)],
      mails: [mail(11, 1), mail(12, 1), mail(31, null, { faden: 'f', archiviert_am: '2026-10-02T00:00:00Z' }), mail(32, null, { faden: 'f' })],
    });
    server.installieren(a);
    expect((await a.post('/support/mail/nachrichten/12/einsortieren', { vorgang_id: 2 })).data).toEqual({ anzahl: 1, vorgang_id: 2, ids: [12] });
    expect(server.stand.mails.find((m) => m.id === 11)?.vorgang_id).toBe(1);
    expect((await a.post('/support/mail/nachrichten/31/einsortieren', { vorgang_id: 2 })).data).toEqual({ anzahl: 2, vorgang_id: 2, ids: [31, 32] });
    expect(server.stand.mails.find((m) => m.id === 31)?.archiviert_am).toBeNull();
  });

  it('Lizenz-Routen: PATCH …/limit, GET und PUT /organizations/:id -- der PUT leert, was im Körper fehlt', async () => {
    const a = api();
    const server = vorgaengeServer({ gemeinden: { 7: { contact_email: 'kontakt@example.org', description: 'Am Deich' } } });
    server.installieren(a);
    await a.patch('/organizations/7/limit', { max_konfis: 50 });
    expect(server.stand.gemeinden[7].max_konfis).toBe(50);
    await expect(a.patch('/organizations/7/limit', { max_konfis: -1 })).rejects.toMatchObject({ response: { status: 400 } });

    const stamm = gemeindeStammLesen((await a.get('/organizations/7')).data)!;
    await a.put('/organizations/7', lizenzPutKoerper(stamm, { trial_ends_at: '2027-10-11T10:00:00.000Z', is_trial: false }));
    expect(server.stand.gemeinden[7]).toMatchObject({ contact_email: 'kontakt@example.org', description: 'Am Deich', trial_ends_at: '2027-10-11T10:00:00.000Z', is_trial: false, kirchenkreis_id: 11 });

    // Ein Teilkörper (nur die Laufzeit und die Pflichtfelder) leert die Stammdaten -- wie der Server.
    await a.put('/organizations/7', { name: stamm.name, slug: stamm.slug, display_name: stamm.display_name, trial_ends_at: null, is_trial: false });
    expect(server.stand.gemeinden[7]).toMatchObject({ contact_email: null, description: null });
    await expect(a.put('/organizations/7', { trial_ends_at: null })).rejects.toMatchObject({ response: { status: 400 } });
    expect(server.aufrufe('put')).toHaveLength(3);
  });
});
