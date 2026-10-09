// Das Profil des Teams in der Web-Fassung (Browser ab 992 px): zweispaltig. Links
// die Person und die Einstellungen, rechts die Wege zu den Badges und zur
// Konfi-Historie samt Überblick über die eigene Konfi-Zeit, die Rückblicke und
// die Neuerungen.
//
// Die Seite lädt und speichert nichts selbst: Die Handgriffe (Funktionsbeschreibung,
// E-Mail, Passwort, Bibelübersetzung, Abmelden, Konto löschen) sind die der App
// (teamer/pages/TeamerProfilePage.tsx) und kommen hier als Funktionen an.

import React from 'react';
import {
  ICON_ABZEICHEN_GEFUELLT,
  ICON_AKTENTASCHE,
  ICON_BUCH,
  ICON_GALERIE,
  ICON_JAHRGANG,
  ICON_KOMPASS,
  ICON_MAIL,
  ICON_SCHLUESSEL,
} from '../../shared/icons';
import { datumKurz } from '../../../utils/dateUtils';
import { punkteText } from '../../../utils/punkteText';
import { selbstbezeichnung } from '../../../utils/rollenNamen';
import type { WrappedHistoryEntry } from '../../../types/wrapped';
import NeuerungenBanner from '../../shared/NeuerungenBanner';
import WebKarte from '../../web/WebKarte';
import WebKnopf from '../../web/WebKnopf';
import WebAngaben from '../../web/WebAngaben';
import WebSpalten from '../../web/WebSpalten';
import {
  WebEinladungenKarte,
  WebEinstellung,
  WebEinstellungenKarte,
  WebKontoKarte,
  WebPersonKarte,
  WebPushZeile,
  WebKennzahlenZeile,
  WebRueckblickeKarte,
} from '../../konfi/web/WebProfilBausteine';
import '../../../theme/web/start.css';

export interface WebTeamerProfilDaten {
  user: {
    display_name: string;
    username: string;
    email: string;
    role_title: string;
    teamer_since: string | null;
    organization_name: string;
  };
  konfi_data: {
    gottesdienst_points: number;
    gemeinde_points: number;
    jahrgang_name?: string;
    badges: Array<{ badge_id: number }>;
  } | null;
}

export interface WebTeamerProfilProps {
  profil: WebTeamerProfilDaten;
  uebersetzung: string;
  cacheLabel: string;
  rueckblicke: WrappedHistoryEntry[];
  presentingElement: () => HTMLElement | null;
  onRueckblick: (eintrag: WrappedHistoryEntry) => void;
  onFunktion: () => void;
  onEmail: () => void;
  onPasswort: () => void;
  onUebersetzung: () => void;
  onTour: () => void;
  onCache: () => void;
  onAbmelden: () => void;
  onLoeschen: () => void;
  onNeuerungen: () => void;
  onMitmachen: () => void;
}

const WebTeamerProfil: React.FC<WebTeamerProfilProps> = (props) => {
  const u = props.profil.user;
  const konfi = props.profil.konfi_data;
  const konfiPunkte = konfi ? (konfi.gottesdienst_points || 0) + (konfi.gemeinde_points || 0) : 0;

  const links = (
    <>
      <WebPersonKarte
        name={u.display_name}
        untertitel={selbstbezeichnung(u.role_title, 'Teamer:in')}
        angaben={[
          { label: 'Benutzername', wert: `@${u.username}` },
          { label: 'E-Mail', wert: u.email || null },
          { label: 'Gemeinde', wert: u.organization_name || null },
          { label: 'Dabei seit', wert: u.teamer_since ? datumKurz(u.teamer_since) : null },
        ]}
      />

      <WebEinstellungenKarte>
        <WebEinstellung
          icon={ICON_AKTENTASCHE}
          titel="Funktionsbeschreibung"
          wert={selbstbezeichnung(u.role_title) ? `Aktuell: ${selbstbezeichnung(u.role_title)}` : 'z.B. Jugendleiter:in'}
          knopf="Ändern"
          onClick={props.onFunktion}
        />
        <WebEinstellung
          icon={ICON_MAIL}
          titel="E-Mail-Adresse"
          wert={u.email ? `Aktuell: ${u.email}` : 'E-Mail für Benachrichtigungen'}
          knopf="Ändern"
          onClick={props.onEmail}
        />
        <WebEinstellung icon={ICON_SCHLUESSEL} titel="Passwort" wert="Sicherheitseinstellungen" knopf="Ändern" onClick={props.onPasswort} />
        <WebEinstellung icon={ICON_BUCH} titel="Bibelübersetzung" wert={props.uebersetzung} knopf="Ändern" onClick={props.onUebersetzung} />
        <WebEinstellung icon={ICON_KOMPASS} titel="App-Tour" wert="Kurze Einführung durch die App" knopf="Ansehen" onClick={props.onTour} />
        <WebPushZeile variante="teamer" presentingElement={props.presentingElement} />
        {/* Kennzahl "Challenge-Beiträge" wie in der App (Mehr › Konto). */}
        <WebKennzahlenZeile presentingElement={props.presentingElement} />
        <WebEinstellung icon={ICON_GALERIE} titel="Medien-Cache" wert={props.cacheLabel} knopf="Leeren" onClick={props.onCache} />
      </WebEinstellungenKarte>

      <WebKontoKarte onAbmelden={props.onAbmelden} onLoeschen={props.onLoeschen} />
    </>
  );

  const haupt = (
    <>
      <WebEinladungenKarte />

      <WebEinstellungenKarte titel="Inhalt">
        <WebEinstellung icon={ICON_ABZEICHEN_GEFUELLT} titel="Badges" wert="Was du gesammelt hast" knopf="Ansehen" href="/teamer/profile/badges" />
        {konfi && (
          <WebEinstellung icon={ICON_JAHRGANG} titel="Konfi-Historie" wert="Konfi-Punkte und Badges" knopf="Öffnen" href="/teamer/profile/konfi-stats" />
        )}
      </WebEinstellungenKarte>

      {konfi && (
        <WebKarte
          titel="Deine Konfi-Zeit"
          untertitel={konfi.jahrgang_name ? `Jahrgang ${konfi.jahrgang_name}` : undefined}
          aktion={<WebKnopf klein href="/teamer/profile/konfi-stats">Konfi-Historie öffnen</WebKnopf>}
        >
          <WebAngaben
            angaben={[
              { label: 'Punkte gesamt', wert: punkteText(konfiPunkte) },
              { label: 'Gottesdienst', wert: punkteText(konfi.gottesdienst_points || 0) },
              { label: 'Gemeinde', wert: punkteText(konfi.gemeinde_points || 0) },
              { label: 'Badges', wert: String(konfi.badges.length) },
            ]}
          />
        </WebKarte>
      )}

      <WebRueckblickeKarte eintraege={props.rueckblicke} onOeffnen={props.onRueckblick} />

      <div className="web-profil-hinweise">
        <NeuerungenBanner style={{ margin: 0 }} onUpdateOeffnen={props.onNeuerungen} onMitmachenOeffnen={props.onMitmachen} />
      </div>
    </>
  );

  return (
    <div className="web-start web-rolle web-rolle--team">
      <WebSpalten seiteLinks seite={links} haupt={haupt} seiteBeschriftung="Person und Einstellungen" />
    </div>
  );
};

export default WebTeamerProfil;
