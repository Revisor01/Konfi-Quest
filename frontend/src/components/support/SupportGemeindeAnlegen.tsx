// „Gemeinde anlegen" im Vorgang einer Anfrage, App-Fassung: die Gemeinde aus
// der Anfrage anlegen -- vorbelegt, mit Tarif und Testphase und erster
// Gemeindeleitung. Die Logik steht in components/support/useGemeindeAnlegen.ts,
// dieselbe wie in der Web-Fassung (web/WebGemeindeAnlegen.tsx). Bis zu den
// Vorgaengen (03.10.2026) stand das Formular in der Seite der Anfrage.
//
// Seit 11.10.2026 (docs/planung/support-detailseiten.md, App F) ist es der
// Inhalt des Vollbild-Modals „Gemeinde anlegen" (GemeindeAnlegenModal in
// SupportModale.tsx) statt einer Karte mitten im Verlauf: oben eine Zeile aus
// der Anfrage, dann Gemeinde, Tarif und erste Gemeindeleitung. Angelegt wird
// über „Anlegen" in der Kopfzeile oder den Knopf ganz unten -- beide mit
// Rückfrage.

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
import { ICON_HINZUFUEGEN, ICON_KATEGORIE, ICON_ORGANISATION, ICON_PERSON, ICON_SCHLUESSEL, ICON_SICHTBAR, ICON_VERBORGEN } from '../shared/icons';
import type { GemeindeAnfrage } from '../../types/support';
import { TESTPHASE_KONFIS, TESTPHASE_TAGE, testphaseUmschalten } from '../../utils/supportAnfragen';
import { EIGENES_LIMIT, TARIF_OPTIONEN, lizenzLimit } from '../../utils/lizenzen';
import { generateStrongPassword } from '../../utils/passwortVorschlag';
import { Abschnitt, Feld } from './SupportBausteine';
import type { GemeindeAnlegenDaten } from './useGemeindeAnlegen';

const META = { margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' } as const;

/** Die Kurzzeile aus der Anfrage: „A. Beispiel (Diakonin) · 38 Konfis · 9 Teamer:innen · Wunsch Standard". */
const anfrageKurzzeile = (anfrage: GemeindeAnfrage, wunsch: string | null): string => [
  anfrage.kontakt_name ? `${anfrage.kontakt_name}${anfrage.funktion ? ` (${anfrage.funktion})` : ''}` : null,
  anfrage.anzahl_konfis !== null && anfrage.anzahl_konfis !== undefined ? `${anfrage.anzahl_konfis} Konfis` : null,
  anfrage.anzahl_teamer !== null && anfrage.anzahl_teamer !== undefined ? `${anfrage.anzahl_teamer} Teamer:innen` : null,
  wunsch ? `Wunsch ${wunsch}` : null,
].filter(Boolean).join(' · ');

/** Das Formular „Gemeinde anlegen", vorbelegt aus der Anfrage. */
const SupportGemeindeAnlegen: React.FC<{ anfrage: GemeindeAnfrage; d: GemeindeAnlegenDaten }> = ({ anfrage, d }) => {
  const {
    isOnline, formular, setFormular, aendern, kirchenkreise, strukturFehlt, kkGefunden, gewaehlterKreis, eigenesLimit,
    setEigenesLimit, wunsch, passwortZeigen, setPasswortZeigen, kirchenkreisAnlegen, anlegen, legtAn,
  } = d;
  if (!formular) return null;
  return (
    <>
      <p className="support-modal__zeile" style={{ margin: 'var(--app-abstand-basis) var(--app-abstand-basis) 0' }}>
        {anfrageKurzzeile(anfrage, wunsch?.name ?? null)}
      </p>

      <Abschnitt icon={ICON_ORGANISATION} titel="Gemeinde" farbe="organizations">
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
          {gewaehlterKreis && <p style={META}>Landeskirche: {gewaehlterKreis.landeskirche || 'noch keine zugeordnet'}</p>}
          {strukturFehlt && (
            <p role="status" style={{ ...META, color: 'var(--app-text-fehler)' }}>
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
        </IonList>
      </Abschnitt>

      <Abschnitt icon={ICON_KATEGORIE} titel="Tarif" farbe="organizations">
        <IonList style={{ background: 'transparent' }}>
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
          <p style={META}>
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
          <p style={META}>
            {formular.testphase
              ? `Zugang ${TESTPHASE_TAGE} Tage ab heute, mit Hinweis auf den Startseiten. Verlängern unter Gemeinden.`
              : 'Ohne Ablaufdatum. Laufzeit und Lizenz lassen sich später unter Gemeinden setzen.'}
          </p>
        </IonList>
      </Abschnitt>

      <Abschnitt icon={ICON_PERSON} titel="Erste Gemeindeleitung" farbe="organizations">
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
      </Abschnitt>

      <div style={{ margin: '0 var(--app-abstand-basis) var(--app-abstand-riesig)' }}>
        <IonButton expand="block" onClick={() => { void anlegen(); }} disabled={legtAn || !isOnline}>
          <IonIcon icon={ICON_HINZUFUEGEN} slot="start" />
          Gemeinde anlegen
        </IonButton>
      </div>
    </>
  );
};

export default SupportGemeindeAnlegen;
