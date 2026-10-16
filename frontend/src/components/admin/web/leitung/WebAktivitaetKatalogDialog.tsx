// Eine Aktivität des Katalogs anlegen oder bearbeiten als Dialog der
// Web-Fassung (/admin/activities ab 992 px). Simon, 15.10.2026: jedes
// Formular, das im Browser noch ein Modal der App öffnet, bekommt ein
// kompaktes Fenster der Web-Fassung; in den Apps und unter 992 px bleibt das
// Modal (modals/ActivityManagementModal), wie es ist.
//
// Dieselben Angaben wie das Modal der App und dieselbe Logik
// (useAktivitaetKatalogFormular): Zielgruppe (nur neu), Name, Punkte und Typ
// (nur bei Konfis), Kategorien; dieselben Routen und Rümpfe, ohne Netz in die
// Warteschlange. Nur die Darstellung ist die des Browsers: Punkte und Typ als
// Auswahlfelder statt Regler und Kacheln, die Kategorien als Ankreuzfelder.
//
// Meldungen stehen im Dialog (role="alert"). Während gespeichert wird, schließt
// nichts den Dialog (Abbrechen, X, Escape, Klick daneben), wie das X der App.
// Schließen mit ungespeicherten Änderungen fragt nach -- dieselbe Rückfrage
// wie in der App, hier als Fenster über dem Dialog.

import React, { useEffect, useRef, useState } from 'react';
import { KATALOG_ROLLE } from '../../../../seiten/aktivitaetenKatalog';
import { OFFLINE_HINWEIS } from '../../stammdatenFormular';
import {
  KATALOG_PUNKTE_MAX,
  KATALOG_PUNKTE_MIN,
  TEAM_OHNE_PUNKTE,
  useAktivitaetKatalogFormular,
  type KatalogAktivitaet,
  type KatalogZielgruppe,
} from '../../useAktivitaetKatalogFormular';
import WebDialog from '../../../web/WebDialog';
import WebAuswahl from '../../../web/WebAuswahl';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebMehrfachAuswahl from '../../../web/WebMehrfachAuswahl';

export interface WebAktivitaetKatalogDialogProps {
  /** Die Aktivität zum Bearbeiten; null legt eine neue an. */
  aktivitaet: KatalogAktivitaet | null;
  /** Die Gruppe der Liste (Konfis/Team): Vorgabe der Zielgruppe. */
  targetRole: KatalogZielgruppe;
  onSchliessen: () => void;
  /** Gespeichert (auch eingereiht): die Seite schließt den Dialog und lädt die Liste. */
  onGespeichert: () => void;
}

const PUNKTE = Array.from({ length: KATALOG_PUNKTE_MAX - KATALOG_PUNKTE_MIN + 1 }, (_, i) => KATALOG_PUNKTE_MIN + i);

const WebAktivitaetKatalogDialog: React.FC<WebAktivitaetKatalogDialogProps> = ({ aktivitaet, targetRole, onSchliessen, onGespeichert }) => {
  const f = useAktivitaetKatalogFormular({
    activity: aktivitaet,
    activityId: aktivitaet?.id ?? null,
    targetRole,
    onSuccess: onGespeichert,
    fehlerImDialog: true,
  });
  const { formData } = f;
  const sperrt = f.loading || f.isSubmitting;
  const team = formData.target_role === 'teamer';

  // Der Dialog setzt den Fokus beim Öffnen; da lädt er noch. Steht das
  // Formular, geht der Fokus ins erste Feld -- es sei denn, er ist schon
  // woanders im Formular.
  const formular = useRef<HTMLDivElement>(null);
  const bereit = !f.initializing;
  useEffect(() => {
    if (!bereit || !formular.current) return;
    const aktiv = document.activeElement;
    if (aktiv instanceof HTMLInputElement || aktiv instanceof HTMLSelectElement || aktiv instanceof HTMLTextAreaElement) return;
    formular.current.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled])')?.focus();
  }, [bereit]);

  const [rueckfrage, setRueckfrage] = useState(false);
  const schliessen = () => {
    if (f.isDirty) setRueckfrage(true);
    else onSchliessen();
  };

  // Ein gespeicherter Wert außerhalb der Stufen der App (der Server nimmt
  // jede ganze Zahl ab 0) bleibt sichtbar gewählt.
  const punkteOptionen = [
    ...(PUNKTE.includes(formData.points) ? [] : [{ wert: String(formData.points), label: String(formData.points) }]),
    ...PUNKTE.map((p) => ({ wert: String(p), label: String(p) })),
  ];
  // Zwei Altbestände tragen keinen Typ: Dann steht das da, bis jemand wählt.
  const typOptionen = [
    ...(formData.type === '' ? [{ wert: '', label: 'Bitte wählen' }] : []),
    { wert: 'gottesdienst', label: 'Gottesdienst' },
    { wert: 'gemeinde', label: 'Gemeinde' },
  ];

  return (
    <>
      <WebDialog
        titel={f.currentActivity ? 'Aktivität bearbeiten' : 'Neue Aktivität'}
        onSchliessen={schliessen}
        onAbsenden={() => { void f.handleSubmit(); }}
        gesperrt={sperrt}
        aktionen={(
          <>
            <WebKnopf onClick={schliessen} disabled={sperrt}>Abbrechen</WebKnopf>
            <WebKnopf art="primaer" absenden disabled={!f.isFormValid || f.initializing || sperrt}>
              {f.currentActivity ? 'Speichern' : 'Anlegen'}
            </WebKnopf>
          </>
        )}
      >
        <div ref={formular} className="web-formular">
          {f.fehler && <WebHinweis art="fehler" rolle="alert">{f.fehler}</WebHinweis>}
          {!f.isOnline && <WebHinweis art="hinweis">{OFFLINE_HINWEIS}</WebHinweis>}

          {f.initializing ? (
            <p className="web-wahl__leer" role="status">
              {f.currentActivity ? 'Die Aktivität wird geladen.' : 'Die Kategorien werden geladen.'}
            </p>
          ) : (
            <>
              {/* Die Zielgruppe nur beim Anlegen, wie in der App. */}
              {!f.currentActivity && (
                <WebAuswahl
                  label="Zielgruppe"
                  wert={formData.target_role}
                  onWert={(w) => f.waehleZielgruppe(w as KatalogZielgruppe)}
                  optionen={KATALOG_ROLLE.map((r) => ({ wert: r.schluessel, label: r.label }))}
                  deaktiviert={sperrt}
                />
              )}
              <WebFeld
                label="Name"
                pflicht
                wert={formData.name}
                onWert={(name) => f.aendern({ name })}
                platzhalter="z.B. Sonntagsgottesdienst"
                deaktiviert={sperrt}
              />
              {team ? (
                <WebHinweis art="hinweis">{TEAM_OHNE_PUNKTE}</WebHinweis>
              ) : (
                <div className="web-feldpaar">
                  <WebAuswahl
                    label="Punkte"
                    pflicht
                    wert={String(formData.points)}
                    onWert={(w) => f.aendern({ points: Number(w) })}
                    optionen={punkteOptionen}
                    deaktiviert={sperrt}
                  />
                  <WebAuswahl
                    label="Typ"
                    pflicht
                    wert={formData.type}
                    onWert={(type) => f.aendern({ type })}
                    optionen={typOptionen}
                    deaktiviert={sperrt}
                  />
                </div>
              )}
              <WebMehrfachAuswahl
                label="Kategorien"
                eintraege={f.categories.map((k) => ({ wert: String(k.id), titel: k.name }))}
                werte={formData.category_ids.map(String)}
                // Ein Klick schaltet genau eine Kategorie um -- wie in der
                // App, über dieselbe Funktion: Die Reihenfolge im Rumpf ist
                // dann die der Klicks, in beiden Fassungen gleich.
                onWerte={(werte) => {
                  const gewaehlt = new Set(werte.map(Number));
                  const geklickt = f.categories.find((k) => gewaehlt.has(k.id) !== formData.category_ids.includes(k.id));
                  if (geklickt) f.kategorieUmschalten(geklickt.id);
                }}
                leerText="Keine Kategorien verfügbar"
                deaktiviert={sperrt}
              />
            </>
          )}
        </div>
      </WebDialog>
      {/* Nach dem Formular eingehängt: liegt damit über ihm (beide in ion-app). */}
      {rueckfrage && (
        <WebDialog
          titel="Ungespeicherte Änderungen"
          beschreibung="Möchtest du die Änderungen verwerfen?"
          rueckfrage="warnung"
          onSchliessen={() => setRueckfrage(false)}
          aktionen={(
            <>
              <WebKnopf onClick={() => setRueckfrage(false)}>Abbrechen</WebKnopf>
              <WebKnopf art="gefahr" onClick={onSchliessen}>Verwerfen</WebKnopf>
            </>
          )}
        >
          {null}
        </WebDialog>
      )}
    </>
  );
};

export default WebAktivitaetKatalogDialog;
