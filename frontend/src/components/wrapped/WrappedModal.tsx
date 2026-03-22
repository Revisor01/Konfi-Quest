import React, { useState, useEffect, useCallback, useRef } from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';
import { closeOutline, shareOutline } from 'ionicons/icons';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, EffectCreative } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import api from '../../services/api';
import type { KonfiWrappedData, TeamerWrappedData, WrappedResponse } from '../../types/wrapped';
import IntroSlide from './slides/IntroSlide';
import PunkteSlide from './slides/PunkteSlide';
import EventsSlide from './slides/EventsSlide';
import BadgesSlide from './slides/BadgesSlide';
import AktivsterMonatSlide from './slides/AktivsterMonatSlide';
import ChatSlide from './slides/ChatSlide';
import EndspurtSlide from './slides/EndspurtSlide';
import AbschlussSlide from './slides/AbschlussSlide';
import TeamerIntroSlide from './slides/teamer/TeamerIntroSlide';
import TeamerEventsSlide from './slides/teamer/TeamerEventsSlide';
import TeamerKonfisSlide from './slides/teamer/TeamerKonfisSlide';
import TeamerBadgesSlide from './slides/teamer/TeamerBadgesSlide';
import TeamerZertifikateSlide from './slides/teamer/TeamerZertifikateSlide';
import TeamerJahreSlide from './slides/teamer/TeamerJahreSlide';
import TeamerAbschlussSlide from './slides/teamer/TeamerAbschlussSlide';
import ShareCard from './share/ShareCard';
import { shareSlide } from './share/shareUtils';
import type { ShareTextData } from './share/shareUtils';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-creative';
import './WrappedModal.css';
import './share/ShareCard.css';

interface WrappedModalProps {
  onClose: () => void;
  displayName: string;
  jahrgangName?: string;
  wrappedType?: 'konfi' | 'teamer';
}

const WrappedModal: React.FC<WrappedModalProps> = ({ onClose, displayName, jahrgangName, wrappedType: initialType }) => {
  const [data, setData] = useState<KonfiWrappedData | TeamerWrappedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [year, setYear] = useState<number | null>(null);
  const [wrappedType, setWrappedType] = useState<'konfi' | 'teamer'>(initialType || 'konfi');
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/wrapped/me')
      .then((res) => {
        const response = res.data as WrappedResponse;
        setData(response.data);
        setYear(response.year);
        setWrappedType(response.wrapped_type);
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

  // Text-Fallback-Daten pro Slide zusammenbauen
  const getSlideTextData = (slideKey: string): ShareTextData => {
    const slideYear = year || new Date().getFullYear();
    const base: ShareTextData = { wrappedType, displayName, year: slideYear, slideKey };

    if (!data) return base;

    if (wrappedType === 'konfi') {
      const k = data as KonfiWrappedData;
      switch (slideKey) {
        case 'punkte': return { ...base, slideValue: `${k.slides.punkte.total} Punkte gesammelt` };
        case 'events': return { ...base, slideValue: `${k.slides.events.total_attended} Events besucht` };
        case 'badges': return { ...base, slideValue: `${k.slides.badges.total_earned} Badges verdient` };
        case 'aktivster-monat': return { ...base, slideValue: `Aktivster Monat: ${k.slides.aktivster_monat.monat_name}` };
        case 'chat': return { ...base, slideValue: `${k.slides.chat.nachrichten_gesendet} Nachrichten` };
        case 'endspurt': return { ...base, slideValue: `Noch ${k.slides.endspurt.fehlende_punkte} Punkte bis zum Ziel` };
        case 'abschluss': return { ...base, slideValue: `${k.slides.punkte.total} Punkte, ${k.slides.events.total_attended} Events, ${k.slides.badges.total_earned} Badges` };
        default: return base;
      }
    } else {
      const t = data as TeamerWrappedData;
      switch (slideKey) {
        case 'teamer-events': return { ...base, slideValue: `${t.slides.events_geleitet.total} Events geleitet` };
        case 'teamer-konfis': return { ...base, slideValue: `${t.slides.konfis_betreut.total_konfis} Konfis betreut` };
        case 'teamer-badges': return { ...base, slideValue: `${t.slides.badges.total_earned} Badges verdient` };
        case 'teamer-zertifikate': return { ...base, slideValue: `${t.slides.zertifikate.total} Zertifikate erhalten` };
        case 'teamer-jahre': return { ...base, slideValue: `${t.slides.engagement.jahre_aktiv} Jahre als Teamer:in` };
        case 'teamer-abschluss': return { ...base, slideValue: `${t.slides.events_geleitet.total} Events, ${t.slides.konfis_betreut.total_konfis} Konfis, ${t.slides.badges.total_earned} Badges` };
        default: return base;
      }
    }
  };

  // Konfi-Slides aufbauen (Endspurt nur wenn aktiv)
  const buildKonfiSlides = (konfiData: KonfiWrappedData, slideYear: number) => {
    const slides: Array<{ key: string; content: React.ReactNode }> = [];
    let slideIndex = 0;

    slides.push({
      key: 'intro',
      content: (
        <IntroSlide
          isActive={activeIndex === slideIndex}
          displayName={displayName}
          jahrgangName={jahrgangName || ''}
          year={slideYear}
        />
      ),
    });
    slideIndex++;

    slides.push({
      key: 'punkte',
      content: <PunkteSlide isActive={activeIndex === slideIndex} punkte={konfiData.slides.punkte} />,
    });
    slideIndex++;

    slides.push({
      key: 'events',
      content: <EventsSlide isActive={activeIndex === slideIndex} events={konfiData.slides.events} />,
    });
    slideIndex++;

    slides.push({
      key: 'badges',
      content: <BadgesSlide isActive={activeIndex === slideIndex} badges={konfiData.slides.badges} />,
    });
    slideIndex++;

    slides.push({
      key: 'aktivster-monat',
      content: <AktivsterMonatSlide isActive={activeIndex === slideIndex} aktivsterMonat={konfiData.slides.aktivster_monat} />,
    });
    slideIndex++;

    slides.push({
      key: 'chat',
      content: <ChatSlide isActive={activeIndex === slideIndex} chat={konfiData.slides.chat} />,
    });
    slideIndex++;

    if (konfiData.slides.endspurt.aktiv) {
      slides.push({
        key: 'endspurt',
        content: <EndspurtSlide isActive={activeIndex === slideIndex} endspurt={konfiData.slides.endspurt} />,
      });
      slideIndex++;
    }

    slides.push({
      key: 'abschluss',
      content: <AbschlussSlide isActive={activeIndex === slideIndex} data={konfiData} year={slideYear} />,
    });

    return slides;
  };

  // Teamer-Slides aufbauen (7 Slides)
  const buildTeamerSlides = (teamerData: TeamerWrappedData, slideYear: number) => {
    const slides: Array<{ key: string; content: React.ReactNode }> = [];
    let slideIndex = 0;

    slides.push({
      key: 'teamer-intro',
      content: <TeamerIntroSlide isActive={activeIndex === slideIndex} displayName={displayName} year={slideYear} />,
    });
    slideIndex++;

    slides.push({
      key: 'teamer-events',
      content: <TeamerEventsSlide isActive={activeIndex === slideIndex} events={teamerData.slides.events_geleitet} />,
    });
    slideIndex++;

    slides.push({
      key: 'teamer-konfis',
      content: <TeamerKonfisSlide isActive={activeIndex === slideIndex} konfis={teamerData.slides.konfis_betreut} />,
    });
    slideIndex++;

    slides.push({
      key: 'teamer-badges',
      content: <TeamerBadgesSlide isActive={activeIndex === slideIndex} badges={teamerData.slides.badges} />,
    });
    slideIndex++;

    slides.push({
      key: 'teamer-zertifikate',
      content: <TeamerZertifikateSlide isActive={activeIndex === slideIndex} zertifikate={teamerData.slides.zertifikate} />,
    });
    slideIndex++;

    slides.push({
      key: 'teamer-jahre',
      content: <TeamerJahreSlide isActive={activeIndex === slideIndex} engagement={teamerData.slides.engagement} />,
    });
    slideIndex++;

    slides.push({
      key: 'teamer-abschluss',
      content: <TeamerAbschlussSlide isActive={activeIndex === slideIndex} data={teamerData} year={slideYear} />,
    });

    return slides;
  };

  // Slides dynamisch aufbauen basierend auf wrappedType
  const buildSlides = () => {
    if (!data || !year) return [];

    if (wrappedType === 'teamer') {
      return buildTeamerSlides(data as TeamerWrappedData, year);
    }
    return buildKonfiSlides(data as KonfiWrappedData, year);
  };

  const slides = data ? buildSlides() : [];

  // Share-Handler (nach slides-Deklaration)
  const handleShare = async () => {
    if (isSharing || !shareCardRef.current || !data) return;
    setIsSharing(true);
    try {
      const currentKey = slides[activeIndex]?.key || 'intro';
      const textData = getSlideTextData(currentKey);
      await shareSlide(shareCardRef.current, currentKey, wrappedType, textData);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className={`wrapped-overlay${wrappedType === 'teamer' ? ' wrapped-overlay--teamer' : ''}`}>
      <div className="wrapped-header">
        <div className="wrapped-pagination" />
        {data && (
          <button className="wrapped-share-btn" onClick={handleShare} disabled={isSharing} aria-label="Teilen">
            <IonIcon icon={shareOutline} />
          </button>
        )}
        <button className="wrapped-close-btn" onClick={onClose} aria-label="Schlie\u00dfen">
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

      {data && year && (
        <ShareCard
          ref={shareCardRef}
          slideKey={slides[activeIndex]?.key || 'intro'}
          data={data}
          wrappedType={wrappedType}
          displayName={displayName}
          jahrgangName={jahrgangName}
          year={year}
        />
      )}
    </div>
  );
};

export default WrappedModal;
