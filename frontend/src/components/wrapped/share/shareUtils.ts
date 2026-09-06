import { toPng } from 'html-to-image';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface ShareTextData {
  wrappedType: 'konfi' | 'teamer';
  displayName: string;
  year: number;
  slideKey: string;
  slideValue?: string;
}

function generateFallbackText(data: ShareTextData): string {
  const prefix = data.wrappedType === 'teamer'
    ? `Mein Teamer-Jahr ${data.year}`
    : `Mein Konfi-Jahr ${data.year}`;

  if (data.slideValue) {
    return `${prefix}: ${data.slideValue}! #KonfiQuest`;
  }
  return `${prefix} - Schau dir meinen Rückblick an! #KonfiQuest`;
}


/**
 * Wartet, bis das Hintergrundfoto der Karte wirklich geladen ist.
 *
 * WARUM: html-to-image zeichnet, was DA IST. Ein Motiv, das im Moment des
 * Tippens noch laedt, fehlt im Bild -- ohne Fehler und ohne Meldung. Die
 * Motive werden zwar mit der App ausgeliefert, aber beim allerersten
 * Oeffnen einer Seite sind sie noch nicht im Zwischenspeicher.
 *
 * decode() statt onload: Es wartet nicht nur auf die Bytes, sondern auch
 * darauf, dass das Bild entpackt ist -- erst dann kann es gezeichnet werden.
 */
async function wartAufBilder(el: HTMLElement): Promise<void> {
  const foto = el.querySelector('.share-card-foto') as HTMLElement | null;
  const stil = foto?.style.backgroundImage;
  const treffer = stil?.match(/url\(["']?([^"')]+)["']?\)/);
  if (!treffer) return;
  try {
    const bild = new Image();
    bild.src = treffer[1];
    await bild.decode();
  } catch {
    // Bild fehlt oder laesst sich nicht entpacken: Die Karte wird dann
    // ohne Foto exportiert -- mit Farbverlauf und Text ist sie immer noch
    // ein brauchbares Bild. Besser als gar nichts zu teilen.
  }
}

/**
 * Erzeugt das Teilen-Bild.
 *
 * KEIN cacheBust (gemessen 06.09.2026): Die Option haengt einen Zeitstempel
 * an jede Bild-Adresse. html-to-image liest den Dateityp aber aus der
 * Endung -- aus `watt.webp` wird `watt.webp?1757200000000`, und die
 * Typerkennung liefert dann eine leere Zeichenkette statt `image/webp`.
 * Gebraucht wird die Option ohnehin nicht: Die Motive liegen fest in der
 * App und aendern sich nicht unter der Hand.
 */
async function erzeugeBild(el: HTMLElement): Promise<string> {
  await wartAufBilder(el);
  return toPng(el, {
    width: 1080,
    height: 1920,
    pixelRatio: 1,
  });
}

export async function shareSlide(
  cardElement: HTMLElement,
  slideKey: string,
  wrappedType: 'konfi' | 'teamer',
  textFallbackData: ShareTextData
): Promise<void> {
  try {
    const dataUrl = await erzeugeBild(cardElement);

    if (Capacitor.isNativePlatform()) {
      // Native: Filesystem + Share-Sheet
      const base64 = dataUrl.split(',')[1];
      const fileName = `wrapped_${slideKey}_${Date.now()}.png`;

      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });

      const fileUri = await Filesystem.getUri({
        path: fileName,
        directory: Directory.Cache,
      });

      await Share.share({
        files: [fileUri.uri],
      });
    } else {
      // Web: Download-Link erstellen
      const link = document.createElement('a');
      link.download = `wrapped_${slideKey}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (err) {
    console.warn('Bild-Export fehlgeschlagen, Text-Fallback:', err);

    // Text-Fallback
    const fallbackText = generateFallbackText(textFallbackData);

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: wrappedType === 'teamer' ? 'Mein Teamer Wrapped' : 'Mein Konfi Wrapped',
          text: fallbackText,
        });
      } else if (navigator.share) {
        await navigator.share({ text: fallbackText });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(fallbackText);
      }
    } catch {
      // Share abgebrochen oder nicht verfuegbar - kein Fehler
    }
  }
}
