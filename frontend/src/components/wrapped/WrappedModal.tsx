import React, { useState, useEffect, useCallback, useRef } from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';
import { closeOutline, shareOutline } from 'ionicons/icons';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCreative } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import api from '../../services/api';
import type { KonfiWrappedData, TeamerWrappedData, WrappedResponse } from '../../types/wrapped';
import IntroSlide from './slides/IntroSlide';
import PunkteSlide from './slides/PunkteSlide';
import EventsSlide from './slides/EventsSlide';
import BadgesSlide from './slides/BadgesSlide';
import AktivsterMonatSlide from './slides/AktivsterMonatSlide';
import ChallengeMomenteSlide from './slides/ChallengeMomenteSlide';
import HighlightSlide, { rendertHighlightSlide } from './slides/HighlightSlide';
import EndspurtSlide from './slides/EndspurtSlide';
import KategorieSlide from './slides/KategorieSlide';
import UeberDasZielSlide from './slides/UeberDasZielSlide';
import AbschlussSlide from './slides/AbschlussSlide';
import KonfirmationsSlide from './slides/KonfirmationsSlide';
import KategorieSeiteSlide from './slides/KategorieSeiteSlide';
import SeltenstesAbzeichenSlide from './slides/SeltenstesAbzeichenSlide';
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
  // Für Wiederansicht — wenn gesetzt, wird NICHT /api/wrapped/me geladen
  initialData?: KonfiWrappedData | TeamerWrappedData;
  initialYear?: number;
  /** Name der Ausgabe -- steht auf der ersten Seite. */
  initialTitel?: string | null;
}

// Formulierungs-Varianten pro Slide-Typ, Auswahl per seed
const FORMULIERUNGEN: Record<string, string[]> = {
  punkte_titel: [
    'Deine Punkte',
    'So viel geschafft!',
    'Punkte-Bilanz',
    'Dein Punktestand'
  ],
  events_titel: [
    'Deine Events',
    'Dabei gewesen!',
    'Mittendrin!',
    'Event-Bilanz'
  ],
  badges_titel: [
    'Deine Badges',
    'Ausgezeichnet!',
    'Badge-Sammlung',
    'Verdient!'
  ],
  aktivster_monat_titel: [
    'Dein aktivster Monat',
    'Hochphase!',
    'Voll dabei!',
    'Dein Top-Monat'
  ],
  kategorie_titel: [
    'Dein Bereich',
    'Deine Stärke',
    'Das liegt dir!',
    'Dein Schwerpunkt'
  ],
  abschluss_titel: [
    'Dein Konfi-Jahr',
    'Was für ein Jahr!',
    'Starke Leistung!',
    'Dein Rückblick'
  ]
};

function getFormulierung(key: string, seed: number): string {
  const variants = FORMULIERUNGEN[key];
  if (!variants || variants.length === 0) return key;
  return variants[seed % variants.length];
}

/**
 * Der Konfirmationstermin eines Konfi-Snapshots.
 *
 * Ab 01.09.2026 liefert das Backend ihn als eigenes Feld `zeitraum.konfirmation`
 * (null, wenn der Jahrgang keinen Konfirmations-Termin hat). Vorher wurde
 * `zeitraum.ende` dafuer verwendet -- das war bei Jahrgaengen ohne Termin das
 * Ende des Fallback-Zeitraums und damit ein erfundenes Datum.
 *
 * Alt-Snapshots (ohne das Feld) fallen weiterhin auf `ende` zurueck, damit
 * bereits erzeugte Rueckblicke unveraendert aussehen.
 */
const konfirmationsTermin = (data: KonfiWrappedData): string | null => {
  const z = data.slides.zeitraum;
  if (!z) return null;
  if ('konfirmation' in z) return z.konfirmation || null;
  return z.ende || null;
};

const WrappedModal: React.FC<WrappedModalProps> = ({ onClose, displayName, jahrgangName, wrappedType: initialType, initialData, initialYear, initialTitel }) => {
  const [data, setData] = useState<KonfiWrappedData | TeamerWrappedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [year, setYear] = useState<number | null>(null);
  // Der Name der Ausgabe fuer die erste Seite ("Willkommen zu deinem
  // Zwischenstand"). Kommt bei der Wiederansicht als Prop, sonst von
  // GET /wrapped/me.
  const [titel, setTitel] = useState<string | null>(initialTitel ?? null);
  const [wrappedType, setWrappedType] = useState<'konfi' | 'teamer'>(initialType || 'konfi');
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Wiederansicht: gespeicherte Daten direkt verwenden
    if (initialData && initialYear) {
      setData(initialData);
      setYear(initialYear);
      if (initialTitel !== undefined) setTitel(initialTitel);
      if (initialType) setWrappedType(initialType);
      return;
    }
    api.get('/wrapped/me')
      .then((res) => {
        const response = res.data as WrappedResponse;
        setData(response.data);
        setYear(response.year);
        setWrappedType(response.wrapped_type);
        setTitel((response as WrappedResponse & { titel?: string | null }).titel ?? null);
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
        case 'challenge-momente': return { ...base, slideValue: 'Meine Challenge-Momente' };
        case 'highlight': {
          const h = k.slides.highlight;
          const highlightTexte: Record<string, string> = {
            chat_star: `${h?.wert || 0} Chat-Nachrichten geschrieben`,
            reaktions_magnet: `${h?.wert || 0} Reaktionen bekommen`,
            challenge_fan: `${h?.wert || 0} Challenge-Beiträge eingereicht`,
            verlaesslich: 'Nie abgesagt — auf mich war Verlass',
          };
          return { ...base, slideValue: highlightTexte[h?.type || ''] || 'Mein Highlight' };
        }
        case 'endspurt': return { ...base, slideValue: `Noch ${k.slides.endspurt.fehlende_punkte} Punkte bis zum Ziel` };
        case 'kategorie': return { ...base, slideValue: `Dein Bereich: ${k.slides.kategorie?.top_kategorie || '-'}` };
        case 'konfirmation': return { ...base, slideValue: `Konfirmation: ${konfirmationsTermin(k) || ''}` };
        case 'ueber-das-ziel': return { ...base, slideValue: `${(k.slides.endspurt.aktuell_total - k.slides.endspurt.ziel_total)} Punkte über dem Ziel!` };
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

  // Konfi-Slides aufbauen.
  //
  // Ab Snapshot-Version 2 gibt es eine FESTE Reihenfolge (Challenge-Momente statt
  // Highlight-Slot). Für aeltere Snapshots (Version 1 aus der History) bleibt die
  // bisherige highlight_type-Logik als Fallback erhalten — allerdings ohne die
  // entfernten Slides rank/chat/pflicht. Alte JSONB-Felder dieser Slides werden
  // dabei einfach ignoriert und fuehren zu keinem Fehler.
  const buildKonfiSlides = (konfiData: KonfiWrappedData, slideYear: number) => {
    const slideKeys: Array<{ key: string; render: (isActive: boolean) => React.ReactNode }> = [];

    // Wie viel Inhalt steckt hinter einer Kategorie-/Datums-Seite?
    // Fuer 'kategorie:freizeit' die Zahl aus der Verteilung, fuer
    // 'datum:advent' die Zahl der Termine in diesem Fenster.
    const kategorieZahl = (kachel: string) => {
      const verteilung = konfiData.slides.kategorie?.verteilung || [];
      if (kachel.startsWith('datum:')) {
        const fenster = (konfiData.slides as { datums_fenster?: Record<string, number> }).datums_fenster || {};
        return fenster[kachel.slice('datum:'.length)] || 0;
      }
      if (kachel === 'kategorie-allgemein') {
        return verteilung[0]?.count || 0;
      }
      // Der Schluessel traegt den Seitennamen, die Verteilung den echten
      // Kategorienamen -- die Zuordnung hat das Backend schon gemacht,
      // hier zaehlen wir nur zusammen, was auf dieselbe Seite zeigt.
      // `seite` liefert das Backend mit (wrapped.js) -- die Zuordnung
      // Name -> Seite wird bewusst NICHT hier nachgebaut.
      const treffer = verteilung.filter(v => (v as { seite?: string | null }).seite === kachel);
      return treffer.reduce((n, v) => n + (v.count || 0), 0);
    };
    const kategorieTermine = (kachel: string) => {
      const verteilung = konfiData.slides.kategorie?.verteilung || [];
      return verteilung
        .filter(v => (v as { seite?: string }).seite === kachel)
        .reduce((n, v) => n + ((v as { aus_terminen?: number }).aus_terminen || 0), 0);
    };
    const highlightType = konfiData.highlight_type || 'events_held';
    const seed = konfiData.formulierung_seed || 0;
    const version = konfiData.version || 1;

    // Alle moeglichen Slide-Renderer
    const renderers: Record<string, (isActive: boolean) => React.ReactNode> = {
      'intro': (a) => <IntroSlide isActive={a} displayName={displayName} jahrgangName={jahrgangName || ''} year={slideYear} titel={titel} />,
      'highlight': (a) => <HighlightSlide isActive={a} data={konfiData} />,
      'challenge-momente': (a) => <ChallengeMomenteSlide isActive={a} momente={konfiData.slides.challenge_momente || []} />,
      'punkte': (a) => <PunkteSlide isActive={a} punkte={konfiData.slides.punkte} />,
      'events': (a) => <EventsSlide isActive={a} events={konfiData.slides.events} />,
      'badges': (a) => <BadgesSlide isActive={a} badges={konfiData.slides.badges} />,
      'kategorie': (a) => <KategorieSlide isActive={a} kategorie={konfiData.slides.kategorie} titel={getFormulierung('kategorie_titel', seed)} />,
      'aktivster-monat': (a) => <AktivsterMonatSlide isActive={a} aktivsterMonat={konfiData.slides.aktivster_monat} />,
      'endspurt': (a) => <EndspurtSlide isActive={a} endspurt={konfiData.slides.endspurt} />,
      'ueber-das-ziel': (a) => <UeberDasZielSlide isActive={a} endspurt={konfiData.slides.endspurt} />,
      'konfirmation': (a) => <KonfirmationsSlide isActive={a} zeitraumEnde={konfirmationsTermin(konfiData) || ''} />,
      'abschluss': (a) => <AbschlussSlide isActive={a} data={konfiData} year={slideYear} titel={titel} />,
      'seltenstes': (a) => {
        const selt = (konfiData.slides.badges as { seltenstes?: { name: string; icon: string; color: string; haben_es: number; konfis: number; prozent: number } })?.seltenstes;
        return selt ? <SeltenstesAbzeichenSlide isActive={a} abzeichen={selt} /> : null;
      },
    };

    // Die vom Backend gewaehlten Seiten (Simons Dramaturgie). Ab
    // Snapshot-Version 3 liefert das Backend `kacheln`; aeltere Snapshots
    // haben das Feld nicht und laufen weiter ueber die feste Reihenfolge
    // unten -- so aendert sich an bereits erzeugten Rueckblicken nichts.
    const kachelListe = (konfiData as { kacheln?: string[] }).kacheln;

    const shown = new Set<string>();

    const addSlide = (key: string) => {
      if (shown.has(key)) return;
      shown.add(key);
      slideKeys.push({ key, render: renderers[key] });
    };

    const maybeAdd = (key: string) => addSlide(key);

    const endspurt = konfiData.slides.endspurt;
    const hatKategorien = (konfiData.slides.kategorie?.verteilung?.length || 0) > 0;
    const hatKonfirmation = !!konfirmationsTermin(konfiData);

    if (Array.isArray(kachelListe) && kachelListe.length > 0) {
      // --- Ab Version 3: das Backend bestimmt die Seiten ---
      for (const kachel of kachelListe) {
        if (kachel.startsWith('kategorie:') || kachel.startsWith('datum:') || kachel === 'kategorie-allgemein') {
          const anzahl = kategorieZahl(kachel);
          if (anzahl <= 0) continue; // Eine Seite mit einer Null ist keine Erinnerung.
          if (shown.has(kachel)) continue;
          shown.add(kachel);
          slideKeys.push({
            key: kachel,
            render: (a: boolean) => (
              <KategorieSeiteSlide isActive={a} kachel={kachel} anzahl={anzahl} ausTerminen={kategorieTermine(kachel)} />
            )
          });
          continue;
        }
        if (renderers[kachel]) addSlide(kachel);
      }
    } else if (version >= 2) {
      // --- Version 2: feste Reihenfolge ---
      addSlide('intro');

      // Persoenliches Highlight (ab Version 3): Direkt nach dem Intro kommt
      // die Seite, die DIESE Person besonders macht -- aber nur fuer die
      // neuen Typen (chat_star, reaktions_magnet, challenge_fan,
      // verlaesslich). Die klassischen Typen haben ihre eigenen Slides
      // weiter unten; sie hier zu doppeln braechte nichts Neues.
      // Version-2-Snapshots ohne highlight-Feld ueberspringen die Seite.
      if (rendertHighlightSlide(konfiData)) {
        addSlide('highlight');
      }

      // Challenge-Momente nur, wenn der Konfi tatsaechlich etwas beigetragen hat.
      if ((konfiData.slides.challenge_momente?.length || 0) > 0) {
        addSlide('challenge-momente');
      }

      addSlide('events');

      if (hatKategorien) {
        addSlide('kategorie');
      }

      addSlide('aktivster-monat');

      // "Dein Weg": Punkte, danach Endspurt ODER (bei erreichtem Ziel) Über-das-Ziel.
      addSlide('punkte');
      if (endspurt?.aktiv) {
        addSlide('endspurt');
      } else if (endspurt && endspurt.aktuell_total >= endspurt.ziel_total && endspurt.ziel_total > 0) {
        addSlide('ueber-das-ziel');
      }

      addSlide('badges');

      if (hatKonfirmation) {
        addSlide('konfirmation');
      }

      addSlide('abschluss');
    } else {
      // --- Version 1 (Alt-Snapshots): bisherige highlight_type-Logik ---
      addSlide('intro');

      // Slide 2: Highlight-Slide basierend auf highlight_type.
      // 'chat_champion' hat keinen Renderer mehr und fällt auf 'events' zurück.
      const highlightKeyMap: Record<string, string> = {
        ueber_das_ziel: 'ueber-das-ziel',
        events_held: 'events',
        badge_collector: 'badges',
        gottesdienst_treue: 'punkte',
        gemeinde_aktiv: 'punkte',
      };
      addSlide(highlightKeyMap[highlightType] || 'events');

      // Slides 3+: Restliche Slides ohne Duplikation des Highlights
      maybeAdd('punkte');
      maybeAdd('events');
      maybeAdd('badges');

      if (hatKategorien) {
        maybeAdd('kategorie');
      }

      maybeAdd('aktivster-monat');

      // Endspurt / UeberDasZiel Logik
      if (highlightType !== 'ueber_das_ziel') {
        if (endspurt?.aktiv) {
          addSlide('endspurt');
        } else if (endspurt && !endspurt.aktiv && endspurt.aktuell_total >= endspurt.ziel_total && endspurt.ziel_total > 0) {
          maybeAdd('ueber-das-ziel');
        }
      }

      if (hatKonfirmation) {
        maybeAdd('konfirmation');
      }

      // Abschluss: IMMER letzter Slide
      shown.delete('abschluss'); // Immer hinzufuegen, auch wenn key schon existiert
      addSlide('abschluss');
    }

    // Konvertiere zu finalen Slides mit korrektem isActive
    return slideKeys.map((s, idx) => ({
      key: s.key,
      content: s.render(activeIndex === idx),
    }));
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

    // Nur zeigen, wenn ein Eintrittsdatum hinterlegt ist. Ohne teamer_since
    // rechnet das Backend 0 und die Seite sagte "0 Jahre als Teamer:in" --
    // eine Aussage ueber eine fehlende Angabe, nicht ueber die Person
    // (aufgefallen 01.09.2026 im Rueckblick der Demo-Gemeinde).
    if (teamerData.slides.engagement.teamer_seit) {
      slides.push({
        key: 'teamer-jahre',
        content: <TeamerJahreSlide isActive={activeIndex === slideIndex} engagement={teamerData.slides.engagement} />,
      });
      slideIndex++;
    }

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
        {/* Fortschrittsleiste aus Simons Entwurf: ein Segment je Seite.
            Ersetzt die runden Swiper-Punkte -- bei 13 Seiten sagen Punkte
            nichts mehr ueber den Fortschritt, Segmente schon. */}
        {slides.length > 0 ? (
          <div className="wrapped-fortschritt">
            {slides.map((s, i) => (
              <span key={s.key} className={i <= activeIndex ? 'ist-aktiv' : undefined} />
            ))}
          </div>
        ) : (
          <div className="wrapped-pagination" />
        )}
        {data && (
          <button className="wrapped-share-btn" onClick={handleShare} disabled={isSharing} aria-label="Teilen">
            <IonIcon icon={shareOutline} />
          </button>
        )}
        <button className="wrapped-close-btn" onClick={onClose} aria-label="Schließen">
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
          modules={[EffectCreative]}
          effect="creative"
          creativeEffect={{
            prev: { translate: ['-120%', 0, -500], rotate: [0, 0, -5], scale: 0.8, opacity: 0 },
            next: { translate: ['120%', 0, -500], rotate: [0, 0, 5], scale: 0.8, opacity: 0 },
          }}
          onSlideChange={handleSlideChange}
          speed={500}
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
