// „Person einladen" als Dialog der Web-Fassung (/admin/users ab 992 px).
// Simon, 15.10.2026: jedes Formular, das im Browser noch ein Modal der App
// öffnet, bekommt ein kompaktes Fenster der Web-Fassung; in den Apps und unter
// 992 px bleibt das Modal (modals/EinladungModal), wie es ist.
//
// Dieselben Angaben und dieselbe Logik wie in der App (usePersonEinladen):
// Benutzername oder E-Mail und die Rolle -- Gemeindeleitung, Leitung oder
// Teamer:in, nie Konfi --, Senden erst mit beidem und nur mit Netz, an
// POST /einladungen. Die Rollen erklärt derselbe Satz wie beim Anlegen einer
// Benutzer:in (rollenBeschreibung), wie in der App.
//
// Fehler stehen im Dialog (role="alert"). Während gesendet wird, schließt
// nichts den Dialog (Abbrechen, X, Escape, Klick daneben). Wie in der App gibt
// es keine Rückfrage beim Schließen.

import React from 'react';
import { rollenName } from '../../../../utils/rollenNamen';
import { usePersonEinladen } from '../../usePersonEinladen';
import { rollenBeschreibung } from '../../useBenutzerFormular';
import WebDialog from '../../../web/WebDialog';
import WebAuswahl from '../../../web/WebAuswahl';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';

export interface WebPersonEinladenDialogProps {
  onSchliessen: () => void;
  /** Gesendet: die Seite schließt den Dialog und lädt Personen und offene Einladungen neu. */
  onEingeladen: () => void;
}

const WebPersonEinladenDialog: React.FC<WebPersonEinladenDialogProps> = ({ onSchliessen, onEingeladen }) => {
  const { kennung, setKennung, rolleId, setRolleId, rollen, istGueltig, isSubmitting, isOnline, fehler, einladen } = usePersonEinladen({
    onSuccess: onEingeladen,
    fehlerImDialog: true,
  });
  const gewaehlt = rollen.find((r) => r.id === rolleId);

  return (
    <WebDialog
      titel="Person einladen"
      beschreibung="Die Person braucht bereits ein Konto. Sie behält Benutzername und Passwort und entscheidet selbst, ob sie die Einladung annimmt."
      onSchliessen={onSchliessen}
      onAbsenden={() => { if (istGueltig && isOnline) void einladen(); }}
      gesperrt={isSubmitting}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen} disabled={isSubmitting}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={!istGueltig || isSubmitting || !isOnline}>Einladung senden</WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
        {!isOnline && (
          <WebHinweis art="warnung">Du bist offline. Einladen geht erst wieder mit Internetverbindung.</WebHinweis>
        )}
        <WebFeld
          label="Benutzername oder E-Mail"
          pflicht
          wert={kennung}
          onWert={setKennung}
          platzhalter="z. B. anna.beispiel"
          deaktiviert={isSubmitting}
        />
        <WebAuswahl
          label="Rolle"
          pflicht
          wert={rolleId === null ? '' : String(rolleId)}
          onWert={(w) => setRolleId(w === '' ? null : Number(w))}
          optionen={[
            ...(rolleId === null ? [{ wert: '', label: 'Bitte wählen' }] : []),
            ...rollen.map((r) => ({ wert: String(r.id), label: rollenName(r.name) })),
          ]}
          deaktiviert={isSubmitting}
          hinweis={gewaehlt ? rollenBeschreibung(gewaehlt.name) : undefined}
        />
        <WebHinweis art="hinweis">
          Die Rolle gilt nur in dieser Gemeinde. In ihrer eigenen Gemeinde bleibt alles, wie es ist.
          Konfis werden über einen Einladungscode aufgenommen, nicht über eine Einladung.
        </WebHinweis>
      </div>
    </WebDialog>
  );
};

export default WebPersonEinladenDialog;
