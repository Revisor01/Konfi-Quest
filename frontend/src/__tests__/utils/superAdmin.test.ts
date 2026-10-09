// utils/superAdmin: Super-Admin-Recht hat eine Gemeindeleitung mit dem
// Merkmal oder ein Support-Konto mit der Systemrolle -- sonst niemand.
import { describe, it, expect } from 'vitest';
import { istSuperAdmin } from '../../utils/superAdmin';

describe('istSuperAdmin', () => {
  it('ERLAUBT: Gemeindeleitung mit Merkmal is_super_admin', () => {
    expect(istSuperAdmin({ role_name: 'org_admin', is_super_admin: true })).toBe(true);
  });

  it('ERLAUBT: Support-Konto mit Systemrolle super_admin', () => {
    expect(istSuperAdmin({ role_name: 'super_admin' })).toBe(true);
  });

  it('VERBOTEN: Gemeindeleitung ohne Merkmal, Leitung, Team, Konfi', () => {
    expect(istSuperAdmin({ role_name: 'org_admin' })).toBe(false);
    expect(istSuperAdmin({ role_name: 'org_admin', is_super_admin: false })).toBe(false);
    expect(istSuperAdmin({ role_name: 'admin' })).toBe(false);
    expect(istSuperAdmin({ role_name: 'teamer' })).toBe(false);
    expect(istSuperAdmin({ role_name: 'konfi' })).toBe(false);
  });

  it('VERBOTEN: nur ein wahrer Wert zaehlt, kein "true" als Text', () => {
    expect(istSuperAdmin({ is_super_admin: 'true' as unknown as boolean })).toBe(false);
    expect(istSuperAdmin({ is_super_admin: 1 as unknown as boolean })).toBe(false);
  });

  it('ohne Konto: kein Recht', () => {
    expect(istSuperAdmin(null)).toBe(false);
    expect(istSuperAdmin(undefined)).toBe(false);
  });
});
