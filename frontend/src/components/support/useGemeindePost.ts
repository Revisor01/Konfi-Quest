// Der Schriftwechsel einer Gemeinde als Logik ohne Darstellung
// (/admin/support/post/gemeinde/:id, Support-Mail, 03.10.2026): alle Mails der
// Gemeinde laden (ungelesene als gelesen melden), die Gemeinde selbst und die
// moeglichen Empfaenger fuer Antworten von support@. Die App-Fassung
// (SupportGemeindePostPage) und die Web-Fassung (web/WebGemeindePost) zeigen
// dieselbe Logik.
//
// Die Gemeinde kommt aus GET /organizations/:id, NICHT aus der Liste
// GET /organizations: Die Liste laesst interne Gemeinden weg (Migration 194),
// ihr Schriftwechsel stuende dort ohne Namen da. Die einzelne Route liefert
// auch sie -- samt Wunschlizenz.

import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import type { MailEmpfaenger, MailNachricht } from '../../types/support';
import { chronologisch, empfaengerLesen, gemeindeName, standardBetreff, ungeleseneIds } from '../../utils/supportMail';
import { gemeindeDetailLesen, type GemeindeDetail } from '../../utils/supportWeb';
import { mailsAlsGelesen } from '../../navigation/supportMailZaehler';

export function useGemeindePost(organizationId: number) {
  const [gemeinde, setGemeinde] = useState<GemeindeDetail | null>(null);
  const [verlauf, setVerlauf] = useState<MailNachricht[] | null>(null);
  const [verlaufFehler, setVerlaufFehler] = useState(false);
  const [neu, setNeu] = useState<ReadonlySet<number>>(new Set());
  const [empfaenger, setEmpfaenger] = useState<MailEmpfaenger[]>([]);
  const [empfaengerFehlt, setEmpfaengerFehlt] = useState(false);

  const verlaufHolen = useCallback(async (ersterAbruf: boolean) => {
    try {
      const antwort = await api.get(`/support/gemeinden/${organizationId}/verlauf`);
      const liste = chronologisch(Array.isArray(antwort.data) ? antwort.data as MailNachricht[] : []);
      const ungelesen = ungeleseneIds(liste);
      setVerlauf(liste);
      setVerlaufFehler(false);
      if (ersterAbruf) setNeu(new Set(ungelesen));
      void mailsAlsGelesen(ungelesen);
    } catch {
      setVerlaufFehler(true);
    }
  }, [organizationId]);

  const rahmenHolen = useCallback(async () => {
    const [g, e] = await Promise.allSettled([
      api.get(`/organizations/${organizationId}`),
      api.get(`/support/gemeinden/${organizationId}/empfaenger`),
    ]);
    // Eine Gemeinde mit anderer Kennung in der Antwort gilt nicht als diese.
    const gelesen = g.status === 'fulfilled' ? gemeindeDetailLesen(g.value.data) : null;
    setGemeinde(gelesen && gelesen.id === organizationId ? gelesen : null);
    setEmpfaenger(e.status === 'fulfilled' ? empfaengerLesen(e.value.data) : []);
    setEmpfaengerFehlt(e.status !== 'fulfilled');
  }, [organizationId]);

  useEffect(() => {
    void verlaufHolen(true);
    void rahmenHolen();
  }, [verlaufHolen, rahmenHolen]);

  const name = gemeinde ? gemeindeName(gemeinde) : `Gemeinde ${organizationId}`;
  const letzte = verlauf && verlauf.length > 0 ? verlauf[verlauf.length - 1] : null;
  const betreffVorschlag = standardBetreff(letzte?.betreff);

  return { gemeinde, name, verlauf, verlaufFehler, neu, empfaenger, empfaengerFehlt, letzte, betreffVorschlag, verlaufHolen };
}

export type GemeindePostDaten = ReturnType<typeof useGemeindePost>;
