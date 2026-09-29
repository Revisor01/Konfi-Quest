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
//    Launcher nicht und nimmt den DefaultBadger, dessen Broadcast niemand
//    hoert; applyCount meldet nur false, Badge.set() tut sichtbar nichts.
//    (Hier stand, initBadger werfe bei leerer Liste -- das trifft auf
//    ShortcutBadger 1.1.22 nicht zu, nachgesehen im Quelltext des AAR,
//    29.09.2026.)
//
// SONY (29.09.2026, Simon am Xperia 1 VI: "nur ein kleiner blauer Kreis").
// SonyHomeBadger prueft mit resolveContentProvider, ob es Sonys Zahl-Anbieter
// com.sonymobile.home.resourceprovider gibt, und nimmt sonst den alten
// Broadcast com.sonyericsson.home.action.UPDATE_BADGE. Auch dieser Anbieter
// ist fuer die App nur sichtbar, wenn er unter <queries> steht.
//
// Die Liste unten ist gegen den Quelltext von ShortcutBadger 1.1.22
// abgeglichen (29.09.2026). Weggelassen sind nur Wege zu Startbildschirmen,
// die es nicht mehr gibt: HTC, Apex, ADW, Nova ueber TeslaUnread,
// EverythingMe.
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

  it('meldet auch die Oreo-Fassung des Broadcasts an, die ShortcutBadger zuerst sucht', () => {
    // BroadcastHelper.sendDefaultIntentExplicitly: ab Android 8 zuerst
    // me.leolin.shortcutbadger.BADGE_COUNT_UPDATE, dann der alte Name.
    // Beide werden per queryBroadcastReceivers gesucht.
    const broadcast = intentsInQueries().filter((i) => i.aktionen.includes('me.leolin.shortcutbadger.BADGE_COUNT_UPDATE'));
    expect(broadcast).toHaveLength(1);
  });

  it('meldet die Zahl-Anbieter von Sony, Samsung, Huawei, OPPO/ZUK und ZTE an', () => {
    // Abgeglichen mit ShortcutBadger 1.1.22: SonyHomeBadger
    // (resolveContentProvider), SamsungHomeBadger (content://com.sec.badge),
    // HuaweiHomeBadger (call auf com.huawei.android.launcher.settings),
    // OPPOHomeBader und ZukHomeBadger (com.android.badge), ZTEHomeBadger
    // (com.android.launcher3.cornermark.unreadbadge).
    expect(anbieterInQueries().sort()).toEqual([
      'com.android.badge',
      'com.android.launcher3.cornermark.unreadbadge',
      'com.huawei.android.launcher.settings',
      'com.sec.badge',
      'com.sonymobile.home.resourceprovider',
    ]);
  });

  it('laesst ShortcutBadger im Release-Bau ganz (R8 entfernte sonst Samsung und Huawei)', () => {
    // Gemessen am 29.09.2026 (usage.txt des Release-Baus): Ohne diese Regel
    // entfernte R8 die Konstruktoren von SamsungHomeBadger und
    // HuaweiHomeBadger, weil ShortcutBadger sie nur per Class.newInstance
    // anlegt. Auf Huawei kam die Zahl im Store-Bau nie an; Samsung behielt
    // nur den allgemeinen Broadcast.
    const regeln = readFileSync(join(process.cwd(), 'android/app/proguard-rules.pro'), 'utf8')
      .split('\n')
      .filter((z) => !z.trim().startsWith('#'));
    expect(regeln).toContain('-keep class me.leolin.shortcutbadger.** { *; }');
  });

  it('fragt nicht nach allen Paketen (QUERY_ALL_PACKAGES braeuchte eine Begruendung im Play Store)', () => {
    // Aus dem geparsten Manifest gelesen, nicht per Textsuche: Kommentare
    // sind dort keine Elemente, eine Erwaehnung im Kommentar zaehlt nicht.
    const dom = new DOMParser().parseFromString(manifest, 'application/xml');
    const rechte = [...dom.getElementsByTagName('uses-permission')]
      .map((e) => e.getAttributeNS(ANDROID_NS, 'name') ?? '');
    expect(rechte).toContain('android.permission.INTERNET');
    expect(rechte).not.toContain('android.permission.QUERY_ALL_PACKAGES');
  });
});
