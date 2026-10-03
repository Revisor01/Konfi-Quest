// Mitmachen bei Konfis und Team in der Web-Fassung (/konfi/events und
// /teamer/events, 03.10.2026, docs/planung/web-alle-bereiche.md,
// Entscheidung 6): der Rahmen mit Titel, Reitern oben -- Events und
// Aktivitaeten, ueber die Adresse gewaehlt (`?segment=antraege`, wie die
// Deep-Links der App) -- und den Aktionen rechts (QR-Code scannen, Legende,
// neue Aktivitaet melden).
//
// Die Events selbst setzen die Rollen ein (WebKonfiEvents, WebTeamEvents); die
// eigenen Aktivitaeten sind fuer beide dieselbe Tabelle. Was in der Offline-
// Warteschlange liegt, steht ueber der Tabelle -- wie die Karte der App.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AKTUALISIEREN, ICON_HINZUFUEGEN, ICON_SCANNEN } from '../../icons';
import type { ActivityRequest } from '../../../konfi/modals/RequestDetailModal';
import type { FailedAction, QueueItem } from '../../../../services/writeQueue';
import WebSeite from '../../../web/WebSeite';
import WebKnopf from '../../../web/WebKnopf';
import WebHinweis from '../../../web/WebHinweis';
import { WebFehler, WebLaden } from '../../../web/WebZustaende';
import { WebReiter } from './WebTerminBausteine';
import WebLegendeKnopf from './WebLegendeKnopf';
import WebEigeneAntraege from './WebEigeneAntraege';
import type { EigenerAntragFilter, MitgliedSegment } from './terminFilter';
import '../../../../theme/web/termine.css';

export interface WebMitmachenMitgliedProps {
  rolle: 'konfi' | 'team';
  /** Die Adresse der Seite: '/konfi/events' oder '/teamer/events'. */
  basisPfad: string;
  segment: MitgliedSegment;
  pageRef: React.Ref<HTMLElement>;
  presentingElement?: HTMLElement | null;
  /** Die Liste der Events, wie die Rolle sie zeigt. */
  eventsInhalt: React.ReactNode;
  eventsLaden: boolean;
  /** Das Laden ist gescheitert, und es gibt keinen Stand. */
  eventsFehler?: boolean;
  antraege: readonly ActivityRequest[];
  antraegeLaden: boolean;
  /** Konfis sehen zuerst die offenen Aktivitaeten, das Team alle. */
  standardFilterAntraege: EigenerAntragFilter;
  wartend: readonly QueueItem[];
  gescheitert: readonly FailedAction[];
  onVergessen: (id: string) => void;
  onScannen: () => void;
  onNeueAktivitaet: () => void;
  onAntragOeffnen: (antrag: ActivityRequest) => void;
  onAntragLoeschen: (antrag: ActivityRequest) => void;
  neuLaden: () => Promise<void>;
  antraegeNeuLaden: () => Promise<void>;
}

const WebMitmachenMitglied: React.FC<WebMitmachenMitgliedProps> = (p) => {
  const antraege = p.segment === 'antraege';
  const aktionen = (
    <>
      {!antraege && <WebLegendeKnopf variante={p.rolle === 'konfi' ? 'konfi' : 'teamer'} presentingElement={p.presentingElement} />}
      <WebKnopf onClick={() => { void (antraege ? p.antraegeNeuLaden() : p.neuLaden()); }}>
        <IonIcon icon={ICON_AKTUALISIEREN} aria-hidden="true" />
        Aktualisieren
      </WebKnopf>
      {antraege ? (
        <WebKnopf art="primaer" onClick={p.onNeueAktivitaet} aria-label="Neue Aktivität melden">
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Aktivität melden
        </WebKnopf>
      ) : (
        <WebKnopf art="primaer" onClick={p.onScannen} aria-label="QR-Code scannen">
          <IonIcon icon={ICON_SCANNEN} aria-hidden="true" />
          QR-Code scannen
        </WebKnopf>
      )}
    </>
  );

  let inhalt: React.ReactNode;
  if (antraege) {
    inhalt = p.antraegeLaden ? (
      <WebLaden karten={1} text="Die Aktivitäten werden geladen." />
    ) : (
      <>
        {p.wartend.length > 0 && (
          <WebHinweis art="warnung" titel="Wird gesendet...">
            {p.wartend.map((qi) => (
              <span key={qi.id} className="web-absage-zeile">
                {qi.metadata.label || 'Aktivität'} – {String(qi.body?.description || 'Wird gesendet, sobald du online bist')}
              </span>
            ))}
          </WebHinweis>
        )}
        {p.gescheitert.length > 0 && (
          <WebHinweis art="fehler" titel="Nicht gesendet">
            {p.gescheitert.map((f) => (
              <span key={f.id} className="web-absage-zeile">
                {f.label} – {f.error?.message || 'Konnte nicht gesendet werden'}{' '}
                <WebKnopf art="text" klein aria-label={`${f.label} wegwischen`} onClick={() => p.onVergessen(f.id)}>Verwerfen</WebKnopf>
              </span>
            ))}
          </WebHinweis>
        )}
        <WebEigeneAntraege
          antraege={p.antraege}
          pfad={p.basisPfad}
          standardFilter={p.standardFilterAntraege}
          teamerMode={p.rolle === 'team'}
          onOeffnen={p.onAntragOeffnen}
          onLoeschen={p.onAntragLoeschen}
        />
      </>
    );
  } else if (p.eventsLaden) {
    inhalt = <WebLaden karten={1} text="Die Events werden geladen." />;
  } else if (p.eventsFehler) {
    inhalt = <WebFehler text="Die Events konnten nicht geladen werden." onErneut={() => { void p.neuLaden(); }} />;
  } else {
    inhalt = p.eventsInhalt;
  }

  return (
    <WebSeite
      bereich="Mitmachen"
      titel={antraege ? 'Aktivitäten' : 'Events'}
      untertitel={antraege ? 'Was du gemeldet hast' : 'Gottesdienste, Konfi-Tage und Fahrten'}
      aktionen={aktionen}
      pageRef={p.pageRef}
    >
      <WebReiter
        beschriftung="Bereiche von Mitmachen"
        eintraege={[
          { schluessel: 'events', label: 'Events', href: p.basisPfad, aktiv: !antraege },
          { schluessel: 'antraege', label: 'Aktivitäten', href: `${p.basisPfad}?segment=antraege`, aktiv: antraege },
        ]}
      />
      {inhalt}
    </WebSeite>
  );
};

export default WebMitmachenMitglied;
