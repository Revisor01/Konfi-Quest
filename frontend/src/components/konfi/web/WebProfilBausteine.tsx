// Die Bausteine der Profil-Seiten in der Web-Fassung -- für Konfis, Team UND
// Leitung. Alle drei Profile bestehen aus denselben Teilen (Person, Konto-
// Einstellungen, Einladungen, Rückblicke, Abmelden und Konto löschen); sie
// unterscheiden sich in den Zeilen und in den Wegen. Deshalb liegen die
// Teile hier an einer Stelle, und die drei Seiten setzen sie zusammen.
//
// Nichts hier lädt oder speichert selbst, außer wo es ausdrücklich dasselbe
// tut wie sein Gegenstück in der App: die Einladungen (useEinladungen, dieselben
// Abrufe und Meldungen), die Benachrichtigungen (dieselbe Auswahl und derselbe
// Dialog) und der Punkte-Verlauf (dieselbe Route). Die Handgriffe der
// Einstellungen -- E-Mail, Passwort, Konto löschen -- sind die Modale der App,
// die die Seite öffnet und hier nur als Knopf bekommt.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IonIcon, useIonModal } from '@ionic/react';
import {
  ICON_ABMELDEN,
  ICON_BENACHRICHTIGUNG,
  ICON_GEMEINDE_GEFUELLT,
  ICON_LOESCHEN,
  ICON_UHRZEIT,
  ICON_ZUSAGE_GEFUELLT,
  ICON_ABSAGE,
} from '../../shared/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import { rollenName } from '../../../utils/rollenNamen';
import { datumKurz } from '../../../utils/dateUtils';
import { punkteText } from '../../../utils/punkteText';
import { punkteAnzeigeDatum, nachAnzeigeDatumAbsteigend } from '../../../utils/punkteDatum';
import type { WrappedHistoryEntry } from '../../../types/wrapped';
import { PushAuswahlModal, ladePushEinstellungen, pushZusammenfassung, type PushEinstellungen } from '../../shared/PushAuswahl';
import { useEinladungen } from '../../shared/EinladungenKarte';
import WebKarte from '../../web/WebKarte';
import WebKnopf from '../../web/WebKnopf';
import WebPill from '../../web/WebPill';
import WebAngaben, { type WebAngabe } from '../../web/WebAngaben';
import WebTabelle from '../../web/WebTabelle';
import { WebLeer, WebFehler, WebLaden } from '../../web/WebZustaende';
import { useWebDaten } from '../../web/useWebDaten';
import '../../../theme/web/start.css';

// --- Person ----------------------------------------------------------------

export interface WebPersonKarteProps {
  name: string;
  /** Unter dem Namen: Selbstbezeichnung, Rolle, Jahrgang. */
  untertitel?: string;
  angaben: ReadonlyArray<WebAngabe>;
}

/** Die Person: Anfangsbuchstabe in der Rollenfarbe, Name, Angaben darunter. */
export const WebPersonKarte: React.FC<WebPersonKarteProps> = ({ name, untertitel, angaben }) => (
  <section className="web-karte web-profil-person" aria-label="Person">
    <div className="web-profil-person__kopf">
      <span className="web-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || '?'}</span>
      <div className="web-profil-person__text">
        <h2 className="web-profil-person__name">{name}</h2>
        {untertitel && <p className="web-profil-person__untertitel">{untertitel}</p>}
      </div>
    </div>
    <div className="web-karte__inhalt">
      <WebAngaben angaben={angaben} beschriftung="Angaben zur Person" />
    </div>
  </section>
);

// --- Einstellungen -----------------------------------------------------------

export interface WebEinstellungProps {
  icon: string;
  titel: string;
  /** Der aktuelle Stand unter dem Titel („Aktuell: …"). */
  wert?: string;
  /** Beschriftung des Knopfes rechts („Ändern", „Öffnen"). */
  knopf: string;
  /** Mit Adresse ist der Knopf ein Link (Mittelklick öffnet einen neuen Tab), sonst ruft er `onClick`. */
  href?: string;
  onClick?: () => void;
}

/** Eine Zeile der Konto-Einstellungen: Symbol, Titel mit Stand, Knopf. */
export const WebEinstellung: React.FC<WebEinstellungProps> = ({ icon, titel, wert, knopf, href, onClick }) => (
  <li className="web-einstellung">
    <span className="web-einstellung__symbol" aria-hidden="true"><IonIcon icon={icon} /></span>
    <div className="web-einstellung__text">
      <span className="web-einstellung__titel">{titel}</span>
      {wert && <span className="web-einstellung__wert">{wert}</span>}
    </div>
    <WebKnopf klein href={href} onClick={onClick} aria-label={`${titel}: ${knopf}`}>{knopf}</WebKnopf>
  </li>
);

export const WebEinstellungenKarte: React.FC<{ children: React.ReactNode; titel?: string }> = ({ children, titel = 'Konto-Einstellungen' }) => (
  <WebKarte titel={titel} bund>
    <ul className="web-einstellungen" aria-label={titel}>{children}</ul>
  </WebKarte>
);

export interface WebPushZeileProps {
  /** Die Seite, über der der Dialog erscheint (Karten-Darstellung der Modale); erst beim Öffnen gelesen. */
  presentingElement?: () => HTMLElement | null | undefined;
}

/**
 * Benachrichtigungen: dieselbe Auswahl wie in der App (PushAuswahlModal), als
 * Zeile der Einstellungen. Der Stand unter dem Titel sagt, was gerade gilt.
 */
export const WebPushZeile: React.FC<WebPushZeileProps & { variante: 'users' | 'teamer' | 'purple' }> = ({ variante, presentingElement }) => {
  const { pushNotificationsPermission, requestPushPermissions } = useApp();
  const [einstellungen, setEinstellungen] = useState<PushEinstellungen | null>(null);

  useEffect(() => {
    let abgemeldet = false;
    ladePushEinstellungen()
      .then((e) => { if (!abgemeldet) setEinstellungen(e); })
      .catch(() => { /* der Stand fällt auf den neutralen Text zurück */ });
    return () => { abgemeldet = true; };
  }, []);

  const [zeige, schliesse] = useIonModal(PushAuswahlModal, {
    onClose: () => schliesse(),
    variante,
    onGeaendert: (e: PushEinstellungen) => setEinstellungen(e),
  });

  return (
    <WebEinstellung
      icon={ICON_BENACHRICHTIGUNG}
      titel="Benachrichtigungen"
      wert={pushZusammenfassung(einstellungen, pushNotificationsPermission)}
      knopf="Auswählen"
      onClick={() => {
        if (pushNotificationsPermission !== 'granted') void requestPushPermissions();
        zeige({ presentingElement: presentingElement?.() ?? undefined });
      }}
    />
  );
};

// --- Einladungen -------------------------------------------------------------

/** Offene Einladungen in eine weitere Gemeinde -- Annehmen oder Ablehnen. Ohne Einladung entfällt die Karte. */
export const WebEinladungenKarte: React.FC = () => {
  const { einladungen, laeuft, antworten, isOnline } = useEinladungen();
  if (einladungen.length === 0) return null;
  return (
    <WebKarte titel={einladungen.length === 1 ? 'Einladung' : 'Einladungen'} untertitel="Du wurdest in eine weitere Gemeinde eingeladen." bund>
      <ul className="web-einstellungen" aria-label="Offene Einladungen">
        {einladungen.map((e) => (
          <li key={e.id} className="web-einstellung">
            <span className="web-einstellung__symbol" aria-hidden="true"><IonIcon icon={ICON_GEMEINDE_GEFUELLT} /></span>
            <div className="web-einstellung__text">
              <span className="web-einstellung__titel">{e.organization_display_name}</span>
              <span className="web-einstellung__wert">
                als {rollenName(e.role_name, e.role_display_name)}{e.eingeladen_von_name ? ` · von ${e.eingeladen_von_name}` : ''}
              </span>
            </div>
            <div className="web-einstellung__knoepfe">
              <WebKnopf klein art="primaer" disabled={laeuft === e.id || !isOnline} onClick={() => { void antworten(e.id, 'annehmen'); }}>
                <IonIcon icon={ICON_ZUSAGE_GEFUELLT} aria-hidden="true" />
                Annehmen
              </WebKnopf>
              <WebKnopf klein disabled={laeuft === e.id || !isOnline} onClick={() => { void antworten(e.id, 'ablehnen'); }}>
                <IonIcon icon={ICON_ABSAGE} aria-hidden="true" />
                Ablehnen
              </WebKnopf>
            </div>
          </li>
        ))}
      </ul>
    </WebKarte>
  );
};

// --- Rückblicke ----------------------------------------------------------------

export interface WebRueckblickeKarteProps {
  eintraege: WrappedHistoryEntry[];
  onOeffnen: (eintrag: WrappedHistoryEntry) => void;
}

/** Meine Rückblicke: die früheren Ausgaben, jede mit einem Knopf zum Ansehen. */
export const WebRueckblickeKarte: React.FC<WebRueckblickeKarteProps> = ({ eintraege, onOeffnen }) => {
  if (eintraege.length === 0) return null;
  return (
    <WebKarte titel="Meine Rückblicke" bund>
      <ul className="web-einstellungen" aria-label="Meine Rückblicke">
        {eintraege.map((e) => (
          <WebEinstellung
            key={e.id}
            icon={ICON_UHRZEIT}
            titel={e.titel || `Jahresrückblick ${e.year}`}
            wert={`Erstellt am ${datumKurz(e.computed_at)}`}
            knopf="Ansehen"
            onClick={() => onOeffnen(e)}
          />
        ))}
      </ul>
    </WebKarte>
  );
};

// --- Abmelden und Konto löschen -----------------------------------------------

export interface WebKontoKarteProps {
  onAbmelden?: () => void;
  onLoeschen: () => void;
}

export const WebKontoKarte: React.FC<WebKontoKarteProps> = ({ onAbmelden, onLoeschen }) => (
  <WebKarte titel="Konto" untertitel="Abmelden oder das Konto samt Daten entfernen.">
    <div className="web-konto-knoepfe">
      {onAbmelden && (
        <WebKnopf onClick={onAbmelden}>
          <IonIcon icon={ICON_ABMELDEN} aria-hidden="true" />
          Abmelden
        </WebKnopf>
      )}
      <WebKnopf art="gefahr" onClick={onLoeschen}>
        <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
        Konto löschen
      </WebKnopf>
    </div>
  </WebKarte>
);

// --- Punkte-Verlauf ---------------------------------------------------------------

interface PunkteEintrag {
  id: number;
  title: string;
  points: number;
  category: string;
  date: string;
  comment?: string;
  source_type: 'activity' | 'bonus' | 'event';
  event_date?: string | null;
}

export interface WebPunkteVerlaufProps {
  /** Route des Verlaufs: `/konfi/points-history` oder `/teamer/konfi-history`. */
  endpunkt: string;
  gottesdienstAktiv: boolean;
  gemeindeAktiv: boolean;
  titel?: string;
  /** So viele Einträge stehen zuerst da; der Rest klappt mit einem Knopf auf. */
  zuerst?: number;
}

/**
 * Der Verlauf aller Punkte als Tabelle -- dieselbe Route und dieselbe Ordnung
 * wie die Punkte-Übersicht der App (neueste zuerst nach dem angezeigten Datum),
 * abgeschaltete Punktearten fehlen.
 */
export const WebPunkteVerlauf: React.FC<WebPunkteVerlaufProps> = ({ endpunkt, gottesdienstAktiv, gemeindeAktiv, titel = 'Punkte-Verlauf', zuerst = 8 }) => {
  const lader = useCallback(async (): Promise<PunkteEintrag[]> => {
    const antwort = await api.get(endpunkt);
    return Array.isArray(antwort.data?.history) ? antwort.data.history : [];
  }, [endpunkt]);
  const { daten, laedt, fehler, neuLaden } = useWebDaten(lader);
  const [alle, setAlle] = useState(false);

  const eintraege = useMemo(() => nachAnzeigeDatumAbsteigend(daten ?? []).filter((e) => {
    if (e.category === 'gottesdienst' && !gottesdienstAktiv) return false;
    if (e.category === 'gemeinde' && !gemeindeAktiv) return false;
    return true;
  }), [daten, gottesdienstAktiv, gemeindeAktiv]);
  const gezeigt = alle ? eintraege : eintraege.slice(0, zuerst);

  if (laedt) return <WebKarte titel={titel}><WebLaden karten={0} kacheln={0} text="Der Verlauf wird geladen." /></WebKarte>;
  if (!daten) {
    return fehler
      ? <WebKarte titel={titel}><WebFehler text="Der Verlauf konnte nicht geladen werden." onErneut={() => { void neuLaden(); }} /></WebKarte>
      : null;
  }

  return (
    <WebKarte
      titel={titel}
      untertitel={`${eintraege.length} ${eintraege.length === 1 ? 'Eintrag' : 'Einträge'}`}
      bund={eintraege.length > 0}
    >
      {eintraege.length === 0 ? (
        <WebLeer icon={ICON_UHRZEIT} titel="Noch keine Einträge" text="Hier erscheinen die Punkte, sobald es welche gibt." />
      ) : (
        <>
          <WebTabelle<PunkteEintrag>
            beschriftung={titel}
            zeilen={gezeigt}
            zeileSchluessel={(e) => `${e.source_type}-${e.id}`}
            spalten={[
              { schluessel: 'datum', kopf: 'Datum', breite: '110px', zelle: (e) => datumKurz(punkteAnzeigeDatum(e)) },
              {
                schluessel: 'titel',
                kopf: 'Wofür',
                zelle: (e) => (
                  <>
                    <span className="web-zelle-titel">{e.title}</span>
                    {e.comment && <span className="web-zelle-leise">{e.comment}</span>}
                  </>
                ),
              },
              {
                schluessel: 'art',
                kopf: 'Art',
                breite: '190px',
                zelle: (e) => (
                  <span className="web-pillreihe">
                    {e.category === 'gottesdienst' && <WebPill ton="info">Gottesdienst</WebPill>}
                    {e.category === 'gemeinde' && <WebPill ton="erfolg">Gemeinde</WebPill>}
                    {e.source_type === 'event' && <WebPill>Event</WebPill>}
                    {e.source_type === 'bonus' && <WebPill ton="warnung">Bonus</WebPill>}
                  </span>
                ),
              },
              { schluessel: 'punkte', kopf: 'Punkte', zahl: true, breite: '90px', zelle: (e) => <strong title={punkteText(e.points)}>+{e.points}</strong> },
            ]}
          />
          {eintraege.length > zuerst && (
            <div className="web-verlauf-mehr">
              <WebKnopf klein onClick={() => setAlle(!alle)}>
                {alle ? 'Weniger anzeigen' : `Alle ${eintraege.length} Einträge anzeigen`}
              </WebKnopf>
            </div>
          )}
        </>
      )}
    </WebKarte>
  );
};
