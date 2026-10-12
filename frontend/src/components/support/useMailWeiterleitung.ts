// Eine Mail, die nicht im Posteingang liegt, öffnet sich dort, wo sie liegt
// (docs/planung/support-detailseiten.md, E): /admin/support/post/5 ersetzt
// sich durch /admin/support/vorgaenge/2?mail=5 -- der Vorgang ist gewählt,
// die Mail offen und hervorgehoben. Mit replace, sonst landete „Zurück" wieder
// in der Weiterleitung. Das Ziel bestimmt mailStand (usePostDetail,
// `weiterleitung`); App und Browser leiten gleich weiter.
//
// Nur, solange der Posteingang die Seite ist, die man sieht: Ionic hält
// besuchte Seiten im Speicher, und eine Mail, die gerade einsortiert wurde,
// lädt dort im Hintergrund neu. Ohne diese Prüfung ersetzte sie die Seite,
// zu der man inzwischen gegangen ist. Jedes Ziel höchstens einmal.
//
// Im Browser steht die Mail im Lesebereich neben der Liste. Dort leitet nur,
// was schon beim Öffnen woanders lag (Direktlink, Übersicht): `beimOeffnen`
// nennt die geladene Mail, und ihr erstes Ziel gilt. Wird die gewählte Mail
// später woanders einsortiert -- anderer Reiter, Handy, zweite Person --,
// ersetzte die Weiterleitung sonst den ganzen Posteingang durch den Vorgang,
// und „Zurück" führte nicht mehr zur Liste (bis 12.10.2026). Dann sagt es der
// Lesebereich und öffnet den Vorgang auf Wunsch (WebPostDetail).

import { useEffect, useRef, useState } from 'react';
import { useIonRouter } from '@ionic/react';
import { useAppLocation } from '../../navigation/useAppLocation';
import { SUPPORT_POSTEINGANG } from '../../navigation/supportMenue';

/**
 * @param ziel  Wohin die Mail gehört; null: Sie liegt im Posteingang.
 * @param beimOeffnen  Nur im Browser: die Kennung der geladenen Mail (null,
 *   solange sie lädt). Dann leitet nur das Ziel, das sie beim ersten Laden hatte.
 * @returns ob die Seite weiterleitet (bzw. gleich weiterleiten wird).
 */
export function useMailWeiterleitung(ziel: string | null, beimOeffnen?: { mailId: number | null }): boolean {
  const router = useIonRouter();
  const { pathname } = useAppLocation();
  const sichtbar = pathname === SUPPORT_POSTEINGANG || pathname.startsWith(`${SUPPORT_POSTEINGANG}/`);
  const geleitet = useRef<string | null>(null);

  // Das Ziel beim ersten Laden der Mail (nachgezogen beim Rendern, je Mail neu).
  const mailId = beimOeffnen?.mailId ?? null;
  const [erstes, setErstes] = useState<{ id: number; ziel: string | null } | null>(null);
  if (mailId !== null && erstes?.id !== mailId) setErstes({ id: mailId, ziel });
  const erstesZiel = mailId === null ? null : erstes?.id === mailId ? erstes.ziel : ziel;
  const leitet = ziel !== null && (beimOeffnen === undefined || ziel === erstesZiel);

  useEffect(() => {
    if (!ziel || !leitet || !sichtbar || geleitet.current === ziel) return;
    geleitet.current = ziel;
    router.push(ziel, 'none', 'replace');
  }, [ziel, leitet, sichtbar, router]);

  return leitet;
}
