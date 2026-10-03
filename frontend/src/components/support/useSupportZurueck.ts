import { useIonRouter } from '@ionic/react';

/**
 * Zurueck in der Support-Ansicht: in der Historie, wenn es eine gibt -- sonst
 * (Adresse direkt aufgerufen, Seite neu geladen) auf `ziel`, statt die
 * Web-Version zu verlassen.
 */
export function useSupportZurueck(ziel: string): () => void {
  const router = useIonRouter();
  return () => {
    if (router.canGoBack()) router.goBack();
    else router.push(ziel, 'back', 'replace');
  };
}
