// Benutzer:innen der Gemeinde in der Web-Fassung, /admin/users (Browser ab
// 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6): Liste mit
// Name, Rolle in der Farbe der Rolle, Jahrgaengen, Status, letzter Anmeldung
// und den Aktionen -- oder dieselben Personen als Kacheln --, darunter die
// offenen Einladungen.
//
// Rahmen, Kennzahlen, Filter, Suche, Umschalter Liste | Kacheln und Zustaende
// stellt WebListenSeite (10.10.2026); hier stehen nur Spalten, Karte und Daten.
//
// Daten und Rechte kommen von der Seite (AdminUsersPage): Anlegen, Einladen,
// Entfernen und die offenen Einladungen gibt es nur fuer die Gemeindeleitung
// (requireOrgAdmin im Server), Bearbeiten nur bei `can_edit`, Entfernen nach
// `can_delete` (utils/mitgliedschaft.ts, darfEntfernen) -- wie in der App. Das
// Formular ist dasselbe Fenster wie dort (UserManagementModal).

import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_HINZUFUEGEN, ICON_JAHRGANG, ICON_PERSON, ICON_PERSON_HINZUFUEGEN, ICON_UHRZEIT } from '../../../shared/icons';
import { initialen } from '../../../../utils/konfiListe';
import { datumKurz } from '../../../../utils/dateUtils';
import { rollenFarbe, rollenFarbeVar, rollenName } from '../../../../utils/rollenNamen';
import { suchbegriff } from '../../../../utils/supportWeb';
import { mitEinheit } from '../../../../utils/supportStatistik';
import { darfEntfernen, kontoBleibt } from '../../../../utils/mitgliedschaft';
import type { AdminUser } from '../../../../types/user';
import WebKnopf from '../../../web/WebKnopf';
import WebKreis from '../../../web/WebKreis';
import WebPill from '../../../web/WebPill';
import WebTreffer from '../../../web/WebTreffer';
import { WebBildKarteSymbol } from '../../../web/WebBildKarte';
import WebListenSeite from '../../../web/WebListenSeite';
import { WebNameZelle, type WebAktion, type WebSpalte } from '../../../web/WebListe';
import { WebRolleMarke } from './WebLeitungBausteine';
import WebOffeneEinladungen from './WebOffeneEinladungen';
import { kontoStatusRang } from '../../../../utils/statusReihenfolge';
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

/** Die Jahrgaenge einer Person als Text; die Gemeindeleitung sieht alle, ohne Zuweisung. */
const jahrgaengeWort = (u: AdminUser): string | null => {
  if (u.role_name === 'org_admin') return 'Alle Jahrgänge';
  const n = Number(u.assigned_jahrgaenge_count) || 0;
  return n > 0 ? mitEinheit(n, 'Jahrgang', 'Jahrgänge') : null;
};

const darfBearbeitenBei = (u: AdminUser): boolean => u.can_edit !== false;

/** Name und Hinweis der Marke "Gast": Konto und Stamm-Gemeinde liegen anderswo. */
const GAST_TITEL = 'Konto und Stamm-Gemeinde liegen in einer anderen Gemeinde; Name, Benutzername und E-Mail verwaltet sie dort.';

const StatusMarken: React.FC<{ u: AdminUser }> = ({ u }) => (
  <span className="web-pillreihe">
    <WebPill ton={u.is_active ? 'erfolg' : 'neutral'} punkt>{u.is_active ? 'Aktiv' : 'Gesperrt'}</WebPill>
    {u.mitgliedschaft === 'weitere' && <WebPill ton="info" title={GAST_TITEL}>Gast</WebPill>}
  </span>
);

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

  // Gemeindeleitung zuerst, dann Leitung, dann Team, darin nach Name; die Spaltenkoepfe ordnen danach um.
  const geordnet = useMemo(() => [...users].sort((a, b) => {
    const d = (ROLLEN_REIHENFOLGE[a.role_name] || 99) - (ROLLEN_REIHENFOLGE[b.role_name] || 99);
    return d !== 0 ? d : a.display_name.localeCompare(b.display_name, 'de');
  }), [users]);

  // Bearbeiten nur bei can_edit, Entfernen nach darfEntfernen: beim
  // Support-Gast bietet die Gemeindeleitung nur das Entfernen an, bei einem
  // Konto mit Super-Admin-Merkmal gar nichts (Befund 03.10.2026).
  const bearbeiten: WebAktion<AdminUser> = {
    onKlick: onBearbeiten,
    beschriftung: (u) => `${u.display_name} bearbeiten`,
    titel: () => 'Bearbeiten',
    zeigen: darfBearbeitenBei,
  };
  const loeschen: WebAktion<AdminUser> | undefined = darfVerwalten ? {
    onKlick: onLoeschen,
    beschriftung: (u) => `${u.display_name} ${kontoBleibt(u) ? 'aus der Gemeinde entfernen' : 'löschen'}`,
    titel: (u) => (kontoBleibt(u) ? 'Aus der Gemeinde entfernen' : 'Benutzer:in löschen'),
    zeigen: darfEntfernen,
  } : undefined;

  const unterzeile = (u: AdminUser) => (
    <>@<WebTreffer text={u.username} suche={suche} />{u.role_title ? ` · ${u.role_title}` : ''}</>
  );

  const spalten: Array<WebSpalte<AdminUser>> = [
    {
      schluessel: 'name',
      kopf: 'Name',
      sortWert: (u) => u.display_name,
      zelle: (u) => (
        <WebNameZelle
          kreis={<WebKreis text={initialen(u.display_name) || '??'} ton={rollenFarbe(u.role_name)} />}
          titel={<WebTreffer text={u.display_name} suche={suche} />}
          onKlick={darfBearbeitenBei(u) ? () => onBearbeiten(u) : undefined}
          beschriftung={`${u.display_name} bearbeiten`}
          unterzeile={unterzeile(u)}
        />
      ),
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
      zelle: (u) => jahrgaengeWort(u) ?? <span className="web-gedaempft">Kein Jahrgang</span>,
    },
    {
      schluessel: 'status',
      kopf: 'Status',
      breite: '190px',
      sortWert: (u) => kontoStatusRang(u.is_active),
      zelle: (u) => <StatusMarken u={u} />,
    },
    {
      schluessel: 'angemeldet',
      kopf: 'Zuletzt angemeldet',
      breite: '140px',
      optional: true,
      sortWert: (u) => (u.last_login_at ? new Date(u.last_login_at) : null),
      zelle: (u) => (u.last_login_at ? datumKurz(u.last_login_at) : <span className="web-gedaempft">noch nie</span>),
    },
  ];

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

  return (
    <WebListenSeite<AdminUser>
      bereich="Verwaltung"
      titel={BENUTZER_TITEL}
      untertitel={laedt ? undefined : BENUTZER_UNTERTITEL}
      aktionen={laedt ? undefined : aktionen}
      pageRef={pageRef}
      wartung
      laden={laedt ? { text: 'Die Benutzer:innen werden geladen.', kacheln: 3, karten: 1 } : undefined}
      kennzahlen={[
        { label: 'Gesamt', wert: String(zahlen.alle) },
        { label: 'Leitung', wert: String(zahlen.admin), zusatz: ['Gemeindeleitung und Leitung'] },
        { label: 'Team', wert: String(zahlen.teamer), zusatz: ['Teamer:innen'] },
      ]}
      filter={[{
        beschriftung: BENUTZER_FILTER_BESCHRIFTUNG,
        wahlen: BENUTZER_FILTER,
        wert: filter,
        onWert: (w) => setFilter(w as BenutzerFilter),
        zahlen: true,
      }]}
      suche={{
        beschriftung: 'Benutzer:in suchen',
        platzhalter: 'Name, Benutzername, E-Mail …',
        wert: suche,
        onWert: setSuche,
        felder: (u) => [u.display_name, u.username, u.email, u.role_title, u.role_display_name, rollenName(u.role_name)],
      }}
      zaehlzeile={(n, gesamt) => `${n} von ${gesamt}`}
      ansicht={{ seite: 'benutzer', vorgabe: 'liste' }}
      eintraege={geordnet}
      liste={{
        beschriftung: 'Benutzer:innen',
        spalten,
        zeileSchluessel: (u) => u.id,
        zeileKlasse: (u) => (u.is_active ? undefined : 'web-zeile--gesperrt'),
        mittig: true,
        bearbeiten,
        loeschen,
      }}
      kacheln={{
        beschriftung: 'Benutzer:innen',
        schluessel: (u) => u.id,
        bearbeiten,
        loeschen,
        karte: (u) => ({
          akzent: rollenFarbeVar(u.role_name),
          symbol: <WebBildKarteSymbol text={initialen(u.display_name) || '??'} />,
          label: rollenName(u.role_name),
          titelImKopf: true,
          titel: <WebTreffer text={u.display_name} suche={suche} />,
          onTitel: darfBearbeitenBei(u) ? () => onBearbeiten(u) : undefined,
          titelBeschriftung: `${u.display_name} bearbeiten`,
          unterzeile: unterzeile(u),
          marken: <StatusMarken u={u} />,
          gedaempft: !u.is_active,
          angaben: [
            { icon: ICON_JAHRGANG, farbe: 'var(--app-color-jahrgang)', inhalt: jahrgaengeWort(u) ?? 'Kein Jahrgang' },
            { icon: ICON_UHRZEIT, inhalt: u.last_login_at ? `Zuletzt angemeldet ${datumKurz(u.last_login_at)}` : 'Noch nie angemeldet' },
          ],
        }),
      }}
      leer={{
        icon: ICON_PERSON,
        titel: BENUTZER_LEER.titel,
        text: sucht || filter !== 'alle' ? BENUTZER_LEER.keineTreffer : BENUTZER_LEER.niemand,
      }}
    >
      {darfVerwalten && <WebOffeneEinladungen aktualisierung={einladungenStand} />}
    </WebListenSeite>
  );
};

export default WebBenutzer;
