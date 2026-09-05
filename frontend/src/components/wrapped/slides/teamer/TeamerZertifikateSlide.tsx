import React from 'react';
import SlideBase from '../SlideBase';
import type { SlideProps, TeamerZertifikateSlide as Zert } from '../../../../types/wrapped';

interface Props extends SlideProps { zertifikate: Zert; }

const TeamerZertifikateSlide: React.FC<Props> = ({ isActive, zertifikate }) => {
  const n = zertifikate.total;
  const slogan = n >= 3
    ? ['Schwarz', 'auf weiss.']
    : n >= 1
      ? ['Das hast du', 'schriftlich.']
      : ['Dein erstes', 'Zertifikat', 'kommt noch.'];
  const nachsatz = n >= 1
    ? `${n} ${n === 1 ? 'Zertifikat' : 'Zertifikate'} fuer deine Ausbildung — das zaehlt auch ausserhalb der Gemeinde.`
    : 'Zertifikate gibt es für Schulungen und Kurse.';

  return (
    <SlideBase isActive={isActive} className="teamer-zertifikate-slide" kachel="teamer-zertifikate">
      <div className="kat-auge">Deine Zertifikate</div>
      {n > 0 && <div className="kat-zahl">{n}</div>}
      <div className="kat-slogan">
        {slogan.map((z, i) => <span key={i} style={{ display: 'block' }}>{z}</span>)}
      </div>
      <div className="kat-nachsatz">{nachsatz}</div>
      {zertifikate.zertifikate?.length > 0 && (
        <div className="w-merkzettel">
          <span className="w-merkzettel__label">Zuletzt</span>
          <span className="w-merkzettel__wert">{zertifikate.zertifikate[0].name}</span>
        </div>
      )}
    </SlideBase>
  );
};

export default TeamerZertifikateSlide;
