// App Links (Android): Manifest und assetlinks.json muessen zusammenpassen --
// und zum Code. Drei Dinge gehen hier still schief, ohne dass es ein Test am
// Verhalten bemerken koennte:
//
// 1. Ein Platzhalter statt des Fingerabdrucks in der assetlinks.json: Android
//    prueft beim Installieren, findet keinen passenden Schluessel und fragt
//    bei jedem Link "Oeffnen mit?". Genau so lag die Datei bis zum 24.09.2026
//    auf konfi-quest.de -- mit "PASTE_YOUR_SHA256_FINGERPRINT_HERE".
// 2. Manifest und utils/deepLinks.ts laufen auseinander: Android liefert
//    einen Pfad, den der Code verwirft (oder umgekehrt) -- die App oeffnet
//    sich und bleibt auf der alten Seite stehen.
// 3. Ein Host ohne pruefbare assetlinks.json (www leitet per 301 um) liesse
//    vor Android 12 die Pruefung ALLER Hosts scheitern.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { APP_LINK_HOSTS, APP_LINK_PFADE } from '../../utils/deepLinks';

const manifest = readFileSync(join(process.cwd(), 'android/app/src/main/AndroidManifest.xml'), 'utf8');
const gradle = readFileSync(join(process.cwd(), 'android/app/build.gradle'), 'utf8');
const assetlinksText = readFileSync(join(process.cwd(), 'public/.well-known/assetlinks.json'), 'utf8');

/** Alle <intent-filter>-Bloecke des Manifests, ohne XML-Kommentare. */
const intentFilter = (): string[] => {
  const ohneKommentare = manifest.replace(/<!--[\s\S]*?-->/g, '');
  return [...ohneKommentare.matchAll(/<intent-filter\b[\s\S]*?<\/intent-filter>/g)].map((m) => m[0]);
};

const attribute = (block: string, element: string, attribut: string): string[] =>
  [...block.matchAll(new RegExp(`<${element}\\b[^>]*android:${attribut}="([^"]*)"`, 'g'))].map((m) => m[1]);

describe('AndroidManifest: wohlgeformtes XML', () => {
  it('kein "--" in einem Kommentar (XML verbietet das; Gradle bricht dann beim Manifest-Merge ab)', () => {
    // Gemessen am 24.09.2026: Zwei Gedankenstriche als "--" im Kommentar,
    // xmllint Exit 1 ("Double hyphen within comment"), assembleRelease
    // scheiterte in processReleaseMainManifest. Der Test erwischt das, bevor
    // ein Store-Build daran haengt.
    const kommentare = [...manifest.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1]);
    expect(kommentare.length).toBeGreaterThan(0);
    for (const k of kommentare) {
      expect(k, k.slice(0, 60)).not.toContain('--');
    }
  });

  it('laesst sich als XML lesen', () => {
    const dom = new DOMParser().parseFromString(manifest, 'application/xml');
    expect(dom.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(dom.documentElement.tagName).toBe('manifest');
  });
});

describe('AndroidManifest: Intent-Filter fuer App Links', () => {
  const appLinks = intentFilter().filter((b) => /android:autoVerify="true"/.test(b));

  it('genau ein Filter mit autoVerify -- sonst fragt Android "Oeffnen mit?"', () => {
    expect(appLinks).toHaveLength(1);
  });

  it('VIEW mit DEFAULT und BROWSABLE, wie die Android-Doku es verlangt', () => {
    const [block] = appLinks;
    expect(attribute(block, 'action', 'name')).toEqual(['android.intent.action.VIEW']);
    expect(attribute(block, 'category', 'name').sort()).toEqual([
      'android.intent.category.BROWSABLE',
      'android.intent.category.DEFAULT',
    ]);
  });

  it('nur https -- http waere unverschluesselt und von Android ohnehin nicht pruefbar', () => {
    expect(attribute(appLinks[0], 'data', 'scheme')).toEqual(['https']);
  });

  it('die Hosts sind genau die aus dem Code', () => {
    expect(attribute(appLinks[0], 'data', 'host').sort()).toEqual([...APP_LINK_HOSTS].sort());
  });

  it('kein www: dessen assetlinks.json kommt nur per Umleitung', () => {
    expect(attribute(appLinks[0], 'data', 'host')).not.toContain('www.konfi-quest.de');
  });

  it('die Pfade sind genau die aus dem Code -- keiner mehr, keiner weniger', () => {
    expect(attribute(appLinks[0], 'data', 'pathPrefix').sort()).toEqual([...APP_LINK_PFADE].sort());
    // Kein anderer Pfad-Typ, der die Liste still erweitern koennte.
    expect(attribute(appLinks[0], 'data', 'path')).toEqual([]);
    expect(attribute(appLinks[0], 'data', 'pathPattern')).toEqual([]);
  });

  it('der Filter haengt an der MainActivity, die exportiert ist', () => {
    const activity = manifest.match(/<activity\b[\s\S]*?<\/activity>/)?.[0] ?? '';
    expect(activity).toContain('android:name=".MainActivity"');
    expect(activity).toContain('android:exported="true"');
    expect(activity).toContain('android:autoVerify="true"');
  });

  it('der Start-Filter bleibt unangetastet', () => {
    const start = intentFilter().filter((b) => b.includes('android.intent.action.MAIN'));
    expect(start).toHaveLength(1);
    expect(start[0]).toContain('android.intent.category.LAUNCHER');
    expect(start[0]).not.toContain('autoVerify');
  });
});

describe('assetlinks.json: Digital Asset Links fuer konfi-quest.de', () => {
  const assetlinks = JSON.parse(assetlinksText) as Array<{
    relation: string[];
    target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] };
  }>;

  it('ist eine Liste mit genau einem Eintrag fuer die Android-App', () => {
    expect(Array.isArray(assetlinks)).toBe(true);
    expect(assetlinks).toHaveLength(1);
    expect(assetlinks[0].relation).toEqual(['delegate_permission/common.handle_all_urls']);
    expect(assetlinks[0].target.namespace).toBe('android_app');
  });

  it('nennt das Paket aus build.gradle', () => {
    const applicationId = gradle.match(/applicationId\s+"([^"]+)"/)?.[1];
    expect(applicationId).toBe('de.godsapp.konfiquest');
    expect(assetlinks[0].target.package_name).toBe(applicationId);
  });

  it('kein Platzhalter mehr', () => {
    expect(assetlinksText).not.toContain('PASTE_YOUR');
    expect(assetlinksText).not.toMatch(/_HERE"/);
  });

  it('jeder Fingerabdruck ist SHA-256, gross geschrieben, mit Doppelpunkten', () => {
    const abdruecke = assetlinks[0].target.sha256_cert_fingerprints;
    expect(abdruecke.length).toBeGreaterThanOrEqual(1);
    for (const a of abdruecke) {
      expect(a, a).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    }
    expect(new Set(abdruecke).size).toBe(abdruecke.length);
  });

  it('enthaelt den Schluessel, mit dem Google die Store-Fassung signiert', () => {
    // Gemessen am 24.09.2026: Play-Developer-API generatedApks fuer
    // versionCode 113 (2.2.0, Produktion) heruntergeladen und mit apksigner
    // geprueft -- Signer "CN=Android, O=Google Inc.", also der von Google
    // verwaltete App-Signaturschluessel. Der Upload-Schluessel allein reichte
    // NICHT: Was aus dem Store kommt, traegt nicht seine Signatur.
    expect(assetlinks[0].target.sha256_cert_fingerprints).toContain(
      'F5:A2:14:F9:54:5F:5B:08:A9:7E:F0:02:53:DB:69:D5:DD:EC:AF:E4:B4:8B:9E:8C:3F:11:8C:9A:AB:99:A0:30'
    );
  });
});
