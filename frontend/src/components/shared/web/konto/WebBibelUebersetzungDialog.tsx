// „Bibelübersetzung" als Dialog der Web-Fassung (Simon, 15.10.2026: im Browser
// ab 992 px bekommt jedes Formular, das noch ein App-Modal öffnet, ein
// kompaktes Web-Fenster; in den Apps und darunter bleibt das Modal). Geöffnet
// aus dem Profil von Konfis und Team und von der Tageslosung auf deren
// Startseiten.
//
// Dieselbe Auswahl wie im Modal der App (BibleTranslationModal): dieselben
// Übersetzungen in derselben Reihenfolge, die aktuelle ist markiert, und wie
// in der App wählt ein Klick die Übersetzung -- die Seite speichert sie mit
// demselben Aufruf wie dort (PUT …/bible-translation) und schließt den Dialog.
// Jede Übersetzung ist ein Knopf (aria-pressed), so sind sie auch mit Tab und
// Enter erreichbar.

import React from 'react';
import { BIBLE_TRANSLATIONS } from '../../BibleTranslationModal';
import WebDialog from '../../../web/WebDialog';
import WebKnopf from '../../../web/WebKnopf';
import '../../../../theme/web/start.css';

export interface WebBibelUebersetzungDialogProps {
  /** Kürzel der gewählten Übersetzung (LUT, GNB, …). */
  currentTranslation: string;
  /** Eine Übersetzung gewählt: Die Seite speichert und schließt. */
  onSelect: (code: string) => void;
  onSchliessen: () => void;
}

const WebBibelUebersetzungDialog: React.FC<WebBibelUebersetzungDialogProps> = ({ currentTranslation, onSelect, onSchliessen }) => (
  <WebDialog
    titel="Bibelübersetzung"
    beschreibung="Ein Klick wählt die Übersetzung der Tageslosung."
    onSchliessen={onSchliessen}
    aktionen={<WebKnopf onClick={onSchliessen}>Abbrechen</WebKnopf>}
  >
    <div className="web-wahl__liste web-profil-wahl" role="group" aria-label="Übersetzung wählen">
      {BIBLE_TRANSLATIONS.map((t) => {
        const gewaehlt = currentTranslation === t.code;
        return (
          <button
            key={t.code}
            type="button"
            className={`web-wahl__zeile web-profil-wahl__knopf${gewaehlt ? ' web-wahl__zeile--gewaehlt' : ''}`}
            aria-pressed={gewaehlt}
            onClick={() => onSelect(t.code)}
          >
            <span className="web-wahl__text">
              <span className="web-wahl__titel">{t.name}</span>
              <span className="web-wahl__beschreibung">{t.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  </WebDialog>
);

export default WebBibelUebersetzungDialog;
