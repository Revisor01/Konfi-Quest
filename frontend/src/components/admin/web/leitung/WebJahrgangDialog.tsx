// Jahrgang anlegen und bearbeiten als Dialog der Web-Fassung (Simon,
// 11.10.2026: „Web braucht eigene kompaktere Modale überall"): Name,
// Punktearten mit ihren Zielen, Konfispruch-Auswahl und -- beim Anlegen durch
// die Gemeindeleitung -- der direkte Zugriff für Leitung und Team. Dieselben
// Felder wie das Fenster der App (JahrgangModal in
// pages/AdminJahrgaengeePage.tsx), dieselbe Logik (useJahrgangFormular):
// mindestens eine Punkteart bleibt an, die Ziele reichen von 1 bis 20,
// offline geht das Speichern in die Warteschlange.
//
// Meldungen (Prüfung, Server) stehen oben im Formular als role="alert" und
// rücken beim Erscheinen ins Bild -- nicht als Meldung oben: Die ist ein
// IonToast in <ion-app> und laege unter dem abgedunkelten Grund dieses
// Dialogs (Gegenprüfung 11.10.2026). Die nächste Eingabe räumt sie weg.
//
// Während des Speicherns (`loading` des Hooks steht nur dann) schließt nichts
// den Dialog (Abbrechen, X, Escape, Klick daneben), wie „Schließen" in der
// App: Das Speichern liefe sonst unbemerkt weiter, und eine Ablehnung des
// Servers ginge ins Leere.
//
// Geoeffnet von AdminJahrgaengeePage im breiten Layout ("Neuer Jahrgang",
// "Bearbeiten"); unter 992 px und in den Apps bleibt das Fenster der App.

import React, { useEffect, useRef } from 'react';
import { useApp } from '../../../../contexts/AppContext';
import { rollenName } from '../../../../utils/rollenNamen';
import { useJahrgangFormular, ZIEL_MAX, ZIEL_MIN, type JahrgangVorlage } from '../../useJahrgangFormular';
import WebDialog from '../../../web/WebDialog';
import WebAuswahl from '../../../web/WebAuswahl';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebMehrfachAuswahl from '../../../web/WebMehrfachAuswahl';
import WebSchalter from '../../../web/WebSchalter';

export interface WebJahrgangDialogProps {
  /** Der bearbeitete Jahrgang; null: ein neuer. */
  jahrgang: JahrgangVorlage | null;
  onSchliessen: () => void;
  /** Nach dem Speichern (auch eingereiht): Liste neu laden und schließen. */
  onGespeichert: () => void;
}

const ZIELE = Array.from({ length: ZIEL_MAX - ZIEL_MIN + 1 }, (_, i) => {
  const wert = String(ZIEL_MIN + i);
  return { wert, label: wert };
});

/** Satz unter dem Schalter, der nicht aus darf: die andere Punkteart ist schon aus. */
const letztePunkteart = (art: string, konfis?: number): string =>
  `Mindestens ein Punkt-Typ muss aktiv bleiben.${konfis ? ` ${konfis} Konfis haben bereits ${art}-Punkte.` : ''}`;

const WebJahrgangDialog: React.FC<WebJahrgangDialogProps> = ({ jahrgang, onSchliessen, onGespeichert }) => {
  const { isOnline } = useApp();
  const { loading, formData, aendern, fehler, zuweisbare, ausgewaehlt, personenWaehlen, zuweisungMoeglich, handleSubmit } = useJahrgangFormular(
    jahrgang,
    onGespeichert,
    { fehlerImDialog: true },
  );
  // Eine Meldung rückt ins Bild (mit vielen Personen zur Wahl rollt der Dialog).
  const formular = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (fehler) formular.current?.querySelector<HTMLElement>('[role="alert"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [fehler]);
  const godi = formData.gottesdienst_enabled;
  const gemeinde = formData.gemeinde_enabled;

  return (
    <WebDialog
      titel={jahrgang ? 'Jahrgang bearbeiten' : 'Neuer Jahrgang'}
      beschreibung="Hier steuerst du diesen Jahrgang zentral: Punkteziele und die Freischaltung der Konfispruch-Auswahl."
      onSchliessen={onSchliessen}
      onAbsenden={() => { void handleSubmit(); }}
      gesperrt={loading}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen} disabled={loading}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={loading}>{jahrgang ? 'Speichern' : 'Anlegen'}</WebKnopf>
        </>
      )}
    >
      <div className="web-formular" ref={formular}>
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
        {!isOnline && (
          <WebHinweis art="warnung">
            Du bist offline. Der Jahrgang wird gespeichert, sobald du wieder online bist.
          </WebHinweis>
        )}
        <WebFeld
          label="Name"
          pflicht
          wert={formData.name}
          onWert={(w) => aendern({ name: w })}
          platzhalter="z. B. Jahrgang 2024/2025"
          deaktiviert={loading}
        />

        <h3 className="web-gruppe">Punkte</h3>
        <div className="web-feldpaar">
          <div className="web-formular">
            <WebSchalter
              label="Gottesdienst-Punkte aktiviert"
              an={godi}
              onAn={(an) => aendern({ gottesdienst_enabled: an })}
              deaktiviert={loading || !gemeinde}
              hinweis={!gemeinde && godi ? letztePunkteart('Gottesdienst', jahrgang?.konfi_count) : undefined}
            />
            {godi && (
              <WebAuswahl
                label="Ziel Gottesdienst"
                wert={String(formData.target_gottesdienst)}
                onWert={(w) => aendern({ target_gottesdienst: Number(w) })}
                optionen={ZIELE}
                deaktiviert={loading}
              />
            )}
          </div>
          <div className="web-formular">
            <WebSchalter
              label="Gemeinde-Punkte aktiviert"
              an={gemeinde}
              onAn={(an) => aendern({ gemeinde_enabled: an })}
              deaktiviert={loading || !godi}
              hinweis={!godi && gemeinde ? letztePunkteart('Gemeinde', jahrgang?.konfi_count) : undefined}
            />
            {gemeinde && (
              <WebAuswahl
                label="Ziel Gemeinde"
                wert={String(formData.target_gemeinde)}
                onWert={(w) => aendern({ target_gemeinde: Number(w) })}
                optionen={ZIELE}
                deaktiviert={loading}
              />
            )}
          </div>
        </div>

        <h3 className="web-gruppe">Konfispruch</h3>
        <WebSchalter
          label="Konfispruch-Auswahl"
          an={formData.konfspruch_enabled}
          onAn={(an) => aendern({ konfspruch_enabled: an })}
          deaktiviert={loading}
          hinweis="Konfis dieses Jahrgangs können ihren Konfispruch wählen."
        />

        {/* Direkt-Zuweisung: nur beim Anlegen durch die Gemeindeleitung und nur,
            wenn es Leitung oder Team gibt -- wie in der App. */}
        {zuweisungMoeglich && zuweisbare.length > 0 && (
          <>
            <h3 className="web-gruppe">Zugriff für Leitung &amp; Team</h3>
            <WebMehrfachAuswahl
              label="Personen mit Zugriff"
              eintraege={zuweisbare.map((p) => ({ wert: String(p.id), titel: p.display_name, beschreibung: rollenName(p.role_name) }))}
              werte={zuweisbare.filter((p) => ausgewaehlt[p.id]).map((p) => String(p.id))}
              onWerte={(werte) => personenWaehlen(Object.fromEntries(werte.map((w) => [Number(w), true])))}
              leerText="Niemand aus Leitung oder Team."
              hinweis="Ausgewählte Personen sehen und bearbeiten den neuen Jahrgang sofort. Ohne Auswahl kannst du die Zuweisung später unter „Benutzer:innen“ vergeben."
              deaktiviert={loading}
            />
          </>
        )}
      </div>
    </WebDialog>
  );
};

export default WebJahrgangDialog;
