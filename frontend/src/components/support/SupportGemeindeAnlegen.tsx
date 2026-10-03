// „Gemeinde anlegen" im Vorgang einer Anfrage, App-Fassung: die Gemeinde aus
// der Anfrage anlegen -- vorbelegt, mit Tarif und Testphase und erster
// Gemeindeleitung. Die Logik steht in components/support/useGemeindeAnlegen.ts,
// dieselbe wie in der Web-Fassung (web/WebGemeindeAnlegen.tsx). Bis zu den
// Vorgaengen (03.10.2026) stand das Formular in der Seite der Anfrage.

import React from 'react';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonToggle,
} from '@ionic/react';
import { ICON_HINZUFUEGEN, ICON_SCHLUESSEL, ICON_SICHTBAR, ICON_VERBORGEN } from '../shared/icons';
import type { GemeindeAnfrage } from '../../types/support';
import { TESTPHASE_KONFIS, TESTPHASE_TAGE, testphaseUmschalten } from '../../utils/supportAnfragen';
import { EIGENES_LIMIT, TARIF_OPTIONEN, lizenzLimit } from '../../utils/lizenzen';
import { generateStrongPassword } from '../../utils/passwortVorschlag';
import { Abschnitt, Feld } from './SupportBausteine';
import type { GemeindeAnlegenDaten } from './useGemeindeAnlegen';

/** Das Formular „Gemeinde anlegen", vorbelegt aus der Anfrage. */
const SupportGemeindeAnlegen: React.FC<{ anfrage: GemeindeAnfrage; d: GemeindeAnlegenDaten }> = ({ anfrage, d }) => {
  const {
    isOnline, formular, setFormular, aendern, kirchenkreise, strukturFehlt, kkGefunden, gewaehlterKreis, eigenesLimit,
    setEigenesLimit, wunsch, passwortZeigen, setPasswortZeigen, kirchenkreisAnlegen, anlegen, legtAn,
  } = d;
  if (!formular) return null;
  return (
    <Abschnitt icon={ICON_HINZUFUEGEN} titel="Gemeinde anlegen" farbe="organizations">
      <p style={{ margin: '0 0 var(--app-abstand-kompakt)', color: 'var(--app-text-body)', fontSize: 'var(--app-text-sekundaer)' }}>
        Vorbelegt aus der Anfrage. Angelegt werden die Gemeinde mit allen Vorlagen und ihre erste
        Gemeindeleitung; alles Weitere richtet die Gemeinde selbst ein.
      </p>
      <IonList style={{ background: 'transparent' }}>
        <Feld label="Name der Gemeinde" pflicht wert={formular.name} onWert={(w) => aendern({ name: w })} />
        <IonItem lines="full" style={{ '--background': 'transparent' }}>
          <IonLabel position="stacked">Kirchenkreis</IonLabel>
          <IonSelect
            aria-label="Kirchenkreis"
            interface="popover"
            value={formular.kirchenkreisId ?? 'ohne'}
            onIonChange={(e) => aendern({ kirchenkreisId: e.detail.value === 'ohne' ? null : Number(e.detail.value) })}
          >
            <IonSelectOption value="ohne">Ohne Kirchenkreis</IonSelectOption>
            {kirchenkreise.map((k) => (
              <IonSelectOption key={k.id} value={k.id}>
                {k.landeskirche ? `${k.name} (${k.landeskirche})` : k.name}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
        {gewaehlterKreis && (
          <p style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
            Landeskirche: {gewaehlterKreis.landeskirche || 'noch keine zugeordnet'}
          </p>
        )}
        {strukturFehlt && (
          <p role="status" style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-fehler)' }}>
            Die Kirchenkreise konnten nicht geladen werden; die Gemeinde lässt sich auch ohne Zuordnung anlegen.
          </p>
        )}
        {!strukturFehlt && anfrage.kirchenkreis && !kkGefunden && (
          <div style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)' }}>
            <p style={{ margin: 0, fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
              „{anfrage.kirchenkreis}“ steht noch nicht in der Struktur.
            </p>
            <IonButton size="small" fill="clear" onClick={() => { void kirchenkreisAnlegen(); }}>
              <IonIcon icon={ICON_HINZUFUEGEN} slot="start" />
              Als Kirchenkreis anlegen
            </IonButton>
          </div>
        )}
        <Feld label="Ansprechperson" wert={formular.kontaktName} onWert={(w) => aendern({ kontaktName: w })} autocomplete="name" />
        <Feld label="E-Mail der Gemeinde" typ="email" wert={formular.kontaktEmail} onWert={(w) => aendern({ kontaktEmail: w })} autocomplete="email" />
        <Feld label="Telefon" typ="tel" wert={formular.kontaktTelefon} onWert={(w) => aendern({ kontaktTelefon: w })} autocomplete="tel" />
        {/* Tarif mit Preis wie unter Gemeinden (utils/lizenzen.ts); Unbegrenzt
            und ein eigenes Limit gehen immer. */}
        <IonItem lines="full" style={{ '--background': 'transparent' }}>
          <IonLabel position="stacked">Tarif</IonLabel>
          <IonSelect
            aria-label="Tarif"
            interface="popover"
            value={eigenesLimit ? EIGENES_LIMIT : formular.maxKonfis.trim()}
            onIonChange={(e) => {
              const wert = String(e.detail.value ?? '');
              if (wert === EIGENES_LIMIT) { setEigenesLimit(true); return; }
              setEigenesLimit(false);
              aendern({ maxKonfis: wert });
            }}
          >
            {TARIF_OPTIONEN.map((t) => (
              <IonSelectOption key={t.name} value={t.wert}>{t.text}</IonSelectOption>
            ))}
            <IonSelectOption value={EIGENES_LIMIT}>Eigenes Limit…</IonSelectOption>
          </IonSelect>
        </IonItem>
        {eigenesLimit && (
          <Feld label="Eigenes Limit" typ="number" wert={formular.maxKonfis} onWert={(w) => aendern({ maxKonfis: w })}
            hinweis="Zahl der Konfis; leer = unbegrenzt." />
        )}
        <p style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
          {wunsch && wunsch.konfis !== null
            ? `In der Testphase ${TESTPHASE_KONFIS}, danach ${wunsch.konfis} (Wunschlizenz ${wunsch.name}).`
            : `In der Testphase ${TESTPHASE_KONFIS}, danach unbegrenzt${wunsch ? ' (Verbund: Limit nach Absprache)' : ''}.`}
        </p>
        <IonItem lines="full" style={{ '--background': 'transparent' }}>
          <IonToggle
            aria-label={`Testphase (${TESTPHASE_TAGE} Tage)`}
            checked={formular.testphase}
            onIonChange={(e) => {
              const an = e.detail.checked;
              setFormular((f) => (f ? testphaseUmschalten(f, an, lizenzLimit(anfrage.wunsch_lizenz)) : f));
            }}
          >
            Testphase ({TESTPHASE_TAGE} Tage)
          </IonToggle>
        </IonItem>
        <p style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
          {formular.testphase
            ? `Zugang ${TESTPHASE_TAGE} Tage ab heute, mit Hinweis auf den Startseiten. Verlängern unter Gemeinden.`
            : 'Ohne Ablaufdatum. Laufzeit und Lizenz lassen sich später unter Gemeinden setzen.'}
        </p>
      </IonList>

      <h3 style={{ margin: 'var(--app-abstand-mittel) 0 var(--app-abstand-eng)', fontSize: 'var(--app-text-standard)', fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-emphasis)' }}>
        Erste Gemeindeleitung
      </h3>
      <IonList style={{ background: 'transparent' }}>
        <Feld label="Benutzername" pflicht wert={formular.adminUsername} onWert={(w) => aendern({ adminUsername: w })} autocomplete="username"
          hinweis="Buchstaben, Ziffern, Punkt und Bindestrich; im ganzen System frei." />
        <Feld label="Anzeigename" pflicht wert={formular.adminDisplayName} onWert={(w) => aendern({ adminDisplayName: w })} autocomplete="name" />
        <Feld label="E-Mail der Gemeindeleitung" typ="email" wert={formular.adminEmail} onWert={(w) => aendern({ adminEmail: w })} autocomplete="email"
          hinweis="Dorthin geht „Passwort vergessen“." />
        <Feld label="Passwort" pflicht typ={passwortZeigen ? 'text' : 'password'} wert={formular.adminPassword}
          onWert={(w) => aendern({ adminPassword: w })} autocomplete="new-password"
          hinweis="Mindestens 8 Zeichen, Groß- und Kleinbuchstabe, Ziffer, Sonderzeichen, keine Leerzeichen." />
      </IonList>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--app-abstand-eng)', margin: 'var(--app-abstand-eng) 0' }}>
        <IonButton size="small" fill="outline" onClick={() => { aendern({ adminPassword: generateStrongPassword() }); setPasswortZeigen(true); }}>
          <IonIcon icon={ICON_SCHLUESSEL} slot="start" />
          Sicheres Passwort vorschlagen
        </IonButton>
        <IonButton size="small" fill="clear" onClick={() => setPasswortZeigen((z) => !z)}>
          <IonIcon icon={passwortZeigen ? ICON_VERBORGEN : ICON_SICHTBAR} slot="start" />
          {passwortZeigen ? 'Passwort verbergen' : 'Passwort zeigen'}
        </IonButton>
      </div>
      <IonButton expand="block" onClick={() => { void anlegen(); }} disabled={legtAn || !isOnline}>
        <IonIcon icon={ICON_HINZUFUEGEN} slot="start" />
        Gemeinde anlegen
      </IonButton>
    </Abschnitt>
  );
};

export default SupportGemeindeAnlegen;
