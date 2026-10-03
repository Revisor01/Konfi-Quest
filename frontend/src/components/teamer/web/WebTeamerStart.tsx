// Die Startseite des Teams in der Web-Fassung (Browser ab 992 px): oben eine
// Reihe Kennzahlen (anstehende Events, laufende Challenges, Badges,
// Zertifikate), darunter die Karten, die die Leitung in den
// Startseiten-Einstellungen einschaltet -- in deren Reihenfolge.
//
// Die Seite lädt nichts selbst: Daten und Handgriffe (Konfispruch,
// Bibelübersetzung) reicht die App-Fassung durch
// (teamer/pages/TeamerDashboardPage.tsx). Die Karten sind dieselben wie bei
// den Konfis (konfi/web/WebStartKarten.tsx) -- das Team unterscheidet sich in
// den Daten und Wegen (Events öffnen in der Terminliste), nicht in der Gestalt.

import React, { useState } from 'react';
import { getIconFromString } from '../../../utils/badgeIcons';
import { naehe, type StartEvent } from '../../../utils/webStart';
import { getBadgeColor, type BadgePopoverBadge } from '../../shared/BadgePopoverContent';
import WebKachel from '../../web/WebKachel';
import WebBadgeDialog from '../../konfi/web/WebBadgeDialog';
import {
  SYMBOL_LOSUNG,
  SYMBOL_SPRUCH,
  WebBadgesKarte,
  WebChallengesKarte,
  WebEventsKarte,
  WebZertifikateKarte,
  WebZitatKarte,
  type StartBadge,
  type StartChallenge,
  type StartZertifikat,
} from '../../konfi/web/WebStartKarten';
import '../../../theme/web/start.css';

/** Ein Badge des Teams: so, wie es die Karte und der Dialog brauchen. */
export interface TeamerStartBadge extends BadgePopoverBadge {
  id: number;
  earned?: boolean;
}

export interface WebTeamerStartProps {
  zertifikate: StartZertifikat[];
  challenges: StartChallenge[];
  konfispruch: { text?: string | null; reference?: string | null } | null;
  events: StartEvent[];
  losung: { text: string; quelle: string; uebersetzung: string } | null;
  /** Alle Badges (erreichte und offene), wie die Abzeichen-Seite sie kennt. */
  alleBadges: TeamerStartBadge[];
  neueIds: ReadonlySet<number>;
  badgeZahlen: { erreicht: number; gesamt: number; geheimErreicht: number; geheimGesamt: number };
  config: {
    show_zertifikate: boolean;
    show_challenges: boolean;
    show_konfispruch: boolean;
    show_events: boolean;
    show_badges: boolean;
    show_losung: boolean;
  };
  sectionOrder: readonly string[];
  onUebersetzung: () => void;
  onKonfispruch: () => void;
  symbolFuer: (name: string) => string;
}

const WebTeamerStart: React.FC<WebTeamerStartProps> = (props) => {
  const { zertifikate, challenges, events, config, sectionOrder, alleBadges, neueIds } = props;
  const [offenesBadge, setOffenesBadge] = useState<number | null>(null);

  const erreichte = alleBadges
    .filter((b) => b.earned)
    .sort((a, b) => new Date(b.earned_at || 0).getTime() - new Date(a.earned_at || 0).getTime());
  const kartenBadges: StartBadge[] = erreichte.slice(0, 12).map((b) => ({
    id: b.id,
    name: b.name,
    icon: getIconFromString(b.icon),
    farbe: getBadgeColor(b),
    erreicht: true,
    neu: neueIds.has(b.id),
    datum: b.earned_at,
  }));
  const neueSichtbar = erreichte.filter((b) => !b.is_hidden && neueIds.has(b.id)).length;
  const gewaehlt = offenesBadge === null ? null : alleBadges.find((b) => b.id === offenesBadge) ?? null;

  const gueltig = zertifikate.filter((z) => z.status === 'valid').length;
  const abgelaufen = zertifikate.filter((z) => z.status === 'expired').length;
  const badgeKarteDa = config.show_badges && (alleBadges.length > 0 || props.badgeZahlen.geheimGesamt > 0);

  const karten: Record<string, () => React.ReactNode> = {
    zertifikate: () => (config.show_zertifikate && zertifikate.length > 0
      ? <WebZertifikateKarte key="zertifikate" zertifikate={zertifikate} symbol={props.symbolFuer} />
      : null),
    challenges: () => (config.show_challenges
      ? (
        <WebChallengesKarte
          key="challenges"
          challenges={challenges}
          challengeHref={(id) => `/teamer/challenges/${id}`}
          alleHref="/teamer/challenges"
          leer={{ titel: 'Gerade läuft keine Challenge', text: 'Stell Aufgaben und begleite die Beiträge der Konfis.' }}
        />
      )
      : null),
    konfispruch: () => (config.show_konfispruch
      ? (
        <WebZitatKarte
          key="konfispruch"
          titel="Dein Konfispruch"
          symbol={SYMBOL_SPRUCH}
          text={props.konfispruch?.text}
          quelle={props.konfispruch?.reference}
          aktion={{ text: 'Konfispruch ändern', onClick: props.onKonfispruch }}
          leer={{ text: 'Du hast noch keinen Konfispruch eingetragen. Trag deinen Konfirmationsspruch ein.', aktion: 'Konfispruch eintragen' }}
        />
      )
      : null),
    events: () => (config.show_events
      ? (
        <WebEventsKarte
          key="events"
          events={events}
          eventHref={(id) => `/teamer/events?eventId=${id}`}
          alleHref="/teamer/events"
          leer={{ titel: 'Noch kein Event gebucht', text: 'Schau, welche Events als Nächstes anstehen.' }}
        />
      )
      : null),
    losung: () => (config.show_losung && props.losung
      ? (
        <WebZitatKarte
          key="losung"
          titel="Tageslosung"
          symbol={SYMBOL_LOSUNG}
          text={props.losung.text}
          quelle={props.losung.quelle}
          fussnote={props.losung.uebersetzung}
          aktion={{ text: 'Übersetzung ändern', onClick: props.onUebersetzung }}
        />
      )
      : null),
    badges: () => (badgeKarteDa
      ? (
        <WebBadgesKarte
          key="badges"
          badges={kartenBadges}
          erreicht={props.badgeZahlen.erreicht}
          gesamt={props.badgeZahlen.gesamt}
          geheimErreicht={props.badgeZahlen.geheimErreicht}
          geheimGesamt={props.badgeZahlen.geheimGesamt}
          neueSichtbar={neueSichtbar}
          alleHref="/teamer/profile/badges"
          onOeffnen={setOffenesBadge}
        />
      )
      : null),
  };

  const sichtbar = sectionOrder.map((schluessel) => karten[schluessel]?.()).filter(Boolean);
  const naechstes = events.find((e) => e.status !== 'abgesagt');

  return (
    <div className="web-start web-rolle web-rolle--team">
      <div className="web-raster web-raster--kacheln">
        {config.show_events && (
          <WebKachel
            label="Anstehende Events"
            wert={String(events.length)}
            zusatz={[naechstes ? `Das nächste: ${naehe(naechstes.tage)}` : 'Nichts gebucht']}
            href="/teamer/events"
          />
        )}
        {config.show_challenges && (
          <WebKachel
            label="Laufende Challenges"
            wert={String(challenges.length)}
            zusatz={[challenges.length > 0 ? 'Jetzt mitmachen und begleiten' : 'Gerade läuft keine']}
            href="/teamer/challenges"
          />
        )}
        {badgeKarteDa && (
          <WebKachel
            label="Badges erreicht"
            wert={String(props.badgeZahlen.erreicht)}
            zusatz={[`von ${props.badgeZahlen.gesamt} sichtbaren`, neueSichtbar > 0 ? `${neueSichtbar} ${neueSichtbar === 1 ? 'neues' : 'neue'}` : null]}
            href="/teamer/profile/badges"
          />
        )}
        {config.show_zertifikate && zertifikate.length > 0 && (
          <WebKachel
            label="Zertifikate gültig"
            wert={String(gueltig)}
            zusatz={[abgelaufen > 0 ? `${abgelaufen} abgelaufen` : 'Alle in Ordnung']}
            achtung={abgelaufen > 0}
          />
        )}
      </div>
      {sichtbar.length > 0 && <div className="web-start-raster">{sichtbar}</div>}
      {gewaehlt && (
        <WebBadgeDialog
          badge={gewaehlt}
          erreicht={Boolean(gewaehlt.earned)}
          onSchliessen={() => setOffenesBadge(null)}
        />
      )}
    </div>
  );
};

export default WebTeamerStart;
