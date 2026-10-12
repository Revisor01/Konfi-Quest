// „Lizenz ändern" im Vorgang „Lizenz und Abrechnung", Web-Fassung: ein
// Dialog mit 520 px (docs/planung/support-detailseiten.md, Abschnitt
// „Lizenz-Vorgang"; Simon, 11.10.2026: „Antrag meint bitte um Lizenz").
//
//   [Wunschlizenz übernehmen: Standard]   -- nur, wenn ein Wunsch bekannt ist
//   Tarif            (wie im Gemeinde-Formular, mit Preis; Eigenes Limit…)
//   Laufzeit         (Unverändert, 1 Jahr ab heute, 1 Jahr ab Laufzeitende,
//                     30 Tage Testphase, Unbegrenzt, Eigenes Datum…)
//   Testphase        (Hinweis auf den Startseiten)
//   Danach: …        (Vorschau; Warnung, wenn schon mehr Konfis angelegt sind)
//   Alle Angaben der Gemeinde bearbeiten →
//
// Abbrechen | [[Speichern]]. Speichern ist gesperrt ohne Änderung, bei einem
// ungültigen Limit oder fehlenden Enddatum (der Grund steht dann statt der
// Vorschau da), ohne Netz und während des Speicherns; eine Rückfrage gibt es
// nicht -- die Vorschau zeigt, was geschieht. Gespeichert wird nur über
// bestehende Routen (components/support/useLizenzAendern.ts), die Regeln
// stehen in utils/lizenzAendern.ts -- dieselben wie in der App.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_FUNKELN } from '../../shared/icons';
import type { VorgangGemeinde } from '../../../utils/supportVorgaenge';
import { tarifAngabe, type LaufzeitWahl } from '../../../utils/lizenzAendern';
import { EIGENES_LIMIT, TARIF_OPTIONEN } from '../../../utils/lizenzen';
import { laufzeitAngabe } from '../../../utils/supportWeb';
import { ANGABEN_TEXT, LIZENZ_TEXT } from '../../../seiten/supportDetail';
import { useLizenzAendern } from '../useLizenzAendern';
import WebDialog from '../../web/WebDialog';
import WebAuswahl from '../../web/WebAuswahl';
import WebDatum from '../../web/WebDatum';
import WebFeld from '../../web/WebFeld';
import WebHinweis from '../../web/WebHinweis';
import WebKnopf from '../../web/WebKnopf';
import WebSchalter from '../../web/WebSchalter';

/** „Kirchengemeinde Musterdorf · heute: Testphase bis 02.11.2026 · 3 von 5 Konfis" */
const heuteText = (g: VorgangGemeinde): string => {
  const anzahl = g.konfi_count ?? 0;
  const konfis = g.max_konfis === null ? `${anzahl} Konfis` : `${ANGABEN_TEXT.konfisVon(anzahl, g.max_konfis)} Konfis`;
  // „Testphase bis 02.11." nennt den Tarif schon; „Unbegrenzt" als Laufzeit braucht nur den Tarif.
  const tarif = tarifAngabe(g.max_konfis).name;
  const laufzeit = laufzeitAngabe(g).text;
  const heute = laufzeit.startsWith(tarif) ? laufzeit : laufzeit === LIZENZ_TEXT.laufzeit.unbegrenzt ? tarif : `${tarif}, ${laufzeit}`;
  return `${g.display_name} · heute: ${heute} · ${konfis}`;
};

const WebLizenzAendern: React.FC<{ gemeinde: VorgangGemeinde; onSchliessen: () => void }> = ({ gemeinde, onSchliessen }) => {
  const l = useLizenzAendern(gemeinde);
  const f = l.formular;
  if (!f) return null;

  const speichern = async () => {
    if (await l.speichern()) onSchliessen();
  };

  return (
    <WebDialog
      titel={LIZENZ_TEXT.aendern}
      beschreibung={heuteText(gemeinde)}
      onSchliessen={onSchliessen}
      onAbsenden={() => { void speichern(); }}
      gesperrt={l.speichert}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={!l.geaendert || !!l.fehler || l.speichert || !l.isOnline}>Speichern</WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {l.wunschUebernehmen && l.wunschName && (
          <div>
            <WebKnopf klein onClick={l.wunschUebernehmen}>
              <IonIcon icon={ICON_FUNKELN} aria-hidden="true" />
              {LIZENZ_TEXT.wunschUebernehmen(l.wunschName)}
            </WebKnopf>
          </div>
        )}
        <WebAuswahl
          label={LIZENZ_TEXT.felder.tarif}
          wert={f.eigenesLimit ? EIGENES_LIMIT : f.tarif}
          onWert={(w) => (w === EIGENES_LIMIT ? l.aendern({ eigenesLimit: true }) : l.aendern({ eigenesLimit: false, tarif: w }))}
          optionen={[
            ...TARIF_OPTIONEN.map((t) => ({ wert: t.wert, label: t.text })),
            { wert: EIGENES_LIMIT, label: LIZENZ_TEXT.felder.eigenesLimit },
          ]}
        />
        {f.eigenesLimit && (
          <WebFeld label={LIZENZ_TEXT.felder.limitZahl} typ="number" min={1} wert={f.tarif} onWert={(w) => l.aendern({ tarif: w })} />
        )}
        <WebAuswahl
          label={LIZENZ_TEXT.felder.laufzeit}
          wert={f.laufzeit}
          deaktiviert={l.laufzeitGesperrt}
          onWert={(w) => l.aendern({ laufzeit: w as LaufzeitWahl })}
          optionen={l.laufzeitWahlen.map((w) => ({ wert: w.wert, label: w.label }))}
          hinweis={l.laufzeitGesperrt ? LIZENZ_TEXT.stammFehlt : undefined}
        />
        {f.laufzeit === 'datum' && (
          <WebDatum label={LIZENZ_TEXT.felder.datum} art="datum" pflicht wert={f.datum} onWert={(w) => l.aendern({ datum: w })} deaktiviert={l.laufzeitGesperrt} />
        )}
        <WebSchalter
          label={LIZENZ_TEXT.testphaseSchalter}
          an={f.testphase}
          deaktiviert={l.laufzeitGesperrt}
          onAn={(an) => l.aendern({ testphase: an })}
        />
        {/* Ein ungültiges Limit oder ein fehlendes Datum steht an der Stelle der Vorschau -- sie rechnete sonst
            mit dem alten Limit („abc") oder mit „0 Konfis" (bis 11.10.2026 sagte erst der Klick auf Speichern etwas). */}
        {l.fehler ? (
          <WebHinweis art="fehler" rolle="status">{l.fehler}</WebHinweis>
        ) : l.vorschau && (
          <div className="web-lizenz__vorschau" role="status">
            <p className="web-lizenz__danach">{l.vorschau.text}</p>
            {l.vorschau.warnung && <WebHinweis art="warnung" rolle="status">{l.vorschau.warnung}</WebHinweis>}
            {l.vorschau.gesperrt && <WebHinweis art="warnung" rolle="status">{l.vorschau.gesperrt}</WebHinweis>}
          </div>
        )}
        {l.formularLink && (
          <p className="web-lizenz__link">
            <WebKnopf art="text" klein href={l.formularLink}>{LIZENZ_TEXT.formularLink}</WebKnopf>
          </p>
        )}
      </div>
    </WebDialog>
  );
};

export default WebLizenzAendern;
