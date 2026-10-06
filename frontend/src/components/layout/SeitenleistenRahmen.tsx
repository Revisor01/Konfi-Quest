import React from 'react';
import { IonSplitPane } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import { istWebVersion, useBreitesLayout } from '../../navigation/breitesLayout';
import { useRollenfarbeImDokument } from '../../navigation/rollenfarbeImDokument';
import Seitenleiste from './Seitenleiste';

/** Kennung des Hauptbereichs neben der Leiste (das Outlet aus App.tsx). */
export const INHALT_ID = 'app-inhalt';

/**
 * Der Rahmen um das Outlet der angemeldeten App: in der Web-Version eine
 * IonSplitPane mit der Leiste links, in den Apps gar nichts.
 *
 * WARUM DIE FORM NICHT VON DER BREITE ABHAENGT (03.10.2026):
 * Ein IonRouterOutlet registriert seine Seiten beim Einhaengen und bemerkt
 * es nicht, wenn sein Baum spaeter getauscht wird -- weisse Seiten, mehrfach
 * in dieser App passiert (MainTabs.tsx, keinTauschImOutlet.test.ts). Zoege
 * der Rahmen die Split-Pane erst ab 992 px ein, haengte jedes Ziehen des
 * Fensters ueber diese Grenze das Outlet an eine andere Stelle, und React
 * montierte es neu. Deshalb steht die Split-Pane in der Web-Version IMMER;
 * die Breite schaltet nur ihr `when` und blendet die Leiste davor ein. Das
 * Outlet bleibt an derselben Stelle und wird nie neu montiert.
 *
 * In den Apps ist die Plattform fuer die ganze Sitzung fest: Dort gibt der
 * Rahmen das Outlet unveraendert zurueck, ohne Huelle, ohne Kennung -- der
 * Baum ist derselbe wie vor der Web-Version.
 */
const SeitenleistenRahmen: React.FC<{ children: React.ReactElement<{ id?: string }> }> = ({ children }) => {
  const breit = useBreitesLayout();
  const { user } = useApp();
  const web = istWebVersion();
  // Gewählte Filter der Web-Fassung stehen in der Rollenfarbe (06.10.2026).
  useRollenfarbeImDokument(web ? user?.role_name : null);
  if (!web) return children;
  return (
    <IonSplitPane when={breit} contentId={INHALT_ID} className="app-seitenleisten-rahmen">
      {/* Im schmalen Fenster steht hier `false` -- der Platz bleibt belegt,
          das Outlet dahinter behaelt seine Stelle. */}
      {breit && <Seitenleiste />}
      {React.cloneElement(children, { id: INHALT_ID })}
    </IonSplitPane>
  );
};

export default SeitenleistenRahmen;
