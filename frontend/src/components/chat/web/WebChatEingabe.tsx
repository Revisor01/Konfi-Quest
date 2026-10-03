// Die Eingabe unten im Raum (Web-Fassung): ein mehrzeiliges Feld, das mit dem
// Text waechst, Knopf fuer Anhaenge und Senden. Enter sendet, Umschalt+Enter
// bringt eine neue Zeile (nicht waehrend einer IME-Komposition, dort
// bestaetigt Enter nur die Zeichenwahl). Antwort-Bezug und gewaehlte Datei
// stehen als Streifen darueber; eine Datei laesst sich auch einfuegen
// (Strg+V mit einem Bild in der Zwischenablage). Was gesendet wird, regelt
// useChatRaum -- hier ist nur die Oberflaeche.
//
// Der Text steht im Feld selbst, nicht im Raum: Mit dem Text im Raum zeichnete
// jeder Tastendruck den ganzen Verlauf neu. Auch der Entwurf (chatEntwuerfe.ts)
// wird hier gefuehrt: Er beginnt mit dem Entwurf des Raums und wird bei jeder
// Aenderung gemerkt.

import React, { useEffect, useId, useLayoutEffect, useState } from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';
import { ICON_ANHANG, ICON_ANHANG_GEFUELLT, ICON_SCHLIESSEN, ICON_SENDEN_GEFUELLT } from '../../shared/icons';
import type { Message } from '../../../types/chat';
import { formatFileSize } from '../../../utils/helpers';
import { autoCapitalize } from '../../../utils/chatGrossschreibung';
import { antwortVorschau } from '../chatNachricht';
import { getSafePreviewUrl } from '../ChatRoomSections';
import WebKnopf from '../../web/WebKnopf';
import { entwurfLesen, entwurfMerken } from './chatEntwuerfe';

/** Hoechste Hoehe des Feldes in Pixeln (etwa acht Zeilen); darueber scrollt das Feld. */
const MAX_HOEHE = 200;

export interface WebChatEingabeProps {
  /** Der Raum, dem die Eingabe gehoert (fuer den Entwurf). */
  raumId: number;
  /** Sendet den Text (und eine gewaehlte Datei, ein gewaehlter Antwort-Bezug). */
  onSenden: (text: string) => void;
  uploading: boolean;
  datei: File | null;
  dateiVorschau: string | null;
  onDateiWaehlen: () => void;
  onDateiEntfernen: () => void;
  /** Eine Datei, die per Einfuegen oder Ablegen kam. */
  onDateiUebernehmen: (datei: File) => void;
  antwortAuf: Message | null;
  onAntwortVerwerfen: () => void;
  feldRef: React.RefObject<HTMLTextAreaElement | null>;
}

const WebChatEingabe: React.FC<WebChatEingabeProps> = ({
  raumId, onSenden, uploading, datei, dateiVorschau, onDateiWaehlen, onDateiEntfernen,
  onDateiUebernehmen, antwortAuf, onAntwortVerwerfen, feldRef,
}) => {
  const [text, setText] = useState(() => entwurfLesen(raumId));
  const kannSenden = (text.trim() !== '' || datei !== null) && !uploading;
  const hinweisId = useId();

  // Entwurf: was getippt, aber nicht gesendet ist, bleibt beim Raumwechsel stehen.
  useEffect(() => { entwurfMerken(raumId, text); }, [raumId, text]);

  // Hoehe = Inhalt, gedeckelt auf MAX_HOEHE; nach dem Senden (Text leer) wieder eine Zeile.
  useLayoutEffect(() => {
    const feld = feldRef.current;
    if (!feld) return;
    feld.style.height = 'auto';
    feld.style.height = `${Math.min(feld.scrollHeight, MAX_HOEHE)}px`;
    feld.style.overflowY = feld.scrollHeight > MAX_HOEHE ? 'auto' : 'hidden';
  }, [text, feldRef]);

  const absenden = () => {
    if (!kannSenden) return;
    onSenden(text);
    setText('');
    feldRef.current?.focus();
  };

  return (
    <form
      className="web-chat-eingabe"
      onSubmit={(e) => { e.preventDefault(); absenden(); }}
    >
      {antwortAuf && (
        <div className="web-chat-streifen">
          <div className="web-chat-streifen__text">
            <span className="web-chat-streifen__titel">Antwort an {antwortAuf.sender_name}</span>
            <span className="web-chat-streifen__inhalt">
              {antwortVorschau(antwortAuf.message_type, antwortAuf.file_name, antwortAuf.content)}
            </span>
          </div>
          <WebKnopf art="text" klein symbol aria-label="Antwort verwerfen" title="Antwort verwerfen" onClick={onAntwortVerwerfen}>
            <IonIcon icon={ICON_SCHLIESSEN} aria-hidden="true" />
          </WebKnopf>
        </div>
      )}

      {datei && (
        <div className="web-chat-streifen">
          {dateiVorschau && getSafePreviewUrl(dateiVorschau) ? (
            <img className="web-chat-streifen__bild" src={getSafePreviewUrl(dateiVorschau) ?? ''} alt="Vorschau" />
          ) : (
            <span className="web-chat-streifen__symbol" aria-hidden="true"><IonIcon icon={ICON_ANHANG_GEFUELLT} /></span>
          )}
          <div className="web-chat-streifen__text">
            <span className="web-chat-streifen__titel">{datei.name}</span>
            <span className="web-chat-streifen__inhalt">{formatFileSize(datei.size)}</span>
          </div>
          <WebKnopf art="text" klein symbol aria-label="Datei entfernen" title="Datei entfernen" onClick={onDateiEntfernen}>
            <IonIcon icon={ICON_SCHLIESSEN} aria-hidden="true" />
          </WebKnopf>
        </div>
      )}

      <div className="web-chat-eingabe__zeile">
        <WebKnopf art="text" symbol aria-label="Datei anhängen" title="Datei anhängen" onClick={onDateiWaehlen}>
          <IonIcon icon={ICON_ANHANG} aria-hidden="true" />
        </WebKnopf>
        <textarea
          ref={feldRef}
          className="web-chat-eingabe__feld"
          aria-label="Nachricht schreiben"
          aria-describedby={hinweisId}
          placeholder="Nachricht schreiben..."
          rows={1}
          value={text}
          spellCheck
          // Grossschreibung am Satzanfang wie in der App (utils/chatGrossschreibung).
          onChange={(e) => setText(autoCapitalize(e.target.value))}
          onKeyDown={(e) => {
            // Enter sendet, Umschalt+Enter bringt eine neue Zeile. Waehrend einer
            // IME-Komposition (z. B. japanische Tastatur) bestaetigt Enter nur
            // die Zeichenwahl.
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
            e.preventDefault();
            absenden();
          }}
          onPaste={(e) => {
            const eingefuegt = e.clipboardData?.files?.[0];
            if (eingefuegt) {
              e.preventDefault();
              onDateiUebernehmen(eingefuegt);
            }
          }}
        />
        <WebKnopf art="primaer" symbol absenden aria-label="Nachricht senden" title="Senden (Enter)" disabled={!kannSenden}>
          {uploading ? <IonSpinner name="dots" /> : <IonIcon icon={ICON_SENDEN_GEFUELLT} aria-hidden="true" />}
        </WebKnopf>
      </div>
      <p id={hinweisId} className="web-chat-eingabe__hinweis">Enter sendet · Umschalt+Enter für eine neue Zeile</p>
    </form>
  );
};

export default WebChatEingabe;
