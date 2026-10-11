// Benutzer:in anlegen und bearbeiten -- als Logik ohne Darstellung (Simon,
// 11.10.2026: „Web braucht eigene kompaktere Modale überall"). Die App zeigt
// sie im Modal (modals/UserManagementModal.tsx), der Browser ab 992 px im
// Dialog (web/leitung/WebBenutzerDialog.tsx) -- Laden, Vorbelegung, Rechte,
// Prüfen und Speichern stehen nur hier, damit beide nicht auseinanderlaufen.
//
// Laden:     GET /roles, GET /admin/jahrgaenge; beim Bearbeiten GET /users/:id.
// Speichern: PUT /users/:id bzw. POST /users, danach
//            POST /users/:id/jahrgaenge { jahrgang_assignments }.
// Meldungen gehen wie bisher an setError (Meldung oben); nach dem Speichern
// ruft der Hook onSuccess -- die Seite schließt und lädt neu.

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useActionGuard } from '../../hooks/useActionGuard';
import { useZeitgeber } from '../../hooks/useZeitgeber';
import api from '../../services/api';
import type { AdminUser, FreigabeRechte, JahrgangsZuweisung } from '../../types/user';
import { fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';

export interface Rolle {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  is_system_role: boolean;
  is_active: boolean;
  user_count: number;
}

export interface JahrgangKurz {
  id: number;
  name: string;
}

// Die drei Rechte "darf freigeben" je Jahrgang (docs/planung/darf-freigeben.md,
// entschieden 09.10.2026). Reihenfolge = Reihenfolge der Schalter.
export const FREIGABE_RECHTE: { feld: keyof FreigabeRechte; text: string }[] = [
  { feld: 'darf_antraege_entscheiden', text: 'Anträge entscheiden' },
  { feld: 'darf_events_verbuchen', text: 'Events verbuchen' },
  { feld: 'darf_challenges_freigeben', text: 'Challenge-Beiträge freigeben' },
];
export type Rechte = Required<FreigabeRechte>;
// Vorgabe des Servers: alle drei an. Gilt fuer neu ausgewaehlte Jahrgaenge und
// fuer Zuweisungen, deren Feld fehlt (aelterer Server).
export const alleRechte = (z?: FreigabeRechte): Rechte => ({
  darf_antraege_entscheiden: z?.darf_antraege_entscheiden !== false,
  darf_events_verbuchen: z?.darf_events_verbuchen !== false,
  darf_challenges_freigeben: z?.darf_challenges_freigeben !== false,
});

// Welche Rechte an der Zuweisung einer Rolle einstellbar sind (dieselbe Regel
// wie backend/utils/freigabeRechte.js): Admins alle drei; Teamer:innen nur
// "Challenge-Beiträge freigeben" -- Anträge entscheiden und Verbuchen dürfen
// sie ohnehin nicht (Simon, 09.10.2026). Andere Rollen: keine.
export const rechteFuerRolle = (rolle?: string): (keyof FreigabeRechte)[] => {
  if (rolle === 'admin') return FREIGABE_RECHTE.map((r) => r.feld);
  if (rolle === 'teamer') return ['darf_challenges_freigeben'];
  return [];
};

// Nur die einstellbaren Felder -- die übrigen gehen nicht mit, der Server
// behält dann ihren bisherigen Wert.
const nurFelder = (rechte: Rechte, felder: (keyof FreigabeRechte)[]): FreigabeRechte =>
  Object.fromEntries(felder.map((f) => [f, rechte[f]])) as FreigabeRechte;

// Klare Beschreibung je Rolle (unabhaengig vom technischen DB-Text).
export const rollenBeschreibung = (roleName: string): string => {
  switch (roleName) {
    case 'org_admin': return 'Voller Zugriff auf Konfis, Aktivitäten, Badges und Events – über alle Jahrgänge. Verwaltet zusätzlich die Benutzer:innen und deren Jahrgangs-Zuordnung.';
    case 'admin': return 'Voller Zugriff auf Konfis, Aktivitäten, Badges und Events – nur für die zugewiesenen Jahrgänge.';
    case 'teamer': return 'Eigenes Dashboard mit eigenen Badges, Team-Material und Team-Chat. Kann sich zu Events anmelden, bei denen das Team gebraucht wird. Vergibt keine Punkte und genehmigt keine Aktivitäten.';
    default: return '';
  }
};

export interface BenutzerFormularDaten {
  username: string;
  email: string;
  display_name: string;
  /** Funktionsbeschreibung, z.B. "Pastor", "Diakonin". */
  role_title: string;
  password: string;
  role_id: number;
  is_active: boolean;
}

export interface BenutzerFormularOptionen {
  userId?: number | null;
  /**
   * Rolle fest vorgeben (Rollenname, z.B. 'teamer'). Dann entfaellt die
   * Rollenauswahl, und beim Anlegen bildet der Server den Benutzernamen.
   */
  festeRolle?: string;
  onSuccess: () => void;
}

export function useBenutzerFormular({ userId, festeRolle, onSuccess }: BenutzerFormularOptionen) {
  const { setError, user: currentUser, isOnline } = useApp();
  const { isSubmitting, guard } = useActionGuard();
  const [loading, setLoading] = useState(false);
  // Der erste Abruf ist durch (auch wenn er scheiterte). `loading` steht beim
  // ersten Zeichnen noch auf false; der Web-Dialog zeigt das Formular erst,
  // wenn dies gesetzt ist -- sonst verschwindet das Feld, in dem der Fokus steht.
  const [geladen, setGeladen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const initializedRef = useRef(false);
  const zeitgeber = useZeitgeber();

  // Form data
  const [formData, setFormData] = useState<BenutzerFormularDaten>({
    username: '',
    email: '',
    display_name: '',
    role_title: '', // Funktionsbeschreibung z.B. "Pastor", "Diakonin"
    password: '',
    role_id: 0,
    is_active: true
  });

  // isDirty nach Initialisierung bei jeder formData-Änderung setzen
  useEffect(() => {
    if (initializedRef.current) {
      setIsDirty(true);
    }
  }, [formData]);

  // Available data
  const [roles, setRoles] = useState<Rolle[]>([]);
  const [jahrgaenge, setJahrgaenge] = useState<JahrgangKurz[]>([]);
  const [user, setUser] = useState<AdminUser | null>(null);
  // Ueber eine Gemeinde-Einladung dabei (Audit 26.09.2026, Leitung BF-01):
  // Das Konto ist in einer anderen Gemeinde zuhause. Hier gibt es Rolle,
  // Funktionsbeschreibung, Sperre, Jahrgaenge und -- seit 08.10.2026 (Simon:
  // "Jede Gemeinde darf das Passwort setzen") -- das Passwort; Name,
  // Benutzername und E-Mail sind gesperrt, das Backend weist eine Aenderung
  // daran mit 400 ab.
  const nurRolle = !!userId && user?.mitgliedschaft === 'weitere';

  // Jahrgang assignments
  const [jahrgangAssignments, setJahrgangAssignments] = useState<{ [key: number]: boolean }>({});
  // Rechte je Jahrgang; fehlt ein Eintrag, gilt die Vorgabe (alle an).
  const [jahrgangRechte, setJahrgangRechte] = useState<{ [key: number]: Rechte }>({});

  const isEditMode = !!userId;

  // Die Rechte vergibt nur die Gemeindeleitung, an Zuweisungen der Rollen
  // Admin (alle drei) und Teamer:in (nur Challenge-Beiträge; die Gemeindeleitung hat
  // sie immer). Das Backend weist jeden anderen, der die Felder mitschickt,
  // mit 403 ab -- deshalb haengt auch das Mitschicken an dieser Bedingung.
  const gewaehlteRolle = roles.find((r) => r.id === formData.role_id)?.name
    ?? (user && user.role_id === formData.role_id ? user.role_name : undefined);
  const rechteFelder = currentUser?.role_name === 'org_admin' ? rechteFuerRolle(gewaehlteRolle) : [];
  const rechteVergeben = rechteFelder.length > 0;

  // Benutzername automatisch: beim ANLEGEN mit fester Rolle. Der Server bildet
  // ihn aus dem Anzeigenamen (Nutzerwunsch 23.08.2026) — ein Feld, das man
  // ohnehin nur bestaetigt, muss nicht abgefragt werden.
  const nameAutomatisch = !isEditMode && !!festeRolle;

  // Hierarchie-Check: Kann der aktuelle User diese Rolle zuweisen?
  // Spiegelt canManageRole im Backend (utils/roleHierarchy.js) — durchgesetzt
  // wird die Regel dort, hier geht es nur darum, keine Auswahl anzubieten, die
  // der Server danach mit 403 zurueckweist.
  const canAssignRole = (roleName: string) => {
    const userRole = currentUser?.role_name;

    // Konfis werden über separate KonfiModal erstellt || Super-Admin kann via backend nicht vergeben werden, gibt immer 403
    if (roleName === 'konfi' || roleName === 'super_admin') return false;

    // super_admin ist nie zuweisbar: canManageRole erlaubt diese Rolle
    // niemandem, auch super_admin nicht sich selbst.
    if (roleName === 'super_admin') return false;

    if (userRole === 'org_admin') {
      return roleName !== 'konfi';
    } else if (userRole === 'admin') {
      return roleName !== 'org_admin' && roleName !== 'admin' && roleName !== 'konfi';
    }
    return false;
  };

  useEffect(() => {
    const init = async () => {
      await loadInitialData();
      if (isEditMode) {
        await loadUser();
      }
      if (zeitgeber.aktiv()) setGeladen(true);
      zeitgeber.nach(100, () => { initializedRef.current = true; });
    };
    init();
  }, [userId]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [rolesResponse, jahrgaengeResponse] = await Promise.all([
        api.get('/roles'),
        api.get('/admin/jahrgaenge')
      ]);
      setRoles(rolesResponse.data);

      // Ein 'admin' darf Jahrgaenge nur innerhalb SEINER eigenen zuordnen
      // (Simons Regel 31.08.2026). Das Backend weist alles andere seit dem
      // 01.09.2026 mit 403 ab -- vorher bot der Dialog trotzdem alle
      // Jahrgaenge der Gemeinde an, und jede fremde Wahl lief in einen
      // Fehler. Das Angebot folgt jetzt der Berechtigung.
      //
      // org_admin und super_admin bleiben ausgenommen: Sie sehen ohnehin die
      // ganze Gemeinde, eine Einschraenkung waere dort falsch.
      // Ein Admin OHNE Zuweisung bekommt eine leere Liste. Das ist ein
      // gueltiger Fall (ein Admin, der nur mit den Teamer:innen spricht) --
      // und ehrlicher als eine Auswahl, aus der jede Wahl scheitert.
      // Hergeleitet wie in views/KonfiDetailView.tsx (eigeneJahrgangIds).
      const alleJahrgaenge = jahrgaengeResponse.data;
      if (currentUser?.role_name === 'admin') {
        const eigene = new Set(
          (currentUser.assigned_jahrgaenge || [])
            .filter((j) => j.can_view !== false)
            .map((j) => j.id)
        );
        setJahrgaenge(alleJahrgaenge.filter((j: JahrgangKurz) => eigene.has(j.id)));
      } else {
        setJahrgaenge(alleJahrgaenge);
      }

      // Feste Rolle direkt setzen — der Dialog zeigt dann keine Auswahl mehr,
      // das Feld muss aber trotzdem befuellt sein (isValid prüft role_id > 0).
      if (festeRolle && !isEditMode) {
        const rolle = rolesResponse.data.find((r: Rolle) => r.name === festeRolle);
        if (rolle) setFormData(prev => ({ ...prev, role_id: rolle.id }));
      }
    } catch (err) {
 console.error('Error loading initial data:', err);
      setError('Fehler beim Laden der Daten', { ort: 'benutzer-verwaltung-laden', fehler: err });
    } finally {
      if (!isEditMode) setLoading(false);
    }
  };

  const loadUser = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const response = await api.get(`/users/${userId}`);
      const userData = response.data;

      setUser(userData);
      setFormData({
        username: userData.username,
        email: userData.email || '',
        display_name: userData.display_name,
        role_title: userData.role_title || '',
        password: '',
        role_id: userData.role_id,
        is_active: userData.is_active
      });

      const assignments: { [key: number]: boolean } = {};
      const rechte: { [key: number]: Rechte } = {};
      if (userData.assigned_jahrgaenge) {
        userData.assigned_jahrgaenge.forEach((assignment: JahrgangsZuweisung) => {
          assignments[assignment.id] = !!(assignment.can_view || assignment.can_edit);
          rechte[assignment.id] = alleRechte(assignment);
        });
      }
      setJahrgangAssignments(assignments);
      setJahrgangRechte(rechte);
    } catch (err) {
      setError('Fehler beim Laden des Benutzers');
 console.error('Error loading user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Die App sperrt den Knopf offline; im Browser schickt auch Enter im
    // Feld ab -- dann eine Meldung statt stillem Nichtstun.
    if (offlineBlockiert(isOnline, setError)) return;
    if (!nameAutomatisch && !formData.username.trim()) {
      setError('Benutzername ist erforderlich');
      return;
    }
    if (!formData.display_name.trim() || !formData.role_id) {
      setError('Anzeigename und Rolle sind erforderlich');
      return;
    }

    if (!isEditMode && !formData.password.trim()) {
      setError('Passwort ist für neue Benutzer erforderlich');
      return;
    }

    await guard(async () => {
      try {
        // password wird nur gesetzt, wenn eines eingegeben wurde — deshalb
        // steht es hier als optionales Feld statt per any.
        const userData: {
          username?: string;
          email: string | null;
          display_name: string;
          role_title: string | null;
          role_id: number;
          is_active: boolean;
          password?: string;
        } = {
          // Leer lassen, wenn der Server ihn erzeugen soll.
          username: nameAutomatisch ? undefined : formData.username.trim(),
          email: formData.email.trim() || null,
          display_name: formData.display_name.trim(),
          role_title: formData.role_title.trim() || null,
          role_id: formData.role_id,
          is_active: formData.is_active
        };

        if (formData.password.trim()) {
          userData.password = formData.password;
        }

        let userIdForAssignments = userId;
        if (isEditMode) {
          // In einer weiteren Gemeinde nur, was je Gemeinde gilt: Rolle,
          // Funktionsbeschreibung und Sperre (seit 08.10.2026), dazu ein
          // neues Passwort, wenn eines eingetragen ist (gilt fuer das Konto).
          await api.put(`/users/${userId}`, nurRolle
            ? {
                role_id: formData.role_id, role_title: userData.role_title, is_active: userData.is_active,
                ...(userData.password ? { password: userData.password } : {})
              }
            : userData);
        } else {
          const response = await api.post('/users', userData);
          userIdForAssignments = response.data.id;
        }

        // Jahrgangs-Zuweisungen. can_edit (das Recht, Konfis und Termine dem
        // Jahrgang zuzuordnen) geht nicht mit: Es folgt auf dem Server der
        // Rolle (Leitung ja, Teamer:in nein). Bis 09.10.2026 stand hier
        // can_edit: true, und jede gespeicherte Teamer:in bekam es still.
        const assignments = Object.entries(jahrgangAssignments)
          .filter(([_, isAssigned]) => isAssigned)
          .map(([jahrgangId, _]) => ({
            jahrgang_id: parseInt(jahrgangId),
            can_view: true,
            // Nur die Gemeindeleitung bei der Rolle Admin; sonst fehlen die
            // Felder, und der Server behaelt die bisherigen Werte.
            ...(rechteVergeben ? nurFelder(alleRechte(jahrgangRechte[parseInt(jahrgangId)]), rechteFelder) : {})
          }));

        if (userIdForAssignments) {
          await api.post(`/users/${userIdForAssignments}/jahrgaenge`, {
            jahrgang_assignments: assignments
          });
        }

        setIsDirty(false);
        onSuccess();
      } catch (err) {
        setError(fehlerText(err, 'Fehler beim Speichern des Benutzers'));
      }
    });
  };

  const setzeRecht = (jahrgangId: number, feld: keyof FreigabeRechte, wert: boolean) => {
    setJahrgangRechte(prev => ({
      ...prev,
      [jahrgangId]: { ...alleRechte(prev[jahrgangId]), [feld]: wert }
    }));
  };

  const handleJahrgangAssignment = (jahrgangId: number, value: boolean) => {
    setJahrgangAssignments(prev => ({
      ...prev,
      [jahrgangId]: value
    }));
  };

  const getAllowedRoles = () => {
    return roles.filter(role => canAssignRole(role.name));
  };

  const isValid = (nameAutomatisch || formData.username.trim())
    && formData.display_name.trim() && formData.role_id > 0;

  return {
    isOnline,
    currentUser,
    isSubmitting,
    loading,
    geladen,
    isDirty,
    isEditMode,
    nameAutomatisch,
    nurRolle,
    formData,
    setFormData,
    /** Einzelne Felder ändern (Web-Dialog). */
    aendern: (teil: Partial<BenutzerFormularDaten>) => setFormData((f) => ({ ...f, ...teil })),
    roles,
    jahrgaenge,
    user,
    jahrgangAssignments,
    jahrgangRechte,
    rechteFelder,
    rechteVergeben,
    getAllowedRoles,
    isValid,
    handleSave,
    setzeRecht,
    handleJahrgangAssignment,
  };
}

export type BenutzerFormular = ReturnType<typeof useBenutzerFormular>;
