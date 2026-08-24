// Push-Tap-Navigation (Multi-Org): Beim Antippen eines Pushes aus einer
// anderen Organisation muss die App ERST in die Organisation des Inhalts
// wechseln und dann mit dem User-Typ der ZIEL-Org navigieren. Fehlt die
// organization_id (alte Pushes) oder schlägt der Wechsel fehl, bleibt das
// alte Verhalten (direkt navigieren) erhalten.
import { describe, it, expect, vi } from 'vitest';
import { resolveOrgForPush, buildPushTargetUrl, PushUserType } from '../../utils/pushNavigation';

const deps = (overrides: Partial<Parameters<typeof resolveOrgForPush>[2]> = {}) => ({
  getActiveOrgId: () => null as number | null,
  getUserOrgId: () => 1 as number | null | undefined,
  switchOrg: vi.fn().mockResolvedValue({ ok: true, type: 'admin' as PushUserType }),
  ...overrides,
});

describe('resolveOrgForPush', () => {
  it('Mismatch: wechselt in die Org des Pushes und liefert den Typ der Ziel-Org', async () => {
    const d = deps({ switchOrg: vi.fn().mockResolvedValue({ ok: true, type: 'teamer' }) });
    const typ = await resolveOrgForPush({ type: 'chat', organization_id: '2' }, 'admin', d);
    expect(d.switchOrg).toHaveBeenCalledTimes(1);
    expect(d.switchOrg).toHaveBeenCalledWith(2);
    expect(typ).toBe('teamer');
  });

  it('Match: kein Wechsel — Vergleich per String (FCM-String vs. Client-Number)', async () => {
    const d = deps({ getUserOrgId: () => 2 });
    const typ = await resolveOrgForPush({ type: 'chat', organization_id: '2' }, 'admin', d);
    expect(d.switchOrg).not.toHaveBeenCalled();
    expect(typ).toBe('admin');
  });

  it('aktive Org hat Vorrang vor der Primär-Org des Users', async () => {
    // Aktiv auf Org 2 geschaltet (Primär-Org 1), Push aus Org 2 -> kein Wechsel
    const d = deps({ getActiveOrgId: () => 2, getUserOrgId: () => 1 });
    const typ = await resolveOrgForPush({ organization_id: '2' }, 'admin', d);
    expect(d.switchOrg).not.toHaveBeenCalled();
    expect(typ).toBe('admin');
  });

  it('fehlende organization_id: kein Wechsel (Altverhalten)', async () => {
    const d = deps();
    expect(await resolveOrgForPush({ type: 'chat' }, 'konfi', d)).toBe('konfi');
    expect(await resolveOrgForPush({ type: 'chat', organization_id: '' }, 'konfi', d)).toBe('konfi');
    expect(await resolveOrgForPush(undefined, 'konfi', d)).toBe('konfi');
    expect(d.switchOrg).not.toHaveBeenCalled();
  });

  it('ungültige organization_id: kein Wechsel', async () => {
    const d = deps();
    expect(await resolveOrgForPush({ organization_id: 'abc' }, 'admin', d)).toBe('admin');
    expect(await resolveOrgForPush({ organization_id: '0' }, 'admin', d)).toBe('admin');
    expect(d.switchOrg).not.toHaveBeenCalled();
  });

  it('unbekannte aktuelle Org (beide Getter null): kein Wechsel', async () => {
    const d = deps({ getActiveOrgId: () => null, getUserOrgId: () => null });
    expect(await resolveOrgForPush({ organization_id: '2' }, 'admin', d)).toBe('admin');
    expect(d.switchOrg).not.toHaveBeenCalled();
  });

  it('fehlgeschlagener Wechsel (ok: false): alter Typ, kein Absturz', async () => {
    const d = deps({ switchOrg: vi.fn().mockResolvedValue({ ok: false }) });
    expect(await resolveOrgForPush({ organization_id: '2' }, 'admin', d)).toBe('admin');
    expect(d.switchOrg).toHaveBeenCalledWith(2);
  });

  it('werfender Wechsel (offline): alter Typ, kein Absturz', async () => {
    const d = deps({ switchOrg: vi.fn().mockRejectedValue(new Error('offline')) });
    expect(await resolveOrgForPush({ organization_id: '2' }, 'admin', d)).toBe('admin');
  });

  it('Wechsel ohne Typ in der Antwort: alter Typ bleibt', async () => {
    const d = deps({ switchOrg: vi.fn().mockResolvedValue({ ok: true }) });
    expect(await resolveOrgForPush({ organization_id: '2' }, 'teamer', d)).toBe('teamer');
  });
});

describe('buildPushTargetUrl', () => {
  it('chat mit roomId: direkt in den Raum, Präfix nach userType', () => {
    expect(buildPushTargetUrl('chat', { roomId: '5' }, 'admin')).toBe('/admin/chat/room/5');
    expect(buildPushTargetUrl('chat', { roomId: '5' }, 'teamer')).toBe('/teamer/chat/room/5');
    expect(buildPushTargetUrl('chat', { roomId: '5' }, 'konfi')).toBe('/konfi/chat/room/5');
  });

  it('chat ohne roomId: Chat-Übersicht', () => {
    expect(buildPushTargetUrl('chat', {}, 'admin')).toBe('/admin/chat');
  });

  it('new_activity_request: Requests-Seite je Rolle', () => {
    expect(buildPushTargetUrl('new_activity_request', {}, 'admin')).toBe('/admin/requests');
    expect(buildPushTargetUrl('new_activity_request', {}, 'teamer')).toBe('/teamer/dashboard');
    expect(buildPushTargetUrl('activity_request_status', {}, 'konfi')).toBe('/konfi/requests');
  });

  it('new_event: Konfi mit event_id direkt ins Detail, sonst Events-Liste', () => {
    expect(buildPushTargetUrl('new_event', { event_id: '7' }, 'konfi')).toBe('/konfi/events/7');
    expect(buildPushTargetUrl('new_event', { event_id: '7' }, 'admin')).toBe('/admin/events');
    expect(buildPushTargetUrl('new_event', {}, 'konfi')).toBe('/konfi/events');
  });

  it('new_konfi_registration: Admin zu den Konfis', () => {
    expect(buildPushTargetUrl('new_konfi_registration', {}, 'admin')).toBe('/admin/konfis');
  });

  it('wrapped: Dashboard', () => {
    expect(buildPushTargetUrl('wrapped', {}, 'konfi')).toBe('/konfi/dashboard');
    expect(buildPushTargetUrl('wrapped', {}, 'teamer')).toBe('/teamer/dashboard');
  });

  it('unbekannter Typ: leerer String (keine Navigation)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(buildPushTargetUrl('certificate', {}, 'teamer')).toBe('');
    expect(buildPushTargetUrl(undefined, {}, 'konfi')).toBe('');
    warnSpy.mockRestore();
  });
});

describe('Zusammenspiel: Org-Wechsel vor der Navigation (Handler-Semantik)', () => {
  it('Mismatch: erst Wechsel, dann Route mit dem Typ der ZIEL-Org', async () => {
    // Leitung in Org 1 aktiv, Chat-Push aus Org 2, dort ist sie Teamerin.
    const d = deps({
      getActiveOrgId: () => null,
      getUserOrgId: () => 1,
      switchOrg: vi.fn().mockResolvedValue({ ok: true, type: 'teamer' }),
    });
    const data = { type: 'chat', roomId: '9', organization_id: '2' };
    const typ = await resolveOrgForPush(data, 'admin', d);
    const url = buildPushTargetUrl('chat', data, typ);
    expect(d.switchOrg).toHaveBeenCalledWith(2);
    expect(url).toBe('/teamer/chat/room/9');
  });

  it('Match: direkte Route ohne Wechsel', async () => {
    const d = deps({ getActiveOrgId: () => 2 });
    const data = { type: 'chat', roomId: '9', organization_id: '2' };
    const typ = await resolveOrgForPush(data, 'admin', d);
    expect(d.switchOrg).not.toHaveBeenCalled();
    expect(buildPushTargetUrl('chat', data, typ)).toBe('/admin/chat/room/9');
  });

  it('fehlende org_id: Altverhalten (direkte Route in der aktuellen Org)', async () => {
    const d = deps();
    const data = { type: 'chat', roomId: '9' };
    const typ = await resolveOrgForPush(data, 'admin', d);
    expect(d.switchOrg).not.toHaveBeenCalled();
    expect(buildPushTargetUrl('chat', data, typ)).toBe('/admin/chat/room/9');
  });
});
