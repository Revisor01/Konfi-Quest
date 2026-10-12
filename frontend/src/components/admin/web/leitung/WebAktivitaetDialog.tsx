// „Aktivität eintragen" als Dialog der Web-Fassung (Simon, 11.10.2026: „Web
// braucht eigene kompaktere Modale überall"), geöffnet von der Detailseite
// einer Konfi bzw. Teamer:in (KonfiDetailView im breiten Layout). Oben die
// Aktivität -- eine Liste mit Suche, nach Art und Name geordnet, darunter Art,
// Punkte und Kategorien --, dann Datum und Kommentar.
//
// Die Logik ist die der App (admin/modals/useAktivitaetEintragen.ts):
// dieselbe Liste (nur aktive Punktearten des Jahrgangs), dieselbe Route,
// ohne Netz dieselbe Warteschlange. Anders als in der App steht ein Fehler im
// Dialog, und „Eintragen" ohne gewählte Aktivität sagt, was fehlt.
// Während des Eintragens schließt nichts den Dialog (Abbrechen, X, Escape,
// Klick daneben), wie das X der App: Ein Fehler des Servers ginge sonst ins Leere.
//
// Ohne Netz: Die Liste ist der zuletzt geladene Stand, und der Hinweis sagt,
// dass der Eintrag nachgeht. Gab es nie einen Stand, verspricht der Dialog das
// nicht, sondern sagt, dass die Liste erst mit Verbindung kommt; „Eintragen“
// ist dann gesperrt (Gegenprüfung 11.10.2026).

import React from 'react';
import { mitEinheit } from '../../../../utils/supportStatistik';
import { PUNKTEART_NAME, type Punkteart, type PunkteartFlags } from '../../../../utils/punktearten';
import { useAktivitaetEintragen, type AktivitaetZurWahl } from '../../modals/useAktivitaetEintragen';
import WebDialog from '../../../web/WebDialog';
import WebAuswahlSuche, { type WebWahlEintrag } from '../../../web/WebAuswahlSuche';
import WebDatum from '../../../web/WebDatum';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebTextfeld from '../../../web/WebTextfeld';

export interface WebAktivitaetDialogProps {
  konfiId: number;
  /** Name der Person, für die Zeile unter der Überschrift. */
  personName: string;
  /** Rolle der Person ('konfi' bzw. 'teamer'): bestimmt die angebotenen Aktivitäten. */
  targetRole: string;
  punkteartFlags?: PunkteartFlags;
  /** Nach dem Speichern bzw. Einreihen: die Seite lädt neu. */
  onGespeichert: () => Promise<void>;
  onSchliessen: () => void;
}

const istPunkteart = (art: string | null | undefined): art is Punkteart => art === 'gottesdienst' || art === 'gemeinde';

/** Zweite Zeile eines Eintrags: Art und Punkte (nicht bei Teamer:innen, wie in der App), Kategorien. */
const beschreibung = (a: AktivitaetZurWahl, istTeamer: boolean): string | undefined => {
  const teile = istTeamer ? [] : [
    istPunkteart(a.type) ? PUNKTEART_NAME[a.type] : null,
    mitEinheit(a.points, 'Punkt', 'Punkte'),
  ];
  const kategorien = (a.categories ?? []).map((k) => k.name).join(', ');
  const text = [...teile, kategorien].filter(Boolean).join(' · ');
  return text || undefined;
};

const WebAktivitaetDialog: React.FC<WebAktivitaetDialogProps> = ({
  konfiId, personName, targetRole, punkteartFlags, onGespeichert, onSchliessen,
}) => {
  const {
    aktivitaetenSortiert, laedt, ladeFehler, ausSpeicher, selectedActivity, setSelectedActivity, comment, setComment,
    selectedDate, setSelectedDate, isSubmitting, ohneNetz, fehler, handleSave,
  } = useAktivitaetEintragen({ konfiId, targetRole, punkteartFlags, onSave: onGespeichert, schliessen: onSchliessen, fehlerImFenster: true });
  const istTeamer = targetRole === 'teamer';

  const eintraege: WebWahlEintrag[] = aktivitaetenSortiert.map((a) => ({
    wert: String(a.id),
    titel: a.name,
    beschreibung: beschreibung(a, istTeamer),
  }));
  const leerText = laedt
    ? 'Die Aktivitäten werden geladen.'
    : ladeFehler
      ? (ohneNetz
        ? 'Ohne Verbindung lassen sich die Aktivitäten nicht laden. Die Liste erscheint, sobald du wieder online bist.'
        : 'Die Aktivitäten konnten nicht geladen werden.')
      : 'Es gibt noch keine Aktivitäten, die du eintragen kannst.';
  // Die Zusage gilt nur, wenn es etwas zu wählen gibt.
  const offlineZusage = ohneNetz && eintraege.length > 0;

  return (
    <WebDialog
      titel="Aktivität eintragen"
      beschreibung={`Für ${personName}`}
      onSchliessen={onSchliessen}
      onAbsenden={() => { void handleSave(); }}
      gesperrt={isSubmitting}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen} disabled={isSubmitting}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={isSubmitting || eintraege.length === 0}>Eintragen</WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
        {offlineZusage && (
          <WebHinweis art="hinweis">
            {'Ohne Verbindung wird die Aktivität eingetragen, sobald du wieder online bist.'}
            {ausSpeicher && ' Die Liste zeigt den zuletzt geladenen Stand.'}
          </WebHinweis>
        )}
        <WebAuswahlSuche
          label="Aktivität"
          eintraege={eintraege}
          wert={selectedActivity === null ? '' : String(selectedActivity)}
          onWert={(w) => setSelectedActivity(Number(w))}
          suchePlatzhalter="Aktivität suchen"
          leerText={leerText}
          deaktiviert={isSubmitting}
        />
        <WebDatum label="Datum" art="datum" pflicht wert={selectedDate} onWert={setSelectedDate} deaktiviert={isSubmitting} />
        <WebTextfeld
          label="Kommentar"
          zeilen={3}
          platzhalter="Zusätzliche Informationen..."
          hinweis="Freiwillig."
          wert={comment}
          onWert={setComment}
          deaktiviert={isSubmitting}
        />
      </div>
    </WebDialog>
  );
};

export default WebAktivitaetDialog;
