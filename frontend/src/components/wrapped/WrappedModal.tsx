import React, { useState, useEffect, useCallback } from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';
import { closeOutline } from 'ionicons/icons';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, EffectCreative } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import api from '../../services/api';
import type { KonfiWrappedData } from '../../types/wrapped';
import IntroSlide from './slides/IntroSlide';
import PunkteSlide from './slides/PunkteSlide';
import EventsSlide from './slides/EventsSlide';
import BadgesSlide from './slides/BadgesSlide';
import AktivsterMonatSlide from './slides/AktivsterMonatSlide';
import ChatSlide from './slides/ChatSlide';
import EndspurtSlide from './slides/EndspurtSlide';
import AbschlussSlide from './slides/AbschlussSlide';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-creative';
import './WrappedModal.css';

interface WrappedModalProps {
  onClose: () => void;
  displayName: string;
  jahrgangName: string;
}

const WrappedModal: React.FC<WrappedModalProps> = ({ onClose, displayName, jahrgangName }) => {
  const [data, setData] = useState<KonfiWrappedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    api.get('/wrapped/me')
      .then((res) => {
        setData(res.data.data);
        setYear(res.data.year);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('Dein Wrapped wird bald freigeschaltet');
        } else {
          setError('Fehler beim Laden');
        }
      });
  }, []);

  const handleSlideChange = useCallback((swiper: SwiperType) => {
    setActiveIndex(swiper.activeIndex);
  }, []);

  // Slides dynamisch aufbauen (Endspurt nur wenn aktiv)
  const buildSlides = () => {
    if (!data || !year) return [];

    const slides: Array<{ key: string; content: React.ReactNode }> = [];
    let slideIndex = 0;

    // 0: Intro
    slides.push({
      key: 'intro',
      content: (
        <IntroSlide
          isActive={activeIndex === slideIndex}
          displayName={displayName}
          jahrgangName={jahrgangName}
          year={year}
        />
      ),
    });
    slideIndex++;

    // 1: Punkte
    slides.push({
      key: 'punkte',
      content: (
        <PunkteSlide
          isActive={activeIndex === slideIndex}
          punkte={data.slides.punkte}
        />
      ),
    });
    slideIndex++;

    // 2: Events
    slides.push({
      key: 'events',
      content: (
        <EventsSlide
          isActive={activeIndex === slideIndex}
          events={data.slides.events}
        />
      ),
    });
    slideIndex++;

    // 3: Badges
    slides.push({
      key: 'badges',
      content: (
        <BadgesSlide
          isActive={activeIndex === slideIndex}
          badges={data.slides.badges}
        />
      ),
    });
    slideIndex++;

    // 4: Aktivster Monat
    slides.push({
      key: 'aktivster-monat',
      content: (
        <AktivsterMonatSlide
          isActive={activeIndex === slideIndex}
          aktivsterMonat={data.slides.aktivster_monat}
        />
      ),
    });
    slideIndex++;

    // 5: Chat
    slides.push({
      key: 'chat',
      content: (
        <ChatSlide
          isActive={activeIndex === slideIndex}
          chat={data.slides.chat}
        />
      ),
    });
    slideIndex++;

    // 6: Endspurt (nur wenn aktiv)
    if (data.slides.endspurt.aktiv) {
      slides.push({
        key: 'endspurt',
        content: (
          <EndspurtSlide
            isActive={activeIndex === slideIndex}
            endspurt={data.slides.endspurt}
          />
        ),
      });
      slideIndex++;
    }

    // Letzter Slide: Abschluss
    slides.push({
      key: 'abschluss',
      content: (
        <AbschlussSlide
          isActive={activeIndex === slideIndex}
          data={data}
          year={year}
        />
      ),
    });

    return slides;
  };

  const slides = data ? buildSlides() : [];

  return (
    <div className="wrapped-overlay">
      <div className="wrapped-header">
        <div className="wrapped-pagination" />
        <button className="wrapped-close-btn" onClick={onClose} aria-label="Schlie&szlig;en">
          <IonIcon icon={closeOutline} />
        </button>
      </div>

      {error ? (
        <div className="wrapped-error">{error}</div>
      ) : !data ? (
        <div className="wrapped-loading">
          <IonSpinner />
        </div>
      ) : (
        <Swiper
          modules={[Pagination, EffectCreative]}
          effect="creative"
          creativeEffect={{
            prev: { translate: ['-100%', 0, -200], scale: 0.9, opacity: 0 },
            next: { translate: ['100%', 0, -200], scale: 0.9, opacity: 0 },
          }}
          pagination={{ clickable: true, el: '.wrapped-pagination' }}
          onSlideChange={handleSlideChange}
          speed={400}
          className="wrapped-swiper"
        >
          {slides.map((slide) => (
            <SwiperSlide key={slide.key}>{slide.content}</SwiperSlide>
          ))}
        </Swiper>
      )}
    </div>
  );
};

export default WrappedModal;
