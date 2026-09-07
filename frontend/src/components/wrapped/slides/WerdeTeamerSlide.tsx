import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_HERZ } from '../../shared/icons';
import SlideBase from './SlideBase';
import type { SlideProps } from '../../../types/wrapped';

/**
 * Die vorletzte Seite eines Konfi-Rueckblicks: die Einladung ins Team.
 *
 * SIMONS VORGABE (03.09.2026): "Eine letzte Seite bei Konfis: Werde
 * Teamerin."
 *
 * WARUM EINE EIGENE SEITE: Die Einladung stand bisher als kleine Zeile unter
 * der Bilanz auf der Abschluss-Seite -- zwischen Punkten, Terminen und
 * Abzeichen ging sie unter. Als eigene Seite ist sie das, was haengen
 * bleibt.
 *
 * SEIT DEM 07.09.2026 STEHT SIE VORLETZTE, nicht mehr letzte (Simon: "Die
 * Teamer Folie als vorletztes"). Danach kommt der Abschluss -- die Seite,
 * die geteilt wird. Weil die Einladung damit direkt VOR dem Abschluss
 * steht, ist die gleichlautende Zeile dort entfallen; sie haette sonst
 * zweimal hintereinander gestanden.
 *
 * DER PFEIL IST WEG (Simon, 07.09.2026: "Sprich jemanden an kommt der Pfeil
 * weg"). Er zeigte nach rechts und deutete damit "weiterblaettern" an --
 * genau das war ab hier falsch, denn nach dieser Seite kommt noch der
 * Abschluss. Und ueber einer Einladung wirkte er wie eine
 * Handlungsaufforderung, die zum Weitergehen draengt.
 *
 * TON: Einladend, nicht werbend. Es ist eine Kirchen-App, kein
 * Mitgliederwerbe-Formular. Deshalb keine Handlungsaufforderung mit
 * Ausrufezeichen, sondern eine offene Tuer -- und ein konkreter erster
 * Schritt, der niemanden ueberfordert: eine Nachricht schreiben.
 */
const WerdeTeamerSlide: React.FC<SlideProps> = ({ isActive }) => (
  <SlideBase isActive={isActive} className="werde-teamer-slide" kachel="werde-teamer">
    <div className="kat-auge">Und jetzt?</div>

    <div className="kat-slogan">
      <span style={{ display: 'block' }}>Bleib</span>
      <span style={{ display: 'block' }}>dabei.</span>
    </div>

    <div className="kat-nachsatz">
      Schreib einfach jemandem aus dem Team. Und gestalte mit —
      die Kirche und den Glauben von morgen.
    </div>

    {/* 22px ist Wrapped-Feinjustierung ausserhalb der Abstands-Skala -- bleibt bewusst roh (05.09.2026) */}
    <div className="w-einladung" style={{ marginTop: 22 }}>
      <IonIcon icon={ICON_HERZ} />
      <span>Für die, die jetzt anfangen, wo du angefangen hast</span>
    </div>
  </SlideBase>
);

export default WerdeTeamerSlide;
