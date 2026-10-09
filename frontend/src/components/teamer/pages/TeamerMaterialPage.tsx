import {
  ICON_ANHANG,
  ICON_BEARBEITEN_GEFUELLT,
  ICON_BILD,
  ICON_DATEI,
  ICON_DATEI_GEFUELLT,
  ICON_EXTERN_OEFFNEN,
  ICON_FILTER,
  ICON_GRUPPE_GEFUELLT,
  ICON_INFO_GEFUELLT,
  ICON_LINK,
  ICON_MUSIK,
  ICON_PERSON_GEFUELLT,
  ICON_SUCHE_GEFUELLT,
  ICON_TERMIN,
  ICON_TERMIN_GEFUELLT,
  ICON_TEXT,
  ICON_VIDEO,
  ICON_WELT,
} from '../../shared/icons';
import AppKopfzeile, { AppKopfzeileGross } from '../../shared/AppKopfzeile';
import React, { useState, useMemo } from 'react';
import {
  IonPage,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonIcon,
  IonLabel,
  IonList,
  IonListHeader,
  IonCard,
  IonCardContent,
  IonItem,
  IonItemGroup,
  IonInput,
  IonSelect,
  IonSelectOption
} from '@ionic/react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../../contexts/AppContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import { useSucheMessung } from '../../../hooks/useSucheMessung';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { useDateiOeffnen } from '../../../hooks/useDateiOeffnen';
import { CACHE_TTL } from '../../../services/offlineCache';
import { materialDetailLaden } from '../../../services/materialDetail';
import { SectionHeader } from '../../shared';
import EmptyState from '../../shared/EmptyState';
import LadeStandZeile from '../../shared/LadeStandZeile';
import LoadingSpinner from '../../common/LoadingSpinner';
import { haptik, triggerPullHaptic, ImpactStyle } from '../../../utils/haptics';
import { useModalPage } from '../../../contexts/ModalContext';
import { istWebLink, hostAus, materialLinks } from '../../../utils/linkDisplay';
import { materialStats } from '../../../utils/materialStats';
import { tastaturKlick } from '../../../utils/tastatur';
import { datumKurz } from '../../../utils/dateUtils';
import { materialInhalt, trackHandlung } from '../../../services/analytics';
import { linkOeffnen } from '../../../services/systemDialoge';
import { useBreitesLayout } from '../../../navigation/breitesLayout';
import WebTeamerMaterial from '../web/material/WebTeamerMaterial';import { suchbegriff } from '../../../utils/supportWeb';
import { MATERIAL_ALLE_JAHRGAENGE, MATERIAL_TEAM_TITEL, MATERIAL_TEAM_UNTERTITEL, materialPasst, materialTeamLeer } from '../../../seiten/materialTeam';


interface Material {
  id: number;
  title: string;
  description?: string;
  events?: { id: number; name: string }[];
  event_count?: number;
  // Die Jahrgangs-Zuordnung liefert GET /material als Array (material.js:177).
  jahrgaenge?: { id: number; name: string }[];
  jahrgang_name?: string;
  file_count?: number;
  link_url?: string | null;
  // Material fuer alle Teamer:innen (seit 31.08.2026). Gecachte Eintraege von
  // vorher liefern das Feld nicht -- dann gilt "nicht global", nie ein Fehler.
  ist_global?: boolean;
  created_at: string;
}

interface MaterialFile {
  id: number;
  original_name: string;
  stored_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

interface MaterialDetail {
  id: number;
  title: string;
  description?: string;
  events?: { id: number; name: string }[];
  jahrgaenge?: { id: number; name: string }[];
  jahrgang_name?: string;
  admin_name?: string;
  files?: MaterialFile[];
  link_url?: string | null;
  // Mehrere Links (seit 01.09.2026). link_url bleibt als Alt-Feld der
  // Spiegel des ersten Links -- materialLinks() faellt darauf zurueck.
  links?: { id: number; url: string }[];
  ist_global?: boolean;
  created_at: string;
}

const TeamerMaterialPage: React.FC = () => {
  const { user, setError } = useApp();
  useModalPage('teamer-material');
  // Im Browser ab 992 px Tabellen mit dem Material daneben
  // (web/material/WebTeamerMaterial.tsx); Daten, Filter, Auswahl und das Oeffnen
  // von Dateien und Links dieser Seite bleiben dieselben.
  const breit = useBreitesLayout();

  // Die Seite haengt an ZWEI Routen: '/teamer/profile/material' ist seit dem
  // 04.09.2026 ein eigener Tab, '/teamer/material' die Altroute (Deep-Links
  // und ausgelieferte App-Versionen -- im Repo navigiert niemand mehr dahin).
  // Im Tab ist ein Zurueck-Weg sinnlos: window.history.back() springt aus dem
  // Reiter heraus, irgendwohin (Simon, 05.09.2026). Auf der Altroute bleibt
  // der Knopf, sonst sitzt man dort fest.
  const pfad = useLocation().pathname;
  const istEigenerTab = pfad.startsWith('/teamer/profile/material');

  const [search, setSearch] = useState('');
  // Anonyme Messung (docs/messung/umami.md, S15): wird gesucht? Nie der Begriff.
  useSucheMessung('material', search);
  const [activeJahrgangId, setActiveJahrgangId] = useState<number | undefined>();
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Offline-Query: Jahrgänge
  const { data: jahrgaengeData, refresh: refreshJahrgaenge } = useOfflineQuery<{ id: number; name: string }[]>(
    'teamer:jahrgaenge:' + user?.organization_id,
    async () => { const res = await api.get('/admin/jahrgaenge'); return res.data; },
    { ttl: CACHE_TTL.STAMMDATEN }
  );
  const jahrgaenge = jahrgaengeData || [];

  // Offline-Query: Material (alle Materialien, clientseitig gefiltert)
  const { data: allMaterials, loading, refresh: refreshMaterial, refreshLive: refreshMaterialLive } = useOfflineQuery<Material[]>(
    'teamer:material:' + user?.organization_id,
    async () => { const res = await api.get('/material'); return res.data; },
    { ttl: CACHE_TTL.PROFILE }
  );

  // Material-Liste live halten: neue oder geloeschte Materialien erschienen
  // vorher erst beim nächsten Oeffnen (Audit 22.08.2026).
  useLiveRefresh('materials', refreshMaterialLive);

  // Clientseitiges Filtern nach Suche und Jahrgang
  const materials = useMemo(() => {
    // Die Zuordnung kommt als Array `jahrgaenge` an jedem Eintrag
    // (material.js:177; die Legacy-Spalte jahrgang_id liefert GET /material
    // nicht). Suche und Jahrgang aus der gemeinsamen Beschreibung
    // (seiten/materialTeam.ts) -- dieselbe Liste in App und Browser.
    return (allMaterials || []).filter((m) => materialPasst(m, search, activeJahrgangId));
  }, [allMaterials, search, activeJahrgangId]);

  // MATERIAL FUER ALLE (Entscheidung Simon, 31.08.2026)
  //
  // Bekommt einen eigenen Abschnitt ganz oben, damit erkennbar ist, was
  // absichtlich fuer das ganze Team gedacht ist. Gecachte Eintraege von vor
  // der Umstellung liefern das Feld nicht -- die landen im unteren
  // Abschnitt, nie in einem Fehler.
  // Grenzen Suche oder Jahrgang die Liste ein? Dann sagt der Leerzustand das.
  const eingegrenzt = suchbegriff(search) !== '' || activeJahrgangId !== undefined;

  const globaleMaterials = useMemo(
    () => materials.filter(m => m.ist_global === true),
    [materials]
  );
  const uebrigeMaterials = useMemo(
    () => materials.filter(m => m.ist_global !== true),
    [materials]
  );

  // Dateien über den gemeinsamen Weg von Chat und Challenges (27.09.2026,
  // Simon: „Fotos Anträge und Material ja bitte."): Medien-Cache (zweites
  // Öffnen ohne Download, auch ohne Netz), Fortschritt in der Zeile, nativ
  // mit Teilen und Sichern, sonst der Betrachter mit den übrigen Dateien des
  // Materials zum Wischen (vorher: nur die eine Datei).
  const { dateiOeffnen, ladendeDatei } = useDateiOeffnen({
    quelle: 'material',
    kontext: () => (selectedMaterial?.files || []).map((f) => ({ pfad: f.stored_name, name: f.original_name, typ: f.mime_type })),
    fehlerOrt: 'material-teamer-liste',
  });

  // Detail öffnen und inline anzeigen. Erst der Server, den zuletzt
  // geladenen Stand nur ohne Netz (materialDetailLaden, 27.09.2026) — so
  // öffnet sich ein Material auch offline samt Dateien vom Gerät, und was die
  // Leitung inzwischen gelöscht hat, geht vom Gerät. Vorher: ohne Netz nur
  // "Fehler beim Laden des Materials".
  const openDetail = async (matId: number) => {
    try {
      setDetailLoading(true);
      const { daten, ausSpeicher } = await materialDetailLaden<MaterialDetail>(matId);
      setSelectedMaterial(daten);
      // Anonyme Messung NACH der erfolgreichen Antwort des Servers: das
      // Material ist angesehen (Simon, 27.09.2026). Ein Stand nur vom Gerät
      // (ohne Netz) zaehlt nicht. Einmal je Oeffnen — das Aktualisieren im
      // Detail laedt ueber einen eigenen Aufruf und meldet nicht. Nur die Art
      // des Inhalts, kein Titel, keine Kennung.
      if (!ausSpeicher) {
        trackHandlung('material-angesehen', {
          inhalt: materialInhalt((daten?.files?.length ?? 0) > 0, materialLinks(daten ?? {}).length > 0)
        });
      }
    } catch {
      setError('Fehler beim Laden des Materials');
    } finally {
      setDetailLoading(false);
    }
  };


  const formatDateLong = (dateString: string) => {
    return datumKurz(dateString);
  };

  // File-Handling Funktionen
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return ICON_BILD;
    if (mimeType.startsWith('video/')) return ICON_VIDEO;
    if (mimeType.startsWith('audio/')) return ICON_MUSIK;
    return ICON_DATEI;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Der Typ kommt vom Server (mime_type): Beim Treffer im Cache gibt es keine
  // Antwort, deren Kopf ihn nennen könnte.
  const openFile = async (file: MaterialFile) => {
    // Anonyme Messung NACH dem erfolgreichen Laden (auch aus dem Cache): eine
    // Datei ist abgerufen. Kein Dateiname, kein Dateityp.
    if (await dateiOeffnen(file.stored_name, file.original_name, file.mime_type)) {
      trackHandlung('material-abgerufen', { inhalt: 'datei' });
    }
  };

  // Links oeffnen extern im Browser — derselbe Weg wie bei Kartenlinks und
  // Links in Chatnachrichten (window.open mit _blank). istWebLink haelt alles
  // ab, was kein http/https ist; der Server laesst zwar ohnehin nichts anderes
  // durch, aber der Waechter steht dort, wo das href entsteht.
  const openLink = async (url: string) => {
    if (!istWebLink(url)) {
      setError('Der Link konnte nicht geöffnet werden');
      return;
    }
    await haptik(ImpactStyle.Medium);
    linkOeffnen(url);
    // Anonyme Messung: ein Link ist abgerufen — ohne seine Adresse.
    trackHandlung('material-abgerufen', { inhalt: 'link' });
  };

  // === INLINE DETAIL VIEW ===
  // Detail-Ansicht als render-Funktion (statt früher early-return), damit sie
  // im iPad-Split-View NEBEN der Liste gerendert werden kann.
  const renderDetail = (hideBackButton?: boolean) => {
    if (!selectedMaterial) return null;
    return (
      <IonPage>
        <AppKopfzeile
          titel={selectedMaterial.title}
          onZurueck={hideBackButton ? undefined : () => setSelectedMaterial(null)}
          gemeindeUmschalter={false}
        />

        <IonContent className="app-gradient-background" fullscreen>
          <AppKopfzeileGross titel={selectedMaterial.title} />

          <IonRefresher slot="fixed" onIonRefresh={async (e) => {
            try {
              const { daten } = await materialDetailLaden<MaterialDetail>(selectedMaterial.id);
              setSelectedMaterial(daten);
            } catch { /* ignore */ }
            e.detail.complete();
          }} onIonPull={triggerPullHaptic}>
            <IonRefresherContent />
          </IonRefresher>

          {/* SectionHeader */}
          <SectionHeader
            title={selectedMaterial.title}
            subtitle="Material"
            icon={ICON_DATEI_GEFUELLT}
            colors={{ primary: 'var(--app-color-material)', secondary: 'var(--app-color-material-dunkel)' }}
            stats={[{ value: selectedMaterial.files?.length || 0, label: 'Dateien' }]}
          />

          {/* Beschreibung */}
          {selectedMaterial.description && (
            <IonList inset={true} className="app-segment-wrapper">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--material">
                  <IonIcon icon={ICON_TEXT} />
                </div>
                <IonLabel>Beschreibung</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <p className="app-description-text" style={{ whiteSpace: 'pre-wrap' }}>
                    {selectedMaterial.description}
                  </p>
                </IonCardContent>
              </IonCard>
            </IonList>
          )}

          {/* Details */}
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--material">
                <IonIcon icon={ICON_INFO_GEFUELLT} />
              </div>
              <IonLabel>Details</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent className="app-card-content">
                {selectedMaterial.ist_global && (
                  <div className="app-info-row">
                    <IonIcon icon={ICON_WELT} className="app-info-row__icon" style={{ color: 'var(--app-text-material)' }} />
                    <div>
                      <div className="app-info-row__label">Sichtbar für</div>
                      <div className="app-info-row__value">Das ganze Team der Gemeinde</div>
                    </div>
                  </div>
                )}
                {selectedMaterial.events && selectedMaterial.events.length > 0 && (
                  <div className="app-info-row">
                    <IonIcon icon={ICON_TERMIN_GEFUELLT} className="app-info-row__icon" style={{ color: 'var(--app-text-events)' }} />
                    <div>
                      <div className="app-info-row__label">
                        {selectedMaterial.events.length === 1 ? 'Event' : 'Events'}
                      </div>
                      <div className="app-info-row__value">
                        {selectedMaterial.events.map(e => e.name).join(', ')}
                      </div>
                    </div>
                  </div>
                )}
                {selectedMaterial.jahrgaenge && selectedMaterial.jahrgaenge.length > 0 && (
                  <div className="app-info-row">
                    <IonIcon icon={ICON_GRUPPE_GEFUELLT} className="app-info-row__icon" style={{ color: 'var(--app-text-konfis)' }} />
                    <div>
                      <div className="app-info-row__label">
                        {selectedMaterial.jahrgaenge.length === 1 ? 'Jahrgang' : 'Jahrgänge'}
                      </div>
                      <div className="app-info-row__value">
                        {selectedMaterial.jahrgaenge.map(j => j.name).join(', ')}
                      </div>
                    </div>
                  </div>
                )}
                <div className="app-info-row">
                  <IonIcon icon={ICON_BEARBEITEN_GEFUELLT} className="app-info-row__icon" style={{ color: 'var(--app-color-neutral)' }} />
                  <div>
                    <div className="app-info-row__label">Erstellt am</div>
                    <div className="app-info-row__value">{formatDateLong(selectedMaterial.created_at)}</div>
                  </div>
                </div>
                {selectedMaterial.admin_name && (
                  <div className="app-info-row">
                    <IonIcon icon={ICON_PERSON_GEFUELLT} className="app-info-row__icon" style={{ color: 'var(--app-color-neutral)' }} />
                    <div>
                      <div className="app-info-row__label">Erstellt von</div>
                      <div className="app-info-row__value">{selectedMaterial.admin_name}</div>
                    </div>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>

          {/* Links (Entscheidung Simon, 01.09.2026): Material traegt
              beliebig viele Links UND Dateien parallel. Eigenes Icon, damit
              sie sich vom Dateianhang unterscheiden; sie oeffnen extern im
              Browser. istWebLink filtert in materialLinks(). */}
          {materialLinks(selectedMaterial).length > 0 && (
            <IonList inset={true} className="app-segment-wrapper">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--material">
                  <IonIcon icon={ICON_LINK} />
                </div>
                <IonLabel>{materialLinks(selectedMaterial).length === 1 ? 'Link' : 'Links'}</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                    {materialLinks(selectedMaterial).map((url) => (
                      <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                        key={url}
                        className="app-list-item"
                        style={{ borderLeftColor: 'var(--app-color-material)', cursor: 'pointer' }}
                        onClick={() => openLink(url)}
                      >
                        <div className="app-list-item__row">
                          <div className="app-list-item__main">
                            <div className="app-icon-circle" style={{ backgroundColor: 'var(--app-color-material)' }}>
                              <IonIcon icon={ICON_LINK} />
                            </div>
                            <div className="app-list-item__content">
                              <div className="app-list-item__title">{hostAus(url)}</div>
                              <div className="app-list-item__meta">
                                <span className="app-list-item__meta-item">
                                  <IonIcon icon={ICON_EXTERN_OEFFNEN} style={{ color: 'var(--app-text-material)' }} />
                                  Im Browser öffnen
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </IonCardContent>
              </IonCard>
            </IonList>
          )}

          {/* Dateien */}
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--material">
                <IonIcon icon={ICON_DATEI_GEFUELLT} />
              </div>
              <IonLabel>Dateien ({selectedMaterial.files?.length || 0})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                {(!selectedMaterial.files || selectedMaterial.files.length === 0) ? (
                  <EmptyState
                    icon={ICON_DATEI}
                    title="Keine Dateien"
                    message="Dieses Material hat keine angehängten Dateien."
                    iconColor="var(--app-color-material)"
                  />
                ) : (
                  selectedMaterial.files.map((file, index) => (
                    <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                      key={file.id}
                      className="app-list-item"
                      style={{
                        borderLeftColor: 'var(--app-color-material)',
                        cursor: 'pointer',
                        marginBottom: index < (selectedMaterial.files?.length || 0) - 1 ? 'var(--app-abstand-eng)' : '0'
                      }}
                      onClick={() => openFile(file)}
                    >
                      <div className="app-list-item__row">
                        <div className="app-list-item__main">
                          <div className="app-icon-circle" style={{ backgroundColor: 'var(--app-color-material)' }}>
                            <IonIcon icon={getFileIcon(file.mime_type)} />
                          </div>
                          <div className="app-list-item__content">
                            <div className="app-list-item__title">{file.original_name}</div>
                            <LadeStandZeile
                              laedt={ladendeDatei?.pfad === file.stored_name}
                              prozent={ladendeDatei?.prozent ?? null}
                              sonst={formatFileSize(file.file_size)}
                              farbe="var(--app-text-material)"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </IonCardContent>
            </IonCard>
          </IonList>

          <div className="ion-padding-bottom" />
        </IonContent>
      </IonPage>
    );
  };

  // === MATERIAL LIST VIEW ===
  // Ein Listeneintrag. Steht seit der Aufteilung in "Für alle" und die
  // uebrigen Materialien (31.08.2026) an einer Stelle, damit beide
  // Abschnitte gleich aussehen.
  const renderEintrag = (mat: Material, index: number, anzahl: number) => (
    <IonItem
      key={mat.id}
      button
      onClick={() => openDetail(mat.id)}
      detail={false}
      lines="none"
      style={{
        '--background': 'transparent',
        '--padding-start': '0',
        '--padding-end': '0',
        '--inner-padding-end': '0',
        '--inner-border-width': '0',
        '--border-style': 'none',
        '--min-height': 'auto',
        marginBottom: index < anzahl - 1 ? 'var(--app-abstand-eng)' : '0'
      }}
    >
      <div
        className="app-list-item"
        style={{
          width: '100%',
          borderLeftColor: 'var(--app-color-material)'
        }}
      >
        <div className="app-list-item__row">
          <div className="app-list-item__main">
            <div className="app-icon-circle" style={{ backgroundColor: 'var(--app-color-material)' }}>
              <IonIcon icon={mat.link_url ? ICON_LINK : ICON_DATEI_GEFUELLT} />
            </div>
            <div className="app-list-item__content">
              <div className="app-list-item__title">
                {mat.title}
              </div>
              {mat.description && (
                <div className="app-list-item__subtitle" style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {mat.description}
                </div>
              )}
              <div className="app-list-item__meta">
                {mat.ist_global && (
                  <span className="app-list-item__meta-item">
                    <IonIcon icon={ICON_WELT} style={{ color: 'var(--app-text-material)' }} />
                    Für alle
                  </span>
                )}
                {mat.link_url && (
                  <span className="app-list-item__meta-item">
                    <IonIcon icon={ICON_LINK} style={{ color: 'var(--app-text-material)' }} />
                    Link
                  </span>
                )}
                {mat.file_count !== undefined && mat.file_count > 0 && (
                  <span className="app-list-item__meta-item">
                    <IonIcon icon={ICON_ANHANG} style={{ color: 'var(--app-text-material)' }} />
                    {mat.file_count} {mat.file_count === 1 ? 'Datei' : 'Dateien'}
                  </span>
                )}
                {(mat.event_count || 0) > 0 && (
                  <span className="app-list-item__meta-item">
                    <IonIcon icon={ICON_TERMIN_GEFUELLT} style={{ color: 'var(--app-text-events)' }} />
                    {mat.event_count} {mat.event_count === 1 ? 'Event' : 'Events'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </IonItem>
  );

  const renderList = () => (
    <IonPage>
      {/* Zurueck nur, wenn Material NICHT als eigener Reiter laeuft --
          dann kam man von der Startseite hierher. */}
      <AppKopfzeile titel={MATERIAL_TEAM_TITEL} onZurueck={istEigenerTab ? undefined : () => window.history.back()} />

      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel={MATERIAL_TEAM_TITEL} />

        <IonRefresher slot="fixed" onIonRefresh={async (e) => {
          await Promise.all([refreshMaterial(), refreshJahrgaenge()]);
          e.detail.complete();
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        {loading || detailLoading ? (
          <LoadingSpinner message={detailLoading ? 'Material wird geladen...' : 'Materialien werden geladen...'} />
        ) : (
          <>
            <SectionHeader
              title={MATERIAL_TEAM_TITEL}
              subtitle={MATERIAL_TEAM_UNTERTITEL}
              icon={ICON_DATEI_GEFUELLT}
              colors={{ primary: 'var(--app-color-material)', secondary: 'var(--app-color-material-dunkel)' }}
              stats={(() => {
                // Dritte Kachel "Links" wie auf der Leitungsseite (Simons
                // Wunsch 01.09.2026) -- beide Rollen sehen dieselben Zahlen.
                const s = materialStats(materials);
                return [
                  { value: s.material, label: 'Material' },
                  { value: s.dateien, label: 'Dateien' },
                  { value: s.links, label: 'Links' }
                ];
              })()}
            />

            {/* Suche & Filter */}
            <IonList inset={true} style={{ margin: 'var(--app-abstand-basis)' }}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--material">
                  <IonIcon icon={ICON_FILTER} />
                </div>
                <IonLabel>Suche & Filter</IonLabel>
              </IonListHeader>
              <IonItemGroup>
                <IonItem>
                  <IonIcon icon={ICON_SUCHE_GEFUELLT} slot="start" style={{ color: 'var(--app-text-system)', fontSize: 'var(--app-text-standard)' }} />
                  <IonInput aria-label="Material durchsuchen"
                    value={search}
                    onIonInput={(e) => setSearch(e.detail.value || '')}
                    placeholder="Material durchsuchen..."
                    debounce={300}
                  />
                </IonItem>
                {jahrgaenge.length > 0 && (
                  <IonItem>
                    <IonIcon icon={ICON_TERMIN} slot="start" style={{ color: 'var(--app-text-system)', fontSize: 'var(--app-text-standard)' }} />
                    <IonSelect aria-label="Jahrgang"
                      value={activeJahrgangId ?? 'alle'}
                      onIonChange={(e) => setActiveJahrgangId(e.detail.value === 'alle' ? undefined : e.detail.value)}
                      interface="popover"
                      interfaceOptions={{ arrow: false }}
                      placeholder="Jahrgang"
                      style={{ width: '100%' }}
                    >
                      <IonSelectOption value="alle">{MATERIAL_ALLE_JAHRGAENGE}</IonSelectOption>
                      {jahrgaenge.map(jg => (
                        <IonSelectOption key={jg.id} value={jg.id}>{jg.name}</IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                )}
              </IonItemGroup>
            </IonList>

            {/* Material-Liste: "Für alle" oben, danach alles Weitere
                (Entscheidung Simon, 31.08.2026). */}
            {materials.length === 0 ? (
              /* In der Karte, wie ueberall sonst (Simon am Geraet,
                 26.09.2026: "Material Seite im Teamer. Wenn nichts da ist
                 fehlt der Hintergrund von ion Card"). Der leere Zustand stand
                 hier nackt im Content -- als einzige Stelle: Die
                 Dateien-Ansicht derselben Datei und AdminMaterialPage setzen
                 ihn seit jeher in IonCard/IonCardContent. */
              <IonList inset={true} className="app-segment-wrapper">
                <IonCard className="app-card">
                  <IonCardContent>
                    <EmptyState
                      icon={ICON_DATEI}
                      title={materialTeamLeer(eingegrenzt).titel}
                      message={materialTeamLeer(eingegrenzt).text}
                      iconColor="var(--app-color-material)"
                    />
                  </IonCardContent>
                </IonCard>
              </IonList>
            ) : (
              <>
                {globaleMaterials.length > 0 && (
                  <IonList inset={true} className="app-segment-wrapper">
                    <IonListHeader>
                      <div className="app-section-icon app-section-icon--material">
                        <IonIcon icon={ICON_WELT} />
                      </div>
                      <IonLabel>Für alle ({globaleMaterials.length})</IonLabel>
                    </IonListHeader>
                    <IonCard className="app-card">
                      <IonCardContent>
                        {globaleMaterials.map((mat, index) => renderEintrag(mat, index, globaleMaterials.length))}
                      </IonCardContent>
                    </IonCard>
                  </IonList>
                )}

                {uebrigeMaterials.length > 0 && (
                  <IonList inset={true} className="app-segment-wrapper">
                    <IonListHeader>
                      <div className="app-section-icon app-section-icon--material">
                        <IonIcon icon={ICON_DATEI_GEFUELLT} />
                      </div>
                      <IonLabel>Materialien ({uebrigeMaterials.length})</IonLabel>
                    </IonListHeader>
                    <IonCard className="app-card">
                      <IonCardContent>
                        {uebrigeMaterials.map((mat, index) => renderEintrag(mat, index, uebrigeMaterials.length))}
                      </IonCardContent>
                    </IonCard>
                  </IonList>
                )}
              </>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  );

  if (breit) {
    return (
      <WebTeamerMaterial
        fuerAlle={globaleMaterials}
        uebrige={uebrigeMaterials}
        jahrgaenge={jahrgaenge}
        jahrgangId={activeJahrgangId}
        onJahrgang={setActiveJahrgangId}
        suche={search}
        onSuche={setSearch}
        laedt={loading}
        material={selectedMaterial}
        materialLaedt={detailLoading}
        onOeffnen={openDetail}
        onSchliessen={() => setSelectedMaterial(null)}
        ladendeDatei={ladendeDatei}
        onDatei={openFile}
        onLink={openLink}
      />
    );
  }

  // Detail ersetzt die Liste (selectedMaterial-State steuert die Ansicht).
  return selectedMaterial ? renderDetail() : renderList();
};

export default TeamerMaterialPage;
