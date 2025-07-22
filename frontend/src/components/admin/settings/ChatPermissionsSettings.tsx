import React, { useState, useEffect } from 'react';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonNote,
  IonIcon,
  IonText
} from '@ionic/react';
import { chatbubbles, save } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

const ChatPermissionsSettings: React.FC = () => {
  const { setError, setSuccess } = useApp();
  const [permissions, setPermissions] = useState<string>('direct_only');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    try {
      const response = await api.get('/settings');
      const settings = response.data;
      setPermissions(settings.konfi_chat_permissions || 'direct_only');
    } catch (err) {
      console.error('Error loading settings:', err);
      setError('Fehler beim Laden der Chat-Einstellungen');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/admin/settings', {
        konfi_chat_permissions: permissions
      });
      setSuccess('Chat-Berechtigungen erfolgreich gespeichert');
    } catch (err) {
      console.error('Error saving chat permissions:', err);
      setError('Fehler beim Speichern der Chat-Berechtigungen');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const getPermissionDescription = (value: string) => {
    switch (value) {
      case 'direct_only':
        return 'Konfis können nur Direktnachrichten erstellen';
      case 'direct_and_group':
        return 'Konfis können Direktnachrichten und Gruppenchats erstellen';
      case 'all':
        return 'Konfis haben vollständigen Chat-Zugriff (wie Admins)';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <IonCard>
        <IonCardContent>
          <IonText>Lade Chat-Einstellungen...</IonText>
        </IonCardContent>
      </IonCard>
    );
  }

  return (
    <IonCard>
      <IonCardHeader>
        <IonCardTitle>Chat-Berechtigungen</IonCardTitle>
      </IonCardHeader>
      <IonCardContent>
        <IonItem>
          <IonIcon icon={chatbubbles} slot="start" color="primary" />
          <IonLabel>
            <h2>Konfi Chat-Berechtigungen</h2>
            <p>Bestimme, welche Art von Chats Konfis erstellen können</p>
          </IonLabel>
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Berechtigungsstufe</IonLabel>
          <IonSelect
            value={permissions}
            onIonChange={(e) => setPermissions(e.detail.value)}
            interface="action-sheet"
            placeholder="Berechtigungsstufe wählen"
          >
            <IonSelectOption value="direct_only">
              Nur Direktnachrichten
            </IonSelectOption>
            <IonSelectOption value="direct_and_group">
              Direktnachrichten + Gruppenchats
            </IonSelectOption>
            <IonSelectOption value="all">
              Vollzugriff (wie Admins)
            </IonSelectOption>
          </IonSelect>
        </IonItem>

        <IonNote color="medium" style={{ 
          fontSize: '0.9em', 
          marginTop: '8px', 
          display: 'block',
          padding: '8px 16px'
        }}>
          <strong>Aktuelle Einstellung:</strong> {getPermissionDescription(permissions)}
        </IonNote>

        <IonButton
          expand="block"
          onClick={saveSettings}
          disabled={saving}
          style={{ marginTop: '16px' }}
        >
          <IonIcon icon={save} slot="start" />
          {saving ? 'Speichere...' : 'Einstellungen speichern'}
        </IonButton>
      </IonCardContent>
    </IonCard>
  );
};

export default ChatPermissionsSettings;