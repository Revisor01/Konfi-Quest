import React, { useCallback, useEffect, useState } from 'react';
import { IonIcon, IonSpinner, useIonActionSheet } from '@ionic/react';
import { ICON_SPERRE } from './icons';
import {
  SperrVerzoegerung,
  VERZOEGERUNGEN,
  VERZOEGERUNG_BEZEICHNUNG,
  sperreVerfuegbar,
  sperreLesen,
  sperreSpeichern
} from '../../services/appSperre';
import { biometrieVerfuegbar } from '../../services/biometrics';

// Farbvariante der jeweiligen Rolle — dasselbe Muster wie BiometrieSchalter,
// damit sich der Eintrag in die "Konto-Einstellungen" aller drei Ansichten
// einfuegt.
export type SchalterVariante = 'users' | 'teamer' | 'purple';

interface Props {
  variante: SchalterVariante;
}

/**
 * Eintrag fuer die "Konto-Einstellungen": App-Sperre ein/aus und Wartezeit.
 *
 * BEWUSST EINE GEMEINSAME KOMPONENTE fuer alle drei Rollen (Leitung,
 * Teamer:innen, Konfis). Die App hat drei getrennte Komponentenbaeume, und die
 * uebliche Falle ist, eine Aenderung nur in einem davon zu machen. Die gesamte
 * Logik steckt hier an EINER Stelle; die drei Profil-Seiten binden sie ein und
 * geben ueber `variante` nur ihre Farbe mit.
 *
 * Rendert NICHTS ohne eingerichtete Biometrie und nichts im Browser — ein
 * Schalter, der ins Leere fuehrt, ist schlimmer als gar keiner.
 *
 * Statt Schalter plus Auswahl steht hier EIN Eintrag, der die Auswahl oeffnet:
 * "Aus" ist einer der Punkte darin. Ein getrennter Schalter muesste sich merken,
 * welche Wartezeit vor dem Ausschalten galt, und die Auswahl ausgrauen, solange
 * er aus ist — zwei Bedienelemente fuer eine Entscheidung.
 */
const AppSperreSchalter: React.FC<Props> = ({ variante }) => {
  const [zeigeAuswahl] = useIonActionSheet();
  const [verfuegbar, setVerfuegbar] = useState(false);
  const [bezeichnung, setBezeichnung] = useState('Face ID');
  const [wert, setWert] = useState<SperrVerzoegerung>('aus');
  const [laedt, setLaedt] = useState(true);
  const [speichert, setSpeichert] = useState(false);

  useEffect(() => {
    let abgemeldet = false;
    (async () => {
      const [nutzbar, art, gespeichert] = await Promise.all([
        sperreVerfuegbar(),
        biometrieVerfuegbar(),
        sperreLesen()
      ]);
      if (abgemeldet) return;
      setVerfuegbar(nutzbar);
      setBezeichnung(art.bezeichnung);
      setWert(gespeichert);
      setLaedt(false);
    })();
    return () => { abgemeldet = true; };
  }, []);

  const setzen = useCallback(async (neu: SperrVerzoegerung) => {
    setSpeichert(true);
    try {
      await sperreSpeichern(neu);
      setWert(neu);
      // Der laufende Sperr-Hook liest daraufhin neu. Ohne dieses Ereignis
      // griffe eine gerade eingeschaltete Sperre erst beim naechsten Start.
      window.dispatchEvent(new CustomEvent('app-sperre:geaendert'));
    } finally {
      setSpeichert(false);
    }
  }, []);

  const oeffnen = useCallback(() => {
    zeigeAuswahl({
      header: 'App sperren',
      subHeader: `Wann soll ${bezeichnung} verlangt werden?`,
      buttons: [
        ...VERZOEGERUNGEN.map((v) => ({
          text: VERZOEGERUNG_BEZEICHNUNG[v],
          handler: () => { setzen(v); }
        })),
        { text: VERZOEGERUNG_BEZEICHNUNG.aus, role: 'destructive', handler: () => { setzen('aus'); } },
        { text: 'Abbrechen', role: 'cancel' }
      ]
    });
  }, [zeigeAuswahl, bezeichnung, setzen]);

  if (laedt || !verfuegbar) return null;

  const beschreibung = wert === 'aus'
    ? `Die App nach einer Pause mit ${bezeichnung} schützen`
    : `${VERZOEGERUNG_BEZEICHNUNG[wert]} im Hintergrund`;

  return (
    <div
      className={`app-list-item app-list-item--${variante}`}
      style={{ width: '100%', cursor: 'pointer' }}
      onClick={speichert ? undefined : oeffnen}
    >
      <div className="app-list-item__row">
        <div className="app-list-item__main">
          <div className={`app-icon-circle app-icon-circle--${variante}`}>
            <IonIcon icon={ICON_SPERRE} />
          </div>
          <div className="app-list-item__content">
            <div className="app-list-item__title">App sperren</div>
            <div className="app-list-item__meta">
              <span className="app-list-item__meta-item">{beschreibung}</span>
            </div>
          </div>
        </div>
        {speichert ? <IonSpinner name="crescent" /> : null}
      </div>
    </div>
  );
};

export default AppSperreSchalter;
