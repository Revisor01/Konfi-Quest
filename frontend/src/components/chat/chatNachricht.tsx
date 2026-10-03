import React from 'react';
import type { CSSProperties } from 'react';
import type { Message, Reaction } from '../../types/chat';
import { linkOeffnen } from '../../services/systemDialoge';
import { mimeAusDateiname } from '../../utils/dateiTypen';
import { datumUhrzeit, uhrzeit } from '../../utils/dateUtils';

/**
 * Was eine Nachricht zeigt, unabhaengig davon, wie sie gezeichnet wird (beim
 * Anlegen der Web-Fassung des Chats aus MessageBubble.tsx hierher gezogen,
 * Ausgabe unveraendert): Links im Text, die Art einer Datei, die Zeit, die
 * Gruppen der Reaktionen und der Stand einer Umfrage. Die Blase der App
 * (MessageBubble) und die der Web-Fassung (web/WebNachricht) lesen dieselben
 * Funktionen -- eine Umfrage zaehlt in beiden gleich.
 */

// Endung -> Typ kommt aus der einen Tabelle der App (utils/dateiTypen.ts).
// Bis zum 29.09.2026 stand hier eine eigene, kuerzere: .doc, .pptx, .txt und
// .csv gingen als application/octet-stream an den Betrachter.
export const getMimeFromFileName = (fileName: string): string => mimeAusDateiname(fileName);

export const istBildDatei = (name: string | null | undefined): boolean => !!name?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
export const istVideoDatei = (name: string | null | undefined): boolean => !!name?.match(/\.(mp4|mov|avi|webm|m4v)$/i);

// Wandelt URLs (http/https und www.) in klickbare Links um. Gibt ein Array aus
// Text-Fragmenten und <a>-Elementen zurück, das direkt in JSX gerendert werden kann.
// Links oeffnen extern (window.open _blank) und stoppen die Klick-Propagation,
// damit nicht gleichzeitig die Nachricht selektiert/das Reaktionsmenue getriggert wird.
const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]}'"])/gi;

// Aussehen der Links in der Blase der App; die Web-Fassung gibt eine Klasse mit.
const LINK_STIL_APP: CSSProperties = { color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all' };

export const linkifyText = (
  text: string,
  link: { className?: string; style?: CSSProperties } = { style: LINK_STIL_APP },
): React.ReactNode => {
  if (!text) return text;
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      // NUR http/https ins href. Die Regex oben laesst ohnehin nichts
      // anderes durch -- aber sie und diese Zeile stehen getrennt, und wer
      // die Regex einmal erweitert, soll hier nicht versehentlich ein
      // `javascript:`-Ziel oeffnen. CodeQL (js/xss-through-dom) hat die
      // Stelle gemeldet, weil es dem Wert nicht bis zur Regex folgt; der
      // Schutz gehoert trotzdem dorthin, wo der Link entsteht.
      const roh = part.startsWith('www.') ? `https://${part}` : part;
      const href = /^https?:\/\//i.test(roh) ? roh : `https://${roh}`;
      return (
        <a
          key={i}
          href={href}
          className={link.className}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            linkOeffnen(href);
          }}
          style={link.style}
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

/** Uhrzeit einer Nachricht: heute die Uhrzeit, sonst Datum ohne Jahr und Uhrzeit. */
export const nachrichtZeit = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  return date.toDateString() === now.toDateString()
    ? uhrzeit(date)
    : datumUhrzeit(date, { ohneJahr: true });
};

/** Die Reaktionen einer Nachricht nach Emoji gruppiert, in der Reihenfolge des ersten Auftretens. */
export const reaktionenGruppieren = (reactions: Reaction[] | undefined): Array<[string, Reaction[]]> =>
  Object.entries(
    (reactions || []).reduce((acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = [];
      acc[r.emoji].push(r);
      return acc;
    }, {} as { [key: string]: Reaction[] })
  );

/** Wer die Umfrage oder die Reaktion sieht (die Felder, die der Vergleich braucht). */
interface Betrachter {
  id: number;
  type: string;
}

/** Eine Antwort einer Umfrage mit ihrem Stand. */
export interface UmfrageOption {
  index: number;
  text: string;
  stimmen: number;
  /** Anteil an allen Stimmen, 0 bis 100. */
  prozent: number;
  /** Hat die betrachtende Person diese Antwort gewaehlt? */
  gewaehlt: boolean;
  /** Exklusiv-Wahl: schon von jemand anderem belegt und damit gesperrt. */
  vergebenAnAndere: boolean;
  /** Namen der Waehlenden (nur bei einer Umfrage mit Namen). */
  namen: string[];
}

/**
 * Der Stand einer Umfrage fuer eine Person: Stimmen, Anteil, die eigene Wahl
 * und -- bei Exklusiv-Wahl -- welche Antwort schon vergeben ist.
 */
export const umfrageOptionen = (message: Message, betrachter: Betrachter | null): UmfrageOption[] => {
  const optionen = message.options ?? [];
  const gesamt = message.votes?.length || 0;
  const exklusiv = !!message.exclusive_options;
  const mitNamen = message.anonymous === false;
  return optionen.map((text, index) => {
    const stimmen = message.votes?.filter(vote => vote.option_index === index) || [];
    const gewaehlt = !!message.votes?.some(vote =>
      vote.user_id === betrachter?.id && vote.user_type === betrachter?.type && vote.option_index === index
    );
    return {
      index,
      text,
      stimmen: stimmen.length,
      prozent: gesamt > 0 ? (stimmen.length / gesamt) * 100 : 0,
      gewaehlt,
      // Exklusiv: Option ist vergeben, wenn jemand sie gewaehlt hat -- und
      // fuer alle ausser dem Waehler selbst gesperrt.
      vergebenAnAndere: exklusiv && stimmen.length > 0 && !gewaehlt,
      namen: mitNamen ? stimmen.map(v => v.user_name).filter(Boolean) as string[] : [],
    };
  });
};

/** Die Art der Umfrage in einem Wort: Exklusiv-Wahl, Mehrfachauswahl, Einzelauswahl. */
export const umfrageArt = (message: Message): string =>
  message.exclusive_options ? 'Exklusiv-Wahl' : message.multiple_choice ? 'Mehrfachauswahl' : 'Einzelauswahl';

/** Ablauf einer Umfrage: schon beendet, oder wann sie endet (mit der Restzeit unter 24 Stunden). */
export const umfrageAblauf = (
  expiresAt: string | undefined,
  jetzt: Date = new Date(),
): { beendet: boolean; text: string } | null => {
  if (!expiresAt) return null;
  const ende = new Date(expiresAt);
  if (ende < jetzt) return { beendet: true, text: 'Beendet' };
  const rest = ende.getTime() - jetzt.getTime();
  const stunden = Math.floor(rest / (1000 * 60 * 60));
  const minuten = Math.floor((rest % (1000 * 60 * 60)) / (1000 * 60));
  return {
    beendet: false,
    text: `Endet: ${datumUhrzeit(ende, { ohneJahr: true })}${stunden < 24 ? ` (${stunden > 0 ? `${stunden}h ` : ''}${minuten}min)` : ''}`,
  };
};

/** Was die Antwortzeile ueber der Eingabe und in der Blase von der beantworteten Nachricht zeigt. */
export const antwortVorschau = (
  art: string | undefined,
  dateiName: string | undefined,
  inhalt: string | undefined,
): string => {
  if (art === 'image' || art === 'video') return dateiName || 'Medieninhalt';
  if (art === 'file') return dateiName || 'Datei';
  if (art === 'poll') return 'Umfrage';
  return inhalt || '';
};
