// „Zeitslot auswählen" als Fenster der Web-Fassung (Simon, 15.10.2026: im
// Browser ab 992 px bekommt jedes Formular, das noch ein Modal der App öffnet,
// ein kompaktes Fenster). Geöffnet beim Anmelden an einem Event mit
// Zeitfenstern unter /konfi/events/:id; unter 992 px und in den Apps bleibt
// das Aktionsmenü der App (konfi/views/EventDetailView, handleRegister).
//
// Dieselbe Logik wie dort (konfi/zeitfensterWahl.ts): dieselben Einträge mit
// freien Plätzen, Warteliste und gesperrten Zeitfenstern, derselbe Satz, wenn
// ein gesperrtes gewählt wird, dieselbe Anmeldung (POST
// /konfi/events/:id/register mit timeslot_id). Wie im Menü der App meldet ein
// Klick auf ein Zeitfenster sofort an.
//
// Anders als das Menü der App schließt das Fenster erst, wenn die Anmeldung
// angekommen ist: Solange gesendet wird, schließt nichts das Fenster
// (Abbrechen, X, Escape, Klick daneben), und eine Ablehnung des Servers steht
// im Fenster statt oben. Ein gesperrtes Zeitfenster bleibt erreichbar (mit
// Tastatur und Vorleseprogramm) und sagt beim Klick, warum es nicht geht.

import React, { useState } from 'react';
import { ZEITSLOT_AUSGEBUCHT, type ZeitfensterOption } from '../../zeitfensterWahl';
import WebDialog from '../../../web/WebDialog';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import '../../../../theme/web/termine.css';

export interface WebZeitfensterDialogProps {
  optionen: readonly ZeitfensterOption[];
  /**
   * Anmelden mit diesem Zeitfenster (die Funktion der Seite), mit `melden`
   * für eine Meldung im Fenster. true: angemeldet -- das Fenster schließt.
   */
  onWaehlen: (timeslotId: number, melden: (text: string) => void) => Promise<boolean>;
  /** Eine Anmeldung läuft (Sperre der Seite gegen den Doppeltipp). */
  laeuft: boolean;
  onSchliessen: () => void;
}

const WebZeitfensterDialog: React.FC<WebZeitfensterDialogProps> = ({ optionen, onWaehlen, laeuft, onSchliessen }) => {
  const [fehler, setFehler] = useState<string | null>(null);

  const schliessen = () => {
    if (!laeuft) onSchliessen();
  };

  const waehlen = async (option: ZeitfensterOption) => {
    if (laeuft) return;
    if (option.gesperrt) {
      setFehler(ZEITSLOT_AUSGEBUCHT);
      return;
    }
    setFehler(null);
    const angemeldet = await onWaehlen(option.id, (text) => setFehler(text || null));
    if (angemeldet) onSchliessen();
  };

  return (
    <WebDialog
      titel="Zeitslot auswählen"
      beschreibung="Ein Klick auf ein Zeitfenster meldet dich an."
      onSchliessen={schliessen}
      gesperrt={laeuft}
      aktionen={<WebKnopf onClick={schliessen} disabled={laeuft}>Abbrechen</WebKnopf>}
    >
      <div className="web-formular">
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
        <div className="web-wahl__liste web-zeitfenster-wahl" role="group" aria-label="Zeitfenster">
          {optionen.map((option) => (
            <button
              key={option.id}
              type="button"
              className="web-wahl__zeile web-zeitfenster-wahl__zeile"
              aria-label={option.text}
              aria-disabled={option.gesperrt ? 'true' : undefined}
              disabled={laeuft}
              onClick={() => { void waehlen(option); }}
            >
              <span className="web-wahl__text">
                <span className="web-wahl__titel">{option.zeit}</span>
                <span className="web-wahl__beschreibung">{option.stand}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </WebDialog>
  );
};

export default WebZeitfensterDialog;
