// „Neue Umfrage" als Dialog der Web-Fassung (Simon, 15.10.2026,
// Seiten-Interview Seite 3: „poll modal ist noch app"). Geöffnet vom Knopf
// „Umfrage erstellen" im Kopf des Raums (WebChatRaum, nur im breiten Layout
// ab 992 px); in den Apps und im schmalen Fenster bleibt das Modal der App
// (modals/PollModal.tsx).
//
// Dieselben Felder, Schalter und Regeln wie in der App, dieselbe Logik
// (useUmfrageFormular): Frage, zwei bis zehn Antwortmöglichkeiten,
// Mehrfachauswahl (nicht bei exklusiven Optionen), Namen anzeigen und erst
// später aufdecken, nur einmal antworten, exklusive Optionen, Ablaufdatum --
// derselbe Rumpf an dieselbe Route (POST /chat/rooms/:id/polls). Danach lädt
// der Raum seinen Verlauf neu, wie in der App.
//
// Anders als in der App ist „Umfrage erstellen" nicht gesperrt, solange etwas
// fehlt: Was fehlt, steht nach dem Klick im Fenster (dieselben Sätze, die die
// App oben meldet). Fehler des Servers stehen ebenfalls im Fenster. Während
// des Sendens schließt nichts den Dialog (Abbrechen, X, Escape, Klick
// daneben), wie das X der App.

import React, { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ENTFERNEN, ICON_HINZUFUEGEN } from '../../shared/icons';
import { useApp } from '../../../contexts/AppContext';
import {
  ABLAUF_STUNDEN,
  OPTIONEN_MAX,
  OPTIONEN_MIN,
  UMFRAGE_HINWEISE,
  useUmfrageFormular,
} from '../useUmfrageFormular';
import WebDialog from '../../web/WebDialog';
import WebAuswahl from '../../web/WebAuswahl';
import WebFeld from '../../web/WebFeld';
import WebHinweis from '../../web/WebHinweis';
import WebKnopf from '../../web/WebKnopf';
import WebSchalter from '../../web/WebSchalter';
import WebTextfeld from '../../web/WebTextfeld';
import '../../../theme/web/chat.css';

export interface WebUmfrageDialogProps {
  roomId: number;
  /** Die Umfrage steht: Der Raum lädt seinen Verlauf neu. */
  onErstellt: () => void;
  onSchliessen: () => void;
}

const optionName = (index: number) => `Option ${index + 1}`;

const WebUmfrageDialog: React.FC<WebUmfrageDialogProps> = ({ roomId, onErstellt, onSchliessen }) => {
  const { isOnline } = useApp();
  const [meldung, setMeldung] = useState<string | null>(null);
  const {
    question, setQuestion, options, addOption, removeOption, updateOption,
    multipleChoice, setMultipleChoice, anonymous, namenAnzeigenSetzen,
    exclusiveOptions, exklusivSetzen, einmaligeAntwort, setEinmaligeAntwort,
    namenSpaeter, setNamenSpaeter, hasExpiration, setHasExpiration,
    expirationHours, setExpirationHours, creating, erstellen,
  } = useUmfrageFormular({ roomId, meldeFehler: setMeldung });

  // Eine neue Antwortmöglichkeit bekommt den Fokus; nach dem Entfernen geht
  // er auf die, die nachrückt (sonst die davor) -- der Knopf, der ihn trug,
  // ist weg, und ohne Ziel fiele er aus dem Dialog.
  const optionenRef = useRef<HTMLDivElement>(null);
  const fokusAufOption = useRef<number | null>(null);
  useEffect(() => {
    const index = fokusAufOption.current;
    if (index === null) return;
    fokusAufOption.current = null;
    const felder = optionenRef.current?.querySelectorAll<HTMLInputElement>('input') ?? [];
    felder[Math.min(index, felder.length - 1)]?.focus();
  }, [options.length]);

  // Eine Meldung soll nie unter der Knopfleiste liegen.
  const formular = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (meldung) formular.current?.querySelector<HTMLElement>('.web-hinweis')?.scrollIntoView?.({ block: 'nearest' });
  }, [meldung]);

  /** Eine Eingabe räumt die Meldung weg. */
  const aendern = (setzen: () => void) => {
    setzen();
    setMeldung(null);
  };

  const absenden = async () => {
    if (creating || !isOnline) return;
    setMeldung(null);
    if (await erstellen()) {
      onErstellt();
      onSchliessen();
    }
  };

  return (
    <WebDialog
      titel="Neue Umfrage"
      onSchliessen={onSchliessen}
      onAbsenden={() => { void absenden(); }}
      gesperrt={creating}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen} disabled={creating}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={creating || !isOnline}>
            {creating ? 'Wird erstellt …' : 'Umfrage erstellen'}
          </WebKnopf>
        </>
      )}
    >
      <div className="web-formular" ref={formular}>
        {meldung && <WebHinweis art="fehler" rolle="alert">{meldung}</WebHinweis>}
        {!isOnline && (
          <WebHinweis art="warnung">Du bist offline. Erstellen geht erst wieder mit Internetverbindung.</WebHinweis>
        )}

        <WebTextfeld
          label="Frage"
          pflicht
          zeilen={2}
          wert={question}
          onWert={(w) => aendern(() => setQuestion(w))}
          platzhalter="Deine Frage eingeben..."
          deaktiviert={creating}
        />

        <h3 className="web-gruppe">Antwortmöglichkeiten</h3>
        <div className="web-formular" ref={optionenRef}>
          {options.map((option, index) => (
            // Die Reihenfolge ist die Kennung, wie in der App.
            <div key={index} className="web-umfrage-option">
              <WebFeld
                label={optionName(index)}
                wert={option}
                onWert={(w) => aendern(() => updateOption(index, w))}
                platzhalter={optionName(index)}
                deaktiviert={creating}
              />
              {options.length > OPTIONEN_MIN && (
                <WebKnopf
                  art="text"
                  symbol
                  aria-label={`${optionName(index)} entfernen`}
                  title="Antwortoption entfernen"
                  onClick={() => {
                    fokusAufOption.current = index;
                    aendern(() => removeOption(index));
                  }}
                  disabled={creating}
                >
                  <IonIcon icon={ICON_ENTFERNEN} aria-hidden="true" />
                </WebKnopf>
              )}
            </div>
          ))}
        </div>
        {options.length < OPTIONEN_MAX && (
          <div className="web-formular__knoepfe">
            <WebKnopf
              onClick={() => {
                fokusAufOption.current = options.length;
                aendern(addOption);
              }}
              disabled={creating}
            >
              <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
              Option hinzufügen
            </WebKnopf>
          </div>
        )}

        <h3 className="web-gruppe">Einstellungen</h3>
        <WebSchalter
          label="Mehrfachauswahl"
          an={multipleChoice}
          onAn={(an) => aendern(() => setMultipleChoice(an))}
          deaktiviert={exclusiveOptions || creating}
          hinweis={UMFRAGE_HINWEISE.mehrfachauswahl(exclusiveOptions)}
        />
        <WebSchalter
          label="Namen anzeigen"
          an={!anonymous}
          onAn={(an) => aendern(() => namenAnzeigenSetzen(an))}
          deaktiviert={creating}
          hinweis={UMFRAGE_HINWEISE.namenAnzeigen(anonymous)}
        />
        {!anonymous && (
          <WebSchalter
            label="Namen erst später aufdecken"
            an={namenSpaeter}
            onAn={(an) => aendern(() => setNamenSpaeter(an))}
            deaktiviert={creating}
            hinweis={UMFRAGE_HINWEISE.namenSpaeter}
          />
        )}
        <WebSchalter
          label="Nur einmal antworten"
          an={einmaligeAntwort}
          onAn={(an) => aendern(() => setEinmaligeAntwort(an))}
          deaktiviert={creating}
          hinweis={UMFRAGE_HINWEISE.einmalig}
        />
        <WebSchalter
          label="Exklusive Optionen"
          an={exclusiveOptions}
          onAn={(an) => aendern(() => exklusivSetzen(an))}
          deaktiviert={creating}
          hinweis={UMFRAGE_HINWEISE.exklusiv}
        />
        <WebSchalter
          label="Ablaufdatum"
          an={hasExpiration}
          onAn={(an) => aendern(() => setHasExpiration(an))}
          deaktiviert={creating}
          hinweis={UMFRAGE_HINWEISE.ablauf}
        />
        {hasExpiration && (
          <WebAuswahl
            label="Ablaufzeit"
            wert={String(expirationHours)}
            onWert={(w) => aendern(() => setExpirationHours(Number(w)))}
            optionen={ABLAUF_STUNDEN.map(({ stunden, label }) => ({ wert: String(stunden), label }))}
            deaktiviert={creating}
          />
        )}
      </div>
    </WebDialog>
  );
};

export default WebUmfrageDialog;
