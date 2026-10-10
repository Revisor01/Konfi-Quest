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
// der App: components/support/useSupportKonten.ts. Rahmen, Liste und Zustaende
// stellt WebListenSeite (10.10.2026) -- ohne Kacheln, die wenigen Konten
// stehen nur als Liste.

import React from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_ENTSPERRT,
  ICON_HINZUFUEGEN,
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
import WebKnopf from '../../web/WebKnopf';
import WebPill from '../../web/WebPill';
import WebHinweis from '../../web/WebHinweis';
import WebDialog from '../../web/WebDialog';
import WebFeld from '../../web/WebFeld';
import WebListenSeite from '../../web/WebListenSeite';
import { WebNameZelle, type WebSpalte } from '../../web/WebListe';
import { kontoStatusRang } from '../../../utils/statusReihenfolge';

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

  const spalten: Array<WebSpalte<SupportKonto>> = [
    {
      schluessel: 'name',
      kopf: 'Name',
      breite: '17%',
      sortWert: (k) => k.display_name,
      zelle: (k) => (
        <WebNameZelle
          titel={`${k.display_name}${k.id === userId ? ' (du)' : ''}`}
          unterzeile={k.gemeinden.length > 0 ? `Gast in ${k.gemeinden.map((g) => g.display_name || g.name).join(', ')}` : undefined}
        />
      ),
    },
    {
      schluessel: 'benutzername',
      kopf: 'Benutzername',
      breite: '140px',
      sortWert: (k) => k.username,
      zelle: (k) => <span className="web-einzeilig">{k.username}</span>,
    },
    {
      schluessel: 'email',
      kopf: 'E-Mail',
      breite: '16%',
      optional: true,
      sortWert: (k) => k.email,
      zelle: (k) => (k.email
        ? <a className="web-link web-einzeilig" href={`mailto:${k.email}`}>{k.email}</a>
        : <span className="web-gedaempft">–</span>),
    },
    {
      schluessel: 'status',
      kopf: 'Status',
      breite: '100px',
      sortWert: (k) => kontoStatusRang(k.is_active),
      zelle: (k) => <WebPill ton={k.is_active ? 'erfolg' : 'neutral'} punkt>{k.is_active ? 'Aktiv' : 'Gesperrt'}</WebPill>,
    },
    {
      schluessel: 'angemeldet',
      kopf: 'Zuletzt angemeldet',
      breite: '128px',
      sortWert: (k) => (k.last_login_at ? Date.parse(k.last_login_at) : null),
      zelle: (k) => (k.last_login_at
        ? <span title={datumUhrzeit(k.last_login_at)}>{zeitpunktText(k.last_login_at)}</span>
        : <span className="web-gedaempft">noch nie</span>),
    },
  ];

  // Das eigene Konto bietet die Seite nicht zum Sperren oder Loeschen an: Wer sich selbst sperrt, ist sofort draussen.
  const fremd = (k: SupportKonto) => k.id !== userId;
  const seiteLaedt = laedt && !konten;

  return (
    <WebListenSeite<SupportKonto>
      bereich="Support"
      titel="Support-Konten"
      untertitel={konten && !fehler ? `${mitEinheit(konten.length, 'Support-Konto', 'Support-Konten')} ohne Gemeinde` : undefined}
      aktionen={konten && !fehler ? anlegenKnopf : undefined}
      laden={seiteLaedt ? { text: 'Die Support-Konten werden geladen.' } : undefined}
      fehler={!seiteLaedt && (fehler || !konten) ? { text: 'Die Support-Konten konnten nicht geladen werden.', onErneut: () => { void laden(); } } : undefined}
      oben={(
        <WebHinweis art="hinweis">
          Konten ohne Gemeinde für den Support. Sie melden sich nur im Browser an und haben dieselben Rechte wie jedes
          Super-Admin-Konto. In eine Gemeinde kommen sie nur als sichtbare Gemeindeleitung, unter Gemeinden › Mitglieder &amp; Zuweisungen.
        </WebHinweis>
      )}
      eintraege={konten ?? []}
      liste={{
        beschriftung: 'Support-Konten',
        spalten,
        zeileSchluessel: (k) => k.id,
        zeileKlasse: (k) => (k.is_active ? undefined : 'web-zeile--gesperrt'),
        mittig: true,
        fest: true,
        aktionenBreite: '320px',
        weitere: (k) => (
          <>
            <WebKnopf klein vorn onClick={() => setPasswortFuer({ id: k.id, password: '', zeigen: false })} aria-label={`Passwort für ${k.username} setzen`}>
              <IonIcon icon={ICON_SCHLUESSEL} aria-hidden="true" />
              Passwort
            </WebKnopf>
            {fremd(k) && (
              <WebKnopf klein vorn onClick={() => sperrenUmschalten(k)} disabled={beschaeftigt} aria-label={`${k.display_name} ${k.is_active ? 'sperren' : 'entsperren'}`}>
                <IonIcon icon={k.is_active ? ICON_SPERRE : ICON_ENTSPERRT} aria-hidden="true" />
                {k.is_active ? 'Sperren' : 'Entsperren'}
              </WebKnopf>
            )}
          </>
        ),
        loeschen: {
          onKlick: loeschen,
          beschriftung: (k) => `${k.display_name} löschen`,
          titel: () => 'Support-Konto löschen',
          zeigen: fremd,
          deaktiviert: () => beschaeftigt,
        },
      }}
      leer={{ icon: ICON_PERSON, titel: 'Noch keine Support-Konten', text: 'Lege ein Konto ohne Gemeinde an.' }}
    >
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
    </WebListenSeite>
  );
};

export default WebKonten;
