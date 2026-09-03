import React from 'react';
import { IonIcon } from '@ionic/react';
import { heartOutline, arrowForwardOutline } from 'ionicons/icons';
import SlideBase from './SlideBase';
import type { SlideProps } from '../../../types/wrapped';

/**
 * Die letzte Seite eines Konfi-Rueckblicks: die Einladung ins Team.
 *
 * SIMONS VORGABE (03.09.2026): "Eine letzte Seite bei Konfis: Werde
 * Teamerin."
 *
 * WARUM EINE EIGENE SEITE: Die Einladung stand bisher als kleine Zeile unter
 * der Bilanz auf der Abschluss-Seite -- zwischen Punkten, Terminen und
 * Abzeichen ging sie unter. Als eigene, letzte Seite ist sie das, was am
 * Ende stehen bleibt.
 *
 * TON: Einladend, nicht werbend. Es ist eine Kirchen-App, kein
 * Mitgliederwerbe-Formular. Deshalb keine Handlungsaufforderung mit
 * Ausrufezeichen, sondern eine offene Tuer.
 */
const WerdeTeamerSlide: React.FC<SlideProps> = ({ isActive }) => (
  <SlideBase isActive={isActive} className="werde-teamer-slide" kachel="werde-teamer">
    <div className="kat-auge">Und jetzt?</div>

    <div className="kat-slogan">
      <span style={{ display: 'block' }}>Bleib</span>
      <span style={{ display: 'block' }}>dabei.</span>
    </div>

    <div className="kat-nachsatz">
      Als Teamer:in gestaltest du das nächste Konfi-Jahr mit — für die,
      die jetzt anfangen, wo du angefangen hast.
    </div>

    <div className="w-einladung" style={{ marginTop: 22 }}>
      <IonIcon icon={heartOutline} />
      <span>Sprich einfach jemanden aus dem Team an</span>
    </div>

    <div className="teamer-pfeil" aria-hidden="true">
      <IonIcon icon={arrowForwardOutline} />
    </div>
  </SlideBase>
);

export default WerdeTeamerSlide;
