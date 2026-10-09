// Benutzer:innen der Gemeinde in der Web-Fassung, /admin/users (Browser ab
// 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6): eine Tabelle mit
// Name, Rolle in der Farbe der Rolle, Jahrgaengen, Status, letzter Anmeldung
// und den Aktionen -- darunter die offenen Einladungen.
//
// Daten und Rechte kommen von der Seite (AdminUsersPage): Anlegen, Einladen,
// Entfernen und die offenen Einladungen gibt es nur fuer die Gemeindeleitung
// (requireOrgAdmin im Server), Bearbeiten nur bei `can_edit`, Entfernen nach
// `can_delete` (utils/mitgliedschaft.ts, darfEntfernen) -- wie in der App. Das Formular ist dasselbe Fenster wie dort (UserManagementModal).

import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_BEARBEITEN, ICON_HINZUFUEGEN, ICON_LOESCHEN, ICON_PERSON, ICON_PERSON_HINZUFUEGEN } from '../../../shared/icons';
import { initialen } from '../../../../utils/konfiListe';
import { datumKurz } from '../../../../utils/dateUtils';
import { rollenFarbe, rollenName } from '../../../../utils/rollenNamen';
import { suchTreffer, suchbegriff } from '../../../../utils/supportWeb';
import { mitEinheit } from '../../../../utils/supportStatistik';
import { darfEntfernen, kontoBleibt } from '../../../../utils/mitgliedschaft';
import type { AdminUser } from '../../../../types/user';
import WebSeite from '../../../web/WebSeite';
import WebKnopf from '../../../web/WebKnopf';
import WebKachel from '../../../web/WebKachel';
import WebChips from '../../../web/WebChips';
import WebSuche from '../../../web/WebSuche';
import WebPill from '../../../web/WebPill';
import WebTreffer from '../../../web/WebTreffer';
import { WebLaden, WebLeer } from '../../../web/WebZustaende';
import WebSortTabelle, { type WebSortSpalte } from './WebSortTabelle';
import { WebAvatar, WebRolleMarke, WebZeilenKnopf, type AvatarFarbe } from './WebLeitungBausteine';
import WebOffeneEinladungen from './WebOffeneEinladungen';
import { kontoStatusRang } from '../../../../utils/statusReihenfolge';
import { inFassung, wahlVon } from '../../../../seiten/beschreibung';
import {
  BENUTZER_FILTER,
  BENUTZER_FILTER_BESCHRIFTUNG,
  BENUTZER_LEER,
  BENUTZER_TITEL,
  BENUTZER_UNTERTITEL,
  type BenutzerFilterSchluessel,
} from '../../../../seiten/benutzer';

export type BenutzerFilter = BenutzerFilterSchluessel;

export interface WebBenutzerProps {
  users: readonly AdminUser[];
  laedt: boolean;
  /** Anlegen, Einladen, Entfernen, offene Einladungen: nur die Gemeindeleitung. */
  darfVerwalten: boolean;
  /** Zaehlt hoch, wenn die offenen Einladungen neu geladen werden sollen. */
  einladungenStand: number;
  pageRef?: React.Ref<HTMLElement>;
  onBearbeiten: (user: AdminUser) => void;
  onLoeschen: (user: AdminUser) => void;
  onAnlegen: () => void;
  onEinladen: () => void;
}

const ROLLEN_REIHENFOLGE: Record<string, number> = { org_admin: 1, admin: 2, teamer: 3 };

const jahrgaengeText = (u: AdminUser): React.ReactNode => {
  // Die Gemeindeleitung sieht alle Jahrgaenge ihrer Gemeinde, ohne Zuweisung.
  if (u.role_name === 'org_admin') return 'Alle Jahrgänge';
  const n = Number(u.assigned_jahrgaenge_count) || 0;
  return n > 0 ? mitEinheit(n, 'Jahrgang', 'Jahrgänge') : <span className="web-gedaempft">Kein Jahrgang</span>;
};

const WebBenutzer: React.FC<WebBenutzerProps> = ({
  users, laedt, darfVerwalten, einladungenStand, pageRef, onBearbeiten, onLoeschen, onAnlegen, onEinladen,
}) => {
  const [filter, setFilter] = useState<BenutzerFilter>('alle');
  const [suche, setSuche] = useState('');
  const sucht = suchbegriff(suche) !== '';

  // Zahl je Filter mit dem Prädikat der gemeinsamen Beschreibung (seiten/benutzer.ts).
  const zahlen = useMemo(() => Object.fromEntries(
    BENUTZER_FILTER.map((w) => [w.schluessel, users.filter((u) => w.passt?.(u) ?? true).length]),
  ) as Record<BenutzerFilter, number>, [users]);

  const sichtbar = useMemo(() => {
    const gefiltert = users.filter((u) => {
      if (!(wahlVon(BENUTZER_FILTER, filter).passt?.(u) ?? true)) return false;
      return !sucht || [u.display_name, u.username, u.email, u.role_title, u.role_display_name, rollenName(u.role_name)]
        .some((t) => !!t && suchTreffer(t, suche).length > 0);
    });
    // Gemeindeleitung zuerst, dann Leitung, dann Team, darin nach Name.
    return [...gefiltert].sort((a, b) => {
      const d = (ROLLEN_REIHENFOLGE[a.role_name] || 99) - (ROLLEN_REIHENFOLGE[b.role_name] || 99);
      return d !== 0 ? d : a.display_name.localeCompare(b.display_name, 'de');
    });
  }, [users, filter, suche, sucht]);

  if (laedt) {
    return (
      <WebSeite bereich="Verwaltung" titel="Benutzer:innen" pageRef={pageRef} wartung>
        <WebLaden kacheln={3} karten={1} text="Die Benutzer:innen werden geladen." />
      </WebSeite>
    );
  }

  const aktionen = darfVerwalten ? (
    <>
      <WebKnopf onClick={onEinladen}>
        <IonIcon icon={ICON_PERSON_HINZUFUEGEN} aria-hidden="true" />
        Person einladen
      </WebKnopf>
      <WebKnopf art="primaer" onClick={onAnlegen}>
        <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
        Benutzer:in anlegen
      </WebKnopf>
    </>
  ) : undefined;

  const spalten: Array<WebSortSpalte<AdminUser>> = [
    {
      schluessel: 'name',
      kopf: 'Name',
      sortWert: (u) => u.display_name,
      zelle: (u) => {
        const avatar: AvatarFarbe = rollenFarbe(u.role_name);
        const titel = <WebTreffer text={u.display_name} suche={suche} />;
        return (
          <span className="web-person-zelle">
            <WebAvatar text={initialen(u.display_name) || '??'} farbe={avatar} />
            <span className="web-person-zelle__text">
              {u.can_edit !== false
                ? <WebZeilenKnopf onClick={() => onBearbeiten(u)} aria-label={`${u.display_name} bearbeiten`}>{titel}</WebZeilenKnopf>
                : <span className="web-zelle-titel web-einzeilig">{titel}</span>}
              <span className="web-zelle-leise web-einzeilig">
                @<WebTreffer text={u.username} suche={suche} />{u.role_title ? ` · ${u.role_title}` : ''}
              </span>
            </span>
          </span>
        );
      },
    },
    {
      schluessel: 'rolle',
      kopf: 'Rolle',
      breite: '150px',
      sortWert: (u) => rollenName(u.role_name),
      zelle: (u) => <WebRolleMarke rolle={u.role_name} />,
    },
    {
      schluessel: 'jahrgaenge',
      kopf: 'Jahrgänge',
      breite: '150px',
      optional: true,
      // Die Gemeindeleitung hat alle Jahrgaenge: sie steht oben bei absteigend
      sortWert: (u) => (u.role_name === 'org_admin' ? Number.MAX_SAFE_INTEGER : Number(u.assigned_jahrgaenge_count) || 0),
      zelle: jahrgaengeText,
    },
    {
      schluessel: 'status',
      kopf: 'Status',
      breite: '190px',
      sortWert: (u) => kontoStatusRang(u.is_active),
      zelle: (u) => (
        <span className="web-pillreihe">
          <WebPill ton={u.is_active ? 'erfolg' : 'neutral'} punkt>{u.is_active ? 'Aktiv' : 'Gesperrt'}</WebPill>
          {u.mitgliedschaft === 'weitere' && (
            <WebPill ton="info" title="Konto und Stamm-Gemeinde liegen in einer anderen Gemeinde; Name, Benutzername und E-Mail verwaltet sie dort.">Gast</WebPill>
          )}
        </span>
      ),
    },
    {
      schluessel: 'angemeldet',
      kopf: 'Zuletzt angemeldet',
      breite: '140px',
      optional: true,
      sortWert: (u) => (u.last_login_at ? new Date(u.last_login_at) : null),
      zelle: (u) => (u.last_login_at ? datumKurz(u.last_login_at) : <span className="web-gedaempft">noch nie</span>),
    },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      klasse: 'web-spalte-aktionen-breit',
      // Bearbeiten nur bei can_edit, Entfernen nach darfEntfernen: beim
      // Support-Gast bietet die Gemeindeleitung nur das Entfernen an, bei
      // einem Konto mit Super-Admin-Merkmal gar nichts (Befund 03.10.2026).
      zelle: (u) => (u.can_edit === false && !(darfVerwalten && darfEntfernen(u)) ? null : (
        <div className="web-zeilenaktionen">
          {u.can_edit !== false && (
            <WebKnopf klein vorn onClick={() => onBearbeiten(u)} aria-label={`${u.display_name} bearbeiten`}>
              <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
              <span className="web-knopf__text">Bearbeiten</span>
            </WebKnopf>
          )}
          {darfVerwalten && darfEntfernen(u) && (
            <WebKnopf klein vorn art="gefahr" symbol onClick={() => onLoeschen(u)}
              aria-label={`${u.display_name} ${kontoBleibt(u) ? 'aus der Gemeinde entfernen' : 'löschen'}`}
              title={kontoBleibt(u) ? 'Aus der Gemeinde entfernen' : 'Benutzer:in löschen'}>
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
            </WebKnopf>
          )}
        </div>
      )),
    },
  ];

  const chips = inFassung(BENUTZER_FILTER, 'web').map((w) => ({ wert: w.schluessel, label: w.label, zahl: zahlen[w.schluessel] }));

  return (
    <WebSeite
      bereich="Verwaltung"
      titel={BENUTZER_TITEL}
      untertitel={BENUTZER_UNTERTITEL}
      aktionen={aktionen}
      pageRef={pageRef}
      wartung
    >
      <div className="web-raster web-raster--kacheln">
        <WebKachel label="Gesamt" wert={String(zahlen.alle)} />
        <WebKachel label="Leitung" wert={String(zahlen.admin)} zusatz={['Gemeindeleitung und Leitung']} />
        <WebKachel label="Team" wert={String(zahlen.teamer)} zusatz={['Teamer:innen']} />
      </div>

      <div className="web-werkzeuge">
        <WebChips<BenutzerFilter> beschriftung={BENUTZER_FILTER_BESCHRIFTUNG} chips={chips} wert={filter} onWert={setFilter} />
        <WebSuche beschriftung="Benutzer:in suchen" platzhalter="Name, Benutzername, E-Mail …" wert={suche} onWert={setSuche} />
        {(sucht || filter !== 'alle') && (
          <span className="web-gedaempft web-werkzeuge__zahl" role="status">{sichtbar.length} von {users.length}</span>
        )}
      </div>

      <div className="web-karte">
        {sichtbar.length === 0 ? (
          <WebLeer
            icon={ICON_PERSON}
            titel={BENUTZER_LEER.titel}
            text={sucht || filter !== 'alle' ? BENUTZER_LEER.keineTreffer : BENUTZER_LEER.niemand}
          />
        ) : (
          <WebSortTabelle
            beschriftung="Benutzer:innen"
            spalten={spalten}
            zeilen={sichtbar}
            zeileSchluessel={(u) => u.id}
            zeileKlasse={(u) => (u.is_active ? undefined : 'web-zeile--gesperrt')}
            mittig
          />
        )}
      </div>

      {darfVerwalten && <WebOffeneEinladungen aktualisierung={einladungenStand} />}
    </WebSeite>
  );
};

export default WebBenutzer;
