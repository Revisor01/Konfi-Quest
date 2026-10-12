// Event anlegen, bearbeiten und kopieren als Dialog der Web-Fassung
// (11.10.2026, Simon: „Web braucht eigene kompaktere Modale überall").
//
// Im Browser ab 992 px öffnen „Neues Event", „Kopieren" und „Event
// bearbeiten" diesen Dialog statt des App-Modals (EventModal). Dieselben
// Abschnitte in derselben Reihenfolge -- Grunddaten mit „Für wen ist das
// Event?", Kategorien und Jahrgänge, Datum und Anmeldung, Serie, Zeitfenster,
// Konfis, Team, QR-Check-in --, aber als Felder des Browsers: Datum und
// Uhrzeit mit Kalender, Zahlen als Auswahl, verwandte Felder nebeneinander.
// Laden, Vorbelegung, Prüfen, Speichern und die Warteschlange ohne Netz sind
// die der App (useEventFormular); was ein Schalter am Rest des Formulars
// ändert, steht in eventFormularRegeln.ts.
//
// Anders als in der App bleibt „Event anlegen" anklickbar, solange nichts
// gespeichert wird: Fehlt etwas, sagt der Dialog es in sich selbst, bei den
// Knöpfen -- ein gesperrter Knopf sagt nicht, warum. Die Knöpfe bleiben beim
// Scrollen unten im Bild wie in jedem breiten Dialog (theme/web-ansicht.css).
// Während des Speicherns schließt nichts den Dialog (Abbrechen, X, Escape,
// Klick daneben), wie bei den übrigen Dialogen der Web-Fassung: Das Event
// würde sonst unbemerkt gespeichert, und eine Ablehnung des Servers ginge ins
// Leere. Die Rückfrage „Ungespeicherte Änderungen" sendet nichts und bleibt
// frei.

import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_HINZUFUEGEN, ICON_LOESCHEN } from '../../../shared/icons';
import type { Event, Timeslot } from '../../../../types/event';
import { PUNKTEART_NAME, type Punkteart } from '../../../../utils/punktearten';
import { datumKurz, datumLang } from '../../../../utils/dateUtils';
import { useEventFormular } from '../../modals/useEventFormular';
import {
  EVENT_GRENZEN, letzterSerienTermin, lokaleZeit, mitKonfirmation, mitPflicht, mitSerie, mitSerienIntervall, mitUhrzeit,
  nachZielgruppe, plaetzeHoechstwert, serienHoechstzahl, verdeckteAuswahl, verfuegbarePunktearten, type TeamerZugang,
} from '../../modals/eventFormularRegeln';
import WebDialog from '../../../web/WebDialog';
import WebFeld from '../../../web/WebFeld';
import WebTextfeld from '../../../web/WebTextfeld';
import WebAuswahl, { type WebOption } from '../../../web/WebAuswahl';
import WebMehrfachAuswahl from '../../../web/WebMehrfachAuswahl';
import WebDatum from '../../../web/WebDatum';
import WebSchalter from '../../../web/WebSchalter';
import WebKnopf from '../../../web/WebKnopf';
import WebHinweis from '../../../web/WebHinweis';
import '../../../../theme/web/termine.css';

export interface WebEventDialogProps {
  /** Bestehendes Event (bearbeiten), Vorlage einer Kopie (id 0) oder leer (neu). */
  event?: Event | null;
  /** Zeitfenster einer Kopie, auf den neuen Tag verschoben (kopiereTermin). */
  vorbelegteTimeslots?: Timeslot[];
  /** Nach dem Speichern: Liste neu laden, Dialog zu -- wie in der App. */
  onSuccess: () => void;
  /** Dialog zu (nach dem Speichern oder nach „Verwerfen"). */
  onSchliessen: () => void;
}

const ZIELGRUPPEN: ReadonlyArray<WebOption> = [
  { wert: 'normal', label: 'Nur Konfis' },
  { wert: 'teamer_needed', label: 'Konfis, Team gesucht' },
  { wert: 'teamer_only', label: 'Nur Team' },
];

const INTERVALLE: ReadonlyArray<WebOption> = [
  { wert: 'day', label: 'Täglich' },
  { wert: 'week', label: 'Wöchentlich' },
  { wert: '2weeks', label: 'Alle 2 Wochen' },
  { wert: 'month', label: 'Monatlich' },
];

/**
 * Zahlen von min bis max als Auswahl; ein Bestandswert außerhalb bleibt
 * wählbar. Number(): Die Event-Liste liefert Plätze als Text ("50"), und
 * eine Kopie aus der Liste bringt sie so mit.
 */
const zahlen = (min: number, max: number, aktuell: number, text: (n: number) => string = String, schritt = 1): WebOption[] => {
  const werte: number[] = [];
  for (let n = min; n <= max; n += schritt) werte.push(n);
  const bestand = Number(aktuell);
  if (bestand > 0 && !werte.includes(bestand)) werte.push(bestand);
  return werte.sort((a, b) => a - b).map((n) => ({ wert: String(n), label: text(n) }));
};

const plaetzeText = (n: number) => (n === 1 ? '1 Platz' : `${n} Plätze`);

/** Der Kalendertag eines Zeitpunkts in Ortszeit ("2026-10-11"). */
const tagVon = (wert: string) => lokaleZeit(wert).slice(0, 10);

/**
 * Zwei verwandte Felder nebeneinander; bleibt nur eines übrig (etwa ohne
 * Warteliste bei unbegrenzten Plätzen), steht es in halber Breite statt über
 * die ganze Zeile gezogen.
 */
const Paar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const felder = React.Children.toArray(children);
  if (felder.length === 1) return <div className="web-event-halb">{felder[0]}</div>;
  return <div className="web-feldpaar">{felder}</div>;
};

const WebEventDialog: React.FC<WebEventDialogProps> = ({
  event, vorbelegteTimeslots, onSuccess, onSchliessen,
}) => {
  const [fehler, setFehler] = useState<string | null>(null);
  const [rueckfrage, setRueckfrage] = useState(false);

  const {
    formData, setFormData, timeslots, addTimeslot, removeTimeslot, updateTimeslot,
    teamerAccess, setTeamerAccess, categories, jahrgaenge, loading, isSubmitting, isDirty,
    datePickerMax, datumWechseln, anmeldungAbSofort, zeitfensterAktivieren, handleSubmit,
  } = useEventFormular({
    event, vorbelegteTimeslots, onSuccess, schliessen: onSchliessen, meldeFehler: setFehler,
  });

  const bearbeiten = !!event && event.id > 0;
  const kopie = !!event && event.id === 0;
  const titel = bearbeiten ? 'Event bearbeiten' : kopie ? 'Event kopieren' : 'Neues Event';
  const beschreibung = kopie
    ? `Alles aus „${event.name}“ ist übernommen, das Datum ist neu. Material und Chat kommen nicht mit; angelegt wird erst beim Speichern.`
    : undefined;
  const absendenText = bearbeiten ? 'Speichern' : formData.is_series ? 'Serie anlegen' : 'Event anlegen';

  const aus = loading;
  const nurTeam = teamerAccess === 'teamer_only';
  const mitKonfis = !nurTeam;

  /** Jede Änderung nimmt eine alte Meldung weg. */
  const aendern = (neu: typeof formData) => { setFehler(null); setFormData(neu); };

  // Schließen mit ungespeicherten Änderungen fragt nach -- dieselbe Frage wie
  // das Modal der App (canDismiss der Seite). Als kleiner Dialog über diesem,
  // in der Form der Web-Fassung (bis 12.10.2026 lag ein Ionic-Alert zudem
  // unter dem Dialog; seitdem hängt WebDialog in ion-app, wie die Alerts).
  const abbrechen = () => {
    if (isDirty) setRueckfrage(true);
    else onSchliessen();
  };

  const absenden = () => {
    setFehler(null);
    void handleSubmit();
  };

  // Punkte: nur Arten, die in mindestens einem gewählten Jahrgang aktiv sind;
  // ein gespeicherter Wert außerhalb bleibt sichtbar, statt still zu springen.
  const arten = verfuegbarePunktearten(formData.jahrgang_ids, jahrgaenge);
  const artOptionen: WebOption[] = [
    ...(arten.includes(formData.point_type as Punkteart) ? [] : [{ wert: formData.point_type, label: `${PUNKTEART_NAME[formData.point_type]} (in den gewählten Jahrgängen abgeschaltet)` }]),
    ...arten.map((a) => ({ wert: a, label: PUNKTEART_NAME[a] })),
  ];

  // Admins und Teamer:innen sehen nur ihre eigenen Jahrgänge als Haken. Gehört
  // das Event auch einem fremden, bleibt er in der Auswahl (das hält die
  // Ankreuzliste selbst) und der Hinweis sagt es -- sonst stünde „2 ausgewählt"
  // neben einem Haken. Solange die Liste lädt, ist nichts verdeckt.
  const verdeckt = jahrgaenge.length > 0 ? verdeckteAuswahl(formData.jahrgang_ids, jahrgaenge.map((j) => j.id)) : [];
  const verdecktNamen = verdeckt
    .map((id) => event?.jahrgaenge?.find((j) => j.id === id)?.name)
    .filter((name): name is string => !!name);
  const verdecktText = verdeckt.length === 0 ? ''
    : `, davon ${verdeckt.length} außerhalb deiner Jahrgänge${verdecktNamen.length === verdeckt.length ? `: ${verdecktNamen.join(', ')}` : ''}`;
  const jahrgangHinweis = formData.jahrgang_ids.length > 0
    ? `${formData.jahrgang_ids.length} ausgewählt${verdecktText}.`
    : formData.mandatory ? 'Pflicht bei Pflicht-Events.' : 'Ohne Auswahl gilt das Event für die ganze Gemeinde.';

  const letzterTermin = letzterSerienTermin(formData);
  const serienMax = serienHoechstzahl(formData.series_interval);

  return (
    <>
    <WebDialog
      titel={titel}
      beschreibung={beschreibung}
      breit
      onSchliessen={abbrechen}
      onAbsenden={absenden}
      gesperrt={isSubmitting}
      aktionen={(
        <>
          {/* Die Meldung steht bei den Knöpfen, die unten im Bild bleiben --
              sichtbar, wo auch immer im Formular man gerade ist. */}
          {fehler && (
            <div className="web-event-meldung">
              <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>
            </div>
          )}
          <WebKnopf onClick={abbrechen} disabled={isSubmitting}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={loading || isSubmitting}>{absendenText}</WebKnopf>
        </>
      )}
    >
      <div className="web-formular web-event-formular">
        {/* GRUNDDATEN -- „Für wen ist das Event?" steuert, was weiter unten steht. */}
        <Paar>
          <WebFeld label="Event-Name" pflicht wert={formData.name} onWert={(w) => aendern({ ...formData, name: w })} platzhalter="z. B. Konfirmandenausflug" deaktiviert={aus} />
          <WebFeld label="Ort" wert={formData.location} onWert={(w) => aendern({ ...formData, location: w })} platzhalter="z. B. Gemeindehaus" deaktiviert={aus} />
        </Paar>
        <Paar>
          <WebTextfeld label="Beschreibung" zeilen={3} wert={formData.description} onWert={(w) => aendern({ ...formData, description: w })} platzhalter="Beschreibung des Events …" deaktiviert={aus} />
          <WebTextfeld label="Was mitbringen (optional)" zeilen={3} wert={formData.bring_items} onWert={(w) => aendern({ ...formData, bring_items: w })} platzhalter="z. B. Bibel, Stift, Block" deaktiviert={aus} />
        </Paar>
        <Paar>
          <WebAuswahl
            label="Für wen ist das Event?"
            wert={teamerAccess}
            optionen={ZIELGRUPPEN}
            deaktiviert={aus}
            onWert={(w) => {
              const zugang = w as TeamerZugang;
              setFehler(null);
              setTeamerAccess(zugang);
              if (zugang === 'teamer_only') setFormData(nachZielgruppe(formData, zugang));
            }}
          />
          {mitKonfis && (
            <div className="web-formular">
              <WebSchalter label="Pflicht-Event" an={formData.mandatory} onAn={(an) => aendern(mitPflicht(formData, an))} deaktiviert={aus} />
              <WebSchalter label="Konfirmation" an={formData.is_konfirmation} onAn={(an) => aendern(mitKonfirmation(formData, an))} deaktiviert={aus} />
            </div>
          )}
        </Paar>

        <h3 className="web-gruppe">Kategorien & Zielgruppe</h3>
        <Paar>
          <WebMehrfachAuswahl
            label="Kategorien (mehrere möglich)"
            eintraege={categories.map((c) => ({ wert: String(c.id), titel: c.name }))}
            werte={formData.category_ids.map(String)}
            onWerte={(werte) => { setFehler(null); setFormData((f) => ({ ...f, category_ids: werte.map(Number) })); }}
            leerText="Keine Kategorien verfügbar"
            deaktiviert={aus}
          />
          {mitKonfis && (
            <WebMehrfachAuswahl
              label="Jahrgänge (mehrere möglich)"
              pflicht={formData.mandatory}
              eintraege={jahrgaenge.map((j) => ({ wert: String(j.id), titel: j.name }))}
              werte={formData.jahrgang_ids.map(String)}
              onWerte={(werte) => { setFehler(null); setFormData((f) => ({ ...f, jahrgang_ids: werte.map(Number) })); }}
              leerText="Keine Jahrgänge angelegt"
              hinweis={jahrgangHinweis}
              deaktiviert={aus}
            />
          )}
        </Paar>

        <h3 className="web-gruppe">Datum & Zeit</h3>
        <Paar>
          <WebDatum label="Datum & Uhrzeit" art="datumUhrzeit" pflicht wert={formData.event_date} max={datePickerMax} onWert={(w) => { setFehler(null); datumWechseln(w); }} deaktiviert={aus} />
          <WebDatum label="Endzeit (optional)" art="datumUhrzeit" wert={formData.event_end_time} min={formData.event_date || undefined} max={datePickerMax} onWert={(w) => aendern({ ...formData, event_end_time: w })} deaktiviert={aus} />
        </Paar>

        {/* Das Anmeldefenster gilt nur für Konfis: bei Pflicht-Events sind
            alle gesetzt, bei „Nur Team" melden sich Teamer:innen jederzeit an. */}
        {!formData.mandatory && mitKonfis && (
          <>
            <h3 className="web-gruppe">Anmeldung</h3>
            <Paar>
              <div className="web-formular">
                <WebSchalter
                  label="Anmeldung ab sofort"
                  an={!formData.registration_opens_at}
                  onAn={(an) => { setFehler(null); anmeldungAbSofort(an); }}
                  hinweis={formData.registration_opens_at ? 'Konfis können sich ab dem gewählten Zeitpunkt anmelden.' : 'Konfis können sich sofort anmelden.'}
                  deaktiviert={aus}
                />
                {!!formData.registration_opens_at && (
                  <WebDatum label="Anmeldung ab" art="datumUhrzeit" wert={formData.registration_opens_at} max={datePickerMax} onWert={(w) => aendern({ ...formData, registration_opens_at: w })} deaktiviert={aus} />
                )}
              </div>
              <WebDatum label="Anmeldeschluss" art="datumUhrzeit" wert={formData.registration_closes_at} max={datePickerMax} onWert={(w) => aendern({ ...formData, registration_closes_at: w })} deaktiviert={aus} />
            </Paar>
          </>
        )}

        {/* SERIE -- nur beim Anlegen, wie in der App. */}
        {!event && (
          <>
            <h3 className="web-gruppe">Event-Serie (optional)</h3>
            <WebSchalter
              label="Als Serie erstellen"
              an={formData.is_series}
              onAn={(an) => aendern(mitSerie(formData, an))}
              hinweis={formData.is_series ? undefined : 'Einzelnes Event'}
              deaktiviert={aus}
            />
            {formData.is_series && (
              <>
                <Paar>
                  <WebAuswahl
                    label="Anzahl Events"
                    wert={String(Math.min(formData.series_count, serienMax))}
                    optionen={zahlen(EVENT_GRENZEN.serie.min, serienMax, 0)}
                    onWert={(w) => aendern({ ...formData, series_count: Number(w) })}
                    deaktiviert={aus}
                  />
                  <WebAuswahl
                    label="Intervall"
                    wert={formData.series_interval}
                    optionen={INTERVALLE}
                    onWert={(w) => aendern(mitSerienIntervall(formData, w))}
                    deaktiviert={aus}
                  />
                </Paar>
                {letzterTermin && <p className="web-feld__hinweis">Letzter Termin: {datumLang(letzterTermin)}</p>}
              </>
            )}
          </>
        )}

        {/* ZEITFENSTER -- nicht bei Pflicht-Events, Konfirmationen und „Nur Team". */}
        {!formData.mandatory && !formData.is_konfirmation && mitKonfis && (
          <>
            <h3 className="web-gruppe">Zeitfenster (optional)</h3>
            <WebSchalter label="Zeitfenster aktivieren" an={formData.has_timeslots} onAn={(an) => { setFehler(null); zeitfensterAktivieren(an); }} deaktiviert={aus} />
            {formData.has_timeslots && (
              <>
                {timeslots.map((slot, index) => (
                  // Zeitfenster haben vor dem Speichern keine id; die Stelle ist ihr Schlüssel (wie in der App).
                  <fieldset key={index} className="web-zeitfenster" disabled={aus}>
                    <legend className="web-zeitfenster__titel">Zeitfenster {index + 1}</legend>
                    <WebDatum label="Startzeit" art="uhrzeit" wert={lokaleZeit(slot.start_time)} onWert={(w) => { if (w) updateTimeslot(index, 'start_time', mitUhrzeit(slot.start_time, w, formData.event_date)); }} />
                    <WebDatum label="Endzeit" art="uhrzeit" wert={lokaleZeit(slot.end_time)} onWert={(w) => { if (w) updateTimeslot(index, 'end_time', mitUhrzeit(slot.end_time, w, formData.event_date)); }} />
                    <WebAuswahl
                      label="Max. Teilnehmer:innen"
                      wert={String(slot.max_participants)}
                      optionen={[{ wert: '0', label: 'Unbegrenzt' }, ...zahlen(EVENT_GRENZEN.zeitfensterPlaetze.min, EVENT_GRENZEN.zeitfensterPlaetze.max, slot.max_participants)]}
                      onWert={(w) => updateTimeslot(index, 'max_participants', Number(w))}
                    />
                    <WebKnopf art="gefahr" klein symbol aria-label={`Zeitfenster ${index + 1} entfernen`} title="Zeitfenster entfernen" onClick={() => removeTimeslot(index)} disabled={aus}>
                      <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
                    </WebKnopf>
                    {/* Die Felder zeigen nur die Uhrzeit. Liegt ein Zeitfenster an
                        einem anderen Tag als das Event (das Datum wurde nach dem
                        Anlegen der Zeitfenster geändert, etwa bei einer Kopie), steht
                        der Tag hier -- sonst bliebe das unsichtbar. */}
                    {tagVon(slot.start_time) !== tagVon(formData.event_date) && (
                      <p className="web-zeitfenster__tag">
                        Am {datumKurz(lokaleZeit(slot.start_time), { mitWochentag: true })} – nicht am Tag des Events.
                      </p>
                    )}
                  </fieldset>
                ))}
                <div className="web-formular__knoepfe">
                  <WebKnopf onClick={addTimeslot} disabled={aus}>
                    <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
                    Zeitfenster hinzufügen
                  </WebKnopf>
                </div>
              </>
            )}
          </>
        )}

        {/* KONFIS -- Plätze, Warteliste und Punkte. */}
        {!formData.mandatory && mitKonfis && (
          <>
            <h3 className="web-gruppe">Konfis</h3>
            {!formData.has_timeslots && (
              <Paar>
                <WebAuswahl
                  label="Max. Teilnehmer:innen"
                  wert={String(formData.max_participants)}
                  optionen={[{ wert: '0', label: 'Unbegrenzt' }, ...zahlen(EVENT_GRENZEN.plaetze.min, plaetzeHoechstwert(Number(formData.max_participants)), formData.max_participants)]}
                  onWert={(w) => aendern({ ...formData, max_participants: Number(w) })}
                  deaktiviert={aus}
                />
                {/* Warteliste nur bei begrenzten Plätzen -- bei unbegrenzt kann niemand warten. */}
                {Number(formData.max_participants) !== 0 && (
                  <WebAuswahl
                    label="Warteliste"
                    wert={formData.waitlist_enabled ? String(formData.max_waitlist_size) : '0'}
                    optionen={[{ wert: '0', label: 'Keine Warteliste' }, ...zahlen(EVENT_GRENZEN.warteliste.min, EVENT_GRENZEN.warteliste.max, formData.max_waitlist_size, plaetzeText)]}
                    onWert={(w) => aendern(w === '0'
                      ? { ...formData, waitlist_enabled: false }
                      : { ...formData, waitlist_enabled: true, max_waitlist_size: Number(w) })}
                    deaktiviert={aus}
                  />
                )}
              </Paar>
            )}
            {/* Konfirmations-Events geben keine Punkte. */}
            {!formData.is_konfirmation && (
              <Paar>
                <WebAuswahl
                  label="Punkte"
                  wert={String(formData.points)}
                  // Ein gespeicherter Wert 0 (etwa nach einem Pflicht-Event) bleibt sichtbar.
                  optionen={[
                    ...(formData.points < EVENT_GRENZEN.punkte.min ? [{ wert: String(formData.points), label: String(formData.points) }] : []),
                    ...zahlen(EVENT_GRENZEN.punkte.min, EVENT_GRENZEN.punkte.max, formData.points),
                  ]}
                  onWert={(w) => aendern({ ...formData, points: Number(w) })}
                  deaktiviert={aus}
                />
                <WebAuswahl
                  label="Typ"
                  pflicht
                  wert={formData.point_type}
                  optionen={artOptionen}
                  onWert={(w) => aendern({ ...formData, point_type: w as Punkteart })}
                  deaktiviert={aus}
                />
              </Paar>
            )}
          </>
        )}

        {/* TEAM -- nur, wenn Teamer:innen teilnehmen. */}
        {teamerAccess !== 'normal' && (
          <>
            <h3 className="web-gruppe">Team</h3>
            <Paar>
              <WebAuswahl
                label="Wie viele Personen werden fürs Team gesucht?"
                wert={String(formData.teamer_max_participants)}
                optionen={[{ wert: '0', label: 'Unbegrenzt' }, ...zahlen(EVENT_GRENZEN.team.min, EVENT_GRENZEN.team.max, formData.teamer_max_participants)]}
                onWert={(w) => aendern({ ...formData, teamer_max_participants: Number(w) })}
                deaktiviert={aus}
              />
              {Number(formData.teamer_max_participants) !== 0 && (
                <WebAuswahl
                  label="Warteliste fürs Team"
                  wert={formData.teamer_waitlist_enabled ? String(formData.teamer_max_waitlist_size) : '0'}
                  optionen={[{ wert: '0', label: 'Keine Warteliste' }, ...zahlen(EVENT_GRENZEN.warteliste.min, EVENT_GRENZEN.warteliste.max, formData.teamer_max_waitlist_size, plaetzeText)]}
                  onWert={(w) => aendern(w === '0'
                    ? { ...formData, teamer_waitlist_enabled: false }
                    : { ...formData, teamer_waitlist_enabled: true, teamer_max_waitlist_size: Number(w) })}
                  deaktiviert={aus}
                />
              )}
            </Paar>
          </>
        )}

        <h3 className="web-gruppe">QR-Check-in</h3>
        <Paar>
          <WebAuswahl
            label="Check-in-Fenster (Minuten)"
            wert={String(formData.checkin_window)}
            optionen={zahlen(EVENT_GRENZEN.checkin.min, EVENT_GRENZEN.checkin.max, formData.checkin_window, (n) => `${n} Minuten`, EVENT_GRENZEN.checkin.schritt)}
            onWert={(w) => aendern({ ...formData, checkin_window: Number(w) })}
            hinweis={`QR-Code Check-in: ${formData.checkin_window} Min. vor und nach dem Start`}
            deaktiviert={aus}
          />
        </Paar>
      </div>
    </WebDialog>
    {rueckfrage && (
      <WebDialog
        titel="Ungespeicherte Änderungen"
        beschreibung="Möchtest du die Änderungen verwerfen?"
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

export default WebEventDialog;
