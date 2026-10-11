// „Aktivität melden" als Dialog der Web-Fassung (Simon, 11.10.2026: „Web
// braucht eigene kompaktere Modale überall"), für Konfis und das Team,
// geöffnet über „Aktivität melden" unter Mitmachen > Aktivitäten im breiten
// Layout (KonfiEventsPage, TeamerEventsPage).
//
// Oben die Aktivität -- eine Liste mit Suche, darunter bei Konfis Art und
// Punkte --, dann Datum (natives Datumsfeld, heute vorbelegt, nicht in der
// Zukunft), Anmerkungen und das Foto als Nachweis mit Vorschau. Fehlt das
// Foto, fragt der Dialog im Fenster nach (der Satz der App), statt eine
// Rückfrage darüber zu legen; „Ohne Foto fortfahren" meldet dann.
//
// Die Logik ist die der App (shared/useAktivitaetMelden.ts): dieselbe
// Dateiauswahl und Verkleinerung, dieselbe Route mit demselben Rumpf, ohne
// Netz (oder wenn es beim Senden abreißt) dieselbe Warteschlange samt Foto,
// dieselbe Erfolgsmeldung. Anders als in der App stehen Prüfung und Fehler im
// Dialog.

import React, { useId, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_KAMERA_GEFUELLT, ICON_LOESCHEN_GEFUELLT } from '../../icons';
import SendeAnzeige from '../../SendeAnzeige';
import { heuteAlsDatum, useAktivitaetMelden, type MeldeAktivitaet, type MeldeRolle } from '../../useAktivitaetMelden';
import { PUNKTEART_NAME } from '../../../../utils/punktearten';
import { punkteText } from '../../../../utils/punkteText';
import WebDialog from '../../../web/WebDialog';
import WebAuswahlSuche, { type WebWahlEintrag } from '../../../web/WebAuswahlSuche';
import WebDatum from '../../../web/WebDatum';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebTextfeld from '../../../web/WebTextfeld';
import '../../../../theme/web/termine.css';

export interface WebAktivitaetMeldenDialogProps {
  rolle: MeldeRolle;
  /** Nach dem Melden (gesendet oder eingereiht): die Seite lädt neu. */
  onGemeldet: () => void;
  onSchliessen: () => void;
}

/** Zweite Zeile eines Eintrags: bei Konfis Art und Punkte, dazu die Kategorien (beim Team nur diese, wie in der App). */
const beschreibung = (a: MeldeAktivitaet, rolle: MeldeRolle): string | undefined => {
  const teile = rolle === 'konfi'
    ? [a.type ? PUNKTEART_NAME[a.type] : null, a.points ? punkteText(a.points) : null]
    : [];
  const text = [...teile, a.category_names].filter(Boolean).join(' · ');
  return text || undefined;
};

const WebAktivitaetMeldenDialog: React.FC<WebAktivitaetMeldenDialogProps> = ({ rolle, onGemeldet, onSchliessen }) => {
  // Ohne Foto: erst fragen (im Fenster), dann mit „Ohne Foto fortfahren" melden.
  const [ohneFotoGefragt, setOhneFotoGefragt] = useState(false);
  const m = useAktivitaetMelden({
    rolle,
    onSuccess: () => { onGemeldet(); onSchliessen(); },
    fragOhneFoto: () => setOhneFotoGefragt(true),
    fehlerImFenster: true,
  });
  const frageSichtbar = ohneFotoGefragt && !m.formData.photo_file;
  const fotoTitel = useId();

  const eintraege: WebWahlEintrag[] = m.activities.map((a) => ({
    wert: String(a.id),
    titel: a.name,
    beschreibung: beschreibung(a, rolle),
  }));

  return (
    <WebDialog
      titel="Aktivität melden"
      breit
      beschreibung={rolle === 'konfi'
        ? 'Die Leitung prüft deine Meldung; danach bekommst du die Punkte.'
        : 'Die Leitung prüft deine Meldung.'}
      onSchliessen={onSchliessen}
      onAbsenden={() => { void m.handleSubmit(frageSichtbar); }}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen} disabled={m.isSubmitting}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={m.isSubmitting || m.loading}>
            {frageSichtbar ? 'Ohne Foto fortfahren' : 'Melden'}
          </WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {m.fehler && <WebHinweis art="fehler" rolle="alert">{m.fehler}</WebHinweis>}
        {m.ohneNetz && (
          <WebHinweis art="hinweis">Ohne Verbindung wird die Aktivität gesendet, sobald du wieder online bist.</WebHinweis>
        )}
        {/* Links die Wahl der Aktivität, rechts Datum, Anmerkungen und Foto. */}
        <div className="web-feldpaar">
          <WebAuswahlSuche
            label="Aktivität"
            eintraege={eintraege}
            wert={m.formData.activity_id}
            onWert={(w) => m.aendern({ activity_id: w })}
            suchePlatzhalter="Aktivität suchen"
            leerText={m.loading ? 'Die Aktivitäten werden geladen.' : 'Keine Aktivitäten gefunden'}
            deaktiviert={m.isSubmitting}
          />
          <div className="web-formular">
            <WebDatum
              label="Datum"
              art="datum"
              pflicht
              wert={m.formData.requested_date}
              onWert={(w) => m.aendern({ requested_date: w })}
              max={heuteAlsDatum()}
              hinweis="Wann du dabei warst."
              deaktiviert={m.isSubmitting}
            />
            <WebTextfeld
              label="Anmerkungen"
              zeilen={2}
              platzhalter="Anmerkungen... (optional)"
              hinweis="Freiwillig."
              wert={m.formData.description}
              onWert={(w) => m.aendern({ description: w })}
              deaktiviert={m.isSubmitting}
            />
            <div className="web-feld" role="group" aria-labelledby={fotoTitel}>
              <span id={fotoTitel} className="web-feld__label">Foto als Nachweis</span>
              {m.photoPreview ? (
                <div className="web-antrag-foto web-antrag-foto--vorschau">
                  <img src={m.photoPreview} alt="Gewähltes Foto" />
                  <div className="web-antrag-foto__knoepfe">
                    <WebKnopf klein onClick={() => { void m.handlePhotoSelect(); }} disabled={m.isSubmitting}>
                      <IonIcon icon={ICON_KAMERA_GEFUELLT} aria-hidden="true" />
                      Anderes Foto wählen
                    </WebKnopf>
                    <WebKnopf klein art="gefahr" onClick={m.removePhoto} disabled={m.isSubmitting}>
                      <IonIcon icon={ICON_LOESCHEN_GEFUELLT} aria-hidden="true" />
                      Foto entfernen
                    </WebKnopf>
                  </div>
                </div>
              ) : (
                <div className="web-antrag-foto">
                  <WebKnopf onClick={() => { void m.handlePhotoSelect(); }} disabled={m.isSubmitting}>
                    <IonIcon icon={ICON_KAMERA_GEFUELLT} aria-hidden="true" />
                    Foto hinzufügen
                  </WebKnopf>
                </div>
              )}
            </div>
            {frageSichtbar && (
              <WebHinweis art="warnung" titel="Kein Foto">{m.ohneFotoFrage}</WebHinweis>
            )}
          </div>
        </div>
        {m.isSubmitting && <SendeAnzeige prozent={m.uploadProgress} was="Foto" farbe="var(--app-text-requests)" />}
      </div>
    </WebDialog>
  );
};

export default WebAktivitaetMeldenDialog;
