// „Lizenz ändern" im Vorgang „Lizenz und Abrechnung" -- als Logik ohne
// Darstellung (docs/planung/support-detailseiten.md, Abschnitt
// „Lizenz-Vorgang"; Simon, 11.10.2026: „Antrag meint bitte um Lizenz").
// Der Browser zeigt sie im Dialog (web/WebLizenzAendern), die App im Modal
// (LizenzModal in SupportModale) -- dieselbe Logik.
//
// Die Regeln stehen rein in utils/lizenzAendern.ts: Vorbelegung, Laufzeit-
// Wahlen, „Wunschlizenz übernehmen", Testphase-Schalter, Prüfung, Vorschau und
// die Änderung je Route. Gespeichert wird nur über bestehende Routen; das
// Backend bleibt, wie es ist:
//   1. Tarif geändert: PATCH /organizations/:id/limit { max_konfis }.
//   2. Laufzeit oder Testphase geändert: GET /organizations/:id, dann PUT
//      /organizations/:id mit dem VOLLEN Körper (lizenzPutKoerper) -- PUT
//      schreibt die Stammfelder immer, ein Teilkörper leerte sie.
// Scheitert 1, bleibt der Dialog offen. Scheitert 2 nach 1: „Tarif
// gespeichert, Laufzeit nicht – bitte erneut speichern.", der Entwurf bleibt.
// Liefert GET keine lesbare Gemeinde, ist die Laufzeit hier gesperrt (der Weg
// ist das Gemeinde-Formular). Ohne Netz geht nichts hinaus.
//
// Restrisiko wie im Gemeinde-Formular: GET und PUT sind ein
// Lesen-Ändern-Schreiben; ändert jemand die Stammdaten dazwischen, geht diese
// Änderung verloren.

import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import { fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { datumKurz } from '../../utils/dateUtils';
import {
  gemeindeStammLesen,
  laufzeitWahlen as laufzeitWahlenVon,
  lizenzAenderung,
  lizenzFehler,
  lizenzPutKoerper,
  lizenzTestphaseSetzen,
  lizenzVorbelegen,
  lizenzVorschau,
  lizenzWunschUebernehmen,
  tarifAngabe,
  wunschAnbieten,
  type LaufzeitWahl,
  type LizenzBestand,
  type LizenzFormular,
} from '../../utils/lizenzAendern';
import { lizenzFinden } from '../../utils/lizenzen';
import type { VorgangGemeinde } from '../../utils/supportVorgaenge';
import { LIZENZ_TEXT } from '../../seiten/supportDetail';
import { meldeSupportGeaendert } from '../../utils/supportAktualisieren';

/** Der Bestand aus der Gemeinde des Vorgangs -- nur, was die Regeln brauchen. */
const bestandVon = (g: VorgangGemeinde): LizenzBestand => ({
  id: g.id,
  display_name: g.display_name,
  max_konfis: g.max_konfis,
  is_trial: g.is_trial,
  trial_ends_at: g.trial_ends_at,
  konfi_count: g.konfi_count,
  wunsch_lizenz: g.wunsch_lizenz,
  is_active: g.is_active,
});

/** Zwei Entwürfe sagen dasselbe (das Datum zählt nur bei „Eigenes Datum…"). */
const gleich = (a: LizenzFormular, b: LizenzFormular): boolean =>
  a.tarif === b.tarif && a.eigenesLimit === b.eigenesLimit && a.laufzeit === b.laufzeit && a.testphase === b.testphase
  && (a.laufzeit !== 'datum' || a.datum === b.datum);

export function useLizenzAendern(gemeinde: VorgangGemeinde | null, o: { jetzt?: Date } = {}) {
  const { setError, setSuccess, isOnline } = useApp();
  const jetzt = o.jetzt;
  const bestand = gemeinde ? bestandVon(gemeinde) : null;

  const [formular, setFormular] = useState<LizenzFormular | null>(() => (bestand ? lizenzVorbelegen(bestand) : null));
  const [speichert, setSpeichert] = useState(false);
  // GET /organizations/:id lieferte keine lesbare Gemeinde: die Laufzeit nur im Gemeinde-Formular.
  const [laufzeitGesperrt, setLaufzeitGesperrt] = useState(false);

  // Eine andere Gemeinde (oder erst jetzt eine): neu vorbelegen. Ein Neuladen
  // derselben Gemeinde lässt den Entwurf stehen (nachgezogen beim Rendern).
  const id = gemeinde?.id ?? null;
  const [fuer, setFuer] = useState<number | null>(id);
  if (id !== fuer) {
    setFuer(id);
    setFormular(bestand ? lizenzVorbelegen(bestand) : null);
    setLaufzeitGesperrt(false);
  }

  /**
   * Ein Feld ändern. Der Schalter „Testphase" geht über lizenzTestphaseSetzen
   * (das Limit folgt ihm, solange es auf der Vorgabe steht); nach jeder
   * anderen Änderung gilt: ohne Laufzeitende keine Testphase.
   */
  const aendern = (teil: Partial<LizenzFormular>) => {
    if (!bestand) return;
    setFormular((f) => {
      if (!f) return f;
      const { testphase, ...rest } = teil;
      const neu = { ...f, ...rest };
      return lizenzTestphaseSetzen(bestand, neu, testphase ?? neu.testphase, jetzt);
    });
  };

  const zuruecksetzen = () => setFormular(bestand ? lizenzVorbelegen(bestand) : null);

  const wunsch = bestand && formular && wunschAnbieten(bestand) ? lizenzWunschUebernehmen(bestand, jetzt) : null;
  /**
   * „Wunschlizenz übernehmen: Standard" -- nur, wenn ein Wunsch bekannt ist, vom Tarif abweicht
   * oder die Testphase läuft (wunschAnbieten), und der Entwurf ihn noch nicht trägt.
   */
  const wunschUebernehmen = wunsch && formular && !gleich(wunsch, formular) ? () => setFormular(wunsch) : null;
  const wunschName = wunsch && bestand ? lizenzFinden(bestand.wunsch_lizenz)?.name ?? null : null;

  const laufzeitWahlen: Array<{ wert: LaufzeitWahl; label: string }> = bestand ? laufzeitWahlenVon(bestand, jetzt) : [];
  const vorschau = bestand && formular ? lizenzVorschau(bestand, formular, jetzt) : null;
  const fehler = formular ? lizenzFehler(formular) : null;
  const aenderung = bestand && formular ? lizenzAenderung(bestand, formular, jetzt) : {};
  const geaendert = Object.keys(aenderung).length > 0;

  /**
   * Speichern: erst der Tarif (PATCH …/limit), dann Laufzeit und Testphase
   * (GET, dann PUT mit dem vollen Körper). true: alles gespeichert -- der
   * Dialog darf schließen.
   */
  const speichern = async (): Promise<boolean> => {
    if (!bestand || !formular || offlineBlockiert(isOnline, setError)) return false;
    const meldung = lizenzFehler(formular);
    if (meldung) {
      setError(meldung);
      return false;
    }
    const teil = lizenzAenderung(bestand, formular, jetzt);
    if (!teil.limit && !teil.laufzeit) return true;
    setSpeichert(true);
    let tarifGespeichert = false;
    let laufzeitGespeichert = false;
    try {
      if (teil.limit) {
        try {
          await api.patch(`/organizations/${bestand.id}/limit`, teil.limit);
          tarifGespeichert = true;
        } catch (err) {
          setError(fehlerText(err, 'Tarif konnte nicht gespeichert werden'));
          return false;
        }
      }
      if (teil.laufzeit) {
        let stamm;
        try {
          stamm = gemeindeStammLesen((await api.get(`/organizations/${bestand.id}`)).data);
        } catch (err) {
          setError(tarifGespeichert ? LIZENZ_TEXT.teilGespeichert : fehlerText(err, 'Laufzeit konnte nicht gespeichert werden'));
          return false;
        }
        if (!stamm) {
          setLaufzeitGesperrt(true);
          setError(tarifGespeichert ? `Tarif gespeichert. ${LIZENZ_TEXT.stammFehlt}` : LIZENZ_TEXT.stammFehlt);
          return false;
        }
        try {
          await api.put(`/organizations/${bestand.id}`, lizenzPutKoerper(stamm, teil.laufzeit));
          laufzeitGespeichert = true;
        } catch (err) {
          setError(tarifGespeichert ? LIZENZ_TEXT.teilGespeichert : fehlerText(err, 'Laufzeit konnte nicht gespeichert werden'));
          return false;
        }
      }
      const limit = teil.limit ? teil.limit.max_konfis : bestand.max_konfis;
      const ende = teil.laufzeit ? teil.laufzeit.trial_ends_at : bestand.trial_ends_at;
      const isTrial = teil.laufzeit ? teil.laufzeit.is_trial : bestand.is_trial;
      const geaendertText = LIZENZ_TEXT.gespeichert(`${tarifAngabe(limit).name}${ende ? ` bis ${datumKurz(ende)}` : ` · ${LIZENZ_TEXT.laufzeitUnbegrenzt}`}`);
      // Eine gesperrte Gemeinde bleibt gesperrt (der PUT schreibt is_active, wie es ist) -- das sagt auch die Meldung.
      setSuccess(bestand.is_active ? geaendertText : `${geaendertText}. ${LIZENZ_TEXT.bleibtGesperrt}`);
      // Der neue Stand ist die neue Vorbelegung -- auch bevor der Vorgang neu geladen ist.
      setFormular(lizenzVorbelegen({ ...bestand, max_konfis: limit, trial_ends_at: ende, is_trial: isTrial }));
      return true;
    } finally {
      // Auch nach einem Teilerfolg: Karte und Stand zeigen den Tarif, der jetzt gilt.
      if (tarifGespeichert || laufzeitGespeichert) meldeSupportGeaendert();
      setSpeichert(false);
    }
  };

  return {
    /** Nur mit Gemeinde -- ohne sie ist „Ändern" gesperrt (erst zuordnen). */
    aenderbar: bestand !== null,
    bestand,
    formular,
    aendern,
    zuruecksetzen,
    wunschUebernehmen,
    /** Name der Wunschlizenz für den Knopf („Wunschlizenz übernehmen: Standard"). */
    wunschName,
    laufzeitWahlen,
    laufzeitGesperrt,
    vorschau,
    fehler,
    geaendert,
    speichern,
    speichert,
    /** „Alle Angaben der Gemeinde bearbeiten" -- das Gemeinde-Formular. */
    formularLink: bestand ? `/admin/organizations?gemeinde=${bestand.id}&bearbeiten=1` : null,
    isOnline,
  };
}

export type LizenzAendernDaten = ReturnType<typeof useLizenzAendern>;
