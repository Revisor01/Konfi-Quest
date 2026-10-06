// Textbausteine in der Web-Fassung der Support-Ansicht,
// /admin/support/bausteine (docs/planung/support-web.md, Phase 2;
// docs/planung/support-mail.md, Entscheidung 6).
//
// Zweiteilig: links die Liste der Bausteine (Name, Postfach, Anfang des Textes),
// rechts der Editor -- Name, Postfach, Betreff, Text, die sechs Platzhalter als
// Knoepfe zum Einfuegen und die Vorschau mit Beispielwerten und Fusszeile.
// Darunter Absendername und Fusszeile mit Vorschau. Namen gehoeren nicht ins
// oeffentliche Repo -- deshalb stehen die Beispielwerte erfunden in
// utils/supportMail.ts und alles Echte nur hier in der Ansicht.
//
// Die Logik (laden, speichern, loeschen mit Rueckfrage, Platzhalter einfuegen,
// Einstellungen) ist dieselbe wie in der App: components/support/useTextbausteine.ts.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_HINZUFUEGEN, ICON_LOESCHEN, ICON_TEXTDOKUMENT } from '../../shared/icons';
import type { Postfach } from '../../../types/support';
import {
  PLATZHALTER,
  PLATZHALTER_BEISPIEL,
  POSTFACH_AUSWAHL,
  VORSCHAU_BEISPIEL,
  auszug,
  bausteinPostfachText,
  platzhalterFuellen,
  platzhalterMarke,
  vorschauText,
} from '../../../utils/supportMail';
import { useTextbausteine } from '../useTextbausteine';
import WebSeite from '../../web/WebSeite';
import WebSpalten from '../../web/WebSpalten';
import WebKarte from '../../web/WebKarte';
import WebKnopf from '../../web/WebKnopf';
import WebPill from '../../web/WebPill';
import WebHinweis from '../../web/WebHinweis';
import WebFeld from '../../web/WebFeld';
import WebTextfeld from '../../web/WebTextfeld';
import WebAuswahl from '../../web/WebAuswahl';
import { WebFehler, WebLaden, WebLeer } from '../../web/WebZustaende';

const WebTextbausteine: React.FC = () => {
  const {
    isOnline, bausteine, laedt, fehler, formular, bearbeitet, speichert, einstellungen, einstellungenFehlen, absendername,
    setAbsendername, fusszeile, setFusszeile, speichertEinstellungen, laden, aendern, formularLeeren, bearbeiten, speichern,
    loeschen, platzhalterEinfuegen, einstellungenSpeichern, einstellungenGeaendert,
  } = useTextbausteine();

  if (laedt && !bausteine) {
    return (
      <WebSeite bereich="Support" titel="Textbausteine">
        <WebLaden karten={2} text="Die Textbausteine werden geladen." />
      </WebSeite>
    );
  }
  if (fehler || !bausteine) {
    return (
      <WebSeite bereich="Support" titel="Textbausteine">
        <WebFehler text="Die Textbausteine konnten nicht geladen werden." onErneut={() => { void laden(); }} />
      </WebSeite>
    );
  }

  // Die Vorschau des Bausteins: Platzhalter mit erfundenen Beispielwerten, danach die Fusszeile wie beim Senden.
  const beispiel = { ...PLATZHALTER_BEISPIEL, absender: absendername.trim() || null };
  const betreffVorschau = platzhalterFuellen(formular.betreff, beispiel);
  const textVorschau = vorschauText(platzhalterFuellen(formular.text, beispiel), fusszeile);

  const liste = (
    <WebKarte
      titel={`${bausteine.length} ${bausteine.length === 1 ? 'Baustein' : 'Bausteine'}`}
      aktion={<WebKnopf klein onClick={formularLeeren}>
        <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
        Neuer Baustein
      </WebKnopf>}
      bund
    >
      {bausteine.length === 0 ? (
        <WebLeer icon={ICON_TEXTDOKUMENT} titel="Noch keine Bausteine" text="Lege rechts den ersten Textbaustein an." />
      ) : (
        <ul className="web-liste" aria-label="Textbausteine">
          {bausteine.map((b) => {
            const gewaehlt = bearbeitet?.id === b.id;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  className={gewaehlt ? 'web-liste__eintrag web-liste__eintrag--gewaehlt' : 'web-liste__eintrag'}
                  aria-pressed={gewaehlt}
                  aria-label={`${b.titel} bearbeiten`}
                  onClick={() => bearbeiten(b)}
                >
                  <span className="web-liste__kopf">
                    <span className="web-liste__titel">{b.titel}</span>
                    <WebPill postfach>{bausteinPostfachText(b.postfach)}</WebPill>
                  </span>
                  {b.betreff && <span className="web-liste__zeile">Betreff: {b.betreff}</span>}
                  <span className="web-liste__zeile">{auszug(b.text, 110)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </WebKarte>
  );

  const editor = (
    <WebKarte
      titel={bearbeitet ? 'Baustein bearbeiten' : 'Neuer Baustein'}
      untertitel={bearbeitet ? bearbeitet.titel : 'Wird beim Antworten über die Auswahl „Textbaustein“ eingefügt.'}
    >
      <div className="web-formular">
        <WebFeld label="Titel" pflicht wert={formular.titel} onWert={(w) => aendern({ titel: w })}
          hinweis="Name in der Auswahl beim Antworten, z. B. „Eingang bestätigt“." />
        <WebAuswahl
          label="Postfach"
          wert={formular.postfach}
          onWert={(w) => aendern({ postfach: w as Postfach | 'beide' })}
          optionen={POSTFACH_AUSWAHL.map((p) => ({ wert: p.wert, label: p.label }))}
        />
        <WebFeld label="Betreff" wert={formular.betreff} onWert={(w) => aendern({ betreff: w })}
          hinweis="Optional. Ersetzt beim Einfügen nur einen leeren oder vorgeschlagenen Betreff." />
        <WebTextfeld label="Text des Bausteins" pflicht zeilen={9} wert={formular.text} onWert={(w) => aendern({ text: w })} />

        <div className="web-feld">
          <span className="web-feld__label">Platzhalter einfügen</span>
          <ul className="web-platzhalter" aria-label="Platzhalter">
            {PLATZHALTER.map((p) => (
              <li key={p.schluessel}>
                <button
                  type="button"
                  className="web-chip web-platzhalter__knopf"
                  title={p.beschreibung}
                  aria-label={`${platzhalterMarke(p.schluessel)} in den Text einfügen: ${p.beschreibung}`}
                  onClick={() => platzhalterEinfuegen(p.schluessel)}
                >
                  {platzhalterMarke(p.schluessel)}
                </button>
              </li>
            ))}
          </ul>
          <p className="web-feld__hinweis">
            Beim Einfügen in eine Antwort setzt die Support-Ansicht die Werte der Anfrage bzw. Gemeinde ein. Was sie nicht kennt
            oder was leer ist, bleibt sichtbar stehen — so fällt es vor dem Senden auf.
          </p>
        </div>

        <div className="web-feld">
          <span className="web-feld__label">Vorschau mit Beispielwerten</span>
          <div
            className={formular.text.trim() ? 'web-vorschau' : 'web-vorschau web-vorschau--leer'}
            role="region"
            aria-label="Vorschau des Bausteins"
          >
            {betreffVorschau.trim() && <strong className="web-vorschau__betreff">Betreff: {betreffVorschau}</strong>}
            {formular.text.trim() ? textVorschau : 'Noch kein Text.'}
          </div>
        </div>

        <div className="web-formular__aktionen">
          <WebKnopf art="primaer" onClick={() => { void speichern(); }} disabled={speichert || !isOnline}>
            {bearbeitet ? 'Speichern' : 'Baustein anlegen'}
          </WebKnopf>
          {bearbeitet && <WebKnopf onClick={formularLeeren}>Abbrechen</WebKnopf>}
          {bearbeitet && (
            <WebKnopf art="gefahr" onClick={() => loeschen(bearbeitet)} aria-label={`${bearbeitet.titel} löschen`}>
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
              Löschen
            </WebKnopf>
          )}
        </div>
      </div>
    </WebKarte>
  );

  const absender = (
    <WebKarte
      titel="Absender und Fußzeile"
      untertitel="Der Name steht vor der Adresse und füllt {{absender}}; die Fußzeile hängt an jede Antwort."
    >
      {einstellungenFehlen && (
        <WebHinweis art="fehler" rolle="status">Absender und Fußzeile konnten nicht geladen werden.</WebHinweis>
      )}
      <div className="web-zweispaltig">
        <div className="web-formular">
          <WebFeld label="Absendername" wert={absendername} onWert={setAbsendername} autocomplete="name" deaktiviert={einstellungen === null}
            hinweis="Steht als Name vor der Adresse und füllt {{absender}}." />
          <WebTextfeld label="Fußzeile" zeilen={5} wert={fusszeile} onWert={setFusszeile} deaktiviert={einstellungen === null} />
          <div className="web-formular__aktionen">
            <WebKnopf art="primaer" onClick={() => { void einstellungenSpeichern(); }}
              disabled={!einstellungenGeaendert || speichertEinstellungen || !isOnline}>
              Absender und Fußzeile speichern
            </WebKnopf>
          </div>
        </div>
        <div className="web-feld">
          <span className="web-feld__label">Vorschau</span>
          <div className="web-vorschau" role="region" aria-label="Vorschau mit Fußzeile">
            {vorschauText(VORSCHAU_BEISPIEL, fusszeile)}
          </div>
        </div>
      </div>
    </WebKarte>
  );

  return (
    <WebSeite
      bereich="Support"
      titel="Textbausteine"
      untertitel="Versatzstücke für Antworten, Absendername und Fußzeile der Support-Mails"
    >
      <WebSpalten
        seiteLinks
        seiteBeschriftung="Liste der Textbausteine"
        seite={liste}
        haupt={editor}
      />
      {absender}
    </WebSeite>
  );
};

export default WebTextbausteine;
