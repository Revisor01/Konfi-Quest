import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Angeglichene Rollen-Unterschiede (Simon, 05.09.2026).
//
// Die Token-Konsolidierung hat sichtbar gemacht, was vorher in hunderten
// Fundstellen verborgen lag: Dieselbe Sache trug bei admin, teamer und konfi
// verschiedene Zeichen und Abstaende. Simon hat entschieden, was angeglichen
// wird; diese Tests halten die Entscheidungen fest.
//
// Sie pruefen bewusst die VERDRAHTUNG in den Quellen (Projektkonvention, vgl.
// abzeichenZaehlerTeamer.test.ts) und nicht das Rendern: Der Fehlerfall ist
// "jemand setzt an EINER Stelle wieder ein anderes Zeichen", und genau das
// faengt ein Quelltest zuverlaessiger als ein Rendertest je Ansicht.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

describe('Gottesdienst traegt ueberall dasselbe Zeichen', () => {
  // Vorher drei: Haus in allen Terminlisten (10 Fundstellen), Stern im
  // Punkteverlauf, Schulhut in der Admin-Aktivitaetenliste. Das Haus war die
  // klare Mehrheit, die anderen beiden wurden darauf gezogen.
  it('der Punkteverlauf nutzt das Haus, nicht den Stern', () => {
    const verlauf = lies('src/components/konfi/modals/PointsHistoryModal.tsx');
    expect(verlauf).toContain("case 'gottesdienst': return ICON_GOTTESDIENST_GEFUELLT;");
  });

  it('die Admin-Aktivitaetenliste nutzt das Haus, nicht den Schulhut', () => {
    const detail = lies('src/components/admin/views/KonfiDetailSections.tsx');
    expect(detail).toContain("activity.type === 'gottesdienst' ? ICON_GOTTESDIENST_GEFUELLT");
    expect(detail).toContain("entry.category === 'gottesdienst' ? ICON_GOTTESDIENST");
    // Der Schulhut steht hier nur noch fuer Jahrgaenge, nicht fuer Gottesdienst.
    expect(detail).not.toContain("'gottesdienst' ? ICON_JAHRGANG_GEFUELLT");
  });
});

describe('Abzeichen tragen ueberall dasselbe Zeichen', () => {
  // Vorher vier: Stern im Konfi-Tab und -Onboarding, Pokal auf der
  // Konfi-Badges-Seite, Band bei Teamer und Leitung. Ein Konfi sah fuer
  // dieselbe Sache Stern (Tab) UND Pokal (Seite). Jetzt ueberall das Band.
  it('der Konfi-Tab nutzt das Band', () => {
    const baeume = lies('src/navigation/rollenBaeume.ts');
    const zeile = baeume.split('\n').find(z => z.includes("tab: 'badges'")) || '';
    expect(zeile).toContain('ICON_ABZEICHEN_GEFUELLT');
    expect(zeile).not.toContain('ICON_STERN');
  });

  it('die Konfi-Badges-Seite nutzt das Band statt des Pokals', () => {
    const seite = lies('src/components/konfi/views/BadgesView.tsx');
    // Die Ueberschriften der Seite.
    expect(seite).toContain('title="Deine Badges"');
    const kopf = seite.slice(seite.indexOf('title="Deine Badges"'));
    expect(kopf.slice(0, 400)).toContain('ICON_ABZEICHEN_GEFUELLT');
    // Der Pokal bleibt fuer die Kategorie "Punkte-Sammler" -- das ist eine
    // Abzeichenart, keine Ueberschrift fuer Abzeichen insgesamt.
    expect(seite).toContain("key: 'total_points'");
  });

  it('alle drei Rollen nutzen im Onboarding dasselbe Zeichen', () => {
    const konfi = lies('src/components/konfi/modals/KonfiOnboardingModal.tsx');
    const teamer = lies('src/components/teamer/modals/TeamerOnboardingModal.tsx');
    const admin = lies('src/components/admin/modals/AdminOnboardingModal.tsx');
    for (const quelle of [konfi, teamer, admin]) {
      expect(quelle).toContain('ICON_ABZEICHEN');
    }
    expect(konfi).not.toContain('icon: ICON_STERN,');
  });
});

describe('Der Reiter "Mitmachen" traegt bei allen Rollen dasselbe Zeichen', () => {
  // Vorher: Leitung Blitz, Teamer und Konfi Kalender -- gleiche Beschriftung,
  // anderes Zeichen.
  it('admin, teamer und konfi nutzen den Kalender', () => {
    const baeume = lies('src/navigation/rollenBaeume.ts');
    const zeilen = baeume.split('\n').filter(z => z.includes("label: 'Mitmachen'"));
    expect(zeilen.length).toBe(3);
    for (const z of zeilen) {
      expect(z).toContain('ICON_TERMIN_GEFUELLT');
    }
  });
});

describe('Das Passwort-Auge ist ueberall dieselbe Strichstaerke', () => {
  // Vorher: Auth-Seiten gefuellt, Modals als Kontur -- der Admin-Passwort-
  // Reset zeigte ein anderes Auge als die Konfi-Registrierung. Jetzt
  // durchgehend Kontur, passend zum feineren Zurueck-Pfeil.
  const dateien = [
    'src/components/auth/LoginView.tsx',
    'src/components/auth/ResetPasswordPage.tsx',
    'src/components/auth/KonfiRegisterPage.tsx',
    'src/components/shared/ChangePasswordModal.tsx',
    'src/components/shared/DeleteAccountModal.tsx',
    'src/components/admin/modals/AdminPasswordResetModal.tsx',
  ];

  it('keine Seite nutzt die gefuellte Variante', () => {
    const treffer: string[] = [];
    for (const d of dateien) {
      const s = lies(d);
      if (s.includes('ICON_SICHTBAR_GEFUELLT') || s.includes('ICON_VERBORGEN_GEFUELLT')) {
        treffer.push(d);
      }
    }
    expect(treffer).toEqual([]);
  });

  it('alle sechs Stellen nutzen die Kontur', () => {
    for (const d of dateien) {
      expect(lies(d)).toContain('ICON_SICHTBAR');
    }
  });
});

describe('Gleiche Elemente haben bei allen Rollen denselben Abstand', () => {
  // Vorher: Profil-Kopf konfi 50px gegen admin/teamer 70px; Ladehinweis 50
  // gegen 80; Auth-Hero 50/60/90. Alles auf je einen Wert gezogen.
  it('der Profil-Kopf ist bei allen drei Rollen gleich hoch', () => {
    const konfi = lies('src/components/konfi/views/ProfileView.tsx');
    const teamer = lies('src/components/teamer/pages/TeamerProfilePage.tsx');
    const admin = lies('src/components/admin/pages/AdminProfilePage.tsx');
    for (const quelle of [konfi, teamer, admin]) {
      expect(quelle).toContain('var(--app-freiraum-kopf-l)');
    }
  });

  it('der Ladehinweis steht bei allen Rollen gleich hoch', () => {
    const dateien = [
      'src/components/konfi/pages/KonfiProfilePage.tsx',
      'src/components/konfi/pages/KonfiDashboardPage.tsx',
      'src/components/teamer/pages/TeamerKonfiStatsPage.tsx',
      'src/components/teamer/pages/TeamerProfilePage.tsx',
    ];
    for (const d of dateien) {
      expect(lies(d)).toContain("marginTop: 'var(--app-freiraum-kopf-m)'");
    }
  });

  it('alle Anmelde-Seiten setzen denselben Kopfabstand', () => {
    const dateien = [
      'src/components/auth/LoginView.tsx',
      'src/components/auth/ForgotPasswordPage.tsx',
      'src/components/auth/ResetPasswordPage.tsx',
      'src/components/auth/KonfiRegisterPage.tsx',
      'src/components/common/ErrorBoundary.tsx',
    ];
    for (const d of dateien) {
      const s = lies(d);
      // Der Klassenname kommt mehrfach vor (auch an Ueberschriften darin) --
      // gesucht ist der Container, der den Kopfabstand setzt.
      const zeile = s.split('\n').find(z => z.includes('app-auth-hero"') && z.includes('marginTop')) || '';
      expect(zeile).toContain('var(--app-freiraum-kopf-m)');
    }
  });
});

describe('Banner haben ueberall Abstand zum Rand', () => {
  // Simon, 06.09.2026: "das banner version 2.0.0 hat keine richtigen
  // abstaende nach links und rechts, fuellt die volle breite."
  //
  // Ursache: StoreUpdateBanner hatte keinen Standard-style. Konfi- und
  // Teamer-Startseite gaben je einen mit, die Leitungsansicht nicht -- dort
  // klebte das Banner an beiden Raendern. Derselbe Fehlertyp wie so oft:
  // Drei Rollenbaeume, einer wird vergessen.
  it('StoreUpdateBanner bringt seinen eigenen Abstand mit', () => {
    const banner = lies('src/components/shared/StoreUpdateBanner.tsx');
    expect(banner).toContain("style = { margin: 'var(--app-abstand-eng) var(--app-abstand-basis) 0' }");
  });

  it('NeuerungenBanner ebenso', () => {
    const banner = lies('src/components/shared/NeuerungenBanner.tsx');
    expect(banner).toContain("style = { margin: 'var(--app-abstand-basis)' }");
  });
});

describe('Die App kennt ihre eigene Version', () => {
  // Simon, 06.09.2026: "warum zeigt er das? wir sind doch auf 2.1.1"
  //
  // Der Store-Update-Hinweis vergleicht die Store-Version mit App.getInfo().
  // Im iOS-Projekt stand noch 1.5.3, waehrend version.json 2.1.1 sagt --
  // die App hielt sich fuer aelter und meldete 2.0.0 als "neuer".
  // Ausgelieferte Builds waren NIE betroffen: Dort setzt
  // scripts/apply-version.sh die Version in der CI. Nur der lokale Stand
  // lief weg, und genau der laeuft beim Geraetetest.
  it('die iOS-Version stimmt mit version.json ueberein', () => {
    const version = JSON.parse(lies('version.json')).version as string;
    const pbx = lies('ios/App/App.xcodeproj/project.pbxproj');
    const treffer = [...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) => m[1].trim());
    expect(treffer.length).toBeGreaterThan(0);
    for (const t of treffer) expect(t).toBe(version);
  });
});

describe('Leerzustaende tragen die Farbe ihres Bereichs', () => {
  // Simon, 06.09.2026: "unter challenges wenn noch nichts da ist, unter
  // aktuelles geplant und archiv im admin immer noch das Pink auf den Icons."
  //
  // Alle drei Leerzustaende der Challenge-Verwaltung standen auf
  // --app-color-teamer, dem Beerenrot des Team-Bereichs. Ein Rest davon, dass
  // Challenges frueher dieselbe Farbe trugen -- nach dem Wechsel auf Indigo
  // fiel es auf. Die Konfi-Ansicht war korrekt, nur die Leitung nicht:
  // wieder der Fall "drei Rollenbaeume, einer wird vergessen".
  it('die Challenge-Verwaltung nutzt die Challenges-Farbe', () => {
    const seite = lies('src/components/admin/views/ChallengesManageView.tsx');
    const treffer = [...seite.matchAll(/emptyIconColor="([^"]+)"/g)].map((m) => m[1]);
    expect(treffer.length).toBe(3);   // Aktuell, Geplant, Archiv
    for (const t of treffer) expect(t).toBe('var(--app-color-challenges)');
  });

  it('die Konfi-Challenges ebenso', () => {
    const seite = lies('src/components/konfi/views/ChallengesView.tsx');
    for (const t of [...seite.matchAll(/iconColor="([^"]+)"/g)].map((m) => m[1])) {
      expect(t).toBe('var(--app-color-challenges)');
    }
  });

  it('keine Ansicht nutzt mehr die Teamer-Farbe fuer Challenges', () => {
    const seite = lies('src/components/admin/views/ChallengesManageView.tsx');
    expect(seite).not.toContain('var(--app-color-teamer)');
  });
});

describe('Chat: erst filtern, dann suchen', () => {
  // Simon, 06.09.2026: "im chat finde ich das suche und filter unter die
  // tableiste muss. alle ungelesen konfis team. dann filtert man erst und
  // dann sucht man."
  //
  // Vorher stand die Suche ueber den Reitern: Man tippte einen Namen und
  // schraenkte die Menge erst danach ein -- gegen die eigene Erwartung.
  // Alle drei Rollen nutzen dieselbe Datei, die Reihenfolge gilt also
  // ueberall.
  it('die Reiter stehen vor der Suche', () => {
    const seite = lies('src/components/chat/ChatOverview.tsx');
    const reiter = seite.indexOf('app-segment-wrapper');
    const suche = seite.indexOf('Chaträume durchsuchen');
    expect(reiter).toBeGreaterThan(0);
    expect(suche).toBeGreaterThan(0);
    expect(reiter).toBeLessThan(suche);
  });

  it('die Reiter heissen Alle, Ungelesen, Konfis und Team', () => {
    const seite = lies('src/components/chat/ChatOverview.tsx');
    for (const wert of ['alle', 'ungelesen', 'konfis', 'team']) {
      expect(seite).toContain(`<IonSegmentButton value="${wert}">`);
    }
  });
});
