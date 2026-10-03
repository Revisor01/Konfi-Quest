// Hat das angemeldete Konto Super-Admin-Recht?
//
// Zwei Formen (docs/planung/web-version.md, Entscheidungen 10 bis 15):
//   - eine Gemeindeleitung mit dem Merkmal is_super_admin (Simons Konto) --
//     role_name ist dort 'org_admin', das Merkmal entscheidet;
//   - ein Support-Konto ohne Gemeinde mit der Systemrolle 'super_admin'
//     (Migration 190), das Merkmal ist dort ebenfalls gesetzt.
// Dieselbe Regel wie im Server (utils/roleHierarchy.js, istSuperAdminKonto)
// und im Formular "Gemeinde" (OrganizationManagementModal). Die Oberflaeche
// blendet damit nur aus -- die Rechte haelt der Server (requireSuperAdmin).

export interface KontoMitRecht {
  is_super_admin?: boolean;
  role_name?: string;
}

export const istSuperAdmin = (konto: KontoMitRecht | null | undefined): boolean =>
  konto?.is_super_admin === true || konto?.role_name === 'super_admin';
