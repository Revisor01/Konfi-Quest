// Material anlegen, bearbeiten und ansehen -- das Modal der App. Die Logik
// (Laden, Vorbelegung, Prüfen, Speichern, Warteschlange, Dateien) steht in
// useMaterialFormular; der Dialog der Web-Fassung (web/leitung/WebMaterialDialog)
// nutzt dieselbe.
import React, { useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonLabel,
  IonInput,
  IonTextarea,
  IonIcon,
  IonSpinner,
  IonList,
  IonListHeader,
  IonCard,
  IonCardContent,
  IonAccordion,
  IonAccordionGroup,
} from '@ionic/react';
import {
  ICON_ANHANG,
  ICON_AUFKLAPPEN,
  ICON_BILD,
  ICON_DATEI_GEFUELLT,
  ICON_HAKEN,
  ICON_HINZUFUEGEN,
  ICON_HOCHLADEN,
  ICON_LINK,
  ICON_LOESCHEN_GEFUELLT,
  ICON_MUSIK,
  ICON_SCHLIESSEN,
  ICON_VIDEO,
} from '../../shared/icons';
import LadeStandZeile from '../../shared/LadeStandZeile';
import SendeAnzeige from '../../shared/SendeAnzeige';
import { closeOpenSlidingItems } from '../../../utils/slidingItems';
import { tastaturKlick } from '../../../utils/tastatur';
import { datumKurz } from '../../../utils/dateUtils';
import { useMaterialFormular, type Material } from './useMaterialFormular';

interface MaterialFormModalProps {
  material?: Material | null;
  // Schreibschutz (Entscheidung Simon, 01.09.2026): Bearbeiten kann nur die
  // erstellende Person oder die Leitung. Wer es nicht darf, sieht das
  // Material hier trotzdem -- ohne Speichern-Knopf, ohne Datei-Loeschen,
  // ohne Upload. Die verbindliche Pruefung macht der Server (403).
  nurLesen?: boolean;
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
}

const MaterialFormModal: React.FC<MaterialFormModalProps> = ({ material, nurLesen = false, onClose, onSuccess }) => {
  const pageRef = useRef<HTMLElement>(null);
  const {
    title, setTitle, description, setDescription,
    eventIds, setEventIds, jahrgangIds, setJahrgangIds, eventsZurAuswahl, jahrgaenge,
    linkUrls, setLinkUrls, existingFiles, newFiles,
    dateienWaehlen, removeNewFile, handleDeleteExistingFile, openFile, openInAppViewer, ladendeDatei,
    isSubmitting, sendeProzent, handleSave,
  } = useMaterialFormular({ material, nurLesen, onSuccess });

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return ICON_BILD;
    if (mimeType.startsWith('video/')) return ICON_VIDEO;
    if (mimeType.startsWith('audio/')) return ICON_MUSIK;
    return ICON_DATEI_GEFUELLT;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onClose} aria-label="Schließen">
              <IonIcon icon={ICON_SCHLIESSEN} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>{nurLesen ? 'Material ansehen' : material ? 'Material bearbeiten' : 'Neues Material'}</IonTitle>
          {/* Ohne Bearbeitungsrecht gibt es keinen Speichern-Knopf -- ein
              Knopf, der mit 403 endet, waere schlechter als keiner. */}
          {!nurLesen && (
            <IonButtons slot="end">
              <IonButton onClick={handleSave} disabled={isSubmitting} aria-label="Material speichern">
                {isSubmitting ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_HAKEN} slot="icon-only" />}
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
        {/* Dieselbe Anzeige wie beim Einreichen eines Challenge-Beitrags
            (27.09.2026). Vorher lief das Hochladen ohne jede Rückmeldung
            außer dem drehenden Knopf. */}
        {isSubmitting && (
          <SendeAnzeige prozent={sendeProzent} was={newFiles.length === 1 ? 'Datei' : 'Dateien'} farbe="var(--app-text-material)" />
        )}
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Hinweis im Lese-Modus: WER bearbeiten darf, statt es nur stumm zu
            sperren. created_by_name kann fehlen (Konto geloescht). */}
        {nurLesen && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonCard className="app-card">
              <IonCardContent>
                <p style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-color-neutral)', margin: 0 }}>
                  {material?.created_by_name
                    ? `Angelegt von ${material.created_by_name}. Bearbeiten und löschen kann nur diese Person oder die Gemeindeleitung.`
                    : 'Das Konto der erstellenden Person wurde gelöscht. Bearbeiten und löschen kann nur noch die Gemeindeleitung.'}
                </p>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Titel & Beschreibung */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--material">
              <IonIcon icon={ICON_DATEI_GEFUELLT} />
            </div>
            <IonLabel>Grunddaten</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonItem lines="full" style={{ '--background': 'transparent' }}>
                <IonInput
                  label="Titel"
                  labelPlacement="stacked"
                  value={title}
                  onIonInput={(e) => setTitle(e.detail.value || '')}
                  placeholder="Material-Titel"
                  readonly={nurLesen}
                  required
                />
              </IonItem>
              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonTextarea
                  label="Beschreibung"
                  labelPlacement="stacked"
                  value={description}
                  onIonInput={(e) => setDescription(e.detail.value || '')}
                  placeholder="Optionale Beschreibung..."
                  autoGrow={true}
                  rows={3}
                  readonly={nurLesen}
                />
              </IonItem>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Der Sichtbarkeits-Umschalter vom 31.08. stand hier -- weg seit
            dem 01.09.2026 (Simon: "Sichtbarkeit ist auch ueberfluessig.
            Denn: wenn kein Jahrgang dann global. Fertig. Sonst nur
            Jahrgang."). Er verdoppelte nur die Jahrgangs-Zuordnung; die
            Sichtbarkeit steht jetzt direkt am Jahrgangs-Abschnitt und der
            Server leitet ist_global daraus ab. */}

        {/* Events zuordnen */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--material">
              <IonIcon icon={ICON_DATEI_GEFUELLT} />
            </div>
            <IonLabel>Zuordnung</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '0' }}>
              <IonAccordionGroup>
                <IonAccordion value="events" toggleIcon={ICON_AUFKLAPPEN} toggleIconSlot="end">
                  <IonItem slot="header" lines="none" style={{ '--padding-start': 'var(--app-abstand-basis)' }}>
                    <IonLabel>
                      <h3 style={{ fontSize: 'var(--app-text-betont)', fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-primary)', margin: '0 0 var(--app-abstand-winzig) 0' }}>
                        Events
                      </h3>
                      <p style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-color-neutral)', margin: '0', fontWeight: 'var(--app-schrift-normal)' }}>
                        {eventIds.length > 0
                          ? `${eventIds.length} ${eventIds.length === 1 ? 'Event' : 'Events'} ausgewählt`
                          : 'Keine Events zugeordnet'}
                      </p>
                    </IonLabel>
                  </IonItem>
                  <div slot="content" style={{ padding: 'var(--app-abstand-mini) var(--app-abstand-basis) var(--app-abstand-mittel)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-kompakt)' }}>
                      {eventsZurAuswahl
                        .map(ev => {
                          const isSelected = eventIds.includes(ev.id);
                          return (
                            <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                              key={ev.id}
                              className="app-list-item"
                              onClick={() => {
                                if (nurLesen) return;
                                if (isSelected) {
                                  setEventIds(eventIds.filter(id => id !== ev.id));
                                } else {
                                  setEventIds([...eventIds, ev.id]);
                                }
                              }}
                              style={{
                                cursor: 'pointer',
                                marginBottom: '0',
                                borderLeftColor: isSelected ? 'var(--app-color-material)' : 'var(--app-border-soft)',
                                backgroundColor: isSelected ? 'rgba(var(--app-color-material-rgb), 0.08)' : undefined
                              }}
                            >
                              <div className="app-list-item__row">
                                <div className="app-list-item__main">
                                  <div className="app-list-item__content">
                                    <div className="app-list-item__title">{ev.name}</div>
                                    {ev.event_date && (
                                      <div className="app-list-item__subtitle">
                                        {datumKurz(ev.event_date)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </IonAccordion>

                <IonAccordion value="jahrgaenge" toggleIcon={ICON_AUFKLAPPEN} toggleIconSlot="end">
                  <IonItem slot="header" lines="none" style={{ '--padding-start': 'var(--app-abstand-basis)' }}>
                    <IonLabel>
                      <h3 style={{ fontSize: 'var(--app-text-betont)', fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-primary)', margin: '0 0 var(--app-abstand-winzig) 0' }}>
                        Jahrgänge
                      </h3>
                      <p style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-color-neutral)', margin: '0', fontWeight: 'var(--app-schrift-normal)' }}>
                        {jahrgangIds.length > 0
                          ? `Nur das Team ${jahrgangIds.length === 1 ? 'dieses Jahrgangs' : 'dieser Jahrgänge'} sieht das Material`
                          : 'Ohne Zuordnung sieht das ganze Team das Material'}
                      </p>
                    </IonLabel>
                  </IonItem>
                  <div slot="content" style={{ padding: 'var(--app-abstand-mini) var(--app-abstand-basis) var(--app-abstand-mittel)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-kompakt)' }}>
                      {jahrgaenge.map(jg => {
                        const isSelected = jahrgangIds.includes(jg.id);
                        return (
                          <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                            key={jg.id}
                            className="app-list-item"
                            onClick={() => {
                              if (nurLesen) return;
                              if (isSelected) {
                                setJahrgangIds(jahrgangIds.filter(id => id !== jg.id));
                              } else {
                                setJahrgangIds([...jahrgangIds, jg.id]);
                              }
                            }}
                            style={{
                              cursor: 'pointer',
                              marginBottom: '0',
                              borderLeftColor: isSelected ? 'var(--app-color-material)' : 'var(--app-border-soft)',
                              backgroundColor: isSelected ? 'rgba(var(--app-color-material-rgb), 0.08)' : undefined
                            }}
                          >
                            <div className="app-list-item__row">
                              <div className="app-list-item__main">
                                <div className="app-list-item__content">
                                  <div className="app-list-item__title">{jg.name}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </IonAccordion>
              </IonAccordionGroup>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Links (Entscheidung Simon, 01.09.2026): Der Datei-oder-Link-
            Umschalter vom 31.08. stand hier -- weg. Links und Dateien sind
            parallel erlaubt, beide Bereiche immer sichtbar, beide optional.
            Leere Eingabefelder fallen beim Speichern still heraus. */}
        {(!nurLesen || linkUrls.length > 0) && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--material">
                <IonIcon icon={ICON_LINK} />
              </div>
              <IonLabel>Links</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                {/* Entfernen per Wischen wie bei den Dateien darunter
                    (Simons Hinweis 03.09.2026) -- der Muelleimer neben dem
                    Feld war die letzte Stelle im Modal mit einem Loeschknopf
                    in der Zeile.
                    Die Geste liegt bewusst auf der ganzen Zeile, nicht nur
                    auf dem Eingabefeld: Ionic gibt einem Wisch, der IM Feld
                    beginnt, weiterhin der Textmarkierung -- gewischt wird
                    vom Rand her, wie ueberall sonst. */}
                {linkUrls.map((url, index) => (
                  <IonItemSliding key={index} disabled={nurLesen}>
                    <IonItem
                      lines={index < linkUrls.length - 1 ? 'full' : 'none'}
                      style={{ '--background': 'transparent' }}
                    >
                      <IonInput
                        label={`Adresse ${linkUrls.length > 1 ? index + 1 : ''}`.trim()}
                        labelPlacement="stacked"
                        type="url"
                        inputmode="url"
                        autocapitalize="off"
                        value={url}
                        onIonInput={(e) => {
                          const wert = e.detail.value || '';
                          setLinkUrls(prev => prev.map((l, i) => (i === index ? wert : l)));
                        }}
                        placeholder="https://konfi-quest.de/gottesbilder"
                        readonly={nurLesen}
                      />
                    </IonItem>
                    {!nurLesen && (
                      <IonItemOptions className="app-swipe-actions" side="end">
                        <IonItemOption
                          className="app-swipe-action"
                          onClick={() => {
                            closeOpenSlidingItems();
                            setLinkUrls(prev => prev.filter((_, i) => i !== index));
                          }}
                          aria-label="Link entfernen"
                        >
                          <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                            <IonIcon icon={ICON_LOESCHEN_GEFUELLT} />
                          </div>
                        </IonItemOption>
                      </IonItemOptions>
                    )}
                  </IonItemSliding>
                ))}
                {linkUrls.length === 0 && (
                  <p style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-color-neutral)', margin: '0 0 var(--app-abstand-mini) 0' }}>
                    Verknüpfte Internetseiten öffnen sich im Browser — zum Beispiel eine eigene Seite oder ein YouTube-Video.
                  </p>
                )}
                {!nurLesen && (
                  <IonButton
                    expand="block"
                    fill="outline"
                    onClick={() => setLinkUrls(prev => [...prev, ''])}
                    style={{ marginTop: 'var(--app-abstand-eng)' }}
                  >
                    <IonIcon icon={ICON_HINZUFUEGEN} slot="start" />
                    Link hinzufügen
                  </IonButton>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Bestehende Dateien */}
        {existingFiles.length > 0 && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--material">
                <IonIcon icon={ICON_ANHANG} />
              </div>
              <IonLabel>Vorhandene Dateien</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {existingFiles.map((file, index) => (
                    <IonItemSliding key={file.id} style={{ marginBottom: index < existingFiles.length - 1 ? 'var(--app-abstand-eng)' : '0' }}>
                      <IonItem
                        button
                        detail={false}
                        lines="none"
                        className="app-item-transparent"
                        onClick={() => openFile(file)}
                      >
                        <div className="app-list-item" style={{ borderLeftColor: 'var(--app-color-material)' }}>
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
                      </IonItem>
                      {/* Datei-Loeschen zaehlt als Bearbeitung des Materials
                          (Entscheidung Simon, 01.09.2026) -- im Lese-Modus
                          gibt es den Wisch-Knopf nicht. Ansehen bleibt. */}
                      {!nurLesen && (
                        <IonItemOptions className="app-swipe-actions" side="end">
                          <IonItemOption
                            className="app-swipe-action"
                            onClick={() => { closeOpenSlidingItems(); handleDeleteExistingFile(file); }}
                            aria-label="Datei löschen"
                          >
                            <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                              <IonIcon icon={ICON_LOESCHEN_GEFUELLT} />
                            </div>
                          </IonItemOption>
                        </IonItemOptions>
                      )}
                    </IonItemSliding>
                  ))}
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Neue Dateien. Dateien anhaengen zaehlt als Bearbeitung des
            Materials (Entscheidung Simon, 01.09.2026) -- im Lese-Modus fehlt
            der ganze Abschnitt. */}
        {!nurLesen && (
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--material">
              <IonIcon icon={ICON_HOCHLADEN} />
            </div>
            <IonLabel>Dateien hinzufügen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              {newFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 'var(--app-abstand-mittel)' }}>
                  {newFiles.map((file, index) => (
                    <IonItemSliding key={index} style={{ marginBottom: index < newFiles.length - 1 ? 'var(--app-abstand-eng)' : '0' }}>
                      <IonItem
                        button
                        detail={false}
                        lines="none"
                        className="app-item-transparent"
                        onClick={() => {
                          openInAppViewer(file, file.name, file.type);
                        }}
                      >
                        <div className="app-list-item" style={{ borderLeftColor: 'var(--app-color-material)' }}>
                          <div className="app-list-item__row">
                            <div className="app-list-item__main">
                              <div className="app-icon-circle" style={{ backgroundColor: 'var(--app-color-material)' }}>
                                <IonIcon icon={ICON_ANHANG} />
                              </div>
                              <div className="app-list-item__content">
                                <div className="app-list-item__title">{file.name}</div>
                                <div className="app-list-item__meta">
                                  <span className="app-list-item__meta-item">
                                    {formatFileSize(file.size)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </IonItem>
                      <IonItemOptions className="app-swipe-actions" side="end">
                        <IonItemOption
                          className="app-swipe-action"
                          onClick={() => { closeOpenSlidingItems(); removeNewFile(index); }}
                          aria-label="Datei entfernen"
                        >
                          <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                            <IonIcon icon={ICON_LOESCHEN_GEFUELLT} />
                          </div>
                        </IonItemOption>
                      </IonItemOptions>
                    </IonItemSliding>
                  ))}
                </div>
              )}
              <IonButton
                expand="block"
                fill="solid"
                onClick={() => void dateienWaehlen()}
                style={{
                  '--background': 'var(--ion-color-primary)',
                  marginTop: 'var(--app-abstand-basis)',
                  padding: '0 var(--app-abstand-basis)'
                }}
              >
                <IonIcon icon={ICON_HOCHLADEN} slot="start" />
                Datei auswählen
              </IonButton>
            </IonCardContent>
          </IonCard>
        </IonList>
        )}

        <div className="ion-padding-bottom" />
      </IonContent>
    </IonPage>
  );
};

export default MaterialFormModal;
