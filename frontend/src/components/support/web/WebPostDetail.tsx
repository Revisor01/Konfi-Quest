// Eine Mail aus dem Posteingang in der Web-Fassung der Support-Ansicht,
// /admin/support/post/:id (docs/planung/support-vorgaenge.md, Entscheidung 7)
// -- wie in einem Mailprogramm.
//
// Links die Mail mit Kopf (Von, An, Datum, Postfach), Text und Anhängen, die
// weiteren Mails des Fadens darunter und -- solange die Mail in keinem Vorgang
// liegt -- der Antwort-Editor (vom selben Postfach an den Absender). Rechts
// „Einsortieren": in einen bestehenden oder neuen Vorgang, dazu Archivieren
// (oder Wiederherstellen) und Löschen mit Rückfrage. Liegt die Mail schon in
// einem Vorgang, führt ein Link dorthin; geantwortet wird dort, damit Postfach
// und Nummer im Betreff stimmen.
//
// Die Logik (laden, als gelesen melden, einsortieren, archivieren, löschen)
// steht in components/support/usePostDetail.ts, dieselbe wie in der App.

import React, { useState } from 'react';
import { IonIcon, useIonRouter } from '@ionic/react';
import { ICON_ARCHIV, ICON_LISTE, ICON_LOESCHEN, ICON_MAIL, ICON_RUECKGAENGIG } from '../../shared/icons';
import api from '../../../services/api';
import type { MailAntwortDaten } from '../../../types/support';
import { POSTFACH_INFO } from '../../../utils/supportMail';
import { datumUhrzeit } from '../../../utils/dateUtils';
import { usePostDetail } from '../usePostDetail';
import WebSeite from '../../web/WebSeite';
import WebSpalten from '../../web/WebSpalten';
import WebKarte from '../../web/WebKarte';
import WebKnopf from '../../web/WebKnopf';
import WebHinweis from '../../web/WebHinweis';
import WebAntwortEditor from './WebAntwortEditor';
import WebEinsortieren from './WebEinsortieren';
import { WebMailEintrag, WebMailVerlauf } from './WebMailVerlauf';
import { WebFehler, WebLaden, WebLeer } from '../../web/WebZustaende';
import '../../../theme/web/support.css';

const ZURUECK = { href: '/admin/support/post', text: 'Posteingang' };

const WebPostDetail: React.FC<{ nachrichtId: number }> = ({ nachrichtId }) => {
  const {
    isOnline, mail, faden, neu, laedt, fehler, nichtGefunden, laden, letzteEingehende, betreffVorschlag, vorgangId, archiviert,
    archivieren, wiederherstellen, loeschenFragen,
  } = usePostDetail(nachrichtId);
  const [einsortieren, setEinsortieren] = useState(false);
  const router = useIonRouter();

  if (laedt && !mail) {
    return (
      <WebSeite bereich="Support" titel="Mail" zurueck={ZURUECK}>
        <WebLaden karten={2} text="Die Mail wird geladen." />
      </WebSeite>
    );
  }
  if (!mail) {
    return (
      <WebSeite bereich="Support" titel="Mail" zurueck={ZURUECK}>
        {fehler && !nichtGefunden
          ? <WebFehler text="Die Mail konnte nicht geladen werden." onErneut={() => { void laden(); }} />
          : <WebLeer icon={ICON_MAIL} titel="Mail nicht gefunden" text="Diese Mail gibt es nicht (mehr) — archivierte Mails bleiben 180 Tage." />}
      </WebSeite>
    );
  }

  const weitere = faden.filter((m) => m.id !== mail.id);
  const imVorgang = vorgangId !== null;

  const haupt = (
    <>
      {archiviert && (
        <WebHinweis art="hinweis" titel="Diese Mail liegt im Archiv">
          <p className="web-hinweis__absatz">
            {mail.archiviert_am ? `Archiviert am ${datumUhrzeit(mail.archiviert_am)}. ` : ''}
            Nach 180 Tagen wird sie gelöscht. Stelle sie wieder her, wenn sie einsortiert werden soll.
          </p>
        </WebHinweis>
      )}

      <WebKarte
        titel={mail.betreff?.trim() || '(ohne Betreff)'}
        untertitel={`${mail.richtung === 'ein' ? 'Eingegangen' : 'Gesendet'} über ${POSTFACH_INFO[mail.postfach]?.kurz ?? mail.postfach}`}
      >
        <WebMailEintrag mail={mail} neu={neu.has(mail.id)} kopf="voll" />
      </WebKarte>

      {weitere.length > 0 && (
        <WebKarte titel={`Weitere Mails im Faden (${weitere.length})`} untertitel="Älteste zuerst">
          <WebMailVerlauf mails={weitere} neu={neu} beschriftung="Weitere Mails im Faden" />
        </WebKarte>
      )}

      {!imVorgang && !archiviert && letzteEingehende && (
        <WebKarte titel="Antworten" untertitel={`Von ${POSTFACH_INFO[mail.postfach].kurz} an den Absender`}>
          <WebAntwortEditor
            postfach={mail.postfach}
            betreffVorschlag={betreffVorschlag}
            an={letzteEingehende.von_adresse}
            senden={(koerper: MailAntwortDaten) => api.post(`/support/mail/nachrichten/${mail.id}/antworten`, koerper)}
          />
        </WebKarte>
      )}
    </>
  );

  const seite = (
    <WebKarte
      titel={imVorgang ? 'Vorgang' : 'Einsortieren'}
      untertitel={imVorgang ? undefined : 'Der ganze Faden geht mit — auch spätere Antworten darauf ordnet der Server dann selbst zu.'}
    >
      <div className="web-formular">
        {imVorgang ? (
          <WebHinweis art="erfolg" titel={`Einsortiert in Vorgang ${vorgangId}`}>
            <p className="web-hinweis__absatz">Antworten gehen über den Vorgang, damit die Nummer im Betreff steht.</p>
            <WebKnopf klein href={`/admin/support/vorgaenge/${vorgangId}`}>
              <IonIcon icon={ICON_LISTE} aria-hidden="true" />
              Vorgang öffnen
            </WebKnopf>
          </WebHinweis>
        ) : null}
        <WebKnopf art={imVorgang ? 'sekundaer' : 'primaer'} disabled={!isOnline} onClick={() => setEinsortieren(true)}>
          <IonIcon icon={ICON_LISTE} aria-hidden="true" />
          {imVorgang ? 'Anderem Vorgang zuordnen' : 'Einsortieren'}
        </WebKnopf>
        <div className="web-formular__knoepfe">
          {archiviert ? (
            <WebKnopf disabled={!isOnline} onClick={() => { void wiederherstellen(); }}>
              <IonIcon icon={ICON_RUECKGAENGIG} aria-hidden="true" />
              Wiederherstellen
            </WebKnopf>
          ) : (
            <WebKnopf disabled={!isOnline} onClick={() => { void archivieren(); }}>
              <IonIcon icon={ICON_ARCHIV} aria-hidden="true" />
              Archivieren
            </WebKnopf>
          )}
          <WebKnopf art="gefahr" disabled={!isOnline} onClick={loeschenFragen}>
            <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
            Löschen
          </WebKnopf>
        </div>
      </div>
    </WebKarte>
  );

  return (
    <WebSeite
      bereich="Support"
      titel="Mail"
      untertitel={`${datumUhrzeit(mail.gesendet_am)} · ${faden.length === 1 ? 'einzelne Mail' : `Faden mit ${faden.length} Mails`}`}
      zurueck={ZURUECK}
    >
      <WebSpalten haupt={haupt} seite={seite} seiteBeschriftung="Einsortieren" />
      {einsortieren && (
        <WebEinsortieren
          mail={{ id: mail.id, betreff: mail.betreff }}
          onSchliessen={() => setEinsortieren(false)}
          onFertig={(id) => { if (id) router.push(`/admin/support/vorgaenge/${id}`); }}
        />
      )}
    </WebSeite>
  );
};

export default WebPostDetail;
