// Eine Nachricht in der Web-Fassung des Chats: Blase mit Absender, Antwort-
// Bezug, Text mit Links, Bild, Video, Datei oder Umfrage, Zeit und Haken, die
// Reaktionen darunter. Die Aktionen (reagieren, antworten, kopieren, teilen,
// loeschen) stehen in einer Leiste, die beim Ueberfahren und bei Fokus
// erscheint -- statt des langen Drucks der App. Was gezeigt wird, rechnet
// chatNachricht.ts, dieselben Funktionen wie die Blase der App; Medien
// kommen aus denselben Bausteinen (LazyImage, VideoPreview).

import React, { useEffect, useRef } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_ANHANG_GEFUELLT,
  ICON_ANTWORTEN,
  ICON_DATEI_GEFUELLT,
  ICON_FROEHLICH,
  ICON_HAKEN_GEFUELLT,
  ICON_KOPIEREN,
  ICON_LOESCHEN,
  ICON_TEILEN,
  ICON_UHRZEIT,
  ICON_WARNHINWEIS,
  ICON_WEITER_GEFUELLT,
} from '../../shared/icons';
import type { ChatRoomBase, Message } from '../../../types/chat';
import { REACTION_EMOJIS } from '../constants';
import { formatFileSize } from '../../../utils/helpers';
import { ladeText, sendeText } from '../../../utils/fortschritt';
import { rollenName } from '../../../utils/rollenNamen';
import {
  antwortVorschau,
  getMimeFromFileName,
  istBildDatei,
  istVideoDatei,
  linkifyText,
  nachrichtZeit,
  reaktionenGruppieren,
} from '../chatNachricht';
import { sendeFehlerText } from '../sendeFehler';
import LazyImage from '../LazyImage';
import VideoPreview from '../VideoPreview';
import FortschrittsBalken from '../../shared/FortschrittsBalken';
import WebUmfrage from './WebUmfrage';

export interface WebNachrichtNutzer {
  id: number;
  type: 'admin' | 'konfi' | 'teamer' | 'user';
  display_name: string;
  role_name?: string;
}

export interface WebNachrichtProps {
  message: Message;
  room: ChatRoomBase;
  user: WebNachrichtNutzer | null;
  /** Dieselbe Person schreibt weiter: Name und Kreis stehen nur einmal. */
  fortsetzung: boolean;
  /** Der Reaktions-Picker dieser Nachricht ist offen. */
  pickerOffen: boolean;
  ladendeDatei?: { pfad: string; prozent: number | null } | null;
  uploadFortschritt?: { localId: string; prozent: number } | null;
  /** Gibt es ein Teilen-Fenster des Browsers (navigator.share)? */
  kannTeilen: boolean;
  onAntworten: (message: Message) => void;
  onKopieren: (message: Message) => void;
  onTeilen: (message: Message) => void;
  onLoeschen: (messageId: number) => void;
  onReaktion: (messageId: number, emoji: string) => void;
  onPickerOeffnen: (message: Message) => void;
  onPickerSchliessen: () => void;
  onAbstimmen: (messageId: number, optionIndex: number) => void;
  onDatei: (filePath: string, fileName: string, mimeType: string) => void;
  onError: (error: string) => void;
  onErneutSenden: (message: Message) => void;
  onVerwerfen: (message: Message) => void;
}

const WebNachricht: React.FC<WebNachrichtProps> = ({
  message, room, user, fortsetzung, pickerOffen, ladendeDatei, uploadFortschritt, kannTeilen,
  onAntworten, onKopieren, onTeilen, onLoeschen, onReaktion, onPickerOeffnen, onPickerSchliessen,
  onAbstimmen, onDatei, onError, onErneutSenden, onVerwerfen,
}) => {
  const eigene = message.sender_id === user?.id && message.sender_type === user?.type;
  const mitAbsender = !eigene && room.type !== 'direct';
  // Eigene Funktionsbezeichnung vor dem festen Rollenwort (utils/rollenNamen);
  // sender_role_display_name traegt in bestehenden Gemeinden die alten Namen.
  const rolle = message.sender_role_title
    || (message.sender_role_name || message.sender_role_display_name
      ? rollenName(message.sender_role_name, message.sender_role_display_name)
      : '');
  const laedtGerade = ladendeDatei != null && ladendeDatei.pfad === message.file_path;
  const sendetGerade = uploadFortschritt != null && message.localId != null && uploadFortschritt.localId === message.localId;
  const sendeFehlerGrund = message.queueStatus === 'error' ? sendeFehlerText(message.sendeFehlerStatus) : null;
  // Loeschen: Admins jede Nachricht der Organisation, Teamer:innen nur ihre
  // eigenen (das Backend lehnt fremde mit 403 ab); Konfis nie.
  const darfLoeschen = !!user?.role_name && (
    ['admin', 'org_admin'].includes(user.role_name) || (user.role_name === 'teamer' && eigene)
  );
  const hatText = !!message.content && !message.is_deleted && message.message_type !== 'poll';

  // Picker per Tastatur: Fokus auf die erste Reaktion, danach zurueck auf den Knopf.
  const pickerKnopf = useRef<HTMLButtonElement>(null);
  const ersteReaktion = useRef<HTMLButtonElement>(null);
  const perTastatur = useRef(false);
  useEffect(() => {
    if (pickerOffen && perTastatur.current) ersteReaktion.current?.focus();
    if (!pickerOffen && perTastatur.current) {
      perTastatur.current = false;
      pickerKnopf.current?.focus();
    }
  }, [pickerOffen]);

  if (message.deleted) {
    return (
      <div className="web-chat-geloescht">
        <span>Diese Nachricht wurde gelöscht</span>
      </div>
    );
  }

  const springeZurAntwort = () => {
    const ziel = document.getElementById(`msg-${message.reply_to_id}`);
    if (!ziel) return;
    ziel.scrollIntoView({ block: 'center' });
    ziel.classList.add('web-chat-nachricht--hervorgehoben');
    setTimeout(() => ziel.classList.remove('web-chat-nachricht--hervorgehoben'), 1500);
  };

  const inhalt = () => {
    if (message.is_deleted) {
      return <div className="web-chat-text web-chat-text--geloescht">{message.content}</div>;
    }
    if (message.message_type === 'poll' && message.question && message.options) {
      return <WebUmfrage message={message} user={user} onAbstimmen={onAbstimmen} />;
    }
    if (message.file_path) {
      const pfad = message.file_path;
      const name = message.file_name;
      return (
        <>
          {message.content && <div className="web-chat-text web-chat-text--vor-datei">{linkifyText(message.content, { className: 'web-chat-link' })}</div>}
          {istBildDatei(name) ? (
            <div className="web-chat-bild">
              <LazyImage
                filePath={pfad}
                fileName={name || 'Bild'}
                maxHoehe={360}
                onError={() => onError('Fehler beim Laden des Bildes')}
                onClick={() => onDatei(pfad, name || 'Bild', getMimeFromFileName(name || 'bild.jpg'))}
              />
              <div className="web-chat-bild__name">
                {name} {message.file_size ? `• ${formatFileSize(message.file_size)}` : ''}
              </div>
            </div>
          ) : istVideoDatei(name) ? (
            <VideoPreview
              filePath={pfad}
              fileName={name}
              fileSize={message.file_size}
              onError={(fehler) => onError('Fehler beim Laden des Videos: ' + fehler)}
            />
          ) : (
            <button
              type="button"
              className="web-chat-datei"
              aria-label={`Datei öffnen: ${name || 'Datei'}`}
              onClick={() => onDatei(pfad, name || 'Datei', getMimeFromFileName(name || ''))}
            >
              <IonIcon icon={name?.includes('.pdf') ? ICON_DATEI_GEFUELLT : ICON_ANHANG_GEFUELLT} aria-hidden="true" />
              <span className="web-chat-datei__text">
                <span className="web-chat-datei__name">{name}</span>
                {laedtGerade ? (
                  <span className="web-chat-datei__groesse">{ladeText(ladendeDatei?.prozent)}</span>
                ) : message.file_size ? (
                  <span className="web-chat-datei__groesse">{formatFileSize(message.file_size)}</span>
                ) : null}
                {laedtGerade && ladendeDatei?.prozent != null && (
                  <FortschrittsBalken prozent={ladendeDatei.prozent} beschriftung={`Datei wird geladen: ${ladendeDatei.prozent} Prozent`} />
                )}
              </span>
              <IonIcon icon={ICON_WEITER_GEFUELLT} aria-hidden="true" />
            </button>
          )}
        </>
      );
    }
    return <div className="web-chat-text">{linkifyText(message.content, { className: 'web-chat-link' })}</div>;
  };

  const klassen = [
    'web-chat-nachricht',
    eigene ? 'web-chat-nachricht--eigene' : 'web-chat-nachricht--fremde',
    fortsetzung ? 'web-chat-nachricht--fortsetzung' : '',
    message.queueStatus === 'pending' ? 'web-chat-nachricht--wartet' : '',
  ].filter(Boolean).join(' ');

  return (
    // tabIndex -1: Ein Klick (auch ein Tipp auf dem iPad) fokussiert die
    // Nachricht, und :focus-within zeigt die Aktionsleiste, wo es kein
    // Ueberfahren gibt.
    <div id={`msg-${message.id}`} className={klassen} tabIndex={-1}>
      {mitAbsender && (
        fortsetzung
          ? <span className="web-chat-avatar web-chat-avatar--platz" aria-hidden="true" />
          : (
            <span className={`web-chat-avatar web-chat-avatar--${message.sender_type}`} aria-hidden="true">
              {(message.sender_name || 'U').charAt(0).toUpperCase()}
            </span>
          )
      )}

      <div className="web-chat-spalte">
        <div className="web-chat-blase">
          {mitAbsender && !fortsetzung && (
            <div className="web-chat-absender">
              {message.sender_name || 'Unbekannter User'}
              {rolle && <span className="web-chat-absender__rolle">({rolle})</span>}
            </div>
          )}

          {message.reply_to_id && (
            <button
              type="button"
              className="web-chat-bezug"
              aria-label="Zur beantworteten Nachricht springen"
              onClick={springeZurAntwort}
            >
              <span className="web-chat-bezug__name">{message.reply_to_sender_name}</span>
              <span className="web-chat-bezug__text">
                {antwortVorschau(message.reply_to_message_type, message.reply_to_file_name, message.reply_to_content)}
              </span>
            </button>
          )}

          {inhalt()}

          <div className="web-chat-meta">
            <time dateTime={message.created_at}>{nachrichtZeit(message.created_at)}</time>
            {message.queueStatus === 'pending' && !sendetGerade && (
              <IonIcon icon={ICON_UHRZEIT} className="web-chat-meta__symbol" aria-label="Wird gesendet" />
            )}
            {sendetGerade && <span>{sendeText(uploadFortschritt!.prozent)}</span>}
            {eigene && !message.queueStatus && (
              <IonIcon icon={ICON_HAKEN_GEFUELLT} className="web-chat-meta__symbol" aria-label="Gesendet" />
            )}
          </div>

          {sendetGerade && (
            <FortschrittsBalken prozent={uploadFortschritt!.prozent} beschriftung={`Datei wird gesendet: ${uploadFortschritt!.prozent} Prozent`} />
          )}
        </div>

        {/* Nicht gesendet: der Grund und der Weg weiter, direkt an der Nachricht. */}
        {message.queueStatus === 'error' && (
          <div className="web-chat-fehler" role="alert">
            <IonIcon icon={ICON_WARNHINWEIS} aria-hidden="true" />
            <span className="web-chat-fehler__text">
              {sendeFehlerGrund ? `Nicht gesendet: ${sendeFehlerGrund}` : 'Nicht gesendet'}
            </span>
            {/* Bei einer endgueltigen Ablehnung (zu gross, falscher Typ) liefe
                ein neuer Versuch in denselben Fehler: nur Verwerfen. */}
            {!sendeFehlerGrund && (
              <button type="button" className="web-chat-fehler__knopf" onClick={() => onErneutSenden(message)}>Erneut senden</button>
            )}
            <button type="button" className="web-chat-fehler__knopf" onClick={() => onVerwerfen(message)}>Verwerfen</button>
          </div>
        )}

        {message.reactions && message.reactions.length > 0 && (
          <div className="web-chat-reaktionen">
            {reaktionenGruppieren(message.reactions).map(([emoji, reactions]) => {
              const daten = REACTION_EMOJIS[emoji];
              const selbst = reactions.some((r) => r.user_id === user?.id && r.user_type === user?.type);
              return (
                <button
                  key={emoji}
                  type="button"
                  className="web-chat-reaktion"
                  aria-pressed={selbst}
                  aria-label={`${daten?.label ?? emoji}: ${reactions.length}`}
                  title={reactions.map((r) => r.user_name).join(', ')}
                  onClick={() => onReaktion(message.id, emoji)}
                >
                  <IonIcon
                    icon={selbst ? daten?.filled : daten?.outline}
                    style={{ color: daten?.color }}
                    aria-hidden="true"
                  />
                  <span>{reactions.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Aktionsleiste: beim Ueberfahren, bei Fokus, und solange der Picker offen ist */}
        {message.queueStatus !== 'error' && message.id > 0 && (
          <div className={`web-chat-aktionen${pickerOffen ? ' web-chat-aktionen--offen' : ''}`} role="toolbar" aria-label="Aktionen zu dieser Nachricht">
            <button
              type="button"
              ref={pickerKnopf}
              className="web-chat-aktion"
              aria-label="Reagieren"
              title="Reagieren"
              aria-expanded={pickerOffen}
              onClick={(e) => {
                // detail 0: per Tastatur ausgeloest, nicht per Maus oder Finger.
                if (e.detail === 0) perTastatur.current = true;
                if (pickerOffen) onPickerSchliessen();
                else onPickerOeffnen(message);
              }}
            >
              <IonIcon icon={ICON_FROEHLICH} aria-hidden="true" />
            </button>
            <button type="button" className="web-chat-aktion" aria-label="Antworten" title="Antworten" onClick={() => onAntworten(message)}>
              <IonIcon icon={ICON_ANTWORTEN} aria-hidden="true" />
            </button>
            {hatText && (
              <button type="button" className="web-chat-aktion" aria-label="Text kopieren" title="Text kopieren" onClick={() => onKopieren(message)}>
                <IonIcon icon={ICON_KOPIEREN} aria-hidden="true" />
              </button>
            )}
            {kannTeilen && (
              <button type="button" className="web-chat-aktion" aria-label="Teilen" title="Teilen" onClick={() => onTeilen(message)}>
                <IonIcon icon={ICON_TEILEN} aria-hidden="true" />
              </button>
            )}
            {darfLoeschen && (
              <button type="button" className="web-chat-aktion web-chat-aktion--gefahr" aria-label="Nachricht löschen" title="Nachricht löschen" onClick={() => onLoeschen(message.id)}>
                <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {pickerOffen && (
          <div
            className="web-chat-picker"
            role="group"
            aria-label="Reaktion wählen"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onPickerSchliessen();
              }
            }}
          >
            {Object.entries(REACTION_EMOJIS).map(([emoji, daten], index) => {
              const gewaehlt = message.reactions?.some((r) => r.user_id === user?.id && r.user_type === user?.type && r.emoji === emoji);
              return (
                <button
                  key={emoji}
                  type="button"
                  ref={index === 0 ? ersteReaktion : undefined}
                  className="web-chat-picker__knopf"
                  aria-pressed={!!gewaehlt}
                  aria-label={`Mit „${daten.label}“ reagieren`}
                  title={daten.label}
                  onClick={() => onReaktion(message.id, emoji)}
                >
                  <IonIcon icon={gewaehlt ? daten.filled : daten.outline} style={{ color: daten.color }} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WebNachricht;
