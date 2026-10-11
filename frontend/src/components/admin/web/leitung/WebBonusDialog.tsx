// „Bonuspunkte vergeben" als Dialog der Web-Fassung (Simon, 11.10.2026: „Web
// braucht eigene kompaktere Modale überall"), geöffnet von der Detailseite
// einer Konfi (KonfiDetailView im breiten Layout): Bezeichnung, Punkte und
// Typ nebeneinander, Datum, Begründung. Statt des Schiebereglers der App ein
// Zahlenfeld von 1 bis 10; der Typ bietet nur die Punktearten an, die der
// Jahrgang nicht abgeschaltet hat, und sagt, welche fehlt.
//
// Die Logik ist die der App (admin/modals/useBonusVergeben.ts): dieselbe
// Vorbelegung, derselbe Rumpf an dieselbe Route, ohne Netz dieselbe
// Warteschlange mit derselben Kennung. Anders als in der App steht ein Fehler
// im Dialog, und „Vergeben" mit fehlender Angabe sagt, was fehlt.
// Während des Vergebens schließt nichts den Dialog (Abbrechen, X, Escape,
// Klick daneben), wie das X der App: Ein Fehler des Servers ginge sonst ins Leere.

import React, { useState } from 'react';
import { PUNKTEART_NAME, type Punkteart, type PunkteartFlags } from '../../../../utils/punktearten';
import { BONUS_MAX, BONUS_MIN, useBonusVergeben } from '../../modals/useBonusVergeben';
import WebDialog from '../../../web/WebDialog';
import WebAuswahl from '../../../web/WebAuswahl';
import WebDatum from '../../../web/WebDatum';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebTextfeld from '../../../web/WebTextfeld';

export interface WebBonusDialogProps {
  konfiId: number;
  /** Name der Konfi, für die Zeile unter der Überschrift. */
  personName: string;
  punkteartFlags?: PunkteartFlags;
  /** Nach dem Speichern bzw. Einreihen: die Seite lädt neu. */
  onGespeichert: () => Promise<void>;
  onSchliessen: () => void;
}

const ALLE_ARTEN: Punkteart[] = ['gottesdienst', 'gemeinde'];

const WebBonusDialog: React.FC<WebBonusDialogProps> = ({ konfiId, personName, punkteartFlags, onGespeichert, onSchliessen }) => {
  const {
    name, setName, points, setPoints, reason, setReason, type, setType, verfuegbareArten,
    selectedDate, setSelectedDate, isSubmitting, ohneNetz, fehler, handleSave,
  } = useBonusVergeben({ konfiId, punkteartFlags, onSave: onGespeichert, schliessen: onSchliessen, fehlerImFenster: true });
  // Das Zahlenfeld darf beim Tippen leer sein; die Prüfung sagt dann, was fehlt.
  const [punkteText, setPunkteText] = useState(String(points));

  const abgeschaltet = ALLE_ARTEN.filter((art) => !verfuegbareArten.includes(art));
  const typHinweis = verfuegbareArten.length === 0
    ? 'Im Jahrgang ist keine Punkteart aktiv.'
    : abgeschaltet.length > 0
      ? `${abgeschaltet.map((art) => PUNKTEART_NAME[art]).join(' und ')} ist im Jahrgang abgeschaltet.`
      : undefined;

  return (
    <WebDialog
      titel="Bonuspunkte vergeben"
      beschreibung={`Für ${personName}`}
      onSchliessen={onSchliessen}
      onAbsenden={() => { void handleSave(); }}
      gesperrt={isSubmitting}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen} disabled={isSubmitting}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={isSubmitting}>Vergeben</WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
        {ohneNetz && (
          <WebHinweis art="hinweis">Ohne Verbindung werden die Bonuspunkte vergeben, sobald du wieder online bist.</WebHinweis>
        )}
        <WebFeld
          label="Bezeichnung"
          pflicht
          platzhalter="z.B. Hilfe beim Aufräumen"
          wert={name}
          onWert={setName}
          deaktiviert={isSubmitting}
        />
        <div className="web-feldpaar">
          <WebFeld
            label="Punkte"
            pflicht
            typ="number"
            min={BONUS_MIN}
            max={BONUS_MAX}
            schritt={1}
            wert={punkteText}
            onWert={(w) => {
              setPunkteText(w);
              setPoints(w.trim() === '' ? Number.NaN : Number(w));
            }}
            hinweis={`${BONUS_MIN} bis ${BONUS_MAX}`}
            deaktiviert={isSubmitting}
          />
          <WebAuswahl
            label="Typ"
            pflicht
            wert={type ?? ''}
            onWert={(w) => setType(w as Punkteart)}
            optionen={verfuegbareArten.length > 0
              ? verfuegbareArten.map((art) => ({ wert: art, label: PUNKTEART_NAME[art] }))
              : [{ wert: '', label: 'Keine Punkteart aktiv' }]}
            deaktiviert={isSubmitting || verfuegbareArten.length === 0}
            hinweis={typHinweis}
          />
        </div>
        <WebDatum label="Datum" art="datum" pflicht wert={selectedDate} onWert={setSelectedDate} deaktiviert={isSubmitting} />
        <WebTextfeld
          label="Begründung"
          zeilen={3}
          platzhalter="Warum werden diese Bonuspunkte vergeben?"
          hinweis="Freiwillig; steht hinter der Bezeichnung in der Punktegeschichte."
          wert={reason}
          onWert={setReason}
          deaktiviert={isSubmitting}
        />
      </div>
    </WebDialog>
  );
};

export default WebBonusDialog;
