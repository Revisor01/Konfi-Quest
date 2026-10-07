// Jahresrueckblick verwalten in der Web-Fassung, /admin/wrapped (Browser ab
// 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6): die Ausgaben als
// Tabelle, getrennt nach Konfis und Team, mit Kennzahlen oben. Eine neue
// Ausgabe entsteht in einem Dialog -- wie in der App wird nur der Jahrgang
// (Konfis, dazu ein Name) bzw. das Jahr (Team) gewaehlt, alles andere steht fest.
//
// Zustand, Laden, Erzeugen und Loeschen kommen von der Seite (AdminWrappedPage):
// dieselben Routen, dieselben Rueckfragen, dieselben Rechte. Die Ausgaben fuers
// Team gibt es nur fuer die Gemeindeleitung; eine Leitung sieht und legt nur
// Ausgaben ihrer Jahrgaenge an (der Server liefert nur diese).

import React, { useEffect, useMemo } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_FUNKELN, ICON_FUNKELN_GEFUELLT, ICON_GRUPPE_GEFUELLT, ICON_HINZUFUEGEN } from '../../../shared/icons';
import { datumKurz } from '../../../../utils/dateUtils';
import WebSeite from '../../../web/WebSeite';
import WebKarte from '../../../web/WebKarte';
import WebKachel from '../../../web/WebKachel';
import WebKnopf from '../../../web/WebKnopf';
import WebChips from '../../../web/WebChips';
import WebPill from '../../../web/WebPill';
import WebAuswahl from '../../../web/WebAuswahl';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebDialog from '../../../web/WebDialog';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import { WebLaden, WebLeer } from '../../../web/WebZustaende';
import { WebSymbol, WebZeilenAktionen } from './WebLeitungBausteine';
import type { RueckblickAusgabe, TeamJahr } from './verwaltungTypen';

export type RueckblickReiter = 'konfi' | 'teamer';

/** Der Dialog "Neuer Rueckblick": Zustand und Aktionen liegen bei der Seite. */
export interface RueckblickDialog {
  offen: boolean;
  onOeffnen: () => void;
  onSchliessen: () => void;
  jahrgangId: number | null;
  onJahrgang: (id: number | null) => void;
  jahr: number;
  onJahr: (jahr: number) => void;
  teamJahre: readonly TeamJahr[];
  name: string;
  onName: (name: string) => void;
  /** Der Name, wenn nichts eingegeben wird ("Zwischenstand", "Zwischenstand 2" ...). */
  namensVorschlag: string;
  erzeugt: boolean;
  onErzeugen: () => void;
}

export interface WebRueckblickProps {
  ausgaben: readonly RueckblickAusgabe[];
  jahrgaenge: ReadonlyArray<{ id: number; name: string }>;
  laedt: boolean;
  /** Der Server sagt: Dieser Zugang hat keinen Jahrgang -- die Liste ist leer, weil er nichts sehen darf. */
  ohneJahrgang: boolean;
  /** Gemeindeleitung: auch die Ausgaben fuers Team. */
  istLeitung: boolean;
  reiter: RueckblickReiter;
  onReiter: (reiter: RueckblickReiter) => void;
  dialog: RueckblickDialog;
  onLoeschen: (ausgabe: RueckblickAusgabe) => void;
}

const zeitraum = (a: RueckblickAusgabe) => `${datumKurz(a.zeitraum_start)} – ${datumKurz(a.zeitraum_ende)}`;

const WebRueckblick: React.FC<WebRueckblickProps> = ({
  ausgaben, jahrgaenge, laedt, ohneJahrgang, istLeitung, reiter, onReiter, dialog, onLoeschen,
}) => {
  const sichtbar = useMemo(() => ausgaben.filter((a) => a.typ === reiter), [ausgaben, reiter]);
  const { teamJahre } = dialog;
  const verfuegbareJahre = useMemo(() => teamJahre.filter((j) => !j.gesperrt).map((j) => j.jahr), [teamJahre]);
  const gesperrteJahre = useMemo(() => teamJahre.filter((j) => j.gesperrt), [teamJahre]);

  // Das gewaehlte Jahr muss eines der waehlbaren sein: Das Auswahlfeld zeigt
  // sonst das erste, die Seite rechnet aber mit dem alten Wert.
  const { offen, jahr, onJahr } = dialog;
  useEffect(() => {
    if (offen && reiter === 'teamer' && verfuegbareJahre.length > 0 && !verfuegbareJahre.includes(jahr)) {
      onJahr(verfuegbareJahre[0]);
    }
  }, [offen, reiter, verfuegbareJahre, jahr, onJahr]);

  if (laedt) {
    return (
      <WebSeite bereich="Verwaltung" titel="Jahresrückblick" zurueck={{ href: '/admin/settings', text: 'Mehr' }}>
        <WebLaden kacheln={3} karten={1} text="Die Rückblicke werden geladen." />
      </WebSeite>
    );
  }

  const spalten: Array<WebSpalte<RueckblickAusgabe>> = [
    {
      schluessel: 'name',
      kopf: 'Name',
      sortWert: (a) => a.titel,
      zelle: (a) => (
        <span className="web-person-zelle">
          <WebSymbol icon={a.typ === 'teamer' ? ICON_GRUPPE_GEFUELLT : ICON_FUNKELN_GEFUELLT} ton="wrapped" />
          <span className="web-zelle-titel web-einzeilig">{a.titel}</span>
        </span>
      ),
    },
    ...(reiter === 'konfi' ? [{
      schluessel: 'jahrgang',
      kopf: 'Jahrgang',
      breite: '170px',
      sortWert: (a: RueckblickAusgabe) => a.jahrgang_name,
      zelle: (a: RueckblickAusgabe) => a.jahrgang_name ?? <span className="web-gedaempft">–</span>,
    }] : []),
    {
      schluessel: 'zeitraum',
      kopf: 'Zeitraum',
      breite: '210px',
      optional: true,
      sortWert: (a) => new Date(a.zeitraum_start),
      zelle: (a) => <span className="web-zelle-leise">{zeitraum(a)}</span>,
    },
    {
      schluessel: 'rueckblicke',
      kopf: 'Rückblicke',
      zahl: true,
      breite: '110px',
      sortWert: (a) => a.snapshots,
      zelle: (a) => a.snapshots,
    },
    {
      schluessel: 'status',
      kopf: 'Status',
      breite: '200px',
      // Nicht freigegeben zuerst, dann nach Tag der Freigabe
      sortWert: (a) => (a.freigegeben ? (a.freigegeben_at ? new Date(a.freigegeben_at).getTime() : 1) : 0),
      zelle: (a) => (a.freigegeben
        ? <WebPill ton="erfolg" punkt>Freigegeben{a.freigegeben_at ? ` ${datumKurz(a.freigegeben_at)}` : ''}</WebPill>
        : <WebPill punkt>Nicht freigegeben</WebPill>),
    },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      klasse: 'web-spalte-aktionen-schmal',
      zelle: (a) => <WebZeilenAktionen name={a.titel} onLoeschen={() => onLoeschen(a)} loeschenTitel="Ausgabe löschen" />,
    },
  ];

  const chips = [
    { wert: 'konfi' as const, label: 'Konfis', zahl: ausgaben.filter((a) => a.typ === 'konfi').length },
    // Ausgaben fuers Team betreffen die ganze Gemeinde: nur die Leitung.
    ...(istLeitung ? [{ wert: 'teamer' as const, label: 'Team', zahl: ausgaben.filter((a) => a.typ === 'teamer').length }] : []),
  ];

  const leerText = ohneJahrgang
    // Derselbe Wortlaut wie in der Konfi-Liste: Es GIBT Rueckblicke, dieser Zugang darf sie nur nicht sehen.
    ? 'Dir ist noch kein Jahrgang zugewiesen. Die Gemeindeleitung kann das in den Einstellungen ändern.'
    : reiter === 'konfi'
      ? 'Mit „Neuer Rückblick“ legst du einen an — du wählst nur den Jahrgang, alles andere steht fest.'
      : 'Mit „Neuer Rückblick“ legst du einen an — fürs ganze Team gemeinsam, du wählst nur das Jahr.';

  return (
    <WebSeite
      bereich="Verwaltung"
      titel="Jahresrückblick"
      untertitel="Ausgaben verwalten"
      aktionen={(
        <WebKnopf art="primaer" onClick={dialog.onOeffnen}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Neuer Rückblick
        </WebKnopf>
      )}
      zurueck={{ href: '/admin/settings', text: 'Mehr' }}
    >
      <div className="web-raster web-raster--kacheln">
        <WebKachel label={sichtbar.length === 1 ? 'Ausgabe' : 'Ausgaben'} wert={String(sichtbar.length)} />
        <WebKachel label="Freigegeben" wert={String(sichtbar.filter((a) => a.freigegeben).length)} />
        <WebKachel label="Rückblicke" wert={String(sichtbar.reduce((summe, a) => summe + (a.snapshots || 0), 0))} zusatz={['in diesen Ausgaben']} />
      </div>

      <div className="web-werkzeuge">
        <WebChips<RueckblickReiter> beschriftung="Rückblicke für" chips={chips} wert={reiter} onWert={onReiter} />
      </div>

      <WebKarte titel={reiter === 'konfi' ? 'Konfis' : 'Team'} untertitel={`${sichtbar.length} ${sichtbar.length === 1 ? 'Ausgabe' : 'Ausgaben'}`} bund={sichtbar.length > 0}>
        {sichtbar.length === 0 ? (
          <WebLeer
            icon={ICON_FUNKELN}
            titel={ohneJahrgang ? 'Kein Jahrgang zugewiesen' : 'Noch kein Rückblick'}
            text={leerText}
          />
        ) : (
          <WebTabelle
            beschriftung={reiter === 'konfi' ? 'Ausgaben für Konfis' : 'Ausgaben fürs Team'}
            spalten={spalten}
            zeilen={sichtbar}
            zeileSchluessel={(a) => a.id}
            mittig
          />
        )}
      </WebKarte>

      {dialog.offen && (
        <WebDialog
          titel="Neuer Rückblick"
          onSchliessen={dialog.onSchliessen}
          onAbsenden={dialog.onErzeugen}
          aktionen={(
            <>
              <WebKnopf art="text" onClick={dialog.onSchliessen}>Abbrechen</WebKnopf>
              <WebKnopf art="primaer" absenden disabled={dialog.erzeugt}>
                {dialog.erzeugt ? 'Wird erstellt …' : 'Rückblick erstellen und freigeben'}
              </WebKnopf>
            </>
          )}
        >
          {reiter === 'konfi' ? (
            <>
              <WebAuswahl
                label="Jahrgang"
                pflicht
                wert={dialog.jahrgangId === null ? '' : String(dialog.jahrgangId)}
                onWert={(w) => dialog.onJahrgang(w === '' ? null : Number(w))}
                optionen={[{ wert: '', label: 'Jahrgang wählen' }, ...jahrgaenge.map((j) => ({ wert: String(j.id), label: j.name }))]}
              />
              <WebFeld
                label="Name"
                wert={dialog.name}
                onWert={dialog.onName}
                hinweis={`Ohne Eingabe heißt die Ausgabe „${dialog.namensVorschlag}“. Der Name steht in der Liste und auf der Begrüßungsfolie.`}
              />
            </>
          ) : (
            <WebAuswahl
              label="Jahr"
              wert={verfuegbareJahre.includes(dialog.jahr) ? String(dialog.jahr) : (verfuegbareJahre[0] !== undefined ? String(verfuegbareJahre[0]) : '')}
              onWert={(w) => dialog.onJahr(Number(w))}
              optionen={verfuegbareJahre.length > 0 ? verfuegbareJahre.map((j) => ({ wert: String(j), label: String(j) })) : [{ wert: '', label: 'Kein Jahr verfügbar' }]}
              hinweis={gesperrteJahre.length > 0
                ? gesperrteJahre.map((j) => `${j.jahr} — verfügbar ab 1.1.${j.jahr + 1}`).join(' · ')
                : undefined}
            />
          )}
          <WebHinweis art="hinweis">
            {reiter === 'konfi'
              ? 'Gezählt wird die ganze Konfi-Zeit — vom Beginn bis zu diesem Moment. Der Rückblick wird sofort freigegeben, alle bekommen eine Mitteilung. Frühere Ausgaben bleiben erhalten.'
              : 'Gezählt wird das ganze Kalenderjahr, vom 1. Januar bis zum 31. Dezember. Der Rückblick wird sofort freigegeben, alle bekommen eine Mitteilung.'}
          </WebHinweis>
        </WebDialog>
      )}
    </WebSeite>
  );
};

export default WebRueckblick;
