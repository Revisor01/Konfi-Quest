import React from 'react';
import { IonIcon } from '@ionic/react';
import SlideBase from '../SlideBase';
import { getIconFromIoniconsName } from '../../../../utils/badgeIcons';
import type { SlideProps, TeamerErstesAbzeichenSlide as ErstesAbzeichen } from '../../../../types/wrapped';

interface TeamerErstesAbzeichenSlideProps extends SlideProps {
  abzeichen: ErstesAbzeichen;
}

/**
 * "Das erste Abzeichen" -- womit es losging.
 *
 * Dieselbe Idee wie beim ersten Termin: nicht wie viele, sondern welches
 * zuerst. Deshalb steht die Seite direkt nach der Abzeichen-Seite -- sie
 * zeigt dieselbe Sache aus der Naehe.
 */
const datumText = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
};

const TeamerErstesAbzeichenSlide: React.FC<TeamerErstesAbzeichenSlideProps> = ({ isActive, abzeichen }) => (
  <SlideBase isActive={isActive} className="teamer-erstes-abzeichen-slide" kachel="teamer-erstes-abzeichen">
    <div className="kat-auge">Das erste</div>
    <div
      className="teamer-erstes-abzeichen__kreis"
      style={{ background: abzeichen.color || 'rgba(255,255,255,0.2)' }}
    >
      <IonIcon icon={getIconFromIoniconsName(abzeichen.icon)} />
    </div>
    <div className="kat-slogan">
      <span style={{ display: 'block' }}>Damit ging</span>
      <span style={{ display: 'block' }}>es los.</span>
    </div>
    <div className="kat-nachsatz">{abzeichen.name}</div>
    {datumText(abzeichen.datum) && <div className="kat-fussnote">Am {datumText(abzeichen.datum)}</div>}
  </SlideBase>
);

export default TeamerErstesAbzeichenSlide;
