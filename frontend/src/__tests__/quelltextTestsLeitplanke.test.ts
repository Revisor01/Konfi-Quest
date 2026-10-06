// LEITPLANKE: neue reine Quelltext-Tests werden sichtbar (Audit Tests
// 26.09.2026, BF-02).
//
// Am 26.09.2026 lasen 123 von 263 Frontend-Testdateien Komponenten-Quelltext
// per readFileSync und renderten nichts (46 % der it-Bloecke); am 29.09.2026
// waren es 159 von 375. Solche Tests pruefen, ob eine Zeichenkette dasteht,
// nicht, ob die App tut, was der Titel verspricht. Nach dem Umstellen der
// riskantesten (Rechte, Sichtbarkeit, Zaehler, Push) stehen hier die
// verbliebenen -- ueberwiegend Stil-Waechter (Tokens, Farben, Abstaende) und
// Abwesenheits-Pruefungen, fuer die Quelltext lesen der Zweck ist.
//
// Am 30.09.2026 weitere 33 umgestellt, je mit Gegenprobe (Terminseiten aller
// drei Rollen, Personenansicht der Leitung, Offline-Platzhalter, Material,
// Registrierung, App-Sperre, Chat-Mitglieder): 150 -> 117. Die Gerueste
// dafuer liegen unter components/gerueste/ und nehmen weitere Umstellungen auf.
//
// Gezaehlt wie im Audit: Datei enthaelt `readFileSync` und kein `render(`.
//
// Die Liste darf nur SCHRUMPFEN:
//   - Ein neuer Quelltext-Test faellt hier auf. Besser: die Komponente
//     rendern oder die Funktion aufrufen. Ist Quelltext lesen wirklich der
//     Zweck (Stil-Waechter), die Datei eintragen, OBERGRENZE anheben und es
//     im Commit begruenden.
//   - Ist eine Datei umgestellt oder geloescht, faellt das ebenfalls auf:
//     Eintrag streichen und OBERGRENZE auf die neue Zahl senken.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

const SRC = resolve(__dirname, '..');
const DIESE_DATEI = relative(SRC, __filename).split('\\').join('/');

/** Stand 06.10.2026: 119 (03.10.2026: 118, 30.09.2026: 117, 29.09.2026: 150). Nur nach unten anpassen, ausser mit Begruendung.
 *  03.10.2026 +1: components/webAnsichtCss.test.ts -- Stil-Waechter fuer das
 *  eigene Stylesheet der Web-Fassungen (nur Tokens, keine Bewegung, Praefix
 *  web-); dort IST das Lesen des Stylesheets der Zweck, rendern prueft keine
 *  CSS-Regel.
 *  06.10.2026 +1: components/webCssKlassen.test.ts -- Stil-Waechter: eine Klasse
 *  gehoert genau einer Stylesheet-Datei der Web-Fassungen. Die Doppelung gibt es
 *  erst im gemeinsamen Buendel; ein gerenderter Test laedt nur die Dateien seiner
 *  Seite und kann sie nicht sehen (so verschwanden Balken und Kreis der
 *  Konfi-Liste). */
const OBERGRENZE = 119;

// Nicht gezaehlt: __tests__/config/ und __tests__/betrieb/ (29.09.2026, beim
// Zusammenfuehren der Pakete A-H). Sie pruefen Konfigurationsdateien --
// Manifeste, Workflows, nginx, Dockerfile, Lockfiles, Sitemap --, und dort
// IST das Lesen der Datei das Verhalten; rendern laesst sich nichts. Die
// fuenf frueher hier gefuehrten config/-Dateien sind deshalb gestrichen;
// dazugekommen sind fuenf Leitplanken, die den Quellbaum absuchen
// (Dateiauswahl, Links nach draussen, Dateiverweise, Handbuch-Bilder,
// Universal-Links-Datei). Die Zahl bleibt 150.
const PRUEFORDNER = ['__tests__/config/', '__tests__/betrieb/'];

const BEKANNT: string[] = [
  '__tests__/begriffeEinheitlich.test.ts',
  '__tests__/components/abgesagtFarbeGleichInAllenRollen.test.ts',
  '__tests__/components/abgesagteTermineAnsichten.test.ts',
  '__tests__/components/abgesagterTerminBleibtMeiner.test.ts',
  '__tests__/components/abmeldefristSichtbar.test.ts',
  '__tests__/components/abmeldungUndNotiz.test.ts',
  '__tests__/components/abstaendeTokens.test.ts',
  '__tests__/components/abzeichenTypNullbarkeit.test.ts',
  '__tests__/components/abzeichenZaehlerTeamer.test.ts',
  '__tests__/components/appAbdeckung.test.ts',
  '__tests__/components/beruehrungsziele.test.ts',
  '__tests__/components/bewegungsreduktion.test.ts',
  '__tests__/components/bibelUebersetzungenVollstaendig.test.ts',
  '__tests__/components/biometrieAlleDreiAnsichten.test.ts',
  '__tests__/components/challenges/challengeIconFarbe.test.ts',
  '__tests__/components/challenges/challengesSeiteGeteilt.test.ts',
  '__tests__/components/challenges/eingereichtBadgeGleich.test.ts',
  '__tests__/components/challenges/neuigkeitenVerdrahtung.test.ts',
  '__tests__/components/challenges/stempelStattAbzeichen.test.ts',
  '__tests__/components/chatAufraeumen.test.ts',
  '__tests__/components/chatDateiFortschritt.test.ts',
  '__tests__/components/chatNutzertypDreiWerte.test.ts',
  '__tests__/components/dateiAuswahlNurUeberHuelle.test.ts',
  '__tests__/components/diagnoseNurLeitung.test.ts',
  '__tests__/components/direktchatDoppelPruefung.test.ts',
  '__tests__/components/dunkelmodus.test.ts',
  '__tests__/components/dunkelmodusJsFarben.test.ts',
  '__tests__/components/eckBadgesBarrierefrei.test.tsx',
  '__tests__/components/einladungVerlaengernRueckmeldung.test.ts',
  '__tests__/components/einladungenKarteImProfil.test.ts',
  '__tests__/components/emailAenderungUserContext.test.ts',
  '__tests__/components/farbTokens.test.ts',
  '__tests__/components/formularfelderBenannt.test.ts',
  '__tests__/components/gruppenbezeichnungTeam.test.ts',
  '__tests__/components/haptikBrichtNichtAb.test.ts',
  '__tests__/components/kategorieUndTypInListe.test.ts',
  '__tests__/components/keinStillesOfflineScheitern.test.ts',
  '__tests__/components/klickbareElementeBedienbar.test.ts',
  '__tests__/components/kontoModaleAlleDreiAnsichten.test.ts',
  '__tests__/components/laufendeMehrtagesTermine.test.ts',
  '__tests__/components/listenAbstaendeProfil.test.ts',
  '__tests__/components/materialDateiAuswahl.test.ts',
  '__tests__/components/materialLink.test.ts',
  '__tests__/components/md3LayoutPasst.test.ts',
  '__tests__/components/modaleBenannt.test.ts',
  '__tests__/components/modaleUeberHookBenannt.test.ts',
  '__tests__/components/neuerungenBannerStartseiten.test.ts',
  '__tests__/components/onboardingTourGeteilt.test.ts',
  '__tests__/components/popoverBreite.test.ts',
  '__tests__/components/profilAbzeichenZahlOhneZusatzabruf.test.ts',
  '__tests__/components/profilWrappedReihenfolge.test.ts',
  '__tests__/components/rankingFeldnamen.test.ts',
  '__tests__/components/reiterUnterlaengen.test.ts',
  '__tests__/components/rollenGleichbehandlung.test.ts',
  '__tests__/components/shared/hinweisKartenOhnePfeil.test.ts',
  '__tests__/components/statuswortVerbucht.test.ts',
  '__tests__/components/stempelEineStelle.test.ts',
  '__tests__/components/stylesheetsParsen.test.ts',
  '__tests__/components/tabLeisteAndroid.test.ts',
  '__tests__/components/tabZaehlerIos.test.ts',
  '__tests__/components/tageUndKalendertag.test.ts',
  '__tests__/components/teamerDashboardZertifikate.test.ts',
  '__tests__/components/teamerKonfiHistorieOhneJahrgang.test.ts',
  '__tests__/components/terminDetailDreiAnsichten.test.ts',
  '__tests__/components/terminKopieren.test.ts',
  '__tests__/components/terminModalDatumsfelder.test.ts',
  '__tests__/components/typografieTokens.test.ts',
  '__tests__/components/umlauteUndZurueckIcon.test.ts',
  '__tests__/components/umschalterInDetailansichten.test.ts',
  '__tests__/components/walkthroughVersionEinheitlich.test.ts',
  '__tests__/components/webAnsichtCss.test.ts',
  '__tests__/components/webCssKlassen.test.ts',
  '__tests__/components/wrappedBewegungReduzieren.test.ts',
  '__tests__/components/wrappedBildNichtVerdeckt.test.ts',
  '__tests__/components/wrappedDramaturgieHatRenderer.test.ts',
  '__tests__/components/wrappedSeitenHabenBilder.test.ts',
  '__tests__/components/wrappedSprueche.test.ts',
  '__tests__/components/wrappedStavanger2026.test.ts',
  '__tests__/components/wrappedTeilenAlleSeiten.test.ts',
  '__tests__/components/wrappedTexteUmlaute.test.ts',
  '__tests__/components/zentraleIcons.test.ts',
  '__tests__/components/zoomUndSchrift.test.ts',
  '__tests__/components/zusageKarteHoehe.test.ts',
  '__tests__/contexts/badgeResync.test.ts',
  '__tests__/dateiverweiseImCode.test.ts',
  '__tests__/handbuchBadgeZielgruppen.test.ts',
  '__tests__/handbuchBilder.test.ts',
  '__tests__/handbuchNavigation.test.ts',
  '__tests__/handbuchTrennlinie.test.ts',
  '__tests__/handbuchVerweise.test.ts',
  '__tests__/navigation/appLinksAndroid.test.ts',
  '__tests__/navigation/appLinksIos.test.ts',
  '__tests__/navigation/keinPlatzhalterImOutlet.test.ts',
  '__tests__/navigation/keinTauschImOutlet.test.ts',
  '__tests__/navigation/routenInventar.test.ts',
  '__tests__/navigation/weisserScreenKaltstart.test.ts',
  '__tests__/services/apiPfadeExistieren.test.ts',
  '__tests__/services/badgeIconsAufloesung.test.ts',
  '__tests__/services/dateiDownloadHaertung.test.ts',
  '__tests__/services/keinTokenImQuery.test.ts',
  '__tests__/services/linkOeffnen.test.ts',
  '__tests__/services/messungAntragMaterialSpruch.test.ts',
  '__tests__/services/mitmachenMessung.test.ts',
  '__tests__/services/nutzungstiefeAufrufstellen.test.ts',
  '__tests__/services/umamiKennungen.test.ts',
  '__tests__/sprache.test.ts',
  '__tests__/utils/badgeIcons.test.ts',
  '__tests__/utils/bekannteFehlertexte.test.ts',
  '__tests__/utils/bewahrteStempel.test.ts',
  '__tests__/utils/datumsformate.test.ts',
  '__tests__/utils/deepLinks.test.ts',
  '__tests__/utils/einladungsGueltigkeit.test.ts',
  '__tests__/utils/jahrgangLoeschen.test.ts',
  '__tests__/utils/konfiZeit.test.ts',
  '__tests__/utils/pushNavigationZiele.test.ts',
  '__tests__/utils/rollenFarben.test.ts',
  '__tests__/utils/rollenNamen.test.ts',
  '__tests__/utils/ueberbuchen.test.ts',
  '__tests__/versionsnummernEineQuelle.test.ts',
];

function testDateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) return name === 'node_modules' ? [] : testDateien(pfad);
    return /\.test\.tsx?$/.test(name) ? [pfad] : [];
  });
}

const istQuelltextTest = (inhalt: string) => inhalt.includes('readFileSync') && !inhalt.includes('render(');

describe('Leitplanke: reine Quelltext-Tests', () => {
  const gefunden = testDateien(SRC)
    .map((pfad) => ({ name: relative(SRC, pfad).split('\\').join('/'), inhalt: readFileSync(pfad, 'utf8') }))
    .filter(({ name, inhalt }) => name !== DIESE_DATEI && !PRUEFORDNER.some((o) => name.startsWith(o)) && istQuelltextTest(inhalt))
    .map(({ name }) => name)
    .sort();

  it('findet die Testdateien ueberhaupt', () => {
    expect(testDateien(SRC).length).toBeGreaterThan(300);
  });

  it('kein NEUER reiner Quelltext-Test -- rendern oder die Funktion aufrufen', () => {
    const neu = gefunden.filter((name) => !BEKANNT.includes(name));
    expect(neu, 'Neue Quelltext-Tests (siehe Kopf dieser Datei)').toEqual([]);
  });

  it('umgestellte oder geloeschte Dateien sind aus der Liste gestrichen', () => {
    const weg = BEKANNT.filter((name) => !gefunden.includes(name));
    expect(weg, 'Nicht mehr Quelltext-Test: aus BEKANNT streichen, OBERGRENZE senken').toEqual([]);
  });

  it('die Liste waechst nicht ueber die Obergrenze und die Obergrenze steht auf dem Stand', () => {
    expect(BEKANNT.length).toBeLessThanOrEqual(OBERGRENZE);
    expect(OBERGRENZE, 'OBERGRENZE auf die Laenge der Liste senken').toBe(BEKANNT.length);
  });

  it('Gegenprobe: die Zaehlregel trennt Quelltext- von Rendertests', () => {
    expect(istQuelltextTest("const q = readFileSync('x.tsx', 'utf8'); expect(q).toContain('a');")).toBe(true);
    expect(istQuelltextTest("readFileSync('x.css'); render(<A />);")).toBe(false);
    expect(istQuelltextTest('render(<A />);')).toBe(false);
  });
});
