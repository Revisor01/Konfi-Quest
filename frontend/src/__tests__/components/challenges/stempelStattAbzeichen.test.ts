import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Was fuers Mitmachen bei einer Challenge vergeben wird, heisst seit dem
// 27.08.2026 STEMPEL, nicht mehr Abzeichen (Simons Entscheidung).
//
// Der Grund war ein Widerspruch im eigenen Text: "Fuers Mitmachen gibt es ein
// Abzeichen — und mit Absicht keine Punkte und keine Rangliste. Hier geht es
// nicht ums Sammeln." Das Wort "Abzeichen" ist im Rest der App fest belegt:
// dort SAMMELT man sie, mit Bedingungen und Fortschrittsbalken. Die
// Konfi-Ansicht warb sogar mit "Mach mit und sammle Abzeichen!" — genau das,
// was der Satz daneben verneinte.
//
// Ein Stempel belegt, dass man dabei war. Kein Wettbewerb, keine Wertung.
//
// Dieser Test haelt die Trennung fest. Er prueft Dateien, nicht gerenderte
// Komponenten: Der Fehler waere, dass das alte Wort an EINER Stelle
// zurueckkommt — und in welchem der drei Baeume, weiss man vorher nicht.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

// Dateien, in denen es AUSSCHLIESSLICH um den Challenge-Stempel geht.
const challengeDateien: Array<[string, string]> = [
  ['Konfi-Ansicht', 'src/components/konfi/views/ChallengesView.tsx'],
  ['Leitungs-Ansicht', 'src/components/admin/views/ChallengesManageView.tsx'],
  ['Challenge anlegen', 'src/components/admin/modals/ChallengeManageModal.tsx'],
];

describe('Challenge-Stempel: das alte Wort ist weg', () => {
  it.each(challengeDateien)('%s spricht nicht mehr von Abzeichen', (_name, pfad) => {
    // Erlaubt bleibt allein die bewusste Abgrenzung im Kommentar
    // ("Challenge-Stempel, Abzeichen und Zertifikate dieselbe Bildsprache")
    // — sie erklaert, warum sie denselben Icon-Vorrat nutzen. Alles andere
    // waere ein Rueckfall.
    //
    // 31.08.2026: Die Ausnahme hing frueher am Wortlaut
    // "Challenge-Stempel und Abzeichen". Als der Vorrat auch die Zertifikate
    // aufnahm, wurde der Kommentar richtiger und der Test rot — die Ausnahme
    // prueft deshalb jetzt auf "Bildsprache", also auf die BEGRUENDUNG statt
    // auf eine bestimmte Aufzaehlung.
    const zeilen = lies(pfad)
      .split('\n')
      .filter((z) => z.includes('Abzeichen'))
      .filter((z) => !z.includes('Bildsprache'));
    expect(zeilen).toEqual([]);
  });

  it('die Konfi-Ansicht wirbt nicht mehr mit dem Sammeln', () => {
    // "Mach mit und sammle Abzeichen!" stand direkt ueber einem Abschnitt,
    // der das Sammeln ausdruecklich verneint.
    const quelle = lies('src/components/konfi/views/ChallengesView.tsx');
    expect(quelle).not.toContain('sammle');
    expect(quelle).toContain('Deine Stempel');
  });

  it('Leitung und Konfi nennen den Abschnitt gleich', () => {
    // Drei Ansichten, drei Baeume — hier waren es zwei Stellen mit demselben
    // Text. Laufen sie auseinander, heisst dasselbe Ding zweierlei.
    for (const [, pfad] of challengeDateien.slice(0, 2)) {
      expect(lies(pfad)).toContain('Deine Stempel');
      expect(lies(pfad)).toContain('Noch keine Stempel');
    }
  });
});

describe('Challenge-Stempel: die Erklaertexte aller drei Rollen', () => {
  // Der Widerspruch stand woertlich in sechs Onboarding- und
  // Update-Texten — je zwei pro Rolle. Wird einer vergessen, erklaert die App
  // derselben Person zwei verschiedene Dinge.
  it.each([
    ['Konfi, erste Schritte', 'src/components/konfi/modals/KonfiOnboardingModal.tsx'],
    ['Konfi, Neuerungen', 'src/components/konfi/modals/KonfiUpdateWalkthroughModal.tsx'],
    ['Teamer, erste Schritte', 'src/components/teamer/modals/TeamerOnboardingModal.tsx'],
    ['Teamer, Neuerungen', 'src/components/teamer/modals/TeamerUpdateWalkthroughModal.tsx'],
    ['Leitung, erste Schritte', 'src/components/admin/modals/AdminOnboardingModal.tsx'],
    ['Leitung, Neuerungen', 'src/components/admin/modals/AdminUpdateWalkthroughModal.tsx'],
  ])('%s spricht vom Stempel', (_name, pfad) => {
    const quelle = lies(pfad);
    // Zwei Formulierungen, beide gewollt: Die Texte an Konfis sind direkter
    // ("Fuers Mitmachen gibt es einen Stempel"), die an Team und Leitung
    // knapper ("nur ein Stempel fuers Mitmachen"). Geprueft wird die Sache,
    // nicht der Wortlaut.
    expect(quelle).toMatch(/Stempel fürs Mitmachen|Fürs Mitmachen gibt es einen Stempel/);

    // Gegenprobe, aber gezielt: Dieselben Dateien enthalten auch die Folie zu
    // den ECHTEN Abzeichen ("Deine Badges" — sammeln, Level, freischalten).
    // Dort gehoert das Wort hin. Geprueft wird nur die Challenge-Folie.
    const challengeFolie = quelle
      .split('\n')
      .filter((z) => z.includes('Stempel fürs Mitmachen')
        || z.includes('Fürs Mitmachen gibt es einen Stempel'));
    expect(challengeFolie.length).toBeGreaterThan(0);
    for (const zeile of challengeFolie) {
      expect(zeile).not.toContain('Abzeichen');
    }
  });
});

describe('Challenge-Stempel: das Handbuch zieht mit', () => {
  // Sonst heisst es in der App so und in der Doku anders — genau der
  // Widerspruch, den die Umbenennung beseitigen sollte.
  const kapitel = lies('../docs/handbuch/80-challenges.md');

  it('das Kapitel hat einen Abschnitt "Der Stempel"', () => {
    expect(kapitel).toContain('## Der Stempel');
    expect(kapitel).not.toContain('## Das Abzeichen');
  });

  it('die Abgrenzung zum echten Abzeichen bleibt erhalten', () => {
    // Das Wort "Abzeichen" MUSS hier vorkommen: Die Tabelle erklaert den
    // Unterschied. Faellt sie weg, versteht niemand mehr, warum es zwei
    // verschiedene Dinge gibt.
    expect(kapitel).toContain('| | Abzeichen | Stempel |');
    expect(kapitel).toContain('Ein Abzeichen sammelt man, ein Stempel');
  });

  it('die anderen Kapitel nennen es auch so', () => {
    expect(lies('../docs/handbuch/00-start.md')).toContain('Stempel fürs Mitmachen');
    expect(lies('../docs/handbuch/30-leitung.md')).toContain('der Stempel, den es fürs Mitmachen gibt');
  });
});

describe('Challenge-Stempel: die Store-Texte zu 2.0.0', () => {
  // Sie gehen vor der App raus. Steht dort ein Wort, das die App nicht mehr
  // benutzt, liest es jemand im Store und findet es nirgends wieder.
  const storeTexte = lies('../docs/store-texte-2.0.0.md');

  it('beide Fassungen sprechen vom Stempel', () => {
    expect(storeTexte).toContain('fürs Mitmachen gibt es einen Stempel');
    expect(storeTexte).toContain('mit Stempel fürs Mitmachen');
  });

  it('das Wort steht dort nur noch fuer das echte Abzeichen-System', () => {
    // Zwei Erwaehnungen bleiben zu Recht: das Handbuch-Nachschlagekapitel und
    // die Liste der Korrekturen.
    const treffer = storeTexte.match(/Abzeichen/g) || [];
    expect(treffer).toHaveLength(2);
  });
});
