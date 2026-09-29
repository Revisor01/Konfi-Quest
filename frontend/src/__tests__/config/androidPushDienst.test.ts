// Android: genau EIN Dienst empfängt Push-Nachrichten (29.09.2026).
//
// Nebenbefund vom 29.09.: @capacitor/push-notifications und
// @capacitor-firebase/messaging melden je einen FirebaseMessagingService mit
// der Aktion MESSAGING_EVENT an. Android stellt jede Nachricht nur einem
// Dienst zu (FCM: resolveService, bei gleicher Priorität der erste im
// gemergten Manifest; die Bibliotheken stehen dort in der Reihenfolge aus
// capacitor.build.gradle, das Firebase-Plugin vor dem Push-Plugin). Dann
// bekam der Dienst des Firebase-Plugins alles, und
// PushNotifications 'pushNotificationReceived' — in AppContext der Auslöser
// für push:received und das Neuladen der Zähler — feuerte auf Android nie;
// bei offener App erschien auch keine Mitteilung. Gemessen am gemergten
// Manifest ist das nicht (kein Android-SDK im Container); der Test sichert,
// dass es nicht darauf ankommt: Es bleibt genau ein Dienst.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import capacitorConfig from '../../../capacitor.config';

const FRONTEND = process.cwd();
const ANDROID_NS = 'http://schemas.android.com/apk/res/android';
const TOOLS_NS = 'http://schemas.android.com/tools';

const xml = (pfad: string) => new DOMParser().parseFromString(readFileSync(pfad, 'utf8'), 'application/xml');

/** Dienste mit MESSAGING_EVENT in einem Manifest. */
const fcmDienste = (doc: Document): string[] =>
  [...doc.getElementsByTagName('service')]
    .filter((s) => [...s.getElementsByTagName('action')].some(
      (a) => a.getAttributeNS(ANDROID_NS, 'name') === 'com.google.firebase.MESSAGING_EVENT'))
    .map((s) => s.getAttributeNS(ANDROID_NS, 'name')!);

const appManifest = xml(join(FRONTEND, 'android/app/src/main/AndroidManifest.xml'));

/** Was das App-Manifest per tools:node="remove" aus dem Merge nimmt. */
const entfernt = new Set(
  [...appManifest.getElementsByTagName('service')]
    .filter((s) => s.getAttributeNS(TOOLS_NS, 'node') === 'remove')
    .map((s) => s.getAttributeNS(ANDROID_NS, 'name')!),
);

/** FCM-Dienste aller nativ eingebundenen Plugins (includePlugins). */
const ausPlugins = (capacitorConfig.includePlugins ?? []).flatMap((paket) => {
  const pfad = join(FRONTEND, 'node_modules', paket, 'android/src/main/AndroidManifest.xml');
  return existsSync(pfad) ? fcmDienste(xml(pfad)).map((dienst) => ({ paket, dienst })) : [];
});

describe('Android: ein Empfänger für Push-Nachrichten', () => {
  it('das App-Manifest ist gültiges XML', () => {
    expect(appManifest.getElementsByTagName('parsererror').length).toBe(0);
    expect(appManifest.documentElement.lookupNamespaceURI('tools')).toBe(TOOLS_NS);
  });

  it('zwei Plugins bringen je einen FCM-Dienst mit (Suche greift)', () => {
    expect(ausPlugins).toEqual(expect.arrayContaining([
      { paket: '@capacitor/push-notifications', dienst: 'com.capacitorjs.plugins.pushnotifications.MessagingService' },
      { paket: '@capacitor-firebase/messaging', dienst: 'io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService' },
    ]));
  });

  it('nach dem Merge bleibt genau der Dienst des Push-Plugins', () => {
    const bleibt = [...ausPlugins.map((p) => p.dienst), ...fcmDienste(appManifest)].filter((d) => !entfernt.has(d));
    expect(bleibt).toEqual(['com.capacitorjs.plugins.pushnotifications.MessagingService']);
  });

  it('die App hört keine Ereignisse des Firebase-Plugins ab, die nur dessen Dienst liefert', () => {
    // notificationReceived / tokenReceived kämen auf Android ohne den Dienst
    // nie an. Gebraucht werden nur getToken() und deleteToken().
    const dateien: string[] = [];
    const lauf = (ordner: string) => {
      for (const e of readdirSync(ordner)) {
        const voll = join(ordner, e);
        if (statSync(voll).isDirectory()) { if (e !== '__tests__') lauf(voll); }
        else if (/\.tsx?$/.test(e) && !/\.test\./.test(e)) dateien.push(voll);
      }
    };
    lauf(join(FRONTEND, 'src'));
    const nutzer = dateien.filter((d) => /FirebaseMessaging\.addListener\(/.test(readFileSync(d, 'utf8')));
    expect(nutzer).toEqual([]);
    const appContext = readFileSync(join(FRONTEND, 'src/contexts/AppContext.tsx'), 'utf8');
    expect(appContext).toContain("PushNotifications.addListener('pushNotificationReceived'");
    expect(appContext).toContain('FirebaseMessaging.getToken()');
  });

  it('bei offener App zeigt das Push-Plugin die Mitteilung an (alert)', () => {
    const optionen = (capacitorConfig.plugins?.PushNotifications as { presentationOptions?: string[] })?.presentationOptions;
    expect(optionen).toContain('alert');
  });
});
