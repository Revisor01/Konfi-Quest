// Eine Mail aus dem Posteingang einsortieren -- als Logik ohne Darstellung
// (docs/planung/support-vorgaenge.md, Entscheidung 1 und 7): in einen
// bestehenden Vorgang (mit Suche) oder in einen neuen mit Art, Bereich,
// Dringlichkeit, Betreff und Gemeinde. Die Web-Fassung (Dialog,
// web/WebEinsortieren) und die App-Fassung (Abschnitt auf der Seite der Mail)
// zeigen dieselbe Logik.
//
// POST /support/mail/nachrichten/:id/einsortieren
//   { vorgang_id }  oder  { neu: { art, bereich?, dringlichkeit?, betreff?, organization_id? } }
// Aus dem Posteingang gehen die Mails desselben Fadens mit, soweit sie noch
// dort liegen; eine Mail, die schon in einem Vorgang liegt, geht allein
// (backend/routes/supportMail.js) -- so verschiebt das Menü einer Mail im
// Vorgang („In anderen Vorgang verschieben", „In neuen Vorgang herauslösen")
// nur sie. Der eigene Vorgang steht dann nicht zur Wahl. Ein Vorgang, der
// dabei leer wird, bleibt stehen. Danach laden alle Ansichten neu
// („Support-Daten geändert").
//
// Seit 12.10.2026 (Paket 6, Frage 11): Kennt der Server den Absender
// (`absender_bekannt`), belegt der Dialog vor -- der bestehende Vorgang ist
// der jüngste offene der Gemeinde, ein neuer Vorgang bekommt die Gemeinde.
// Nicht beim Verschieben aus dem Menü einer Mail im Vorgang (`ausVorgang`).
// `useDirektEinsortieren` legt die Mail ohne Dialog in einen Vorgang
// („In Vorgang N einsortieren") -- derselbe Aufruf, dieselbe Folge.

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type { GemeindeKurz } from '../../types/support';
import { fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { gemeindenSortiert } from '../../utils/supportMail';
import {
  type EinsortierenKoerper,
  einsortierenBestehendKoerper,
  einsortierenNeuFehler,
  einsortierenNeuKoerper,
  einsortierenNeuVorbelegen,
  vorgaengeSortieren,
  type EinsortierenNeuFormular,
  type Vorgang,
} from '../../utils/supportVorgaenge';
import { EINSORTIEREN_HINWEIS } from '../../seiten/supportDetail';
import { meldeSupportGeaendert } from '../../utils/supportAktualisieren';
import { vorgaengeLaden } from './useVorgangsliste';

export type EinsortierenModus = 'bestehend' | 'neu';

/** Womit der Dialog vorbelegt ist, wenn der Server den Absender kennt (`absender_bekannt`). */
export interface EinsortierenVorgabe {
  /** Der jüngste offene Vorgang der Gemeinde: vorgewählt unter „Bestehender Vorgang". */
  vorgangId: number | null;
  /** Die Gemeinde: vorgewählt beim neuen Vorgang. */
  organizationId: number | null;
}

export interface EinsortierenOptionen {
  /** Die Mail liegt in diesem Vorgang: Er steht nicht zur Wahl, und die Mail geht allein. */
  ausVorgang?: number | null;
  /** Womit der Dialog beginnt -- „In neuen Vorgang herauslösen" beginnt mit 'neu'. */
  modus?: EinsortierenModus;
  /** Vorbelegung aus `absender_bekannt` -- gilt nur aus dem Posteingang, nicht mit `ausVorgang`. */
  vorgabe?: EinsortierenVorgabe | null;
}

/**
 * POST …/einsortieren. Die Kennung des Vorgangs: die gewählte, sonst die,
 * die der Server nennt (`vorgang_id`, ältere Stände `id`), sonst null.
 */
async function einsortierenSenden(mailId: number, koerper: EinsortierenKoerper, gewaehlt: number | null): Promise<number | null> {
  const antwort = await api.post(`/support/mail/nachrichten/${mailId}/einsortieren`, koerper);
  const daten = antwort.data as { vorgang_id?: unknown; id?: unknown } | undefined;
  const neueId = typeof daten?.vorgang_id === 'number' ? daten.vorgang_id : typeof daten?.id === 'number' ? daten.id : null;
  return gewaehlt ?? neueId;
}

/** „Mail in Vorgang N einsortiert" bzw. ohne Nummer „Mail einsortiert". */
const einsortiertText = (id: number | null): string => (id ? `Mail in Vorgang ${id} einsortiert` : 'Mail einsortiert');

export function useEinsortieren(
  mail: { id: number; betreff: string | null },
  onFertig?: (vorgangId: number | null) => void,
  o: EinsortierenOptionen = {},
) {
  const { setError, setSuccess, isOnline } = useApp();
  const ausVorgang = o.ausVorgang ?? null;
  // Die Vorbelegung gilt beim Öffnen (Startwert) -- und nie beim Verschieben aus einem Vorgang.
  const vorgabe = ausVorgang === null ? o.vorgabe ?? null : null;

  const [modus, setModus] = useState<EinsortierenModus>(o.modus ?? 'bestehend');
  const [vorgaenge, setVorgaenge] = useState<Vorgang[] | null>(null);
  const [vorgaengeFehlen, setVorgaengeFehlen] = useState(false);
  const [vorgangWahl, setVorgangWahl] = useState(() => (vorgabe?.vorgangId ? String(vorgabe.vorgangId) : ''));
  const [neu, setNeu] = useState<EinsortierenNeuFormular>(
    () => einsortierenNeuVorbelegen(mail.betreff, vorgabe?.organizationId ? String(vorgabe.organizationId) : ''),
  );
  const [gemeinden, setGemeinden] = useState<GemeindeKurz[]>([]);
  const [gemeindenFehlen, setGemeindenFehlen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);

  // Vorgaenge zur Auswahl (die offenen, die juengste Aktivitaet zuerst) und Gemeinden.
  useEffect(() => {
    let aktiv = true;
    void vorgaengeLaden('offen').then(
      (liste) => {
        if (!aktiv) return;
        // Verschieben: der eigene Vorgang ist kein Ziel.
        setVorgaenge(vorgaengeSortieren(liste.filter((v) => v.id !== ausVorgang)));
        setVorgaengeFehlen(false);
      },
      () => { if (aktiv) { setVorgaenge([]); setVorgaengeFehlen(true); } },
    );
    void api.get('/organizations').then(
      (antwort) => {
        if (!aktiv) return;
        setGemeinden(Array.isArray(antwort.data) ? gemeindenSortiert(antwort.data) : []);
        setGemeindenFehlen(!Array.isArray(antwort.data));
      },
      () => { if (aktiv) setGemeindenFehlen(true); },
    );
    return () => { aktiv = false; };
  }, [ausVorgang]);

  const gewaehlterVorgang = useMemo(() => vorgaenge?.find((v) => String(v.id) === vorgangWahl) ?? null, [vorgaenge, vorgangWahl]);

  const aendernNeu = (teil: Partial<EinsortierenNeuFormular>) => {
    setFehler(null);
    setNeu((f) => ({ ...f, ...teil }));
  };

  const absenden = async () => {
    if (offlineBlockiert(isOnline, setError)) return;
    let koerper;
    if (modus === 'bestehend') {
      if (!gewaehlterVorgang) {
        setFehler('Bitte einen Vorgang wählen');
        return;
      }
      koerper = einsortierenBestehendKoerper(gewaehlterVorgang.id);
    } else {
      const meldung = einsortierenNeuFehler(neu);
      if (meldung) {
        setFehler(meldung);
        return;
      }
      koerper = einsortierenNeuKoerper(neu);
    }
    setSendet(true);
    try {
      const id = await einsortierenSenden(mail.id, koerper, gewaehlterVorgang?.id ?? null);
      setSuccess(einsortiertText(id));
      meldeSupportGeaendert();
      onFertig?.(id);
    } catch (err) {
      setFehler(fehlerText(err, 'Mail konnte nicht einsortiert werden'));
    } finally {
      setSendet(false);
    }
  };

  return {
    isOnline,
    modus,
    setModus: (m: EinsortierenModus) => { setFehler(null); setModus(m); },
    vorgaenge,
    vorgaengeFehlen,
    vorgangWahl,
    setVorgangWahl: (w: string) => { setFehler(null); setVorgangWahl(w); },
    gewaehlterVorgang,
    neu,
    aendernNeu,
    gemeinden,
    gemeindenFehlen,
    fehler,
    sendet,
    absenden,
    /** Was mitgeht: aus dem Posteingang der Faden, aus einem Vorgang nur diese Mail. */
    hinweis: ausVorgang !== null ? EINSORTIEREN_HINWEIS.allein : EINSORTIEREN_HINWEIS.faden,
  };
}

export type EinsortierenZustand = ReturnType<typeof useEinsortieren>;

/**
 * „In Vorgang N einsortieren" ohne Dialog (die Zeile „Absender gehört zu …"):
 * derselbe Aufruf wie Einsortieren in einen bestehenden Vorgang
 * ({ vorgang_id }) und dieselbe Folge -- Meldung, „Support-Daten geändert",
 * `onFertig(N)` (die Seite öffnet den Vorgang mit der Mail). Fehler kommen
 * als Meldung; ohne Netz geschieht nichts.
 */
export function useDirektEinsortieren(mailId: number | null, onFertig?: (vorgangId: number | null) => void) {
  const { setError, setSuccess, isOnline } = useApp();
  const [sendet, setSendet] = useState(false);

  const einsortieren = async (vorgangId: number): Promise<boolean> => {
    if (mailId === null || sendet || offlineBlockiert(isOnline, setError)) return false;
    setSendet(true);
    try {
      const id = await einsortierenSenden(mailId, einsortierenBestehendKoerper(vorgangId), vorgangId);
      setSuccess(einsortiertText(id));
      meldeSupportGeaendert();
      onFertig?.(id);
      return true;
    } catch (err) {
      setError(fehlerText(err, 'Mail konnte nicht einsortiert werden'));
      return false;
    } finally {
      setSendet(false);
    }
  };

  return { einsortieren, sendet, isOnline };
}
