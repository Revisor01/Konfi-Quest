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

// ---------------------------------------------------------------------------
// Simons Befund 15.09.2026 (echtes Geraet, Build 194): "Aber er flickert kurz,
// wenn die App aus dem ganz aus Zustand kommt. Vermutlich weil er sonst die
// Grafik zeigt."
//
// Der Lebenszyklus steht in __tests__/hooks/useAppSperre.test.tsx. Hier steht
// die STRUKTURELLE Bedingung: dass App.tsx die Entscheidung VOR dem Rendern
// faellt und in der Wartezeit das Neutrale zeigt, nicht das Logo.
// ---------------------------------------------------------------------------
describe('Kaltstart: die Entscheidung faellt vor dem Rendern', () => {
  it('haelt den Inhalt zurueck, solange die Sperre unbekannt ist', () => {
    // Dieselbe Ordnung wie beim Seitenbaum daneben (useSeitenBereit): Die
    // Frage "warten oder rendern" wird beantwortet, BEVOR der Baum steht.
    // Stuende `startGeklaert` nicht in dieser Bedingung, rendert die App den
    // Inhalt, bevor sie weiss, ob sie gesperrt ist — genau das Aufblitzen.
    expect(app).toContain('if (!seitenBereit || !startGeklaert)');
  });

  it('zeigt in der Wartezeit den Ladebildschirm, nicht die Abdeckung', () => {
    // Die andere Fehlerrichtung: Die Sperre steht in der Voreinstellung auf
    // 'aus'. Wuerde in der Wartezeit die Abdeckung stehen, saehe diese
    // Mehrheit ein Logo aufblitzen, das gleich wieder verschwindet — ein
    // Aufblitzen gegen ein anderes getauscht.
    const zweig = app.slice(app.indexOf('if (!seitenBereit || !startGeklaert)'));
    const bis = zweig.slice(0, zweig.indexOf('</IonApp>'));
    expect(bis, 'Ladebildschirm fehlt im Wartezweig').toContain('<AppLaedt />');
  });

  it('holt startGeklaert aus dem Hook', () => {
    expect(app).toContain('startGeklaert');
    expect(hook).toContain('startGeklaert');
  });

  it('entscheidet den Startwert synchron an der Plattform, nicht in einem Effekt', () => {
    // Ein Effekt liefe erst NACH dem ersten Rendern — und genau dieses eine
    // Bild ist das Aufblitzen. Der Wert muss beim ersten Rendern schon stehen.
    // Und er haengt an der Plattform: Im Browser kann die Sperre nie greifen,
    // dort darf kein einziger Tick verloren gehen.
    expect(hook).toContain('useState(() => !Capacitor.isNativePlatform())');
  });

  it('gibt in JEDEM Ausgang wieder frei', () => {
    // Ohne `finally` haette ein werfendes Biometrie-Plugin die App dauerhaft
    // im Ladebildschirm festgehalten — ein Startproblem waere schlimmer als
    // das Flackern, das hier behoben wird.
    const start = hook.indexOf('setStartGeklaert(true)');
    expect(start, 'setStartGeklaert fehlt').toBeGreaterThan(-1);
    const davor = hook.slice(0, start);
    expect(davor.lastIndexOf('finally')).toBeGreaterThan(davor.lastIndexOf('catch'));
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
