// „Neue Challenge" und „Challenge bearbeiten" als Dialog der Web-Fassung
// (Simon, 15.10.2026: Im Browser bekommt jedes Formular, das noch ein Modal
// der App öffnet, ein kompaktes Fenster der Web-Fassung). Geöffnet im
// breiten Layout ab 992 px aus der Liste (Neue Challenge, Bearbeiten) und
// von der Seite einer Challenge (Challenge bearbeiten) -- für Leitung und
// Team, über hooks/useChallengeFormular. In den Apps und im schmalen Fenster
// bleibt das Modal der App (admin/modals/ChallengeManageModal).
//
// Dieselben Felder -- die Challenge, wer mitmacht, Medienarten,
// Sichtbarkeit, Stempel, Jahrgänge, Zeitraum; die Jahrgänge stehen direkt bei
// der Zielgruppe, die über sie entscheidet --, dieselbe Logik
// (useChallengeManageFormular): dieselben Jahrgänge zur
// Auswahl (GET /admin/jahrgaenge, der Server zeigt nur die eigenen),
// dieselben Sperren nach dem Start, dieselbe Prüfung mit denselben Sätzen,
// derselbe Rumpf an dieselbe Route. Statt der zwei Datumsfenster der App
// stehen Start und Ende als Datumsfelder des Browsers da (WebDatum).
//
// Anders als in der App bleibt der Knopf zum Speichern anklickbar, solange
// nichts gesendet wird: Fehlt etwas, sagt der Dialog es in sich selbst, bei
// den Knöpfen -- ein gesperrter Knopf sagt nicht, warum. Fehler des Servers
// stehen dort ebenso. Während des Speicherns schließt nichts den Dialog
// (Abbrechen, X, Escape, Klick daneben), wie das X der App. Schließen mit
// ungespeicherten Änderungen fragt nach -- dieselbe Frage wie das Modal der
// App (canDismiss in useChallengeFormular).

import React, { useEffect, useRef, useState } from 'react';
import { ICON_CHALLENGE_GEFUELLT } from '../../icons';
import type { AdminChallenge, ChallengeMediaType } from '../../../../types/challenges';
import type { ChallengeFormData } from '../../../../utils/challengeForm';
import {
  AUDIENCE_OPTIONS,
  CHALLENGE_GRENZEN,
  MEDIA_OPTIONS,
  VISIBILITY_OPTIONS,
  useChallengeManageFormular,
} from '../../../admin/modals/useChallengeManageFormular';
import WebSymbolWahl from '../../../admin/web/leitung/WebSymbolWahl';
import WebDialog from '../../../web/WebDialog';
import WebDatum from '../../../web/WebDatum';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebMehrfachAuswahl from '../../../web/WebMehrfachAuswahl';
import WebSchalter from '../../../web/WebSchalter';
import WebTextfeld from '../../../web/WebTextfeld';
import WebEinzelwahl from './WebEinzelwahl';
import '../../../../theme/web/challenges.css';
// Die Icon-Wahl (WebSymbolWahl) hat ihre Klassen in leitung.css.
import '../../../../theme/web/leitung.css';

export interface WebChallengeDialogProps {
  /** Die Challenge zum Bearbeiten; null legt eine neue an. */
  challenge: AdminChallenge | null;
  /** Gespeichert: Die Seite schließt den Dialog und lädt neu -- wie nach dem Modal der App. */
  onGespeichert: () => void;
  /** Dialog zu (Abbrechen, X, Escape oder nach „Verwerfen"). */
  onSchliessen: () => void;
}

/** Was im Dialog umgeschaltet wurde: der eine Wert, der dazukam oder wegfiel. */
const umgeschaltet = <T,>(vorher: ReadonlyArray<T>, nachher: ReadonlyArray<T>): T | undefined =>
  nachher.find((w) => !vorher.includes(w)) ?? vorher.find((w) => !nachher.includes(w));

const WebChallengeDialog: React.FC<WebChallengeDialogProps> = ({ challenge, onGespeichert, onSchliessen }) => {
  const [fehler, setFehler] = useState<string | null>(null);
  const [rueckfrage, setRueckfrage] = useState(false);
  const {
    formData, setFormData, jahrgaenge, loading, isSubmitting, initialLoading, isDirty,
    isEditMode, isStarted, isTeamOnly, waehleZielgruppe, waehleSichtbarkeit, toggleMedia, toggleJahrgang, handleSave,
  } = useChallengeManageFormular({ challenge, onSuccess: onGespeichert, meldeFehler: setFehler });

  const sendet = loading || isSubmitting;
  // Wie in der App: Beim Senden sind alle Felder gesperrt; nach dem Start
  // zusätzlich Zielgruppe, Medienarten, Sichtbarkeit, Freigabe und Start.
  const aus = sendet || initialLoading;
  const gesperrt = (label: string) => (isStarted ? `${label} (gesperrt)` : label);

  /** Jede Änderung nimmt eine alte Meldung weg. */
  const aendern = (teil: Partial<ChallengeFormData>) => {
    setFehler(null);
    setFormData((vorher) => ({ ...vorher, ...teil }));
  };

  // Eine Meldung soll nie unter der Knopfleiste liegen.
  const aktionenRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (fehler) aktionenRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [fehler]);

  const abbrechen = () => {
    if (isDirty) setRueckfrage(true);
    else onSchliessen();
  };

  const absenden = () => {
    if (aus) return;
    setFehler(null);
    void handleSave();
  };

  const absendenText = isEditMode ? 'Speichern' : 'Challenge anlegen';

  return (
    <>
      <WebDialog
        titel={isEditMode ? 'Challenge bearbeiten' : 'Neue Challenge'}
        breit
        onSchliessen={abbrechen}
        onAbsenden={absenden}
        gesperrt={sendet}
        aktionen={(
          <>
            {/* Die Meldung steht bei den Knöpfen, die unten im Bild bleiben --
                sichtbar, wo auch immer im Formular man gerade ist. */}
            {fehler && (
              <div className="web-challenge-dialog__meldung" ref={aktionenRef}>
                <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>
              </div>
            )}
            <WebKnopf onClick={abbrechen} disabled={sendet}>Abbrechen</WebKnopf>
            <WebKnopf art="primaer" absenden disabled={aus}>
              {sendet ? 'Wird gespeichert …' : absendenText}
            </WebKnopf>
          </>
        )}
      >
        {initialLoading ? (
          <p className="web-challenge-dialog__laedt" role="status">Wird geladen …</p>
        ) : (
          <div className="web-formular">
            {/* DIE CHALLENGE */}
            <div className="web-feldpaar">
              <WebFeld
                label="Titel"
                pflicht
                wert={formData.title}
                onWert={(w) => aendern({ title: w.slice(0, CHALLENGE_GRENZEN.titel) })}
                platzhalter="Worum geht es?"
                deaktiviert={aus}
              />
              <WebFeld
                label="Gestellt von (optional)"
                wert={formData.author_freetext}
                onWert={(w) => aendern({ author_freetext: w.slice(0, CHALLENGE_GRENZEN.urheber) })}
                platzhalter="z. B. Pastor Simon, Konfi-Team Hennstedt"
                deaktiviert={aus}
              />
            </div>
            <WebTextfeld
              label="Beschreibung"
              pflicht
              zeilen={5}
              wert={formData.description}
              onWert={(w) => aendern({ description: w })}
              platzhalter="Was sollen die Konfis tun?"
              deaktiviert={aus}
            />

            {/* WER MACHT MIT? -- bei „Nur das Team" entfällt die Jahrgangs-Auswahl. */}
            <h3 className="web-gruppe">Wer macht mit?</h3>
            <WebEinzelwahl
              label={gesperrt('Zielgruppe')}
              optionen={AUDIENCE_OPTIONS.map((o) => ({ wert: o.value, titel: o.label, beschreibung: o.hint }))}
              wert={formData.audience}
              onWert={(audience) => { setFehler(null); waehleZielgruppe(audience); }}
              deaktiviert={aus || isStarted}
            />
            {!isTeamOnly && (
              <WebMehrfachAuswahl
                label="Jahrgänge (mehrere möglich)"
                pflicht
                eintraege={jahrgaenge.map((j) => ({ wert: String(j.id), titel: j.name }))}
                werte={formData.jahrgang_ids.map(String)}
                onWerte={(werte) => {
                  const id = umgeschaltet(formData.jahrgang_ids.map(String), werte);
                  if (id === undefined) return;
                  setFehler(null);
                  toggleJahrgang(Number(id));
                }}
                leerText="Keine Jahrgänge verfügbar"
                hinweis={formData.jahrgang_ids.length > 0 ? `${formData.jahrgang_ids.length} ausgewählt` : undefined}
                deaktiviert={aus}
              />
            )}

            {/* MEDIENARTEN UND SICHTBARKEIT -- nach dem Start eingefroren. */}
            <h3 className="web-gruppe">Beiträge</h3>
            <div className="web-feldpaar">
              <WebMehrfachAuswahl
                label={gesperrt('Erlaubte Medienarten')}
                pflicht
                eintraege={MEDIA_OPTIONS.map((o) => ({ wert: o.value, titel: o.label, beschreibung: o.hint }))}
                werte={formData.allowed_media}
                onWerte={(werte) => {
                  const art = umgeschaltet<string>(formData.allowed_media, werte);
                  if (art === undefined) return;
                  setFehler(null);
                  toggleMedia(art as ChallengeMediaType);
                }}
                leerText="Keine Medienarten"
                hinweis={formData.allowed_media.length > 0 ? `${formData.allowed_media.length} ausgewählt` : 'Mehrere möglich'}
                deaktiviert={aus || isStarted}
              />
              <WebEinzelwahl
                label={gesperrt('Sichtbarkeit der Beiträge')}
                optionen={VISIBILITY_OPTIONS.map((o) => ({ wert: o.value, titel: o.label, beschreibung: o.hint }))}
                wert={formData.visibility}
                onWert={(visibility) => { setFehler(null); waehleSichtbarkeit(visibility); }}
                deaktiviert={aus || isStarted}
              />
            </div>
            <div className="web-feldpaar">
              <WebSchalter
                label="Beiträge erst nach Freigabe zeigen"
                an={formData.moderated}
                onAn={(moderated) => aendern({ moderated })}
                hinweis="Ist das aus, erscheinen Beiträge sofort in der Galerie. Ausblenden geht immer noch nachträglich."
                deaktiviert={aus || isStarted}
              />
              <WebSchalter
                label="Mehrere Beiträge erlauben"
                an={formData.allow_multiple}
                onAn={(allow_multiple) => aendern({ allow_multiple })}
                hinweis="Konfis können mehr als einen Beitrag zu dieser Challenge einreichen."
                deaktiviert={aus}
              />
            </div>

            {/* STEMPEL */}
            <h3 className="web-gruppe">Stempel</h3>
            <WebFeld
              label="Name des Stempels"
              pflicht
              wert={formData.badge_name}
              onWert={(w) => aendern({ badge_name: w.slice(0, CHALLENGE_GRENZEN.stempelName) })}
              platzhalter="z. B. Hingeschaut"
              deaktiviert={aus}
            />
            <WebSymbolWahl
              label="Icon"
              pflicht
              wert={formData.badge_icon}
              onWert={(badge_icon) => aendern({ badge_icon })}
              farbe="var(--app-color-challenges)"
              ton="neutral"
              rueckfall={ICON_CHALLENGE_GEFUELLT}
              deaktiviert={aus}
            />

            {/* ZEITRAUM -- beim Entwurf gibt es keinen (Nutzerentscheid
                24.08.2026); eingetragene Werte bleiben im Formular und tauchen
                beim Einplanen wieder auf. */}
            <h3 className="web-gruppe">{formData.is_draft ? 'Entwurf' : 'Zeitraum'}</h3>
            {!formData.is_draft && (
              <div className="web-feldpaar">
                <WebDatum
                  label={isStarted ? 'Start (gesperrt)' : 'Start'}
                  art="datumUhrzeit"
                  pflicht={!isStarted}
                  wert={formData.starts_at}
                  onWert={(starts_at) => aendern({ starts_at })}
                  deaktiviert={aus || isStarted}
                />
                <WebDatum
                  label="Ende"
                  art="datumUhrzeit"
                  pflicht
                  wert={formData.ends_at}
                  onWert={(ends_at) => aendern({ ends_at })}
                  deaktiviert={aus}
                />
              </div>
            )}
            {!isStarted && (
              <WebSchalter
                label="Als Entwurf speichern"
                an={formData.is_draft}
                onAn={(is_draft) => aendern({ is_draft })}
                hinweis="Entwürfe sehen nur du und dein Team."
                deaktiviert={aus}
              />
            )}
          </div>
        )}
      </WebDialog>
      {rueckfrage && (
        <WebDialog
          titel="Ungespeicherte Änderungen"
          beschreibung="Möchtest du die Änderungen verwerfen?"
          rueckfrage="warnung"
          onSchliessen={() => setRueckfrage(false)}
          aktionen={(
            <>
              <WebKnopf onClick={() => setRueckfrage(false)}>Abbrechen</WebKnopf>
              <WebKnopf art="gefahr" onClick={onSchliessen}>Verwerfen</WebKnopf>
            </>
          )}
        >
          {null}
        </WebDialog>
      )}
    </>
  );
};

export default WebChallengeDialog;
