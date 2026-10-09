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
  (config.android?.includePlugins ?? config.includePlugins!).flatMap((plugin) => {
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

  const nachfuehren = zahl.slice(zahl.indexOf('static void mitteilungNachfuehren('), zahl.indexOf('static void beimOeffnen('));

  it('Weg "mitteilungen": die liegende Mitteilung bekommt die neue Zahl -- still', () => {
    // Samsung und Xiaomi rechnen die Zahl aus den liegenden Mitteilungen.
    // Sinkt die Zahl (gelesen, erledigt), traegt die eine liegende
    // Mitteilung (fester tag) die neue.
    const setzen = zahl.slice(zahl.indexOf('static void setzen('), zahl.indexOf('static void mitteilungNachfuehren('));
    expect(setzen).toMatch(/if \(WEG_MITTEILUNGEN\.equals\(weg\(app\)\)\) \{\s*mitteilungNachfuehren\(app, ganz\);/);
    expect(nachfuehren).toContain('MITTEILUNG_TAG.equals(liegend.getTag())');
    expect(nachfuehren).toContain('.setNumber(zahl)');
    expect(nachfuehren).toContain('.setOnlyAlertOnce(true)');
    expect(nachfuehren).toContain('verwalter.notify(MITTEILUNG_TAG, MITTEILUNG_ID, neu)');
  });

  it('Weg "mitteilungen": sinkt die Zahl auf 0, nimmt die App genau die eine Sammel-Mitteilung weg', () => {
    // Simon, 29.09.2026: "Ja, bei 0 wegräumen." Bis dahin blieb auf Samsung
    // und Xiaomi eine 1 am Symbol, solange die Sammel-Mitteilung lag -- der
    // Startbildschirm zaehlt eine liegende Mitteilung mit number 0 als 1.
    //
    // Weg kommt NUR sie: tag konfi_app_symbol und die ID, unter der das
    // FCM-SDK (und bei offener App das Push-Plugin) eine Mitteilung mit tag
    // ablegt. Nur, wenn sie eine Zahl trug (number > 0) -- eine Mitteilung,
    // die schon mit 0 kam (nichts offen, etwa eine Event-Erinnerung), ist
    // nicht "auf 0 gesunken" und bleibt, bis sie jemand antippt oder
    // wegwischt.
    expect(zahl).toContain('static final int MITTEILUNG_ID = 0;');
    // Der Filter steht VOR jeder Aenderung: fremde tags und IDs bleiben liegen.
    const filter = nachfuehren.indexOf('if (!MITTEILUNG_TAG.equals(liegend.getTag()) || liegend.getId() != MITTEILUNG_ID) continue;');
    // number == zahl (also auch 0 == 0) laesst sie stehen, bevor die 0 greift.
    const gleich = nachfuehren.indexOf('if (alt == null || alt.number == zahl) continue;');
    const beiNull = nachfuehren.search(/if \(zahl == 0\) \{\s*verwalter\.cancel\(MITTEILUNG_TAG, MITTEILUNG_ID\);\s*continue;\s*\}/);
    expect(filter).toBeGreaterThan(0);
    expect(gleich).toBeGreaterThan(filter);
    expect(beiNull).toBeGreaterThan(gleich);
    // Kein cancelAll: Alle anderen Mitteilungen raeumt die App weiter nicht
    // ab. Weggenommen wird an genau zwei Stellen, beide Male nur die eine
    // Sammel-Mitteilung: hier (auf 0 gesunken) und beim Oeffnen der App, wenn
    // sie schon mit 0 kam (beimOeffnen, 01.10.2026, Test unten).
    expect(zahl.match(/\.cancel\w*\(/g)).toEqual(['.cancel(', '.cancel(']);
    expect(zahl.match(/\.cancel\(MITTEILUNG_TAG, MITTEILUNG_ID\)/g)).toHaveLength(2);
    expect(nachfuehren.match(/\.cancel\(/g)).toHaveLength(1);
  });

  it('Weg "mitteilungen": beim Oeffnen geht die Sammel-Mitteilung, die mit 0 kam', () => {
    // Simon, 01.10.2026: "eine 0 muss doch weg oder nicht?" Eine Mitteilung,
    // die schon mit 0 kam (etwa eine Event-Erinnerung bei nichts Offenem),
    // zaehlt der Startbildschirm als 1. Sie geht beim Oeffnen der App --
    // vorher wuerde sie niemand sehen. Die Entscheidung (number 0 und
    // gemerkte Zahl 0) steht in AppSymbolNull und ist dort mit JUnit
    // geprueft (AppSymbolNullTest); hier nur, dass sie angewandt wird.
    const oeffnen = zahl.slice(zahl.indexOf('static void beimOeffnen('), zahl.indexOf('static void ausNachricht('));
    expect(oeffnen).toMatch(/if \(!WEG_MITTEILUNGEN\.equals\(weg\(app\)\)\) return;/);
    expect(oeffnen).toContain('if (!MITTEILUNG_TAG.equals(liegend.getTag()) || liegend.getId() != MITTEILUNG_ID) continue;');
    expect(oeffnen).toMatch(/if \(n != null && AppSymbolNull\.beimOeffnenWegnehmen\(n\.number, gemerkt\)\) \{\s*verwalter\.cancel\(MITTEILUNG_TAG, MITTEILUNG_ID\);/);
    // Gerufen in onResume -- beim Kaltstart und bei jeder Rueckkehr.
    const activity = javaDerApp('MainActivity');
    const resume = activity.slice(activity.indexOf('public void onResume()'));
    expect(resume).toContain('AppSymbolZahl.beimOeffnen(this);');
    // Die Regel selbst: nur 0 bei 0.
    const regel = javaDerApp('AppSymbolNull');
    expect(regel).toContain('return nummerDerMitteilung == 0 && gemerkteZahl <= 0;');
  });

  it('das Wegnehmen gibt es nur auf Weg "mitteilungen" -- nie bei "anbieter" oder "punkt"', () => {
    // mitteilungNachfuehren ist der einzige Ort mit cancel (oben) und wird
    // nur unter WEG_MITTEILUNGEN gerufen. iOS hat diese Klasse nicht.
    const aufrufe = [...zahl.matchAll(/mitteilungNachfuehren\(/g)].map((m) => m.index ?? 0);
    expect(aufrufe).toHaveLength(2); // Definition + ein Aufruf
    const aufruf = aufrufe.find((i) => !zahl.slice(i - 20, i).includes('static void'))!;
    expect(zahl.slice(aufruf - 60, aufruf)).toMatch(/if \(WEG_MITTEILUNGEN\.equals\(weg\(app\)\)\) \{\s*$/);
    // Die offene App kommt ueber das Plugin an dieselbe Stelle, ohne eigenes Wegnehmen.
    const plugin = javaDerApp('AppSymbolZahlPlugin');
    expect(plugin).toContain('AppSymbolZahl.setzen(getContext(), zahl);');
    expect(plugin).not.toMatch(/\.cancel\w*\(|NotificationManager/);
    expect(javaDerApp('KonfiMessagingService')).not.toMatch(/\.cancel\w*\(|NotificationManager/);
  });

  it('die ID der Sammel-Mitteilung ist die, unter der das Push-Plugin bei offener App ablegt', () => {
    // Bei offener App zeigt das Push-Plugin die Mitteilung selbst an -- mit
    // CommonNotificationBuilder.createNotificationInfo aus dem FCM-SDK, also
    // unter demselben (tag, id) wie das SDK bei geschlossener App. Dass das
    // SDK dort die ID 0 vergibt, steht im Bytecode von firebase-messaging
    // 25.0.1 (CommonNotificationBuilder: new DisplayNotificationInfo(builder,
    // getTag(params), 0); nachgesehen per javap am 29.09.2026) -- das AAR
    // liegt nicht im Repo, deshalb hier nur die Fassung und der Weg des Plugins.
    const plugin = lies('node_modules/@capacitor/push-notifications/android/src/main/java/com/capacitorjs/plugins/pushnotifications/PushNotificationsPlugin.java');
    expect(plugin).toContain('CommonNotificationBuilder.createNotificationInfo(');
    expect(plugin).toContain('notificationManager.notify(notificationInfo.tag, notificationInfo.id, notificationInfo.notificationBuilder.build());');
    expect(lies('android/variables.gradle')).toContain("firebaseMessagingVersion = '25.0.1'");
  });

  it('der tag der liegenden Mitteilung ist derselbe, den der Server schickt', () => {
    const server = lies('../backend/utils/appSymbolWeg.js');
    const tag = server.match(/const MITTEILUNG_TAG = '([^']+)';/)?.[1];
    expect(tag).toBe('konfi_app_symbol');
    expect(zahl).toContain(`static final String MITTEILUNG_TAG = "${tag}";`);
  });

  it('faengt Fehler beim Setzen ab, statt den Push-Dienst abstuerzen zu lassen', () => {
    const rumpf = zahl.slice(zahl.indexOf('static void ausNachricht'));
    expect(rumpf.slice(0, rumpf.indexOf('\n    }\n'))).toMatch(/catch \(Throwable/);
  });
});
