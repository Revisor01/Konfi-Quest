// „Gemeinde anlegen" im Vorgang einer Anfrage, Web-Fassung: die Gemeinde aus der
// Anfrage anlegen -- vorbelegt, mit Tarif und Testphase und erster
// Gemeindeleitung. Die Logik (Struktur laden, Kirchenkreis anlegen, anlegen mit
// Rückfrage) steht in components/support/useGemeindeAnlegen.ts, dieselbe wie in
// der App; ebenso die Regeln dahinter (utils/supportAnfragen.ts,
// utils/lizenzen.ts). Hier steht nur die Darstellung.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_HINZUFUEGEN, ICON_ORGANISATION, ICON_SCHLUESSEL, ICON_SICHTBAR, ICON_VERBORGEN } from '../../shared/icons';
import type { GemeindeAnfrage } from '../../../types/support';
import { TESTPHASE_KONFIS, TESTPHASE_TAGE, testphaseUmschalten } from '../../../utils/supportAnfragen';
import { EIGENES_LIMIT, TARIF_OPTIONEN, lizenzLimit } from '../../../utils/lizenzen';
import { generateStrongPassword } from '../../../utils/passwortVorschlag';
import type { GemeindeAnlegenDaten } from '../useGemeindeAnlegen';
import WebKarte from '../../web/WebKarte';
import WebKnopf from '../../web/WebKnopf';
import WebHinweis from '../../web/WebHinweis';
import WebFeld from '../../web/WebFeld';
import WebAuswahl from '../../web/WebAuswahl';
import WebSchalter from '../../web/WebSchalter';

/** Die Gemeinde aus der Anfrage anlegen -- vorbelegt, mit erster Gemeindeleitung. */
export const WebAnlegenKarte: React.FC<{ anfrage: GemeindeAnfrage; d: GemeindeAnlegenDaten }> = ({ anfrage, d }) => {
  const {
    formular, setFormular, aendern, kirchenkreise, strukturFehlt, kkGefunden, gewaehlterKreis, eigenesLimit,
    setEigenesLimit, wunsch, passwortZeigen, setPasswortZeigen, kirchenkreisAnlegen, anlegen, legtAn, isOnline,
  } = d;
  if (!formular) return null;

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

/** „Die Gemeinde ist angelegt": Benutzername der Gemeindeleitung und der Weg zur Gemeinde. */
export const WebGemeindeAngelegt: React.FC<{ gemeindeId: number; username: string | null }> = ({ gemeindeId, username }) => (
  <WebHinweis art="erfolg" titel="Die Gemeinde ist angelegt.">
    {username && (
      <p className="web-hinweis__absatz">
        Benutzername der Gemeindeleitung: <strong>{username}</strong>. Benutzername und Passwort auf
        getrennten Wegen weitergeben — nicht beides in derselben Mail.
      </p>
    )}
    <WebKnopf href={`/admin/organizations?gemeinde=${gemeindeId}`}>
      <IonIcon icon={ICON_ORGANISATION} aria-hidden="true" />
      Gemeinde öffnen
    </WebKnopf>
  </WebHinweis>
);
