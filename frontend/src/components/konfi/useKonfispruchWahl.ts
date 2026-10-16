// „Dein Konfispruch" als Logik ohne Darstellung -- für Konfis und Team. Die App
// zeigt sie im Modal (modals/KonfispruchSelectModal), der Browser ab 992 px im
// Dialog (web/WebKonfispruchDialog; Simon, 15.10.2026: im Browser bekommt jedes
// Formular, das noch ein App-Modal öffnet, ein kompaktes Web-Fenster). Was zur
// Wahl steht, die Prüfung, der Aufruf, die Messung und die Texte stehen nur
// hier, damit beide nicht auseinanderlaufen.
//
// Zur Wahl: GET {apiBasePath}/konfsprueche (die Sprüche der Gemeinde) oder ein
// eigener Spruch. Speichern: PATCH {apiBasePath}/profile
//   aus der Liste   { konfspruch_id, translation }
//   eigener Spruch  { konfspruch_freitext, konfspruch_freitext_referenz }
// Meldungen: in der App als Toast oben (wie bisher), im Dialog des Browsers
// (`fehlerImDialog`) im Dialog selbst (`fehler`). Gespeichert meldet in beiden
// derselbe Toast „Dein Konfispruch wurde gespeichert", dann ruft der Hook
// onErfolg.

import { useEffect, useState } from 'react';
import { useIonToast } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import { useActionGuard } from '../../hooks/useActionGuard';
import api from '../../services/api';
import { trackKonfispruchWahl, type KonfispruchOrt, type KonfispruchWahl } from '../../services/analytics';
import { fehlerStatus, fehlerText } from '../../utils/fehler';

export type Translation = 'luther2017' | 'bigs' | 'gute_nachricht' | 'elberfelder';

export const TRANSLATION_LABELS: Record<Translation, string> = {
  luther2017: 'Luther 2017',
  bigs: 'Bibel in gerechter Sprache',
  gute_nachricht: 'Gute Nachricht',
  elberfelder: 'Elberfelder'
};

export const TRANSLATION_KEYS: Translation[] = ['luther2017', 'bigs', 'gute_nachricht', 'elberfelder'];

// Messwert je Uebersetzung fuer die anonyme Nutzungsmessung (Simon,
// 27.09.2026: „welche Übersetzung"). Eigene, feste Werte statt der Schluessel:
// Umami-Merkmale bleiben Kleinbuchstaben mit Bindestrich, und
// services/analytics.ts (trackKonfispruchWahl) laesst genau diese vier durch.
const BIBEL_MESSWERT: Record<Translation, string> = {
  luther2017: 'luther',
  bigs: 'bigs',
  gute_nachricht: 'gute-nachricht',
  elberfelder: 'elberfelder'
};

// Quellenangabe je Uebersetzung. Pflicht, kein Schmuck: Die Deutsche
// Bibelgesellschaft erlaubt Einzelverse in kostenlosen Veroeffentlichungen
// einer Gemeinde einer ACK-Mitgliedskirche ohne vorherige Anfrage — gegen
// Quellenangabe an geeigneter Stelle. Genau die steht hier.
//
// BIGS und Elberfelder sind noch nicht befuellt (andere Verlage, Anfrage
// laeuft); ihr Vermerk steht schon bereit, damit er beim Nachtragen der
// Texte nicht vergessen wird.
export const TRANSLATION_COPYRIGHT: Record<Translation, string> = {
  luther2017: 'Lutherbibel, revidiert 2017 © 2016 Deutsche Bibelgesellschaft, Stuttgart',
  bigs: 'Bibel in gerechter Sprache © 2006 Gütersloher Verlagshaus, Gütersloh',
  gute_nachricht: 'Gute Nachricht Bibel, revidiert 2018 © 2018 Deutsche Bibelgesellschaft, Stuttgart',
  elberfelder: 'Elberfelder Bibel © 2006 SCM R. Brockhaus, Witten'
};

/** Der Satz unter dem eigenen Spruch. */
export const EIGENER_SPRUCH_HINWEIS = 'Bei einem eigenen Spruch ist die Stellenangabe verpflichtend.';
/** Wenn die Liste nicht geladen werden konnte. */
export const SPRUCHLISTE_FEHLER = 'Die Spruchliste konnte nicht geladen werden. Bitte versuche es später erneut.';

export interface Konfspruch {
  id: number;
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  uebersetzungen: Record<Translation, string>;
}

export interface CurrentKonfspruch {
  source: 'liste' | 'freitext';
  id?: number;
  reference?: string;
  text?: string;
  translation?: string;
}

export type KonfispruchModus = 'liste' | 'freitext';

const isTranslation = (value?: string): value is Translation =>
  value === 'luther2017' || value === 'bigs' || value === 'gute_nachricht' || value === 'elberfelder';

/**
 * Der Spruch, den die App vor dem Speichern anzeigt, in der Form der Messung
 * (docs/messung/umami.md, S1) -- kein eigener Abruf. Ohne gespeicherten
 * Spruch null: Dann ist die naechste Wahl die erste.
 */
function wahlAusAnzeige(current?: CurrentKonfspruch | null): KonfispruchWahl | null {
  if (current?.source === 'liste' && current.id) {
    const t = isTranslation(current.translation) ? current.translation : 'luther2017';
    return { quelle: 'vorschlag', id: current.id, stelle: current.reference || '', bibel: BIBEL_MESSWERT[t] };
  }
  if (current?.source === 'freitext' && (current.text || '').trim()) {
    return { quelle: 'eigen', text: current.text || '', stelle: current.reference || '' };
  }
  return null;
}

export interface KonfispruchWahlOptionen {
  /** Der gespeicherte Spruch: Mit ihm beginnt die Auswahl. */
  current?: CurrentKonfspruch | null;
  /** API-Prefix: '/konfi' (Default) oder '/teamer' — beide Seiten haben
   *  eigene, gleichförmige Endpunkte (GET .../konfsprueche, PATCH .../profile). */
  apiBasePath?: '/konfi' | '/teamer';
  /** Gespeichert (der Toast steht schon): Der Aufrufer schließt und lädt neu. */
  onErfolg: () => void;
  /** Meldungen im Dialog (`fehler`) statt als Toast (App). */
  fehlerImDialog?: boolean;
}

export function useKonfispruchWahl({ current, apiBasePath = '/konfi', onErfolg, fehlerImDialog = false }: KonfispruchWahlOptionen) {
  const { isOnline, user, organizations, activeOrgId } = useApp();
  // Wo gewaehlt wird: die aktive Gemeinde aus GET /auth/my-organizations,
  // sonst die Stamm-Gemeinde; der Name notfalls aus dem Konto (aeltere
  // Server oder Liste noch nicht geladen).
  const aktiveGemeinde = (organizations || []).find((o) => o.id === (activeOrgId ?? user?.organization_id))
    ?? (organizations || []).find((o) => o.is_primary);
  const ort: KonfispruchOrt = {
    gemeinde: aktiveGemeinde?.display_name || aktiveGemeinde?.name || user?.organization,
    kirchenkreis: aktiveGemeinde?.kirchenkreis,
    landeskirche: aktiveGemeinde?.landeskirche,
  };
  const { isSubmitting, guard } = useActionGuard();
  const [presentToast] = useIonToast();
  const [fehler, setFehler] = useState<string | null>(null);

  const [mode, setModeWert] = useState<KonfispruchModus>(
    current?.source === 'freitext' ? 'freitext' : 'liste'
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sprueche, setSprueche] = useState<Konfspruch[]>([]);
  const [translation, setTranslationWert] = useState<Translation>(
    isTranslation(current?.translation) ? current!.translation as Translation : 'luther2017'
  );
  const [selectedSpruchId, setSelectedSpruchIdWert] = useState<number | null>(
    current?.source === 'liste' && current?.id ? current.id : null
  );
  const [freitext, setFreitextWert] = useState<string>(
    current?.source === 'freitext' ? (current.text || '') : ''
  );
  const [freitextReferenz, setFreitextReferenzWert] = useState<string>(
    current?.source === 'freitext' ? (current.reference || '') : ''
  );

  // Jede Eingabe räumt eine alte Meldung im Dialog weg.
  const mitLeeren = <T,>(setzen: (wert: T) => void) => (wert: T) => {
    setFehler(null);
    setzen(wert);
  };

  useEffect(() => {
    const loadSprueche = async () => {
      try {
        const response = await api.get(`${apiBasePath}/konfsprueche`);
        const liste = Array.isArray(response.data) ? response.data : [];
        setSprueche(liste);
        setLoadError(false);
        // WR-05: Falls die zuvor gewaehlte ID nicht mehr in der Liste ist
        // (deaktiviert/entfernt/Org gewechselt), Auswahl zuruecksetzen.
        setSelectedSpruchIdWert((prev) =>
          prev != null && liste.some((s: Konfspruch) => s.id === prev) ? prev : null
        );
      } catch (err) {
        // WR-04: Ladefehler sichtbar machen, damit ein Netzwerkfehler nicht
        // wie "keine Sprueche vorhanden" aussieht.
        console.error('Fehler beim Laden der Konfsprueche:', err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    loadSprueche();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wohin eine Meldung geht: in der App als Toast, im Browser in den Dialog.
  const showError = (message: string) => {
    if (fehlerImDialog) {
      setFehler(message);
      return;
    }
    presentToast({ message, duration: 3000, color: 'danger', position: 'top' });
  };

  const gespeichert = () => {
    presentToast({ message: 'Dein Konfispruch wurde gespeichert', duration: 2000, color: 'success', position: 'top' });
    onErfolg();
  };

  const speichern = async () => {
    setFehler(null);
    if (mode === 'liste') {
      if (!selectedSpruchId) {
        showError('Bitte wähle einen Spruch aus der Liste aus');
        return;
      }
      const vorher = wahlAusAnzeige(current);
      await guard(async () => {
        try {
          await api.patch(`${apiBasePath}/profile`, {
            konfspruch_id: selectedSpruchId,
            translation
          });
          // Anonyme Messung NACH der erfolgreichen Antwort: Spruch, Uebersetzung
          // und Gemeinde, nie die Person (docs/messung/umami.md, S1).
          // Unveraendert erneut gespeichert meldet nichts.
          const spruch = sprueche.find((s) => s.id === selectedSpruchId);
          trackKonfispruchWahl(
            { quelle: 'vorschlag', id: selectedSpruchId, stelle: spruch?.reference || '', bibel: BIBEL_MESSWERT[translation] },
            vorher,
            ort
          );
          gespeichert();
        } catch (err) {
          // WR-05: 404 = der gewaehlte Spruch ist nicht mehr verfuegbar -> klare Meldung
          if (fehlerStatus(err) === 404) {
            setSelectedSpruchIdWert(null);
            showError('Der gewählte Spruch ist nicht mehr verfügbar. Bitte wähle einen anderen.');
          } else {
            showError(fehlerText(err, 'Der Konfispruch konnte nicht gespeichert werden'));
          }
        }
      });
    } else {
      const referenz = freitextReferenz.trim();
      const text = freitext.trim();
      if (!text) {
        showError('Bitte gib deinen Spruchtext ein');
        return;
      }
      if (!referenz) {
        showError('Bitte gib die Stellenangabe an');
        return;
      }
      const vorher = wahlAusAnzeige(current);
      await guard(async () => {
        try {
          await api.patch(`${apiBasePath}/profile`, {
            konfspruch_freitext: text,
            konfspruch_freitext_referenz: referenz
          });
          // Eigener Spruch im Wortlaut mit Stellenangabe (Simon, 09.10.2026:
          // „insbesondere die, die selbst eingetragen werden"), gesaeubert
          // und gekuerzt in services/analytics.ts.
          trackKonfispruchWahl({ quelle: 'eigen', text, stelle: referenz }, vorher, ort);
          gespeichert();
        } catch (err) {
          showError(fehlerText(err, 'Der Konfispruch konnte nicht gespeichert werden'));
        }
      });
    }
  };

  return {
    isOnline,
    isSubmitting,
    mode,
    setMode: mitLeeren(setModeWert),
    loading,
    loadError,
    sprueche,
    translation,
    setTranslation: mitLeeren(setTranslationWert),
    selectedSpruchId,
    setSelectedSpruchId: mitLeeren(setSelectedSpruchIdWert),
    freitext,
    setFreitext: mitLeeren(setFreitextWert),
    freitextReferenz,
    setFreitextReferenz: mitLeeren(setFreitextReferenzWert),
    speichern,
    /** Die Meldung im Dialog (nur mit `fehlerImDialog`). */
    fehler,
  };
}

export type KonfispruchWahlZustand = ReturnType<typeof useKonfispruchWahl>;
