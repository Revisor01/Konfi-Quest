// Zahl am App-Symbol auf Android.
//
// Simon, 29.09.2026, interner Testbuild 2.3.0: "auf dem Icon keine Badges auf
// Android".
//
// WIE DIE ZAHL AUF ANDROID ENTSTEHT -- zwei Wege, beide vom Launcher abhaengig:
//
// 1. Aus den Mitteilungen. Ab Android 8 zeigt der Launcher am Symbol einen
//    Punkt, solange die App eine Mitteilung in der Leiste hat. Samsung zeigt
//    auf Wunsch statt des Punkts die Zahl der offenen Mitteilungen. Die
//    Kanaele der App lassen das zu: createChannel des Push-Plugins ruft nie
//    setShowBadge(false), und Androids Voreinstellung ist "an".
//
// 2. Aus der App selbst. BadgeContext gibt die Zahl an @capawesome/
//    capacitor-badge. Das Plugin hat auf Android keine offizielle
//    Schnittstelle (die gibt es nicht) und benutzt ShortcutBadger: Es sucht
//    den Launcher per queryIntentActivities(MAIN/HOME) und spricht ihn dann
//    ueber dessen eigene Wege an -- Samsung ueber den Broadcast
//    BADGE_COUNT_UPDATE oder den Anbieter com.sec.badge, Huawei ueber
//    com.huawei.android.launcher.settings, OPPO ueber com.android.badge.
//
//    Seit targetSdk 30 sieht eine App fremde Pakete nur noch, wenn sie sie im
//    Manifest unter <queries> anmeldet (Android-Doku "package visibility":
//    "Limited app visibility affects the results returned by methods [...]
//    such as queryIntentActivities()"; der Launcher steht nicht in der Liste
//    der automatisch sichtbaren Pakete). Konfi Quest baut mit targetSdk 36
//    und hatte keinen <queries>-Block. Dann findet ShortcutBadger den
//    Launcher nicht, und bei leerer Liste wirft es in initBadger sogar
//    (Collections.swap auf einer leeren Liste) -- Badge.set() wird
//    abgewiesen, BadgeContext schreibt nur "Badge nicht verfuegbar" ins
//    Protokoll. Das ist der Teil, der im Code lag. Abgeleitet aus Doku und
//    Quelltext; an einem Geraet gemessen ist es nicht (hier gibt es kein
//    Android-SDK).
//
// Was auch mit <queries> NICHT geht: der Pixel-Launcher und andere
// Android-Standard-Launcher kennen keine Zahl von aussen, nur den Punkt aus
// Weg 1 (so auch die Plugin-Doku unter "Quirks").
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import config from '../../../capacitor.config';

const manifest = readFileSync(join(process.cwd(), 'android/app/src/main/AndroidManifest.xml'), 'utf8');
const ANDROID_NS = 'http://schemas.android.com/apk/res/android';

const queries = (): Element[] => {
  const dom = new DOMParser().parseFromString(manifest, 'application/xml');
  expect(dom.getElementsByTagName('parsererror')).toHaveLength(0);
  const bloecke = [...dom.documentElement.children].filter((e) => e.tagName === 'queries');
  return bloecke;
};

const intentsInQueries = (): { aktionen: string[]; kategorien: string[] }[] =>
  queries().flatMap((q) =>
    [...q.getElementsByTagName('intent')].map((i) => ({
      aktionen: [...i.getElementsByTagName('action')].map((a) => a.getAttributeNS(ANDROID_NS, 'name') ?? ''),
      kategorien: [...i.getElementsByTagName('category')].map((c) => c.getAttributeNS(ANDROID_NS, 'name') ?? ''),
    })),
  );

const anbieterInQueries = (): string[] =>
  queries().flatMap((q) =>
    [...q.getElementsByTagName('provider')].flatMap((p) =>
      (p.getAttributeNS(ANDROID_NS, 'authorities') ?? '').split(';'),
    ),
  );

describe('Zahl am App-Symbol (Android): das Plugin ist eingebunden', () => {
  it('capacitor-badge steht in der Positivliste der nativen Plugins', () => {
    expect(config.includePlugins).toContain('@capawesome/capacitor-badge');
  });

  it('und ist im Android-Projekt verdrahtet', () => {
    const einstellungen = readFileSync(join(process.cwd(), 'android/capacitor.settings.gradle'), 'utf8');
    const bau = readFileSync(join(process.cwd(), 'android/app/capacitor.build.gradle'), 'utf8');
    expect(einstellungen).toContain("include ':capawesome-capacitor-badge'");
    expect(bau).toContain("implementation project(':capawesome-capacitor-badge')");
  });

  it('nutzt auf Android ShortcutBadger -- nur dafuer sind die <queries> da', () => {
    // Stellt das Plugin einmal um, muss jemand pruefen, ob die Eintraege
    // unten noch gebraucht werden. Dieser Test faellt dann zuerst.
    const plugin = readFileSync(
      join(process.cwd(), 'node_modules/@capawesome/capacitor-badge/android/build.gradle'),
      'utf8',
    );
    expect(plugin).toContain('me.leolin:ShortcutBadger');
  });
});

describe('Zahl am App-Symbol (Android): das Manifest macht den Launcher sichtbar', () => {
  it('genau ein <queries>-Block direkt unter <manifest>', () => {
    expect(queries()).toHaveLength(1);
  });

  it('meldet die Suche nach dem Startbildschirm an (MAIN + HOME)', () => {
    // Ohne diesen Eintrag liefert queryIntentActivities(HOME) ab targetSdk 30
    // eine leere Liste -- ShortcutBadger findet dann keinen Launcher.
    const home = intentsInQueries().filter(
      (i) => i.aktionen.includes('android.intent.action.MAIN') && i.kategorien.includes('android.intent.category.HOME'),
    );
    expect(home).toHaveLength(1);
  });

  it('meldet den Broadcast an, ueber den Samsung die Zahl annimmt', () => {
    const broadcast = intentsInQueries().filter((i) => i.aktionen.includes('android.intent.action.BADGE_COUNT_UPDATE'));
    expect(broadcast).toHaveLength(1);
  });

  it('meldet die Zahl-Anbieter von Samsung, Huawei und OPPO an', () => {
    expect(anbieterInQueries().sort()).toEqual(
      ['com.android.badge', 'com.huawei.android.launcher.settings', 'com.sec.badge'].sort(),
    );
  });

  it('fragt nicht nach allen Paketen (QUERY_ALL_PACKAGES braeuchte eine Begruendung im Play Store)', () => {
    const ohneKommentare = manifest.replace(/<!--[\s\S]*?-->/g, '');
    expect(ohneKommentare).toContain('<uses-permission');
    expect(ohneKommentare).not.toContain('android.permission.QUERY_ALL_PACKAGES');
  });
});
