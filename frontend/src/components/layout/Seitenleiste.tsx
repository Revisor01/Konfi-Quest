import React, { useCallback, useState } from 'react';
import { IonBadge, IonIcon, useIonAlert, useIonRouter } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import { BAEUME } from '../../navigation/rollenBaeume';
import { aktiverPfad } from '../../navigation/routes';
import type { BadgeKey, MenueEintrag } from '../../navigation/routes';
import { useReiterZaehler, zaehlerText } from '../../navigation/reiterZaehler';
import { useAppLocation } from '../../navigation/useAppLocation';
import { rolleVonUser } from '../../navigation/useSeitenBereit';
import OrgSwitcherButton from '../shared/OrgSwitcherButton';
import { ICON_ABMELDEN, ICON_ZURUECK } from '../shared/icons';
import './Seitenleiste.css';

// Die Leiste links der Web-Version (Simon, 02.10.2026: „eine moderne
// Web-Version mit einer Navi an der linken Seite, ein- und ausklappbar, die
// sich im Browser nativ anfühlt"; planung/web-version.md, Entscheidungen 1
// und 9).
//
// Sie erscheint nur im Browser ab 992 px Breite (navigation/breitesLayout.ts)
// und ersetzt dort die Reiterleiste unten. Ihr Inhalt kommt aus derselben
// Tabelle wie die Reiter (navigation/rollenBaeume.ts): erst die Reiter, dann
// die Eintraege `menue`, unten Gemeinde-Umschalter, Profil und Abmelden. Die
// Zahlen an den Eintraegen rechnet dieselbe Funktion wie die Reiterleiste
// (navigation/reiterZaehler.ts).
//
// Echte Links (<a href>) statt Knoepfe: Mittelklick und Strg-Klick oeffnen
// einen neuen Tab, Rechtsklick kopiert die Adresse, die Statuszeile zeigt
// das Ziel -- so fuehlt es sich im Browser nativ an. Ein einfacher Klick
// bleibt in der App (useIonRouter), ohne die Seite neu zu laden.

/** Wo sich der Browser merkt, ob die Leiste eingeklappt ist. */
export const SCHLUESSEL_EINGEKLAPPT = 'konfiquest.seitenleiste.eingeklappt';

// Speicher kann fehlen oder werfen (privates Fenster, gesperrte
// Website-Daten). Dann gilt die Voreinstellung (ausgeklappt) und die Leiste
// merkt sich nichts -- sie funktioniert trotzdem.
const leseEingeklappt = (): boolean => {
  try {
    return window.localStorage.getItem(SCHLUESSEL_EINGEKLAPPT) === '1';
  } catch {
    return false;
  }
};

const merkeEingeklappt = (eingeklappt: boolean): void => {
  try {
    window.localStorage.setItem(SCHLUESSEL_EINGEKLAPPT, eingeklappt ? '1' : '0');
  } catch {
    // Nicht merkbar -- bis zum Neuladen gilt der Zustand trotzdem.
  }
};

interface Eintrag extends MenueEintrag {
  badge?: BadgeKey;
}

const Seitenleiste: React.FC = () => {
  const { user, signOut } = useApp();
  const router = useIonRouter();
  const location = useAppLocation();
  const zaehler = useReiterZaehler();
  const [presentAlert] = useIonAlert();
  const [eingeklappt, setEingeklappt] = useState<boolean>(leseEingeklappt);

  // Dieselbe Regel wie MainTabs und useSeitenBereit -- sonst zeigte die
  // Leiste die Eintraege einer anderen Rolle als das Outlet daneben.
  const rolle = rolleVonUser(user, user?.role_name === 'super_admin');
  const baum = BAEUME[rolle];

  const oben: Eintrag[] = [
    ...baum.tabs.map(({ href, label, icon, badge }) => ({ path: href, label, icon, badge })),
    ...(baum.menue ?? []).filter((e) => !e.gruppe),
  ];
  // Gruppen in der Reihenfolge ihres ersten Auftretens in `menue`.
  const gruppen: Array<{ name: string; eintraege: Eintrag[] }> = [];
  for (const e of baum.menue ?? []) {
    if (!e.gruppe) continue;
    let gruppe = gruppen.find((g) => g.name === e.gruppe);
    if (!gruppe) {
      gruppe = { name: e.gruppe, eintraege: [] };
      gruppen.push(gruppe);
    }
    gruppe.eintraege.push(e);
  }

  const alle = [...oben, ...gruppen.flatMap((g) => g.eintraege), ...(baum.profil ? [baum.profil] : [])];
  const aktiv = aktiverPfad(location.pathname, alle.map((e) => e.path));

  const umschalten = () => {
    const neu = !eingeklappt;
    setEingeklappt(neu);
    merkeEingeklappt(neu);
  };

  const oeffne = useCallback((ereignis: React.MouseEvent<HTMLAnchorElement>, pfad: string) => {
    // Neuer Tab, neues Fenster, Herunterladen: Das erledigt der Browser.
    if (ereignis.button !== 0 || ereignis.metaKey || ereignis.ctrlKey || ereignis.shiftKey || ereignis.altKey) return;
    ereignis.preventDefault();
    if (location.pathname === pfad && !location.search) return;
    // Ohne Uebergangsanimation, wie ein Wechsel ueber die Reiterleiste.
    router.push(pfad, 'none', 'push');
  }, [location.pathname, location.search, router]);

  const abmelden = () => {
    presentAlert({
      header: 'Abmelden',
      message: 'Möchtest du dich wirklich abmelden?',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Abmelden',
          role: 'destructive',
          handler: async () => {
            await signOut();
          },
        },
      ],
    });
  };

  const link = (e: Eintrag) => {
    const istAktiv = e.path === aktiv;
    const n = e.badge ? zaehler[e.badge] : 0;
    return (
      <li key={`${e.path}|${e.label}`}>
        <a
          href={e.path}
          className={istAktiv ? 'app-seitenleiste__link app-seitenleiste__link--aktiv' : 'app-seitenleiste__link'}
          aria-current={istAktiv ? 'page' : undefined}
          // Eingeklappt steht nur das Symbol da -- der Name kommt als
          // Tooltip. Fuer Vorleseprogramme steht er ohnehin im Link.
          title={eingeklappt ? e.label : undefined}
          onClick={(ereignis) => oeffne(ereignis, e.path)}
        >
          <span className="app-seitenleiste__symbol">
            <IonIcon icon={e.icon} aria-hidden="true" />
            {n > 0 && (
              <IonBadge color="danger" className="app-seitenleiste__zahl" aria-hidden="true">
                {zaehlerText(n)}
              </IonBadge>
            )}
          </span>
          <span className="app-seitenleiste__text">{e.label}</span>
          {n > 0 && <span className="app-seitenleiste__vorlesen">, {n} offen</span>}
        </a>
      </li>
    );
  };

  return (
    <nav
      className={eingeklappt ? 'app-seitenleiste app-seitenleiste--eingeklappt' : 'app-seitenleiste'}
      aria-label="Hauptnavigation"
    >
      <div className="app-seitenleiste__kopf">
        <span className="app-seitenleiste__marke">
          <img src="/assets/icon/logo-mark.png" alt="" width={28} height={28} />
          <span className="app-seitenleiste__text">Konfi Quest</span>
        </span>
        <button
          type="button"
          className="app-seitenleiste__umschalter"
          onClick={umschalten}
          aria-expanded={!eingeklappt}
          aria-label={eingeklappt ? 'Leiste ausklappen' : 'Leiste einklappen'}
          title={eingeklappt ? 'Leiste ausklappen' : 'Leiste einklappen'}
        >
          <IonIcon icon={ICON_ZURUECK} className="app-seitenleiste__pfeil" aria-hidden="true" />
        </button>
      </div>

      <div className="app-seitenleiste__liste">
        <ul>{oben.map(link)}</ul>
        {gruppen.map((g) => (
          <section key={g.name} className="app-seitenleiste__gruppe" aria-label={g.name}>
            <h2 className="app-seitenleiste__gruppenname">
              <span className="app-seitenleiste__text">{g.name}</span>
            </h2>
            <ul>{g.eintraege.map(link)}</ul>
          </section>
        ))}
      </div>

      <div className="app-seitenleiste__fuss">
        {/* Blendet sich selbst aus, wenn das Konto nur einer Gemeinde
            angehoert (wie in der Kopfzeile jeder Seite). */}
        <div className="app-seitenleiste__gemeinde">
          <OrgSwitcherButton />
        </div>
        <ul>
          {baum.profil && link(baum.profil)}
          <li>
            <button
              type="button"
              className="app-seitenleiste__link"
              onClick={abmelden}
              title={eingeklappt ? 'Abmelden' : undefined}
            >
              <span className="app-seitenleiste__symbol">
                <IonIcon icon={ICON_ABMELDEN} aria-hidden="true" />
              </span>
              <span className="app-seitenleiste__text">Abmelden</span>
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Seitenleiste;
