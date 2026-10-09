/**
 * Die Vorschläge S2–S17 aus docs/messung/umami.md (Simon, 09.10.2026: „Go").
 *
 * Geprüft wird:
 *   1. Name und Merkmale kommen EXAKT so an (keine weiteren Felder), mit Rolle.
 *   2. Die Positivliste verwirft alles andere — Suchbegriff, Kennung, Titel,
 *      Rohwerte des Servers.
 *   3. Die Listen, die dem Server folgen (Mitteilungsarten, Push-Gruppen),
 *      stimmen mit dem Backend überein.
 *   4. Offline Erledigtes wird beim Nachsenden über eine feste Zuordnung
 *      gemeldet, nie über die Beschriftung (S14).
 *   5. Die Hooks für „bis zum Ende" (S7, S16) und die Suche (S15).
 *   6. Die Aufrufstellen, die nicht an einer Server-Antwort hängen (die
 *      übrigen prüft nutzungstiefeAufrufstellen.test.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { useBisEndeMessung } from '../../hooks/useBisEndeMessung';

type Analytics = typeof import('../../services/analytics');

const WURZEL = resolve(__dirname, '../../..');
const lies = (p: string) => readFileSync(resolve(WURZEL, p), 'utf8');
const require_ = createRequire(import.meta.url);

const ladeMitProd = async (): Promise<Analytics> => {
  vi.resetModules();
  vi.stubEnv('PROD', true);
  return await import('../../services/analytics');
};

const nutzlast = (aufruf: unknown[]): Record<string, unknown> => {
  const init = aufruf[1] as { body: string };
  return (JSON.parse(init.body) as { payload: Record<string, unknown> }).payload;
};
const rumpfText = (aufruf: unknown[]): string => (aufruf[1] as { body: string }).body;

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Name und Merkmale kommen exakt so an', () => {
  const FAELLE: Array<[string, Record<string, string>, string]> = [
    ['badge-angelegt', { zielgruppe: 'teamer' }, 'admin'],
    ['challenge-angelegt', { sichtbarkeit: 'konfi-entscheidet', freigabe: 'true' }, 'admin'],
    ['event-abgemeldet', { pflicht: 'true' }, 'konfi'],
    ['event-abgemeldet', { pflicht: 'false' }, 'teamer'],
    ['wrapped-angesehen', { art: 'team', bis_ende: 'false' }, 'teamer'],
    ['neuigkeiten-angesehen', { bis_ende: 'true' }, 'konfi'],
    ['postfach-angesehen', {}, 'konfi'],
    ['mitteilung-angetippt', { art: 'event-cancelled' }, 'konfi'],
    ['push-gruppe-umgeschaltet', { gruppe: 'konfi-chat', an: 'false' }, 'teamer'],
    ['push-gruppe-umgeschaltet', { gruppe: 'alle', an: 'true' }, 'konfi'],
    ['push-erlaubnis', { ergebnis: 'abgelehnt' }, 'konfi'],
    ['einladung-gesendet', { rolle_ziel: 'org-admin' }, 'admin'],
    ['einladung-beantwortet', { antwort: 'angenommen' }, 'teamer'],
    ['losung-bibel', { bibel: 'segond' }, 'konfi'],
    ['suche-genutzt', { bereich: 'material' }, 'teamer'],
    ['badge-angelegt', { zielgruppe: 'konfi', nachgesendet: 'true' }, 'admin'],
  ];

  it.each(FAELLE)('%s mit %o (Rolle %s)', async (name, merkmale, rolle) => {
    const a = await ladeMitProd();
    a.setAnalyticsRole(rolle);
    a.trackHandlung(name as Parameters<Analytics['trackHandlung']>[0], merkmale);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const p = nutzlast(fetchMock.mock.calls[0]);
    expect(p.name).toBe(name);
    expect(p.data).toEqual({ ...merkmale, rolle });
    expect(p.url).toBe('/app');
  });
});

describe('Die Positivliste verwirft alles andere', () => {
  it('kein Suchbegriff, keine Kennung, kein Titel, keine Rohwerte des Servers', async () => {
    const a = await ladeMitProd();
    a.trackHandlung('suche-genutzt', { bereich: 'material', suchbegriff: 'Emilia Petersen' });
    a.trackHandlung('einladung-gesendet', { rolle_ziel: 'org_admin', kennung: 'emilia.petersen' });
    a.trackHandlung('mitteilung-angetippt', { art: 'event_cancelled', title: 'Konfifreizeit Hennstedt abgesagt' });
    a.trackHandlung('challenge-angelegt', { sichtbarkeit: 'konfi_choice', title: 'Gottesbilder', freigabe: 'vielleicht' });
    a.trackHandlung('push-gruppe-umgeschaltet', { gruppe: 'konfi_chat', an: 'ja' });
    a.trackHandlung('losung-bibel', { bibel: 'LUT' });

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(nutzlast(fetchMock.mock.calls[0]).data).toEqual({ bereich: 'material' });
    // Rohwerte mit Unterstrich: fallen heraus, das Ereignis zählt trotzdem.
    for (let i = 1; i < 6; i++) expect(nutzlast(fetchMock.mock.calls[i]).data).toEqual({});
    const alles = fetchMock.mock.calls.map(rumpfText).join('\n');
    for (const verboten of ['Emilia', 'emilia.petersen', 'Hennstedt', 'Gottesbilder', 'LUT', 'vielleicht']) {
      expect(alles, `${verboten} steht im Rumpf`).not.toContain(verboten);
    }
  });

  it('eine unbekannte Handlung geht gar nicht raus', async () => {
    const a = await ladeMitProd();
    a.trackHandlung('postfach-geoeffnet' as Parameters<Analytics['trackHandlung']>[0], {});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Hilfen für die Messwerte', () => {
  it('Losungs-Kürzel -> Messwert, Unbekanntes fällt heraus', async () => {
    const a = await ladeMitProd();
    expect(['LUT', 'ELB', 'GNB', 'BIGS', 'NIV', 'LSG'].map(a.losungBibelMesswert))
      .toEqual(['luther', 'elberfelder', 'gute-nachricht', 'bigs', 'niv', 'segond']);
    expect(a.losungBibelMesswert('RVR60')).toBeUndefined();
  });

  it('jedes Kürzel aus der Auswahl hat einen Messwert', () => {
    const modal = lies('src/components/shared/BibleTranslationModal.tsx');
    const kuerzel = [...modal.matchAll(/code: '([A-Z0-9]+)'/g)].map((m) => m[1]);
    expect(kuerzel).toEqual(['LUT', 'ELB', 'GNB', 'BIGS', 'NIV', 'LSG']);
  });

  it('Sichtbarkeit der Challenge: alle drei Werte der App', async () => {
    const a = await ladeMitProd();
    expect(a.CHALLENGE_SICHTBARKEIT_MESSWERT).toEqual({ public: 'offen', konfi_choice: 'konfi-entscheidet', private: 'privat' });
    const typen = lies('src/types/challenges.ts');
    expect(typen).toContain("export type ChallengeVisibility = 'public' | 'konfi_choice' | 'private';");
  });

  it('Push-Erlaubnis: erteilt, abgelehnt, sonst nichts', async () => {
    const a = await ladeMitProd();
    a.trackPushErlaubnis('granted');
    a.trackPushErlaubnis('denied');
    a.trackPushErlaubnis('prompt');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(nutzlast(fetchMock.mock.calls[0]).data).toEqual({ ergebnis: 'erteilt' });
    expect(nutzlast(fetchMock.mock.calls[1]).data).toEqual({ ergebnis: 'abgelehnt' });
  });
});

describe('S11: Dunkelmodus am Sitzungsbeginn', () => {
  const mitSchema = (dunkel: boolean) => {
    vi.stubGlobal('matchMedia', vi.fn((q: string) => ({ matches: dunkel && q === '(prefers-color-scheme: dark)' })));
  };

  it.each([true, false])('dunkel: %s', async (dunkel) => {
    mitSchema(dunkel);
    const a = await ladeMitProd();
    a.setAnalyticsRole('konfi');
    a.trackSitzungsstart();
    const p = nutzlast(fetchMock.mock.calls[0]);
    // Weiterhin ein Seitenaufruf: OHNE name.
    expect(p.name).toBeUndefined();
    expect(p.data).toEqual({ rolle: 'konfi', dunkel });
  });

  it('ohne matchMedia: false, kein Fehler', async () => {
    vi.stubGlobal('matchMedia', undefined);
    const a = await ladeMitProd();
    a.trackSitzungsstart();
    expect(nutzlast(fetchMock.mock.calls[0]).data).toEqual({ dunkel: false });
  });
});

describe('Listen, die dem Server folgen', () => {
  it('Mitteilungsarten = POSTFACH_ARTEN des Servers und die vier alten Arten', async () => {
    const a = await ladeMitProd();
    const { POSTFACH_ARTEN } = require_(resolve(WURZEL, '../backend/utils/postfachArten.js')) as { POSTFACH_ARTEN: Set<string> };
    const server = [...POSTFACH_ARTEN, 'badge_earned', 'new_activity_request', 'activity_request_submitted', 'activity_request_decision']
      .map((t) => t.replace(/_/g, '-'))
      .sort();
    expect([...a.MITTEILUNGS_ARTEN].sort()).toEqual(server);
  });

  it('Push-Gruppen = Gruppen des Servers und der Hauptschalter', async () => {
    const a = await ladeMitProd();
    const { GRUPPEN } = require_(resolve(WURZEL, '../backend/utils/pushGruppen.js')) as { GRUPPEN: Array<{ id: string }> };
    expect([...a.PUSH_GRUPPEN].sort()).toEqual([...GRUPPEN.map((g) => g.id.replace(/_/g, '-')), 'alle'].sort());
  });
});

describe('S14: offline Erledigtes beim Nachsenden', () => {
  const lade = async () => {
    await ladeMitProd();
    return await import('../../services/nachgesendetMessung');
  };

  it.each([
    [{ method: 'POST', url: '/admin/konfis/42/bonus-points', body: { type: 'gottesdienst', points: 3, description: 'Emilia: Kuchen' } }, 'punkte-vergeben', { weg: 'bonus', punkteart: 'gottesdienst', nachgesendet: 'true' }],
    [{ method: 'POST', url: '/admin/konfis/42/activities', body: { activity_id: 7, comment: 'Emilia' } }, 'punkte-vergeben', { weg: 'aktivitaet', nachgesendet: 'true' }],
    [{ method: 'PUT', url: '/admin/activities/requests/9', body: { status: 'rejected', admin_comment: 'Foto fehlt' } }, 'antrag-entschieden', { entscheidung: 'abgelehnt', nachgesendet: 'true' }],
    [{ method: 'POST', url: '/events/series', body: { name: 'Konfifreizeit' } }, 'termin-angelegt', { form: 'serie', nachgesendet: 'true' }],
    [{ method: 'POST', url: '/events', body: { name: 'Konfifreizeit' } }, 'termin-angelegt', { form: 'einzeln', nachgesendet: 'true' }],
    [{ method: 'POST', url: '/admin/badges', body: { name: 'Gottesdienstprofi', target_role: 'teamer' } }, 'badge-angelegt', { zielgruppe: 'teamer', nachgesendet: 'true' }],
    [{ method: 'POST', url: '/konfi/events/5/opt-out', body: { reason: 'krank' } }, 'event-abgemeldet', { pflicht: 'true', nachgesendet: 'true' }],
    [{ method: 'DELETE', url: '/konfi/events/5/register', body: { reason: 'krank' } }, 'event-abgemeldet', { pflicht: 'false', nachgesendet: 'true' }],
    [{ method: 'POST', url: '/teamer/events/5/zusage', body: { dabei: false, reason: 'krank' } }, 'event-abgemeldet', { nachgesendet: 'true' }],
    [{ method: 'PUT', url: '/teamer/bible-translation', body: { translation: 'GNB' } }, 'losung-bibel', { bibel: 'gute-nachricht', nachgesendet: 'true' }],
    [{ method: 'POST', url: '/material', body: { title: 'Gottesbilder' } }, 'material-bereitgestellt', { nachgesendet: 'true' }],
  ] as const)('%o -> %s', async (eintrag, name, daten) => {
    const m = await lade();
    m.nachgesendetMelden(eintrag as never);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const p = nutzlast(fetchMock.mock.calls[0]);
    expect(p.name).toBe(name);
    expect(p.data).toEqual(daten);
    for (const verboten of ['Emilia', 'Foto fehlt', 'Konfifreizeit', 'krank', 'Gottesbilder', '42']) {
      expect(rumpfText(fetchMock.mock.calls[0])).not.toContain(verboten);
    }
  });

  it('Ereignisse ausserhalb der Handlungen tragen nachgesendet als Wahrheitswert', async () => {
    const m = await lade();
    m.nachgesendetMelden({ method: 'POST', url: '/konfi/requests', body: { photo_filename: 'a.jpg', description: 'Emilia' } });
    m.nachgesendetMelden({ method: 'POST', url: '/teamer/events/5/zusage', body: { dabei: true } });
    expect(nutzlast(fetchMock.mock.calls[0])).toMatchObject({ name: 'aktivitaet-eingereicht', data: { mit_foto: true, nachgesendet: true } });
    expect(nutzlast(fetchMock.mock.calls[1])).toMatchObject({ name: 'event-angemeldet', data: { mit_zeitfenster: false, nachgesendet: true } });
  });

  it('Chat, stille Aufräumer und Bearbeiten melden nichts', async () => {
    const m = await lade();
    m.nachgesendetMelden({ method: 'POST', url: '/chat/rooms/3/messages', body: { content: 'Hallo' } });
    m.nachgesendetMelden({ method: 'POST', url: '/chat/polls/3/vote', body: {} });
    m.nachgesendetMelden({ method: 'PUT', url: '/admin/badges/4', body: { target_role: 'konfi' } });
    m.nachgesendetMelden({ method: 'PUT', url: '/events/4', body: {} });
    m.nachgesendetMelden({ method: 'POST', url: '/konfi/badges/mark-seen', body: {} });
    m.nachgesendetMelden({ method: 'PUT', url: '/settings', body: {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('die Warteschlange meldet nach dem Erfolg, in beiden Sendewegen, und nie im Fehlerzweig', () => {
    const quelle = lies('src/services/writeQueue.ts');
    const treffer = [...quelle.matchAll(/nachgesendetMelden\(item\);\n\s+result\.succeeded\.push\(item\);/g)];
    expect(treffer.length).toBe(2);
    expect(quelle.match(/nachgesendetMelden\(/g)?.length).toBe(2);
    expect(quelle).not.toMatch(/failed[\s\S]{0,80}nachgesendetMelden/);
  });

  it('zugeordnet wird nicht über die Beschriftung', () => {
    const quelle = lies('src/services/nachgesendetMessung.ts');
    expect(quelle).not.toMatch(/\.label\b|metadata/);
  });
});

describe('S7/S16: einmal beim Schliessen, mit bis_ende', () => {

  it('bis zum Ende geblättert', () => {
    const melden = vi.fn();
    const { rerender, unmount } = renderHook(({ i }) => useBisEndeMessung(melden, 4, i), { initialProps: { i: 0 } });
    rerender({ i: 1 });
    rerender({ i: 3 });
    rerender({ i: 2 }); // zurückgeblättert: das Ende war trotzdem erreicht
    expect(melden).not.toHaveBeenCalled();
    unmount();
    expect(melden).toHaveBeenCalledTimes(1);
    expect(melden).toHaveBeenCalledWith(true);
  });

  it('vorher geschlossen', () => {
    const melden = vi.fn();
    const { rerender, unmount } = renderHook(({ i }) => useBisEndeMessung(melden, 4, i), { initialProps: { i: 0 } });
    rerender({ i: 2 });
    unmount();
    expect(melden).toHaveBeenCalledWith(false);
  });

  it('ohne Folien (nichts geladen) wird nichts gemeldet', () => {
    const melden = vi.fn();
    const { unmount } = renderHook(() => useBisEndeMessung(melden, 0, 0));
    unmount();
    expect(melden).not.toHaveBeenCalled();
  });
});

describe('S15: Suche einmal je Öffnen, nie der Begriff', () => {
  it('meldet beim ersten Zeichen, nicht bei jedem weiteren, und den Bereich neu', async () => {
    await ladeMitProd();
    const { useSucheMessung } = await import('../../hooks/useSucheMessung');
    const { rerender } = renderHook(({ b, s }) => useSucheMessung(b, s), {
      initialProps: { b: 'konfis' as 'konfis' | 'team', s: '' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    rerender({ b: 'konfis', s: 'E' });
    rerender({ b: 'konfis', s: 'Emilia' });
    rerender({ b: 'konfis', s: '' });
    rerender({ b: 'konfis', s: 'Jonas' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    rerender({ b: 'team', s: 'Jonas' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(nutzlast(fetchMock.mock.calls[0]).data).toEqual({ bereich: 'konfis' });
    expect(nutzlast(fetchMock.mock.calls[1]).data).toEqual({ bereich: 'team' });
    const alles = fetchMock.mock.calls.map(rumpfText).join('\n');
    expect(alles).not.toContain('Emilia');
    expect(alles).not.toContain('Jonas');
  });

  it.each([
    ['src/components/admin/KonfisView.tsx', "useSucheMessung(viewMode === 'teamer' ? 'team' : 'konfis', searchTerm)"],
    ['src/components/admin/web/leitung/WebKonfis.tsx', "useSucheMessung(ansicht === 'team' ? 'team' : 'konfis', suche)"],
    ['src/components/teamer/pages/TeamerMaterialPage.tsx', "useSucheMessung('material', search)"],
    ['src/components/admin/pages/AdminMaterialPage.tsx', "useSucheMessung('material', search)"],
  ])('%s misst die Suche', (datei, aufruf) => {
    expect(lies(datei)).toContain(aufruf);
  });
});

describe('Aufrufstellen ohne Server-Antwort', () => {
  it('S2: Anträge der Leitung zählen als Bereich requests — beim Umschalten und beim Einstieg', () => {
    const q = lies('src/components/admin/pages/AdminEventsPage.tsx');
    expect(q).toContain("onIonChange={(e) => mitmachenAnsichtWechseln(e.detail.value as 'events' | 'antraege')}");
    expect(q).toContain("if (ansicht !== mainSegment) trackBereich(ansicht === 'antraege' ? 'requests' : 'events');");
    expect(q).toMatch(/if \(segment === 'antraege'\) \{\n\s+setMainSegment\('antraege'\);[\s\S]{0,120}trackBereich\('requests'\);/);
  });

  it('S3: das Team meldet event-angemeldet wie die Konfis, erst nach der Antwort', () => {
    for (const datei of ['src/components/teamer/pages/TeamerEventsPage.tsx', 'src/components/admin/views/EventDetailView.tsx']) {
      const q = lies(datei);
      const posAntwort = q.indexOf(datei.includes('teamer') ? 'const res = versand.ergebnis;' : 'const res = await api.post(`/teamer/events/${eventData.id}/zusage`, body)');
      const posMessung = q.indexOf("track('event-angemeldet', {");
      expect(posAntwort).toBeGreaterThan(-1);
      expect(posMessung).toBeGreaterThan(posAntwort);
      expect(q).toContain("status: res.data?.status === 'waitlist' ? 'warteliste' : 'bestaetigt'");
    }
    // Offline eingereiht: nicht im Zweig `eingereiht`.
    const team = lies('src/components/teamer/pages/TeamerEventsPage.tsx');
    expect(team.indexOf("track('event-angemeldet'")).toBeGreaterThan(team.indexOf("if (versand.weg === 'eingereiht')"));
  });

  it('S4: Pflicht-Abmeldung und freiwillige Abmeldung der Konfis — nicht offline', () => {
    const q = lies('src/components/konfi/views/EventDetailView.tsx');
    const optOut = q.indexOf("trackHandlung('event-abgemeldet', { pflicht: 'true' })");
    const abmelden = q.indexOf("trackHandlung('event-abgemeldet', { pflicht: 'false' })");
    expect(optOut).toBeGreaterThan(q.indexOf('/opt-out`'));
    expect(abmelden).toBeGreaterThan(q.indexOf('api.delete(`/konfi/events/${eventData.id}/register`'));
    // jeweils hinter dem return des Offline-Zweigs
    expect(optOut).toBeGreaterThan(q.indexOf("setSuccess('Abmeldung wird gesendet sobald du wieder online bist');"));
  });

  it('S5: nur neu angelegte Badges, nicht offline', () => {
    const q = lies('src/components/admin/modals/BadgeManagementModal.tsx');
    expect(q).toMatch(/\} else if \(!isEditMode\) \{[\s\S]{0,300}trackHandlung\('badge-angelegt', \{ zielgruppe: formData\.target_role \}\)/);
  });

  it('S6: nur das Anlegen, nicht das Bearbeiten', () => {
    const q = lies('src/components/admin/modals/ChallengeManageModal.tsx');
    const put = q.indexOf('await api.put(`/challenges/admin/${challenge.id}`, payload);');
    const post = q.indexOf("await api.post('/challenges/admin', payload);");
    const messung = q.indexOf("trackHandlung('challenge-angelegt'");
    expect(put).toBeGreaterThan(-1);
    expect(messung).toBeGreaterThan(post);
    expect(q.slice(put, post)).not.toContain('trackHandlung(');
    expect(q).toContain('sichtbarkeit: CHALLENGE_SICHTBARKEIT_MESSWERT[formData.visibility]');
  });

  it('S7: der Rückblick meldet sich selbst, mit Art und bis_ende', () => {
    const q = lies('src/components/wrapped/WrappedModal.tsx');
    expect(q).toContain("useBisEndeMessung(\n    (bisEnde) => trackHandlung('wrapped-angesehen', {");
    expect(q).toContain("art: wrappedType === 'teamer' ? 'team' : 'konfi'");
  });

  it('S8: Postfach geöffnet, Mitteilung angetippt — nur die Art', () => {
    const q = lies('src/components/common/PostfachModal.tsx');
    expect(q).toMatch(/setOffen\(true\);[\s\S]{0,200}trackHandlung\('postfach-angesehen'\);/);
    expect(q).toContain("trackHandlung('mitteilung-angetippt', { art: serverSchluesselMesswert(eintrag.type) });");
  });

  it('S9: Push-Erlaubnis nur dort, wo das System fragt', () => {
    const q = lies('src/contexts/AppContext.tsx');
    expect(q.match(/requestPermissions\(\);\n\s+trackPushErlaubnis\((permResult|result)\.receive\);/g)?.length).toBe(2);
    expect(q.match(/requestPermissions\(\)/g)?.length).toBe(2);
  });

  it('S9: Gruppe und Hauptschalter tragen ihre Kennung mit', () => {
    const q = lies('src/components/shared/PushAuswahl.tsx');
    expect(q).toContain('speichern({ stumm }, { gruppe: id, an });');
    expect(q).toContain("speichern({ push_enabled: an }, { gruppe: 'alle', an })");
  });

  it('S13: die Team-Startseite misst wie die der Konfis', () => {
    for (const datei of ['src/components/teamer/pages/TeamerDashboardPage.tsx', 'src/components/konfi/pages/KonfiDashboardPage.tsx']) {
      const q = lies(datei);
      expect(q).toContain('const handleScrollTiefe = useScrollTiefeMessung();');
      expect(q).toMatch(/scrollEvents=\{true\}[\s\S]{0,40}onIonScroll=\{handleScrollTiefe\}/);
    }
  });

  it('S16: nur die Änderungsanzeigen, nicht die Begrüssung beim ersten Start', () => {
    for (const rolle of ['konfi/modals/Konfi', 'teamer/modals/Teamer', 'admin/modals/Admin']) {
      expect(lies(`src/components/${rolle}Update230WalkthroughModal.tsx`)).toContain('beimSchliessen={trackNeuigkeitenAngesehen}');
      expect(lies(`src/components/${rolle}OnboardingModal.tsx`)).not.toContain('beimSchliessen');
    }
  });

  it('S17: nur die Lese-Ansicht, die Datei erst nach dem Laden', () => {
    const q = lies('src/components/admin/modals/MaterialFormModal.tsx');
    expect(q).toContain('if (!nurLesen || !material || angesehenGemeldet.current) return;');
    expect(q).toContain("if (geladen && nurLesen) trackHandlung('material-abgerufen', { inhalt: 'datei' });");
  });
});
