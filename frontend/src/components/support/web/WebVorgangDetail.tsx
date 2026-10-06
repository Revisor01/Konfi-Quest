// Ein Vorgang in der Web-Fassung der Support-Ansicht,
// /admin/support/vorgaenge/:id (docs/planung/support-vorgaenge.md,
// Entscheidung 7).
//
// Zwei Spalten. Kopf: Betreff, Nummer, Status. Links der Verlauf wie in einem
// Mailprogramm -- der Text aus dem Formular, die Mails, die Antwort mit
// Textbausteinen. Rechts „Einordnen" (Art, Bereich, Dringlichkeit, Status,
// Gemeinde als Auswahlfelder, sofort gespeichert), der Kontakt, die Gemeinde
// mit ihrer Gemeindeleitung, bei einer Anfrage deren Angaben und „Gemeinde
// anlegen", die interne Notiz. Archivieren, Wiederherstellen und Löschen
// (mit Rückfrage) stehen im Kopf.
//
// Die Logik (laden, einordnen, Notiz, archivieren, löschen, Antwortweg) steht in
// components/support/useVorgangDetail.ts, dieselbe wie in der App.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ARCHIV, ICON_LISTE, ICON_LOESCHEN, ICON_ORGANISATION, ICON_RUECKGAENGIG } from '../../shared/icons';
import api from '../../../services/api';
import type { MailAntwortDaten } from '../../../types/support';
import { lizenzText } from '../../../utils/lizenzen';
import { datumKurz, datumUhrzeit } from '../../../utils/dateUtils';
import { gemeindeName } from '../../../utils/supportMail';
import { laufzeitAngabe } from '../../../utils/supportWeb';
import {
  BEREICHE,
  ARTEN,
  DRINGLICHKEITEN,
  ERLEDIGT_HINWEIS,
  QUELLEN,
  STATUS_REIHE,
  VORGANG_STATUS,
  bereichIstPflicht,
  gemeindeAngabeVon,
  kontaktVon,
  type VorgangArt,
  type VorgangBereich,
  type VorgangStatus,
  type Dringlichkeit,
} from '../../../utils/supportVorgaenge';
import { useVorgangDetail, type VorgangDetailDaten } from '../useVorgangDetail';
import WebSeite from '../../web/WebSeite';
import WebSpalten from '../../web/WebSpalten';
import WebKarte from '../../web/WebKarte';
import WebKnopf from '../../web/WebKnopf';
import WebPill from '../../web/WebPill';
import WebHinweis from '../../web/WebHinweis';
import WebAngaben from '../../web/WebAngaben';
import WebAuswahl from '../../web/WebAuswahl';
import WebTextfeld from '../../web/WebTextfeld';
import WebAntwortEditor from './WebAntwortEditor';
import { WebMailVerlauf } from './WebMailVerlauf';
import { WebAnlegenKarte, WebGemeindeAngelegt } from './WebGemeindeAnlegen';
import { DringlichPill, StatusPill } from './WebVorgangTeile';
import { WebFehler, WebLaden, WebLeer } from '../../web/WebZustaende';
import '../../../theme/web/support.css';

const ZURUECK = { href: '/admin/support/vorgaenge', text: 'Alle Vorgänge' };

const WebVorgangDetail: React.FC<{ vorgangId: number }> = ({ vorgangId }) => {
  const d: VorgangDetailDaten = useVorgangDetail(vorgangId);
  const {
    isOnline, vorgang, neu, laedt, fehler, nichtGefunden, speichert, laden, gemeinden, gemeindenFehlt, empfaenger, empfaengerFehlt,
    antwortWeg, betreffVorschlag, einordnen, notiz, setNotiz, notizGeaendert, notizSpeichern, archivieren, wiederherstellen,
    loeschenFragen, archiviert, anlegen,
  } = d;

  if (laedt && !vorgang) {
    return (
      <WebSeite bereich="Support" titel="Vorgang" zurueck={ZURUECK}>
        <WebLaden karten={2} text="Der Vorgang wird geladen." />
      </WebSeite>
    );
  }
  if (!vorgang) {
    return (
      <WebSeite bereich="Support" titel="Vorgang" zurueck={ZURUECK}>
        {fehler && !nichtGefunden
          ? <WebFehler text="Der Vorgang konnte nicht geladen werden." onErneut={() => { void laden(); }} />
          : <WebLeer icon={ICON_LISTE} titel="Vorgang nicht gefunden" text="Diesen Vorgang gibt es nicht (mehr) — vielleicht wurde er gelöscht." />}
      </WebSeite>
    );
  }

  const anfrage = vorgang.anfrage;
  const kontakt = kontaktVon(vorgang);
  const gemeindeAngabe = gemeindeAngabeVon(vorgang);
  const gemeinde = vorgang.gemeinde;
  const formularText = vorgang.beschreibung ?? anfrage?.nachricht ?? null;
  const sender = kontakt.name ?? 'Kontakt';
  const bereichFehlt = bereichIstPflicht(vorgang.art) && vorgang.bereich === null;

  const antwortSenden = (koerper: MailAntwortDaten) => api.post(`/support/vorgaenge/${vorgang.id}/antworten`, koerper);

  const gemeindeOptionen = [
    { wert: '', label: 'Keine Gemeinde' },
    ...gemeinden.map((g) => ({ wert: String(g.id), label: gemeindeName(g) })),
    ...(vorgang.organization_id !== null && !gemeinden.some((g) => g.id === vorgang.organization_id)
      ? [{ wert: String(vorgang.organization_id), label: vorgang.gemeinde_name ?? `Gemeinde ${vorgang.organization_id}` }] : []),
  ];

  const haupt = (
    <>
      {archiviert && (
        <WebHinweis art="hinweis" titel={vorgang.status === 'erledigt' ? 'Erledigt und im Archiv' : 'Dieser Vorgang liegt im Archiv'}>
          <p className="web-hinweis__absatz">
            {vorgang.archiviert_am ? `Archiviert am ${datumUhrzeit(vorgang.archiviert_am)}. ` : ''}
            Eine neue Mail holt ihn zurück; oder du stellst ihn mit „Wiederherstellen“ oben wieder her — er steht dann „In Arbeit“ in der Liste.
          </p>
        </WebHinweis>
      )}

      {formularText && (
        <WebKarte
          titel={vorgang.quelle === 'anfrage' ? 'Nachricht aus dem Formular' : 'Anliegen'}
          untertitel={`Von ${sender}, ${datumUhrzeit(vorgang.created_at)}`}
        >
          <p className="web-mail__absatz">{formularText}</p>
        </WebKarte>
      )}

      <WebKarte
        titel="Schriftwechsel"
        untertitel={`${vorgang.verlauf.length} ${vorgang.verlauf.length === 1 ? 'Mail' : 'Mails'}`}
      >
        <WebMailVerlauf mails={vorgang.verlauf} neu={neu} leer="Noch keine Mails in diesem Vorgang." />
      </WebKarte>

      <WebKarte
        titel="Antworten"
        untertitel={antwortWeg && antwortWeg.art !== 'keiner'
          ? `Von ${antwortWeg.postfach === 'moin' ? 'moin@' : 'support@'}${antwortWeg.art === 'gemeinde' ? ' an die Gemeinde' : ''}; die Nummer des Vorgangs steht im Betreff`
          : undefined}
      >
        {antwortWeg && antwortWeg.art !== 'keiner' ? (
          <WebAntwortEditor
            key={vorgang.id}
            postfach={antwortWeg.postfach}
            platzhalterFuer={anfrage ? { anfrage_id: anfrage.id } : vorgang.organization_id !== null ? { organization_id: vorgang.organization_id } : null}
            betreffVorschlag={betreffVorschlag}
            an={antwortWeg.art === 'gemeinde' ? null : antwortWeg.an}
            empfaenger={antwortWeg.art === 'gemeinde' ? empfaenger : null}
            empfaengerFehlt={empfaengerFehlt}
            senden={antwortSenden}
          />
        ) : (
          <WebHinweis art="hinweis" titel="Es gibt noch niemanden, dem sich antworten ließe">
            Ordne rechts eine Gemeinde zu — dann stehen ihre Gemeindeleitung und Leitung als Empfänger zur Wahl.
          </WebHinweis>
        )}
      </WebKarte>
    </>
  );

  const seite = (
    <>
      {gemeinde === null && vorgang.organization_id === null && (
        <WebHinweis art="warnung" titel="Noch keiner Gemeinde zugeordnet">
          {gemeindeAngabe
            ? <p className="web-hinweis__absatz">Angegeben im Formular: <strong className="web-gemeindeangabe">{gemeindeAngabe}</strong></p>
            : <p className="web-hinweis__absatz">Im Formular wurde keine Gemeinde genannt.</p>}
          <p className="web-hinweis__absatz">Wähle unter „Einordnen“ die passende Gemeinde.</p>
        </WebHinweis>
      )}

      <WebKarte titel="Einordnen" untertitel="Jede Änderung wird sofort gespeichert.">
        <div className="web-formular">
          <WebAuswahl
            label="Art"
            wert={vorgang.art}
            deaktiviert={!isOnline}
            onWert={(w) => { void einordnen({ art: w as VorgangArt }); }}
            optionen={ARTEN.map((a) => ({ wert: a.wert, label: a.label }))}
          />
          <WebAuswahl
            label="Bereich"
            pflicht={bereichIstPflicht(vorgang.art)}
            wert={vorgang.bereich ?? ''}
            deaktiviert={!isOnline}
            onWert={(w) => { void einordnen({ bereich: w ? (w as VorgangBereich) : null }); }}
            optionen={[{ wert: '', label: bereichFehlt ? 'Bitte wählen' : 'Kein Bereich' }, ...BEREICHE.map((b) => ({ wert: b.wert, label: b.label }))]}
            hinweis={bereichFehlt ? 'Bei Frage, Fehler und Wunsch gehört ein Bereich dazu.' : undefined}
          />
          <WebAuswahl
            label="Dringlichkeit"
            wert={vorgang.dringlichkeit}
            deaktiviert={!isOnline}
            onWert={(w) => { void einordnen({ dringlichkeit: w as Dringlichkeit }); }}
            optionen={DRINGLICHKEITEN.map((x) => ({ wert: x.wert, label: x.hinweis ? `${x.label} – ${x.hinweis}` : x.label }))}
          />
          <WebAuswahl
            label="Status"
            wert={vorgang.status}
            deaktiviert={!isOnline}
            onWert={(w) => { void einordnen({ status: w as VorgangStatus }); }}
            optionen={STATUS_REIHE.map((s) => ({ wert: s, label: VORGANG_STATUS[s].label }))}
            hinweis={ERLEDIGT_HINWEIS}
          />
          <WebAuswahl
            label="Gemeinde"
            wert={vorgang.organization_id === null ? '' : String(vorgang.organization_id)}
            deaktiviert={!isOnline}
            onWert={(w) => { void einordnen({ organization_id: w ? Number(w) : null }); }}
            optionen={gemeindeOptionen}
            hinweis={gemeindenFehlt ? 'Die Gemeinden konnten nicht vollständig geladen werden.' : undefined}
          />
        </div>
      </WebKarte>

      <WebKarte titel="Kontakt">
        <WebAngaben
          beschriftung="Kontakt aus dem Formular"
          angaben={[
            { label: 'Name', wert: kontakt.name },
            { label: 'E-Mail', wert: kontakt.email ? <a className="web-link" href={`mailto:${kontakt.email}`}>{kontakt.email}</a> : null },
            { label: 'Funktion', wert: kontakt.funktion },
            { label: 'Gemeinde laut Formular', wert: gemeindeAngabe },
            { label: 'Eingegangen über', wert: QUELLEN[vorgang.quelle] },
            { label: 'Eingegangen', wert: datumUhrzeit(vorgang.created_at) },
          ]}
        />
      </WebKarte>

      {(gemeinde || vorgang.organization_id !== null) && (
        <WebKarte
          titel="Gemeinde"
          aktion={vorgang.organization_id !== null ? (
            <WebKnopf klein href={`/admin/support/vorgaenge?gemeinde=${vorgang.organization_id}`}>
              <IonIcon icon={ICON_LISTE} aria-hidden="true" />
              Alle Vorgänge
            </WebKnopf>
          ) : undefined}
        >
          <WebAngaben
            beschriftung="Gemeinde des Vorgangs"
            angaben={[
              { label: 'Gemeinde', wert: <a className="web-link" href={`/admin/organizations?gemeinde=${vorgang.organization_id}`}>{gemeinde?.display_name ?? vorgang.gemeinde_name ?? `Gemeinde ${vorgang.organization_id}`}</a> },
              ...(gemeinde ? [
                { label: 'Laufzeit', wert: laufzeitAngabe(gemeinde).text },
                { label: 'Konfis', wert: gemeinde.konfi_count !== null ? `${gemeinde.konfi_count}${gemeinde.max_konfis ? ` von ${gemeinde.max_konfis}` : ''}` : null },
                { label: 'Kirchenkreis', wert: gemeinde.kirchenkreis },
                { label: 'Landeskirche', wert: gemeinde.landeskirche },
              ] : []),
            ]}
          />
          {vorgang.leitung.length > 0 && (
            <>
              <h3 className="web-gruppe">Gemeindeleitung</h3>
              <ul className="web-personen" aria-label="Gemeindeleitung">
                {vorgang.leitung.map((l) => (
                  <li key={l.id} className="web-person">
                    <div className="web-person__kopf">
                      <span className="web-person__name">{l.display_name || l.username}</span>
                      {!l.is_active && <WebPill ton="neutral">Gesperrt</WebPill>}
                    </div>
                    <div className="web-person__zeile">
                      {l.email ? <a className="web-link" href={`mailto:${l.email}`}>{l.email}</a> : <span className="web-gedaempft">Keine E-Mail</span>}
                    </div>
                    <div className="web-person__zeile web-gedaempft">
                      {l.last_login_at ? `Zuletzt angemeldet ${datumKurz(l.last_login_at)}` : 'Noch nicht angemeldet'}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </WebKarte>
      )}

      {anfrage && (
        <WebKarte titel="Angaben aus der Anfrage">
          <WebAngaben
            beschriftung="Angaben aus dem Formular der Anfrage"
            angaben={[
              { label: 'Gemeinde', wert: anfrage.gemeinde },
              { label: 'Verantwortlich', wert: `${anfrage.kontakt_name}${anfrage.funktion ? ` (${anfrage.funktion})` : ''}` },
              { label: 'E-Mail', wert: <a className="web-link" href={`mailto:${anfrage.email}`}>{anfrage.email}</a> },
              { label: 'Mobilnummer', wert: anfrage.mobil ? <a className="web-link" href={`tel:${anfrage.mobil.replace(/[^\d+]/g, '')}`}>{anfrage.mobil}</a> : null },
              { label: 'Kirchenkreis', wert: anfrage.kirchenkreis },
              { label: 'Landeskirche', wert: anfrage.landeskirche },
              { label: 'Ungefähre Zahl', wert: `${anfrage.anzahl_konfis ?? '–'} Konfis · ${anfrage.anzahl_teamer ?? '–'} Teamer:innen` },
              { label: 'Wunschlizenz', wert: anlegen.wunsch ? `${lizenzText(anlegen.wunsch)}, ${anlegen.wunsch.euro} € pro Jahr` : 'Noch offen' },
            ]}
          />
        </WebKarte>
      )}

      {anfrage && (anlegen.angelegt || (anfrage.status === 'angelegt' && anlegen.gemeindeId)) && anlegen.gemeindeId !== null && (
        <WebGemeindeAngelegt gemeindeId={anlegen.gemeindeId} username={anlegen.angelegt?.username ?? null} />
      )}
      {anfrage && anlegen.anlegbar && <WebAnlegenKarte anfrage={anfrage} d={anlegen} />}

      <WebKarte titel="Notiz" untertitel="Nur für den Support sichtbar.">
        <div className="web-formular">
          <WebTextfeld label="Interne Notiz" zeilen={4} wert={notiz} onWert={setNotiz} />
          <div className="web-formular__aktionen">
            <WebKnopf art="primaer" disabled={!notizGeaendert || speichert || !isOnline} onClick={() => { void notizSpeichern(); }}>
              Notiz speichern
            </WebKnopf>
          </div>
        </div>
      </WebKarte>
    </>
  );

  return (
    <WebSeite
      bereich="Support"
      titel={vorgang.betreff || '(ohne Betreff)'}
      untertitel={(
        <span className="web-vorgangskopf">
          <span>Vorgang {vorgang.id}</span>
          <StatusPill status={vorgang.status} />
          <DringlichPill dringlichkeit={vorgang.dringlichkeit} />
          {archiviert && <WebPill ton="neutral">Archiv</WebPill>}
          {vorgang.gemeinde_name && (
            <span className="web-vorgangskopf__gemeinde"><IonIcon icon={ICON_ORGANISATION} aria-hidden="true" /> {vorgang.gemeinde_name}</span>
          )}
        </span>
      )}
      zurueck={ZURUECK}
      aktionen={(
        <>
          {archiviert ? (
            <WebKnopf disabled={speichert || !isOnline} onClick={() => { void wiederherstellen(); }}>
              <IonIcon icon={ICON_RUECKGAENGIG} aria-hidden="true" />
              Wiederherstellen
            </WebKnopf>
          ) : (
            <WebKnopf disabled={speichert || !isOnline} onClick={() => { void archivieren(); }}>
              <IonIcon icon={ICON_ARCHIV} aria-hidden="true" />
              Archivieren
            </WebKnopf>
          )}
          <WebKnopf art="gefahr" disabled={speichert || !isOnline} onClick={loeschenFragen}>
            <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
            Löschen
          </WebKnopf>
        </>
      )}
    >
      <WebSpalten haupt={haupt} seite={seite} seiteBeschriftung="Einordnen und Angaben" />
    </WebSeite>
  );
};

export default WebVorgangDetail;
