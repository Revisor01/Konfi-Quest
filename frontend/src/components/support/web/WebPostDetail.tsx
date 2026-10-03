// Eine Mail aus dem Posteingang in der Web-Fassung der Support-Ansicht,
// /admin/support/post/:id (docs/planung/support-web.md, Phase 2) -- wie in
// einem Mailprogramm.
//
// Links die Mail mit Kopf (Von, An, Datum, Postfach), Text und Anhaengen, die
// weiteren Mails des Fadens darunter und -- solange die Mail nicht zugeordnet
// ist -- der Antwort-Editor (vom selben Postfach an den Absender); zugeordnet
// geht die Antwort ueber die Anfrage bzw. den Schriftwechsel der Gemeinde,
// damit Postfach und Kennung im Betreff stimmen. Rechts "Zuordnen": die
// aktuelle Zuordnung als Link, darunter die Wahl einer Anfrage oder Gemeinde
// mit Suche -- der Server nimmt den ganzen Faden mit.
//
// Die Logik (laden, als gelesen melden, zuordnen) ist dieselbe wie in der App:
// components/support/usePostDetail.ts.

import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ARCHIV, ICON_MAIL, ICON_ORGANISATION } from '../../shared/icons';
import api from '../../../services/api';
import type { MailAntwortDaten } from '../../../types/support';
import { ANFRAGE_STATUS } from '../../../utils/supportAnfragen';
import { POSTFACH_INFO, gemeindeName } from '../../../utils/supportMail';
import { datumUhrzeit } from '../../../utils/dateUtils';
import { usePostDetail } from '../usePostDetail';
import WebSeite from '../../web/WebSeite';
import WebSpalten from '../../web/WebSpalten';
import WebKarte from '../../web/WebKarte';
import WebKnopf from '../../web/WebKnopf';
import WebChips from '../../web/WebChips';
import WebHinweis from '../../web/WebHinweis';
import WebAuswahlSuche from '../../web/WebAuswahlSuche';
import WebAntwortEditor from './WebAntwortEditor';
import { WebMailEintrag, WebMailVerlauf } from './WebMailVerlauf';
import { WebFehler, WebLaden, WebLeer } from '../../web/WebZustaende';

const ZURUECK = { href: '/admin/support/post', text: 'Posteingang' };

type Ziel = 'anfrage' | 'gemeinde';

const WebPostDetail: React.FC<{ nachrichtId: number }> = ({ nachrichtId }) => {
  const {
    isOnline, mail, faden, neu, laedt, fehler, nichtGefunden, anfragen, gemeinden, auswahlFehlt, anfrageWahl, setAnfrageWahl,
    gemeindeWahl, setGemeindeWahl, ordnetZu, holen, laden, zuordnen, letzteEingehende, betreffVorschlag, anfrageDerMail,
    gemeindeDerMail, zugeordnet, gewaehlteAnfrage, gewaehlteGemeinde,
  } = usePostDetail(nachrichtId);
  const [ziel, setZiel] = useState<Ziel>('anfrage');

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
          : <WebLeer icon={ICON_MAIL} titel="Mail nicht gefunden" text="Diese Mail gibt es nicht (mehr) — nicht zugeordnete Mails bleiben 180 Tage." />}
      </WebSeite>
    );
  }

  const weitere = faden.filter((m) => m.id !== mail.id);

  const haupt = (
    <>
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

      {!zugeordnet && letzteEingehende && (
        <WebKarte titel="Antworten" untertitel={`Von ${POSTFACH_INFO[mail.postfach].kurz} an den Absender`}>
          <WebAntwortEditor
            postfach={mail.postfach}
            betreffVorschlag={betreffVorschlag}
            an={letzteEingehende.von_adresse}
            senden={(koerper: MailAntwortDaten) => api.post(`/support/mail/nachrichten/${mail.id}/antworten`, koerper)}
            onGesendet={() => { void holen(false); }}
          />
        </WebKarte>
      )}
    </>
  );

  const seite = (
    <WebKarte titel="Zuordnen" untertitel="Der ganze Faden geht mit — auch spätere Antworten darauf ordnet der Server dann selbst zu.">
      <div className="web-formular">
        {mail.anfrage_id !== null && (
          <WebHinweis art="hinweis" titel={`Zugeordnet zur Anfrage ${anfrageDerMail ? `„${anfrageDerMail.gemeinde}“` : mail.anfrage_id}`}>
            <p className="web-hinweis__absatz">Antworten gehen über die Anfrage, von {POSTFACH_INFO.moin.kurz}.</p>
            <WebKnopf klein href={`/admin/support/anfragen/${mail.anfrage_id}`}>
              <IonIcon icon={ICON_MAIL} aria-hidden="true" />
              Anfrage öffnen
            </WebKnopf>
          </WebHinweis>
        )}
        {mail.organization_id !== null && (
          <WebHinweis art="hinweis" titel={`Zugeordnet zur Gemeinde ${gemeindeDerMail ? `„${gemeindeName(gemeindeDerMail)}“` : mail.organization_id}`}>
            <p className="web-hinweis__absatz">Antworten gehen über den Schriftwechsel der Gemeinde, von {POSTFACH_INFO.support.kurz}.</p>
            <WebKnopf klein href={`/admin/support/post/gemeinde/${mail.organization_id}`}>
              <IonIcon icon={ICON_ORGANISATION} aria-hidden="true" />
              Schriftwechsel öffnen
            </WebKnopf>
          </WebHinweis>
        )}
        {auswahlFehlt && (
          <WebHinweis art="fehler" rolle="status">Anfragen oder Gemeinden konnten nicht vollständig geladen werden.</WebHinweis>
        )}

        <WebChips<Ziel>
          beschriftung="Zuordnen zu"
          wert={ziel}
          onWert={setZiel}
          chips={[
            { wert: 'anfrage', label: 'Anfrage' },
            { wert: 'gemeinde', label: 'Gemeinde' },
          ]}
        />

        {ziel === 'anfrage' ? (
          <>
            <WebAuswahlSuche
              label="Anfrage"
              suchePlatzhalter="Anfrage suchen"
              leerText="Es gibt keine Anfragen."
              eintraege={anfragen.map((a) => ({
                wert: String(a.id),
                titel: a.gemeinde,
                beschreibung: `${a.kontakt_name} · ${(ANFRAGE_STATUS[a.status] ?? ANFRAGE_STATUS.neu).label}`,
              }))}
              wert={anfrageWahl}
              onWert={setAnfrageWahl}
            />
            <WebKnopf
              art="primaer"
              disabled={!gewaehlteAnfrage || ordnetZu || !isOnline || gewaehlteAnfrage.id === mail.anfrage_id}
              onClick={() => { if (gewaehlteAnfrage) void zuordnen({ anfrage_id: gewaehlteAnfrage.id }, 'Mail der Anfrage zugeordnet'); }}
            >
              <IonIcon icon={ICON_MAIL} aria-hidden="true" />
              Einer Anfrage zuordnen
            </WebKnopf>
          </>
        ) : (
          <>
            <WebAuswahlSuche
              label="Gemeinde"
              suchePlatzhalter="Gemeinde suchen"
              leerText="Es gibt keine Gemeinden."
              eintraege={gemeinden.map((g) => ({ wert: String(g.id), titel: gemeindeName(g) }))}
              wert={gemeindeWahl}
              onWert={setGemeindeWahl}
            />
            <WebKnopf
              art="primaer"
              disabled={!gewaehlteGemeinde || ordnetZu || !isOnline || gewaehlteGemeinde.id === mail.organization_id}
              onClick={() => { if (gewaehlteGemeinde) void zuordnen({ organization_id: gewaehlteGemeinde.id }, 'Mail der Gemeinde zugeordnet'); }}
            >
              <IonIcon icon={ICON_ORGANISATION} aria-hidden="true" />
              Einer Gemeinde zuordnen
            </WebKnopf>
          </>
        )}

        {zugeordnet && (
          <WebKnopf art="text" disabled={ordnetZu || !isOnline} onClick={() => { void zuordnen({}, 'Mail zurück im Posteingang'); }}>
            <IonIcon icon={ICON_ARCHIV} aria-hidden="true" />
            Zurück in den Posteingang
          </WebKnopf>
        )}
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
      <WebSpalten haupt={haupt} seite={seite} seiteBeschriftung="Zuordnung" />
    </WebSeite>
  );
};

export default WebPostDetail;
