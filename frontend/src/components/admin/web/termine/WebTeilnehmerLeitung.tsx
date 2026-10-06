// Teilnehmende eines Events als Tabelle -- Konfis, Team oder Warteliste -- mit
// Anwesenheit und Aktionen (Web-Fassung des Termin-Details der Leitung,
// 03.10.2026).
//
// Jede Zeile traegt Status und Hinweise (Abmeldegrund, Notiz, wer es
// eingetragen hat -- dieselben Zeilen wie die Liste der App) und die Aktionen:
// "Anwesend" und "Abwesend" verbuchen mit einem Klick (ein zweiter Klick
// nimmt den Eintrag zurueck), "Mehr" oeffnet Abmeldung, Notiz, Warteliste und
// Entfernen. Gebaut werden sie von den Funktionen der Seite (EventDetailView):
// dieselben Rueckfragen, Modale und Routen wie in der App.

import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_ABSAGE,
  ICON_HAKEN_GEFUELLT,
  ICON_LOESCHEN,
  ICON_MEHR,
  ICON_PERSON_HINZUFUEGEN,
  ICON_RUECKGAENGIG,
  ICON_ZUSAGE_GEFUELLT,
} from '../../../shared/icons';
import { formatEventTime } from '../../../shared/eventFormatting';
import { teilnahmeDarstellung, type TeilnahmeDarstellung } from '../../../../utils/teilnahmeStatus';
import type { PillTon } from '../../../../utils/supportWeb';
import type { Participant } from '../../../../types/event';
import WebKarte from '../../../web/WebKarte';
import WebKnopf from '../../../web/WebKnopf';
import WebPill from '../../../web/WebPill';
import WebDialog from '../../../web/WebDialog';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import { WebTeilnahmeHinweise } from '../../../shared/web/termine/WebTerminBausteine';
import '../../../../theme/web/termine.css';

const TON: Record<TeilnahmeDarstellung['farbe'], PillTon> = {
  danger: 'fehler',
  neutral: 'neutral',
  success: 'erfolg',
  warning: 'warnung',
  info: 'info',
};

export interface TeilnehmerAktionen {
  /** Anwesend, abwesend -- oder null: den Eintrag zuruecksetzen. */
  anwesenheit: (person: Participant, status: 'present' | 'absent' | null) => void;
  /** Abmeldung eintragen oder bearbeiten (Fenster mit Grund und Notiz). */
  abmeldung: (person: Participant) => void;
  notiz: (person: Participant) => void;
  /** Eine wartende Person bestaetigen. */
  bestaetigen: (person: Participant) => void;
  aufWarteliste: (person: Participant) => void;
  entfernen: (person: Participant) => void;
}

export interface WebTeilnehmerLeitungProps {
  titel: string;
  untertitel?: string;
  teilnehmende: readonly Participant[];
  /** Die Warteliste hat eigene Aktionen: bestaetigen oder entfernen. */
  warteliste?: boolean;
  /** Zeigt die Zeitfenster-Spalte (Events mit Zeitfenstern). */
  mitZeitfenster: boolean;
  /** Pflicht-Event: Konfis lassen sich nicht entfernen oder auf die Warteliste setzen. */
  pflicht: boolean;
  darfVerwalten: boolean;
  isOnline: boolean;
  aktionen: TeilnehmerAktionen;
  /** "Alle bestaetigen (n)": die offenen Eintraege als anwesend verbuchen. */
  alleBestaetigen?: { anzahl: number; onClick: () => void };
  /** "Konfi hinzufuegen" und Co. */
  hinzufuegen?: ReadonlyArray<{ label: string; onClick: () => void }>;
  /** Text, wenn die Tabelle leer waere. */
  leerText?: string;
}

const istLeitung = (p: Participant) => p.role_name === 'admin' || p.role_name === 'org_admin';

const WebTeilnehmerLeitung: React.FC<WebTeilnehmerLeitungProps> = ({
  titel, untertitel, teilnehmende, warteliste = false, mitZeitfenster, pflicht, darfVerwalten, isOnline, aktionen, alleBestaetigen, hinzufuegen, leerText,
}) => {
  const [menuFuer, setMenuFuer] = useState<Participant | null>(null);
  const offlineHinweis = isOnline ? undefined : 'Ohne Internetverbindung nicht möglich';

  const spalten: Array<WebSpalte<Participant>> = [
    {
      schluessel: 'name',
      kopf: 'Name',
      breite: '30%',
      zelle: (p) => (
        <>
          <span className="web-zelle-titel">{p.participant_name}</span>
          {istLeitung(p)
            ? <span className="web-zelle-leise">Leitung</span>
            : p.jahrgang_name && <span className="web-zelle-leise">{p.jahrgang_name}</span>}
        </>
      ),
    },
  ];

  if (mitZeitfenster) {
    spalten.push({
      schluessel: 'zeitfenster',
      kopf: 'Zeitfenster',
      breite: '128px',
      zelle: (p) => (p.timeslot_start_time && p.timeslot_end_time
        ? `${formatEventTime(p.timeslot_start_time)} – ${formatEventTime(p.timeslot_end_time)}`
        : <span className="web-gedaempft">–</span>),
    });
  }

  spalten.push({
    schluessel: 'status',
    kopf: 'Status',
    zelle: (p) => {
      const d = teilnahmeDarstellung(p);
      return (
        <>
          <span><WebPill ton={TON[d.farbe]} punkt>{d.statusText}</WebPill></span>
          <WebTeilnahmeHinweise person={p} />
        </>
      );
    },
  });

  if (darfVerwalten) {
    spalten.push({
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      breite: '300px',
      klasse: 'web-spalte-termin-aktionen',
      zelle: (p) => {
        if (warteliste || p.status === 'waitlist') {
          return (
            <div className="web-termin-aktionen">
              <WebKnopf klein disabled={!isOnline} title={offlineHinweis} aria-label={`${p.participant_name} bestätigen`} onClick={() => aktionen.bestaetigen(p)}>
                <IonIcon icon={ICON_HAKEN_GEFUELLT} aria-hidden="true" />
                Bestätigen
              </WebKnopf>
              <WebKnopf klein symbol art="gefahr" disabled={!isOnline} title={offlineHinweis ?? 'Von der Warteliste entfernen'} aria-label={`${p.participant_name} entfernen`} onClick={() => aktionen.entfernen(p)}>
                <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
              </WebKnopf>
            </div>
          );
        }
        const anwesend = p.attendance_status === 'present';
        const abwesend = p.attendance_status === 'absent';
        return (
          <div className="web-termin-aktionen">
            <div className="web-umschalter" role="group" aria-label={`Anwesenheit von ${p.participant_name}`}>
              <button
                type="button"
                className="web-knopf web-knopf--klein web-umschalter__knopf"
                aria-pressed={anwesend}
                disabled={!isOnline}
                title={offlineHinweis ?? (anwesend ? 'Eintrag zurücksetzen' : 'Als anwesend verbuchen')}
                onClick={() => aktionen.anwesenheit(p, anwesend ? null : 'present')}
              >
                <IonIcon icon={ICON_ZUSAGE_GEFUELLT} aria-hidden="true" />
                Anwesend
              </button>
              <button
                type="button"
                className="web-knopf web-knopf--klein web-umschalter__knopf"
                aria-pressed={abwesend}
                disabled={!isOnline}
                title={offlineHinweis ?? (abwesend ? 'Eintrag zurücksetzen' : 'Als abwesend verbuchen')}
                onClick={() => aktionen.anwesenheit(p, abwesend ? null : 'absent')}
              >
                <IonIcon icon={ICON_ABSAGE} aria-hidden="true" />
                Abwesend
              </button>
            </div>
            <WebKnopf klein symbol aria-label={`Weitere Aktionen für ${p.participant_name}`} title="Weitere Aktionen" onClick={() => setMenuFuer(p)}>
              <IonIcon icon={ICON_MEHR} aria-hidden="true" />
            </WebKnopf>
          </div>
        );
      },
    });
  }

  const kopfAktion = (alleBestaetigen || (hinzufuegen && hinzufuegen.length > 0)) ? (
    <span className="web-termin-aktionen">
      {alleBestaetigen && (
        <WebKnopf klein disabled={!isOnline} title={offlineHinweis} onClick={alleBestaetigen.onClick}>
          <IonIcon icon={ICON_HAKEN_GEFUELLT} aria-hidden="true" />
          Alle bestätigen ({alleBestaetigen.anzahl})
        </WebKnopf>
      )}
      {hinzufuegen?.map((h) => (
        <WebKnopf key={h.label} klein onClick={h.onClick}>
          <IonIcon icon={ICON_PERSON_HINZUFUEGEN} aria-hidden="true" />
          {h.label}
        </WebKnopf>
      ))}
    </span>
  ) : undefined;

  // Was im Menue steht, haengt an der Person -- dieselben Eintraege wie das Aktionsmenue der App.
  const menue = menuFuer && (() => {
    const p = menuFuer;
    const hatEintrag = !!p.attendance_status;
    const darfEntfernen = p.role_name !== 'konfi' || !pflicht;
    const schliesseUnd = (aktion: () => void) => () => { setMenuFuer(null); aktion(); };
    return (
      <WebDialog titel={p.participant_name} beschreibung="Anwesenheit verwalten" onSchliessen={() => setMenuFuer(null)}>
        <div className="web-menue">
          <WebKnopf onClick={schliesseUnd(() => aktionen.abmeldung(p))}>
            <IonIcon icon={ICON_ABSAGE} aria-hidden="true" />
            {p.attendance_status === 'excused' ? 'Abmeldung bearbeiten' : 'Abgemeldet eintragen'}
          </WebKnopf>
          {hatEintrag && (
            <WebKnopf onClick={schliesseUnd(() => aktionen.notiz(p))}>
              {p.attendance_note ? 'Notiz bearbeiten' : 'Notiz hinzufügen'}
            </WebKnopf>
          )}
          {hatEintrag && (
            <WebKnopf onClick={schliesseUnd(() => aktionen.anwesenheit(p, null))}>
              <IonIcon icon={ICON_RUECKGAENGIG} aria-hidden="true" />
              Eintrag zurücksetzen
            </WebKnopf>
          )}
          {darfEntfernen && p.role_name === 'konfi' && p.status === 'confirmed' && (
            <WebKnopf onClick={schliesseUnd(() => aktionen.aufWarteliste(p))}>Auf Warteliste setzen</WebKnopf>
          )}
          {darfEntfernen && (
            <WebKnopf art="gefahr" onClick={schliesseUnd(() => aktionen.entfernen(p))}>
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
              Teilnahme entfernen
            </WebKnopf>
          )}
        </div>
      </WebDialog>
    );
  })();

  return (
    <WebKarte titel={titel} untertitel={untertitel} aktion={kopfAktion} bund={teilnehmende.length > 0}>
      {teilnehmende.length > 0 ? (
        <WebTabelle
          beschriftung={titel}
          spalten={spalten}
          zeilen={teilnehmende}
          zeileSchluessel={(p) => p.id}
          mittig
        />
      ) : (
        <p className="web-gedaempft" role="status">{leerText ?? 'Noch niemand angemeldet.'}</p>
      )}
      {menue}
    </WebKarte>
  );
};

export default WebTeilnehmerLeitung;
