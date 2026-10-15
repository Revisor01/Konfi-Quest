// „Dein Beitrag" als Dialog der Web-Fassung (Simon, 15.10.2026: Im Browser
// bekommt jedes Formular, das noch ein Modal der App öffnet, ein kompaktes
// Fenster der Web-Fassung). Geöffnet im breiten Layout ab 992 px mit
// „Beitrag einreichen" auf der Seite einer Challenge -- für Konfis
// (konfi/pages/KonfiChallengeDetailPage) und fürs Team
// (WebChallengeLeitungDetail). In den Apps und im schmalen Fenster bleibt das
// Modal der App (konfi/modals/ChallengeSubmitModal).
//
// Dieselben Felder und Regeln, dieselbe Logik (useChallengeBeitrag): nur die
// erlaubten Medienarten, Text, Foto, Video, Aufnahme oder Musik-Link, bei
// „Selbst entscheiden" die Wahl, wer den Beitrag sieht; dieselbe
// Dateiauswahl und Verkleinerung (Medien-System), dieselbe Prüfung mit
// denselben Sätzen, derselbe Weg an den Server mit Fortschritt. Danach wie in
// der App: Fenster zu, die Meldung oben, die Beiträge laden neu.
//
// Anders als in der App stehen Prüfung und Fehler des Servers im Fenster
// selbst, bei den Knöpfen. Während des Sendens schließt nichts den Dialog
// (Abbrechen, X, Escape, Klick daneben), wie das X der App.

import React, { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_KAMERA_GEFUELLT,
  ICON_LOESCHEN,
  ICON_MIKROFON_GEFUELLT,
  ICON_VIDEO,
} from '../../icons';
import FortschrittsBalken from '../../FortschrittsBalken';
import AudioPlayer from '../../AudioPlayer';
import type { KonfiChallenge } from '../../../../types/challenges';
import { sendeText } from '../../../../utils/fortschritt';
import {
  CONSENT_OPTIONS,
  EINGABE_TITEL,
  LINK_HINWEIS,
  formatDuration,
  useChallengeBeitrag,
} from '../../../konfi/modals/useChallengeBeitrag';
import WebDialog from '../../../web/WebDialog';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebTextfeld from '../../../web/WebTextfeld';
import WebEinzelwahl from './WebEinzelwahl';
import '../../../../theme/web/challenges.css';

export interface WebBeitragDialogProps {
  challenge: KonfiChallenge;
  /** Eingereicht: Die Seite schließt den Dialog und lädt die Beiträge neu -- wie nach dem Modal der App. */
  onEingereicht: () => void;
  /** Dialog zu (Abbrechen, X, Escape). */
  onSchliessen: () => void;
}

const DAZU_SAGEN = 'Etwas dazu sagen? (optional)';

const WebBeitragDialog: React.FC<WebBeitragDialogProps> = ({ challenge, onEingereicht, onSchliessen }) => {
  const [fehler, setFehler] = useState<string | null>(null);
  const b = useChallengeBeitrag({ challenge, onSuccess: onEingereicht, meldeFehler: setFehler });
  const { mediaType, mediaPreview, isSubmitting, pickingMedia, isRecording } = b;

  // Fällt der Fokus mit seinem Knopf aus dem Dialog (siehe unten), geht er
  // auf den ersten Knopf der Eingabe -- sonst liefe Tab in die Seite dahinter.
  const eingabeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (document.activeElement && document.activeElement !== document.body) return;
    eingabeRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
  }, [mediaPreview, isRecording, pickingMedia]);

  // Eine Meldung soll nie unter der Knopfleiste liegen.
  const meldungRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (fehler) meldungRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [fehler]);

  /** Jede Eingabe nimmt eine alte Meldung weg. */
  const aendern = (setzen: () => void) => {
    setFehler(null);
    setzen();
  };

  const absenden = () => {
    if (isSubmitting) return;
    setFehler(null);
    b.handleSubmit();
  };

  const dazuSagen = (
    <WebTextfeld
      label={DAZU_SAGEN}
      zeilen={2}
      wert={b.textContent}
      onWert={(w) => aendern(() => b.setTextContent(w))}
      deaktiviert={isSubmitting}
    />
  );

  /** Foto oder Video: Auswahl über das Medien-System, danach die Vorschau. */
  const datei = (art: 'photo' | 'video') => {
    const foto = art === 'photo';
    if (mediaPreview) {
      return (
        <div className="web-beitrag-vorschau">
          {foto
            ? <img src={mediaPreview} alt="Dein Foto" className="web-beitrag-vorschau__medium" />
            : <video src={mediaPreview} controls className="web-beitrag-vorschau__medium" aria-label="Dein Video" />}
          <div className="web-formular__knoepfe">
            <WebKnopf art="gefahr" onClick={() => aendern(b.removeFile)} disabled={isSubmitting}>
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
              {foto ? 'Bild entfernen' : 'Video entfernen'}
            </WebKnopf>
          </div>
        </div>
      );
    }
    return (
      <div className="web-formular__knoepfe">
        <WebKnopf onClick={() => aendern(() => { void (foto ? b.pickPhoto() : b.pickVideo()); })} disabled={pickingMedia || isSubmitting}>
          <IonIcon icon={foto ? ICON_KAMERA_GEFUELLT : ICON_VIDEO} aria-hidden="true" />
          {pickingMedia ? 'Wird geladen …' : foto ? 'Foto hinzufügen' : 'Video hinzufügen'}
        </WebKnopf>
      </div>
    );
  };

  /** Aufnahme: starten, beenden, anhören, entfernen. */
  const aufnahme = () => {
    if (mediaPreview) {
      return (
        <div className="web-beitrag-vorschau">
          <p className="web-beitrag-vorschau__text">Aufnahme bereit</p>
          <AudioPlayer src={mediaPreview} />
          <div className="web-formular__knoepfe">
            <WebKnopf art="gefahr" onClick={() => aendern(b.removeFile)} disabled={isSubmitting}>
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
              Aufnahme entfernen
            </WebKnopf>
          </div>
        </div>
      );
    }
    if (isRecording) {
      return (
        <div className="web-formular__knoepfe">
          <WebKnopf art="gefahr" onClick={b.stopRecording}>Aufnahme beenden</WebKnopf>
          <span className="web-beitrag-aufnahme" role="timer" aria-label="Laufende Aufnahme">{formatDuration(b.recordSeconds)}</span>
        </div>
      );
    }
    return (
      <div className="web-formular__knoepfe">
        <WebKnopf onClick={() => aendern(() => { void b.startRecording(); })} disabled={isSubmitting}>
          <IonIcon icon={ICON_MIKROFON_GEFUELLT} aria-hidden="true" />
          Aufnahme starten
        </WebKnopf>
      </div>
    );
  };

  return (
    <WebDialog
      titel="Dein Beitrag"
      beschreibung={`${challenge.title}: ${b.visibilityInfo}`}
      onSchliessen={onSchliessen}
      onAbsenden={absenden}
      gesperrt={isSubmitting}
      aktionen={(
        <>
          {fehler && (
            <div className="web-challenge-dialog__meldung" ref={meldungRef}>
              <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>
            </div>
          )}
          {/* Dieselbe Anzeige wie beim Senden in der App: Prozent und Balken,
              bei 100 % „Wird verarbeitet…" -- der Server verschlüsselt noch. */}
          {isSubmitting && b.uploadProgress > 0 && (
            <div className="web-challenge-dialog__meldung web-beitrag-fortschritt" aria-live="polite">
              {sendeText(b.uploadProgress)}
              <FortschrittsBalken prozent={b.uploadProgress} beschriftung={`Beitrag wird gesendet: ${b.uploadProgress} Prozent`} />
            </div>
          )}
          <WebKnopf onClick={onSchliessen} disabled={isSubmitting}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={isSubmitting}>
            {isSubmitting ? 'Wird eingereicht …' : 'Beitrag einreichen'}
          </WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {b.availableOptions.length > 1 && (
          <WebEinzelwahl
            label="Wie möchtest du antworten?"
            optionen={b.availableOptions.map((o) => ({ wert: o.value, titel: o.label, beschreibung: o.hint }))}
            wert={mediaType}
            onWert={(art) => aendern(() => b.handleMediaTypeChange(art))}
            deaktiviert={isSubmitting}
          />
        )}

        {mediaType === 'text' && (
          <WebTextfeld
            label={EINGABE_TITEL.text}
            pflicht
            zeilen={5}
            wert={b.textContent}
            onWert={(w) => aendern(() => b.setTextContent(w))}
            platzhalter="Schreib hier deinen Beitrag …"
            deaktiviert={isSubmitting}
          />
        )}
        {mediaType === 'link' && (
          <>
            <WebFeld
              label={EINGABE_TITEL.link}
              pflicht
              wert={b.linkUrl}
              onWert={(w) => aendern(() => b.setLinkUrl(w))}
              platzhalter="https://…"
              hinweis={LINK_HINWEIS}
              deaktiviert={isSubmitting}
            />
            <WebTextfeld
              label="Warum dieser Link? (optional)"
              zeilen={2}
              wert={b.textContent}
              onWert={(w) => aendern(() => b.setTextContent(w))}
              deaktiviert={isSubmitting}
            />
          </>
        )}
        {(mediaType === 'photo' || mediaType === 'video' || mediaType === 'audio') && (
          <>
            <h3 className="web-gruppe">{EINGABE_TITEL[mediaType]}</h3>
            {/* Der Knopf, der den Fokus trug (hinzufügen, entfernen, Aufnahme
                starten/beenden), weicht der Vorschau bzw. der Auswahl; der
                Fokus geht dann auf den Knopf, der an seine Stelle tritt. */}
            <div ref={eingabeRef} className="web-formular">
              {mediaType === 'audio' ? aufnahme() : datei(mediaType)}
            </div>
            {dazuSagen}
          </>
        )}

        {b.isChoice && (
          <>
            <h3 className="web-gruppe">Sichtbarkeit</h3>
            <WebEinzelwahl
              label="Wer sieht deinen Beitrag?"
              optionen={CONSENT_OPTIONS.map((o) => ({ wert: o.value, titel: o.label, beschreibung: o.hint }))}
              wert={b.consent}
              onWert={(consent) => aendern(() => b.setConsent(consent))}
              deaktiviert={isSubmitting}
            />
          </>
        )}
      </div>
    </WebDialog>
  );
};

export default WebBeitragDialog;
