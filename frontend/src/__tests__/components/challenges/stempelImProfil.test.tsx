import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import ChallengeStempelSektion from '../../../components/shared/ChallengeStempelSektion';
import type { ChallengeMark, OffenerStempel } from '../../../types/challenges';

// Simon, 14.09.2026: "Konfis haben in ihrem Profil jetzt seine Stempel.
// Warum? Das ist doch unter Challenges. Das finden Teamer, Admins und Konfis
// unter Challenges, nie in ihrem Profil."
//
// Der Abschnitt ist deshalb aus den EIGENEN Profilen raus. Er bleibt in der
// Detailansicht der Leitung: dort sieht sie die Stempel einer ANDEREN
// Person, und die findet sie unter Challenges nicht.
//
// Die Darstellungs-Tests bleiben -- die Komponente lebt weiter. Die
// Verdrahtungs-Tests sind umgedreht: sie halten jetzt fest, wo der
// Abschnitt NICHT mehr steht, damit ihn niemand versehentlich wieder
// einbaut.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const konfiProfil = lies('src/components/konfi/views/ProfileView.tsx');
const teamerProfil = lies('src/components/teamer/pages/TeamerProfilePage.tsx');
const leitungsDetail = lies('src/components/admin/views/KonfiDetailView.tsx');

const pos = (quelle: string, marke: string): number => {
  const i = quelle.indexOf(marke);
  expect(i, `nicht gefunden: ${marke}`).toBeGreaterThan(-1);
  return i;
};

const STEMPEL: ChallengeMark[] = [
  { challenge_id: 7, badge_icon: 'star', badge_name: 'Nachtwanderer', title: 'Geh nachts raus' },
  { challenge_id: 9, badge_icon: 'heart', badge_name: 'Zuhörer', title: 'Hör jemandem zu' },
];

describe('Stempel-Abschnitt: Darstellung', () => {
  it('zeigt jeden gesammelten Stempel mit seinem Namen', () => {
    render(<ChallengeStempelSektion marks={STEMPEL} />);
    expect(screen.getByText('Nachtwanderer')).toBeInTheDocument();
    expect(screen.getByText('Zuhörer')).toBeInTheDocument();
  });

  it('ueberschreibt den Abschnitt im eigenen Profil mit "Deine Stempel"', () => {
    // Seit die Leitungs-Ansicht dieselbe Komponente nutzt, ist der Titel ein
    // Prop: dort heisst er "Stempel" ("Deine" waere ueber eine fremde Person
    // falsch). Der Standardwert traegt weiter das eigene Profil.
    // Der Text steht in einem IonLabel; das Ionic-Stub der Testumgebung
    // rendert dessen Inhalt nicht, deshalb hier gegen die Quelle geprueft.
    expect(lies('src/components/shared/ChallengeStempelSektion.tsx'))
      .toContain("titel = 'Deine Stempel'");
  });

  it('zeichnet genau so viele Kacheln, wie es Stempel gibt', () => {
    const { container } = render(<ChallengeStempelSektion marks={STEMPEL} />);
    // Ein Icon je Stempel plus das Symbol der Abschnitts-Ueberschrift.
    expect(container.querySelectorAll('ion-icon').length).toBe(STEMPEL.length + 1);
  });

  it('faerbt die Stempel in der Challenge-Farbe', () => {
    const { container } = render(<ChallengeStempelSektion marks={STEMPEL} />);
    const html = container.innerHTML;
    expect(html).toContain('--app-color-challenges');
  });

  it('bleibt ohne Stempel ganz weg -- keine Kachel mit einer Null darauf', () => {
    const { container } = render(<ChallengeStempelSektion marks={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('macht die Kacheln klickbar -- sonst gaebe es keinen Popover', () => {
    const { container } = render(<ChallengeStempelSektion marks={STEMPEL} />);
    expect(container.querySelectorAll('.app-kachel--klickbar').length).toBe(STEMPEL.length);
  });

  it('bleibt auch weg, wenn gar keine Liste kam', () => {
    // Ein fehlgeschlagener Abruf darf das Profil nicht mit einem leeren
    // Kasten verunstalten.
    const { container } = render(
      <ChallengeStempelSektion marks={undefined as unknown as ChallengeMark[]} />
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('Stempel-Abschnitt: nicht mehr im eigenen Profil', () => {
  it.each([
    ['Konfi', konfiProfil],
    ['Team', teamerProfil],
  ])('%s-Profil bindet den Abschnitt NICHT ein', (_rolle, quelle) => {
    // Die Stempel stehen unter Challenges. Wer sie hier wieder einbaut,
    // zeigt dieselbe Sache an zwei Stellen.
    expect(quelle).not.toContain('<ChallengeStempelSektion');
    // Auch der Import muss weg, sonst bleibt toter Code stehen.
    expect(quelle).not.toMatch(/import\s+ChallengeStempelSektion/);
  });

  it('das Team-Profil spart sich den Abruf ganz', () => {
    // Dort speisten die Stempel nur den Abschnitt. Ohne ihn faellt ein
    // Request je Profilaufruf weg.
    expect(teamerProfil).not.toContain("api.get('/challenges/konfi')");
    expect(teamerProfil).not.toContain('ChallengeMark');
  });

  it('das Konfi-Profil behaelt die Zahl in der Kachel "CHALLENGES"', () => {
    // Hier speisen dieselben Daten weiter den Zaehler ganz oben -- der
    // Abruf bleibt deshalb stehen, nur der Abschnitt ist weg.
    expect(konfiProfil).toContain("api.get('/challenges/konfi')");
    expect(konfiProfil).toContain("{ value: challengeMarks.length, label: 'CHALLENGES' }");
  });

  it('der Konfi-Abruf faellt weiterhin still aus, wenn er fehlschlaegt', () => {
    const start = pos(konfiProfil, "api.get('/challenges/konfi')");
    expect(konfiProfil.slice(start, start + 400)).toContain('.catch(');
  });
});

describe('Stempel-Abschnitt: bleibt in der Detailansicht der Leitung', () => {
  it('die Leitung sieht die Stempel einer anderen Person weiterhin', () => {
    // Anders als im eigenen Profil ist das hier die EINZIGE Stelle: unter
    // Challenges sieht die Leitung nur ihre eigenen Stempel.
    expect(leitungsDetail).toContain('<ChallengeStempelSektion');
    expect(leitungsDetail).toMatch(/import\s+ChallengeStempelSektion/);
  });

  it('sie bekommt die Stempel aus dem ohnehin geladenen Konfi-Objekt', () => {
    // Kein eigener Request: die Detailansicht hat die Daten schon.
    expect(leitungsDetail).toContain('currentKonfi?.challengeMarks');
  });
});

// Simon, 14.09.2026: "wie wollen sich die zeigen, die man nicht bekommen hat,
// in grau." Die nicht erhaltenen Stempel nutzen denselben Weg wie die nicht
// verdienten Abzeichen: .app-kachel--gesperrt.
const OFFEN: OffenerStempel[] = [
  { challenge_id: 21, badge_icon: 'flag', badge_name: 'Fruehaufsteher', title: 'Steh frueh auf', status: 'active' },
  { challenge_id: 22, badge_icon: 'flag', badge_name: 'Wanderer', title: 'Geh wandern', status: 'ended' },
];

describe('Stempel-Abschnitt: nicht erhaltene Stempel in grau', () => {
  it('zeichnet offene Stempel als GESPERRTE Kacheln, erhaltene nicht', () => {
    const { container } = render(
      <ChallengeStempelSektion marks={STEMPEL} offeneStempel={OFFEN} />
    );
    const alle = container.querySelectorAll('.app-kachel');
    const gesperrt = container.querySelectorAll('.app-kachel--gesperrt');
    expect(alle.length).toBe(STEMPEL.length + OFFEN.length);
    // GEGENPROBE zum Alles-grau: genau die offenen sind gesperrt.
    expect(gesperrt.length).toBe(OFFEN.length);
  });

  it('zeigt den Namen eines offenen Stempels -- man soll sehen, was es zu holen gibt', () => {
    render(<ChallengeStempelSektion marks={STEMPEL} offeneStempel={OFFEN} />);
    expect(screen.getByText('Fruehaufsteher')).toBeInTheDocument();
    expect(screen.getByText('Wanderer')).toBeInTheDocument();
  });

  it('erhaltene Stempel stehen vorne, die grauen danach', () => {
    const { container } = render(
      <ChallengeStempelSektion marks={STEMPEL} offeneStempel={OFFEN} />
    );
    const kacheln = Array.from(container.querySelectorAll('.app-kachel'));
    const gesperrtAb = kacheln.findIndex((k) => k.classList.contains('app-kachel--gesperrt'));
    expect(gesperrtAb).toBe(STEMPEL.length);
    // GEGENPROBE: ab dort ist ALLES gesperrt, nicht gemischt.
    expect(kacheln.slice(gesperrtAb).every((k) => k.classList.contains('app-kachel--gesperrt')))
      .toBe(true);
  });

  it('zeigt den Abschnitt auch, wenn es NUR offene Stempel gibt', () => {
    // Wer noch keinen hat, soll sehen, was es zu holen gibt -- eine leere
    // Flaeche sagt gar nichts.
    const { container } = render(
      <ChallengeStempelSektion marks={[]} offeneStempel={OFFEN} />
    );
    expect(container.querySelectorAll('.app-kachel--gesperrt').length).toBe(OFFEN.length);
  });

  it('bleibt weg, wenn es weder erhaltene noch offene gibt', () => {
    const { container } = render(<ChallengeStempelSektion marks={[]} offeneStempel={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('kommt ohne das neue Feld aus (aelterer Server)', () => {
    const { container } = render(<ChallengeStempelSektion marks={STEMPEL} />);
    expect(container.querySelectorAll('.app-kachel').length).toBe(STEMPEL.length);
    expect(container.querySelectorAll('.app-kachel--gesperrt').length).toBe(0);
  });
});
