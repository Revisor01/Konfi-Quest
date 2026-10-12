// „Gemeinde anlegen" im Vorgang einer Anfrage, Web-Fassung -- als breiter
// Dialog (720 px, docs/planung/support-detailseiten.md, H; bis 11.10.2026 eine
// Karte von ≈ 1180 px mitten im Lesebereich): oben eine Zeile aus der
// Anfrage, links Gemeinde und Tarif, rechts die erste Gemeindeleitung; die
// Knopfleiste bleibt unten im Bild. Vorbelegt aus der Anfrage, mit „Als
// Kirchenkreis anlegen", Passwort vorschlagen und zeigen, Prüfung und
// Rückfrage vor dem Anlegen. Beim Anlegen ist der Dialog gesperrt.
//
// Schließen mit Änderungen (Escape, Klick daneben, ✕, Abbrechen) fragt zurück
// -- sonst ginge etwa ein erzeugtes Passwort verloren. WebDialog schließt
// selbst ohne Rückfrage; sie steckt deshalb im Rückruf.
//
// Beide Rückfragen (Verwerfen, Anlegen) sind ein zweites kleines Fenster über
// dem Dialog, wie „Ungespeicherte Änderungen" beim Event. Bis 12.10.2026
// fragte er per ion-alert, und der lag hinter dem Dialog (WebDialog hing an
// <body>): Anlegen ging im Browser nicht, Schließen mit Änderungen wirkte
// tot. Die Fenster stehen neben dem Dialog, nicht in ihm: Tab und Escape
// sollen nicht in den Dialog darunter laufen.
//
// Die Logik (Struktur laden, Kirchenkreis anlegen, prüfen und anlegen)
// steht in components/support/useGemeindeAnlegen.ts, dieselbe wie in der App;
// ebenso die Regeln dahinter (utils/supportAnfragen.ts, utils/lizenzen.ts).

import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_HINZUFUEGEN, ICON_SCHLUESSEL, ICON_SICHTBAR, ICON_VERBORGEN } from '../../shared/icons';
import type { AnfrageAnlegenDaten, GemeindeAnfrage } from '../../../types/support';
import { TESTPHASE_KONFIS, TESTPHASE_TAGE, testphaseUmschalten } from '../../../utils/supportAnfragen';
import { EIGENES_LIMIT, TARIF_OPTIONEN, lizenzLimit } from '../../../utils/lizenzen';
import { generateStrongPassword } from '../../../utils/passwortVorschlag';
import { ANLEGEN_RUECKFRAGE, type GemeindeAnlegenDaten } from '../useGemeindeAnlegen';
import WebDialog from '../../web/WebDialog';
import WebKnopf from '../../web/WebKnopf';
import WebHinweis from '../../web/WebHinweis';
import WebFeld from '../../web/WebFeld';
import WebAuswahl from '../../web/WebAuswahl';
import WebSchalter from '../../web/WebSchalter';

/** Die Rückfrage beim Schließen mit Änderungen. */
const VERWERFEN = {
  titel: 'Eingaben verwerfen?',
  message: 'Die Angaben zur neuen Gemeinde und ein vorgeschlagenes Passwort gehen verloren.',
  bleiben: 'Weiter bearbeiten',
  verwerfen: 'Verwerfen',
} as const;

/** „A. Beispiel (Diakonin) · 38 Konfis · 9 Teamer:innen · Wunsch: Standard" */
const kurzzeile = (a: GemeindeAnfrage, wunsch: string | null): string => [
  a.funktion ? `${a.kontakt_name} (${a.funktion})` : a.kontakt_name,
  a.anzahl_konfis !== null ? `${a.anzahl_konfis} Konfis` : null,
  a.anzahl_teamer !== null ? `${a.anzahl_teamer} Teamer:innen` : null,
  wunsch ? `Wunsch: ${wunsch}` : null,
].filter(Boolean).join(' · ');

/** Welche Rückfrage gerade über dem Dialog steht. */
type Rueckfrage = { art: 'verwerfen' } | { art: 'anlegen'; koerper: AnfrageAnlegenDaten };

const WebGemeindeAnlegen: React.FC<{ anfrage: GemeindeAnfrage; d: GemeindeAnlegenDaten; onSchliessen: () => void }> = ({ anfrage, d, onSchliessen }) => {
  const [rueckfrage, setRueckfrage] = useState<Rueckfrage | null>(null);
  const {
    formular, setFormular, aendern, zuruecksetzen, kirchenkreise, strukturFehlt, kkGefunden, gewaehlterKreis, eigenesLimit,
    setEigenesLimit, wunsch, passwortZeigen, setPasswortZeigen, kirchenkreisAnlegen, anlegenPruefen, anlegenAusfuehren, legtAn, isOnline, geaendert,
  } = d;

  /**
   * Ohne Änderung gleich zu; mit Änderung erst die Rückfrage, dann zurück auf
   * die Vorbelegung (Formular und Vorbelegung zusammen, useGemeindeAnlegen).
   * Ein eben angelegter Kirchenkreis zählt nicht als Änderung.
   */
  const schliessen = () => {
    if (!geaendert) {
      onSchliessen();
      return;
    }
    setRueckfrage({ art: 'verwerfen' });
  };

  /** Prüfen (Meldung bei fehlenden Feldern, ohne Rückfrage), dann fragen. */
  const absenden = () => {
    const koerper = anlegenPruefen();
    if (koerper) setRueckfrage({ art: 'anlegen', koerper });
  };

  return (
    <>
    <WebDialog
      titel="Gemeinde anlegen"
      breit
      gesperrt={legtAn}
      onSchliessen={schliessen}
      onAbsenden={absenden}
      aktionen={(
        <>
          <WebKnopf onClick={schliessen} disabled={legtAn}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={legtAn || !isOnline || !formular}>
            <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
            Gemeinde anlegen
          </WebKnopf>
        </>
      )}
    >
      <p className="web-anlegen__kurz">
        Aus der Anfrage: <strong>{kurzzeile(anfrage, wunsch?.name ?? null)}</strong>
      </p>
      {!formular ? (
        <p className="web-gedaempft" role="status">Das Formular wird vorbereitet.</p>
      ) : (
        <div className="web-anlegen">
          <fieldset className="web-anlegen__spalte">
            <legend className="web-anlegen__gruppe">Gemeinde</legend>
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
            <WebFeld label="Ansprechperson" wert={formular.kontaktName} onWert={(w) => aendern({ kontaktName: w })} autocomplete="name" />
            <WebFeld label="E-Mail der Gemeinde" typ="email" wert={formular.kontaktEmail} onWert={(w) => aendern({ kontaktEmail: w })} autocomplete="email" />
            <WebFeld label="Telefon" typ="tel" wert={formular.kontaktTelefon} onWert={(w) => aendern({ kontaktTelefon: w })} autocomplete="tel" />
          </fieldset>

          <fieldset className="web-anlegen__spalte">
            <legend className="web-anlegen__gruppe">Erste Gemeindeleitung</legend>
            <WebFeld label="Benutzername" pflicht wert={formular.adminUsername} onWert={(w) => aendern({ adminUsername: w })} autocomplete="username"
              hinweis="Buchstaben, Ziffern, Punkt und Bindestrich; im ganzen System frei." />
            <WebFeld label="Anzeigename" pflicht wert={formular.adminDisplayName} onWert={(w) => aendern({ adminDisplayName: w })} autocomplete="name" />
            <WebFeld label="E-Mail der Gemeindeleitung" typ="email" wert={formular.adminEmail} onWert={(w) => aendern({ adminEmail: w })} autocomplete="email"
              hinweis="Dorthin geht „Passwort vergessen“." />
            <WebFeld label="Passwort" pflicht typ={passwortZeigen ? 'text' : 'password'} wert={formular.adminPassword}
              onWert={(w) => aendern({ adminPassword: w })} autocomplete="new-password"
              hinweis="Mindestens 8 Zeichen, Groß- und Kleinbuchstabe, Ziffer, Sonderzeichen, keine Leerzeichen. Benutzername und Passwort getrennt weitergeben." />
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
          </fieldset>
        </div>
      )}
    </WebDialog>
    {rueckfrage?.art === 'verwerfen' && (
      <WebDialog
        titel={VERWERFEN.titel}
        beschreibung={VERWERFEN.message}
        onSchliessen={() => setRueckfrage(null)}
        aktionen={(
          <>
            <WebKnopf onClick={() => setRueckfrage(null)}>{VERWERFEN.bleiben}</WebKnopf>
            <WebKnopf art="gefahr" onClick={() => { setRueckfrage(null); zuruecksetzen(); onSchliessen(); }}>{VERWERFEN.verwerfen}</WebKnopf>
          </>
        )}
      >
        {null}
      </WebDialog>
    )}
    {rueckfrage?.art === 'anlegen' && (
      <WebDialog
        titel={ANLEGEN_RUECKFRAGE.titel}
        beschreibung={ANLEGEN_RUECKFRAGE.frage(rueckfrage.koerper)}
        onSchliessen={() => setRueckfrage(null)}
        aktionen={(
          <>
            <WebKnopf onClick={() => setRueckfrage(null)}>{ANLEGEN_RUECKFRAGE.abbrechen}</WebKnopf>
            <WebKnopf art="primaer" onClick={() => { setRueckfrage(null); void anlegenAusfuehren(rueckfrage.koerper); }}>
              {ANLEGEN_RUECKFRAGE.anlegen}
            </WebKnopf>
          </>
        )}
      >
        {null}
      </WebDialog>
    )}
    </>
  );
};

export default WebGemeindeAnlegen;
