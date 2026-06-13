import React, { useState, useEffect, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonIcon,
  IonButton,
  IonButtons,
  IonInput,
  IonList,
  IonListHeader,
  IonSpinner,
  IonSelect,
  IonSelectOption,
  IonNote,
  IonItemSliding,
  IonItemOptions,
  IonItemOption
} from '@ionic/react';
import {
  closeOutline,
  searchOutline,
  personAddOutline,
  peopleOutline,
  trash,
  addCircleOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface OrgMembersModalProps {
  organizationId: number;
  organizationName: string;
  onClose: () => void;
}

interface Member {
  id: number;
  username: string;
  display_name: string;
  email?: string;
  role_name: string;
  role_display_name?: string;
  is_primary: boolean;
}

interface SearchResult {
  id: number;
  username: string;
  display_name: string;
  email?: string;
  primary_organization_name?: string;
  primary_role_name?: string;
}

const ROLE_OPTIONS = [
  { value: 'org_admin', label: 'Org-Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'teamer', label: 'Teamer:in' }
];

/**
 * Mitglieder einer Organisation verwalten (nur Super-Admin). Erlaubt es,
 * bestehende User (Admin/Teamer/Org-Admin) zusaetzlich dieser Org zuzuweisen,
 * damit sie per Org-Switcher zwischen den Gemeinden wechseln koennen, sowie
 * Mitgliedschaften wieder zu entfernen. Konfis sind ausgenommen.
 */
const OrgMembersModal: React.FC<OrgMembersModalProps> = ({ organizationId, organizationName, onClose }) => {
  const { setError, setSuccess } = useApp();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('teamer');
  const [addingId, setAddingId] = useState<number | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      const res = await api.get(`/organizations/${organizationId}/members`);
      setMembers(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError('Mitglieder konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [organizationId, setError]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Suche (debounced) — ab 2 Zeichen
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await api.get(`/organizations/search-users`, { params: { q } });
        setSearchResults(Array.isArray(res.data) ? res.data : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const handleAdd = async (userId: number) => {
    setAddingId(userId);
    try {
      await api.post(`/organizations/${organizationId}/members`, {
        user_id: userId,
        role_name: selectedRole
      });
      setSuccess('Mitglied hinzugefügt');
      setSearchQuery('');
      setSearchResults([]);
      await loadMembers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Mitglied konnte nicht hinzugefügt werden');
    } finally {
      setAddingId(null);
    }
  };

  const handleRemove = async (member: Member) => {
    try {
      await api.delete(`/organizations/${organizationId}/members/${member.id}`);
      setSuccess('Mitglied entfernt');
      await loadMembers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Mitglied konnte nicht entfernt werden');
    }
  };

  // IDs, die schon Mitglied sind -> in der Suche ausblenden
  const memberIds = new Set(members.map(m => m.id));

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>Mitglieder</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background">
        {/* Hinzufuegen */}
        <IonList inset={true}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={personAddOutline} />
            </div>
            <IonLabel>Zu {organizationName} hinzufügen</IonLabel>
          </IonListHeader>

          <IonItem>
            <IonIcon icon={searchOutline} slot="start" style={{ color: '#8e8e93', fontSize: '1rem' }} />
            <IonInput
              value={searchQuery}
              onIonInput={(e) => setSearchQuery(e.detail.value || '')}
              placeholder="Name oder Benutzername suchen..."
              clearInput
            />
          </IonItem>

          <IonItem>
            <IonLabel>Rolle</IonLabel>
            <IonSelect
              value={selectedRole}
              onIonChange={(e) => setSelectedRole(e.detail.value)}
              interface="popover"
              slot="end"
            >
              {ROLE_OPTIONS.map(r => (
                <IonSelectOption key={r.value} value={r.value}>{r.label}</IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>

          {searching && (
            <IonItem lines="none">
              <IonSpinner name="dots" slot="start" />
              <IonLabel color="medium">Suche…</IonLabel>
            </IonItem>
          )}

          {!searching && searchQuery.trim().length >= 2 && searchResults.filter(u => !memberIds.has(u.id)).length === 0 && (
            <IonItem lines="none">
              <IonLabel color="medium">Keine passenden Benutzer:innen</IonLabel>
            </IonItem>
          )}

          {searchResults.filter(u => !memberIds.has(u.id)).map(u => (
            <IonItem key={u.id} button detail={false} onClick={() => addingId === null && handleAdd(u.id)}>
              <IonLabel>
                <h3>{u.display_name}</h3>
                <p>
                  @{u.username}
                  {u.primary_organization_name ? ` · ${u.primary_organization_name}` : ''}
                </p>
              </IonLabel>
              {addingId === u.id
                ? <IonSpinner name="dots" slot="end" />
                : <IonIcon icon={addCircleOutline} slot="end" className="app-icon-color--users" style={{ fontSize: '1.5rem' }} />}
            </IonItem>
          ))}
        </IonList>

        {/* Aktuelle Mitglieder */}
        <IonList inset={true}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={peopleOutline} />
            </div>
            <IonLabel>Aktuelle Mitglieder</IonLabel>
          </IonListHeader>

          {loading ? (
            <IonItem lines="none">
              <IonSpinner name="dots" slot="start" />
              <IonLabel color="medium">Wird geladen…</IonLabel>
            </IonItem>
          ) : members.length === 0 ? (
            <IonItem lines="none">
              <IonLabel color="medium">Noch keine Mitglieder</IonLabel>
            </IonItem>
          ) : (
            members.map(m => (
              <IonItemSliding key={m.id}>
                <IonItem>
                  <IonLabel>
                    <h3>{m.display_name}</h3>
                    <p>@{m.username} · {m.role_display_name || m.role_name}</p>
                  </IonLabel>
                  {m.is_primary && <IonNote slot="end">Primär</IonNote>}
                </IonItem>
                {/* Primaer-Org kann hier nicht entfernt werden (Server blockt das ebenfalls) */}
                {!m.is_primary && (
                  <IonItemOptions side="end" className="app-swipe-actions">
                    <IonItemOption onClick={() => handleRemove(m)} className="app-swipe-action">
                      <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                        <IonIcon icon={trash} />
                      </div>
                    </IonItemOption>
                  </IonItemOptions>
                )}
              </IonItemSliding>
            ))
          )}
        </IonList>

        <div style={{ height: '32px' }} />
      </IonContent>
    </IonPage>
  );
};

export default OrgMembersModal;
