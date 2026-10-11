// „Aktivität prüfen" als Dialog der Web-Fassung (Simon, 11.10.2026: „Web
// braucht eigene kompaktere Modale überall"), geöffnet aus den gemeldeten
// Aktivitäten der Leitung (Mitmachen > Aktivitäten, AdminEventsPage) und von
// der Detailseite einer Person (offene Anträge, KonfiDetailView) -- jeweils im
// breiten Layout.
//
// Links die Angaben zum Antrag und darunter die Entscheidung bzw. der
// Bearbeitungsstand, rechts das Nachweisfoto (mit „Foto löschen"). Anders als
// in der App, wo erst gewählt und dann mit dem Haken bestätigt wird, entscheidet
// hier je ein Knopf: „Genehmigen" oder „Ablehnen" -- Ablehnen nur mit Grund,
// sonst sagt der Dialog, was fehlt.
//
// Die Logik ist die der App (admin/modals/useAntragPruefen.ts): dieselbe
// Route mit demselben Rumpf, ohne Netz dieselbe Warteschlange, dieselbe
// Messung erst nach der Antwort.

import React from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_AKTION_GEFUELLT,
  ICON_KAMERA_GEFUELLT,
  ICON_LOESCHEN_GEFUELLT,
  ICON_PERSON_GEFUELLT,
  ICON_TERMIN_GEFUELLT,
  ICON_TEXT,
  ICON_UHRZEIT_GEFUELLT,
} from '../../../shared/icons';
import NachweisFoto from '../../../shared/NachweisFoto';
import { datumKurz, datumUhrzeit } from '../../../../utils/dateUtils';
import { punkteText } from '../../../../utils/punkteText';
import { useAntragPruefen, type PruefAntrag } from '../../modals/useAntragPruefen';
import WebDialog from '../../../web/WebDialog';
import WebAngaben, { type WebAngabe } from '../../../web/WebAngaben';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebTextfeld from '../../../web/WebTextfeld';
import '../../../../theme/web/termine.css';

export interface WebAntragPruefenDialogProps {
  requestId: number;
  /**
   * Aus der Liste: Der Antrag ist schon entschieden oder die Leitung darf
   * nicht entscheiden -- dann heißt der Dialog „Aktivität ansehen" schon,
   * bevor er geladen hat (wie der Knopf „Ansehen").
   */
  nurAnsehen?: boolean;
  /** Aus der Liste: Der Antrag hat ein Foto -- der Dialog ist dann gleich breit. */
  mitFoto?: boolean;
  /** Nach der Entscheidung (gesendet oder eingereiht): die Seite lädt neu. */
  onGespeichert: () => void;
  onSchliessen: () => void;
}

/** Die Art des Antrags in Worten: Team, Gottesdienst oder Gemeinde (wie die Liste). */
const artText = (a: PruefAntrag): string => {
  if (a.activity_target_role === 'teamer') return 'Team';
  return a.activity_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde';
};

const angabenVon = (a: PruefAntrag): WebAngabe[] => {
  const team = a.activity_target_role === 'teamer';
  return [
    {
      label: 'Von',
      icon: ICON_PERSON_GEFUELLT,
      iconKlasse: team ? 'app-icon-color--teamer' : 'app-icon-color--konfis',
      wert: (
        <>
          {a.konfi_name}
          {!team && a.jahrgang_name && <span className="web-zelle-leise">{a.jahrgang_name}</span>}
        </>
      ),
    },
    {
      label: 'Aktivität',
      icon: ICON_AKTION_GEFUELLT,
      iconKlasse: 'app-icon-color--activities',
      wert: (
        <>
          {a.activity_name}
          <span className="web-zelle-leise">{artText(a)}</span>
        </>
      ),
    },
    // Teamer-Aktivitäten geben keine Punkte (reiner Nachweis).
    ...(!team && a.activity_points ? [{ label: 'Punkte', wert: punkteText(a.activity_points) }] : []),
    { label: 'Teilnahmedatum', icon: ICON_TERMIN_GEFUELLT, iconKlasse: 'app-icon-color--events', wert: datumKurz(a.requested_date) },
    { label: 'Eingereicht', icon: ICON_UHRZEIT_GEFUELLT, iconKlasse: 'app-icon-color--time', wert: datumUhrzeit(a.created_at) },
    ...(a.comment ? [{
      label: 'Kommentar',
      icon: ICON_TEXT,
      iconKlasse: 'app-icon-color--text-secondary',
      wert: <p className="web-beschreibung">{a.comment}</p>,
    }] : []),
  ];
};

const WebAntragPruefenDialog: React.FC<WebAntragPruefenDialogProps> = ({
  requestId, nurAnsehen = false, mitFoto = false, onGespeichert, onSchliessen,
}) => {
  const p = useAntragPruefen({ requestId, onSuccess: onGespeichert, onClose: onSchliessen, fehlerImFenster: true });
  const { request } = p;
  const entscheiden = request ? p.isPending && p.darfEntscheiden : !nurAnsehen;
  const breit = request ? !!request.photo_filename : mitFoto;

  const aktionen = request && p.isPending && p.darfEntscheiden ? (
    <>
      <WebKnopf onClick={onSchliessen} disabled={p.isSubmitting}>Abbrechen</WebKnopf>
      <WebKnopf art="gefahr" onClick={() => { void p.handleSubmit('reject'); }} disabled={p.isSubmitting}>Ablehnen</WebKnopf>
      <WebKnopf art="primaer" onClick={() => { void p.handleSubmit('approve'); }} disabled={p.isSubmitting}>Genehmigen</WebKnopf>
    </>
  ) : (
    <WebKnopf onClick={onSchliessen}>Schließen</WebKnopf>
  );

  let inhalt: React.ReactNode;
  if (!request) {
    inhalt = p.ladeFehler ? (
      <WebHinweis art="fehler" titel="Die Aktivität konnte nicht geladen werden.">
        <p className="web-beschreibung">{p.ladeFehler}</p>
        <WebKnopf klein onClick={p.erneutLaden} disabled={p.loading}>Erneut versuchen</WebKnopf>
      </WebHinweis>
    ) : (
      <p className="web-gedaempft" role="status">Die Aktivität wird geladen.</p>
    );
  } else {
    const angaben = (
      <div className="web-formular">
        <WebAngaben angaben={angabenVon(request)} beschriftung="Angaben zur Aktivität" />
        {p.isPending ? (
          <>
            <h3 className="web-gruppe">Entscheidung</h3>
            {p.darfEntscheiden ? (
              <>
                {p.ohneNetz && (
                  <WebHinweis art="hinweis">Ohne Verbindung wird die Entscheidung gespeichert, sobald du wieder online bist.</WebHinweis>
                )}
                <WebTextfeld
                  label="Grund für die Ablehnung"
                  zeilen={3}
                  platzhalter="Bitte gib einen Grund für die Ablehnung an..."
                  hinweis="Nur beim Ablehnen nötig. Die Person sieht den Grund in ihrer Meldung."
                  wert={p.adminComment}
                  onWert={p.setAdminComment}
                  deaktiviert={p.isSubmitting}
                />
              </>
            ) : (
              <WebHinweis art="hinweis">Über diesen Antrag entscheidet jemand anderes. Das Recht vergibt die Gemeindeleitung.</WebHinweis>
            )}
          </>
        ) : (
          <>
            <h3 className="web-gruppe">Bearbeitungsstatus</h3>
            <WebHinweis
              art={p.isApproved ? 'erfolg' : 'fehler'}
              rolle="status"
              titel={`${p.isApproved ? 'Verbucht' : 'Abgelehnt'}${request.approved_by_name ? ` von ${request.approved_by_name}` : ''} am ${datumUhrzeit(request.updated_at)}`}
            >
              {request.admin_comment && (
                <p className="web-beschreibung"><strong>{p.isApproved ? 'Kommentar' : 'Begründung'}: </strong>{request.admin_comment}</p>
              )}
            </WebHinweis>
          </>
        )}
      </div>
    );

    inhalt = request.photo_filename ? (
      <div className="web-feldpaar">
        {angaben}
        <section className="web-antrag-foto" aria-label="Nachweis-Foto">
          <h3 className="web-antrag-foto__titel">
            <IonIcon icon={ICON_KAMERA_GEFUELLT} className="app-icon-color--konfis" aria-hidden="true" />
            Nachweis-Foto
          </h3>
          {/* Fortschritt, „Erneut versuchen" und die Zeile ohne Netz kommen aus NachweisFoto. */}
          <NachweisFoto key={request.id} antragId={request.id} leitung />
          <WebKnopf art="gefahr" klein onClick={() => { void p.handleDeletePhoto(); }} disabled={p.deletingPhoto || p.isSubmitting}>
            <IonIcon icon={ICON_LOESCHEN_GEFUELLT} aria-hidden="true" />
            {p.deletingPhoto ? 'Lösche...' : 'Foto löschen'}
          </WebKnopf>
        </section>
      </div>
    ) : angaben;
  }

  return (
    <WebDialog
      titel={entscheiden ? 'Aktivität prüfen' : 'Aktivität ansehen'}
      onSchliessen={onSchliessen}
      breit={breit}
      aktionen={aktionen}
    >
      {p.fehler && <WebHinweis art="fehler" rolle="alert">{p.fehler}</WebHinweis>}
      {inhalt}
    </WebDialog>
  );
};

export default WebAntragPruefenDialog;
