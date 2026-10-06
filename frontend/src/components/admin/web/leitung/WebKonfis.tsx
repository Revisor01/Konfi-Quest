// Konfis und Team der Leitung in der Web-Fassung, /admin/konfis (Browser ab
// 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6):
//
//   - Kopf mit Kennzahlen (Konfis, Punkte, Ziel erreicht, Jahrgaenge bzw.
//     Team, Zertifikate, Badges) und den Aktionen der Seite;
//   - Reiter "Konfis" / "Team" (auch ueber `?filter=team` in der Adresse zu
//     erreichen -- die Detailseite einer Teamer:in fuehrt dorthin zurueck);
//   - Suche (Umlaute wie in der Support-Ansicht: "mueller" findet "Müller"),
//     Jahrgang-Filter und Sortierung ueber die Spaltenkoepfe;
//   - die Tabelle mit allen Zeilen als Links auf die Detailseite.
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
} from '../../../shared/icons';
import { useApp } from '../../../../contexts/AppContext';
import TrialBanner from '../../../shared/TrialBanner';
import { suchTreffer, suchbegriff } from '../../../../utils/supportWeb';
import { mitEinheit } from '../../../../utils/supportStatistik';
import {
  ERSTE_RICHTUNG,
  jahrgangVon,
  konfiPunkte,
  sichtbareJahrgaenge,
  sortiereKonfis,
  teamerName,
  type KonfiListenEintrag,
  type KonfiSortierSchluessel,
} from '../../../../utils/konfiListe';
import type { TeamerListenEintrag } from '../../../../types/user';
import { useTeamerListe } from '../../useTeamerListe';
import WebSeite from '../../../web/WebSeite';
import WebKnopf from '../../../web/WebKnopf';
import WebKachel from '../../../web/WebKachel';
import WebChips from '../../../web/WebChips';
import WebSuche from '../../../web/WebSuche';
import WebDialog from '../../../web/WebDialog';
import { WebFehler, WebLaden, WebLeer } from '../../../web/WebZustaende';
import { useFilterAusAdresse } from '../../../web/useFilterAusAdresse';
import type { WebSortierung } from './WebSortTabelle';
import WebKonfiTabelle from './WebKonfiTabelle';
import WebTeamTabelle from './WebTeamTabelle';
import { WebFilterAuswahl } from './WebLeitungBausteine';
import { usePunkteVergeben } from './usePunkteVergeben';

export type KonfisAnsicht = 'konfis' | 'team';
const ANSICHTEN: readonly KonfisAnsicht[] = ['konfis', 'team'];

export interface WebKonfisProps {
  konfis: readonly KonfiListenEintrag[];
  jahrgaenge: ReadonlyArray<{ id: number; name: string }>;
  laedt: boolean;
  /** Der Server meldet: Diesem Konto ist kein Jahrgang zugewiesen. */
  ohneJahrgang: boolean;
  /** Fuer die Fenster, die auf dieser Seite aufklappen (useModalPage). */
  pageRef?: React.Ref<HTMLElement>;
  presentingElement?: HTMLElement | null;
  /** Nach dem Vergeben von Punkten: die Liste neu laden. */
  onNeuLaden: () => void | Promise<void>;
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

const WebKonfis: React.FC<WebKonfisProps> = ({
  konfis, jahrgaenge, laedt, ohneJahrgang, pageRef, presentingElement, onNeuLaden,
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
  const [jahrgang, setJahrgang] = useState('alle');
  const [konfiSortierung, setKonfiSortierung] = useState<WebSortierung>({ schluessel: 'name', richtung: 'auf' });
  const [teamSortierung, setTeamSortierung] = useState<WebSortierung>({ schluessel: 'name', richtung: 'auf' });
  const [punkteFuer, setPunkteFuer] = useState<KonfiListenEintrag | null>(null);

  const team = useTeamerListe(ansicht === 'team');
  const punkte = usePunkteVergeben({ presentingElement, onGespeichert: onNeuLaden });

  // Die Jahrgaenge dieses Kontos: die Gemeindeleitung alle, eine Leitung ihre zugewiesenen.
  const meineJahrgaenge = useMemo(() => sichtbareJahrgaenge(jahrgaenge, user), [jahrgaenge, user]);

  const sucht = suchbegriff(suche) !== '';

  // --- Konfis ---------------------------------------------------------------------
  const sichtbareKonfis = useMemo(() => {
    const gefiltert = konfis.filter((k) =>
      (jahrgang === 'alle' || jahrgangVon(k) === jahrgang)
      && (!sucht || [k.name, k.username].some((t) => !!t && suchTreffer(t, suche).length > 0)));
    return sortiereKonfis(gefiltert, konfiSortierung.schluessel as KonfiSortierSchluessel, konfiSortierung.richtung);
  }, [konfis, jahrgang, suche, sucht, konfiSortierung]);

  const konfiKennzahlen = useMemo(() => {
    const punkteSumme = konfis.reduce((s, k) => s + konfiPunkte(k).gesamt, 0);
    const erreicht = konfis.filter((k) => konfiPunkte(k).erreicht).length;
    return { punkteSumme, erreicht };
  }, [konfis]);

  // --- Team -----------------------------------------------------------------------
  const sichtbaresTeam = useMemo(() => {
    const gefiltert = team.teamers.filter((t) => !sucht || [teamerName(t), t.name, t.username].some((x) => !!x && suchTreffer(x, suche).length > 0));
    const vorzeichen = teamSortierung.richtung === 'auf' ? 1 : -1;
    const wert = (t: TeamerListenEintrag): number => (teamSortierung.schluessel === 'badges' ? t.badge_count || 0 : t.cert_count || 0);
    return [...gefiltert].sort((a, b) => {
      if (teamSortierung.schluessel === 'badges' || teamSortierung.schluessel === 'zertifikate') {
        const d = wert(a) - wert(b);
        if (d !== 0) return d * vorzeichen;
        return teamerName(a).localeCompare(teamerName(b), 'de');
      }
      return teamerName(a).localeCompare(teamerName(b), 'de') * vorzeichen;
    });
  }, [team.teamers, suche, sucht, teamSortierung]);

  const sortieren = (
    aktuell: WebSortierung,
    setzen: (s: WebSortierung) => void,
    ersteRichtung: (schluessel: string) => 'auf' | 'ab',
  ) => (schluessel: string) => {
    if (aktuell.schluessel === schluessel) setzen({ schluessel, richtung: aktuell.richtung === 'auf' ? 'ab' : 'auf' });
    else setzen({ schluessel, richtung: ersteRichtung(schluessel) });
  };
  const sortiereKonfisNach = sortieren(konfiSortierung, setKonfiSortierung, (s) => ERSTE_RICHTUNG[s as KonfiSortierSchluessel] ?? 'auf');
  const sortiereTeamNach = sortieren(teamSortierung, setTeamSortierung, (s) => (s === 'name' ? 'auf' : 'ab'));

  const istTeam = ansicht === 'team';
  const titel = istTeam ? 'Team' : 'Konfis';

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

  if (laedt) {
    return (
      <WebSeite bereich="Verwaltung" titel="Konfis" pageRef={pageRef} wartung>
        <WebLaden kacheln={4} karten={1} text="Die Konfis werden geladen." />
      </WebSeite>
    );
  }

  // Die Zahl am Reiter "Team" steht erst da, wenn die Liste einmal geladen ist.
  const teamGeladen = team.geladen && !team.fehler;
  const chips = [
    { wert: 'konfis' as const, label: 'Konfis', zahl: konfis.length },
    { wert: 'team' as const, label: 'Team', zahl: teamGeladen ? team.teamers.length : undefined },
  ];

  const kacheln = istTeam ? (
    <>
      <WebKachel label="Team" wert={zahl(team.teamers.length)} />
      <WebKachel label="Zertifikate" wert={zahl(team.teamers.reduce((s, t) => s + (t.cert_count || 0), 0))} />
      <WebKachel label="Badges" wert={zahl(team.teamers.reduce((s, t) => s + (t.badge_count || 0), 0))} />
    </>
  ) : (
    <>
      <WebKachel label="Konfis" wert={zahl(konfis.length)} zusatz={[mitEinheit(meineJahrgaenge.length, 'Jahrgang', 'Jahrgänge')]} />
      <WebKachel label="Punkte gesamt" wert={zahl(konfiKennzahlen.punkteSumme)} />
      <WebKachel
        label="Ziel erreicht"
        wert={zahl(konfiKennzahlen.erreicht)}
        zusatz={[konfis.length > 0 ? `von ${zahl(konfis.length)} Konfis` : 'noch niemand']}
      />
      <WebKachel label="Jahrgänge" wert={zahl(meineJahrgaenge.length)} />
    </>
  );

  // --- Inhalt der Karte -------------------------------------------------------------
  let inhalt: React.ReactNode;
  if (istTeam) {
    if (team.laedt && team.teamers.length === 0) {
      inhalt = <WebLaden karten={1} text="Das Team wird geladen." />;
    } else if (team.fehler && team.teamers.length === 0) {
      inhalt = <WebFehler text="Das Team konnte nicht geladen werden." onErneut={() => { void team.laden(); }} />;
    } else if (sichtbaresTeam.length === 0) {
      inhalt = (
        <WebLeer
          icon={ICON_GRUPPE}
          titel="Niemand im Team gefunden"
          text={sucht ? 'Versuche andere Suchbegriffe.' : 'Noch niemand im Team.'}
        />
      );
    } else {
      inhalt = (
        <WebTeamTabelle
          team={sichtbaresTeam}
          suche={suche}
          sortierung={teamSortierung}
          onSortieren={sortiereTeamNach}
          onLoeschen={darfTeamLoeschen
            ? async (t) => { await onTeamerLoeschen(t); await team.laden(); }
            : undefined}
        />
      );
    }
  } else if (sichtbareKonfis.length === 0) {
    const keinJahrgang = ohneJahrgang && !sucht;
    inhalt = (
      <WebLeer
        icon={ICON_GRUPPE}
        titel={keinJahrgang ? 'Kein Jahrgang zugewiesen' : 'Keine Konfis gefunden'}
        text={sucht
          ? 'Versuche andere Suchbegriffe.'
          : keinJahrgang
            // Derselbe Wortlaut wie in der App: Es gibt Konfis, dieser Zugang darf sie nur nicht sehen.
            ? 'Dir ist noch kein Jahrgang zugewiesen. Die Gemeindeleitung kann das in den Einstellungen ändern.'
            : jahrgang !== 'alle' ? 'In diesem Jahrgang gibt es noch keine Konfis.' : 'Noch keine Konfis angelegt.'}
        aktion={!sucht && !keinJahrgang && darfVerwalten && konfis.length === 0
          ? <WebKnopf art="primaer" onClick={onKonfiAnlegen}>Konfi anlegen</WebKnopf>
          : undefined}
      />
    );
  } else {
    inhalt = (
      <WebKonfiTabelle
        konfis={sichtbareKonfis}
        suche={suche}
        sortierung={konfiSortierung}
        onSortieren={sortiereKonfisNach}
        onPunkte={darfVerwalten ? setPunkteFuer : undefined}
        onLoeschen={darfVerwalten ? onKonfiLoeschen : undefined}
      />
    );
  }

  const zaehlzeile = istTeam
    ? (sucht ? `${sichtbaresTeam.length} von ${team.teamers.length} im Team` : undefined)
    : (sucht || jahrgang !== 'alle' ? `${sichtbareKonfis.length} von ${konfis.length} Konfis` : undefined);

  return (
    <WebSeite bereich="Verwaltung" titel={titel} untertitel={untertitel} aktionen={aktionen} pageRef={pageRef} wartung>
      <TrialBanner style={{ margin: 0 }} />
      {banner}

      <div className="web-raster web-raster--kacheln">{kacheln}</div>

      <div className="web-werkzeuge">
        <WebChips<KonfisAnsicht> beschriftung="Ansicht" chips={chips} wert={ansicht} onWert={(a) => { setAnsicht(a); setSuche(''); }} />
        <WebSuche
          beschriftung={istTeam ? 'Im Team suchen' : 'Konfi suchen'}
          platzhalter={istTeam ? 'Im Team suchen …' : 'Name oder Benutzername …'}
          wert={suche}
          onWert={setSuche}
        />
        {!istTeam && (
          <WebFilterAuswahl
            label="Jahrgang"
            wert={jahrgang}
            onWert={setJahrgang}
            optionen={[{ wert: 'alle', label: 'Alle Jahrgänge' }, ...meineJahrgaenge.map((j) => ({ wert: j.name, label: j.name }))]}
          />
        )}
        {zaehlzeile && <span className="web-gedaempft web-werkzeuge__zahl" role="status">{zaehlzeile}</span>}
      </div>

      <div className="web-karte">{inhalt}</div>

      {punkteFuer && (
        <WebDialog
          titel={`Punkte an ${punkteFuer.name} vergeben`}
          beschreibung="Eine Aktivität aus der Liste eintragen oder Bonuspunkte mit eigener Begründung geben."
          onSchliessen={() => setPunkteFuer(null)}
          aktionen={<WebKnopf onClick={() => setPunkteFuer(null)}>Abbrechen</WebKnopf>}
        >
          <div className="web-wahlkarten">
            <button type="button" className="web-wahlkarte" onClick={() => { const k = punkteFuer; setPunkteFuer(null); punkte.oeffnen(k, 'aktivitaet'); }}>
              <span className="web-wahlkarte__titel">Aktivität eintragen</span>
              <span className="web-wahlkarte__text">Eine Aktivität mit festem Punktwert, zum Beispiel einen Gottesdienstbesuch.</span>
            </button>
            <button type="button" className="web-wahlkarte" onClick={() => { const k = punkteFuer; setPunkteFuer(null); punkte.oeffnen(k, 'bonus'); }}>
              <span className="web-wahlkarte__titel">Bonuspunkte vergeben</span>
              <span className="web-wahlkarte__text">Punkte mit eigener Begründung, unabhängig von den Aktivitäten.</span>
            </button>
          </div>
        </WebDialog>
      )}

      {overlays}
    </WebSeite>
  );
};

export default WebKonfis;
