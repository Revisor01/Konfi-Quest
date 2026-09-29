// Universal Links (iOS): apple-app-site-association muss zur App passen --
// und zu den Android-App-Links (29.09.2026, Audit CI BF-02).
//
// Bis dahin lag die Datei mit dem woertlichen Platzhalter "TEAMID"
// oeffentlich auf konfi-quest.de, als application/octet-stream, mit einer
// Pfadliste (/konfi/*, /admin/*), die keine Seite der App oeffnen kann. Kein
// iPhone hat sie je gelesen, weil der App das Entitlement fehlt -- sie
// behauptete aber etwas Falsches. Jetzt steht darin, was stimmt: Team- und
// Bundle-ID aus dem Xcode-Projekt, dieselben Pfade wie bei Android. Das
// Entitlement (applinks:konfi-quest.de) ist Simons Entscheidung; sobald es
// eingetragen ist, gilt der letzte Test unten.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { APP_LINK_HOSTS, APP_LINK_PFADE } from '../../utils/deepLinks';

const aasaText = readFileSync(join(process.cwd(), 'public/.well-known/apple-app-site-association'), 'utf8');
const pbxproj = readFileSync(join(process.cwd(), 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
const entitlements = readFileSync(join(process.cwd(), 'ios/App/App/App.entitlements'), 'utf8');
const nginx = readFileSync(join(process.cwd(), 'nginx.conf'), 'utf8');

/** Alle Werte einer Build-Einstellung im Projekt (Debug und Release). */
const einstellung = (name: string): string[] =>
  [...new Set([...pbxproj.matchAll(new RegExp(`\\b${name} = ([^;]+);`, 'g'))].map((m) => m[1].trim()))];

type Aasa = {
  applinks: { details: Array<{ appIDs: string[]; components: Array<Record<string, string>> }> };
  webcredentials?: { apps: string[] };
};

describe('apple-app-site-association', () => {
  const aasa = JSON.parse(aasaText) as Aasa;
  const [team] = einstellung('DEVELOPMENT_TEAM');
  const [bundle] = einstellung('PRODUCT_BUNDLE_IDENTIFIER');
  const appId = `${team}.${bundle}`;

  it('Team- und Bundle-ID sind im Projekt eindeutig', () => {
    expect(einstellung('DEVELOPMENT_TEAM')).toEqual(['J459G9CJT5']);
    expect(einstellung('PRODUCT_BUNDLE_IDENTIFIER')).toEqual(['de.godsapp.konfiquest']);
  });

  it('kein Platzhalter mehr', () => {
    expect(aasaText).not.toContain('TEAMID');
  });

  it('genau ein Eintrag, und der nennt genau die App aus dem Projekt', () => {
    expect(aasa.applinks.details).toHaveLength(1);
    expect(aasa.applinks.details[0].appIDs).toEqual([appId]);
  });

  it('die Pfade sind die aus dem Code (wie bei Android) -- keiner mehr, keiner weniger', () => {
    const komponenten = aasa.applinks.details[0].components;
    // Nur Pfad-Regeln, kein Ausschluss, keine Abfrage-Bedingung: Der
    // Einladungscode steckt in ?code=, der Reset-Token in ?token=.
    for (const k of komponenten) expect(Object.keys(k)).toEqual(['/']);
    expect(komponenten.map((k) => k['/']).sort()).toEqual(APP_LINK_PFADE.map((p) => `${p}*`).sort());
  });

  it('Passwort-Zuordnung nennt dieselbe App', () => {
    expect(aasa.webcredentials?.apps).toEqual([appId]);
  });

  it('nginx liefert die Datei als JSON aus, ohne Umleitung', () => {
    const block = nginx.match(/location = \/\.well-known\/apple-app-site-association \{[^}]*\}/)?.[0] ?? '';
    expect(block).toContain('default_type application/json;');
    expect(block).not.toMatch(/\breturn\b|\brewrite\b/);
  });

  it('traegt die App Associated Domains, dann fuer genau die Hosts aus dem Code', () => {
    // Heute (29.09.2026) ohne Eintrag -- dann prueft dieser Test nichts.
    // Sobald Simon applinks: eintraegt, muss er zu APP_LINK_HOSTS passen.
    if (!entitlements.includes('com.apple.developer.associated-domains')) return;
    const eintraege = [...entitlements.matchAll(/<string>applinks:([^<]+)<\/string>/g)].map((m) => m[1]);
    expect(eintraege.sort()).toEqual([...APP_LINK_HOSTS].sort());
  });
});
