// Eine Mail aus dem Posteingang einsortieren -- als Logik ohne Darstellung
// (docs/planung/support-vorgaenge.md, Entscheidung 1 und 7): in einen
// bestehenden Vorgang (mit Suche) oder in einen neuen mit Art, Bereich,
// Dringlichkeit, Betreff und Gemeinde. Die Web-Fassung (Dialog,
// web/WebEinsortieren) und die App-Fassung (Abschnitt auf der Seite der Mail)
// zeigen dieselbe Logik.
//
// POST /support/mail/nachrichten/:id/einsortieren
//   { vorgang_id }  oder  { neu: { art, bereich?, dringlichkeit?, betreff?, organization_id? } }
// Der ganze Faden geht mit. Danach laden alle Ansichten neu („Support-Daten
// geändert"); die Mail verschwindet aus dem Posteingang.

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type { GemeindeKurz } from '../../types/support';
import { fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { gemeindenSortiert } from '../../utils/supportMail';
import {
  einsortierenBestehendKoerper,
  einsortierenNeuFehler,
  einsortierenNeuKoerper,
  einsortierenNeuVorbelegen,
  vorgaengeSortieren,
  type EinsortierenNeuFormular,
  type Vorgang,
} from '../../utils/supportVorgaenge';
import { meldeSupportGeaendert } from '../../utils/supportAktualisieren';
import { vorgaengeLaden } from './useVorgangsliste';

export type EinsortierenModus = 'bestehend' | 'neu';

export function useEinsortieren(mail: { id: number; betreff: string | null }, onFertig?: (vorgangId: number | null) => void) {
  const { setError, setSuccess, isOnline } = useApp();

  const [modus, setModus] = useState<EinsortierenModus>('bestehend');
  const [vorgaenge, setVorgaenge] = useState<Vorgang[] | null>(null);
  const [vorgaengeFehlen, setVorgaengeFehlen] = useState(false);
  const [vorgangWahl, setVorgangWahl] = useState('');
  const [neu, setNeu] = useState<EinsortierenNeuFormular>(() => einsortierenNeuVorbelegen(mail.betreff));
  const [gemeinden, setGemeinden] = useState<GemeindeKurz[]>([]);
  const [gemeindenFehlen, setGemeindenFehlen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);

  // Vorgaenge zur Auswahl (die offenen, die juengste Aktivitaet zuerst) und Gemeinden.
  useEffect(() => {
    let aktiv = true;
    void vorgaengeLaden('offen').then(
      (liste) => { if (aktiv) { setVorgaenge(vorgaengeSortieren(liste)); setVorgaengeFehlen(false); } },
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
  }, []);

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
      const antwort = await api.post(`/support/mail/nachrichten/${mail.id}/einsortieren`, koerper);
      const daten = antwort.data as { vorgang_id?: unknown; id?: unknown } | undefined;
      const neueId = typeof daten?.vorgang_id === 'number' ? daten.vorgang_id : typeof daten?.id === 'number' ? daten.id : null;
      const id = gewaehlterVorgang?.id ?? neueId;
      setSuccess(id ? `Mail in Vorgang ${id} einsortiert` : 'Mail einsortiert');
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
  };
}

export type EinsortierenZustand = ReturnType<typeof useEinsortieren>;
