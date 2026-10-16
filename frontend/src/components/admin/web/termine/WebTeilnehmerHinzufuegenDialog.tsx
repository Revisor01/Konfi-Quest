// „Konfi hinzufügen", „Team hinzufügen", „Leitung hinzufügen" als Dialog der
// Web-Fassung (Simon, 15.10.2026, Seiten-Inventar: im Browser ab 992 px jedes
// Formular als kompaktes Fenster). Geöffnet von der Seite eines Events
// (EventDetailView im breiten Layout); unter 992 px und in den Apps bleibt das
// Modal der App (modals/ParticipantManagementModal.tsx).
//
// Dieselbe Logik wie in der App (useTeilnehmerHinzufuegen): dieselben
// wählbaren Personen (nur wer zu einem Jahrgang des Events gehört, außer bei
// „Nur Team" und Events ohne Jahrgang), dieselbe Suche und dieselben Filter,
// derselbe Rumpf an dieselbe Route (POST /events/:id/participants), dieselbe
// Rückfrage „Trotzdem eintragen", wenn das Event voll ist -- hier als kleiner
// Dialog über diesem, mit „rueckfrage"-Optik.
//
// Meldungen (Laden, Zeitfenster fehlt, Ablehnung des Servers) stehen oben im
// Dialog; die nächste Eingabe räumt sie weg. Während des Sendens schließt
// nichts den Dialog (Abbrechen, X, Escape, Klick daneben). Nach dem
// Eintragen schließt die Seite ihn und lädt das Event neu, wie in der App.
// Eine Rückfrage beim Schließen gibt es nicht -- die App fragt auch nicht.

import React, { useEffect, useRef, useState } from 'react';
import type { UeberbuchenFrage } from '../../../../utils/ueberbuchen';
import { initialen } from '../../../../utils/konfiListe';
import { rollenDarstellung, rollenName } from '../../../../utils/rollenNamen';
import {
  personUnterzeile,
  useTeilnehmerHinzufuegen,
  zeitfensterBeschriftung,
  type HinzufuegenRolle,
} from '../../modals/useTeilnehmerHinzufuegen';
import WebDialog from '../../../web/WebDialog';
import WebAuswahl from '../../../web/WebAuswahl';
import WebFilterAuswahl from '../../../web/WebFilterAuswahl';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebKreis from '../../../web/WebKreis';
import WebSuche from '../../../web/WebSuche';
import '../../../../theme/web/termine.css';

export interface WebTeilnehmerHinzufuegenDialogProps {
  eventId: number;
  filterRole: HinzufuegenRolle;
  /** Mindestens eine Person ist eingetragen: Die Seite schließt und lädt neu. */
  onSuccess: () => void;
  onSchliessen: () => void;
}

/** Der Name des Fensters -- wie der Knopf, der es öffnet. */
const TITEL: Record<HinzufuegenRolle, string> = {
  konfi: 'Konfi hinzufügen',
  teamer: 'Team hinzufügen',
  leitung: 'Leitung hinzufügen',
};

/** Eine offene Rückfrage „voll -- trotzdem eintragen?" und ihre Antwort. */
interface OffeneFrage {
  frage: UeberbuchenFrage;
  antworten: (ja: boolean) => void;
}

const WebTeilnehmerHinzufuegenDialog: React.FC<WebTeilnehmerHinzufuegenDialogProps> = ({
  eventId, filterRole, onSuccess, onSchliessen,
}) => {
  const [offeneFrage, setOffeneFrage] = useState<OffeneFrage | null>(null);
  const frageUeberbuchen = (frage: UeberbuchenFrage) => new Promise<boolean>((resolve) => {
    setOffeneFrage({
      frage,
      antworten: (ja) => {
        setOffeneFrage(null);
        resolve(ja);
      },
    });
  });

  const t = useTeilnehmerHinzufuegen({ eventId, filterRole, onSuccess, frageUeberbuchen, fehlerImDialog: true });
  const formular = useRef<HTMLDivElement>(null);

  // Der Dialog rollt: Eine Meldung rückt ins Bild.
  useEffect(() => {
    if (t.fehler) formular.current?.querySelector<HTMLElement>('[role="alert"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [t.fehler]);

  const abbrechen = () => {
    if (t.sendet) return;
    onSchliessen();
  };

  const eintragen = () => {
    if (t.sendet || !t.isOnline || t.selectedKonfis.length === 0) return;
    void t.handleAddParticipants();
  };

  // Jahrgangs-Filter nur, wenn das Event mehrere Jahrgänge hat oder gar keinen -- wie in der App.
  const jahrgangsFilter = t.eventJahrgaenge.length !== 1;
  const jahrgangsOptionen = t.hasEventJahrgaenge
    ? [{ wert: 'alle', label: 'Alle Event-Jahrgänge' }, ...t.eventJahrgaenge.map((jg) => ({ wert: jg, label: jg }))]
    : [{ wert: 'alle', label: 'Alle Jahrgänge' }, ...t.availableJahrgaenge.map((jg) => ({ wert: jg, label: jg }))];
  const anzahl = t.selectedKonfis.length;

  const personen = () => {
    if (!t.geladen) return <p className="web-wahl__leer" role="status">Die Personen werden geladen.</p>;
    if (t.filteredKonfis.length === 0) {
      return (
        <p className="web-wahl__leer" role="status">
          {t.jahrgangsGrenzeAktiv
            ? 'Keine passenden Personen — nur wer zu einem Jahrgang dieses Events gehört, lässt sich eintragen'
            : 'Keine Personen gefunden'}
        </p>
      );
    }
    return (
      <div className="web-wahl__liste">
        {t.filteredKonfis.map((person) => {
          const gewaehlt = t.selectedKonfis.includes(person.id);
          const unterzeile = personUnterzeile(person, rollenName);
          // Team und Leitung in der Farbe ihrer Rolle, Konfis in ihrer -- wie die App.
          const ton = rollenDarstellung(person.role_name === 'konfi' ? 'konfi' : person.role_name).farbe;
          return (
            <label key={person.id} className={`web-wahl__zeile web-teilnehmer-wahl__zeile${gewaehlt ? ' web-wahl__zeile--gewaehlt' : ''}`}>
              <input
                type="checkbox"
                className="web-wahl__haken"
                aria-label={unterzeile ? `${person.name}, ${unterzeile}` : person.name}
                checked={gewaehlt}
                onChange={() => t.handleKonfiSelection(person.id)}
              />
              <WebKreis text={initialen(person.name) || '??'} ton={ton} />
              <span className="web-wahl__text">
                <span className="web-wahl__titel">{person.name}</span>
                {unterzeile && <span className="web-wahl__beschreibung">{unterzeile}</span>}
              </span>
            </label>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <WebDialog
        titel={TITEL[filterRole]}
        beschreibung="Wähle die Personen, die du eintragen möchtest."
        onSchliessen={abbrechen}
        onAbsenden={eintragen}
        gesperrt={t.sendet}
        aktionen={(
          <>
            <WebKnopf onClick={abbrechen} disabled={t.sendet}>Abbrechen</WebKnopf>
            <WebKnopf art="primaer" absenden disabled={t.sendet || !t.isOnline || anzahl === 0}>
              {anzahl > 0 ? `${anzahl} hinzufügen` : 'Hinzufügen'}
            </WebKnopf>
          </>
        )}
      >
        <div className="web-formular" ref={formular}>
          {t.fehler && <WebHinweis art="fehler" rolle="alert">{t.fehler}</WebHinweis>}
          {!t.isOnline && (
            <WebHinweis art="warnung">Du bist offline. Eintragen geht erst wieder mit Internetverbindung.</WebHinweis>
          )}

          {t.zeitfenster.length > 0 && (
            <WebAuswahl
              label="Zeitslot"
              pflicht
              wert={t.selectedTimeslot === null ? '' : String(t.selectedTimeslot)}
              onWert={(wert) => t.setSelectedTimeslot(wert ? Number(wert) : null)}
              optionen={[{ wert: '', label: 'Zeitslot wählen...' }, ...t.zeitfenster.map((slot) => ({ wert: String(slot.id), label: zeitfensterBeschriftung(slot) }))]}
              deaktiviert={t.sendet}
            />
          )}

          <div className="web-werkzeuge">
            <WebSuche beschriftung="Person suchen" platzhalter="Name eingeben..." wert={t.searchTerm} onWert={t.setSearchTerm} />
            {jahrgangsFilter && (
              <WebFilterAuswahl label="Jahrgang" wert={t.selectedJahrgang} onWert={t.setSelectedJahrgang} optionen={jahrgangsOptionen} />
            )}
          </div>

          <fieldset className="web-wahl" disabled={t.sendet}>
            <legend className="web-feld__label web-wahl__legende">{`Personen (${t.filteredKonfis.length})`}</legend>
            {/* Warum jemand fehlt: Eine leere oder kuerzere Liste ohne
                Erklaerung liesse die Leitung nach der Person suchen. */}
            {t.jahrgangsGrenzeAktiv && (
              <p className="web-feld__hinweis">
                Angeboten werden nur Personen aus {t.eventJahrgaenge.length === 1 ? 'dem Jahrgang' : 'den Jahrgängen'} dieses
                Events ({t.eventJahrgaenge.join(', ')}). Die Gemeindeleitung ist davon ausgenommen.
              </p>
            )}
            {t.filteredKonfis.length > 0 && (
              <div className="web-formular__knoepfe">
                <WebKnopf klein art="text" onClick={t.alleUmschalten}>
                  {t.alleGewaehlt ? 'Keine auswählen' : 'Alle auswählen'}
                </WebKnopf>
              </div>
            )}
            {personen()}
            {anzahl > 0 && <p className="web-wahl__zahl" role="status">{anzahl} ausgewählt</p>}
          </fieldset>
        </div>
      </WebDialog>
      {offeneFrage && (
        <WebDialog
          titel={offeneFrage.frage.header}
          beschreibung={offeneFrage.frage.message}
          rueckfrage="warnung"
          onSchliessen={() => offeneFrage.antworten(false)}
          aktionen={(
            <>
              <WebKnopf onClick={() => offeneFrage.antworten(false)}>Abbrechen</WebKnopf>
              <WebKnopf art="primaer" onClick={() => offeneFrage.antworten(true)}>Trotzdem eintragen</WebKnopf>
            </>
          )}
        >
          {null}
        </WebDialog>
      )}
    </>
  );
};

export default WebTeilnehmerHinzufuegenDialog;
