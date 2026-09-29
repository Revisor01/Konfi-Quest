// Push-Empfang auf Android: genau EIN Dienst, und der setzt die Zahl am
// App-Symbol auch bei geschlossener App (29.09.2026).
//
// Simon am Sony Xperia 1 VI (Testbuild 128): "App Symbol mit Zahl ist bei mir
// leider nur ein kleiner blauer Kreis [...]" -- "Ich will Android exakt
// gleich wie iOS."
//
// Auf dem iPhone setzt aps.badge die Zahl in jedem Push. Auf Android muss die
// App sie selbst setzen; bei geschlossener App kann das nur ein
// Messaging-Dienst, den FCM mit einem reinen Datenpaket (badge_update) weckt.
// Das ist KonfiMessagingService. Er ist vom Dienst des Push-Plugins
// abgeleitet, damit Token, Empfang und Antippen fuer AppContext bleiben, wie
// sie waren.
//
// Vorher meldeten zwei Plugins je einen Dienst fuer MESSAGING_EVENT an
// (@capacitor/push-notifications und @capacitor-firebase/messaging). FCM
// stellt jede Nachricht nur EINEM zu (resolveService; bei gleicher Prioritaet
// der erste im gemergten Manifest). Gemessen am gemergten Manifest des
// Debug-Baus vom 29.09.2026: Der Dienst von @capacitor-firebase/messaging
// stand vor dem des Push-Plugins -- er bekam alles, und
// 'pushNotificationReceived' feuerte auf Android nie.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import config from '../../../capacitor.config';

const ANDROID_NS = 'http://schemas.android.com/apk/res/android';
const TOOLS_NS = 'http://schemas.android.com/tools';
const MESSAGING_EVENT = 'com.google.firebase.MESSAGING_EVENT';
const PAKET = 'de.godsapp.konfiquest';

const lies = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8');
const javaDerApp = (klasse: string) => lies(`android/app/src/main/java/de/godsapp/konfiquest/${klasse}.java`);

const parse = (xml: string) => {
  const dom = new DOMParser().parseFromString(xml, 'application/xml');
  expect(dom.getElementsByTagName('parsererror')).toHaveLength(0);
  return dom;
};

const appManifest = parse(lies('android/app/src/main/AndroidManifest.xml'));

/** Voller Klassenname, wie der Manifest-Merger ihn bildet (".X" -> Paket.X). */
const vollerName = (name: string) => (name.startsWith('.') ? PAKET + name : name);

const nimmtPushEntgegen = (dienst: Element) =>
  [...dienst.getElementsByTagName('action')].some((a) => a.getAttributeNS(ANDROID_NS, 'name') === MESSAGING_EVENT);

const dienste = (dom: Document) => [...dom.getElementsByTagName('service')];
const istEntfernt = (dienst: Element) => dienst.getAttributeNS(TOOLS_NS, 'node') === 'remove';

/** Alle Push-Dienste, die die eingebundenen Plugins mitbringen. */
const pushDiensteDerPlugins = (): string[] =>
  config.includePlugins!.flatMap((plugin) => {
    const pfad = join(process.cwd(), 'node_modules', plugin, 'android/src/main/AndroidManifest.xml');
    if (!existsSync(pfad)) return [];
    return dienste(parse(readFileSync(pfad, 'utf8')))
      .filter(nimmtPushEntgegen)
      .map((d) => d.getAttributeNS(ANDROID_NS, 'name') ?? '');
  });

describe('Push-Empfang auf Android: genau ein Dienst', () => {
  it('die Plugins bringen die beiden bekannten Dienste mit (sonst hier nachsehen)', () => {
    // Stellt ein Plugin seinen Dienst um oder kommt eines dazu, faellt das
    // hier zuerst auf -- und nicht erst, wenn am Geraet keine Zahl mehr kommt.
    expect(pushDiensteDerPlugins().sort()).toEqual([
      'com.capacitorjs.plugins.pushnotifications.MessagingService',
      'io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService',
    ]);
  });

  it('das App-Manifest meldet jeden Push-Dienst der Plugins ab', () => {
    const entfernt = dienste(appManifest)
      .filter(istEntfernt)
      .map((d) => d.getAttributeNS(ANDROID_NS, 'name'));
    for (const dienst of pushDiensteDerPlugins()) {
      expect(entfernt).toContain(dienst);
    }
  });

  it('nach dem Mergen bleibt genau ein Empfaenger: KonfiMessagingService', () => {
    const entfernt = new Set(dienste(appManifest).filter(istEntfernt).map((d) => d.getAttributeNS(ANDROID_NS, 'name')));
    const ausDerApp = dienste(appManifest)
      .filter((d) => !istEntfernt(d) && nimmtPushEntgegen(d))
      .map((d) => vollerName(d.getAttributeNS(ANDROID_NS, 'name') ?? ''));
    const ausPlugins = pushDiensteDerPlugins().filter((d) => !entfernt.has(d));

    expect([...ausDerApp, ...ausPlugins]).toEqual([`${PAKET}.KonfiMessagingService`]);
  });

  it('der Dienst ist nicht fuer fremde Apps geoeffnet', () => {
    const [eigener] = dienste(appManifest).filter((d) => !istEntfernt(d) && nimmtPushEntgegen(d));
    expect(eigener.getAttributeNS(ANDROID_NS, 'exported')).toBe('false');
  });

  it('die Klasse liegt da, wo das Manifest sie sucht', () => {
    expect(existsSync(join(process.cwd(), 'android/app/src/main/java/de/godsapp/konfiquest/KonfiMessagingService.java'))).toBe(true);
  });
});

describe('Push-Empfang auf Android: Token, Empfang und Antippen bleiben beim Push-Plugin', () => {
  const dienst = javaDerApp('KonfiMessagingService');

  it('ist vom Dienst des Push-Plugins abgeleitet', () => {
    expect(dienst).toMatch(/import com\.capacitorjs\.plugins\.pushnotifications\.MessagingService;/);
    expect(dienst).toMatch(/public class KonfiMessagingService extends MessagingService\b/);
  });

  it('setzt erst die Zahl und reicht die Nachricht dann unveraendert weiter', () => {
    const rumpf = dienst.slice(dienst.indexOf('onMessageReceived'));
    const zahl = rumpf.indexOf('AppSymbolZahl.ausNachricht(this, nachricht.getData())');
    const weiter = rumpf.indexOf('super.onMessageReceived(nachricht)');
    expect(zahl).toBeGreaterThan(0);
    expect(weiter).toBeGreaterThan(zahl);
  });

  it('ueberschreibt onNewToken nicht -- der neue Token geht wie bisher an das Plugin', () => {
    expect(dienst).not.toMatch(/void onNewToken\s*\(/);
    // ... und dort kommt er an: Der geerbte Dienst meldet ihn als
    // 'registration' (AppContext haengt daran).
    const plugin = readFileSync(join(process.cwd(),
      'node_modules/@capacitor/push-notifications/android/src/main/java/com/capacitorjs/plugins/pushnotifications/MessagingService.java'), 'utf8');
    expect(plugin).toMatch(/public class MessagingService extends FirebaseMessagingService/);
    expect(plugin).toMatch(/PushNotificationsPlugin\.onNewToken\(s\)/);
    expect(plugin).toMatch(/PushNotificationsPlugin\.sendRemoteMessage\(remoteMessage\)/);
  });

  it('die App kann gegen RemoteMessage bauen (Firebase Messaging in der App, gleiche Fassung wie die Plugins)', () => {
    const variablen = lies('android/variables.gradle');
    const bau = lies('android/app/build.gradle');
    const plugin = lies('node_modules/@capacitor/push-notifications/android/build.gradle');
    const fassung = variablen.match(/firebaseMessagingVersion = '([^']+)'/)?.[1];
    const voreinstellung = plugin.match(/rootProject\.ext\.firebaseMessagingVersion : '([^']+)'/)?.[1];
    expect(fassung).toBe(voreinstellung);
    expect(bau).toContain('implementation "com.google.firebase:firebase-messaging:$firebaseMessagingVersion"');
  });
});

describe('Zahl am App-Symbol: eine Stelle fuer offene und geschlossene App', () => {
  const zahl = javaDerApp('AppSymbolZahl');

  it('MainActivity meldet das Plugin an, bevor die Bruecke entsteht', () => {
    const activity = javaDerApp('MainActivity');
    const anmelden = activity.indexOf('registerPlugin(AppSymbolZahlPlugin.class)');
    const bruecke = activity.indexOf('super.onCreate(savedInstanceState)');
    expect(anmelden).toBeGreaterThan(0);
    expect(bruecke).toBeGreaterThan(anmelden);
  });

  it('das Plugin heisst so, wie die App es ruft', () => {
    expect(javaDerApp('AppSymbolZahlPlugin')).toContain('@CapacitorPlugin(name = "AppSymbolZahl")');
    expect(lies('src/services/appSymbolZahl.ts')).toContain("registerPlugin<AppSymbolZahlPlugin>('AppSymbolZahl')");
  });

  it('liest das stille Paket so, wie der Server es schickt', () => {
    const firebase = lies('../backend/push/firebase.js');
    expect(firebase).toContain("data: { type: 'badge_update', count: badgeCount.toString() }");
    expect(zahl).toContain('static final String ART_ZAHL = "badge_update";');
    expect(zahl).toContain('daten.get("type")');
    expect(zahl).toContain('daten.get("count")');
  });

  it('kennt dieselben Wege wie Server und App', () => {
    const server = lies('../backend/utils/appSymbolWeg.js');
    const app = lies('src/services/appSymbolZahl.ts');
    for (const [konstante, wert] of [['WEG_ANBIETER', 'anbieter'], ['WEG_MITTEILUNGEN', 'mitteilungen'], ['WEG_PUNKT', 'punkt']]) {
      expect(zahl).toContain(`static final String ${konstante} = "${wert}";`);
      expect(server).toContain(`'${wert}'`);
      expect(app).toContain(`'${wert}'`);
    }
  });

  it('schreibt die Zahl dorthin, woher das Badge-Plugin sie beim Start wiederherstellt', () => {
    const badge = lies('node_modules/@capawesome/capacitor-badge/android/src/main/java/io/capawesome/capacitorjs/plugins/badge/Badge.java');
    const schluessel = badge.match(/STORAGE_KEY = "([^"]+)"/)?.[1];
    expect(schluessel).toBe('capacitor.badge');
    // Badge.getPrefs: getSharedPreferences(STORAGE_KEY), darin getInt(STORAGE_KEY)
    expect(badge).toContain('getSharedPreferences(STORAGE_KEY, Context.MODE_PRIVATE)');
    expect(badge).toContain('getInt(STORAGE_KEY, 0)');
    expect(zahl).toContain(`static final String BADGE_TOPF = "${schluessel}";`);
    expect(zahl).toContain(`static final String BADGE_SCHLUESSEL = "${schluessel}";`);
  });

  it('spricht Sonys Zahl-Anbieter an, den das Manifest sichtbar macht und fuer den es die Berechtigung hat', () => {
    expect(zahl).toContain('static final String SONY_ANBIETER = "com.sonymobile.home.resourceprovider";');
    const anbieter = [...appManifest.getElementsByTagName('queries')]
      .flatMap((q) => [...q.getElementsByTagName('provider')])
      .map((p) => p.getAttributeNS(ANDROID_NS, 'authorities'));
    expect(anbieter).toContain('com.sonymobile.home.resourceprovider');
    const rechte = [...appManifest.getElementsByTagName('uses-permission')].map((e) => e.getAttributeNS(ANDROID_NS, 'name'));
    expect(rechte).toContain('com.sonymobile.home.permission.PROVIDER_INSERT_BADGE');
  });

  it('nimmt ShortcutBadger in derselben Fassung wie das Badge-Plugin', () => {
    const variablen = lies('android/variables.gradle');
    const bau = lies('android/app/build.gradle');
    const plugin = lies('node_modules/@capawesome/capacitor-badge/android/build.gradle');
    const fassung = variablen.match(/shortcutBadgerVersion = '([^']+)'/)?.[1];
    const voreinstellung = plugin.match(/rootProject\.ext\.shortcutBadgerVersion : '([^']+)'/)?.[1];
    expect(fassung).toBe('1.1.22');
    expect(fassung).toBe(voreinstellung);
    expect(bau).toContain('implementation "me.leolin:ShortcutBadger:$shortcutBadgerVersion@aar"');
  });

  it('faengt Fehler beim Setzen ab, statt den Push-Dienst abstuerzen zu lassen', () => {
    const rumpf = zahl.slice(zahl.indexOf('static void ausNachricht'));
    expect(rumpf.slice(0, rumpf.indexOf('\n    }\n'))).toMatch(/catch \(Throwable/);
  });
});
