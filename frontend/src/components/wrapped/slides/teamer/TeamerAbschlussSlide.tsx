import React from 'react';
import { IonIcon } from '@ionic/react';
import { calendarOutline, peopleOutline, ribbonOutline } from 'ionicons/icons';
import SlideBase from '../SlideBase';
import type { SlideProps, TeamerWrappedData } from '../../../../types/wrapped';

interface Props extends SlideProps {
  data: TeamerWrappedData;
  year: number;
  titel?: string | null;
}

/**
 * Der Schluss des Teamer-Rueckblicks.
 *
 * DABEI BEHOBEN (03.09.2026): Die alte Fassung setzte `opacity: 0` fest auf
 * die Inhalte und verliess sich darauf, dass eine Animation sie wieder
 * einblendet. Greift die nicht (reduzierte Bewegung, unterbrochener
 * Seitenwechsel), blieb die Seite leer.
 */
const TeamerAbschlussSlide: React.FC<Props> = ({ isActive, data, year, titel }) => {
  const zahlen = [
    { icon: calendarOutline, wert: data.slides.events_geleitet.total, label: 'Termine' },
    { icon: peopleOutline, wert: data.slides.konfis_betreut.total_konfis, label: 'Konfis' },
    { icon: ribbonOutline, wert: data.slides.badges.total_earned, label: 'Abzeichen' },
  ];

  return (
    <SlideBase isActive={isActive} className="teamer-abschluss-slide" kachel="teamer-abschluss">
      <div className="kat-auge">{titel?.trim() || `Dein Teamer-Jahr ${year}`}</div>

      <div className="kat-slogan">
        <span style={{ display: 'block' }}>Danke,</span>
        <span style={{ display: 'block' }}>dass du</span>
        <span style={{ display: 'block' }}>da warst.</span>
      </div>

      <div className="w-bilanz">
        {zahlen.map((s, i) => (
          <div key={i} className="w-bilanz__zeile">
            <IonIcon icon={s.icon} />
            <b>{s.wert}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="kat-nachsatz" style={{ marginTop: 16 }}>
        Ohne Leute wie dich gaebe es keine Konfi-Zeit.
      </div>
    </SlideBase>
  );
};

export default TeamerAbschlussSlide;
