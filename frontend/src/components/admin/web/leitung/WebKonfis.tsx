// Konfis und Team der Leitung in der Web-Fassung, /admin/konfis (Browser ab
// 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6):
//
//   - Kopf mit Kennzahlen (Konfis, Punkte, Ziel erreicht, Jahrgaenge bzw.
//     Team, Zertifikate, Badges) und den Aktionen der Seite;
//   - Reiter "Konfis" / "Team" (auch ueber `?filter=team` in der Adresse zu
//     erreichen -- die Detailseite einer Teamer:in fuehrt dorthin zurueck);
//   - Suche (Umlaute wie in der Support-Ansicht: "mueller" findet "Müller"),
//     Jahrgang-Filter und Sortierung ueber die Spaltenkoepfe;
//   - der Umschalter Liste | Kacheln (eine Wahl fuer beide Reiter; die
//     Leitung startet mit der Liste): die Liste ist die Tabelle mit allen
//     Zeilen als Links auf die Detailseite, die Kacheln sind je eine Karte im
//     Raster. Filter, Suche und Sortierung gelten fuer beide; die Kacheln
//     haben keine Spaltenkoepfe und bekommen dafuer eine Auswahl "Sortieren",
//     die dieselbe Sortierung setzt.
//
// Rahmen, Werkzeugzeile, Sortierung und Zustaende stellt WebListenSeite
// (10.10.2026); hier stehen nur Spalten, Karten und Daten -- bis dahin lagen
// Tabelle und Kacheln je Reiter in eigenen Dateien (WebKonfiTabelle,
// WebKonfiKacheln, WebTeamTabelle, WebTeamKacheln).
//
// Punkte (Aktivitaet, Bonus) vergibt man auf der Detailseite der Konfi, nicht
// in der Liste (Simon, 06.10.2026).
//
// Daten, Rechte und Aktionen kommen von der Seite (AdminKonfisPage) und aus
// denselben Hooks wie in der App: Die Liste ist die der App (der Server filtert
// bei einer Leitung nach ihren Jahrgaengen), die Team-Liste laedt useTeamerListe,
// Anlegen, Loeschen und die Anwesenheit sind die Fenster und Rueckfragen der
// Seite. Neu ist nur die Darstellung.

import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_CHECKBOX,
  ICON_GRUPPE,
  ICON_HINZUFUEGEN,
  ICON_QRCODE,
  ICON_UHRZEIT,
} from '../../../shared/icons';
import { useApp } from '../../../../contexts/AppContext';
import TrialBanner from '../../../shared/TrialBanner';
import { suchbegriff } from '../../../../utils/supportWeb';
import { mitEinheit } from '../../../../utils/supportStatistik';
import { datumKurz } from '../../../../utils/dateUtils';
import {
  ERSTE_RICHTUNG,
  initialen,
  jahrgangVon,
  konfiPunkte,
  sichtbareJahrgaenge,
  sortiereKonfis,
  sortiereTeam,
  TEAM_ERSTE_RICHTUNG,
  teamerName,
  type KonfiListenEintrag,
  type KonfiSortierSchluessel,
  type TeamSortierSchluessel,
} from '../../../../utils/konfiListe';
import type { TeamerListenEintrag } from '../../../../types/user';
import { useTeamerListe } from '../../useTeamerListe';
import WebKnopf from '../../../web/WebKnopf';
import WebKreis from '../../../web/WebKreis';
import WebTreffer from '../../../web/WebTreffer';
import { WebBildKarteSymbol } from '../../../web/WebBildKarte';
import { KENNZAHL_SYMBOL } from '../../../web/kennzahlSymbole';
import WebListenSeite, { type WebListenSeiteProps, type WebListenSortierung } from '../../../web/WebListenSeite';
import { WebNameZelle, type WebSpalte } from '../../../web/WebListe';
import { useFilterAusAdresse } from '../../../web/useFilterAusAdresse';
import { ansichtVorgabe } from '../../../web/useAnsicht';
import { WebFortschritt, WebZahlMitSymbol } from './WebLeitungBausteine';
import { useSucheMessung } from '../../../../hooks/useSucheMessung';
import { schluesselIn } from '../../../../seiten/beschreibung';
import {
  KONFIS_ANSICHT,
  KONFIS_ANSICHT_BESCHRIFTUNG,
  KONFIS_JAHRGANG_FILTER,
  TEAM_LEER,
  konfisLeerText,
  type KonfisAnsichtSchluessel,
} from '../../../../seiten/konfisLeitung';

export type KonfisAnsicht = KonfisAnsichtSchluessel;
const ANSICHTEN: readonly KonfisAnsicht[] = schluesselIn(KONFIS_ANSICHT, 'web');

export interface WebKonfisProps {
  konfis: readonly KonfiListenEintrag[];
  jahrgaenge: ReadonlyArray<{ id: number; name: string }>;
  laedt: boolean;
  /** Der Server meldet: Diesem Konto ist kein Jahrgang zugewiesen. */
  ohneJahrgang: boolean;
  /** Fuer die Fenster, die auf dieser Seite aufklappen (useModalPage). */
  pageRef?: React.Ref<HTMLElement>;
  onKonfiAnlegen: () => void;
  onTeamAnlegen: () => void;
  onMatrix: () => void;
  onKonfiLoeschen: (konfi: KonfiListenEintrag) => void;
  onTeamerLoeschen: (teamer: TeamerListenEintrag) => void | Promise<void>;
  /** Hinweiskarten ueber der Liste (Neuerungen), Fenster der Seite (Tour). */
  banner?: React.ReactNode;
  overlays?: React.ReactNode;
}

const zahl = (n: number): string => n.toLocaleString('de-DE');

/**
 * Die Sortierungen, die sich ueber die Spaltenkoepfe der Tabelle einstellen
 * lassen -- als Auswahl fuer die Kacheln, die keine Spaltenkoepfe haben. Jede
 * Stellung der Koepfe steht hier, damit die Auswahl nach einem Wechsel
 * zwischen Liste und Kacheln dasselbe zeigt.
 */
const KONFI_SORTIERUNGEN: ReadonlyArray<{ schluessel: string; richtung: 'auf' | 'ab'; label: string }> = [
  { schluessel: 'name', richtung: 'auf', label: 'Name A–Z' },
  { schluessel: 'name', richtung: 'ab', label: 'Name Z–A' },
  { schluessel: 'punkte', richtung: 'ab', label: 'Meiste Punkte' },
  { schluessel: 'punkte', richtung: 'auf', label: 'Wenigste Punkte' },
  { schluessel: 'jahrgang', richtung: 'auf', label: 'Jahrgang A–Z' },
  { schluessel: 'jahrgang', richtung: 'ab', label: 'Jahrgang Z–A' },
  { schluessel: 'badges', richtung: 'ab', label: 'Meiste Badges' },
  { schluessel: 'badges', richtung: 'auf', label: 'Wenigste Badges' },
  { schluessel: 'gottesdienst', richtung: 'ab', label: 'Meiste Gottesdienst-Punkte' },
  { schluessel: 'gottesdienst', richtung: 'auf', label: 'Wenigste Gottesdienst-Punkte' },
  { schluessel: 'gemeinde', richtung: 'ab', label: 'Meiste Gemeinde-Punkte' },
  { schluessel: 'gemeinde', richtung: 'auf', label: 'Wenigste Gemeinde-Punkte' },
  // Nur, wenn die Liste die letzte Aktivitaet liefert (sonst fehlt auch die Spalte).
  { schluessel: 'aktivitaet', richtung: 'ab', label: 'Zuletzt aktiv' },
  { schluessel: 'aktivitaet', richtung: 'auf', label: 'Am längsten nicht aktiv' },
];

const TEAM_SORTIERUNGEN: ReadonlyArray<{ schluessel: string; richtung: 'auf' | 'ab'; label: string }> = [
  { schluessel: 'name', richtung: 'auf', label: 'Name A–Z' },
  { schluessel: 'name', richtung: 'ab', label: 'Name Z–A' },
  { schluessel: 'badges', richtung: 'ab', label: 'Meiste Badges' },
  { schluessel: 'badges', richtung: 'auf', label: 'Wenigste Badges' },
  { schluessel: 'zertifikate', richtung: 'ab', label: 'Meiste Zertifikate' },
  { schluessel: 'zertifikate', richtung: 'auf', label: 'Wenigste Zertifikate' },
  { schluessel: 'jahrgaenge', richtung: 'auf', label: 'Jahrgänge A–Z' },
  { schluessel: 'jahrgaenge', richtung: 'ab', label: 'Jahrgänge Z–A' },
  { schluessel: 'seit', richtung: 'ab', label: 'Zuletzt ins Team gekommen' },
  { schluessel: 'seit', richtung: 'auf', label: 'Am längsten im Team' },
];

const START = { schluessel: 'name', richtung: 'auf' } as const;
const TEAM_SORTIERUNG: WebListenSortierung<TeamerListenEintrag> = {
  start: START,
  sortiere: (liste, s) => sortiereTeam(liste, s.schluessel as TeamSortierSchluessel, s.richtung),
  ersteRichtung: (s) => TEAM_ERSTE_RICHTUNG[s as TeamSortierSchluessel] ?? 'auf',
  auswahl: TEAM_SORTIERUNGEN,
};

// --- Spalten und Karten -------------------------------------------------------------

/** Die Spalten der Konfi-Liste; "Letzte Aktivität" nur, wenn die Liste sie liefert. */
const konfiSpalten = (suche: string, mitAktivitaet: boolean): Array<WebSpalte<KonfiListenEintrag>> => [
  {
    schluessel: 'name',
    kopf: 'Name',
    sortierbar: true,
    zelle: (k) => (
      <WebNameZelle
        kreis={<WebKreis text={initialen(k.name)} ton={konfiPunkte(k).erreicht ? 'erreicht' : 'konfis'} />}
        titel={<WebTreffer text={k.name} suche={suche} />}
        href={`/admin/konfis/${k.id}`}
        unterzeile={k.username ? <WebTreffer text={k.username} suche={suche} /> : undefined}
      />
    ),
  },
  {
    schluessel: 'jahrgang',
    kopf: 'Jahrgang',
    sortierbar: true,
    breite: '14%',
    zelle: (k) => jahrgangVon(k) || <span className="web-gedaempft">Kein Jahrgang</span>,
  },
  {
    schluessel: 'gottesdienst',
    kopf: 'Gottesdienst',
    sortierbar: true,
    breite: '160px',
    optional: true,
    zelle: (k) => {
      const p = konfiPunkte(k);
      return <WebFortschritt wert={p.gottesdienst} ziel={p.zielGottesdienst} art="gottesdienst" name="Gottesdienst-Punkte" abgeschaltet={!p.gottesdienstAn} />;
    },
  },
  {
    schluessel: 'gemeinde',
    kopf: 'Gemeinde',
    sortierbar: true,
    breite: '160px',
    optional: true,
    zelle: (k) => {
      const p = konfiPunkte(k);
      return <WebFortschritt wert={p.gemeinde} ziel={p.zielGemeinde} art="gemeinde" name="Gemeinde-Punkte" abgeschaltet={!p.gemeindeAn} />;
    },
  },
  {
    schluessel: 'punkte',
    kopf: 'Gesamt',
    sortierbar: true,
    breite: '184px',
    zelle: (k) => {
      const p = konfiPunkte(k);
      return <WebFortschritt wert={p.gesamt} ziel={p.zielGesamt} art="gesamt" name="Punkte gesamt" prozent={p.prozentGesamt} />;
    },
  },
  {
    schluessel: 'badges',
    kopf: 'Badges',
    sortierbar: true,
    zahl: true,
    breite: '92px',
    optional: true,
    zelle: (k) => <WebZahlMitSymbol symbol={KENNZAHL_SYMBOL.badges} zahl={k.badgeCount || 0} title={`${k.badgeCount || 0} Badges`} />,
  },
  ...(mitAktivitaet ? [{
    schluessel: 'aktivitaet',
    kopf: 'Letzte Aktivität',
    sortierbar: true,
    breite: '128px',
    optional: true,
    zelle: (k: KonfiListenEintrag) => (k.letzte_aktivitaet ? datumKurz(k.letzte_aktivitaet) : <span className="web-gedaempft">–</span>),
  }] : []),
];

/**
 * Die Karte einer Konfi, gebaut wie die Challenge-Karte (Simon, 07.10.2026):
 * im Kopf Initialen, Jahrgang und Name -- gruen, wenn das Punkteziel erreicht
 * ist --, darunter Benutzername, die drei Balken, Badges und letzte Aktivitaet.
 */
const konfiKarte = (suche: string) => (k: KonfiListenEintrag) => {
  const p = konfiPunkte(k);
  return {
    akzent: p.erreicht ? 'var(--app-color-success)' : 'var(--app-color-konfis)',
    akzentDunkel: p.erreicht ? 'var(--app-color-success-strong)' : 'var(--app-color-konfis-dunkel)',
    symbol: <WebBildKarteSymbol text={initialen(k.name)} />,
    // Name im Kopf (Simon, 07.10.2026: „konfi name in den kopf").
    label: [jahrgangVon(k) || 'Kein Jahrgang', p.erreicht ? 'Ziel erreicht' : ''].filter(Boolean).join(' · '),
    titelImKopf: true,
    titel: <WebTreffer text={k.name} suche={suche} />,
    href: `/admin/konfis/${k.id}`,
    unterzeile: k.username ? <WebTreffer text={k.username} suche={suche} /> : undefined,
    angaben: [
      { ...KENNZAHL_SYMBOL.badges, inhalt: mitEinheit(k.badgeCount || 0, 'Badge', 'Badges') },
      k.letzte_aktivitaet && { icon: ICON_UHRZEIT, inhalt: `Zuletzt aktiv ${datumKurz(k.letzte_aktivitaet)}` },
    ],
    children: (
      <div className="web-personenkachel__balken">
        <WebFortschritt beschriftung="Gottesdienst" name="Gottesdienst-Punkte" art="gottesdienst" wert={p.gottesdienst} ziel={p.zielGottesdienst} abgeschaltet={!p.gottesdienstAn} />
        <WebFortschritt beschriftung="Gemeinde" name="Gemeinde-Punkte" art="gemeinde" wert={p.gemeinde} ziel={p.zielGemeinde} abgeschaltet={!p.gemeindeAn} />
        <WebFortschritt beschriftung="Gesamt" name="Punkte gesamt" art="gesamt" wert={p.gesamt} ziel={p.zielGesamt} prozent={p.prozentGesamt} />
      </div>
    ),
  };
};

const teamSpalten = (suche: string): Array<WebSpalte<TeamerListenEintrag>> => [
  {
    schluessel: 'name',
    kopf: 'Name',
    sortierbar: true,
    zelle: (t) => (
      <WebNameZelle
        kreis={<WebKreis text={initialen(teamerName(t)) || '??'} ton="teamer" />}
        titel={<WebTreffer text={teamerName(t)} suche={suche} />}
        href={`/admin/konfis/${t.id}`}
        unterzeile={t.username ? <WebTreffer text={t.username} suche={suche} /> : undefined}
      />
    ),
  },
  {
    schluessel: 'jahrgaenge',
    kopf: 'Jahrgänge',
    sortierbar: true,
    breite: '24%',
    zelle: (t) => t.jahrgang_name || <span className="web-gedaempft">Kein Jahrgang</span>,
  },
  {
    schluessel: 'badges',
    kopf: 'Badges',
    sortierbar: true,
    zahl: true,
    breite: '96px',
    zelle: (t) => <WebZahlMitSymbol symbol={KENNZAHL_SYMBOL.badges} zahl={t.badge_count || 0} title={`${t.badge_count || 0} Badges`} />,
  },
  {
    schluessel: 'zertifikate',
    kopf: 'Zertifikate',
    sortierbar: true,
    zahl: true,
    breite: '112px',
    zelle: (t) => <WebZahlMitSymbol symbol={KENNZAHL_SYMBOL.zertifikate} zahl={t.cert_count || 0} title={`${t.cert_count || 0} Zertifikate`} />,
  },
  {
    schluessel: 'seit',
    kopf: 'Im Team seit',
    sortierbar: true,
    breite: '120px',
    optional: true,
    zelle: (t) => (t.teamer_since ? String(new Date(t.teamer_since).getFullYear()) : <span className="web-gedaempft">–</span>),
  },
];

/** Die Karte einer Teamer:in: was die Team-Tabelle zeigt, im Kopf "im Team seit". */
const teamKarte = (suche: string) => (t: TeamerListenEintrag) => ({
  akzent: 'var(--app-color-teamer)',
  akzentDunkel: 'var(--app-color-teamer-dunkel)',
  symbol: <WebBildKarteSymbol text={initialen(teamerName(t)) || '??'} />,
  label: t.teamer_since ? `Teamer:in · im Team seit ${new Date(t.teamer_since).getFullYear()}` : 'Teamer:in',
  titelImKopf: true,
  titel: <WebTreffer text={teamerName(t)} suche={suche} />,
  href: `/admin/konfis/${t.id}`,
  unterzeile: t.username ? <WebTreffer text={t.username} suche={suche} /> : undefined,
  angaben: [
    { icon: ICON_GRUPPE, inhalt: t.jahrgang_name || 'Kein Jahrgang' },
    { ...KENNZAHL_SYMBOL.badges, inhalt: mitEinheit(t.badge_count || 0, 'Badge', 'Badges') },
    { ...KENNZAHL_SYMBOL.zertifikate, inhalt: mitEinheit(t.cert_count || 0, 'Zertifikat', 'Zertifikate') },
  ],
});

// --- Seite -----------------------------------------------------------------------------

const WebKonfis: React.FC<WebKonfisProps> = ({
  konfis, jahrgaenge, laedt, ohneJahrgang, pageRef,
  onKonfiAnlegen, onTeamAnlegen, onMatrix, onKonfiLoeschen, onTeamerLoeschen, banner, overlays,
}) => {
  const { user } = useApp();
  const rolle = user?.role_name ?? '';
  // Dieselben Regeln wie in der App: Anlegen und Anwesenheit fuer Leitung und
  // Gemeindeleitung, Einladen fuer die Gemeindeleitung, Teamer:innen loeschen
  // nur die Gemeindeleitung (DELETE /users/:id verlangt requireOrgAdmin).
  const darfVerwalten = rolle === 'org_admin' || rolle === 'admin';
  const istGemeindeleitung = rolle === 'org_admin';
  const darfTeamLoeschen = rolle === 'org_admin' || user?.is_super_admin === true;

  const [ansicht, setAnsicht] = useFilterAusAdresse<KonfisAnsicht>('/admin/konfis', ANSICHTEN, 'konfis');
  const [suche, setSuche] = useState('');
  // Anonyme Messung (docs/messung/umami.md, S15): wird gesucht? Nie der Begriff.
  useSucheMessung(ansicht === 'team' ? 'team' : 'konfis', suche);
  const [jahrgang, setJahrgang] = useState('alle');

  const team = useTeamerListe(ansicht === 'team');

  // Die Jahrgaenge dieses Kontos: die Gemeindeleitung alle, eine Leitung ihre zugewiesenen.
  const meineJahrgaenge = useMemo(() => sichtbareJahrgaenge(jahrgaenge, user), [jahrgaenge, user]);
  const sucht = suchbegriff(suche) !== '';
  const istTeam = ansicht === 'team';

  const konfiKennzahlen = useMemo(() => ({
    punkteSumme: konfis.reduce((s, k) => s + konfiPunkte(k).gesamt, 0),
    erreicht: konfis.filter((k) => konfiPunkte(k).erreicht).length,
  }), [konfis]);

  // "Letzte Aktivitaet" gibt es als Spalte nur, wenn die Liste sie liefert -- dann auch in der Auswahl.
  const mitAktivitaet = konfis.some((k) => !!k.letzte_aktivitaet);
  const konfiSortierung = useMemo<WebListenSortierung<KonfiListenEintrag>>(() => ({
    start: START,
    sortiere: (liste, s) => sortiereKonfis(liste, s.schluessel as KonfiSortierSchluessel, s.richtung),
    ersteRichtung: (s) => ERSTE_RICHTUNG[s as KonfiSortierSchluessel] ?? 'auf',
    auswahl: mitAktivitaet ? KONFI_SORTIERUNGEN : KONFI_SORTIERUNGEN.filter((s) => s.schluessel !== 'aktivitaet'),
  }), [mitAktivitaet]);

  const aktionen = darfVerwalten ? (
    <>
      <WebKnopf onClick={onMatrix}>
        <IonIcon icon={ICON_CHECKBOX} aria-hidden="true" />
        Anwesenheit
      </WebKnopf>
      {istGemeindeleitung && !istTeam && (
        <WebKnopf href="/admin/settings/invite">
          <IonIcon icon={ICON_QRCODE} aria-hidden="true" />
          Konfis einladen
        </WebKnopf>
      )}
      <WebKnopf art="primaer" onClick={istTeam ? onTeamAnlegen : onKonfiAnlegen}>
        <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
        {istTeam ? 'Teamer:in anlegen' : 'Konfi anlegen'}
      </WebKnopf>
    </>
  ) : undefined;

  const untertitel = istTeam
    ? (team.laedt && team.teamers.length === 0 ? 'Das Team wird geladen' : `${mitEinheit(team.teamers.length, 'Person', 'Personen')} im Team`)
    : `${mitEinheit(konfis.length, 'Konfi', 'Konfis')} in ${mitEinheit(meineJahrgaenge.length, 'Jahrgang', 'Jahrgängen')}`;

  // Die Zahl am Reiter "Team" steht erst da, wenn die Liste einmal geladen ist.
  const teamGeladen = team.geladen && !team.fehler;

  // Was beide Reiter gemeinsam haben: Kopf, Reiter, Ansicht.
  const gemeinsam = {
    bereich: 'Verwaltung',
    titel: laedt ? 'Konfis' : istTeam ? 'Team' : 'Konfis',
    untertitel: laedt ? undefined : untertitel,
    aktionen: laedt ? undefined : aktionen,
    pageRef,
    wartung: true,
    laden: laedt ? { text: 'Die Konfis werden geladen.', kacheln: 4, karten: 1 } : undefined,
    oben: <><TrialBanner style={{ margin: 0 }} />{banner}</>,
    reiter: {
      beschriftung: KONFIS_ANSICHT_BESCHRIFTUNG,
      wahlen: KONFIS_ANSICHT,
      wert: ansicht,
      onWert: (a: KonfisAnsicht) => { setAnsicht(a); setSuche(''); },
      zahlen: { konfis: konfis.length, team: teamGeladen ? team.teamers.length : undefined },
    },
    // Liste oder Kacheln: eine Wahl fuer beide Reiter, im Browser gemerkt; die Leitung beginnt mit der Liste.
    ansicht: { seite: 'konfis', vorgabe: ansichtVorgabe(rolle) },
    children: overlays,
  } satisfies Partial<WebListenSeiteProps<unknown, KonfisAnsicht>>;

  if (istTeam) {
    const loeschen = darfTeamLoeschen ? {
      onKlick: async (t: TeamerListenEintrag) => { await onTeamerLoeschen(t); await team.laden(); },
      beschriftung: (t: TeamerListenEintrag) => `${teamerName(t)} löschen`,
      titel: () => 'Teamer:in löschen',
    } : undefined;
    return (
      <WebListenSeite<TeamerListenEintrag, KonfisAnsicht>
        {...gemeinsam}
        kennzahlen={[
          { symbol: KENNZAHL_SYMBOL.team, label: 'Team', wert: zahl(team.teamers.length) },
          { symbol: KENNZAHL_SYMBOL.zertifikate, label: 'Zertifikate', wert: zahl(team.teamers.reduce((s, t) => s + (t.cert_count || 0), 0)) },
          { symbol: KENNZAHL_SYMBOL.badges, label: 'Badges', wert: zahl(team.teamers.reduce((s, t) => s + (t.badge_count || 0), 0)) },
        ]}
        suche={{ beschriftung: 'Im Team suchen', platzhalter: 'Im Team suchen …', wert: suche, onWert: setSuche, felder: (t) => [teamerName(t), t.name, t.username] }}
        zaehlzeile={(n, gesamt) => `${n} von ${gesamt} im Team`}
        eintraege={team.teamers}
        sortierung={TEAM_SORTIERUNG}
        liste={{ beschriftung: 'Team', spalten: teamSpalten(suche), zeileSchluessel: (t) => t.id, mittig: true, fest: true, loeschen }}
        kacheln={{ beschriftung: 'Team', schluessel: (t) => t.id, karte: teamKarte(suche), loeschen }}
        leer={{ icon: ICON_GRUPPE, titel: TEAM_LEER.titel, text: sucht ? TEAM_LEER.keineTreffer : TEAM_LEER.keinTeam }}
        inhaltLaden={team.laedt && team.teamers.length === 0 ? 'Das Team wird geladen.' : undefined}
        inhaltFehler={team.fehler && team.teamers.length === 0 ? { text: 'Das Team konnte nicht geladen werden.', onErneut: () => { void team.laden(); } } : undefined}
      />
    );
  }

  const loeschen = darfVerwalten ? {
    onKlick: onKonfiLoeschen,
    beschriftung: (k: KonfiListenEintrag) => `${k.name} löschen`,
    titel: () => 'Konfi löschen',
  } : undefined;
  const keinJahrgang = ohneJahrgang && !sucht;
  // Dieselben Saetze wie in der App (seiten/konfisLeitung.ts).
  const leer = konfisLeerText({ sucht, ohneJahrgang, jahrgangGewaehlt: jahrgang !== 'alle' });

  return (
    <WebListenSeite<KonfiListenEintrag, KonfisAnsicht>
      {...gemeinsam}
      kennzahlen={[
        { symbol: KENNZAHL_SYMBOL.konfis, label: 'Konfis', wert: zahl(konfis.length), zusatz: [mitEinheit(meineJahrgaenge.length, 'Jahrgang', 'Jahrgänge')] },
        { symbol: KENNZAHL_SYMBOL.punkte, label: 'Punkte gesamt', wert: zahl(konfiKennzahlen.punkteSumme) },
        {
          symbol: KENNZAHL_SYMBOL.zielErreicht,
          label: 'Ziel erreicht',
          wert: zahl(konfiKennzahlen.erreicht),
          zusatz: [konfis.length > 0 ? `von ${zahl(konfis.length)} Konfis` : 'noch niemand'],
        },
        { symbol: KENNZAHL_SYMBOL.jahrgaenge, label: 'Jahrgänge', wert: zahl(meineJahrgaenge.length) },
      ]}
      suche={{ beschriftung: 'Konfi suchen', platzhalter: 'Name oder Benutzername …', wert: suche, onWert: setSuche, felder: (k) => [k.name, k.username] }}
      filter={[{
        beschriftung: KONFIS_JAHRGANG_FILTER.label,
        darstellung: 'auswahl',
        wahlen: [
          { schluessel: 'alle', label: KONFIS_JAHRGANG_FILTER.alle },
          ...meineJahrgaenge.map((j) => ({ schluessel: j.name, label: j.name, passt: (k: KonfiListenEintrag) => jahrgangVon(k) === j.name })),
        ],
        wert: jahrgang,
        onWert: setJahrgang,
      }]}
      zaehlzeile={(n, gesamt) => `${n} von ${gesamt} Konfis`}
      eintraege={konfis}
      sortierung={konfiSortierung}
      liste={{ beschriftung: 'Konfis', spalten: konfiSpalten(suche, mitAktivitaet), zeileSchluessel: (k) => k.id, mittig: true, fest: true, loeschen }}
      kacheln={{ beschriftung: 'Konfis', schluessel: (k) => k.id, karte: konfiKarte(suche), loeschen }}
      leer={{
        icon: ICON_GRUPPE,
        titel: leer.titel,
        text: leer.text,
        aktion: !sucht && !keinJahrgang && darfVerwalten && konfis.length === 0
          ? <WebKnopf art="primaer" onClick={onKonfiAnlegen}>Konfi anlegen</WebKnopf>
          : undefined,
      }}
    />
  );
};

export default WebKonfis;
