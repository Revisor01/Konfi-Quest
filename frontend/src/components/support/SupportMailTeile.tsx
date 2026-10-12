// Gemeinsame Teile der Support-Mail (03.10.2026, docs/planung/support-mail.md):
// der Hinweis-Kasten und das Antwortformular mit Textbausteinen, Platzhaltern,
// Vorschau samt Fusszeile und Rueckfrage vor dem Senden. Die Mails selbst
// zeigt MailGespraeche (11.10.2026) -- in App und Web derselbe Baustein. Die
// Regeln dahinter stehen rein in utils/supportMail.ts.
//
// Das Antwortformular der App (docs/planung/support-detailseiten.md, App F;
// 11.10.2026): oben die Mail, auf die geantwortet wird („Du antwortest auf",
// drei Zeilen, antippen zeigt sie ganz), Warnungen zu Server und Postfach als
// eine Zeile, „An" mit lesbarer Herkunft (genau eine Adresse: eine feste
// Zeile, sonst die Wahl), Betreff, Text, Bausteine, die Vorschau mit Fußzeile
// eingeklappt und „Danach" als Segment (Wartet · In Arbeit · Erledigt; bei
// einer Anfrage, die noch nicht angelegt ist, ohne Erledigt).

import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/react';
import {
  ICON_AUFKLAPPEN,
  ICON_HINZUFUEGEN,
  ICON_INFO,
  ICON_SENDEN_GEFUELLT,
  ICON_WARNHINWEIS,
  ICON_ZUKLAPPEN,
} from '../shared/icons';
import type { MailNachricht, Postfach } from '../../types/support';
import {
  POSTFACH_INFO,
  SERVER_AUS_HINWEIS,
  sendeHinweisText,
  type SendeProblem,
} from '../../utils/supportMail';
import { standZeit, type VorgangStatus } from '../../utils/supportVorgaenge';
import { mailTextZerlegen } from '../../utils/mailGespraeche';
import { inFassung } from '../../seiten/beschreibung';
import { APP_VORGANG_TEXT, DANACH_BESCHRIFTUNG, DANACH_WAHLEN, VERLAUF_TEXT } from '../../seiten/supportDetail';
import { Feld } from './SupportBausteine';
import { useAntwortEditor, type AntwortEditor, type AntwortFormularProps } from './useAntwortEditor';
import './SupportVorgangTeile.css';

export type { AntwortFormularProps } from './useAntwortEditor';

/** Ein Hinweis in einer Karte: Symbol, Titel, Text. Farbe nach Art. */
export const Hinweis: React.FC<{ art: 'warnung' | 'fehler' | 'hinweis'; titel: string; children?: React.ReactNode; rolle?: 'alert' | 'status' }> = ({
  art, titel, children, rolle = 'status',
}) => (
  <div
    role={rolle}
    style={{
      display: 'flex', alignItems: 'flex-start', gap: 'var(--app-abstand-eng)',
      padding: 'var(--app-abstand-schmal) var(--app-abstand-mittel)', borderRadius: 'var(--app-radius-karte)',
      background: `var(--app-flaeche-${art})`, border: `1px solid var(--app-rand-${art})`,
      color: art === 'fehler' ? 'var(--app-text-fehler)' : art === 'warnung' ? 'var(--app-text-warnung)' : 'var(--app-text-hinweis-dunkel)',
      fontSize: 'var(--app-text-sekundaer)', margin: 'var(--app-abstand-eng) 0',
    }}
  >
    <IonIcon icon={art === 'hinweis' ? ICON_INFO : ICON_WARNHINWEIS} aria-hidden="true" style={{ flexShrink: 0, marginTop: 'var(--app-abstand-haar)' }} />
    <div>
      <strong>{titel}</strong>
      {children && <div style={{ marginTop: 'var(--app-abstand-winzig)' }}>{children}</div>}
    </div>
  </div>
);

// --- Antworten ------------------------------------------------------------------

/** Texte der drei bekannten Probleme beim Senden (Vertrag und Nachtrag 03.10.2026). */
const SendeHinweis: React.FC<{ problem: SendeProblem; postfach: Postfach }> = ({ problem, postfach }) => {
  const { titel, text } = sendeHinweisText(problem, postfach);
  return <Hinweis art="fehler" rolle="alert" titel={titel}>{text}</Hinweis>;
};

/** Eine Zeile Warnung über „An" (Server aus, Postfach nicht eingerichtet). */
const HinweisZeile: React.FC<{ titel: string; children: React.ReactNode }> = ({ titel, children }) => (
  <p className="support-antwort__hinweis" role="status">
    <IonIcon icon={ICON_WARNHINWEIS} aria-hidden="true" />
    <span><strong>{titel}</strong> – {children}</span>
  </p>
);

/**
 * Läuft der auf drei Zeilen gekürzte Text über? Gemessen, nicht nach Zeichen
 * gezählt: Bei großer Systemschrift oder schmalem Gerät reichen drei Zeilen
 * schon für 110 Zeichen nicht (bis 11.10.2026 stand „ganz lesen" erst ab 120
 * Zeichen da, und der Rest war nicht zu lesen). Ein ResizeObserver misst neu,
 * sobald das Modal Breite bekommt oder sich die Schrift ändert.
 */
function useUeberlauf(el: React.RefObject<HTMLElement | null>, aktiv: boolean, text: string): boolean {
  const [ueberlauf, setUeberlauf] = useState(false);
  useLayoutEffect(() => {
    const knoten = el.current;
    if (!knoten || !aktiv) return undefined;
    const messen = () => setUeberlauf(knoten.scrollHeight > knoten.clientHeight + 1);
    messen();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(knoten);
    return () => beobachter.disconnect();
  }, [el, aktiv, text]);
  return ueberlauf;
}

/** „Du antwortest auf": Absender, Zeit und drei Zeilen der Mail; reichen sie nicht, „ganz lesen". */
const Beantwortet: React.FC<{ mail: MailNachricht }> = ({ mail }) => {
  const [ganz, setGanz] = useState(false);
  const id = useId();
  const absatz = useRef<HTMLParagraphElement>(null);
  // Nur der eigene Text, ohne Zitat und Signatur -- das ist, worauf geantwortet wird.
  const { teile } = mailTextZerlegen(mail.text);
  const text = teile.filter((t) => !t.zitat).map((t) => t.text).join('\n\n').trim();
  const wer = mail.von_name?.trim() || mail.von_adresse;
  // Gemessen wird gekürzt; aufgeklappt bleibt der Knopf („kürzer").
  const gekuerzt = useUeberlauf(absatz, !ganz, text);
  return (
    <section className="support-beantwortet" aria-label={APP_VORGANG_TEXT.beantwortet}>
      <span className="support-beantwortet__kopf">{APP_VORGANG_TEXT.beantwortetKopf(wer, standZeit(mail.gesendet_am))}</span>
      <p ref={absatz} id={id} className={`support-beantwortet__text${ganz ? '' : ' support-beantwortet__text--kurz'}`}>{text || VERLAUF_TEXT.ohneText}</p>
      {(ganz || gekuerzt) && (
        <button type="button" className="support-beantwortet__knopf" aria-expanded={ganz} aria-controls={id} onClick={() => setGanz((g) => !g)}>
          {ganz ? VERLAUF_TEXT.kuerzer : VERLAUF_TEXT.ganzLesen}
        </button>
      )}
    </section>
  );
};

/**
 * Das Antwortformular, gezeichnet aus einem Editor (useAntwortEditor). Das
 * Modal „Antworten" hält den Editor selbst, damit auch „Senden" in seiner
 * Kopfzeile denselben Entwurf schickt.
 */
export const AntwortFormularInhalt: React.FC<{ editor: AntwortEditor }> = ({ editor }) => {
  const {
    postfach, empfaenger, empfaengerFehlt, gewaehlt, setGewaehlterEmpfaenger, entwurf, setEntwurf,
    passend, gewaehlterBaustein, setGewaehlterBaustein, einfuegen, platzhalterFehlt, einstellungen, status, serverAus,
    vorschau, problem, sendet, abschicken, isOnline, danachWahlen, danachStatus, setDanachStatus, feste, empfaengerOptionen,
    beantwortet,
  } = editor;
  const [vorschauOffen, setVorschauOffen] = useState(false);
  const [betreffFokus, setBetreffFokus] = useState(false);
  const vorschauId = useId();
  const wahlen = inFassung(DANACH_WAHLEN, 'app').filter((w) => danachWahlen.includes(w.schluessel as VorgangStatus));

  return (
    <div className="support-antwort">
      {serverAus && <HinweisZeile titel={SERVER_AUS_HINWEIS}>Antworten lassen sich hier nicht senden.</HinweisZeile>}
      {!serverAus && status && !status.eingerichtet && (
        <HinweisZeile titel="Postfach noch nicht eingerichtet">
          Für {POSTFACH_INFO[postfach].kurz} fehlen auf dem Server noch die Zugangsdaten; gesendet wird erst, wenn sie dort stehen.
        </HinweisZeile>
      )}

      {beantwortet && <Beantwortet mail={beantwortet} />}

      <IonList style={{ background: 'transparent' }}>
        {feste ? (
          <p className="support-antwort__feste">
            <span>An</span>
            <span>
              <strong>{feste.an}</strong>
              {feste.etikett && <span className="support-antwort__etikett">{` · ${feste.etikett}`}</span>}
              {` · von ${POSTFACH_INFO[postfach].kurz}`}
            </span>
          </p>
        ) : empfaenger !== null ? (
          <IonItem lines="full" style={{ '--background': 'transparent' }}>
            <IonLabel position="stacked">An *</IonLabel>
            <IonSelect
              aria-label="Empfänger"
              aria-required="true"
              interface="popover"
              value={gewaehlt}
              placeholder="Bitte wählen"
              onIonChange={(e) => setGewaehlterEmpfaenger(String(e.detail.value ?? ''))}
            >
              <IonSelectOption value="">Bitte wählen</IonSelectOption>
              {empfaengerOptionen.map((o) => (
                <IonSelectOption key={o.wert} value={o.wert}>{o.label}</IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        ) : null}
        {empfaenger !== null && empfaengerFehlt && (
          <p role="status" className="support-modal__fehler">Die möglichen Empfänger konnten nicht geladen werden.</p>
        )}
        {empfaenger !== null && !empfaengerFehlt && empfaenger.length === 0 && (
          <p role="status" className="support-modal__zeile">Für diese Gemeinde ist keine Adresse bekannt.</p>
        )}

        {/* Der Betreff steht als Zeile; antippen heißt ändern. Der Hinweis erst beim Bearbeiten. */}
        <div onFocus={() => setBetreffFokus(true)} onBlur={() => setBetreffFokus(false)}>
          <Feld label="Betreff" wert={entwurf.betreff} onWert={(w) => setEntwurf((e) => ({ ...e, betreff: w }))}
            hinweis={betreffFokus || !entwurf.betreff.trim() ? 'Leer: Der Server setzt den Betreff. Die Kennung in eckigen Klammern ergänzt er selbst.' : undefined} />
        </div>
        <IonItem lines="full" style={{ '--background': 'transparent' }}>
          <IonLabel position="stacked">Text der Antwort *</IonLabel>
          <IonTextarea
            aria-label="Text der Antwort"
            aria-required="true"
            value={entwurf.text}
            autoGrow={true}
            rows={6}
            onIonInput={(e) => setEntwurf((v) => ({ ...v, text: String(e.detail.value ?? '') }))}
          />
        </IonItem>
      </IonList>

      <div className="support-antwort__reihe">
        <IonSelect
          aria-label="Textbaustein"
          interface="popover"
          value={gewaehlterBaustein}
          disabled={passend.length === 0}
          placeholder={passend.length === 0 ? 'Keine Bausteine' : 'Baustein wählen'}
          onIonChange={(e) => setGewaehlterBaustein(String(e.detail.value ?? ''))}
          style={{ flex: '1 1 160px', minWidth: 0 }}
        >
          <IonSelectOption value="">{passend.length === 0 ? 'Keine Bausteine' : 'Baustein wählen'}</IonSelectOption>
          {passend.map((b) => (
            <IonSelectOption key={b.id} value={String(b.id)}>{b.titel}</IonSelectOption>
          ))}
        </IonSelect>
        <IonButton size="small" fill="outline" disabled={!gewaehlterBaustein} onClick={() => { void einfuegen(); }}>
          <IonIcon icon={ICON_HINZUFUEGEN} slot="start" />
          Baustein einfügen
        </IonButton>
      </div>
      {platzhalterFehlt && (
        <p role="status" className="support-modal__fehler">Platzhalter konnten nicht gefüllt werden; sie stehen noch im Text.</p>
      )}

      <button type="button" className="support-antwort__aufklappen" aria-expanded={vorschauOffen} aria-controls={vorschauId} onClick={() => setVorschauOffen((o) => !o)}>
        <IonIcon icon={vorschauOffen ? ICON_ZUKLAPPEN : ICON_AUFKLAPPEN} aria-hidden="true" />
        Vorschau mit Fußzeile
      </button>
      {vorschauOffen && (
        <div
          id={vorschauId}
          aria-label="Vorschau der Antwort"
          role="region"
          style={{
            whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: 'var(--app-abstand-kompakt)',
            borderRadius: 'var(--app-radius-knopf)', background: 'var(--app-surface-soft)', border: '1px solid var(--app-border-soft)',
            color: vorschau.trim() ? 'var(--app-text-body)' : 'var(--app-text-system)', fontSize: 'var(--app-text-sekundaer)',
          }}
        >
          {vorschau.trim() ? vorschau : 'Noch kein Text.'}
        </div>
      )}
      {vorschauOffen && !einstellungen?.fusszeile?.trim() && (
        <p className="support-modal__zeile">Noch keine Fußzeile — sie lässt sich unter Textbausteine festlegen.</p>
      )}

      {wahlen.length > 0 && danachStatus && (
        <div className="support-antwort__danach">
          <p className="support-antwort__danach-titel">{DANACH_BESCHRIFTUNG}</p>
          <IonSegment aria-label={DANACH_BESCHRIFTUNG} value={danachStatus} onIonChange={(e) => { if (e.detail.value) setDanachStatus(e.detail.value as VorgangStatus); }}>
            {wahlen.map((w) => (
              <IonSegmentButton key={w.schluessel} value={w.schluessel}><IonLabel>{w.kurz ?? w.label}</IonLabel></IonSegmentButton>
            ))}
          </IonSegment>
        </div>
      )}

      {problem && <SendeHinweis problem={problem} postfach={postfach} />}

      <IonButton className="support-antwort__senden" expand="block" onClick={abschicken} disabled={sendet || serverAus || !isOnline}>
        <IonIcon icon={ICON_SENDEN_GEFUELLT} slot="start" />
        Antwort senden
      </IonButton>
      {serverAus && (
        <p role="status" className="support-modal__zeile">
          Senden ist aus: {SERVER_AUS_HINWEIS}.
        </p>
      )}
    </div>
  );
};

/**
 * Antworten: Baustein waehlen und einfuegen (Platzhalter gefuellt), Betreff,
 * Text, Vorschau mit Fusszeile, „Danach", Senden mit Rueckfrage. Die Logik
 * steht in useAntwortEditor.ts und gilt auch fuer die Web-Fassung.
 */
export const AntwortFormular: React.FC<AntwortFormularProps> = (props) => {
  const editor = useAntwortEditor(props);
  return <AntwortFormularInhalt editor={editor} />;
};
