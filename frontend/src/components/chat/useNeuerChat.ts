// „Neuer Chat" -- als Logik ohne Darstellung (Simon, 15.10.2026, Seite 3 des
// Seiten-Interviews: „neuer chat modal ist noch app"). Die App zeigt sie im
// Modal (modals/SimpleCreateChatModal.tsx), der Browser ab 992 px im Dialog
// (web/WebNeuerChatDialog.tsx). Wer wählbar ist, die Filter, die Prüfung, die
// beiden Wege zum Server und ihre Texte stehen nur hier, damit beide nicht
// auseinanderlaufen.
//
// Wählbar (die Regel „Wer sieht und bekommt was" in CLAUDE.md; den Rest
// prüft der Server):
//   Konfi        GET /chat/available-users -- nur Direktnachrichten.
//   Leitung      GET /admin/konfis, GET /users/me/jahrgaenge, GET /chat/team-contacts
//   Teamer:in    dieselben, Konfis aber nur ihrer zugewiesenen Jahrgänge.
// Anlegen:
//   Direkt       POST /chat/direct { target_user_id, target_user_type }
//   Gruppe       POST /chat/rooms { name, type: 'group', participants: [{ user_id, user_type }] }
//
// Meldungen: in der App wie bisher oben (setError); im Dialog des Browsers
// (`fehlerImDialog`) im Dialog selbst (`fehler`) -- wie useBenutzerFormular.
// Nach dem Anlegen holt der Hook die Zähler neu und ruft onAngelegt mit der
// Kennung des Raums (neu oder bestehend): Der Aufrufer schließt und springt
// hinein.

import { useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useBadge } from '../../contexts/BadgeContext';
import { useActionGuard } from '../../hooks/useActionGuard';
import api from '../../services/api';
import type { ChatUser } from '../../types/user';
import type { EigenerJahrgang, KonfiEintrag, TeamKontakt, VerfuegbarerPartner } from '../../types/chat';
import { istTeamTyp } from '../../utils/chatRoles';
import { fehlerText, fehlerTextOderMessage } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';

export type NeuerChatArt = 'direct' | 'group';

export interface NeuerChatOptionen {
  /** Nach dem Anlegen: die Kennung des Raums, den der Server nennt (neu oder bestehend). */
  onAngelegt: (roomId?: number) => void;
  /**
   * Meldungen im Fenster zeigen (`fehler`; der Dialog des Browsers) statt
   * oben als Meldung (App).
   */
  fehlerImDialog?: boolean;
}

/** Die Kennung einer Person in der Auswahl der Gruppe: "typ-id". */
export const personKennung = (person: ChatUser): string => `${person.type}-${person.id}`;

/** Der Name einer Person in der Liste. */
export const personName = (person: ChatUser): string => person.name || person.display_name || 'Unbekannt';

export function useNeuerChat({ onAngelegt, fehlerImDialog = false }: NeuerChatOptionen) {
  const { user, setError: meldungOben, isOnline } = useApp();
  const { refreshFromAPI } = useBadge();
  // Die Meldung im Dialog; leer, sobald jemand etwas ändert.
  const [fehler, setFehler] = useState<string | null>(null);
  // Wohin eine Meldung geht (siehe oben). Bewusst unter dem Namen setError:
  // Die Positivliste der Fehlertexte (utils/bekannteFehlertexte.ts) liest die
  // Texte an den Aufrufstellen von setError.
  const setError = (meldung: string) => {
    if (fehlerImDialog) setFehler(meldung || null);
    else meldungOben(meldung);
  };

  const isAdmin = user?.type === 'admin';
  const isTeamer = user?.type === 'teamer';

  // DATENSCHUTZ: Konfis dürfen NUR Direktnachrichten senden -- für sie gibt es
  // keine andere Art, egal was gewählt wurde.
  const [gewaehlteArt, setChatType] = useState<NeuerChatArt>('direct');
  const chatType: NeuerChatArt = user?.type === 'konfi' ? 'direct' : gewaehlteArt;

  const [isDirty, setIsDirty] = useState(false);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const { isSubmitting: creating, guard } = useActionGuard();

  // Filter states
  const [selectedRole, setSelectedRole] = useState<string>('alle');
  const [selectedJahrgang, setSelectedJahrgang] = useState<string>('alle');
  const [availableJahrgaenge, setAvailableJahrgaenge] = useState<string[]>([]);

  // Group chat specific
  const [groupName, setGroupNameRoh] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());

  // Ungespeicherte Änderungen: ein Gruppenname oder eine gewählte Person.
  // Einmal gesetzt, bleibt es bis zum Schließen gesetzt.
  const setGroupName = (name: string) => {
    setGroupNameRoh(name);
    if (name.trim() || selectedParticipants.size > 0) setIsDirty(true);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      if (user?.type === 'konfi') {
        // Konfi: Verwende neue sichere API
        const response = await api.get('/chat/available-users');
        const availableUsers: ChatUser[] = (response.data.users as VerfuegbarerPartner[]).map((u) => ({
          id: u.id,
          name: u.name,
          display_name: u.name,
          // Das Backend liefert 'teamer' als eigenen Wert — vorher war der Typ
          // hier auf admin|konfi verengt und Teamer:innen wurden in der Liste
          // wie Konfis dargestellt.
          type: u.type,
          jahrgang_name: u.jahrgang_name ?? undefined,
          // Die Rolle in dieser Gemeinde (02.10.2026): Sie fiel hier weg, die
          // Eck-Marke jeder Leitung stand deshalb in der Teamer-Farbe.
          role_name: u.role_name,
          // Funktionsbeschreibung vom Backend (bereits mit Fallback)
          role_description: u.role_description
        }));


        // Verfügbare Jahrgänge ermitteln
        const jahrgaenge = [...new Set(availableUsers
          .map((u) => u.jahrgang_name)
          .filter((name): name is string => Boolean(name)))]
          .sort();
        setAvailableJahrgaenge(jahrgaenge);

        setUsers(availableUsers);

      } else if (user?.type === 'admin' || user?.type === 'teamer') {
        // Admin/Teamer: Verwende bestehende Admin-APIs
        const [konfisRes, userJahrgangRes] = await Promise.all([
          api.get('/admin/konfis'),
          // /users statt /admin/users -- gleicher Router, ein Praefix in der
          // Oberflaeche (docs/api/ABRISS.md, Abschnitt D).
          api.get('/users/me/jahrgaenge').catch(() => ({ data: [] }))
        ]);

        // Filtere Konfis basierend auf Jahrgangs-Zuweisungen
        // Backend liefert {id, name, ...} -- nicht jahrgang_id (Bug-Quelle)
        let allowedJahrgangIds: number[] = [];
        const eigeneJahrgaenge = userJahrgangRes.data as EigenerJahrgang[];
        if (eigeneJahrgaenge.length > 0) {
          allowedJahrgangIds = eigeneJahrgaenge.map((j) => j.id);
        }

        // Leitung und Admins erreichen alle Konfis der Gemeinde, Teamer:innen
        // nur die ihrer zugewiesenen Jahrgänge. Vorher griff der Filter nur bei
        // vorhandenen Zuweisungen (length > 0) — eine Teamer:in OHNE Jahrgang
        // sah dadurch alle Konfis (Nutzerhinweis 23.08.2026). Der Server lehnt
        // solche Chats jetzt ab; ohne diesen Filter liefe man erst in die
        // Fehlermeldung.
        const istTeamer = user?.type === 'teamer';

        const konfis: ChatUser[] = (konfisRes.data as KonfiEintrag[])
          .filter((konfi) => {
            if (!istTeamer) return true;
            return Boolean(konfi.jahrgang_id) && allowedJahrgangIds.includes(konfi.jahrgang_id as number);
          })
          // GET /admin/konfis liefert display_name als `name` und den Jahrgang
          // ausschliesslich als `jahrgang_name`. Die frueheren Fallbacks
          // (konfi.display_name, konfi.jahrgang) griffen nie.
          .map((konfi) => ({
            id: konfi.id,
            name: konfi.name,
            display_name: konfi.name,
            type: 'konfi' as const,
            jahrgang_name: konfi.jahrgang_name ?? undefined
          }));

        // Auch die anderen Team-Mitglieder (Admins, Org-Admins, Teamer:innen) laden.
        // Bewusst über /chat/team-contacts statt /users: Letztere ist mit
        // requireOrgAdmin geschuetzt, Teamer:innen liefen dort in einen 403 und
        // bekamen deshalb gar keine Team-Kontakte angezeigt.
        let adminUsers: ChatUser[] = [];
        try {
          const usersRes = await api.get('/chat/team-contacts');
          adminUsers = (usersRes.data as TeamKontakt[]).map((member) => ({
            id: member.id,
            name: member.display_name,
            display_name: member.display_name,
            type: (member.role_name === 'teamer' ? 'teamer' : 'admin') as 'admin' | 'teamer',
            // Rolle in dieser Gemeinde fuer die Rollenfarbe (02.10.2026) --
            // fiel hier bis dahin weg, jede Leitung stand in Beere.
            role_name: member.role_name,
            role_description: member.role_description
          }));
        } catch (err) {
 console.warn('Team-Kontakte für Chat konnten nicht geladen werden:', err);
        }

        const allUsers = [...konfis, ...adminUsers];

        // Extrahiere verfügbare Jahrgänge (nur von gefilterten Konfis)
        const jahrgaenge = [...new Set(
          konfis
            .filter(u => u.jahrgang_name || u.jahrgang)
            .map(u => u.jahrgang_name || u.jahrgang)
        )].filter(Boolean) as string[];
        setAvailableJahrgaenge(jahrgaenge);

        // Filter out current user for direct messages
        if (chatType === 'direct') {
          const filteredUsers = allUsers.filter(u =>
            !(u.id === user?.id && u.type === user?.type)
          );
          setUsers(filteredUsers);
        } else {
          setUsers(allUsers);
        }
      }

    } catch (err) {
      setError('Fehler beim Laden der Benutzer');
 console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  // Bei jeder Art neu laden: Die Direktnachricht blendet die eigene Person aus.
  useEffect(() => {
    loadUsers();
  }, [chatType]);

  const handleParticipantToggle = (id: string) => {
    const newSelected = new Set(selectedParticipants);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedParticipants(newSelected);
    if (groupName.trim() || newSelected.size > 0) setIsDirty(true);
  };

  const createDirectMessage = async (targetUser: ChatUser) => {
    if (offlineBlockiert(isOnline, setError)) return;
    // Frueher stand hier eine Doppel-Pruefung ("Chat existiert bereits") gegen
    // chat.participants. GET /chat/rooms liefert dieses Feld gar nicht — die
    // Pruefung war immer false und der Hinweis erschien nie. Sie wird auch
    // nicht gebraucht: POST /chat/direct gibt einen bestehenden Raum zurueck
    // (created: false), und /chat/available-users blendet Partner mit
    // bestehendem Direktchat ohnehin aus.
    await guard(async () => {
      try {
        const directRes = await api.post('/chat/direct', {
          target_user_id: targetUser.id,
          target_user_type: targetUser.type
        });

        await refreshFromAPI(); // Update badge context
        onAngelegt(directRes.data?.room_id);
      } catch (err) {
        // Ein 403 traegt eine verstaendliche Begruendung vom Server (z.B.
        // "Dieser Admin ist nicht fuer deinen Jahrgang zustaendig",
        // Jahrgangsregel vom 01.09.2026) — die zeigen wir statt der
        // generischen Meldung.
        setError(fehlerText(err, 'Fehler beim Erstellen der Direktnachricht'));
        console.error('Error creating direct message:', err);
      }
    });
  };

  const createGroupChat = async () => {
    // In der App ist der Haken offline gesperrt; im Browser sagt es der Dialog.
    if (offlineBlockiert(isOnline, setError)) return;

    if (!groupName.trim()) {
      setError('Bitte gib einen Gruppennamen ein');
      return;
    }

    if (selectedParticipants.size === 0) {
      setError('Bitte wähle mindestens eine:n Teilnehmer:in aus');
      return;
    }

    await guard(async () => {
      try {
        // Convert participant IDs from "type-id" format to objects
        const participants = Array.from(selectedParticipants).map(participantId => {
          const [type, id] = participantId.split('-');
          return {
            user_id: parseInt(id),
            user_type: type
          };
        });

        const groupData = {
          name: groupName.trim(),
          type: 'group',
          participants: participants
        };

        const groupRes = await api.post('/chat/rooms', groupData);

        await refreshFromAPI(); // Update badge context
        onAngelegt(groupRes.data?.room_id);
      } catch (err) {
        console.error('Error creating group chat:', err);
        setError(`Fehler beim Erstellen des Gruppenchats: ${fehlerTextOderMessage(err, 'Unbekannter Fehler')}`);
      }
    });
  };

  /** Alles auf Anfang (die App beim Schließen ihres Modals). */
  const zuruecksetzen = () => {
    setChatType('direct');
    setGroupNameRoh('');
    setSearchText('');
    setSelectedParticipants(new Set());
    setUsers([]);
    setIsDirty(false);
    setFehler(null);
  };

  const filteredUsers = users.filter(user => {
    // Name/Suchfilter
    const name = user.name || user.display_name || '';
    const matchesSearch = name.toLowerCase().includes(searchText.toLowerCase()) ||
           (user.jahrgang && user.jahrgang.toLowerCase().includes(searchText.toLowerCase()));

    if (!matchesSearch) return false;

    // Rollenfilter
    if (selectedRole !== 'alle') {
      if (selectedRole === 'konfi' && user.type !== 'konfi') return false;
      // "Team" meint Admins UND Teamer:innen. Vorher nur 'admin' — der Filter
      // "Team" zeigte dadurch das Team ohne seine Teamer:innen.
      if (selectedRole === 'admin' && !istTeamTyp(user.type)) return false;
    }

    // Jahrgangsfilter (nur für Konfis)
    if (selectedJahrgang !== 'alle' && user.type === 'konfi') {
      const userJahrgang = user.jahrgang_name || user.jahrgang;
      if (userJahrgang !== selectedJahrgang) return false;
    }

    return true;
  });

  const isFormValid = chatType === 'direct' || (chatType === 'group' && groupName.trim() && selectedParticipants.size > 0);

  return {
    user,
    isOnline,
    isAdmin,
    isTeamer,
    chatType,
    setChatType,
    isDirty,
    users,
    filteredUsers,
    loading,
    creating,
    searchText,
    setSearchText,
    selectedRole,
    setSelectedRole,
    selectedJahrgang,
    setSelectedJahrgang,
    availableJahrgaenge,
    groupName,
    setGroupName,
    selectedParticipants,
    handleParticipantToggle,
    createDirectMessage,
    createGroupChat,
    isFormValid,
    zuruecksetzen,
    /** Die Meldung im Dialog (nur mit `fehlerImDialog`). */
    fehler,
    fehlerLeeren: () => setFehler(null),
  };
}

export type NeuerChatZustand = ReturnType<typeof useNeuerChat>;
