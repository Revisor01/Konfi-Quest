// Eine Anfrage in der Web-Fassung der Support-Ansicht,
// /admin/support/anfragen/:id (docs/planung/support-web.md, Phase 2).
//
// Zwei Spalten. Links der Schriftwechsel wie in einem Mailprogramm -- die
// Nachricht aus dem Formular, darunter der Verlauf der Mails, darunter der
// Antwort-Editor (moin@). Rechts die Angaben aus dem Formular der Startseite,
// "Bearbeiten" (Status, Notiz) und -- solange keine Gemeinde daraus entstanden
// ist -- "Gemeinde anlegen", vorbelegt aus der Anfrage; danach der Link zur
// angelegten Gemeinde.
//
// Die Logik (laden, speichern, Kirchenkreis anlegen, Gemeinde anlegen mit
// Rueckfrage, Verlauf) ist dieselbe wie in der App: components/support/
// useAnfrageDetail.ts, ebenso die Regeln dahinter (utils/supportAnfragen.ts,
// utils/lizenzen.ts). Hier steht nur die Darstellung.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_HINZUFUEGEN, ICON_MAIL, ICON_ORGANISATION, ICON_SCHLUESSEL, ICON_SICHTBAR, ICON_VERBORGEN } from '../../shared/icons';
import api from '../../../services/api';
import type { AnfrageStatus, MailAntwortDaten } from '../../../types/support';
import {
  ANFRAGE_STATUS,
  STATUS_VON_HAND,
  TESTPHASE_KONFIS,
  TESTPHASE_TAGE,
  testphaseUmschalten,
} from '../../../utils/supportAnfragen';
import { EIGENES_LIMIT, TARIF_OPTIONEN, lizenzLimit, lizenzText } from '../../../utils/lizenzen';
import { datumUhrzeit } from '../../../utils/dateUtils';
import { ANFRAGE_BETREFF, standardBetreff } from '../../../utils/supportMail';
import { generateStrongPassword } from '../../../utils/passwortVorschlag';
import { ANFRAGE_TON } from '../../../utils/supportWeb';
import { useAnfrageDetail, type AnfrageDetailDaten } from '../useAnfrageDetail';
import WebSeite from './WebSeite';
import WebSpalten from './WebSpalten';
import WebKarte from './WebKarte';
import WebKnopf from './WebKnopf';
import WebPill from './WebPill';
import WebHinweis from './WebHinweis';
import WebAngaben from './WebAngaben';
import WebFeld from './WebFeld';
import WebTextfeld from './WebTextfeld';
import WebAuswahl from './WebAuswahl';
import WebSchalter from './WebSchalter';
import WebAntwortEditor from './WebAntwortEditor';
import { WebMailVerlauf } from './WebMailVerlauf';
import { WebFehler, WebLaden, WebLeer } from './WebZustaende';

const ZURUECK = { href: '/admin/support/anfragen', text: 'Alle Anfragen' };

/** Die Gemeinde aus der Anfrage anlegen -- vorbelegt, mit erster Gemeindeleitung. */
const AnlegenKarte: React.FC<{ d: AnfrageDetailDaten }> = ({ d }) => {
  const {
    anfrage, formular, setFormular, aendern, kirchenkreise, strukturFehlt, kkGefunden, gewaehlterKreis, eigenesLimit,
    setEigenesLimit, wunsch, passwortZeigen, setPasswortZeigen, kirchenkreisAnlegen, anlegen, legtAn, isOnline,
  } = d;
  if (!anfrage || !formular) return null;

  return (
    <WebKarte
      titel="Gemeinde anlegen"
      untertitel="Vorbelegt aus der Anfrage. Angelegt werden die Gemeinde mit allen Vorlagen und ihre erste Gemeindeleitung; alles Weitere richtet die Gemeinde selbst ein."
    >
      <div className="web-formular">
        <WebFeld label="Name der Gemeinde" pflicht wert={formular.name} onWert={(w) => aendern({ name: w })} />
        <WebAuswahl
          label="Kirchenkreis"
          wert={formular.kirchenkreisId === null ? 'ohne' : String(formular.kirchenkreisId)}
          onWert={(w) => aendern({ kirchenkreisId: w === 'ohne' ? null : Number(w) })}
          optionen={[
            { wert: 'ohne', label: 'Ohne Kirchenkreis' },
            ...kirchenkreise.map((k) => ({ wert: String(k.id), label: k.landeskirche ? `${k.name} (${k.landeskirche})` : k.name })),
          ]}
          hinweis={gewaehlterKreis ? `Landeskirche: ${gewaehlterKreis.landeskirche || 'noch keine zugeordnet'}` : undefined}
        />
        {strukturFehlt && (
          <WebHinweis art="fehler" rolle="status">
            Die Kirchenkreise konnten nicht geladen werden; die Gemeinde lässt sich auch ohne Zuordnung anlegen.
          </WebHinweis>
        )}
        {!strukturFehlt && anfrage.kirchenkreis && !kkGefunden && (
          <WebHinweis art="hinweis">
            <span>„{anfrage.kirchenkreis}“ steht noch nicht in der Struktur. </span>
            <WebKnopf klein onClick={() => { void kirchenkreisAnlegen(); }}>
              <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
              Als Kirchenkreis anlegen
            </WebKnopf>
          </WebHinweis>
        )}
        <WebFeld label="Ansprechperson" wert={formular.kontaktName} onWert={(w) => aendern({ kontaktName: w })} autocomplete="name" />
        <WebFeld label="E-Mail der Gemeinde" typ="email" wert={formular.kontaktEmail} onWert={(w) => aendern({ kontaktEmail: w })} autocomplete="email" />
        <WebFeld label="Telefon" typ="tel" wert={formular.kontaktTelefon} onWert={(w) => aendern({ kontaktTelefon: w })} autocomplete="tel" />

        {/* Tarif mit Preis wie unter Gemeinden (utils/lizenzen.ts); Unbegrenzt und ein eigenes Limit gehen immer. */}
        <WebAuswahl
          label="Tarif"
          wert={eigenesLimit ? EIGENES_LIMIT : formular.maxKonfis.trim()}
          onWert={(wert) => {
            if (wert === EIGENES_LIMIT) { setEigenesLimit(true); return; }
            setEigenesLimit(false);
            aendern({ maxKonfis: wert });
          }}
          optionen={[
            ...TARIF_OPTIONEN.map((t) => ({ wert: t.wert, label: t.text })),
            { wert: EIGENES_LIMIT, label: 'Eigenes Limit…' },
          ]}
          hinweis={wunsch && wunsch.konfis !== null
            ? `In der Testphase ${TESTPHASE_KONFIS}, danach ${wunsch.konfis} (Wunschlizenz ${wunsch.name}).`
            : `In der Testphase ${TESTPHASE_KONFIS}, danach unbegrenzt${wunsch ? ' (Verbund: Limit nach Absprache)' : ''}.`}
        />
        {eigenesLimit && (
          <WebFeld label="Eigenes Limit" typ="number" wert={formular.maxKonfis} onWert={(w) => aendern({ maxKonfis: w })} hinweis="Zahl der Konfis; leer = unbegrenzt." />
        )}
        <WebSchalter
          label={`Testphase (${TESTPHASE_TAGE} Tage)`}
          an={formular.testphase}
          onAn={(an) => setFormular((f) => (f ? testphaseUmschalten(f, an, lizenzLimit(anfrage.wunsch_lizenz)) : f))}
          hinweis={formular.testphase
            ? `Zugang ${TESTPHASE_TAGE} Tage ab heute, mit Hinweis auf den Startseiten. Verlängern unter Gemeinden.`
            : 'Ohne Ablaufdatum. Laufzeit und Lizenz lassen sich später unter Gemeinden setzen.'}
        />

        <h3 className="web-gruppe">Erste Gemeindeleitung</h3>
        <WebFeld label="Benutzername" pflicht wert={formular.adminUsername} onWert={(w) => aendern({ adminUsername: w })} autocomplete="username"
          hinweis="Buchstaben, Ziffern, Punkt und Bindestrich; im ganzen System frei." />
        <WebFeld label="Anzeigename" pflicht wert={formular.adminDisplayName} onWert={(w) => aendern({ adminDisplayName: w })} autocomplete="name" />
        <WebFeld label="E-Mail der Gemeindeleitung" typ="email" wert={formular.adminEmail} onWert={(w) => aendern({ adminEmail: w })} autocomplete="email"
          hinweis="Dorthin geht „Passwort vergessen“." />
        <WebFeld label="Passwort" pflicht typ={passwortZeigen ? 'text' : 'password'} wert={formular.adminPassword}
          onWert={(w) => aendern({ adminPassword: w })} autocomplete="new-password"
          hinweis="Mindestens 8 Zeichen, Groß- und Kleinbuchstabe, Ziffer, Sonderzeichen, keine Leerzeichen." />
        <div className="web-formular__knoepfe">
          <WebKnopf klein onClick={() => { aendern({ adminPassword: generateStrongPassword() }); setPasswortZeigen(true); }}>
            <IonIcon icon={ICON_SCHLUESSEL} aria-hidden="true" />
            Sicheres Passwort vorschlagen
          </WebKnopf>
          <WebKnopf klein art="text" onClick={() => setPasswortZeigen((z) => !z)}>
            <IonIcon icon={passwortZeigen ? ICON_VERBORGEN : ICON_SICHTBAR} aria-hidden="true" />
            {passwortZeigen ? 'Passwort verbergen' : 'Passwort zeigen'}
          </WebKnopf>
        </div>
        <div className="web-formular__aktionen">
          <WebKnopf art="primaer" onClick={() => { void anlegen(); }} disabled={legtAn || !isOnline}>
            <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
            Gemeinde anlegen
          </WebKnopf>
        </div>
      </div>
    </WebKarte>
  );
};

const WebAnfrageDetail: React.FC<{ anfrageId: number }> = ({ anfrageId }) => {
  const d = useAnfrageDetail(anfrageId);
  const {
    anfrage, laedt, fehler, laden, verlauf, verlaufFehler, neueMails, verlaufHolen, nachDemSenden, status, setStatus, notiz,
    setNotiz, speichert, geaendert, bearbeitungSpeichern, angelegt, gemeindeId, wunsch, statusInfo, isOnline,
  } = d;

  if (laedt && !anfrage) {
    return (
      <WebSeite bereich="Support" titel="Anfrage" zurueck={ZURUECK}>
        <WebLaden karten={2} text="Die Anfrage wird geladen." />
      </WebSeite>
    );
  }
  if (fehler || !anfrage) {
    return (
      <WebSeite bereich="Support" titel="Anfrage" zurueck={ZURUECK}>
        {fehler
          ? <WebFehler text="Die Anfrage konnte nicht geladen werden." onErneut={() => { void laden(); }} />
          : <WebLeer icon={ICON_MAIL} titel="Anfrage nicht gefunden" text="Diese Anfrage gibt es nicht (mehr)." />}
      </WebSeite>
    );
  }

  const aktualisiert = anfrage.updated_at && anfrage.updated_at !== anfrage.created_at ? ` · zuletzt geändert ${datumUhrzeit(anfrage.updated_at)}` : '';
  const statusOptionen = STATUS_VON_HAND.map((s) => ({ wert: s, label: ANFRAGE_STATUS[s].label }));

  const haupt = (
    <>
      {anfrage.nachricht && (
        <WebKarte titel="Nachricht aus dem Formular" untertitel={`Von ${anfrage.kontakt_name}, ${datumUhrzeit(anfrage.created_at)}`}>
          <p className="web-mail__absatz">{anfrage.nachricht}</p>
        </WebKarte>
      )}

      <WebKarte
        titel="Schriftwechsel"
        untertitel={verlauf ? `${verlauf.length} ${verlauf.length === 1 ? 'Mail' : 'Mails'} mit ${anfrage.email}` : undefined}
      >
        {verlaufFehler && !verlauf ? (
          <WebFehler text="Der Verlauf konnte nicht geladen werden." onErneut={() => { void verlaufHolen(true); }} />
        ) : verlauf ? (
          <WebMailVerlauf mails={verlauf} neu={neueMails} leer="Noch keine Mails zu dieser Anfrage." />
        ) : (
          <p className="web-gedaempft" role="status">Verlauf wird geladen...</p>
        )}
      </WebKarte>

      <WebKarte titel="Antworten" untertitel="Von moin@ an die Ansprechperson">
        <WebAntwortEditor
          postfach="moin"
          platzhalterFuer={{ anfrage_id: anfrage.id }}
          betreffVorschlag={standardBetreff(verlauf && verlauf.length > 0 ? verlauf[verlauf.length - 1].betreff : ANFRAGE_BETREFF)}
          an={anfrage.email}
          senden={(koerper: MailAntwortDaten) => api.post(`/support/anfragen/${anfrage.id}/antworten`, koerper)}
          onGesendet={nachDemSenden}
        />
      </WebKarte>
    </>
  );

  const seite = (
    <>
      <WebKarte titel="Angaben">
        <WebAngaben
          beschriftung="Angaben aus dem Formular"
          angaben={[
            { label: 'Gemeinde', wert: anfrage.gemeinde },
            { label: 'Verantwortlich', wert: `${anfrage.kontakt_name}${anfrage.funktion ? ` (${anfrage.funktion})` : ''}` },
            { label: 'E-Mail', wert: <a className="web-link" href={`mailto:${anfrage.email}`}>{anfrage.email}</a> },
            { label: 'Mobilnummer', wert: anfrage.mobil ? <a className="web-link" href={`tel:${anfrage.mobil.replace(/[^\d+]/g, '')}`}>{anfrage.mobil}</a> : null },
            { label: 'Kirchenkreis', wert: anfrage.kirchenkreis },
            { label: 'Landeskirche', wert: anfrage.landeskirche },
            { label: 'Ungefähre Zahl', wert: `${anfrage.anzahl_konfis ?? '–'} Konfis · ${anfrage.anzahl_teamer ?? '–'} Teamer:innen` },
            { label: 'Wunschlizenz', wert: wunsch ? `${lizenzText(wunsch)}, ${wunsch.euro} € pro Jahr` : 'Noch offen' },
            { label: 'Eingegangen', wert: `${datumUhrzeit(anfrage.created_at)}${aktualisiert}` },
          ]}
        />
      </WebKarte>

      <WebKarte titel="Bearbeiten" aktion={<WebPill ton={ANFRAGE_TON[anfrage.status]}>{statusInfo.label}</WebPill>}>
        <div className="web-formular">
          {anfrage.status === 'angelegt' && gemeindeId ? (
            <WebHinweis art="erfolg" titel="Die Gemeinde ist angelegt.">
              {angelegt && (
                <p className="web-hinweis__absatz">
                  Benutzername der Gemeindeleitung: <strong>{angelegt.username}</strong>. Benutzername und Passwort auf
                  getrennten Wegen weitergeben — nicht beides in derselben Mail.
                </p>
              )}
              <WebKnopf href={`/admin/organizations?gemeinde=${gemeindeId}`}>
                <IonIcon icon={ICON_ORGANISATION} aria-hidden="true" />
                Gemeinde öffnen
              </WebKnopf>
            </WebHinweis>
          ) : null}
          {anfrage.status !== 'angelegt' && (
            <WebAuswahl label="Status" wert={status} onWert={(w) => setStatus(w as AnfrageStatus)} optionen={statusOptionen} />
          )}
          <WebTextfeld label="Notiz (nur für den Support)" zeilen={3} wert={notiz} onWert={setNotiz} />
          <div className="web-formular__aktionen">
            <WebKnopf art="primaer" onClick={() => { void bearbeitungSpeichern(); }} disabled={!geaendert || speichert || !isOnline}>Speichern</WebKnopf>
          </div>
        </div>
      </WebKarte>

      {anfrage.status !== 'angelegt' && <AnlegenKarte d={d} />}
    </>
  );

  return (
    <WebSeite
      bereich="Support"
      titel={anfrage.gemeinde}
      untertitel={`Anfrage vom ${datumUhrzeit(anfrage.created_at)}`}
      zurueck={ZURUECK}
    >
      <WebSpalten haupt={haupt} seite={seite} seiteBeschriftung="Angaben und Bearbeitung" />
    </WebSeite>
  );
};

export default WebAnfrageDetail;
