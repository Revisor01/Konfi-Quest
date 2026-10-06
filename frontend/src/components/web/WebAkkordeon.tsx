// Akkordeon der Web-Fassung: ein Knopf mit Pfeil, Name und Zahlen; darunter
// der Inhalt, solange es offen ist. aria-expanded/aria-controls am Knopf.
// `innen` ist die zweite Ebene (ohne eigenen Rahmen, eingerueckt).
//
// Offen/zu haelt der Aufrufer (er muss es merken und fuer die Suche
// aufklappen koennen): kontrolliert ueber `offen` und `onUmschalten`.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_WEITER_GEFUELLT } from '../shared/icons';

export interface WebAkkordeonProps {
  /** Eindeutig auf der Seite -- bildet die Kennung des Inhalts. */
  id: string;
  titel: React.ReactNode;
  /** Rechts im Kopf: Zahlen ("5 Gemeinden · 183 Konfis"). */
  meta?: React.ReactNode;
  offen: boolean;
  onUmschalten: () => void;
  innen?: boolean;
  /** Ueberschriften-Ebene des Titels (die Seite hat h1; Landeskirche h2, Kirchenkreis h3). */
  ebene?: 2 | 3;
  children: React.ReactNode;
}

const WebAkkordeon: React.FC<WebAkkordeonProps> = ({ id, titel, meta, offen, onUmschalten, innen = false, ebene = 2, children }) => {
  const inhaltId = `web-akkordeon-${id}`;
  const Ueberschrift = ebene === 3 ? 'h3' : 'h2';
  return (
    <div className={innen ? 'web-akkordeon web-akkordeon--innen' : 'web-akkordeon'}>
      <Ueberschrift style={{ margin: 0, font: 'inherit' }}>
        <button
          type="button"
          className="web-akkordeon__kopf"
          aria-expanded={offen}
          aria-controls={inhaltId}
          onClick={onUmschalten}
        >
          <IonIcon icon={ICON_WEITER_GEFUELLT} className="web-akkordeon__pfeil" aria-hidden="true" />
          <span className="web-akkordeon__titel">{titel}</span>
          {meta && <span className="web-akkordeon__meta">{meta}</span>}
        </button>
      </Ueberschrift>
      {/* Der Bereich steht immer da (aria-controls zeigt auf ihn); gefuellt wird er nur, solange er offen ist. */}
      <div id={inhaltId} className="web-akkordeon__inhalt" hidden={!offen}>{offen && children}</div>
    </div>
  );
};

export default WebAkkordeon;
