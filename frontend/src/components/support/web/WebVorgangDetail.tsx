// Ein Vorgang im Lesebereich der Web-Fassung (rechts neben der Liste,
// web/WebVorgaenge; docs/planung/support-vorgaenge.md, Entscheidung 7).
// Simon, 11.10.2026: „Auf Web wird sie ausgewählt Mail rechts in einem Feld
// angezeigt. Wie in einem guten Mail Client."
//
// Kopf: Betreff, Nummer, Status, Dringlichkeit, Gemeinde; rechts Antworten,
// Einordnen (kompakter Dialog), Archivieren oder Wiederherstellen, Löschen.
// Darunter die wichtigsten Angaben in einer Zeile, dann der Verlauf als
// Gespräche (MailGespraeche, wie in der App) mit der Nachricht aus dem
// Formular vorn. „Antworten" öffnet das Antwortformular unter dem Verlauf --
// dort, wo man beim Lesen ankommt. Gemeinde, Gemeindeleitung, Angaben einer
// Anfrage und die interne Notiz stehen eingeklappt am Ende.
//
// Die Logik (laden, einordnen, Notiz, archivieren, löschen, Antwortweg) steht in
// components/support/useVorgangDetail.ts, dieselbe wie in der App.

import React, { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_ANTWORTEN,
  ICON_ARCHIV,
  ICON_BEARBEITEN,
  ICON_LISTE,
  ICON_LOESCHEN,
  ICON_ORGANISATION,
  ICON_RUECKGAENGIG,
  ICON_WARNHINWEIS,
} from '../../shared/icons';
import { lizenzText } from '../../../utils/lizenzen';
import { datumKurz, datumUhrzeit } from '../../../utils/dateUtils';
import { laufzeitAngabe } from '../../../utils/supportWeb';
import { QUELLEN, artKurz, bereichLabel, gemeindeAngabeVon, kontaktVon } from '../../../utils/supportVorgaenge';
import { useVorgangDetail } from '../useVorgangDetail';
import MailGespraeche from '../MailGespraeche';
import WebKnopf from '../../web/WebKnopf';
import WebPill from '../../web/WebPill';
import WebHinweis from '../../web/WebHinweis';
import WebAngaben from '../../web/WebAngaben';
import WebAkkordeon from '../../web/WebAkkordeon';
import WebTextfeld from '../../web/WebTextfeld';
import WebAntwortEditor from './WebAntwortEditor';
import WebEinordnen from './WebEinordnen';
import { WebAnlegenKarte, WebGemeindeAngelegt } from './WebGemeindeAnlegen';
import { WebLesebereich, WebLeseHinweis } from './WebPostfach';
import { DringlichPill, StatusPill } from './WebVorgangTeile';
import '../../../theme/web/support.css';

export interface WebVorgangDetailProps {
  vorgangId: number;
  /** Der Vorgang ist gelöscht: den Lesebereich leeren. */
  onGeloescht?: () => void;
}

const WebVorgangDetail: React.FC<WebVorgangDetailProps> = ({ vorgangId, onGeloescht }) => {
  const d = useVorgangDetail(vorgangId, onGeloescht);
  const {
    isOnline, vorgang, neu, laedt, fehler, nichtGefunden, speichert, laden, antwort, notiz, setNotiz, notizGeaendert,
    notizSpeichern, archivieren, wiederherstellen, loeschenFragen, archiviert, anlegen,
  } = d;
  const [antwortOffen, setAntwortOffen] = useState(false);
  const [einordnenOffen, setEinordnenOffen] = useState(false);
  const [mehrOffen, setMehrOffen] = useState(false);
  const antwortBereich = useRef<HTMLElement>(null);

  // Das Formular aufschlagen, wo man es sieht.
  useEffect(() => {
    if (antwortOffen) antwortBereich.current?.scrollIntoView?.({ block: 'nearest' });
  }, [antwortOffen]);

  if (!vorgang) {
    if (laedt) return <WebLeseHinweis icon={ICON_LISTE} titel="Der Vorgang wird geladen." />;
    if (fehler && !nichtGefunden) {
      return (
        <WebLeseHinweis icon={ICON_WARNHINWEIS} titel="Der Vorgang konnte nicht geladen werden.">
          <WebKnopf onClick={() => { void laden(); }}>Erneut versuchen</WebKnopf>
        </WebLeseHinweis>
      );
    }
    return <WebLeseHinweis icon={ICON_LISTE} titel="Vorgang nicht gefunden" text="Diesen Vorgang gibt es nicht (mehr) — vielleicht wurde er gelöscht." />;
  }

  const anfrage = vorgang.anfrage;
  const kontakt = kontaktVon(vorgang);
  const gemeindeAngabe = gemeindeAngabeVon(vorgang);
  const gemeinde = vorgang.gemeinde;
  const formularText = vorgang.beschreibung ?? anfrage?.nachricht ?? null;
  const gemeindeText = gemeinde?.display_name ?? vorgang.gemeinde_name ?? (vorgang.organization_id !== null ? `Gemeinde ${vorgang.organization_id}` : null);

  return (
    <WebLesebereich
      titel={vorgang.betreff || '(ohne Betreff)'}
      angaben={(
        <>
          <span>Vorgang {vorgang.id}</span>
          <StatusPill status={vorgang.status} />
          <DringlichPill dringlichkeit={vorgang.dringlichkeit} />
          {archiviert && <WebPill ton="neutral">Archiv</WebPill>}
          {gemeindeText && (
            <span className="web-vorgangskopf__gemeinde"><IonIcon icon={ICON_ORGANISATION} aria-hidden="true" /> {gemeindeText}</span>
          )}
        </>
      )}
      werkzeuge={(
        <>
          <WebKnopf art="primaer" disabled={!antwort || !isOnline} onClick={() => setAntwortOffen(true)}>
            <IonIcon icon={ICON_ANTWORTEN} aria-hidden="true" />
            Antworten
          </WebKnopf>
          <WebKnopf disabled={!isOnline} onClick={() => setEinordnenOffen(true)}>
            <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
            Einordnen
          </WebKnopf>
          {archiviert ? (
            <WebKnopf symbol disabled={speichert || !isOnline} onClick={() => { void wiederherstellen(); }} aria-label="Wiederherstellen" title="Wiederherstellen">
              <IonIcon icon={ICON_RUECKGAENGIG} aria-hidden="true" />
            </WebKnopf>
          ) : (
            <WebKnopf symbol disabled={speichert || !isOnline} onClick={() => { void archivieren(); }} aria-label="Archivieren" title="Archivieren">
              <IonIcon icon={ICON_ARCHIV} aria-hidden="true" />
            </WebKnopf>
          )}
          <WebKnopf symbol art="gefahr" disabled={speichert || !isOnline} onClick={loeschenFragen} aria-label="Löschen" title="Löschen">
            <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
          </WebKnopf>
        </>
      )}
    >
      {archiviert && (
        <WebHinweis art="hinweis" titel={vorgang.status === 'erledigt' ? 'Erledigt und im Archiv' : 'Dieser Vorgang liegt im Archiv'}>
          <p className="web-hinweis__absatz">
            {vorgang.archiviert_am ? `Archiviert am ${datumUhrzeit(vorgang.archiviert_am)}. ` : ''}
            Eine neue Mail holt ihn zurück; „Wiederherstellen“ oben stellt ihn auf „In Arbeit“.
          </p>
        </WebHinweis>
      )}
      {vorgang.organization_id === null && (
        <WebHinweis art="warnung" titel="Noch keiner Gemeinde zugeordnet">
          <p className="web-hinweis__absatz">
            {gemeindeAngabe ? <>Angegeben im Formular: <strong className="web-gemeindeangabe">{gemeindeAngabe}</strong>. </> : 'Im Formular wurde keine Gemeinde genannt. '}
          </p>
          <WebKnopf klein onClick={() => setEinordnenOffen(true)}>Gemeinde zuordnen</WebKnopf>
        </WebHinweis>
      )}

      <dl className="web-steckbrief" aria-label="Angaben zum Vorgang">
        <div>
          <dt>Kontakt</dt>
          <dd>
            {kontakt.name ?? (kontakt.email ? null : '–')}
            {kontakt.name && kontakt.email ? ' · ' : ''}
            {kontakt.email && <a className="web-link" href={`mailto:${kontakt.email}`}>{kontakt.email}</a>}
            {kontakt.funktion ? ` (${kontakt.funktion})` : ''}
          </dd>
        </div>
        <div>
          <dt>Art</dt>
          <dd>{artKurz(vorgang.art)}{vorgang.bereich ? ` · ${bereichLabel(vorgang.bereich)}` : ''}</dd>
        </div>
        <div>
          <dt>Eingegangen</dt>
          <dd>{QUELLEN[vorgang.quelle]}, {datumUhrzeit(vorgang.created_at)}</dd>
        </div>
      </dl>

      <MailGespraeche
        key={vorgang.id}
        mails={vorgang.verlauf}
        neu={neu}
        anfang={formularText ? {
          marke: vorgang.quelle === 'anfrage' ? 'Nachricht aus der Anfrage' : 'Anliegen aus dem Formular',
          name: kontakt.name,
          adresse: kontakt.email,
          datum: vorgang.created_at,
          text: formularText,
        } : null}
        leer="Noch keine Mails in diesem Vorgang."
      />

      {antwortOffen && antwort && (
        <section ref={antwortBereich} className="web-lesen__antwort" aria-label="Antwort schreiben">
          <div className="web-lesen__antwortkopf">
            <h3 className="web-lesen__antworttitel">Antwort</h3>
            <WebKnopf klein onClick={() => setAntwortOffen(false)}>Verwerfen</WebKnopf>
          </div>
          <WebAntwortEditor key={vorgang.id} {...antwort} onGesendet={() => setAntwortOffen(false)} />
        </section>
      )}
      {!antwort && (
        <WebHinweis art="hinweis" titel="Es gibt noch niemanden, dem sich antworten ließe">
          Ordne eine Gemeinde zu — dann stehen ihre Gemeindeleitung und Leitung als Empfänger zur Wahl.
        </WebHinweis>
      )}

      {anfrage && (anlegen.angelegt || (anfrage.status === 'angelegt' && anlegen.gemeindeId)) && anlegen.gemeindeId !== null && (
        <WebGemeindeAngelegt gemeindeId={anlegen.gemeindeId} username={anlegen.angelegt?.username ?? null} />
      )}
      {anfrage && anlegen.anlegbar && <WebAnlegenKarte anfrage={anfrage} d={anlegen} />}

      <WebAkkordeon
        id={`vorgang-${vorgang.id}-mehr`}
        ebene={3}
        titel="Gemeinde, Anfrage und Notiz"
        meta={vorgang.notiz?.trim() ? 'mit Notiz' : undefined}
        offen={mehrOffen}
        onUmschalten={() => setMehrOffen((o) => !o)}
      >
        <div className="web-lesen__mehr">
          {gemeindeText && (
            <section aria-label="Gemeinde des Vorgangs">
              <WebAngaben
                beschriftung="Gemeinde des Vorgangs"
                angaben={[
                  { label: 'Gemeinde', wert: <a className="web-link" href={`/admin/organizations?gemeinde=${vorgang.organization_id}`}>{gemeindeText}</a> },
                  ...(gemeinde ? [
                    { label: 'Laufzeit', wert: laufzeitAngabe(gemeinde).text },
                    { label: 'Konfis', wert: gemeinde.konfi_count !== null ? `${gemeinde.konfi_count}${gemeinde.max_konfis ? ` von ${gemeinde.max_konfis}` : ''}` : null },
                    { label: 'Kirchenkreis', wert: gemeinde.kirchenkreis },
                    { label: 'Landeskirche', wert: gemeinde.landeskirche },
                  ] : []),
                  { label: 'Vorgänge', wert: <a className="web-link" href={`/admin/support/vorgaenge?gemeinde=${vorgang.organization_id}`}>Alle Vorgänge dieser Gemeinde</a> },
                ]}
              />
              {vorgang.leitung.length > 0 && (
                <ul className="web-personen" aria-label="Gemeindeleitung">
                  {vorgang.leitung.map((l) => (
                    <li key={l.id} className="web-person">
                      <div className="web-person__kopf">
                        <span className="web-person__name">{l.display_name || l.username}</span>
                        {!l.is_active && <WebPill ton="neutral">Gesperrt</WebPill>}
                      </div>
                      <div className="web-person__zeile">
                        {l.email ? <a className="web-link" href={`mailto:${l.email}`}>{l.email}</a> : <span className="web-gedaempft">Keine E-Mail</span>}
                        <span className="web-gedaempft"> · {l.last_login_at ? `zuletzt angemeldet ${datumKurz(l.last_login_at)}` : 'noch nicht angemeldet'}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {anfrage && (
            <WebAngaben
              beschriftung="Angaben aus dem Formular der Anfrage"
              angaben={[
                { label: 'Gemeinde laut Anfrage', wert: anfrage.gemeinde },
                { label: 'Verantwortlich', wert: `${anfrage.kontakt_name}${anfrage.funktion ? ` (${anfrage.funktion})` : ''}` },
                { label: 'Mobilnummer', wert: anfrage.mobil ? <a className="web-link" href={`tel:${anfrage.mobil.replace(/[^\d+]/g, '')}`}>{anfrage.mobil}</a> : null },
                { label: 'Kirchenkreis', wert: anfrage.kirchenkreis },
                { label: 'Landeskirche', wert: anfrage.landeskirche },
                { label: 'Ungefähre Zahl', wert: `${anfrage.anzahl_konfis ?? '–'} Konfis · ${anfrage.anzahl_teamer ?? '–'} Teamer:innen` },
                { label: 'Wunschlizenz', wert: anlegen.wunsch ? `${lizenzText(anlegen.wunsch)}, ${anlegen.wunsch.euro} € pro Jahr` : 'Noch offen' },
              ]}
            />
          )}

          <div className="web-formular">
            <WebTextfeld label="Interne Notiz (nur für den Support)" zeilen={3} wert={notiz} onWert={setNotiz} />
            <div className="web-formular__aktionen">
              <WebKnopf art="primaer" disabled={!notizGeaendert || speichert || !isOnline} onClick={() => { void notizSpeichern(); }}>
                Notiz speichern
              </WebKnopf>
            </div>
          </div>
        </div>
      </WebAkkordeon>

      {einordnenOffen && <WebEinordnen d={d} onSchliessen={() => setEinordnenOffen(false)} />}
    </WebLesebereich>
  );
};

export default WebVorgangDetail;
