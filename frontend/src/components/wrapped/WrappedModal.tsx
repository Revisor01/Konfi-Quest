import React, { useState, useEffect, useCallback } from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';
import { closeOutline } from 'ionicons/icons';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, EffectCreative } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import api from '../../services/api';
import type { KonfiWrappedData } from '../../types/wrapped';
import SlideBase from './slides/SlideBase';
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

  // Slides aufbauen (dynamisch, Endspurt nur wenn aktiv)
  const buildSlides = () => {
    if (!data) return [];

    const slides: Array<{ key: string; content: React.ReactNode }> = [];

    // 0: Intro
    slides.push({
      key: 'intro',
      content: (
        <SlideBase isActive={activeIndex === slides.length}>
          <div className="wrapped-anim-fade wrapped-anim-delay-1">
            <p className="wrapped-subtitle">Dein Jahr in der Gemeinde</p>
          </div>
          <div className="wrapped-anim-scale wrapped-anim-delay-2">
            <h1 className="wrapped-big-number">{year}</h1>
          </div>
          <div className="wrapped-anim-fade wrapped-anim-delay-3">
            <p className="wrapped-subtitle">{displayName} - {jahrgangName}</p>
          </div>
        </SlideBase>
      ),
    });

    // 1: Punkte
    slides.push({
      key: 'punkte',
      content: (
        <SlideBase isActive={activeIndex === slides.length}>
          <div className="wrapped-anim-fade">
            <p className="wrapped-label">Deine Punkte</p>
          </div>
          <div className="wrapped-anim-scale wrapped-anim-delay-1">
            <h1 className="wrapped-big-number">{data.slides.punkte.total}</h1>
          </div>
          <div className="wrapped-anim-fade wrapped-anim-delay-2">
            <p className="wrapped-subtitle">
              {data.slides.punkte.gottesdienst} Gottesdienst + {data.slides.punkte.gemeinde} Gemeinde
            </p>
          </div>
        </SlideBase>
      ),
    });

    // 2: Events
    slides.push({
      key: 'events',
      content: (
        <SlideBase isActive={activeIndex === slides.length}>
          <div className="wrapped-anim-fade">
            <p className="wrapped-label">Events besucht</p>
          </div>
          <div className="wrapped-anim-scale wrapped-anim-delay-1">
            <h1 className="wrapped-big-number">
              {data.slides.events.total_attended}/{data.slides.events.total_available}
            </h1>
          </div>
          {data.slides.events.lieblings_event && (
            <div className="wrapped-anim-fade wrapped-anim-delay-2">
              <p className="wrapped-subtitle">
                Lieblingsevent: {data.slides.events.lieblings_event.name}
              </p>
            </div>
          )}
        </SlideBase>
      ),
    });

    // 3: Badges
    slides.push({
      key: 'badges',
      content: (
        <SlideBase isActive={activeIndex === slides.length}>
          <div className="wrapped-anim-fade">
            <p className="wrapped-label">Badges verdient</p>
          </div>
          <div className="wrapped-anim-scale wrapped-anim-delay-1">
            <h1 className="wrapped-big-number">
              {data.slides.badges.total_earned}/{data.slides.badges.total_available}
            </h1>
          </div>
        </SlideBase>
      ),
    });

    // 4: Aktivster Monat
    slides.push({
      key: 'aktivster-monat',
      content: (
        <SlideBase isActive={activeIndex === slides.length}>
          <div className="wrapped-anim-fade">
            <p className="wrapped-label">Dein aktivster Monat</p>
          </div>
          <div className="wrapped-anim-scale wrapped-anim-delay-1">
            <h1 className="wrapped-big-number">{data.slides.aktivster_monat.monat_name}</h1>
          </div>
          <div className="wrapped-anim-fade wrapped-anim-delay-2">
            <p className="wrapped-subtitle">
              {data.slides.aktivster_monat.aktivitaeten} Aktivit&auml;ten
            </p>
          </div>
        </SlideBase>
      ),
    });

    // 5: Chat
    slides.push({
      key: 'chat',
      content: (
        <SlideBase isActive={activeIndex === slides.length}>
          <div className="wrapped-anim-fade">
            <p className="wrapped-label">Nachrichten gesendet</p>
          </div>
          <div className="wrapped-anim-scale wrapped-anim-delay-1">
            <h1 className="wrapped-big-number">{data.slides.chat.nachrichten_gesendet}</h1>
          </div>
        </SlideBase>
      ),
    });

    // 6: Endspurt (nur wenn aktiv)
    if (data.slides.endspurt.aktiv) {
      slides.push({
        key: 'endspurt',
        content: (
          <SlideBase isActive={activeIndex === slides.length}>
            <div className="wrapped-anim-fade">
              <p className="wrapped-label">Endspurt!</p>
            </div>
            <div className="wrapped-anim-scale wrapped-anim-delay-1">
              <h1 className="wrapped-big-number">{data.slides.endspurt.fehlende_punkte}</h1>
            </div>
            <div className="wrapped-anim-fade wrapped-anim-delay-2">
              <p className="wrapped-subtitle">
                Punkte fehlen noch ({data.slides.endspurt.aktuell_total}/{data.slides.endspurt.ziel_total})
              </p>
            </div>
          </SlideBase>
        ),
      });
    }

    // 7: Abschluss
    slides.push({
      key: 'abschluss',
      content: (
        <SlideBase isActive={activeIndex === slides.length}>
          <div className="wrapped-anim-scale">
            <h1 className="wrapped-big-number wrapped-anim-delay-1">Danke!</h1>
          </div>
          <div className="wrapped-anim-fade wrapped-anim-delay-2">
            <p className="wrapped-subtitle">
              F&uuml;r ein tolles Jahr in der Gemeinde
            </p>
          </div>
        </SlideBase>
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
