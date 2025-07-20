import React, { useState, useEffect } from 'react';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonPage,
  IonButtons,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
  IonToggle,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonCheckbox,
  IonList,
  IonChip,
  IonText,
  IonNote,
  IonTextarea
} from '@ionic/react';
import { 
  save, 
  close, 
  shield,
  checkmark,
  lockClosed,
  key,
  warning
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface Role {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  is_system_role: boolean;
  is_active: boolean;
  user_count: number;
  permission_count: number;
  created_at: string;
  permissions?: Permission[];
}

interface Permission {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  module: string;
  is_active: boolean;
}

interface PermissionsByModule {
  [module: string]: Permission[];
}

interface RoleManagementModalProps {
  roleId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

const RoleManagementModal: React.FC<RoleManagementModalProps> = ({
  roleId,
  onClose,
  onSuccess
}) => {
  const { setSuccess, setError } = useApp();
  const [loading, setLoading] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    is_active: true
  });

  // Available permissions and role data
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<number>>(new Set());

  const isEditMode = !!roleId;
  const isSystemRole = role?.is_system_role || false;

  useEffect(() => {
    loadInitialData();
    if (isEditMode) {
      loadRole();
    }
  }, [roleId]);

  const loadInitialData = async () => {
    try {
      // Load all permissions
      const permissionsResponse = await api.get('/permissions');
      setAllPermissions(permissionsResponse.data);
    } catch (err) {
      console.error('Error loading permissions:', err);
      setError('Fehler beim Laden der Berechtigungen');
    }
  };

  const loadRole = async () => {
    if (!roleId) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/roles/${roleId}`);
      const roleData = response.data;
      
      setRole(roleData);
      setFormData({
        name: roleData.name,
        display_name: roleData.display_name,
        description: roleData.description || '',
        is_active: roleData.is_active
      });

      // Set selected permissions
      if (roleData.permissions) {
        const permissionIds = new Set<number>(
          roleData.permissions
            .filter((p: any) => p.granted === 1)
            .map((p: any) => p.id)
        );
        setSelectedPermissions(permissionIds);
      }
    } catch (err) {
      setError('Fehler beim Laden der Rolle');
      console.error('Error loading role:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.display_name.trim()) {
      setError('Name und Anzeigename sind erforderlich');
      return;
    }

    // System roles can only be edited for status and permissions
    if (isSystemRole && isEditMode) {
      if (formData.name !== role?.name || formData.display_name !== role?.display_name) {
        setError('Name und Anzeigename von System-Rollen können nicht geändert werden');
        return;
      }
    }

    setLoading(true);
    try {
      // Prepare role data
      const roleData: any = {
        name: formData.name.trim(),
        display_name: formData.display_name.trim(),
        description: formData.description.trim() || null,
        is_active: formData.is_active
      };

      // Create or update role
      let roleIdForPermissions = roleId;
      if (isEditMode) {
        await api.put(`/roles/${roleId}`, roleData);
        setSuccess('Rolle erfolgreich aktualisiert');
      } else {
        const response = await api.post('/roles', roleData);
        roleIdForPermissions = response.data.id;
        setSuccess('Rolle erfolgreich erstellt');
      }

      // Update permissions
      const permissionIds = Array.from(selectedPermissions);
      if (roleIdForPermissions) {
        await api.post(`/roles/${roleIdForPermissions}/permissions`, {
          permission_ids: permissionIds
        });
      }

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Speichern der Rolle');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = (permissionId: number, checked: boolean) => {
    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(permissionId);
      } else {
        newSet.delete(permissionId);
      }
      return newSet;
    });
  };

  const handleSelectAllInModule = (modulePermissions: Permission[], selectAll: boolean) => {
    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      modulePermissions.forEach(permission => {
        if (selectAll) {
          newSet.add(permission.id);
        } else {
          newSet.delete(permission.id);
        }
      });
      return newSet;
    });
  };

  // Group permissions by module
  const permissionsByModule: PermissionsByModule = allPermissions.reduce((acc, permission) => {
    if (!acc[permission.module]) {
      acc[permission.module] = [];
    }
    acc[permission.module].push(permission);
    return acc;
  }, {} as PermissionsByModule);

  const getModuleIcon = (module: string) => {
    switch (module) {
      case 'badges': return '🏆';
      case 'requests': return '📝';
      case 'konfis': return '👥';
      case 'activities': return '🎯';
      case 'events': return '📅';
      case 'admin': return '⚙️';
      case 'system': return '🔧';
      default: return '📋';
    }
  };

  const getModuleDisplayName = (module: string) => {
    switch (module) {
      case 'badges': return 'Abzeichen';
      case 'requests': return 'Anträge';
      case 'konfis': return 'Konfis';
      case 'activities': return 'Aktivitäten';
      case 'events': return 'Veranstaltungen';
      case 'admin': return 'Administration';
      case 'system': return 'System';
      default: return module;
    }
  };

  const getModuleColor = (module: string) => {
    switch (module) {
      case 'badges': return '#ff6b35';
      case 'requests': return '#2dd36f';
      case 'konfis': return '#667eea';
      case 'activities': return '#3880ff';
      case 'events': return '#ffcc00';
      case 'admin': return '#8b5cf6';
      case 'system': return '#f53d3d';
      default: return '#929296';
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isEditMode ? 'Rolle bearbeiten' : 'Neue Rolle'}</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={loading}>
              <IonIcon icon={save} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Basis-Informationen */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={shield} style={{ marginRight: '8px' }} />
              Rollen-Informationen
              {isSystemRole && (
                <IonIcon 
                  icon={lockClosed} 
                  style={{ marginLeft: '8px', fontSize: '1rem', color: '#ffcc00' }} 
                />
              )}
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {isSystemRole && (
              <IonItem lines="none" style={{ '--background': 'rgba(255, 204, 0, 0.1)', marginBottom: '16px' }}>
                <IonIcon icon={warning} slot="start" color="warning" />
                <IonLabel>
                  <IonText color="warning">
                    <p style={{ fontWeight: '500' }}>
                      System-Rolle: Name und Anzeigename können nicht geändert werden.
                    </p>
                  </IonText>
                </IonLabel>
              </IonItem>
            )}

            <IonItem>
              <IonLabel position="stacked">Rollenname *</IonLabel>
              <IonInput
                value={formData.name}
                onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
                placeholder="admin, teamer, helper"
                required
                disabled={isSystemRole}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Anzeigename *</IonLabel>
              <IonInput
                value={formData.display_name}
                onIonInput={(e) => setFormData({ ...formData, display_name: e.detail.value! })}
                placeholder="Administrator, Teamer:in, Helfer:in"
                required
                disabled={isSystemRole}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Beschreibung</IonLabel>
              <IonTextarea
                value={formData.description}
                onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
                placeholder="Beschreibung der Rolle und ihrer Aufgaben"
                autoGrow={true}
                rows={2}
              />
            </IonItem>

            <IonItem>
              <IonLabel>
                <h3>Aktiv</h3>
                <p>Rolle kann Benutzern zugewiesen werden</p>
              </IonLabel>
              <IonToggle
                checked={formData.is_active}
                onIonChange={(e) => setFormData({ ...formData, is_active: e.detail.checked })}
              />
            </IonItem>
          </IonCardContent>
        </IonCard>

        {/* Berechtigungen */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={key} style={{ marginRight: '8px' }} />
              Berechtigungen ({selectedPermissions.size} von {allPermissions.length} ausgewählt)
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent style={{ padding: '0' }}>
            {Object.entries(permissionsByModule).map(([module, modulePermissions]) => {
              const selectedInModule = modulePermissions.filter(p => selectedPermissions.has(p.id)).length;
              const allSelected = selectedInModule === modulePermissions.length;
              const someSelected = selectedInModule > 0 && selectedInModule < modulePermissions.length;

              return (
                <div key={module}>
                  {/* Module Header */}
                  <IonItem 
                    style={{ 
                      '--background': `${getModuleColor(module)}15`,
                      '--border-color': getModuleColor(module),
                      borderLeft: `4px solid ${getModuleColor(module)}`,
                      margin: '0',
                      fontWeight: '600'
                    }}
                  >
                    <IonLabel>
                      <h3 style={{ 
                        fontWeight: '600', 
                        color: getModuleColor(module),
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ fontSize: '1.2rem' }}>{getModuleIcon(module)}</span>
                        {getModuleDisplayName(module)}
                        <IonChip 
                          style={{ 
                            fontSize: '0.7rem', 
                            height: '20px',
                            '--background': `${getModuleColor(module)}20`,
                            '--color': getModuleColor(module)
                          }}
                        >
                          {selectedInModule}/{modulePermissions.length}
                        </IonChip>
                      </h3>
                    </IonLabel>
                    <IonCheckbox
                      slot="end"
                      checked={allSelected}
                      indeterminate={someSelected}
                      onIonChange={(e) => handleSelectAllInModule(modulePermissions, e.detail.checked)}
                    />
                  </IonItem>

                  {/* Module Permissions */}
                  <IonList style={{ margin: '0' }}>
                    {modulePermissions.map(permission => (
                      <IonItem 
                        key={permission.id}
                        style={{ 
                          '--padding-start': '24px',
                          '--min-height': '56px'
                        }}
                      >
                        <IonLabel>
                          <h3 style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                            {permission.display_name}
                          </h3>
                          {permission.description && (
                            <p style={{ 
                              fontSize: '0.8rem', 
                              color: '#666', 
                              margin: '2px 0 0 0',
                              fontStyle: 'italic'
                            }}>
                              {permission.description}
                            </p>
                          )}
                          <IonNote style={{ fontSize: '0.75rem' }}>
                            {permission.name}
                          </IonNote>
                        </IonLabel>
                        <IonCheckbox
                          slot="end"
                          checked={selectedPermissions.has(permission.id)}
                          onIonChange={(e) => handlePermissionToggle(permission.id, e.detail.checked)}
                        />
                      </IonItem>
                    ))}
                  </IonList>
                </div>
              );
            })}

            {Object.keys(permissionsByModule).length === 0 && (
              <IonItem>
                <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                  <p>Keine Berechtigungen verfügbar</p>
                </IonLabel>
              </IonItem>
            )}
          </IonCardContent>
        </IonCard>

        {/* Zusammenfassung */}
        <IonCard>
          <IonCardContent>
            <IonItem lines="none">
              <IonLabel>
                <h2>Zusammenfassung</h2>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <IonChip color="primary" style={{ fontSize: '0.8rem' }}>
                    {selectedPermissions.size} Berechtigungen
                  </IonChip>
                  <IonChip color={formData.is_active ? 'success' : 'medium'} style={{ fontSize: '0.8rem' }}>
                    {formData.is_active ? 'Aktiv' : 'Inaktiv'}
                  </IonChip>
                  {isSystemRole && (
                    <IonChip color="warning" style={{ fontSize: '0.8rem' }}>
                      System-Rolle
                    </IonChip>
                  )}
                </div>
                {isEditMode && role && (
                  <p style={{ fontSize: '0.8rem', color: '#666', margin: '8px 0 0' }}>
                    Erstellt: {new Date(role.created_at).toLocaleDateString('de-DE')} • 
                    {role.user_count} {role.user_count === 1 ? 'Benutzer' : 'Benutzer'}
                  </p>
                )}
              </IonLabel>
            </IonItem>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default RoleManagementModal;