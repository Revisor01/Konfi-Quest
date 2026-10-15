// Die Mitglieder eines Chatraums -- ansehen, hinzufügen, entfernen -- als
// Logik ohne Darstellung (Simon, 15.10.2026, Seiten-Interview Seite 3:
// „mitglieder modal ist noch app design"). Die App zeigt sie im Modal
// (modals/MembersModal.tsx), der Browser ab 992 px im Dialog
// (web/WebMitgliederDialog.tsx). Was geladen wird, wer zur Auswahl steht, wer
// verwalten darf, die Reihenfolge, die Wege zum Server und ihre Texte stehen
// nur hier, damit beide nicht auseinanderlaufen.
//
// Laden:       GET /chat/rooms/:id/participants
//              zum Hinzufügen (nur, wer verwalten darf): GET /admin/konfis,
//              GET /users/me/jahrgaenge, GET /users
// Hinzufügen:  POST /chat/rooms/:id/participants { user_id, user_type } je Person
// Entfernen:   DELETE /chat/rooms/:id/participants/:user_id/:user_type
//
// Ansehen darf jedes Mitglied (außer im Einzelchat, dort gibt es die Liste
// nicht). Verwalten darf nur die Leitung (user.type 'admin') und nur in
// Gruppen: Die Mitglieder der Jahrgangs- und Team-Chats ergeben sich von
// selbst, der Server lehnt dort Hinzufügen und Entfernen ab.
//
// Fehler meldet der Hook über `meldeFehler`: in der App oben (setError), im
// Dialog des Browsers im Fenster selbst.

import { useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { istTeamTyp } from '../../utils/chatRoles';
import { rollenName } from '../../utils/rollenNamen';
import type { AdminUser, ChatUser } from '../../types/user';
import type { EigenerJahrgang, KonfiEintrag } from '../../types/chat';

/** Ein Mitglied, wie GET /chat/rooms/:id/participants es liefert. */
export interface ChatTeilnehmer {
  user_id: number;
  user_type: 'admin' | 'konfi' | 'teamer';
  name: string;
  role_name?: string;
  role_title?: string;
  role_display_name?: string;
  jahrgang_id?: number;
  jahrgang_name?: string;
  joined_at: string;
}

// --- Texte: dieselben in App und Browser ---
export const MITGLIEDER_LADEN_FEHLER = 'Fehler beim Laden der Mitglieder';
export const MITGLIEDER_HINZUFUEGEN_FEHLER = 'Fehler beim Hinzufügen der Mitglieder';
export const MITGLIED_ENTFERNEN_FEHLER = 'Fehler beim Entfernen des Mitglieds';
export const MITGLIED_ENTFERNEN_TITEL = 'Mitglied entfernen';
export const mitgliedEntfernenFrage = (name: string): string => `${name} wirklich aus dem Chat entfernen?`;

// Team-Mitglied = Admin/Org-Admin ODER Teamer:in (NICHT Konfi). Teamer wurden bisher
// faelschlich wie Konfis dargestellt (lila, ohne Funktion), weil nur auf 'admin'
// geprüft wurde. Diese Helfer behandeln 'teamer' konsistent als Team.
export const istTeamPerson = (u: { user_type?: string; type?: string }): boolean =>
  istTeamTyp('user_type' in u ? u.user_type : u.type);

/** Kennung einer Person in der Auswahl: "<typ>-<id>" (so geht sie auch an den Server). */
export const personKennung = (u: ChatUser): string => `${u.type}-${u.id}`;

export const anzeigeName = (person: ChatUser | ChatTeilnehmer): string => {
  if ('display_name' in person) {
    return person.name || person.display_name || 'Unbekannt';
  }
  return person.name || 'Unbekannt';
};

/** Rolle bzw. Funktion (Eselsohr der App, Zeile darunter im Browser); Konfis heißen „Konfi". */
export const rollenText = (person: ChatUser | ChatTeilnehmer): string => {
  if (istTeamPerson(person)) {
    if ('role_title' in person && person.role_title) {
      return person.role_title;
    }
    // Ohne eigenen Titel das feste Wort nach der Rolle (utils/rollenNamen);
    // role_display_name traegt in bestehenden Gemeinden noch die alten Namen.
    const roleName = 'role_name' in person ? person.role_name : undefined;
    const ausDerAntwort =
      ('role_display_name' in person && person.role_display_name)
      || ('role_description' in person && person.role_description)
      || 'Leitung';
    return rollenName(roleName, ausDerAntwort);
  }
  return 'Konfi';
};

/** Der Jahrgang einer Konfi (Zeile darunter); null, wenn keiner bekannt ist. */
export const jahrgangVon = (person: ChatUser | ChatTeilnehmer): string | null => {
  if ('jahrgang_name' in person && person.jahrgang_name) {
    return person.jahrgang_name;
  }
  if ('jahrgang' in person && person.jahrgang) {
    return person.jahrgang;
  }
  return null;
};

/** Team-Mitglieder (Leitung und Teamer:innen) zuerst, dann alphabetisch nach Name. */
export const nachTeamUndName = <T extends { name?: string; display_name?: string; type?: string; user_type?: string }>(personen: T[]): T[] =>
  [...personen].sort((a, b) => {
    const aIsTeam = istTeamPerson(a);
    const bIsTeam = istTeamPerson(b);
    if (aIsTeam && !bIsTeam) return -1;
    if (!aIsTeam && bIsTeam) return 1;
    const aName = (a.name || a.display_name || '').toLowerCase();
    const bName = (b.name || b.display_name || '').toLowerCase();
    return aName.localeCompare(bName, 'de');
  });

export interface ChatMitgliederOptionen {
  roomId: number;
  roomType: string;
  /** Wohin ein Fehler geht; ohne Angabe oben in der App (setError). */
  meldeFehler?: (text: string) => void;
}

export function useChatMitglieder({ roomId, roomType, meldeFehler }: ChatMitgliederOptionen) {
  const { user, setError, isOnline } = useApp();
  const melden = meldeFehler ?? setError;

  const [participants, setParticipants] = useState<ChatTeilnehmer[]>([]);
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAddMode, setShowAddMode] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const isGroupChat = roomType === 'group';
  const canManageMembers = user?.type === 'admin' && isGroupChat;

  const loadParticipants = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/chat/rooms/${roomId}/participants`);
      setParticipants(response.data);
    } catch (err) {
      melden(MITGLIEDER_LADEN_FEHLER);
      console.error('Error loading participants:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const [konfisRes, userJahrgangRes, adminsRes] = await Promise.all([
        api.get('/admin/konfis'),
        // /users statt /admin/users: createApp.js haengt denselben Router
        // unter beiden Praefixen ein (:480 und :483). Die Oberflaeche nutzt
        // durchgaengig /users; der zweite Mount bleibt nur fuer ausgelieferte
        // Apps stehen (docs/api/ABRISS.md, Abschnitt D).
        api.get('/users/me/jahrgaenge').catch(() => ({ data: [] })),
        api.get('/users').catch(() => ({ data: [] }))
      ]);

      // Jahrgangs-Filter wie SimpleCreateChatModal
      let allowedJahrgangIds: number[] = [];
      const eigeneJahrgaenge = userJahrgangRes.data as EigenerJahrgang[];
      if (eigeneJahrgaenge.length > 0) {
        allowedJahrgangIds = eigeneJahrgaenge.map((j) => j.id);
      }

      // GET /admin/konfis liefert den Jahrgang nur als jahrgang_name; der
      // frühere Fallback auf konfi.jahrgang griff nie.
      const konfis: ChatUser[] = (konfisRes.data as KonfiEintrag[])
        .filter((konfi) => {
          if (allowedJahrgangIds.length > 0) {
            return Boolean(konfi.jahrgang_id) && allowedJahrgangIds.includes(konfi.jahrgang_id as number);
          }
          return true;
        })
        .map((konfi) => ({
          ...konfi,
          type: 'konfi' as const,
          jahrgang_name: konfi.jahrgang_name ?? undefined
        }));

      // GET /users schliesst Konfis bereits serverseitig aus
      // (WHERE r.name NOT IN ('konfi', 'super_admin')).
      const adminUsers: ChatUser[] = (adminsRes.data as AdminUser[])
        .filter((u) => u.role_name !== 'konfi')
        .map((admin) => ({
          ...admin,
          type: 'admin' as const,
          role_description: admin.role_title || rollenName(admin.role_name, admin.role_display_name)
        }));

      setAllUsers([...konfis, ...adminUsers]);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  useEffect(() => {
    if (roomId) void loadParticipants();
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Die Personenlisten braucht nur das Hinzufuegen, also nur, wer verwalten
  // darf (30.09.2026): Vorher holte jedes Mitglied beim Oeffnen
  // /admin/konfis -- fuer Konfis jedes Mal ein 403.
  useEffect(() => {
    if (roomId && canManageMembers) void loadAllUsers();
  }, [roomId, canManageMembers]);

  /** Wer noch nicht im Raum ist, passend zur Suche, Team zuerst. */
  const participantIds = new Set(participants.map((p) => `${p.user_type}-${p.user_id}`));
  const suche = searchText.toLowerCase();
  const filteredAvailableUsers = nachTeamUndName(allUsers
    .filter((u) => !participantIds.has(personKennung(u)))
    .filter((u) => {
      const name = u.name || u.display_name || '';
      return name.toLowerCase().includes(suche) ||
        (u.jahrgang && u.jahrgang.toLowerCase().includes(suche));
    }));

  const sortedParticipants = nachTeamUndName(participants);

  const handleUserToggle = (person: ChatUser) => {
    const kennung = personKennung(person);
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(kennung)) {
      newSelected.delete(kennung);
    } else {
      newSelected.add(kennung);
    }
    setSelectedUsers(newSelected);
  };

  /** Die Gewählten hinzufügen. true, wenn alle im Raum sind (danach zurück zur Liste). */
  const addSelectedUsers = async (): Promise<boolean> => {
    if (selectedUsers.size === 0 || adding) return false;

    setAdding(true);
    try {
      const promises = Array.from(selectedUsers).map((kennung) => {
        const [type, id] = kennung.split('-');
        return api.post(`/chat/rooms/${roomId}/participants`, {
          user_id: parseInt(id),
          user_type: type
        });
      });

      await Promise.all(promises);

      setSelectedUsers(new Set());
      setShowAddMode(false);
      await loadParticipants();
      return true;
    } catch (err) {
      melden(MITGLIEDER_HINZUFUEGEN_FEHLER);
      console.error('Error adding participants:', err);
      return false;
    } finally {
      setAdding(false);
    }
  };

  /** Vor der Rückfrage: offline geht Entfernen nicht (Meldung, true = abbrechen). */
  const entfernenOfflineBlockiert = (): boolean => offlineBlockiert(isOnline, melden);

  /** Nach der Rückfrage: entfernen. true, wenn es geklappt hat. */
  const mitgliedEntfernen = async (participant: ChatTeilnehmer): Promise<boolean> => {
    try {
      await api.delete(`/chat/rooms/${roomId}/participants/${participant.user_id}/${participant.user_type}`);
      await loadParticipants();
      return true;
    } catch (err) {
      melden(MITGLIED_ENTFERNEN_FEHLER);
      console.error('Error removing participant:', err);
      return false;
    }
  };

  /** Beim Schließen: Auswahl, Suche und Modus zurück. */
  const zuruecksetzen = () => {
    setShowAddMode(false);
    setSelectedUsers(new Set());
    setSearchText('');
  };

  return {
    isOnline,
    participants,
    sortedParticipants,
    loading,
    adding,
    showAddMode,
    setShowAddMode,
    searchText,
    setSearchText,
    selectedUsers,
    setSelectedUsers,
    canManageMembers,
    filteredAvailableUsers,
    loadParticipants,
    loadAllUsers,
    handleUserToggle,
    addSelectedUsers,
    entfernenOfflineBlockiert,
    mitgliedEntfernen,
    zuruecksetzen,
  };
}

export type ChatMitgliederZustand = ReturnType<typeof useChatMitglieder>;
