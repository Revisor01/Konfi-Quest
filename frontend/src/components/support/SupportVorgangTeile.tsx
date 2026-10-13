// Bausteine der App-Fassung der Support-Detailseiten
// (docs/planung/support-detailseiten.md, „In der App", Skizzen App A bis C;
// Simon, 11.10.2026: Hauptknopf oben in der Karte „Stand").
//
//   - StandKarte: Marken (antippen öffnet „Einordnen"), der Satz, wer dran ist,
//     die Zusatzzeile (Lizenz), ein Hinweis mit eigenem Knopf (Mail: „Absender
//     gehört zu …" und „In Vorgang N einsortieren"), der Hauptknopf 2 :
//     Nebenknopf 1 und die Notiz. Allgemein gehalten -- die Mail im
//     Posteingang nutzt sie ebenso.
//   - NotizZeile: die interne Notiz als Zeile der Karte; antippen öffnet das Modal.
//   - Antwortzeile: unter der jüngsten Mail, öffnet das Modal „Antworten".
//   - AngabenAbschnitte: die Karten aus vorgangAngaben (Lizenz, Anfrage,
//     Kontakt, Gemeinde) als Abschnitte der App; die Gemeindeleitung eingeklappt.
//
// Was wann steht, entscheidet die Regel-Stelle (utils/supportVorgaenge.ts:
// vorgangStand, vorgangAngaben); hier wird nur angezeigt.

import React, { useId, useState } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import {
  ICON_ANTWORTEN,
  ICON_AUFKLAPPEN,
  ICON_HINZUFUEGEN,
  ICON_KATEGORIE,
  ICON_ORGANISATION,
  ICON_PERSON,
  ICON_TEXTDOKUMENT,
  ICON_WEITER_GEFUELLT,
  ICON_ZUKLAPPEN,
} from '../shared/icons';
import type { PillTon } from '../../utils/supportWeb';
import type { AngabeAktion, AngabenKarte, StandTon } from '../../utils/supportVorgaenge';
import { ANGABEN_TEXT, APP_VORGANG_TEXT, LIZENZ_TEXT } from '../../seiten/supportDetail';
import { Abschnitt } from './SupportBausteine';
import AdresseMitUmbruch from './AdresseMitUmbruch';
import './SupportVorgangTeile.css';

// --- Stand ------------------------------------------------------------------------

/** Ein Knopf der Karte „Stand". */
export interface StandKnopf {
  schluessel: string;
  label: string;
  /** Tooltip mit dem ausführlichen Satz. */
  titel?: string;
  icon?: string;
  onKlick: () => void;
  gesperrt?: boolean;
  /** Rot umrandet (Ablehnen). */
  gefahr?: boolean;
}

/** Eine Marke der Karte; mit onKlick ein Knopf (öffnet „Einordnen"). */
export interface StandKarteMarke {
  schluessel: string;
  text: string;
  ton: PillTon;
  onKlick?: () => void;
  /** Name für Vorlesehilfen, wenn die Marke ein Knopf ist. */
  beschriftung?: string;
}

/** Ein Hinweis in der Karte, mit einem eigenen Knopf darunter (nicht darin -- kein Knopf im Knopf). */
export interface StandKarteHinweis {
  text: string;
  knopf?: StandKnopf | null;
}

export interface StandKarteProps {
  marken: readonly StandKarteMarke[];
  satz: string | null;
  ton: StandTon | null;
  zusatz?: { text: string; ton: StandTon } | null;
  /** Unter Satz und Zusatz, über den Knöpfen (Mail: „Absender gehört zu …"). */
  hinweis?: StandKarteHinweis | null;
  haupt: StandKnopf | null;
  neben: readonly StandKnopf[];
  /** Unter den Knöpfen, durch eine Linie getrennt: die Notiz. */
  notiz?: React.ReactNode;
  /** Name der Karte für Vorlesehilfen. */
  beschriftung?: string;
}

const Knopf: React.FC<{ k: StandKnopf; haupt: boolean }> = ({ k, haupt }) => (
  <IonButton
    className={haupt ? 'support-stand__haupt' : 'support-stand__neben'}
    expand="block"
    fill={haupt ? 'solid' : 'outline'}
    color={k.gefahr ? 'danger' : undefined}
    title={k.titel}
    disabled={k.gesperrt}
    onClick={k.onKlick}
  >
    {k.icon && <IonIcon icon={k.icon} slot="start" aria-hidden="true" />}
    {k.label}
  </IonButton>
);

/**
 * Die Karte „Stand": oben die Marken, dann der Satz, wer dran ist, darunter
 * die Knöpfe -- der Hauptknopf folgt dem Stand (2 : 1 zum Nebenknopf; mit zwei
 * Nebenknöpfen steht er allein darüber) -- und zuletzt die Notiz.
 */
export const StandKarte: React.FC<StandKarteProps> = ({ marken, satz, ton, zusatz = null, hinweis = null, haupt, neben, notiz, beschriftung = 'Stand' }) => {
  const knoepfe = haupt ? neben.length : 0;
  const reihe = knoepfe === 0 ? ' support-stand__knoepfe--allein' : knoepfe >= 2 ? ' support-stand__knoepfe--drei' : '';
  return (
    <section className="support-stand" aria-label={beschriftung}>
      {marken.length > 0 && (
        <div className="support-stand__marken">
          {marken.map((m) => (m.onKlick ? (
            <button key={m.schluessel} type="button" className={`support-marke support-marke--${m.ton}`} onClick={m.onKlick}
              aria-label={m.beschriftung ?? m.text} title={m.beschriftung}>
              {m.text}
            </button>
          ) : (
            <span key={m.schluessel} className={`support-marke support-marke--${m.ton}`}>{m.text}</span>
          )))}
        </div>
      )}
      {satz && <p className={`support-stand__satz support-stand__satz--${ton ?? 'neutral'}`}>{satz}</p>}
      {zusatz && <p className={`support-stand__zusatz support-stand__zusatz--${zusatz.ton}`}>{zusatz.text}</p>}
      {hinweis && (
        <div className="support-stand__hinweis">
          <p className="support-stand__hinweis-text">{hinweis.text}</p>
          {hinweis.knopf && (
            <IonButton
              className="support-stand__hinweis-knopf"
              fill="outline"
              size="small"
              title={hinweis.knopf.titel}
              disabled={hinweis.knopf.gesperrt}
              onClick={hinweis.knopf.onKlick}
            >
              {hinweis.knopf.icon && <IonIcon icon={hinweis.knopf.icon} slot="start" aria-hidden="true" />}
              {hinweis.knopf.label}
            </IonButton>
          )}
        </div>
      )}
      {(haupt || neben.length > 0) && (
        <div className={`support-stand__knoepfe${reihe}`}>
          {haupt && <Knopf k={haupt} haupt />}
          {neben.map((k) => <Knopf key={k.schluessel} k={k} haupt={false} />)}
        </div>
      )}
      {notiz}
    </section>
  );
};

/**
 * Die interne Notiz als letzte Zeile der Karte „Stand" (leer: „Interne Notiz"
 * mit Plus). Ein Knopf mit eigenem Namen -- ohne Gruppe drumherum, die
 * Vorlesehilfen nur zusätzlich ankündigten.
 */
export const NotizZeile: React.FC<{ notiz: string | null; onKlick: () => void }> = ({ notiz, onKlick }) => {
  const text = notiz?.trim() ?? '';
  return (
    <button
      type="button"
      className={`support-stand__notiz${text ? '' : ' support-stand__notiz--leer'}`}
      onClick={onKlick}
      aria-label={text ? APP_VORGANG_TEXT.notizBearbeiten(text) : APP_VORGANG_TEXT.notizHinzufuegen}
    >
      <IonIcon icon={text ? ICON_TEXTDOKUMENT : ICON_HINZUFUEGEN} aria-hidden="true" />
      <span className="support-stand__notiz-text">
        {text ? <><strong>{APP_VORGANG_TEXT.notizMarke}</strong> {text}</> : APP_VORGANG_TEXT.notizLeer}
      </span>
      <IonIcon icon={ICON_WEITER_GEFUELLT} aria-hidden="true" />
    </button>
  );
};

/** Unter der jüngsten Mail: „Antwort an …"; gesperrt mit dem Grund (Stand Fall 2). */
export const Antwortzeile: React.FC<{ an: string | null; gesperrt: boolean; grund?: string; onKlick: () => void }> = ({ an, gesperrt, grund, onKlick }) => (
  <button type="button" className="support-antwortzeile" onClick={onKlick} disabled={gesperrt} title={gesperrt ? grund : undefined}>
    <IonIcon icon={ICON_ANTWORTEN} aria-hidden="true" />
    <span className="support-antwortzeile__text">
      {gesperrt ? grund ?? APP_VORGANG_TEXT.antwortzeileKeinWeg : APP_VORGANG_TEXT.antwortzeile(an)}
    </span>
    {!gesperrt && <IonIcon icon={ICON_WEITER_GEFUELLT} aria-hidden="true" />}
  </button>
);

// --- Angaben ----------------------------------------------------------------------

const KARTEN_SYMBOL: Record<AngabenKarte['schluessel'], string> = {
  lizenz: ICON_KATEGORIE,
  anfrage: ICON_TEXTDOKUMENT,
  kontakt: ICON_PERSON,
  gemeinde: ICON_ORGANISATION,
};

export interface AngabenAbschnitteProps {
  karten: readonly AngabenKarte[];
  /** Eine Aktion an einer Zeile oder Karte (Im Vorgang antworten, Zuordnen, Lizenz ändern, Kirchenkreis anlegen). */
  onAktion: (art: AngabeAktion, adresse?: string) => void;
  /** Ein Link der Karte (Gemeinde öffnen, Alle Vorgänge). */
  onLink: (href: string) => void;
  /** Ohne Netz: die Aktionen sind gesperrt. */
  gesperrt?: boolean;
}

/** Die Gemeindeleitung, eingeklappt: „Gemeindeleitung (2)". */
const Leitung: React.FC<{ karte: AngabenKarte; gesperrt: boolean; onAktion: AngabenAbschnitteProps['onAktion'] }> = ({ karte, gesperrt, onAktion }) => {
  const [offen, setOffen] = useState(false);
  const id = useId();
  const personen = karte.leitung ?? [];
  if (personen.length === 0) return null;
  return (
    <>
      <button type="button" className="support-zeilenknopf support-leitung__knopf" aria-expanded={offen} aria-controls={id} onClick={() => setOffen((o) => !o)}>
        <span>{`Gemeindeleitung (${personen.length})`}</span>
        <IonIcon icon={offen ? ICON_ZUKLAPPEN : ICON_AUFKLAPPEN} aria-hidden="true" />
      </button>
      {offen && (
        <ul id={id} className="support-leitung">
          {personen.map((p) => (
            <li key={p.id} className="support-leitung__person">
              <span className="support-leitung__name">
                {p.name}
                {p.gesperrt && <span className="support-marke support-marke--fehler">{ANGABEN_TEXT.gesperrt}</span>}
              </span>
              <span className="support-leitung__zeile">
                {p.email ? <a href={`mailto:${p.email}`}><AdresseMitUmbruch adresse={p.email} /></a> : ANGABEN_TEXT.keineEmail}
                {` · ${p.anmeldung}`}
              </span>
              {p.email && (
                <button type="button" className="support-angabe__aktion" disabled={gesperrt} onClick={() => onAktion('im_vorgang_antworten', p.email ?? undefined)}>
                  {ANGABEN_TEXT.imVorgangAntworten}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

/**
 * Die Angaben als Abschnitte der App, in der Reihenfolge der Regel-Stelle:
 * Lizenz, Anfrage, Kontakt, Gemeinde. Jede Zeile „Bezeichnung | Wert"; Links
 * (mailto:, tel:) im Wert, Aktionen darunter. Die Gemeinde trägt ihren Namen
 * als Überschrift, die Gemeindeleitung ist eingeklappt.
 */
export const AngabenAbschnitte: React.FC<AngabenAbschnitteProps> = ({ karten, onAktion, onLink, gesperrt = false }) => (
  <>
    {karten.map((karte) => (
      <Abschnitt key={karte.schluessel} icon={KARTEN_SYMBOL[karte.schluessel]} titel={karte.titel} farbe="organizations">
        <div className="support-angaben" data-karte={karte.schluessel}>
          {karte.zeilen.map((z) => (
            <div key={z.schluessel} className="support-angabe">
              <span className="support-angabe__label">{z.label}</span>
              <span className={`support-angabe__wert${z.ton && z.ton !== 'neutral' ? ` support-angabe__wert--${z.ton}` : ''}`} title={z.titel}>
                {z.href ? <a href={z.href}>{z.href.startsWith('mailto:') ? <AdresseMitUmbruch adresse={z.wert} /> : z.wert}</a> : z.wert}
                {z.aktion && (
                  <>
                    <br />
                    <button type="button" className="support-angabe__aktion" disabled={gesperrt} onClick={() => onAktion(z.aktion!.art, z.aktion!.adresse)}>
                      {z.aktion.label}
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
          {karte.schluessel === 'gemeinde' && <Leitung karte={karte} gesperrt={gesperrt} onAktion={onAktion} />}
          {karte.links.map((l) => (
            <button key={l.href} type="button" className="support-zeilenknopf" onClick={() => onLink(l.href)}>
              <span>{l.label}</span>
              <IonIcon icon={ICON_WEITER_GEFUELLT} aria-hidden="true" />
            </button>
          ))}
        </div>
        {karte.aktion && (
          <IonButton className="support-karte__aktion" expand="block" fill="outline" disabled={karte.aktion.gesperrt || gesperrt}
            title={karte.aktion.gesperrt ? LIZENZ_TEXT.ohneGemeindeGesperrt : undefined}
            onClick={() => onAktion(karte.aktion!.art)}>
            {karte.aktion.art === 'lizenz_aendern' ? LIZENZ_TEXT.aendern : karte.aktion.label}
          </IonButton>
        )}
      </Abschnitt>
    ))}
  </>
);
