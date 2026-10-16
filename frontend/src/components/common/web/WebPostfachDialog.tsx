// Das Postfach hinter der Glocke als Dialog der Web-Fassung (Simon,
// 15.10.2026: im Browser bekommt jedes Fenster, das noch ein App-Modal
// oeffnet, ein kompaktes Web-Fenster). Geoeffnet von der Glocke in der
// Kopfzeile, auf jeder Seite und fuer alle Rollen -- nur im breiten Layout ab
// 992 px; in den Apps und im schmalen Fenster bleibt das Modal der App
// (common/PostfachModal.tsx).
//
// Dieselbe Logik wie in der App (usePostfach): dieselben Mitteilungen aus
// GET /notifications/postfach in derselben Reihenfolge, dieselbe
// Warteschlange, ein Klick markiert als gelesen und fuehrt an dasselbe Ziel
// (wie ein angetippter Push, bei Bedarf erst in die Gemeinde der Mitteilung),
// „Alle gelesen", „Ältere Mitteilungen laden" und das Wegwischen gescheiterter
// Vorgaenge. Die Zahl an der Glocke folgt wie in der App.
//
// Steht die Liste nicht zur Verfuegung (offline, Server nicht erreichbar),
// sagt das ein Hinweis im Fenster. Solange nach einem Klick noch in die
// Gemeinde der Mitteilung gewechselt wird, bleibt das Fenster stehen -- und
// sagt per Status (role=status), warum: Der Wechsel wartet auf die
// Warteschlange und den Server und kann einige Sekunden dauern.
//
// Die Warteschlange baut der Dialog selbst; Ueberschriften und Ersatztexte
// sind dieselben wie in der Karte, die das Modal der App zeigt
// (shared/WartendeVorgaengeKarte) -- postfachWebDialog.test.tsx prueft beide.

import React from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_GLOCKE,
  ICON_ORGANISATION_GEFUELLT,
  ICON_SCHLIESSEN,
  ICON_TERMIN_GEFUELLT,
  ICON_UHRZEIT,
  ICON_WARNHINWEIS,
} from '../../shared/icons';
import { mitteilungsTitel, postfachBereich, zeitpunktText, type PostfachEintrag } from '../../../utils/postfach';
import {
  POSTFACH_LEER,
  POSTFACH_OFFLINE_WAS,
  POSTFACH_UNGELESEN_TEXT,
  eintragSymbol,
  usePostfach,
} from '../usePostfach';
import WebDialog from '../../web/WebDialog';
import WebHinweis from '../../web/WebHinweis';
import WebKnopf from '../../web/WebKnopf';
import { WebLeer } from '../../web/WebZustaende';
import '../../../theme/web/postfach.css';

export interface WebPostfachDialogProps {
  onSchliessen: () => void;
}

const WebPostfachDialog: React.FC<WebPostfachDialogProps> = ({ onSchliessen }) => {
  const {
    eintraege, ungelesen, weitere, laedt, ladefehler, oeffnet, gemeindeWechsel, mehrereGemeinden, listeLeer,
    wartend, gescheitert, hatWarteschlange, vergessen, alleVergessen,
    antippen, alleGelesen, aeltereLaden,
  } = usePostfach({ offen: true, schliessen: onSchliessen });

  const mitteilung = (eintrag: PostfachEintrag) => {
    const neu = !eintrag.read_at;
    const bereich = postfachBereich(eintrag.type);
    const symbol = eintragSymbol(eintrag, bereich);
    const gemeinde = mehrereGemeinden && eintrag.organization_name ? eintrag.organization_name : null;
    return (
      <li key={eintrag.id}>
        <button
          type="button"
          className={`web-mitteilung${neu ? ' web-mitteilung--ungelesen' : ''}`}
          disabled={oeffnet}
          onClick={() => { void antippen(eintrag); }}
        >
          <span className={`web-mitteilung__kreis web-mitteilung__kreis--${bereich}`} aria-hidden="true">
            {symbol.emoji !== undefined ? <span className="web-mitteilung__emoji">{symbol.emoji}</span> : <IonIcon icon={symbol.icon} />}
          </span>
          <span className="web-mitteilung__text">
            <span className="web-mitteilung__titel">{mitteilungsTitel(eintrag)}</span>
            <span className="web-mitteilung__nachricht">{eintrag.message}</span>
            <span className="web-mitteilung__angaben">
              <span className="web-mitteilung__angabe">
                <IonIcon icon={ICON_TERMIN_GEFUELLT} aria-hidden="true" />
                <time dateTime={eintrag.created_at}>{zeitpunktText(eintrag.created_at)}</time>
              </span>
              {gemeinde && (
                <span className="web-mitteilung__angabe">
                  <IonIcon icon={ICON_ORGANISATION_GEFUELLT} aria-hidden="true" />
                  {gemeinde}
                </span>
              )}
            </span>
          </span>
          {/* Derselbe blaue Punkt wie an der Glocke und in der App, mit Klartext. */}
          <span className="web-mitteilung__punkt">
            {neu && <span className="app-ungelesen-punkt" role="img" aria-label={POSTFACH_UNGELESEN_TEXT} title={POSTFACH_UNGELESEN_TEXT} />}
          </span>
        </button>
      </li>
    );
  };

  const mitteilungen = () => {
    if (listeLeer && laedt) return <p className="web-gedaempft" role="status">Mitteilungen werden geladen …</p>;
    if (listeLeer && ladefehler) {
      return <WebHinweis art="warnung" rolle="alert">{`${POSTFACH_OFFLINE_WAS} ist offline nicht verfügbar.`}</WebHinweis>;
    }
    if (listeLeer) return <WebLeer icon={ICON_GLOCKE} titel={POSTFACH_LEER.titel} text={POSTFACH_LEER.text} />;
    return <ul className="web-mitteilungen" aria-label="Mitteilungen">{eintraege.map(mitteilung)}</ul>;
  };

  return (
    <WebDialog
      titel="Postfach"
      breit
      gesperrt={oeffnet}
      onSchliessen={onSchliessen}
      aktionen={<WebKnopf art="primaer" onClick={onSchliessen} disabled={oeffnet}>Schließen</WebKnopf>}
    >
      {/* Warum das Fenster gerade nicht zu geht und nichts anzuklicken ist. */}
      {oeffnet && (
        <WebHinweis art="hinweis" rolle="status" titel="Mitteilung wird geöffnet …">
          {gemeindeWechsel
            ? (gemeindeWechsel.name
              ? `Wechsel in die Gemeinde „${gemeindeWechsel.name}“`
              : 'Wechsel in die Gemeinde der Mitteilung')
            : undefined}
        </WebHinweis>
      )}

      {hatWarteschlange && (
        <section className="web-postfachteil" aria-label="Warteschlange">
          {wartend.length > 0 && (
            <>
              <h3 className="web-postfachteil__titel">Wird gesendet...</h3>
              <ul className="web-mitteilungen" aria-label="Wird gesendet">
                {wartend.map((qi) => (
                  <li key={qi.id} className="web-mitteilung web-mitteilung--still">
                    <span className="web-mitteilung__kreis web-mitteilung__kreis--warnung" aria-hidden="true">
                      <IonIcon icon={ICON_UHRZEIT} />
                    </span>
                    <span className="web-mitteilung__text">
                      <span className="web-mitteilung__titel">{qi.metadata.label || 'Aktivität'}</span>
                      <span className="web-mitteilung__nachricht">{qi.body?.description || 'Wird gesendet sobald du online bist'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {gescheitert.length > 0 && (
            <>
              <h3 className="web-postfachteil__titel">Nicht gesendet</h3>
              <ul className="web-mitteilungen" aria-label="Nicht gesendet">
                {gescheitert.map((f) => (
                  <li key={f.id} className="web-mitteilung web-mitteilung--still">
                    <span className="web-mitteilung__kreis web-mitteilung__kreis--fehler" aria-hidden="true">
                      <IonIcon icon={ICON_WARNHINWEIS} />
                    </span>
                    <span className="web-mitteilung__text">
                      <span className="web-mitteilung__titel">{f.label}</span>
                      <span className="web-mitteilung__nachricht">{f.error?.message || 'Konnte nicht gesendet werden'}</span>
                    </span>
                    <WebKnopf art="text" klein symbol aria-label={`${f.label} wegwischen`} title="Wegwischen" onClick={() => { void vergessen(f.id); }}>
                      <IonIcon icon={ICON_SCHLIESSEN} aria-hidden="true" />
                    </WebKnopf>
                  </li>
                ))}
              </ul>
              {gescheitert.length > 1 && (
                <div className="web-postfachteil__fuss">
                  <WebKnopf art="text" onClick={() => { void alleVergessen(); }}>Alle Fehlschläge wegwischen</WebKnopf>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <section className="web-postfachteil" aria-label="Mitteilungen">
        <div className="web-postfachteil__kopf">
          <h3 className="web-postfachteil__titel">Mitteilungen</h3>
          {ungelesen > 0 && (
            <WebKnopf art="text" klein onClick={() => { void alleGelesen(); }} disabled={oeffnet}>Alle gelesen</WebKnopf>
          )}
        </div>
        {mitteilungen()}
        {weitere && !ladefehler && (
          <div className="web-postfachteil__fuss">
            <WebKnopf onClick={aeltereLaden} disabled={laedt || oeffnet}>Ältere Mitteilungen laden</WebKnopf>
          </div>
        )}
      </section>
    </WebDialog>
  );
};

export default WebPostfachDialog;
