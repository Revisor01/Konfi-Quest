// Gemeinsame Teile der Support-Mail (03.10.2026, docs/planung/support-mail.md):
// der Hinweis-Kasten und das Antwortformular mit Textbausteinen, Platzhaltern,
// Vorschau samt Fusszeile und Rueckfrage vor dem Senden. Die Mails selbst
// zeigt MailGespraeche (11.10.2026) -- in App und Web derselbe Baustein. Die
// Regeln dahinter stehen rein in utils/supportMail.ts.

import React from 'react';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/react';
import { ICON_HINZUFUEGEN, ICON_INFO, ICON_SENDEN_GEFUELLT, ICON_WARNHINWEIS } from '../shared/icons';
import type { Postfach } from '../../types/support';
import {
  POSTFACH_INFO,
  SERVER_AUS_HINWEIS,
  empfaengerText,
  sendeHinweisText,
  type SendeProblem,
} from '../../utils/supportMail';
import { Feld } from './SupportBausteine';
import { useAntwortEditor, type AntwortFormularProps } from './useAntwortEditor';

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

/**
 * Antworten: Baustein waehlen und einfuegen (Platzhalter gefuellt), Betreff,
 * Text, Vorschau mit Fusszeile, Senden mit Rueckfrage. Die Logik steht in
 * useAntwortEditor.ts und gilt auch fuer die Web-Fassung.
 */
export const AntwortFormular: React.FC<AntwortFormularProps> = (props) => {
  const {
    postfach, an, empfaenger, empfaengerFehlt, gewaehlt, setGewaehlterEmpfaenger, entwurf, setEntwurf,
    passend, gewaehlterBaustein, setGewaehlterBaustein, einfuegen, platzhalterFehlt, einstellungen, status, serverAus,
    vorschau, problem, sendet, abschicken, isOnline,
  } = useAntwortEditor(props);

  return (
    <div>
      {serverAus && (
        <Hinweis art="warnung" titel={SERVER_AUS_HINWEIS}>
          Antworten lassen sich hier nicht senden.
        </Hinweis>
      )}
      {!serverAus && status && !status.eingerichtet && (
        <Hinweis art="warnung" titel="Postfach noch nicht eingerichtet">
          Für {POSTFACH_INFO[postfach].kurz} fehlen auf dem Server noch die Zugangsdaten; eine Antwort wird erst
          gesendet, wenn sie dort stehen.
        </Hinweis>
      )}
      <IonList style={{ background: 'transparent' }}>
        {empfaenger !== null ? (
          <IonItem lines="full" style={{ '--background': 'transparent' }}>
            <IonLabel position="stacked">Empfänger *</IonLabel>
            <IonSelect
              aria-label="Empfänger"
              aria-required="true"
              interface="popover"
              value={gewaehlt}
              placeholder="Bitte wählen"
              onIonChange={(e) => setGewaehlterEmpfaenger(String(e.detail.value ?? ''))}
            >
              <IonSelectOption value="">Bitte wählen</IonSelectOption>
              {empfaenger.map((e) => (
                <IonSelectOption key={e.adresse} value={e.adresse}>{empfaengerText(e)}</IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        ) : an ? (
          <p style={{ margin: 'var(--app-abstand-eng) 0', color: 'var(--app-text-body)', overflowWrap: 'anywhere' }}>
            An: <strong>{an}</strong> · von {POSTFACH_INFO[postfach].kurz}
          </p>
        ) : null}
        {empfaenger !== null && empfaengerFehlt && (
          <p role="status" style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-fehler)' }}>
            Die möglichen Empfänger konnten nicht geladen werden.
          </p>
        )}
        {empfaenger !== null && !empfaengerFehlt && empfaenger.length === 0 && (
          <p role="status" style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
            Für diese Gemeinde ist keine Adresse bekannt.
          </p>
        )}

        <IonItem lines="full" style={{ '--background': 'transparent' }}>
          <IonLabel position="stacked">Textbaustein</IonLabel>
          <IonSelect
            aria-label="Textbaustein"
            interface="popover"
            value={gewaehlterBaustein}
            disabled={passend.length === 0}
            placeholder={passend.length === 0 ? 'Keine Bausteine' : 'Baustein wählen'}
            onIonChange={(e) => setGewaehlterBaustein(String(e.detail.value ?? ''))}
          >
            <IonSelectOption value="">{passend.length === 0 ? 'Keine Bausteine' : 'Baustein wählen'}</IonSelectOption>
            {passend.map((b) => (
              <IonSelectOption key={b.id} value={String(b.id)}>{b.titel}</IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--app-abstand-eng)' }}>
          <IonButton size="small" fill="outline" disabled={!gewaehlterBaustein} onClick={() => { void einfuegen(); }}>
            <IonIcon icon={ICON_HINZUFUEGEN} slot="start" />
            Baustein einfügen
          </IonButton>
          {platzhalterFehlt && (
            <span role="status" style={{ fontSize: 'var(--app-text-meta)', color: 'var(--app-text-fehler)' }}>
              Platzhalter konnten nicht gefüllt werden; sie stehen noch im Text.
            </span>
          )}
        </div>

        <Feld label="Betreff" wert={entwurf.betreff} onWert={(w) => setEntwurf((e) => ({ ...e, betreff: w }))}
          hinweis="Leer: Der Server setzt den Betreff. Die Kennung in eckigen Klammern ergänzt er selbst." />
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

      <h3 style={{ margin: 'var(--app-abstand-mittel) 0 var(--app-abstand-eng)', fontSize: 'var(--app-text-standard)', fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-emphasis)' }}>
        Vorschau
      </h3>
      <div
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
      {!einstellungen?.fusszeile?.trim() && (
        <p style={{ margin: 'var(--app-abstand-eng) 0 0', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
          Noch keine Fußzeile — sie lässt sich unter Textbausteine festlegen.
        </p>
      )}

      {problem && <SendeHinweis problem={problem} postfach={postfach} />}

      <IonButton
        expand="block"
        style={{ marginTop: 'var(--app-abstand-mittel)' }}
        onClick={abschicken}
        disabled={sendet || serverAus || !isOnline}
      >
        <IonIcon icon={ICON_SENDEN_GEFUELLT} slot="start" />
        Antwort senden
      </IonButton>
      {serverAus && (
        <p role="status" style={{ margin: 'var(--app-abstand-eng) 0 0', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
          Senden ist aus: {SERVER_AUS_HINWEIS}.
        </p>
      )}
    </div>
  );
};
