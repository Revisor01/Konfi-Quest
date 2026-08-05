import React, { useState, useEffect, useRef } from 'react';
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
  IonTextarea,
  IonToggle,
  IonCard,
  IonCardContent,
  IonIcon,
  IonText,
  IonSpinner,
  IonList,
  IonListHeader,
  IonAccordion,
  IonAccordionGroup,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
  IonSearchbar
} from '@ionic/react';
import {
  checkmarkOutline,
  closeOutline,
  flag,
  informationCircleOutline,
  eyeOutline,
  imagesOutline,
  peopleOutline,
  calendarOutline,
  chevronDownOutline,
  lockClosedOutline,
  personOutline,
  ribbonOutline,
  // Icon-Auswahl (identische Auswahl wie im Badge-Modal)
  trophy,
  medal,
  ribbon,
  star,
  checkmarkCircle,
  diamond,
  shield,
  flame,
  flash,
  rocket,
  sparkles,
  thumbsUp,
  heart,
  people,
  personAdd,
  chatbubbles,
  gift,
  book,
  school,
  construct,
  brush,
  colorPalette,
  sunny,
  moon,
  leaf,
  rose,
  calendar,
  today,
  time,
  timer,
  stopwatch,
  restaurant,
  fitness,
  bicycle,
  car,
  airplane,
  boat,
  camera,
  image,
  musicalNote,
  balloon,
  home,
  business,
  location,
  navigate,
  compass,
  pin,
  informationCircle,
  helpCircle,
  alertCircle,
  hammer
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
import api from '../../../services/api';
import type {
  AdminChallenge,
  ChallengeType,
  ChallengeVisibility,
  ChallengeMediaType
} from '../../../types/challenges';
import { getChallengeStatus } from '../views/ChallengesManageView';

// Icon-Auswahl: identisches Pattern und identischer Vorrat wie BadgeManagementModal,
// damit Challenge-Abzeichen und Badges dieselbe Bildsprache haben.
const CHALLENGE_ICONS: Record<string, { icon: string; name: string; category: string }> = {
  flag: { icon: flag, name: 'Flagge', category: 'Challenge' },
  sparkles: { icon: sparkles, name: 'Funken', category: 'Challenge' },
  compass: { icon: compass, name: 'Kompass', category: 'Challenge' },
  rocket: { icon: rocket, name: 'Rakete', category: 'Challenge' },
  flame: { icon: flame, name: 'Flamme', category: 'Challenge' },

  trophy: { icon: trophy, name: 'Pokal', category: 'Erfolg' },
  medal: { icon: medal, name: 'Medaille', category: 'Erfolg' },
  ribbon: { icon: ribbon, name: 'Band', category: 'Erfolg' },
  star: { icon: star, name: 'Stern', category: 'Erfolg' },
  checkmarkCircle: { icon: checkmarkCircle, name: 'Bestanden', category: 'Erfolg' },
  diamond: { icon: diamond, name: 'Diamant', category: 'Erfolg' },
  shield: { icon: shield, name: 'Schild', category: 'Erfolg' },

  flash: { icon: flash, name: 'Blitz', category: 'Engagement' },
  thumbsUp: { icon: thumbsUp, name: 'Daumen hoch', category: 'Engagement' },
  heart: { icon: heart, name: 'Herz', category: 'Gemeinschaft' },
  people: { icon: people, name: 'Gruppe', category: 'Gemeinschaft' },
  personAdd: { icon: personAdd, name: 'Neue Person', category: 'Gemeinschaft' },
  chatbubbles: { icon: chatbubbles, name: 'Chat', category: 'Gemeinschaft' },
  gift: { icon: gift, name: 'Geschenk', category: 'Gemeinschaft' },

  book: { icon: book, name: 'Buch', category: 'Lernen' },
  school: { icon: school, name: 'Schule', category: 'Lernen' },
  construct: { icon: construct, name: 'Werkzeug', category: 'Lernen' },
  brush: { icon: brush, name: 'Pinsel', category: 'Lernen' },
  colorPalette: { icon: colorPalette, name: 'Farbpalette', category: 'Lernen' },

  sunny: { icon: sunny, name: 'Sonne', category: 'Natur' },
  moon: { icon: moon, name: 'Mond', category: 'Natur' },
  leaf: { icon: leaf, name: 'Blatt', category: 'Natur' },
  rose: { icon: rose, name: 'Rose', category: 'Natur' },

  calendar: { icon: calendar, name: 'Kalender', category: 'Zeit' },
  today: { icon: today, name: 'Heute', category: 'Zeit' },
  time: { icon: time, name: 'Uhr', category: 'Zeit' },
  timer: { icon: timer, name: 'Timer', category: 'Zeit' },
  stopwatch: { icon: stopwatch, name: 'Stoppuhr', category: 'Zeit' },

  restaurant: { icon: restaurant, name: 'Restaurant', category: 'Aktivitäten' },
  fitness: { icon: fitness, name: 'Fitness', category: 'Aktivitäten' },
  bicycle: { icon: bicycle, name: 'Fahrrad', category: 'Aktivitäten' },
  car: { icon: car, name: 'Auto', category: 'Aktivitäten' },
  airplane: { icon: airplane, name: 'Flugzeug', category: 'Aktivitäten' },
  boat: { icon: boat, name: 'Boot', category: 'Aktivitäten' },
  camera: { icon: camera, name: 'Kamera', category: 'Aktivitäten' },
  image: { icon: image, name: 'Bild', category: 'Aktivitäten' },
  musicalNote: { icon: musicalNote, name: 'Musik', category: 'Aktivitäten' },
  balloon: { icon: balloon, name: 'Ballon', category: 'Aktivitäten' },

  home: { icon: home, name: 'Zuhause', category: 'Orte' },
  business: { icon: business, name: 'Gebäude', category: 'Orte' },
  location: { icon: location, name: 'Standort', category: 'Orte' },
  navigate: { icon: navigate, name: 'Navigation', category: 'Orte' },
  pin: { icon: pin, name: 'Pin', category: 'Orte' },

  informationCircle: { icon: informationCircle, name: 'Info', category: 'Sonstiges' },
  helpCircle: { icon: helpCircle, name: 'Hilfe', category: 'Sonstiges' },
  alertCircle: { icon: alertCircle, name: 'Warnung', category: 'Sonstiges' },
  hammer: { icon: hammer, name: 'Hammer', category: 'Sonstiges' }
};

export const getChallengeIcon = (iconName?: string): string =>
  CHALLENGE_ICONS[iconName || '']?.icon || flag;

const CHALLENGE_TYPES: { value: ChallengeType; label: string }[] = [
  { value: 'wahrnehmung', label: 'Wahrnehmung' },
  { value: 'beitrag', label: 'Beitrag' },
  { value: 'praxis', label: 'Praxis' },
  { value: 'frei', label: 'Frei' }
];

const VISIBILITY_OPTIONS: { value: ChallengeVisibility; label: string; hint: string }[] = [
  {
    value: 'public',
    label: 'Öffentlich',
    hint: 'Freigegebene Beiträge sind für alle Konfis der zugewiesenen Jahrgänge sichtbar.'
  },
  {
    value: 'konfi_choice',
    label: 'Konfi entscheidet',
    hint: 'Jeder Konfi wählt beim Einreichen selbst: nur für die Leitung, mit Namen oder anonym.'
  },
  {
    value: 'private',
    label: 'Nicht öffentlich',
    hint: 'Beiträge sehen nur die Leitung und der Konfi selbst — es gibt keine Galerie.'
  }
];

const MEDIA_OPTIONS: { value: ChallengeMediaType; label: string; hint: string }[] = [
  { value: 'text', label: 'Text', hint: 'Geschriebene Beiträge' },
  { value: 'photo', label: 'Foto', hint: 'Aufnahme oder Bild aus der Galerie' },
  { value: 'audio', label: 'Audio', hint: 'Sprachaufnahme oder Musikdatei (Upload)' },
  { value: 'video', label: 'Video', hint: 'Videodatei (Upload)' },
  { value: 'link', label: 'Link', hint: 'Verweis auf eine Seite, ein Lied oder ein Video' }
];

interface Jahrgang {
  id: number;
  name: string;
}

interface OrgUser {
  id: number;
  display_name: string;
  role_name?: string;
}

// Lesbare Rollen-Kennzeichnung im Urheber-Picker (auch Konfis sind waehlbar).
const ROLE_LABELS: Record<string, string> = {
  org_admin: 'Admin',
  admin: 'Admin',
  teamer: 'Teamer',
  konfi: 'Konfi'
};

interface ChallengeManageModalProps {
  challenge?: AdminChallenge | null;
  onClose: () => void;
  onSuccess: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

// Lokale Zeit im Format, das IonDatetime erwartet (ohne Zeitzonen-Versatz).
const toIonDatetimeISO = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
};

const ChallengeManageModal: React.FC<ChallengeManageModalProps> = ({
  challenge,
  onClose,
  onSuccess,
  onDirtyChange
}) => {
  const { setError } = useApp();
  const { isSubmitting, guard } = useActionGuard();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const initializedRef = useRef(false);

  const isEditMode = !!challenge;
  // Nach dem Start sind visibility/moderated/starts_at/allowed_media gesperrt —
  // das Backend antwortet dort mit 409. Entwuerfe und noch nicht gestartete
  // (geplante) Challenges bleiben vollstaendig editierbar.
  // Das Backend liefert `locked` bereits mit — dessen Urteil hat Vorrang, die
  // lokale Ableitung ist nur der Fallback (z.B. bei Offline-Cache ohne Feld).
  const challengeStatus = challenge ? getChallengeStatus(challenge) : null;
  const isStarted = typeof challenge?.locked === 'boolean'
    ? challenge.locked
    : (challengeStatus === 'active' || challengeStatus === 'ended');

  const [jahrgaenge, setJahrgaenge] = useState<Jahrgang[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const [authorMode, setAuthorMode] = useState<'user' | 'freetext'>('user');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    challenge_type: 'frei' as ChallengeType,
    visibility: 'konfi_choice' as ChallengeVisibility,
    moderated: true,
    allowed_media: ['text', 'photo'] as ChallengeMediaType[],
    allow_multiple: true,
    badge_icon: 'flag',
    badge_name: '',
    author_user_id: null as number | null,
    author_freetext: '',
    jahrgang_ids: [] as number[],
    starts_at: '',
    ends_at: ''
  });

  useEffect(() => {
    if (initializedRef.current) setIsDirty(true);
  }, [formData, authorMode]);

  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  useEffect(() => {
    const init = async () => {
      setInitialLoading(true);
      await loadInitialData();
      if (challenge) {
        setFormData({
          title: challenge.title || '',
          description: challenge.description || '',
          challenge_type: (challenge.challenge_type as ChallengeType) || 'frei',
          visibility: (challenge.visibility as ChallengeVisibility) || 'konfi_choice',
          moderated: challenge.moderated !== false,
          allowed_media: (challenge.allowed_media as ChallengeMediaType[]) || ['text', 'photo'],
          allow_multiple: challenge.allow_multiple !== false,
          badge_icon: challenge.badge_icon || 'flag',
          badge_name: challenge.badge_name || '',
          author_user_id: challenge.author_user_id ?? null,
          author_freetext: challenge.author_freetext || '',
          jahrgang_ids: (challenge.jahrgaenge || []).map((j) => j.id),
          starts_at: challenge.starts_at ? toIonDatetimeISO(new Date(challenge.starts_at)) : '',
          ends_at: challenge.ends_at ? toIonDatetimeISO(new Date(challenge.ends_at)) : ''
        });
        setAuthorMode(challenge.author_user_id ? 'user' : (challenge.author_freetext ? 'freetext' : 'user'));
      } else {
        // Neue Challenge: Start morgen, Ende in zwei Wochen — bewusst runde Zeiten.
        const start = new Date();
        start.setDate(start.getDate() + 1);
        start.setHours(9, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 14);
        end.setHours(20, 0, 0, 0);
        setFormData((prev) => ({
          ...prev,
          starts_at: toIonDatetimeISO(start),
          ends_at: toIonDatetimeISO(end)
        }));
      }
      setInitialLoading(false);
      setTimeout(() => { initializedRef.current = true; }, 100);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.id]);

  const loadInitialData = async () => {
    try {
      // /challenges/admin/authors statt /admin/users: liefert (anders als die
      // reine User-Verwaltung) auch Konfis der Org als moegliche Urheber und
      // ist fuer Teamer freigegeben, nicht nur org_admin.
      const [jahrgaengeRes, usersRes] = await Promise.all([
        api.get('/admin/jahrgaenge').catch(() => ({ data: [] })),
        api.get('/challenges/admin/authors').catch(() => ({ data: [] }))
      ]);
      setJahrgaenge(Array.isArray(jahrgaengeRes.data) ? jahrgaengeRes.data : []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch (err) {
      console.error('Fehler beim Laden der Challenge-Stammdaten:', err);
    }
  };

  const toggleMedia = (value: ChallengeMediaType) => {
    if (isStarted || loading) return;
    setFormData((prev) => ({
      ...prev,
      allowed_media: prev.allowed_media.includes(value)
        ? prev.allowed_media.filter((m) => m !== value)
        : [...prev.allowed_media, value]
    }));
  };

  const toggleJahrgang = (id: number) => {
    if (loading) return;
    setFormData((prev) => ({
      ...prev,
      jahrgang_ids: prev.jahrgang_ids.includes(id)
        ? prev.jahrgang_ids.filter((j) => j !== id)
        : [...prev.jahrgang_ids, id]
    }));
  };

  const isFormValid =
    formData.title.trim().length > 0 &&
    formData.description.trim().length > 0 &&
    formData.badge_name.trim().length > 0 &&
    formData.allowed_media.length > 0 &&
    formData.jahrgang_ids.length > 0 &&
    !!formData.starts_at &&
    !!formData.ends_at;

  const buildPayload = (isDraft: boolean) => {
    const payload: Record<string, any> = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      challenge_type: formData.challenge_type,
      allow_multiple: formData.allow_multiple,
      badge_icon: formData.badge_icon,
      badge_name: formData.badge_name.trim(),
      author_user_id: authorMode === 'user' ? formData.author_user_id : null,
      author_freetext: authorMode === 'freetext' ? formData.author_freetext.trim() : null,
      jahrgang_ids: formData.jahrgang_ids,
      ends_at: formData.ends_at,
      is_draft: isDraft
    };

    // Gesperrte Felder nach dem Start GAR NICHT mitsenden. Das Backend vergleicht
    // sie auf Gleichheit — und weil das Formular die Zeitstempel ueber die lokale
    // IonDatetime-Darstellung (ohne Sekunden/Zeitzone) fuehrt, koennte ein
    // unveraendertes starts_at sonst als Aenderung gelten und faelschlich 409 werfen.
    if (!isStarted) {
      payload.visibility = formData.visibility;
      payload.moderated = formData.moderated;
      payload.allowed_media = formData.allowed_media;
      payload.starts_at = formData.starts_at;
    }

    return payload;
  };

  const handleSave = async (isDraft: boolean) => {
    if (!isFormValid) {
      setError('Bitte fülle Titel, Beschreibung, Abzeichen-Name, Medienarten, Jahrgänge und den Zeitraum aus.');
      return;
    }
    if (new Date(formData.ends_at).getTime() <= new Date(formData.starts_at).getTime()) {
      setError('Das Ende muss nach dem Start liegen.');
      return;
    }

    await guard(async () => {
      setLoading(true);
      try {
        const payload = buildPayload(isDraft);
        if (isEditMode && challenge) {
          await api.put(`/challenges/admin/${challenge.id}`, payload);
        } else {
          await api.post('/challenges/admin', payload);
        }
        setIsDirty(false);
        // Dirty-Stand SYNCHRON melden, bevor onSuccess() ueber canDismiss schliesst
        // (sonst blockiert canDismiss das Schliessen -> doppeltes Anlegen).
        onDirtyChange?.(false);
        onSuccess();
      } catch (err: any) {
        // 409 = nach Start gesperrtes Feld geaendert (Backend erzwingt Konsens-Integritaet)
        setError(err.response?.data?.error || 'Fehler beim Speichern der Challenge');
      } finally {
        setLoading(false);
      }
    });
  };

  const filteredUsers = users.filter((u) =>
    !userSearch.trim() || (u.display_name || '').toLowerCase().includes(userSearch.trim().toLowerCase())
  );

  const selectedUser = users.find((u) => u.id === formData.author_user_id);
  const selectedIconMeta = CHALLENGE_ICONS[formData.badge_icon];

  const iconGroups = Object.entries(CHALLENGE_ICONS).reduce<
    { category: string; icons: { key: string; data: { icon: string; name: string; category: string } }[] }[]
  >((acc, [key, data]) => {
    const group = acc.find((g) => g.category === data.category);
    if (group) group.icons.push({ key, data });
    else acc.push({ category: data.category, icons: [{ key, data }] });
    return acc;
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isEditMode ? 'Challenge bearbeiten' : 'Neue Challenge'}</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose} disabled={loading} className="app-modal-close-btn">
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton
              onClick={() => handleSave(false)}
              disabled={loading || isSubmitting || !isFormValid}
              className="app-modal-submit-btn app-modal-submit-btn--challenges"
            >
              {loading ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {initialLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <>
            {/* SEKTION: Die Challenge */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--challenges">
                  <IonIcon icon={flag} />
                </div>
                <IonLabel>Die Challenge</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <IonList>
                    <IonItem lines="inset">
                      <IonLabel position="stacked">Titel *</IonLabel>
                      <IonInput
                        value={formData.title}
                        onIonInput={(e) => setFormData({ ...formData, title: e.detail.value! })}
                        placeholder="Worum geht es?"
                        clearInput={true}
                        disabled={loading}
                        maxlength={200}
                      />
                    </IonItem>

                    <IonItem lines="inset">
                      <IonLabel position="stacked">Beschreibung *</IonLabel>
                      <IonTextarea
                        value={formData.description}
                        onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
                        placeholder="Was sollen die Konfis tun?"
                        rows={5}
                        autoGrow={true}
                        disabled={loading}
                      />
                    </IonItem>
                    <div className="app-info-box app-info-box--challenges" style={{ borderRadius: '10px', marginTop: '8px' }}>
                      Beschreibe auch, was mit den Beiträgen passiert — ob sie im Gottesdienst
                      vorkommen, in der Gruppe gezeigt werden oder nur bei euch bleiben.
                    </div>

                    <IonItem lines="none" style={{ '--background': 'transparent', paddingTop: '16px' }}>
                      <IonLabel style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666' }}>
                        Art der Challenge
                      </IonLabel>
                    </IonItem>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {CHALLENGE_TYPES.map((type) => (
                        <div
                          key={type.value}
                          className={`app-list-item app-list-item--challenges${formData.challenge_type === type.value ? ' app-list-item--selected' : ''}`}
                          onClick={() => !loading && setFormData({ ...formData, challenge_type: type.value })}
                          style={{
                            cursor: loading ? 'default' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '0'
                          }}
                        >
                          <span style={{ fontWeight: '500', color: '#333' }}>{type.label}</span>
                        </div>
                      ))}
                    </div>
                  </IonList>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* SEKTION: Sichtbarkeit */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--challenges">
                  <IonIcon icon={eyeOutline} />
                </div>
                <IonLabel>Sichtbarkeit der Beiträge</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  {isStarted && (
                    <div className="app-info-box app-info-box--neutral" style={{ borderRadius: '10px', marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <IonIcon icon={lockClosedOutline} style={{ fontSize: '1.1rem', marginTop: '2px', flexShrink: 0 }} />
                      <span>
                        Sichtbarkeit, Freigabe-Pflicht, Startzeitpunkt und Medienarten sind nach
                        dem Start gesperrt. Die Konfis haben ihre Beiträge auf diese Zusage hin
                        eingereicht — sie lässt sich nachträglich nicht mehr ändern.
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {VISIBILITY_OPTIONS.map((option) => (
                      <div
                        key={option.value}
                        className={`app-list-item app-list-item--challenges${formData.visibility === option.value ? ' app-list-item--selected' : ''}`}
                        onClick={() => !loading && !isStarted && setFormData({ ...formData, visibility: option.value })}
                        style={{
                          cursor: loading || isStarted ? 'default' : 'pointer',
                          opacity: isStarted && formData.visibility !== option.value ? 0.4 : loading ? 0.6 : 1,
                          marginBottom: '0'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="app-list-item__title">{option.label}</div>
                          <div className="app-list-item__subtitle" style={{ whiteSpace: 'normal' }}>
                            {option.hint}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <IonItem lines="none" style={{ marginTop: '16px' }}>
                    <IonLabel>
                      <h3 style={{ color: '#333', margin: '0 0 4px 0', fontWeight: '600' }}>
                        Beiträge erst nach Freigabe zeigen
                      </h3>
                      <p style={{ color: '#666', margin: '0', fontSize: '0.85rem', whiteSpace: 'normal' }}>
                        Ist das aus, erscheinen Beiträge sofort in der Galerie. Ausblenden geht
                        immer noch nachträglich.
                      </p>
                    </IonLabel>
                    <IonToggle
                      slot="end"
                      checked={formData.moderated}
                      disabled={loading || isStarted}
                      onIonChange={(e) => setFormData({ ...formData, moderated: e.detail.checked })}
                    />
                  </IonItem>

                  <IonItem lines="none">
                    <IonLabel>
                      <h3 style={{ color: '#333', margin: '0 0 4px 0', fontWeight: '600' }}>
                        Mehrere Beiträge erlauben
                      </h3>
                      <p style={{ color: '#666', margin: '0', fontSize: '0.85rem', whiteSpace: 'normal' }}>
                        Konfis können mehr als einen Beitrag zu dieser Challenge einreichen.
                      </p>
                    </IonLabel>
                    <IonToggle
                      slot="end"
                      checked={formData.allow_multiple}
                      disabled={loading}
                      onIonChange={(e) => setFormData({ ...formData, allow_multiple: e.detail.checked })}
                    />
                  </IonItem>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* SEKTION: Medienarten */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--challenges">
                  <IonIcon icon={imagesOutline} />
                </div>
                <IonLabel>Erlaubte Medienarten</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <IonItem lines="none" style={{ '--background': 'transparent', paddingBottom: '8px' }}>
                    <IonLabel style={{ fontSize: '0.9rem', fontWeight: '500', color: formData.allowed_media.length === 0 ? '#dc3545' : '#666' }}>
                      Mehrere möglich *
                      {formData.allowed_media.length > 0 && (
                        <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: 'var(--app-color-challenges)', fontWeight: 'normal' }}>
                          ({formData.allowed_media.length} ausgewählt)
                        </span>
                      )}
                    </IonLabel>
                  </IonItem>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {MEDIA_OPTIONS.map((option) => {
                      const isSelected = formData.allowed_media.includes(option.value);
                      return (
                        <div
                          key={option.value}
                          className={`app-list-item app-list-item--challenges${isSelected ? ' app-list-item--selected' : ''}`}
                          onClick={() => toggleMedia(option.value)}
                          style={{
                            cursor: loading || isStarted ? 'default' : 'pointer',
                            opacity: isStarted && !isSelected ? 0.4 : loading ? 0.6 : 1,
                            marginBottom: '0'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="app-list-item__title">{option.label}</div>
                            <div className="app-list-item__subtitle" style={{ whiteSpace: 'normal' }}>
                              {option.hint}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* SEKTION: Abzeichen */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--challenges">
                  <IonIcon icon={ribbonOutline} />
                </div>
                <IonLabel>Abzeichen</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <IonList>
                    <IonItem lines="inset">
                      <IonLabel position="stacked">Name des Abzeichens *</IonLabel>
                      <IonInput
                        value={formData.badge_name}
                        onIonInput={(e) => setFormData({ ...formData, badge_name: e.detail.value! })}
                        placeholder="z.B. Hingeschaut"
                        clearInput={true}
                        disabled={loading}
                        maxlength={100}
                      />
                    </IonItem>
                  </IonList>

                  <div style={{ marginTop: '16px' }}>
                    <IonAccordionGroup>
                      <IonAccordion value="icon-picker" toggleIcon={chevronDownOutline} toggleIconSlot="end">
                        <IonItem slot="header" lines="none">
                          <IonLabel>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666', margin: '0 0 4px 0' }}>
                              Icon *
                            </h3>
                            {selectedIconMeta && (
                              <p style={{ fontSize: '0.85rem', color: '#333', margin: '0', fontWeight: '500' }}>
                                {selectedIconMeta.name} ({selectedIconMeta.category})
                              </p>
                            )}
                          </IonLabel>
                        </IonItem>
                        <div slot="content" style={{ padding: '16px' }}>
                          {iconGroups.map((group) => (
                            <div key={group.category} style={{ marginBottom: '16px' }}>
                              <IonText style={{ fontSize: '0.85rem', fontWeight: '600', color: '#666', marginBottom: '8px', display: 'block' }}>
                                {group.category}
                              </IonText>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: '8px' }}>
                                {group.icons.map(({ key, data }) => (
                                  <div
                                    key={key}
                                    onClick={() => !loading && setFormData({ ...formData, badge_icon: key })}
                                    style={{
                                      width: '100%',
                                      aspectRatio: '1',
                                      backgroundColor: formData.badge_icon === key ? 'var(--app-color-challenges)' : '#f8f9fa',
                                      borderRadius: '12px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      border: '1px solid #e0e0e0',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    <IonIcon
                                      icon={data.icon}
                                      style={{
                                        fontSize: '1.5rem',
                                        color: formData.badge_icon === key ? 'white' : '#666'
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </IonAccordion>
                    </IonAccordionGroup>
                  </div>

                  <div className="app-info-box app-info-box--neutral" style={{ borderRadius: '10px', marginTop: '12px' }}>
                    Das Abzeichen bekommt jeder Konfi, der mindestens einen Beitrag einreicht.
                    Es wird bewusst nicht gezählt und fließt in keine Punkte oder Ranglisten ein.
                  </div>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* SEKTION: Urheber */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--challenges">
                  <IonIcon icon={personOutline} />
                </div>
                <IonLabel>Wer stellt die Challenge?</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <IonItem lines="none">
                    <IonLabel>
                      <h3 style={{ color: '#333', margin: '0 0 4px 0', fontWeight: '600' }}>
                        {authorMode === 'user' ? 'Aus Benutzerliste' : 'Freitext'}
                      </h3>
                      <p style={{ color: '#666', margin: '0', fontSize: '0.85rem', whiteSpace: 'normal' }}>
                        {authorMode === 'user'
                          ? 'Eine Person aus deiner Organisation als Urheber:in eintragen.'
                          : 'Freien Namen eintragen, z.B. eine Gruppe oder eine Gemeinde.'}
                      </p>
                    </IonLabel>
                    <IonToggle
                      slot="end"
                      checked={authorMode === 'user'}
                      disabled={loading}
                      onIonChange={(e) => setAuthorMode(e.detail.checked ? 'user' : 'freetext')}
                    />
                  </IonItem>

                  {authorMode === 'freetext' ? (
                    <IonItem lines="none">
                      <IonLabel position="stacked">Name</IonLabel>
                      <IonInput
                        value={formData.author_freetext}
                        onIonInput={(e) => setFormData({ ...formData, author_freetext: e.detail.value! })}
                        placeholder="z.B. Konfi-Team Hennstedt"
                        clearInput={true}
                        disabled={loading}
                        maxlength={200}
                      />
                    </IonItem>
                  ) : (
                    <div style={{ marginTop: '8px' }}>
                      <IonAccordionGroup>
                        <IonAccordion value="user-picker" toggleIcon={chevronDownOutline} toggleIconSlot="end">
                          <IonItem slot="header" lines="none">
                            <IonLabel>
                              <h3 style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666', margin: '0 0 4px 0' }}>
                                Person auswählen
                              </h3>
                              <p style={{ fontSize: '0.85rem', color: '#333', margin: '0', fontWeight: '500' }}>
                                {selectedUser ? selectedUser.display_name : 'Keine Auswahl'}
                              </p>
                            </IonLabel>
                          </IonItem>
                          <div slot="content" style={{ padding: '8px 0' }}>
                            <IonSearchbar
                              value={userSearch}
                              onIonInput={(e) => setUserSearch(e.detail.value || '')}
                              placeholder="Name suchen"
                              style={{ paddingLeft: 0, paddingRight: 0 }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {filteredUsers.map((orgUser) => {
                                const isSelected = formData.author_user_id === orgUser.id;
                                return (
                                  <div
                                    key={orgUser.id}
                                    className={`app-list-item app-list-item--challenges${isSelected ? ' app-list-item--selected' : ''}`}
                                    onClick={() => !loading && setFormData({ ...formData, author_user_id: isSelected ? null : orgUser.id })}
                                    style={{ cursor: loading ? 'default' : 'pointer', marginBottom: '0' }}
                                  >
                                    <span style={{ fontWeight: '500', color: '#333' }}>{orgUser.display_name}</span>
                                    {orgUser.role_name && (
                                      <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#999' }}>
                                        ({ROLE_LABELS[orgUser.role_name] || orgUser.role_name})
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              {filteredUsers.length === 0 && (
                                <div style={{ padding: '8px', color: '#999', fontSize: '0.85rem' }}>
                                  Keine Person gefunden
                                </div>
                              )}
                            </div>
                          </div>
                        </IonAccordion>
                      </IonAccordionGroup>
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* SEKTION: Jahrgaenge */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--challenges">
                  <IonIcon icon={peopleOutline} />
                </div>
                <IonLabel>Zielgruppe</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <IonItem lines="none" style={{ '--background': 'transparent', paddingBottom: '8px' }}>
                    <IonLabel style={{ fontSize: '0.9rem', fontWeight: '500', color: formData.jahrgang_ids.length === 0 ? '#dc3545' : '#666' }}>
                      Jahrgänge (mehrere möglich) *
                      {formData.jahrgang_ids.length > 0 && (
                        <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: 'var(--app-color-jahrgang)', fontWeight: 'normal' }}>
                          ({formData.jahrgang_ids.length} ausgewählt)
                        </span>
                      )}
                    </IonLabel>
                  </IonItem>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {jahrgaenge.map((jahrgang) => {
                      const isSelected = formData.jahrgang_ids.includes(jahrgang.id);
                      return (
                        <div
                          key={jahrgang.id}
                          className={`app-list-item app-list-item--jahrgang${isSelected ? ' app-list-item--selected' : ''}`}
                          onClick={() => toggleJahrgang(jahrgang.id)}
                          style={{
                            cursor: loading ? 'default' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '0'
                          }}
                        >
                          <span style={{ fontWeight: '500', color: '#333' }}>{jahrgang.name}</span>
                        </div>
                      );
                    })}
                    {jahrgaenge.length === 0 && (
                      <div style={{ padding: '8px', color: '#999', fontSize: '0.85rem' }}>
                        Keine Jahrgänge verfügbar
                      </div>
                    )}
                  </div>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* SEKTION: Zeitraum */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--challenges">
                  <IonIcon icon={calendarOutline} />
                </div>
                <IonLabel>Zeitraum</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <IonList>
                    <IonItem lines="inset">
                      <IonLabel>Start{isStarted ? ' (gesperrt)' : ' *'}</IonLabel>
                      <IonDatetimeButton datetime="challenge-start-picker" disabled={loading || isStarted} slot="end" />
                    </IonItem>
                    <IonItem lines="none">
                      <IonLabel>Ende *</IonLabel>
                      <IonDatetimeButton datetime="challenge-end-picker" disabled={loading} slot="end" />
                    </IonItem>
                  </IonList>
                  {isStarted && (
                    <div className="app-info-box app-info-box--neutral" style={{ borderRadius: '10px', marginTop: '8px' }}>
                      Der Start liegt bereits in der Vergangenheit und lässt sich nicht mehr
                      verschieben. Das Ende kannst du weiterhin anpassen.
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* Entwurf/Planen */}
            <div className="app-segment-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '8px' }}>
              {(!isEditMode || challenge?.is_draft) && (
                <IonButton
                  expand="block"
                  fill="outline"
                  disabled={loading || isSubmitting || !isFormValid}
                  onClick={() => handleSave(true)}
                  className="app-action-button"
                  style={{ '--color': 'var(--app-color-challenges)', '--border-color': 'var(--app-color-challenges)' }}
                >
                  Als Entwurf speichern
                </IonButton>
              )}
              <IonButton
                expand="block"
                disabled={loading || isSubmitting || !isFormValid}
                onClick={() => handleSave(false)}
                className="app-action-button app-modal-submit-btn app-modal-submit-btn--challenges"
              >
                <IonIcon icon={checkmarkOutline} slot="start" />
                {isEditMode && !challenge?.is_draft ? 'Änderungen speichern' : 'Planen'}
              </IonButton>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '0 4px', color: '#666', fontSize: '0.8rem' }}>
                <IonIcon icon={informationCircleOutline} style={{ fontSize: '1rem', marginTop: '2px', flexShrink: 0 }} />
                <span>
                  Entwürfe sehen nur du und dein Team. Geplante Challenges starten automatisch
                  zum eingestellten Zeitpunkt — dann bekommen die Konfis eine Benachrichtigung.
                </span>
              </div>
            </div>

            <div className="ion-padding-bottom" />
          </>
        )}
      </IonContent>

      {/* DateTime-Modals — wie im Event-Modal direkt unter IonPage, nicht im Content */}
      <IonModal keepContentsMounted={true}>
        <IonDatetime
          id="challenge-start-picker"
          value={formData.starts_at}
          presentation="date-time"
          minuteValues="0,15,30,45"
          firstDayOfWeek={1}
          onIonChange={(e) => setFormData({ ...formData, starts_at: e.detail.value as string })}
          style={{ '--background': '#f8f9fa', '--border-radius': '12px', '--box-shadow': '0 4px 16px rgba(0,0,0,0.1)' }}
        />
      </IonModal>
      <IonModal keepContentsMounted={true}>
        <IonDatetime
          id="challenge-end-picker"
          value={formData.ends_at}
          presentation="date-time"
          minuteValues="0,15,30,45"
          firstDayOfWeek={1}
          onIonChange={(e) => setFormData({ ...formData, ends_at: e.detail.value as string })}
          style={{ '--background': '#f8f9fa', '--border-radius': '12px', '--box-shadow': '0 4px 16px rgba(0,0,0,0.1)' }}
        />
      </IonModal>
    </IonPage>
  );
};

export default ChallengeManageModal;
