import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { IonBadge, IonIcon } from '@ionic/react';
import { ICON_ZUKLAPPEN } from '../shared/icons';
import type { UserOrganization } from '../../contexts/AppContext';
import { useGemeindeWechsel, useOffenJeGemeinde } from '../../hooks/useGemeindeWechsel';
import { gemeindeInitiale, gemeindeName, rolleInGemeinde } from '../../utils/gemeindeAnzeige';
import { rollenFarbeVar } from '../../utils/rollenNamen';

// Der Gemeinde-Umschalter unten in der Leiste der Web-Version (Simon,
// 03.10.2026): „In der Webansicht ist der Switcher für die Org unten in der
// Navi, das finde ich gut, aber auch aktuell noch im Header, das finde ich
// doof. Und unten in der Navi links darf der schon gestylt sein. Also eigene
// Webview, ohne die App-View zu zerstören." Planung: docs/planung/
// support-web.md, Entscheidung 8.
//
// Eine eigene Flaeche statt des Toolbar-Knopfes der App (OrgSwitcherButton,
// der in der Kopfzeile der Apps und des schmalen Fensters bleibt), gebaut wie
// der Workspace-Umschalter guter Web-Apps: ein Symbol (abgerundetes Quadrat
// mit dem Buchstaben der Gemeinde, in der Farbe der Rolle dort), der VOLLE
// Name, darunter klein die Rolle, rechts ein Pfeil. Ein Klick klappt die Liste
// nach OBEN auf, ueber den Fuss der Leiste; eingeklappt steht nur das Symbol
// da und die Liste oeffnet sich daneben.
//
// Der Wechsel selbst -- wechseln, Startseite der Rolle, Stapel leeren -- und
// die roten Zahlen je Gemeinde kommen aus hooks/useGemeindeWechsel.ts, wie
// beim Knopf der Kopfzeile. Hier steht nur, wie es aussieht und sich bedient.
//
// Bedienung wie ein Menue im Browser (WAI-ARIA „Menu Button"): Klick, Enter,
// Leertaste oder Pfeil auf/ab oeffnet und springt in die Liste (auf die
// aktive Gemeinde); Pfeiltasten, Pos1 und Ende bewegen sich darin, Enter oder
// Leertaste waehlt; Escape schliesst und gibt den Fokus an den Knopf zurueck;
// ein Klick daneben oder Tab schliesst ebenfalls.

/** Abstand zwischen Knopf und Liste, in Pixeln (die Lage wird gemessen). */
const LUECKE = 8;

interface Lage {
  links: number;
  unten: number;
  /** Mindestbreite der Liste: ausgeklappt so breit wie der Knopf. */
  mindestbreite: number;
}

/** Symbol der Gemeinde: abgerundetes Quadrat, Buchstabe, Farbe der Rolle dort. */
const GemeindeSymbol: React.FC<{ org: UserOrganization | undefined; klein?: boolean }> = ({ org, klein }) => (
  <span
    className={klein ? 'app-leistengemeinde__symbol app-leistengemeinde__symbol--klein' : 'app-leistengemeinde__symbol'}
    style={{ '--app-leistengemeinde-farbe': rollenFarbeVar(org?.role_name) } as React.CSSProperties}
    aria-hidden="true"
  >
    {gemeindeInitiale(gemeindeName(org))}
  </span>
);

const LeistenGemeinde: React.FC<{ eingeklappt: boolean }> = ({ eingeklappt }) => {
  const { gemeinden, aktiveId, aktive, mehrere, wechseln } = useGemeindeWechsel();
  const { offenJeOrg, laden } = useOffenJeGemeinde();
  const [offen, setOffen] = useState(false);
  const [lage, setLage] = useState<Lage | null>(null);
  const huelle = useRef<HTMLDivElement>(null);
  const knopf = useRef<HTMLButtonElement>(null);
  const eintraege = useRef<Array<HTMLButtonElement | null>>([]);
  const kennung = useId();
  const listenId = `${kennung}-liste`;
  const kopfId = `${kennung}-kopf`;

  const aktiverIndex = Math.max(0, gemeinden.findIndex((o) => o.id === aktiveId));

  const schliessen = useCallback((fokusZurueck: boolean) => {
    setOffen(false);
    if (fokusZurueck) knopf.current?.focus();
  }, []);

  // Die Liste steht neben bzw. ueber dem Knopf, aber ausserhalb der Leiste
  // gezeichnet: Die Leiste schneidet ihren Inhalt ab (overflow), und die
  // eingeklappte Leiste ist nur 72 px breit. Deshalb feste Lage, aus der Lage
  // des Knopfes gemessen -- beim Oeffnen und neu, wenn das Fenster sich aendert.
  const messeLage = useCallback((): Lage | null => {
    const kasten = knopf.current?.getBoundingClientRect();
    if (!kasten) return null;
    return eingeklappt
      // Daneben: rechts vom Symbol, unten buendig mit ihm.
      ? { links: kasten.right + LUECKE, unten: window.innerHeight - kasten.bottom, mindestbreite: 0 }
      // Darueber: links buendig, so breit wie der Knopf.
      : { links: kasten.left, unten: window.innerHeight - kasten.top + LUECKE, mindestbreite: kasten.width };
  }, [eingeklappt]);

  const oeffnen = useCallback(() => {
    setLage(messeLage());
    setOffen(true);
    // Beim Oeffnen frisch fragen, damit die Zahl dann stimmt.
    void laden();
  }, [laden, messeLage]);

  useEffect(() => {
    if (!offen) return undefined;
    const neuMessen = () => setLage(messeLage());
    window.addEventListener('resize', neuMessen);
    return () => window.removeEventListener('resize', neuMessen);
  }, [offen, messeLage]);

  // Beim Oeffnen in die Liste springen, auf die aktive Gemeinde -- nur dann,
  // nicht bei jeder Zahl, die nachtraeglich eintrifft.
  useEffect(() => {
    if (offen) eintraege.current[aktiverIndex]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen]);

  // Ein Klick daneben schliesst. Fokus bleibt dort, wohin geklickt wurde.
  useEffect(() => {
    if (!offen) return undefined;
    const daneben = (ereignis: PointerEvent) => {
      if (!huelle.current?.contains(ereignis.target as Node)) setOffen(false);
    };
    document.addEventListener('pointerdown', daneben);
    return () => document.removeEventListener('pointerdown', daneben);
  }, [offen]);

  // Nur bei echtem Multi-Org-Konto anzeigen -- wie der Knopf der Kopfzeile.
  // Gibt es nur noch eine Gemeinde, verschwindet die Flaeche samt Liste; die
  // Liste soll nicht von selbst wieder aufgehen, wenn eine zweite dazukommt.
  if (!mehrere) {
    if (offen) setOffen(false);
    return null;
  }

  const name = gemeindeName(aktive);
  const rolle = rolleInGemeinde(aktive);

  const umschalten = () => {
    if (offen) schliessen(false);
    else oeffnen();
  };

  const fokusAuf = (index: number) => {
    const n = gemeinden.length;
    eintraege.current[((index % n) + n) % n]?.focus();
  };

  const tasteAmKnopf = (ereignis: React.KeyboardEvent) => {
    if (ereignis.key === 'ArrowUp' || ereignis.key === 'ArrowDown') {
      ereignis.preventDefault();
      if (!offen) oeffnen();
      else fokusAuf(aktiverIndex);
    }
  };

  const tasteInDerListe = (ereignis: React.KeyboardEvent, index: number) => {
    switch (ereignis.key) {
      case 'ArrowDown':
        ereignis.preventDefault();
        fokusAuf(index + 1);
        break;
      case 'ArrowUp':
        ereignis.preventDefault();
        fokusAuf(index - 1);
        break;
      case 'Home':
        ereignis.preventDefault();
        fokusAuf(0);
        break;
      case 'End':
        ereignis.preventDefault();
        fokusAuf(gemeinden.length - 1);
        break;
      case 'Tab':
        // Das Menue schliesst, der Fokus laeuft vom Knopf aus weiter.
        schliessen(true);
        break;
      default:
    }
  };

  const waehlen = (org: UserOrganization) => {
    schliessen(true);
    void wechseln(org.id);
  };

  const listenStil: React.CSSProperties | undefined = lage
    ? { left: lage.links, bottom: lage.unten, minWidth: lage.mindestbreite || undefined }
    : undefined;

  return (
    <div
      ref={huelle}
      className="app-leistengemeinde"
      onKeyDown={(ereignis) => {
        if (offen && ereignis.key === 'Escape') {
          ereignis.preventDefault();
          ereignis.stopPropagation();
          schliessen(true);
        }
      }}
      onBlur={(ereignis) => {
        // Der Fokus geht in einen Bereich ausserhalb: zu. Ohne Ziel (Klick
        // auf nichts Fokussierbares, Safari fokussiert Knoepfe nicht) bleibt
        // es offen -- das uebernimmt der Klick daneben.
        const ziel = ereignis.relatedTarget as Node | null;
        if (offen && ziel && !huelle.current?.contains(ziel)) setOffen(false);
      }}
    >
      <button
        ref={knopf}
        type="button"
        className="app-leistengemeinde__knopf"
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-controls={offen ? listenId : undefined}
        aria-label={name ? `Gemeinde wechseln, gerade ${name}${rolle ? `, ${rolle}` : ''}` : 'Gemeinde wechseln'}
        // Der volle Name: bei Ueberlaenge im Ellipsis, eingeklappt der einzige Hinweis.
        title={name}
        onClick={umschalten}
        onKeyDown={tasteAmKnopf}
      >
        <GemeindeSymbol org={aktive} />
        <span className="app-leistengemeinde__texte">
          <span className="app-leistengemeinde__name">{name}</span>
          {rolle && <span className="app-leistengemeinde__rolle">{rolle}</span>}
        </span>
        <IonIcon icon={ICON_ZUKLAPPEN} className="app-leistengemeinde__pfeil" aria-hidden="true" />
      </button>

      {offen && (
        <div className="app-leistengemeinde__liste" style={listenStil}>
          <div id={kopfId} className="app-leistengemeinde__listenkopf">Gemeinde wechseln</div>
          <div id={listenId} role="menu" aria-labelledby={kopfId}>
            {gemeinden.map((org, index) => {
              const aktiv = org.id === aktiveId;
              const zahl = offenJeOrg[org.id] || 0;
              const orgName = gemeindeName(org);
              const orgRolle = rolleInGemeinde(org);
              return (
                <button
                  key={org.id}
                  ref={(el) => { eintraege.current[index] = el; }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={aktiv}
                  tabIndex={-1}
                  title={orgName}
                  // Name, Rolle und die Zahl als Wort -- unabhaengig davon, wie
                  // ein Vorleseprogramm die Teile des Eintrags aneinanderreiht.
                  aria-label={[orgName, orgRolle, zahl > 0 ? `${zahl} offen` : ''].filter(Boolean).join(', ')}
                  className={aktiv ? 'app-leistengemeinde__eintrag app-leistengemeinde__eintrag--aktiv' : 'app-leistengemeinde__eintrag'}
                  onClick={() => waehlen(org)}
                  onKeyDown={(ereignis) => tasteInDerListe(ereignis, index)}
                >
                  <GemeindeSymbol org={org} klein />
                  <span className="app-leistengemeinde__texte">
                    <span className="app-leistengemeinde__name">{orgName}</span>
                    {orgRolle && <span className="app-leistengemeinde__rolle">{orgRolle}</span>}
                  </span>
                  {/* Rote Zahl wie am Reiter: „da liegt etwas". Bei 0 nichts --
                      ruhige Liste, die Zahl ist der Hinweis. */}
                  {zahl > 0 && (
                    <IonBadge color="danger" className="app-leistengemeinde__offen" aria-hidden="true">
                      {zahl > 99 ? '99+' : zahl}
                    </IonBadge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeistenGemeinde;
