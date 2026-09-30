// Dateiauswahl auf Android: Dokumente kommen als stabile Kopie ans WebView
// (30.09.2026).
//
// Tester-Rueckmeldung Build 130: "Docx/PDF geht im Chat immer noch nicht.
// Laesst sich auch bei Material nicht speichern -- vom Handy aus." Vom iPhone
// ging es. Capacitor reicht die content://-Adresse der Auswahl unveraendert
// ans WebView, und das liest die Datei erst beim Senden; meldet der Anbieter
// dann eine andere Aenderungszeit, bricht der Upload mit
// ERR_UPLOAD_FILE_CHANGED ab, bevor der Server etwas sieht (Chromium-Fehler
// 40123366). DateiAuswahlChromeClient kopiert jedes Dokument vorher in den
// Cache und reicht es ueber den FileProvider der App weiter.
//
// Die Logik (was, wohin, wie gross, wann weg) pruefen JUnit-Tests
// (android/app/src/test/.../DateiKopieTest.java, `./gradlew test`). Hier steht
// die Verdrahtung, die ohne Geraet nur am Quelltext zu sehen ist.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const lies = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8');
const JAVA = 'android/app/src/main/java/de/godsapp/konfiquest';
const parse = (xml: string) => {
  const dom = new DOMParser().parseFromString(xml, 'application/xml');
  expect(dom.getElementsByTagName('parsererror')).toHaveLength(0);
  return dom;
};

describe('Android-Dateiauswahl: Dokumente als Kopie', () => {
  const activity = lies(`${JAVA}/MainActivity.java`);
  const client = lies(`${JAVA}/DateiAuswahlChromeClient.java`);

  it('MainActivity setzt den Client NACH super.onCreate -- vorher gibt es kein WebView', () => {
    const aufbau = activity.indexOf('super.onCreate(savedInstanceState);');
    const setzen = activity.indexOf('bridge.getWebView().setWebChromeClient(new DateiAuswahlChromeClient(bridge));');
    expect(aufbau).toBeGreaterThan(-1);
    expect(setzen).toBeGreaterThan(aufbau);
    // ... und noch in onCreate: Der Client meldet ActivityResult-Starter an,
    // das geht nur, bevor die Activity gestartet ist.
    const onResume = activity.indexOf('public void onResume()');
    expect(setzen).toBeLessThan(onResume);
  });

  it('der Client baut auf dem von Capacitor auf und laesst dessen Auswahl laufen', () => {
    expect(client).toContain('public class DateiAuswahlChromeClient extends BridgeWebChromeClient');
    expect(client).toContain('return super.onShowFileChooser(webView, stabilisierend, parameter);');
  });

  it('die Kopie geht ueber den FileProvider der App, und der gibt den Cache frei', () => {
    expect(client).toContain('FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", ziel)');
    expect(client).toContain('new File(context.getCacheDir(), ORDNER)');

    const manifest = parse(lies('android/app/src/main/AndroidManifest.xml'));
    const anbieter = [...manifest.getElementsByTagName('provider')]
      .find((p) => p.getAttribute('android:name') === 'androidx.core.content.FileProvider');
    expect(anbieter?.getAttribute('android:authorities')).toBe('${applicationId}.fileprovider');

    const pfade = parse(lies('android/app/src/main/res/xml/file_paths.xml'));
    const cache = [...pfade.getElementsByTagName('cache-path')].map((c) => c.getAttribute('path'));
    expect(cache).toContain('.');
  });

  it('die JUnit-Tests der Logik liegen bei der App', () => {
    expect(existsSync(join(process.cwd(), 'android/app/src/test/java/de/godsapp/konfiquest/DateiKopieTest.java'))).toBe(true);
  });
});
