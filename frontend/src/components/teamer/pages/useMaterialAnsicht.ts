// Ein Material zum Ansehen laden -- als Logik ohne Darstellung (Simon,
// 15.10.2026, Seiten-Inventar: im Browser ab 992 px jedes Fenster kompakt).
// Die App zeigt es im Modal (TeamerMaterialDetailPage, geöffnet aus den
// Events von Team und Leitung), der Browser im Fenster „Material ansehen"
// (shared/web/termine/WebTerminMaterialDialog -> admin/web/leitung/WebMaterialDialog,
// derselbe wie unter „Material verwalten").
//
// Material-Detail: erst der Server, den zuletzt geladenen Stand nur ohne
// Netz (27.09.2026; vorher useOfflineQuery, gemerkter Stand zuerst).
// Grund: Die Dateien liegen seitdem im Medien-Cache — eine inzwischen
// gelöschte Datei stünde sonst nach dem Öffnen kurz in der Liste und
// öffnete sich vom Gerät. materialDetailLaden nimmt dabei vom Gerät, was
// der Server nicht mehr führt.
//
// Anonyme Messung „Material angesehen" (Simon, 27.09.2026): EINMAL je
// Oeffnen, nur nach einer Antwort des Servers (docs/messung/umami.md: ein
// Stand nur aus dem Zwischenspeicher zaehlt nicht), die Art des Inhalts
// ueber materialLinks (nur http/https). Das gilt fuer App und Browser
// gleich: Das Fenster des Browsers zaehlt ueber diesen Hook und schaltet die
// eigene Zaehlung von WebMaterialDialog ab (`angesehenMelden={false}`) --
// sonst zaehlte es doppelt, auch ohne Netz.

import { useCallback, useEffect, useRef, useState } from 'react';
import { materialDetailLaden, type MaterialDateiVerweis } from '../../../services/materialDetail';
import { materialInhalt, trackHandlung } from '../../../services/analytics';
import { materialLinks } from '../../../utils/linkDisplay';

interface MaterialGrund {
  files?: MaterialDateiVerweis[];
  link_url?: string | null;
  links?: { url: string }[];
}

export function useMaterialAnsicht<T extends MaterialGrund>(materialId: number) {
  // Die Seite wird als Modal jedes Mal neu montiert; Aktualisieren und
  // Wiederverbinden laden erneut und duerfen nicht noch einmal zaehlen.
  const angesehenGemeldet = useRef(false);
  const [material, setMaterial] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!materialId);

  const laden = useCallback(async (): Promise<T | null> => {
    try {
      const { daten, ausSpeicher } = await materialDetailLaden<T>(materialId);
      // Nur nach einer Antwort des Servers — ein Stand nur vom Gerät
      // (offline) zaehlt nicht. Nur die Art des Inhalts, kein Titel, keine
      // Kennung.
      if (!ausSpeicher && !angesehenGemeldet.current) {
        angesehenGemeldet.current = true;
        trackHandlung('material-angesehen', {
          inhalt: materialInhalt((daten?.files?.length ?? 0) > 0, materialLinks(daten ?? {}).length > 0)
        });
      }
      return daten;
    } catch {
      return null;
    }
  }, [materialId]);

  useEffect(() => {
    if (!materialId) return;
    let aktiv = true;
    void laden().then((daten) => {
      if (!aktiv) return;
      setMaterial(daten);
      setLoading(false);
    });
    return () => { aktiv = false; };
  }, [materialId, laden]);

  const refresh = async () => {
    setMaterial(await laden());
  };

  return { material, loading, refresh };
}
