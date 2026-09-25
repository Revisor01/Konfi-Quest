// jahrgangsPassung.ts — Passt eine Person zum Jahrgang eines Termins?
//
// Simons Ansage (25.09.2026): "Das muss fuer die Konfi-Hinzufuegen-Liste
// gelten, und das muss fuer die Team-Hinzufuegen-Liste gelten. Es muss
// geprueft werden, ob dieser Termin zu den zugewiesenen Jahrgaengen passt.
// Denkt daran: Ein Termin kann auch mehrere Jahrgaenge haben."
//
// Dieselbe Regel wie im Backend (utils/jahrgangsZugriff.js, gehoertZumTermin),
// das den Eintrag sonst mit 403 abweist. Hier, damit die Person in der
// Teilnehmerauswahl (ParticipantManagementModal) gar nicht erst zur Auswahl
// steht:
//   - 'Nur Team'-Termin: alle
//   - Termin ohne Jahrgang: alle
//   - org_admin / super_admin (Rolle oder Flag): immer
//   - Konfi: ihr EINER Jahrgang (jahrgang_id) muss einer des Termins sein
//   - Team und Leitung (admin): EIN gemeinsamer Jahrgang aus jahrgang_ids genuegt
//
// Zwei Datenwege, deshalb zwei Felder: Konfis tragen jahrgang_id
// (konfi_profiles), Team und Leitung jahrgang_ids (user_jahrgang_assignments;
// /admin/konfis/teamer und /admin/konfis/leitung liefern sie seit dem
// 25.09.2026).

export interface PersonMitJahrgang {
  role_name?: string;
  jahrgang_id?: number;
  jahrgang_ids?: number[];
  is_super_admin?: boolean;
}

export interface TerminMitJahrgang {
  teamer_only?: boolean;
}

export function passtZumTermin(
  person: PersonMitJahrgang,
  termin: TerminMitJahrgang | null,
  terminJahrgangIds: number[]
): boolean {
  if (termin?.teamer_only) return true;
  if (terminJahrgangIds.length === 0) return true;
  if (person.role_name === 'org_admin' || person.role_name === 'super_admin' || person.is_super_admin) return true;
  if (person.role_name === 'konfi') {
    return person.jahrgang_id != null && terminJahrgangIds.includes(person.jahrgang_id);
  }
  return (person.jahrgang_ids || []).some(id => terminJahrgangIds.includes(id));
}
