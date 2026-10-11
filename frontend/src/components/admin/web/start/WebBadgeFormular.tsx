// Badge anlegen und bearbeiten als Dialog der Web-Fassung (11.10.2026, Simon:
// „Web braucht eigene kompaktere Modale überall"). Dieselben Angaben wie das
// Formular der App (admin/modals/BadgeManagementModal) und dieselbe Logik
// (admin/useBadgeFormular): Zielgruppe (nur neu), Name, Beschreibung, Symbol
// und Farbe, Bedingung mit Wert und Auswahl, Aktiv und Geheim, „Badge neu
// prüfen". Nur die Darstellung ist die des Browsers: beschriftete Felder,
// zwei nebeneinander, die Symbole als Raster von Knöpfen, die Kriterien als
// Auswahlfeld mit ihrem Hilfetext, der Wert als Zahlenfeld statt Regler.
//
// Schliessen mit ungespeicherten Änderungen fragt nach -- wie die App über
// canDismiss der Seite (dieselbe Rückfrage). Während gespeichert wird, ist
// das Formular gesperrt (X, Abbrechen, Escape, Klick daneben), die Rückfrage
// nicht: Sie kann dann gar nicht offen sein.

import React, { useEffect, useId, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { useApp } from '../../../../contexts/AppContext';
import { ICON_CHOICES as BADGE_ICONS, getIconFromString } from '../../../../utils/badgeIcons';
import { offlineBlockiert } from '../../../../utils/offlineAktion';
import { BADGES_GRUPPE } from '../../../../seiten/badgesLeitung';
import {
  aktivitaetArt,
  ohneEmoji,
  reglerMaximum,
  STANDARD_WOCHEN,
  useBadgeFormular,
  WOCHEN_MAX,
  zahlFehler,
  type BadgeZielgruppe,
} from '../../useBadgeFormular';
import WebDialog from '../../../web/WebDialog';
import WebFeld from '../../../web/WebFeld';
import WebTextfeld from '../../../web/WebTextfeld';
import WebAuswahl from '../../../web/WebAuswahl';
import WebAuswahlSuche from '../../../web/WebAuswahlSuche';
import WebMehrfachAuswahl from '../../../web/WebMehrfachAuswahl';
import WebSchalter from '../../../web/WebSchalter';
import WebKnopf from '../../../web/WebKnopf';
import WebHinweis from '../../../web/WebHinweis';
import { WebLaden } from '../../../web/WebZustaende';
import WebBadgeSymbol from '../../../konfi/web/WebBadgeSymbol';
import '../../../../theme/web/start.css';

export interface WebBadgeFormularProps {
  /** null: ein neues Badge. */
  badgeId: number | null;
  /** Die Gruppe der Liste (Konfis/Team): Vorgabe der Zielgruppe und Quelle der Aktivitäten. */
  targetRole: BadgeZielgruppe;
  onSchliessen: () => void;
  /** Gespeichert: die Seite schließt den Dialog und lädt die Liste. */
  onGespeichert: () => void;
  /** „Badge neu prüfen" hat vergeben: nur die Liste neu laden, der Dialog bleibt. */
  onListeNeuLaden: () => void;
}

interface SymbolGruppe { kategorie: string; symbole: { schluessel: string; name: string; icon: string }[] }

/** Die Symbole nach ihren Gruppen (Erfolg, Engagement, ...), in der Reihenfolge der App. */
const SYMBOL_GRUPPEN: SymbolGruppe[] = Object.entries(BADGE_ICONS).reduce<SymbolGruppe[]>((gruppen, [schluessel, daten]) => {
  const gruppe = gruppen.find((g) => g.kategorie === daten.category);
  const symbol = { schluessel, name: daten.name, icon: daten.icon };
  if (gruppe) gruppe.symbole.push(symbol);
  else gruppen.push({ kategorie: daten.category, symbole: [symbol] });
  return gruppen;
}, []);
const ALLE_SYMBOLE = SYMBOL_GRUPPEN.flatMap((g) => g.symbole.map((s) => s.schluessel));

/**
 * Das Raster der Symbole: je Gruppe eine Reihe Knöpfe mit aria-pressed. Ein
 * Tabulator-Halt für das ganze Raster (der gewählte Knopf), die Pfeiltasten
 * wandern, Leertaste oder Enter wählen -- sonst wären es 95 Halte.
 */
const SymbolWahl: React.FC<{ wert: string; farbe: string; onWert: (schluessel: string) => void; deaktiviert: boolean }> = ({ wert, farbe, onWert, deaktiviert }) => {
  const id = useId();
  const raster = useRef<HTMLDivElement>(null);
  const halt = ALLE_SYMBOLE.includes(wert) ? wert : ALLE_SYMBOLE[0];
  const gewaehlt = BADGE_ICONS[wert as keyof typeof BADGE_ICONS];

  // Beim Öffnen steht das gewählte Symbol im sichtbaren Teil des Rasters
  // (beim Bearbeiten liegt es oft weiter unten, etwa bei „Aktivitäten").
  useEffect(() => {
    const kasten = raster.current;
    const knopf = kasten?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!kasten || !knopf) return;
    kasten.scrollTop = Math.max(0, knopf.offsetTop - (kasten.clientHeight - knopf.offsetHeight) / 2);
    // Nur beim Öffnen; danach scrollt, wer wählt.
  }, []);

  const taste = (ereignis: React.KeyboardEvent<HTMLDivElement>) => {
    const jetzt = ALLE_SYMBOLE.indexOf((ereignis.target as HTMLElement).dataset.symbol ?? '');
    if (jetzt < 0) return;
    const ziel = ereignis.key === 'ArrowRight' || ereignis.key === 'ArrowDown' ? Math.min(jetzt + 1, ALLE_SYMBOLE.length - 1)
      : ereignis.key === 'ArrowLeft' || ereignis.key === 'ArrowUp' ? Math.max(jetzt - 1, 0)
        : ereignis.key === 'Home' ? 0
          : ereignis.key === 'End' ? ALLE_SYMBOLE.length - 1
            : -1;
    if (ziel < 0) return;
    ereignis.preventDefault();
    raster.current?.querySelector<HTMLButtonElement>(`[data-symbol="${ALLE_SYMBOLE[ziel]}"]`)?.focus();
  };

  return (
    <fieldset className="web-badge-symbole" disabled={deaktiviert} aria-describedby={`${id}-gewaehlt`}>
      <legend className="web-feld__label web-feld__label--pflicht web-wahl__legende">Symbol</legend>
      <p id={`${id}-gewaehlt`} className="web-badge-symbole__gewaehlt">
        {gewaehlt ? `Gewählt: ${gewaehlt.name} (${gewaehlt.category})` : 'Noch kein Symbol gewählt'}
      </p>
      <div ref={raster} className="web-badge-symbole__raster" onKeyDown={taste}>
        {SYMBOL_GRUPPEN.map((gruppe) => (
          <div key={gruppe.kategorie} role="group" aria-labelledby={`${id}-${gruppe.kategorie}`}>
            <p id={`${id}-${gruppe.kategorie}`} className="web-badge-symbole__gruppe">{gruppe.kategorie}</p>
            <div className="web-badge-symbole__knoepfe">
              {gruppe.symbole.map((s) => {
                const an = s.schluessel === wert;
                return (
                  <button
                    key={s.schluessel}
                    type="button"
                    className="web-badge-symbole__knopf"
                    data-symbol={s.schluessel}
                    aria-label={s.name}
                    aria-pressed={an}
                    title={s.name}
                    tabIndex={s.schluessel === halt ? 0 : -1}
                    style={an ? { background: farbe } : undefined}
                    onClick={() => onWert(s.schluessel)}
                  >
                    <IonIcon icon={s.icon} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
};

/** Eine getippte Zahl, solange sie zum Wert im Formular gehört (sonst gilt der Wert). */
interface Eingabe { text: string; zu: number }
const anzeige = (eingabe: Eingabe | null, wert: number) => (eingabe && eingabe.zu === wert ? eingabe.text : String(wert));
const alsZahl = (text: string, max: number): number | null => (zahlFehler(text, max, '') === null ? Number(text.trim()) : null);

const WebBadgeFormular: React.FC<WebBadgeFormularProps> = ({ badgeId, targetRole, onSchliessen, onGespeichert, onListeNeuLaden }) => {
  const { isOnline } = useApp();
  const f = useBadgeFormular({ badgeId, targetRole, onSuccess: onGespeichert, onRefreshList: onListeNeuLaden, fehlerImFormular: true });
  const farbId = useId();
  const { formData, extraCriteria } = f;
  const formular = useRef<HTMLDivElement>(null);

  // Der Dialog setzt den Fokus beim Öffnen; da lädt er noch. Steht das
  // Formular, geht der Fokus ins erste Feld (den Namen) -- es sei denn, er
  // ist schon woanders.
  const bereit = f.bereit;
  useEffect(() => {
    if (!bereit || !formular.current) return;
    const aktiv = document.activeElement;
    if (aktiv instanceof HTMLInputElement || aktiv instanceof HTMLTextAreaElement || aktiv instanceof HTMLSelectElement) return;
    formular.current.querySelector<HTMLInputElement>('input:not([disabled])')?.focus();
  }, [bereit]);

  // Wert und Zeitraum sind Zahlenfelder: Was getippt ist, bleibt stehen, auch
  // wenn es (noch) keine gültige Zahl ist; geprüft wird beim Speichern.
  const [wertEingabe, setWertEingabe] = useState<Eingabe | null>(null);
  const [wochenEingabe, setWochenEingabe] = useState<Eingabe | null>(null);
  // Die Obergrenze wie der Regler der App: 20, oder der gespeicherte Wert, wenn er darüber liegt.
  const wertMax = reglerMaximum(f.startWert);
  const wochen = extraCriteria.weeks || STANDARD_WOCHEN;
  const wertText = anzeige(wertEingabe, formData.criteria_value);
  const wochenText = anzeige(wochenEingabe, wochen);

  const wertTippen = (text: string) => {
    const zahl = alsZahl(text, wertMax);
    setWertEingabe({ text, zu: zahl ?? formData.criteria_value });
    if (zahl !== null) f.setFormData({ ...formData, criteria_value: zahl });
  };
  const wochenTippen = (text: string) => {
    const zahl = alsZahl(text, WOCHEN_MAX);
    setWochenEingabe({ text, zu: zahl ?? wochen });
    if (zahl !== null) f.setzeWochen(zahl);
  };

  // Die Rückfrage ist selbst ein Dialog der Web-Fassung: Ein Ionic-Alert läge
  // unter diesem Dialog (er hängt in ion-app, dieser an <body>; im Browser
  // nachgestellt, der Dialog fing die Klicks ab).
  const [rueckfrage, setRueckfrage] = useState(false);
  const schliessen = () => {
    if (!f.hatAenderungen()) {
      onSchliessen();
      return;
    }
    setRueckfrage(true);
  };

  const absenden = () => {
    // Der Name zuerst (prüft handleSave), dann die getippten Zahlen.
    const zahlMeldung = !formData.name.trim() ? null
      : zahlFehler(wertText, wertMax, f.valueLabel)
        ?? (formData.criteria_type === 'time_based' ? zahlFehler(wochenText, WOCHEN_MAX, 'Zeitraum (Wochen)') : null);
    if (zahlMeldung) {
      f.melden(zahlMeldung);
      return;
    }
    void f.handleSave();
  };

  const pruefen = () => {
    if (offlineBlockiert(isOnline, f.melden)) return;
    void f.handlePruefen();
  };

  const typ = f.criteriaTypes[formData.criteria_type];
  const kriterienOptionen = [
    ...f.kriterienZurWahl.map(([wert, t]) => ({ wert, label: ohneEmoji(t.label) })),
    // Ein gespeicherter Typ, der der Gruppe nicht mehr angeboten wird
    // („nur im Bestand"), bleibt sichtbar gewählt.
    ...(f.kriterienZurWahl.some(([wert]) => wert === formData.criteria_type) ? []
      : [{ wert: formData.criteria_type, label: typ ? ohneEmoji(typ.label) : formData.criteria_type }]),
  ];
  const aktivitaetEintraege = f.activities.map((a) => ({ wert: String(a.id), titel: a.name, beschreibung: aktivitaetArt(a, targetRole) ?? undefined }));
  const kategorienLeer = 'Es gibt noch keine Kategorien.';
  const aktivitaetenLeer = targetRole === 'teamer' ? 'Es gibt noch keine Aktivitäten fürs Team.' : 'Es gibt noch keine Aktivitäten für Konfis.';

  const auswahlFuerTyp = () => {
    switch (formData.criteria_type) {
      case 'specific_activity':
        return (
          <WebAuswahlSuche
            label="Aktivität"
            eintraege={aktivitaetEintraege}
            wert={extraCriteria.activity_id ? String(extraCriteria.activity_id) : ''}
            onWert={(w) => f.waehleAktivitaet(Number(w))}
            suchePlatzhalter="Aktivität suchen"
            leerText={aktivitaetenLeer}
          />
        );
      case 'category_activities':
        return (
          <WebAuswahl
            label="Kategorie"
            pflicht
            wert={extraCriteria.required_category ?? ''}
            onWert={(w) => { if (w) f.waehleKategorie(w); }}
            optionen={[
              { wert: '', label: f.categories.length === 0 ? kategorienLeer : 'Bitte wählen' },
              ...f.categories.map((k) => ({ wert: k.name, label: k.name })),
            ]}
          />
        );
      case 'category_combination':
        return (
          <WebMehrfachAuswahl
            label="Kategorien"
            pflicht
            eintraege={f.categories.map((k) => ({ wert: k.name, titel: k.name }))}
            werte={extraCriteria.required_categories ?? []}
            onWerte={(werte) => { setWertEingabe(null); f.setzeKategorienKombi(werte); }}
            leerText={kategorienLeer}
            hinweis="Mindestens zwei ankreuzen. Jede zählt nur einmal, egal wie oft jemand dabei war."
          />
        );
      case 'activity_combination':
        return (
          <WebMehrfachAuswahl
            label="Aktivitäten"
            pflicht
            eintraege={aktivitaetEintraege}
            werte={(extraCriteria.activity_ids ?? []).map(String)}
            onWerte={(werte) => f.setzeAktivitaetenKombi(werte.map(Number))}
            leerText={aktivitaetenLeer}
          />
        );
      case 'time_based':
        return (
          <WebFeld
            label="Zeitraum (Wochen)"
            typ="number"
            min={1}
            max={WOCHEN_MAX}
            schritt={1}
            wert={wochenText}
            onWert={wochenTippen}
            hinweis={`1 bis ${WOCHEN_MAX} Wochen.`}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
    <WebDialog
      breit
      titel={f.isEditMode ? 'Badge bearbeiten' : 'Neues Badge'}
      beschreibung="Das Badge wird automatisch vergeben, sobald jemand die Bedingung erfüllt."
      onSchliessen={schliessen}
      onAbsenden={absenden}
      gesperrt={f.isSubmitting}
      aktionen={(
        <>
          <WebKnopf onClick={schliessen} disabled={f.isSubmitting}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={!f.bereit || f.loading || f.isSubmitting}>Speichern</WebKnopf>
        </>
      )}
    >
      {f.ladeFehler ? (
        <WebHinweis art="fehler" rolle="alert">{f.fehler ?? 'Fehler beim Laden des Badges'}</WebHinweis>
      ) : !f.bereit ? (
        <WebLaden karten={2} text={f.isEditMode ? 'Badge wird geladen.' : 'Formular wird geladen.'} />
      ) : (
        <div ref={formular} className="web-formular">
          <div className="web-badge-vorschau" role="group" aria-label="Vorschau">
            <WebBadgeSymbol icon={getIconFromString(formData.icon)} farbe={formData.color} erreicht={formData.is_active} groesse="mittel" />
            <span className="web-badge-vorschau__text">
              <span className="web-badge-vorschau__name">{formData.name.trim() || 'Neues Badge'}</span>
              <span className="web-badge-vorschau__zeile">
                {typ ? `${ohneEmoji(typ.label)} · Wert ${formData.criteria_value}` : `Wert ${formData.criteria_value}`}
                {formData.is_hidden ? ' · Geheim' : ''}
                {formData.is_active ? '' : ' · Inaktiv'}
              </span>
            </span>
          </div>

          <div className="web-feldpaar">
            <WebFeld
              label="Name"
              pflicht
              wert={formData.name}
              onWert={(w) => f.setFormData({ ...formData, name: w })}
              platzhalter="Badge-Name eingeben"
            />
            {!f.isEditMode && (
              <WebAuswahl
                label="Zielgruppe"
                wert={formData.target_role}
                onWert={(w) => { setWertEingabe(null); f.waehleZielgruppe(w as BadgeZielgruppe); }}
                optionen={BADGES_GRUPPE.map((g) => ({ wert: g.schluessel, label: g.label }))}
                hinweis="Lässt sich später nicht mehr ändern."
              />
            )}
          </div>
          <WebTextfeld
            label="Beschreibung"
            zeilen={2}
            wert={formData.description}
            onWert={(w) => f.setFormData({ ...formData, description: w })}
            platzhalter="Beschreibung des Badges..."
          />

          <h3 className="web-gruppe">Symbol und Farbe</h3>
          <div className="web-feld">
            <label htmlFor={farbId} className="web-feld__label">Farbe</label>
            <div className="web-badge-farbe">
              <input
                id={farbId}
                type="color"
                className="web-badge-farbe__eingabe"
                value={formData.color}
                disabled={f.loading}
                aria-describedby={`${farbId}-hinweis`}
                onChange={(e) => f.setFormData({ ...formData, color: e.target.value })}
              />
              <span className="web-badge-farbe__wert">{formData.color.toUpperCase()}</span>
              {formData.color !== f.standardFarbe && (
                <WebKnopf klein onClick={() => f.setFormData({ ...formData, color: f.standardFarbe })} title="Farbe der Bedingung übernehmen">
                  <span className="web-badge-farbe__muster" style={{ background: f.standardFarbe }} aria-hidden="true" />
                  Standard
                </WebKnopf>
              )}
            </div>
            <p id={`${farbId}-hinweis`} className="web-feld__hinweis">Vorgabe ist die Farbe der Bedingung; sie wechselt mit, solange du keine eigene wählst.</p>
          </div>
          <SymbolWahl wert={formData.icon} farbe={formData.color} deaktiviert={f.loading} onWert={(icon) => f.setFormData({ ...formData, icon })} />

          <h3 className="web-gruppe">Bedingung</h3>
          <div className="web-feldpaar">
            <WebAuswahl
              label="Bedingung"
              wert={formData.criteria_type}
              onWert={(w) => { setWertEingabe(null); setWochenEingabe(null); f.waehleKriterium(w); }}
              optionen={kriterienOptionen}
              hinweis={typ?.help}
            />
            <WebFeld
              label={f.valueLabel}
              pflicht
              typ="number"
              min={1}
              max={wertMax}
              schritt={1}
              wert={wertText}
              onWert={wertTippen}
              hinweis={`1 bis ${wertMax}.`}
            />
          </div>
          {auswahlFuerTyp()}

          <h3 className="web-gruppe">Status</h3>
          <div className="web-feldpaar">
            <WebSchalter label="Aktiv" an={formData.is_active} onAn={(an) => f.setFormData({ ...formData, is_active: an })} hinweis="Badge kann verliehen werden" />
            <WebSchalter label="Geheim" an={formData.is_hidden} onAn={(an) => f.setFormData({ ...formData, is_hidden: an })} hinweis="Badge ist für Konfis nicht sichtbar bis sie es erhalten" />
          </div>
          {f.isEditMode && f.darfPruefen && (
            <div className="web-formular__aktionen">
              <WebKnopf klein onClick={pruefen} disabled={f.pruefLoading || f.loading}>Badge neu prüfen</WebKnopf>
              <span className="web-feld__hinweis">Holt die Vergabe für alle der Zielgruppe nach. Speichern prüft ohnehin.</span>
            </div>
          )}
          {/* Das Ergebnis von „Badge neu prüfen" steht hier, nicht als Toast:
              Der hängt in ion-app und läge unter diesem Dialog. */}
          {f.meldung && <WebHinweis art="erfolg" rolle="status">{f.meldung}</WebHinweis>}

          {!isOnline && (
            <WebHinweis art="hinweis">Ohne Internetverbindung: Das Badge wird gespeichert, sobald du wieder online bist.</WebHinweis>
          )}
          {f.fehler && <WebHinweis art="fehler" rolle="alert">{f.fehler}</WebHinweis>}
        </div>
      )}
    </WebDialog>
    {/* Nach dem Formular eingehängt: liegt damit über ihm (beide an <body>). */}
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

export default WebBadgeFormular;
