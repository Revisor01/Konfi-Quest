// Struktur in der Web-Fassung der Support-Ansicht, /admin/support/struktur
// (docs/planung/support-web.md, Phase 2; Entscheidung 3, 02.10.2026).
//
// "Gemeinde zuerst": Kirchenkreis und Landeskirche sind Zuordnungen an der
// Gemeinde, vor allem fuer die Statistik. Hier entstehen sie. Je Landeskirche
// eine Karte mit ihren Kirchenkreisen als Tabelle (Name, Zahl der Gemeinden,
// Aktionen), darunter die Kirchenkreise ohne Landeskirche. Anlegen,
// Umbenennen und Zuordnen laufen in einem Dialog, Loeschen mit der Rueckfrage
// der App (eine Landeskirche mit Kirchenkreisen laesst sich nicht loeschen --
// das sagt die Seite vorher).
//
// Interne Gemeinden zaehlen nicht mit: Das rechnet der Server
// (`anzahl_gemeinden` je Kirchenkreis). Aeltere Server liefern das Feld nicht,
// dann steht ein Strich.
//
// Die Logik (laden, anlegen, speichern, loeschen) ist dieselbe wie in der
// App: components/support/useStruktur.ts.

import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_BEARBEITEN, ICON_HINZUFUEGEN, ICON_LOESCHEN, ICON_NETZWERK } from '../../shared/icons';
import type { Kirchenkreis, Landeskirche } from '../../../types/support';
import { mitEinheit } from '../../../utils/supportStatistik';
import { useStruktur } from '../useStruktur';
import WebSeite from '../../web/WebSeite';
import WebKarte from '../../web/WebKarte';
import WebKnopf from '../../web/WebKnopf';
import WebDialog from '../../web/WebDialog';
import WebFeld from '../../web/WebFeld';
import WebAuswahl from '../../web/WebAuswahl';
import WebTabelle, { type WebSpalte } from '../../web/WebTabelle';
import { WebFehler, WebLaden, WebLeer } from '../../web/WebZustaende';

const OHNE = 'ohne';

type Anlegen = 'landeskirche' | 'kirchenkreis' | null;

/** Die Zahl der Gemeinden eines Kirchenkreises; null, wenn der Server sie nicht liefert. */
const gemeindenVon = (kk: Pick<Kirchenkreis, 'anzahl_gemeinden'>): number | null =>
  typeof kk.anzahl_gemeinden === 'number' ? kk.anzahl_gemeinden : null;

/** Summe der Gemeinden; null, sobald ein Kirchenkreis keine Zahl hat (dann stimmte die Summe nicht). */
const summe = (kreise: readonly Kirchenkreis[]): number | null => {
  let gesamt = 0;
  for (const k of kreise) {
    const n = gemeindenVon(k);
    if (n === null) return null;
    gesamt += n;
  }
  return gesamt;
};

const LandeskircheWahl: React.FC<{
  label: string;
  landeskirchen: readonly Landeskirche[];
  wert: number | null;
  onWert: (id: number | null) => void;
  hinweis?: string;
}> = ({ label, landeskirchen, wert, onWert, hinweis }) => (
  <WebAuswahl
    label={label}
    wert={wert === null ? OHNE : String(wert)}
    onWert={(w) => onWert(w === OHNE ? null : Number(w))}
    optionen={[{ wert: OHNE, label: 'Ohne Landeskirche' }, ...landeskirchen.map((l) => ({ wert: String(l.id), label: l.name }))]}
    hinweis={hinweis}
  />
);

const WebStruktur: React.FC = () => {
  const {
    isOnline, landeskirchen, kirchenkreise, laedt, fehler, beschaeftigt, neueLk, setNeueLk, neuerKk, setNeuerKk, neuerKkLk,
    setNeuerKkLk, lkBearbeiten, setLkBearbeiten, kkBearbeiten, setKkBearbeiten, laden, landeskircheAnlegen, kirchenkreisAnlegen,
    landeskircheSpeichern, kirchenkreisSpeichern, landeskircheLoeschen, kirchenkreisLoeschen,
  } = useStruktur();
  const [anlegen, setAnlegen] = useState<Anlegen>(null);
  /** Dialog zu, Eingaben verwerfen (nach dem Anlegen wie nach Abbrechen: beim naechsten Oeffnen beginnt er leer). */
  const anlegenAbbrechen = () => {
    setAnlegen(null);
    setNeueLk('');
    setNeuerKk('');
    setNeuerKkLk(null);
  };

  const kopfAktionen = (
    <>
      <WebKnopf onClick={() => setAnlegen('landeskirche')}>
        <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
        Landeskirche anlegen
      </WebKnopf>
      <WebKnopf onClick={() => setAnlegen('kirchenkreis')}>
        <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
        Kirchenkreis anlegen
      </WebKnopf>
    </>
  );

  if (laedt && !landeskirchen) {
    return (
      <WebSeite bereich="Support" titel="Struktur">
        <WebLaden karten={2} text="Die Struktur wird geladen." />
      </WebSeite>
    );
  }
  if (fehler || !landeskirchen) {
    return (
      <WebSeite bereich="Support" titel="Struktur">
        <WebFehler text="Landeskirchen und Kirchenkreise konnten nicht geladen werden." onErneut={() => { void laden(); }} />
      </WebSeite>
    );
  }

  const spalten: Array<WebSpalte<Kirchenkreis>> = [
    {
      schluessel: 'name',
      kopf: 'Kirchenkreis',
      sortWert: (kk) => kk.name,
      zelle: (kk) => <span className="web-zelle-titel">{kk.name}</span>,
    },
    {
      schluessel: 'gemeinden',
      kopf: 'Gemeinden',
      breite: '120px',
      zahl: true,
      sortWert: gemeindenVon,
      zelle: (kk) => {
        const n = gemeindenVon(kk);
        return n === null ? <span className="web-gedaempft">–</span> : String(n);
      },
    },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      breite: '264px',
      zelle: (kk) => (
        <div className="web-zeilenaktionen">
          <WebKnopf klein onClick={() => setKkBearbeiten({ id: kk.id, name: kk.name, landeskircheId: kk.landeskirche_id })} aria-label={`${kk.name} bearbeiten`}>
            <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
            Bearbeiten
          </WebKnopf>
          <WebKnopf klein art="gefahr" onClick={() => kirchenkreisLoeschen(kk)} aria-label={`${kk.name} löschen`}>
            <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
            Löschen
          </WebKnopf>
        </div>
      ),
    },
  ];

  const kreisTabelle = (beschriftung: string, kreise: readonly Kirchenkreis[]) => (
    <WebTabelle beschriftung={beschriftung} spalten={spalten} zeilen={kreise} zeileSchluessel={(k) => k.id} mittig fest />
  );

  const ohneLandeskirche = kirchenkreise.filter((k) => k.landeskirche_id == null);

  const gruppen = landeskirchen.map((lk) => {
    const kreise = kirchenkreise.filter((k) => k.landeskirche_id === lk.id);
    const gemeinden = summe(kreise);
    return (
      <WebKarte
        key={lk.id}
        titel={lk.name}
        untertitel={`${mitEinheit(kreise.length, 'Kirchenkreis', 'Kirchenkreise')}${gemeinden === null ? '' : ` · ${mitEinheit(gemeinden, 'Gemeinde', 'Gemeinden')}`}`}
        aktion={(
          <div className="web-zeilenaktionen">
            <WebKnopf klein onClick={() => setLkBearbeiten({ id: lk.id, name: lk.name })} aria-label={`${lk.name} umbenennen`}>
              <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
              Umbenennen
            </WebKnopf>
            <WebKnopf klein art="gefahr" onClick={() => landeskircheLoeschen(lk, kreise.length)} aria-label={`${lk.name} löschen`}>
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
              Löschen
            </WebKnopf>
          </div>
        )}
        bund
      >
        {kreise.length === 0
          ? <p className="web-karte__leer">Noch keine Kirchenkreise.</p>
          : kreisTabelle(`Kirchenkreise von ${lk.name}`, kreise)}
      </WebKarte>
    );
  });

  return (
    <WebSeite
      bereich="Support"
      titel="Struktur"
      untertitel="Landeskirchen und Kirchenkreise, denen die Gemeinden zugeordnet sind"
      aktionen={kopfAktionen}
    >
      {landeskirchen.length === 0 && ohneLandeskirche.length === 0 ? (
        <div className="web-karte">
          <WebLeer
            icon={ICON_NETZWERK}
            titel="Noch keine Landeskirchen und Kirchenkreise"
            text="Lege die erste Landeskirche an und ordne ihr Kirchenkreise zu."
            aktion={<WebKnopf art="primaer" onClick={() => setAnlegen('landeskirche')}>Landeskirche anlegen</WebKnopf>}
          />
        </div>
      ) : (
        <div className="web-gruppen">
          {gruppen}
          {ohneLandeskirche.length > 0 && (
            <WebKarte
              titel="Kirchenkreise ohne Landeskirche"
              untertitel={`${mitEinheit(ohneLandeskirche.length, 'Kirchenkreis', 'Kirchenkreise')} — ordne sie einer Landeskirche zu`}
              bund
            >
              {kreisTabelle('Kirchenkreise ohne Landeskirche', ohneLandeskirche)}
            </WebKarte>
          )}
        </div>
      )}

      {anlegen === 'landeskirche' && (
        <WebDialog
          titel="Landeskirche anlegen"
          onSchliessen={anlegenAbbrechen}
          onAbsenden={() => { void landeskircheAnlegen().then((ok) => { if (ok) anlegenAbbrechen(); }); }}
          aktionen={(
            <>
              <WebKnopf onClick={anlegenAbbrechen}>Abbrechen</WebKnopf>
              <WebKnopf art="primaer" absenden disabled={beschaeftigt || !isOnline || !neueLk.trim()}>Anlegen</WebKnopf>
            </>
          )}
        >
          <WebFeld label="Name der Landeskirche" pflicht wert={neueLk} onWert={setNeueLk} />
        </WebDialog>
      )}

      {anlegen === 'kirchenkreis' && (
        <WebDialog
          titel="Kirchenkreis anlegen"
          onSchliessen={anlegenAbbrechen}
          onAbsenden={() => { void kirchenkreisAnlegen().then((ok) => { if (ok) anlegenAbbrechen(); }); }}
          aktionen={(
            <>
              <WebKnopf onClick={anlegenAbbrechen}>Abbrechen</WebKnopf>
              <WebKnopf art="primaer" absenden disabled={beschaeftigt || !isOnline || !neuerKk.trim()}>Anlegen</WebKnopf>
            </>
          )}
        >
          <WebFeld label="Name des Kirchenkreises" pflicht wert={neuerKk} onWert={setNeuerKk} />
          <LandeskircheWahl label="Landeskirche" landeskirchen={landeskirchen} wert={neuerKkLk} onWert={setNeuerKkLk} />
        </WebDialog>
      )}

      {lkBearbeiten && (
        <WebDialog
          titel="Landeskirche umbenennen"
          onSchliessen={() => setLkBearbeiten(null)}
          onAbsenden={() => { void landeskircheSpeichern(); }}
          aktionen={(
            <>
              <WebKnopf onClick={() => setLkBearbeiten(null)}>Abbrechen</WebKnopf>
              <WebKnopf art="primaer" absenden disabled={beschaeftigt || !isOnline}>Speichern</WebKnopf>
            </>
          )}
        >
          <WebFeld label="Name der Landeskirche" pflicht wert={lkBearbeiten.name} onWert={(w) => setLkBearbeiten({ ...lkBearbeiten, name: w })} />
        </WebDialog>
      )}

      {kkBearbeiten && (
        <WebDialog
          titel="Kirchenkreis bearbeiten"
          beschreibung="Name und Landeskirche. Die Gemeinden des Kirchenkreises bleiben ihm zugeordnet."
          onSchliessen={() => setKkBearbeiten(null)}
          onAbsenden={() => { void kirchenkreisSpeichern(); }}
          aktionen={(
            <>
              <WebKnopf onClick={() => setKkBearbeiten(null)}>Abbrechen</WebKnopf>
              <WebKnopf art="primaer" absenden disabled={beschaeftigt || !isOnline}>Speichern</WebKnopf>
            </>
          )}
        >
          <WebFeld label="Name des Kirchenkreises" pflicht wert={kkBearbeiten.name} onWert={(w) => setKkBearbeiten({ ...kkBearbeiten, name: w })} />
          <LandeskircheWahl label="Landeskirche" landeskirchen={landeskirchen} wert={kkBearbeiten.landeskircheId}
            onWert={(id) => setKkBearbeiten({ ...kkBearbeiten, landeskircheId: id })} />
        </WebDialog>
      )}
    </WebSeite>
  );
};

export default WebStruktur;
