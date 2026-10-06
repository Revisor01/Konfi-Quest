// Das Profil der Leitung in der Web-Fassung (Browser ab 992 px): zweispaltig. Links
// die Person mit ihren Angaben, rechts die Einstellungen, offene Einladungen und
// das Löschen des Kontos. Abmelden steht, wie in der App, nicht im Profil -- in
// der Web-Fassung sitzt es unten in der Seitenleiste.
//
// Die Seite lädt und speichert nichts selbst: Die Handgriffe (Funktionsbeschreibung,
// E-Mail, Passwort, Konto löschen) sind die der App
// (admin/pages/AdminProfilePage.tsx) und kommen hier als Funktionen an.

import React from 'react';
import { ICON_AKTENTASCHE, ICON_GALERIE, ICON_MAIL, ICON_SCHLUESSEL } from '../../../shared/icons';
import WebSpalten from '../../../web/WebSpalten';
import {
  WebEinladungenKarte,
  WebEinstellung,
  WebEinstellungenKarte,
  WebKontoKarte,
  WebPersonKarte,
  WebPushZeile,
} from '../../../konfi/web/WebProfilBausteine';
import '../../../../theme/web/start.css';

export interface WebAdminProfilProps {
  name: string;
  /** „Gemeindeleitung · Gemeindepädagoge" */
  untertitel: string;
  benutzername?: string;
  email: string;
  rolle: string;
  /** Technischer Rollenname (`org_admin`, `admin`): bestimmt die Farbe. */
  rolleName?: string | null;
  gemeinde?: string;
  seit?: string;
  funktion: string;
  cacheLabel: string;
  onFunktion: () => void;
  onEmail: () => void;
  onPasswort: () => void;
  onCache: () => void;
  onLoeschen: () => void;
  /** Die Seite, über der die Auswahl der Benachrichtigungen erscheint. */
  presentingElement?: () => HTMLElement | null | undefined;
}

const WebAdminProfil: React.FC<WebAdminProfilProps> = (props) => {
  const links = (
    <WebPersonKarte
      name={props.name}
      untertitel={props.untertitel}
      angaben={[
        { label: 'Benutzername', wert: props.benutzername ? `@${props.benutzername}` : null },
        { label: 'E-Mail', wert: props.email || null },
        { label: 'Rolle', wert: props.rolle },
        { label: 'Gemeinde', wert: props.gemeinde || null },
        { label: 'Dabei seit', wert: props.seit || null },
      ]}
    />
  );

  const haupt = (
    <>
      <WebEinladungenKarte />

      <WebEinstellungenKarte>
        <WebEinstellung
          icon={ICON_AKTENTASCHE}
          titel="Funktionsbeschreibung"
          wert={props.funktion ? `Aktuell: ${props.funktion}` : 'z.B. Pastor, Diakonin'}
          knopf="Ändern"
          onClick={props.onFunktion}
        />
        <WebEinstellung
          icon={ICON_MAIL}
          titel="E-Mail-Adresse"
          wert={props.email ? `Aktuell: ${props.email}` : 'E-Mail für Benachrichtigungen'}
          knopf="Ändern"
          onClick={props.onEmail}
        />
        <WebEinstellung icon={ICON_SCHLUESSEL} titel="Passwort" wert="Sicherheitseinstellungen" knopf="Ändern" onClick={props.onPasswort} />
        {/* Wie bei Konfis und Team (in der App unter Mehr › Konto). Simon,
            06.10.2026: dass sie der Leitung im Browser fehlte, war nicht gewollt. */}
        <WebPushZeile variante="users" presentingElement={props.presentingElement} />
        <WebEinstellung icon={ICON_GALERIE} titel="Medien-Cache" wert={props.cacheLabel} knopf="Leeren" onClick={props.onCache} />
      </WebEinstellungenKarte>

      <WebKontoKarte onLoeschen={props.onLoeschen} />
    </>
  );

  return (
    <div className={`web-start web-rolle ${props.rolleName === 'org_admin' ? 'web-rolle--gemeindeleitung' : 'web-rolle--leitung'}`}>
      <WebSpalten seiteLinks seite={links} haupt={haupt} seiteBeschriftung="Person" />
    </div>
  );
};

export default WebAdminProfil;
