// Das Profil der Konfis in der Web-Fassung (Browser ab 992 px): zweispaltig.
// Links die Person und die Einstellungen -- wie in der App, aber als Zeilen mit
// Knöpfen --, rechts Kennzahlen, Aufteilung und Verlauf der Punkte, Rückblicke
// und die Neuerungen.
//
// Die Seite lädt und speichert nichts selbst. Alle Handgriffe (E-Mail, Passwort,
// Bibelübersetzung, Punkte-Übersicht, Abmelden, Konto löschen) sind die der App
// (konfi/views/ProfileView.tsx) und kommen hier als Funktionen an; Einladungen,
// Benachrichtigungen und der Verlauf nutzen dieselben Routen und Dialoge wie dort.

import React from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_BUCH,
  ICON_GALERIE,
  ICON_KOMPASS,
  ICON_MAIL,
  ICON_ORT,
  ICON_SCHLUESSEL,
} from '../../shared/icons';
import { datumKurz, uhrzeit } from '../../../utils/dateUtils';
import { punkteText } from '../../../utils/punkteText';
import type { WrappedHistoryEntry } from '../../../types/wrapped';
import NeuerungenBanner from '../../shared/NeuerungenBanner';
import WebKarte from '../../web/WebKarte';
import WebKachel from '../../web/WebKachel';
import WebKnopf from '../../web/WebKnopf';
import WebAngaben from '../../web/WebAngaben';
import WebSpalten from '../../web/WebSpalten';
import {
  WebEinladungenKarte,
  WebEinstellung,
  WebEinstellungenKarte,
  WebKontoKarte,
  WebPersonKarte,
  WebPunkteVerlauf,
  WebPushZeile,
  WebRueckblickeKarte,
} from './WebProfilBausteine';
import '../../../theme/web/start.css';

export interface WebKonfiProfilDaten {
  username: string;
  display_name: string;
  jahrgang_name: string;
  created_at: string;
  confirmation_date?: string;
  confirmation_location?: string;
  gottesdienst_enabled?: boolean;
  gemeinde_enabled?: boolean;
  total_points: number;
  gottesdienst_points?: number;
  gemeinde_points?: number;
  bonus_points?: number;
  badge_count: number;
  activity_count: number;
  event_count: number;
  pending_requests: number;
  rank_in_jahrgang?: number;
  total_in_jahrgang?: number;
}

export interface WebKonfiProfilProps {
  profil: WebKonfiProfilDaten;
  /** Die Adresse für Benachrichtigungen: aus dem Profil, sonst vom Konto. */
  email: string;
  challengeAnzahl: number;
  uebersetzung: string;
  cacheLabel: string;
  rueckblicke: WrappedHistoryEntry[];
  /** Die Seite, über der Dialoge erscheinen -- erst beim Öffnen gelesen. */
  presentingElement: () => HTMLElement | null;
  onRueckblick: (eintrag: WrappedHistoryEntry) => void;
  onPunkte: () => void;
  onTour: () => void;
  onEmail: () => void;
  onPasswort: () => void;
  onUebersetzung: () => void;
  onCache: () => void;
  onAbmelden: () => void;
  onLoeschen: () => void;
  onNeuerungen: () => void;
  onMitmachen: () => void;
}

const WebKonfiProfil: React.FC<WebKonfiProfilProps> = (props) => {
  const p = props.profil;
  const gottesdienst = p.gottesdienst_enabled !== false;
  const gemeinde = p.gemeinde_enabled !== false;
  const gd = gottesdienst ? (p.gottesdienst_points || 0) : 0;
  const gem = gemeinde ? (p.gemeinde_points || 0) : 0;
  const summe = gd + gem;
  const platz = p.rank_in_jahrgang && p.total_in_jahrgang ? `Platz ${p.rank_in_jahrgang} von ${p.total_in_jahrgang}` : null;

  const links = (
    <>
      <WebPersonKarte
        name={p.display_name}
        untertitel={p.jahrgang_name}
        angaben={[
          { label: 'Benutzername', wert: `@${p.username}` },
          { label: 'E-Mail', wert: props.email || null },
          { label: 'Dabei seit', wert: datumKurz(p.created_at) || null },
        ]}
      />

      {p.confirmation_date && (
        <WebKarte titel="Deine Konfirmation">
          <WebAngaben
            angaben={[
              { label: 'Datum', wert: datumKurz(p.confirmation_date, { mitWochentag: true }) },
              { label: 'Uhrzeit', wert: `${uhrzeit(p.confirmation_date)} Uhr` },
              {
                label: 'Ort',
                wert: p.confirmation_location
                  ? (
                    <a
                      className="web-link web-konfirmation-karte__ort"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.confirmation_location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${p.confirmation_location} auf der Karte öffnen`}
                    >
                      <IonIcon icon={ICON_ORT} aria-hidden="true" /> {p.confirmation_location}
                    </a>
                  )
                  : null,
              },
            ]}
          />
        </WebKarte>
      )}

      <WebEinstellungenKarte>
        <WebEinstellung icon={ICON_KOMPASS} titel="App-Tour" wert="Kurze Einführung durch die App" knopf="Ansehen" onClick={props.onTour} />
        <WebEinstellung
          icon={ICON_MAIL}
          titel="E-Mail-Adresse"
          wert={props.email ? `Aktuell: ${props.email}` : 'E-Mail für Benachrichtigungen'}
          knopf="Ändern"
          onClick={props.onEmail}
        />
        <WebEinstellung icon={ICON_SCHLUESSEL} titel="Passwort" wert="Sicherheitseinstellungen" knopf="Ändern" onClick={props.onPasswort} />
        <WebEinstellung icon={ICON_BUCH} titel="Bibelübersetzung" wert={props.uebersetzung} knopf="Ändern" onClick={props.onUebersetzung} />
        <WebPushZeile variante="purple" presentingElement={props.presentingElement} />
        <WebEinstellung icon={ICON_GALERIE} titel="Medien-Cache" wert={props.cacheLabel} knopf="Leeren" onClick={props.onCache} />
      </WebEinstellungenKarte>

      <WebKontoKarte onAbmelden={props.onAbmelden} onLoeschen={props.onLoeschen} />
    </>
  );

  const haupt = (
    <>
      <WebEinladungenKarte />

      <div className="web-profil-kacheln">
        <WebKachel
          label="Punkte gesamt"
          wert={String(p.total_points || 0)}
          zusatz={[gottesdienst ? `Gottesdienst ${gd}` : null, gemeinde ? `Gemeinde ${gem}` : null]}
        />
        {platz && <WebKachel label="Platz im Jahrgang" wert={String(p.rank_in_jahrgang)} zusatz={[`von ${p.total_in_jahrgang}`]} />}
        <WebKachel label="Badges" wert={String(p.badge_count || 0)} zusatz={['Alle ansehen']} href="/konfi/badges" />
        <WebKachel label="Challenges" wert={String(props.challengeAnzahl)} zusatz={['Stempel gesammelt']} href="/konfi/challenges" />
        <WebKachel label="Events" wert={String(p.event_count || 0)} zusatz={['gebucht']} href="/konfi/events" />
        <WebKachel
          label="Aktivitäten"
          wert={String(p.activity_count || 0)}
          zusatz={[p.pending_requests > 0 ? `${p.pending_requests} ${p.pending_requests === 1 ? 'Antrag wartet' : 'Anträge warten'}` : 'Keine Anträge offen']}
          href="/konfi/events?segment=antraege"
        />
      </div>

      {(gottesdienst || gemeinde) && (
        <WebKarte
          titel="So setzen sich deine Punkte zusammen"
          untertitel={(p.bonus_points || 0) > 0 ? `Darin ${punkteText(p.bonus_points || 0)} Bonus` : undefined}
          aktion={<WebKnopf klein onClick={props.onPunkte}>Punkte-Übersicht</WebKnopf>}
        >
          {summe > 0 && (
            <div className="web-aufteilung" role="img" aria-label={`Gottesdienst ${gd}, Gemeinde ${gem}`}>
              {gd > 0 && <span className="web-aufteilung__teil web-aufteilung__teil--gottesdienst" style={{ width: `${(gd / summe) * 100}%` }} />}
              {gem > 0 && <span className="web-aufteilung__teil web-aufteilung__teil--gemeinde" style={{ width: `${(gem / summe) * 100}%` }} />}
            </div>
          )}
          <ul className="web-aufteilung__legende">
            {gottesdienst && <li><span className="web-ziel__marke web-ziel__marke--gottesdienst" aria-hidden="true" />Gottesdienst <strong>{gd}</strong></li>}
            {gemeinde && <li><span className="web-ziel__marke web-ziel__marke--gemeinde" aria-hidden="true" />Gemeinde <strong>{gem}</strong></li>}
          </ul>
        </WebKarte>
      )}

      <WebPunkteVerlauf endpunkt="/konfi/points-history" gottesdienstAktiv={gottesdienst} gemeindeAktiv={gemeinde} />

      <WebRueckblickeKarte eintraege={props.rueckblicke} onOeffnen={props.onRueckblick} />

      <div className="web-profil-hinweise">
        <NeuerungenBanner style={{ margin: 0 }} onUpdateOeffnen={props.onNeuerungen} onMitmachenOeffnen={props.onMitmachen} />
      </div>
    </>
  );

  return (
    <div className="web-start web-rolle">
      <WebSpalten seiteLinks seite={links} haupt={haupt} seiteBeschriftung="Person und Einstellungen" />
    </div>
  );
};

export default WebKonfiProfil;
