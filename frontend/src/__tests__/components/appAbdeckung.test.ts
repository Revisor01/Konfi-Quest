import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const lies = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/**
 * Kommentare raus, BEVOR irgendetwas geprueft wird.
 *
 * Diese Dateien sind absichtlich dicht kommentiert — und genau daran waeren
 * diese Tests beinahe gescheitert: Ein Test, der "IonPage" oder "Rolle" im
 * erklaerenden Kommentar findet, schlaegt am Text an statt an der Regel und ist
 * damit wertlos (im Repo schon zweimal passiert). Geprueft wird deshalb
 * ausschliesslich der Code.
 */
const ohneKommentare = (q: string) =>
  q
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Zeilenkommentare NUR am Zeilenanfang (ggf. eingerueckt). Ein gieriges
    // /\/\/.*$/ frisst in JSX auch echten Code: In App.tsx steht
    // `<Route path="/*" …>` — nach dem Entfernen des Blockkommentars beginnt
    // die Zeile mit `//` und die ganze Zeile samt `</IonRouterOutlet>`
    // verschwand. Der Test meldete daraufhin ein offenes Outlet, das es im
    // Quelltext gar nicht gibt.
    .replace(/^\s*\/\/.*$/gm, '');

const abdeckung = ohneKommentare(lies('src/components/common/AppAbdeckung.tsx'));
const app = ohneKommentare(lies('src/App.tsx'));
const hook = ohneKommentare(lies('src/hooks/useAppSperre.ts'));
const mainActivity = ohneKommentare(
  lies('android/app/src/main/java/de/godsapp/konfiquest/MainActivity.java')
);

// ---------------------------------------------------------------------------
// Simons Befund 15.09.2026 (echtes Geraet): "Wenn die App per Biometrie
// gesperrt ist, wird sie im App-Switcher trotzdem MIT INHALT angezeigt."
//
// Der Lebenszyklus (wann kippt die Abdeckung?) steht in
// __tests__/hooks/useAppSperre.test.tsx. Hier stehen die STRUKTURELLEN
// Bedingungen, die sich zur Laufzeit nicht pruefen lassen: dass die Abdeckung
// keine IonPage ist, dass sie ausserhalb jedes Outlets haengt, und dass
// FLAG_SECURE an der Einstellung haengt statt dauerhaft zu stehen.
// ---------------------------------------------------------------------------

describe('Die Abdeckung wiederholt den weissen-Startbildschirm-Fehler nicht', () => {
  // Begruendung siehe navigation/useSeitenBereit.ts und
  // __tests__/navigation/keinTauschImOutlet.test.ts: Ein IonRouterOutlet
  // registriert die zuerst eingehaengte IonPage und bemerkt einen spaeteren
  // Austausch NICHT. Eine Abdeckung, die kommt und geht, waere genau so ein
  // Austausch — sie darf deshalb weder Seite sein noch in einem Outlet haengen.

  it('ist keine IonPage', () => {
    expect(abdeckung).not.toContain('IonPage');
  });

  it('haengt in keinem IonRouterOutlet', () => {
    expect(abdeckung).not.toContain('IonRouterOutlet');
  });

  it('wird in App.tsx ausserhalb des IonRouterOutlet gerendert', () => {
    // ROHER Quelltext, bewusst OHNE Kommentar-Entfernung: App.tsx enthaelt
    // `<Route path="/*" …>`, und das `*/` darin beendet einen davor
    // begonnenen Blockkommentar vorzeitig — dabei verschwand
    // `</IonRouterOutlet>` und der Test meldete ein offenes Outlet, das es im
    // Quelltext gar nicht gibt. Fuer diese Pruefung braucht es die Kommentare
    // ohnehin nicht: gesucht wird eine Zeile, die so nur als Code vorkommt.
    const quelle = lies('src/App.tsx');
    const zeilen = quelle.split('\n');

    const einbindungen = zeilen
      .map((z, i) => ({ z: z.trim(), nr: i }))
      .filter((e) => e.z === '{verdeckt && <AppAbdeckung />}');

    // App.tsx hat drei Ausstiege (Anmeldeseite, Ladezustand, angemeldete App).
    // In JEDEM muss die Abdeckung stehen — sonst bliebe genau dort Inhalt im
    // Umschalter lesbar.
    expect(einbindungen.length, 'Abdeckung fehlt in mindestens einem Ausstieg').toBe(3);

    // Die Abdeckung ist ein direktes Kind von <IonApp>: Die naechste
    // nicht-leere Zeile darunter schliesst die App, nicht ein Outlet. Stuende
    // sie im Outlet, stuende dort </IonRouterOutlet>.
    for (const { nr } of einbindungen) {
      const danach = zeilen
        .slice(nr + 1)
        .map((z) => z.trim())
        .filter((z) => z !== '');
      expect(danach[0], 'Abdeckung steht nicht direkt unter <IonApp>').toBe('</IonApp>');
    }
  });

  it('liegt ueber dem Sperrbildschirm, nicht darunter', () => {
    // Beim Wegwechseln kann beides gleichzeitig anstehen. Ins Vorschaubild
    // gehoert die neutrale Flaeche, nicht der bedienbare Sperrbildschirm.
    const quelle = app;
    const sperre = quelle.lastIndexOf('<AppSperrbildschirm');
    const decke = quelle.lastIndexOf('<AppAbdeckung');
    expect(sperre, 'Sperrbildschirm fehlt').toBeGreaterThan(-1);
    expect(decke, 'Abdeckung fehlt').toBeGreaterThan(-1);
    expect(decke).toBeGreaterThan(sperre);
  });
});

describe('Die Abdeckung verraet nichts', () => {
  it('zeigt keine Bedienelemente', () => {
    // Reiner Sichtschutz. Ein Knopf waere im Vorschaubild ohnehin nicht
    // antippbar und muesste dort trotzdem sinnvoll aussehen.
    expect(abdeckung).not.toContain('IonButton');
    expect(abdeckung).not.toContain('onClick');
  });

  it('nennt weder Namen noch Rolle noch Gemeinde', () => {
    // Dieses Bild sehen auch Unbefugte. Es darf nur sagen, welche App das ist.
    for (const verboten of ['user', 'name}', 'rolle', 'organization', 'punkte']) {
      expect(abdeckung.toLowerCase()).not.toContain(verboten);
    }
  });
});

describe('Die Abdeckung kippt beim Wegwechseln, nicht bei der Rueckkehr', () => {
  it('setzt verdeckt im isActive-false-Zweig', () => {
    // DIE eigentliche Regel dieses Befunds. Der Zweig fuer `!isActive` ist der
    // Moment der Momentaufnahme (@capacitor/app meldet ihn auf
    // willResignActiveNotification) — dort und nur dort darf das passieren.
    const quelle = hook;
    const start = quelle.indexOf('if (!isActive)');
    expect(start, 'Zweig fuer den Hintergrundwechsel fehlt').toBeGreaterThan(-1);
    // Bis zum `return` dieses Zweigs.
    const zweig = quelle.slice(start, quelle.indexOf('return;', start) + 7);
    expect(zweig).toContain('setVerdeckt(true)');
  });

  it('setzt verdeckt VOR der Ausflug-Pruefung', () => {
    // Der Ausflug-Merker regelt, ob spaeter GESPERRT wird — nicht, ob jetzt
    // verdeckt wird. Stuende setVerdeckt dahinter, bliebe die App waehrend
    // eines Systemdialogs im Umschalter lesbar.
    const quelle = hook;
    const start = quelle.indexOf('if (!isActive)');
    const setzen = quelle.indexOf('setVerdeckt(true)', start);
    const ausflug = quelle.indexOf('laeuftAusflug()', start);
    expect(setzen, 'setVerdeckt fehlt').toBeGreaterThan(-1);
    expect(ausflug, 'Ausflug-Pruefung fehlt').toBeGreaterThan(-1);
    expect(setzen).toBeLessThan(ausflug);
  });

  it('haengt an der Einstellung, nicht am Sperrzustand', () => {
    // An `gesperrt` gehaengt waere es genau der Fehler: `gesperrt` wird erst
    // beim Zurueckkommen berechnet.
    const quelle = hook;
    const start = quelle.indexOf('if (!isActive)');
    const zweig = quelle.slice(start, quelle.indexOf('return;', start) + 7);
    expect(zweig).toContain("verzoegerungRef.current !== 'aus'");
    expect(zweig).not.toContain('gesperrt');
  });
});

describe('Android: FLAG_SECURE nur bei eingeschalteter Sperre', () => {
  // Die Entscheidung: FLAG_SECURE verbietet JEDE Bildschirmaufnahme in der
  // ganzen App. Dauerhaft gesetzt wuerde es auch die grosse Mehrheit treffen,
  // die die Sperre gar nicht nutzt (Voreinstellung 'aus') — niemand koennte
  // mehr einen Termin oder QR-Code abfotografieren. Es haengt deshalb an
  // derselben Einstellung wie die Sperre.

  it('setzt das Flag', () => {
    expect(mainActivity).toContain('FLAG_SECURE');
    expect(mainActivity).toContain('setFlags');
  });

  it('entfernt das Flag wieder, wenn die Sperre aus ist', () => {
    // Ohne clearFlags bliebe das Flag nach einmaligem Einschalten fuer immer
    // stehen — die Sperre waere abschaltbar, die Einschraenkung nicht.
    expect(mainActivity).toContain('clearFlags');
  });

  it('liest denselben Schluessel wie das JavaScript', () => {
    // Laufen die beiden auseinander, ist das Flag still wirkungslos.
    expect(mainActivity).toContain('konfi_app_sperre_verzoegerung');
    expect(lies('src/services/appSperre.ts')).toContain(
      "'konfi_app_sperre_verzoegerung'"
    );
  });

  it('kennt genau die Sperrwerte aus dem JavaScript', () => {
    for (const wert of ['sofort', '1min', '5min', '15min']) {
      expect(mainActivity).toContain(`"${wert}"`);
    }
  });

  it('wertet bei jeder Rueckkehr neu aus', () => {
    // Nur in onCreate gelesen, bliebe eine im Profil geaenderte Einstellung
    // bis zum naechsten Kaltstart wirkungslos.
    expect(mainActivity).toContain('onResume');
  });
});
