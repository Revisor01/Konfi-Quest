// Support-Konten in der Web-Fassung der Support-Ansicht,
// /admin/support/konten (docs/planung/support-web.md, Phase 2; Backend
// backend/routes/supportKonten.js).
//
// Konten ohne Gemeinde fuer die Support-Person als Tabelle: Name, Benutzername,
// E-Mail, Status (aktiv/gesperrt), zuletzt angemeldet und die Aktionen
// Passwort setzen, Sperren bzw. Entsperren und Loeschen -- Sperren, Loeschen
// und das eigene Passwort mit Rueckfrage, wie in der App. Anlegen und
// Passwort setzen laufen in einem Dialog. Das eigene Konto bietet die Seite
// gar nicht erst zum Sperren oder Loeschen an: Wer sich selbst sperrt, ist
// sofort draussen. Das letzte aktive Super-Admin-Konto lehnt der Server mit
// 409 ab; den Satz zeigt die Seite als Hinweis, der stehen bleibt.
//
// Die Logik (laden, anlegen, sperren, loeschen, Passwort) ist dieselbe wie in
// der App: components/support/useSupportKonten.ts.

import React from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_ENTSPERRT,
  ICON_HINZUFUEGEN,
  ICON_LOESCHEN,
  ICON_PERSON,
  ICON_SCHLUESSEL,
  ICON_SICHTBAR,
  ICON_SPERRE,
  ICON_VERBORGEN,
} from '../../shared/icons';
import type { SupportKonto } from '../../../types/support';
import { generateStrongPassword } from '../../../utils/passwortVorschlag';
import { mitEinheit } from '../../../utils/supportStatistik';
import { zeitpunktText } from '../../../utils/postfach';
import { datumUhrzeit } from '../../../utils/dateUtils';
import { LEERES_KONTO, useSupportKonten } from '../useSupportKonten';
import WebSeite from '../../web/WebSeite';
import WebKnopf from '../../web/WebKnopf';
import WebPill from '../../web/WebPill';
import WebHinweis from '../../web/WebHinweis';
import WebDialog from '../../web/WebDialog';
import WebFeld from '../../web/WebFeld';
import WebTabelle, { type WebSpalte } from '../../web/WebTabelle';
import { WebFehler, WebLaden, WebLeer } from '../../web/WebZustaende';

const WebKonten: React.FC = () => {
  const {
    userId, isOnline, konten, laedt, fehler, beschaeftigt, neu, setNeu, neuPasswortZeigen, setNeuPasswortZeigen, passwortFuer,
    setPasswortFuer, laden, anlegen, sperrenUmschalten, loeschen, passwortSpeichern,
  } = useSupportKonten();

  const kontoMitPasswort = passwortFuer ? konten?.find((k) => k.id === passwortFuer.id) ?? null : null;

  const anlegenKnopf = (
    <WebKnopf art="primaer" onClick={() => { setNeuPasswortZeigen(false); setNeu({ ...LEERES_KONTO }); }}>
      <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
      Support-Konto anlegen
    </WebKnopf>
  );

  if (laedt && !konten) {
    return (
      <WebSeite bereich="Support" titel="Support-Konten">
        <WebLaden karten={1} text="Die Support-Konten werden geladen." />
      </WebSeite>
    );
  }
  if (fehler || !konten) {
    return (
      <WebSeite bereich="Support" titel="Support-Konten">
        <WebFehler text="Die Support-Konten konnten nicht geladen werden." onErneut={() => { void laden(); }} />
      </WebSeite>
    );
  }

  const spalten: Array<WebSpalte<SupportKonto>> = [
    {
      schluessel: 'name',
      kopf: 'Name',
      breite: '17%',
      zelle: (k) => (
        <>
          <span className="web-zelle-titel">{k.display_name}{k.id === userId ? ' (du)' : ''}</span>
          {k.gemeinden.length > 0 && (
            <span className="web-zelle-leise">Gast in {k.gemeinden.map((g) => g.display_name || g.name).join(', ')}</span>
          )}
        </>
      ),
    },
    {
      schluessel: 'benutzername',
      kopf: 'Benutzername',
      breite: '140px',
      zelle: (k) => <span className="web-einzeilig">{k.username}</span>,
    },
    {
      schluessel: 'email',
      kopf: 'E-Mail',
      breite: '16%',
      optional: true,
      zelle: (k) => (k.email
        ? <a className="web-link web-einzeilig" href={`mailto:${k.email}`}>{k.email}</a>
        : <span className="web-gedaempft">–</span>),
    },
    {
      schluessel: 'status',
      kopf: 'Status',
      breite: '100px',
      zelle: (k) => <WebPill ton={k.is_active ? 'erfolg' : 'neutral'} punkt>{k.is_active ? 'Aktiv' : 'Gesperrt'}</WebPill>,
    },
    {
      schluessel: 'angemeldet',
      kopf: 'Zuletzt angemeldet',
      breite: '128px',
      zelle: (k) => (k.last_login_at
        ? <span title={datumUhrzeit(k.last_login_at)}>{zeitpunktText(k.last_login_at)}</span>
        : <span className="web-gedaempft">noch nie</span>),
    },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      breite: '372px',
      zelle: (k) => (
        <div className="web-zeilenaktionen">
          <WebKnopf klein onClick={() => setPasswortFuer({ id: k.id, password: '', zeigen: false })} aria-label={`Passwort für ${k.username} setzen`}>
            <IonIcon icon={ICON_SCHLUESSEL} aria-hidden="true" />
            Passwort
          </WebKnopf>
          {k.id !== userId && (
            <>
              <WebKnopf klein onClick={() => sperrenUmschalten(k)} disabled={beschaeftigt} aria-label={`${k.display_name} ${k.is_active ? 'sperren' : 'entsperren'}`}>
                <IonIcon icon={k.is_active ? ICON_SPERRE : ICON_ENTSPERRT} aria-hidden="true" />
                {k.is_active ? 'Sperren' : 'Entsperren'}
              </WebKnopf>
              <WebKnopf klein art="gefahr" onClick={() => loeschen(k)} disabled={beschaeftigt} aria-label={`${k.display_name} löschen`}>
                <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
                Löschen
              </WebKnopf>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <WebSeite
      bereich="Support"
      titel="Support-Konten"
      untertitel={`${mitEinheit(konten.length, 'Support-Konto', 'Support-Konten')} ohne Gemeinde`}
      aktionen={anlegenKnopf}
    >
      <WebHinweis art="hinweis">
        Konten ohne Gemeinde für den Support. Sie melden sich nur im Browser an und haben dieselben Rechte wie jedes
        Super-Admin-Konto. In eine Gemeinde kommen sie nur als sichtbare Gemeindeleitung, unter Gemeinden › Mitglieder &amp; Zuweisungen.
      </WebHinweis>

      <div className="web-karte">
        {konten.length === 0 ? (
          <WebLeer
            icon={ICON_PERSON}
            titel="Noch keine Support-Konten"
            text="Lege ein Konto ohne Gemeinde an."
          />
        ) : (
          <WebTabelle
            beschriftung="Support-Konten"
            spalten={spalten}
            zeilen={konten}
            zeileSchluessel={(k) => k.id}
            zeileKlasse={(k) => (k.is_active ? undefined : 'web-zeile--gesperrt')}
            mittig
            fest
          />
        )}
      </div>

      {neu && (
        <WebDialog
          titel="Support-Konto anlegen"
          beschreibung="Ein Konto ohne Gemeinde. Benutzername und Passwort gibst du auf getrennten Wegen weiter."
          onSchliessen={() => { setNeu(null); setNeuPasswortZeigen(false); }}
          onAbsenden={() => { void anlegen(); }}
          aktionen={(
            <>
              <WebKnopf onClick={() => { setNeu(null); setNeuPasswortZeigen(false); }}>Abbrechen</WebKnopf>
              <WebKnopf art="primaer" absenden disabled={beschaeftigt || !isOnline}>Anlegen</WebKnopf>
            </>
          )}
        >
          <WebFeld label="Benutzername" pflicht wert={neu.username} onWert={(w) => setNeu({ ...neu, username: w })} autocomplete="username"
            hinweis="Buchstaben, Ziffern, Punkt und Bindestrich; im ganzen System frei." />
          <WebFeld label="Anzeigename" pflicht wert={neu.display_name} onWert={(w) => setNeu({ ...neu, display_name: w })} autocomplete="name" />
          <WebFeld label="E-Mail" typ="email" wert={neu.email} onWert={(w) => setNeu({ ...neu, email: w })} autocomplete="email"
            hinweis="Freiwillig; dorthin geht „Passwort vergessen“." />
          <WebFeld label="Passwort" pflicht typ={neuPasswortZeigen ? 'text' : 'password'} wert={neu.password}
            onWert={(w) => setNeu({ ...neu, password: w })} autocomplete="new-password"
            hinweis="Mindestens 8 Zeichen, Groß- und Kleinbuchstabe, Ziffer, Sonderzeichen, keine Leerzeichen." />
          <div className="web-formular__knoepfe">
            <WebKnopf klein onClick={() => { setNeu({ ...neu, password: generateStrongPassword() }); setNeuPasswortZeigen(true); }}>
              <IonIcon icon={ICON_SCHLUESSEL} aria-hidden="true" />
              Sicheres Passwort vorschlagen
            </WebKnopf>
            <WebKnopf klein art="text" onClick={() => setNeuPasswortZeigen((z) => !z)}>
              <IonIcon icon={neuPasswortZeigen ? ICON_VERBORGEN : ICON_SICHTBAR} aria-hidden="true" />
              {neuPasswortZeigen ? 'Passwort verbergen' : 'Passwort zeigen'}
            </WebKnopf>
          </div>
        </WebDialog>
      )}

      {passwortFuer && kontoMitPasswort && (
        <WebDialog
          titel={`Passwort für ${kontoMitPasswort.username} setzen`}
          onSchliessen={() => setPasswortFuer(null)}
          onAbsenden={() => { void passwortSpeichern(kontoMitPasswort); }}
          aktionen={(
            <>
              <WebKnopf onClick={() => setPasswortFuer(null)}>Abbrechen</WebKnopf>
              <WebKnopf art="primaer" absenden disabled={beschaeftigt || !isOnline}>Passwort setzen</WebKnopf>
            </>
          )}
        >
          <WebFeld
            label={`Neues Passwort für ${kontoMitPasswort.username}`}
            pflicht
            typ={passwortFuer.zeigen ? 'text' : 'password'}
            wert={passwortFuer.password}
            onWert={(w) => setPasswortFuer({ ...passwortFuer, password: w })}
            autocomplete="new-password"
            hinweis="Alle Sitzungen des Kontos enden; eine Sperre nach Fehlversuchen endet auch."
          />
          <div className="web-formular__knoepfe">
            <WebKnopf klein onClick={() => setPasswortFuer({ ...passwortFuer, password: generateStrongPassword(), zeigen: true })}>
              <IonIcon icon={ICON_SCHLUESSEL} aria-hidden="true" />
              Vorschlagen
            </WebKnopf>
            <WebKnopf klein art="text" onClick={() => setPasswortFuer({ ...passwortFuer, zeigen: !passwortFuer.zeigen })}>
              <IonIcon icon={passwortFuer.zeigen ? ICON_VERBORGEN : ICON_SICHTBAR} aria-hidden="true" />
              {passwortFuer.zeigen ? 'Passwort verbergen' : 'Passwort zeigen'}
            </WebKnopf>
          </div>
        </WebDialog>
      )}
    </WebSeite>
  );
};

export default WebKonten;
