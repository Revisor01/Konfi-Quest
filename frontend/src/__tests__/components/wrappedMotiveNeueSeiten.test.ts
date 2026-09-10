import { verteileMotive, KACHEL_MOTIV, MOTIV_DATEI } from '../../components/wrapped/hintergrundbilder';

/**
 * Jede Rueckblick-Seite bekommt ein Motiv — auch die, die spaeter dazukamen.
 *
 * Simons Regel (03.09.2026): "Es duerfen niemals zweimal die gleichen Bilder
 * im bg sein bei einem Konfi." `verteileMotive` loest das dynamisch: Jede
 * Seite bekommt ihr Wunschmotiv, ist es vergeben, ein anderes aus derselben
 * Stimmung (ruhig / weite / feier).
 *
 * WARUM DIESER TEST: Eine neue Seite ohne Eintrag in KACHEL_MOTIV rendert
 * nackt — ohne Fehler und ohne dass es jemandem auffaellt. Genau diese Art
 * stiller Luecke steht als Warnung schon im Kopf von hintergrundbilder.ts.
 * Am 09.09.2026 kamen vier Seiten dazu (Zuspruch, Zuspruch-Abschluss,
 * eigene Challenge-Beitraege, gestellte Challenges).
 */
describe('Jede Rueckblick-Seite bekommt ein Motiv', () => {
  const NEUE_SEITEN = [
    'teamer-segen',
    'teamer-segen-abschluss',
    'teamer-challenge-beitraege',
    'teamer-challenges',
  ];

  it.each(NEUE_SEITEN)('%s hat ein Wunschmotiv hinterlegt', (kachel) => {
    expect(KACHEL_MOTIV[kachel]).toBeDefined();
    // Bindestrich erlaubt: Seit dem 09.09.2026 heissen Motive z. B.
    // 'konfetti-buehne' oder 'watt-abend'. Geprueft wird weiterhin, dass der
    // Pfad auf ein ausgeliefertes WebP unter /assets/wrapped/ zeigt.
    expect(MOTIV_DATEI[KACHEL_MOTIV[kachel]!]).toMatch(/^\/assets\/wrapped\/[\w-]+\.webp$/);
  });

  it('ein voller Teamer-Rueckblick bekommt lauter verschiedene Bilder', () => {
    const seiten = [
      'teamer-intro', 'teamer-anfang', 'teamer-events', 'teamer-konfis',
      'teamer-badges', 'teamer-zertifikate',
      'teamer-challenge-beitraege', 'teamer-challenges', 'teamer-abschluss',
    ];
    const vergeben = verteileMotive(seiten);

    const bilder = seiten.map((s) => vergeben[s]?.haupt);
    // Keine Seite ohne Bild.
    expect(bilder.filter(Boolean)).toHaveLength(seiten.length);
    // Und keins doppelt — Simons Regel.
    expect(new Set(bilder).size).toBe(seiten.length);
  });

  it('der Zuspruch bekommt Bilder, obwohl er nur drei Seiten hat', () => {
    const seiten = ['teamer-intro', 'teamer-segen', 'teamer-segen-abschluss'];
    const vergeben = verteileMotive(seiten);

    for (const s of seiten) {
      expect(vergeben[s]?.haupt, `${s} ohne Bild`).toMatch(/\.webp$/);
    }
    expect(new Set(seiten.map((s) => vergeben[s].haupt)).size).toBe(3);
  });

  it('auch bei mehr Seiten als Motiven bleibt keine ohne Bild', () => {
    // Ab 18 Seiten sind die 17 Motive verbraucht; dann faengt die Verteilung
    // von vorn an. Wichtig ist nur, dass keine Seite leer ausgeht.
    const viele = Array.from({ length: 25 }, (_, i) => `probe-${i}`);
    const vergeben = verteileMotive(viele);
    for (const s of viele) {
      expect(vergeben[s]?.haupt).toMatch(/\.webp$/);
    }
  });

  it('Stavanger behaelt seinen Felsen, auch wenn die Motive knapp werden', () => {
    // BEFUND 09.09.2026: `preikestolen` stand in der STIMMUNG.weite-Liste
    // und konnte damit als ERSATZ an eine fruehere Seite fallen. Das Bild
    // IST die Aussage seiner Seite ("Du warst dabei"); auf einer anderen
    // ist es eine Behauptung ueber eine Fahrt, die dort niemand gemacht hat.
    //
    // DAMIT DER TEST GREIFT, muessen VOR Stavanger mehr Seiten der Stimmung
    // 'weite' stehen, als es dort Motive gibt (14) -- erst dann kommt der
    // Ersatzgriff ueberhaupt zum Zug. Eine kuerzere Liste waere gruen, ohne
    // etwas zu beweisen; genau daran scheiterte der erste Anlauf.
    const vieleWeite = Array.from({ length: 16 }, (_, i) => `platz-${i}`);
    const seiten = [...vieleWeite, 'stavanger-2026'];
    const vergeben = verteileMotive(seiten);

    expect(vergeben['stavanger-2026'].haupt).toContain('preikestolen');
    for (const k of vieleWeite) {
      expect(vergeben[k].haupt, `${k} hat den Preikestolen abbekommen`).not.toContain('preikestolen');
    }
  });

  it('jedes hinterlegte Motiv hat auch eine Datei', () => {
    // Ein Tippfehler im Motivnamen faellt sonst erst im Browser auf, als
    // fehlendes Bild.
    for (const [kachel, motiv] of Object.entries(KACHEL_MOTIV)) {
      expect(MOTIV_DATEI[motiv!], `${kachel} zeigt auf ein unbekanntes Motiv`).toBeDefined();
    }
  });
});
