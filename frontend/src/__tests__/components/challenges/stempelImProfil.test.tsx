import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import ChallengeStempelSektion from '../../../components/shared/ChallengeStempelSektion';
import type { ChallengeMark } from '../../../types/challenges';

// Simon, 12.09.2026: "im konfi und teamer profil nach den badges auch die
// stempel sehen die gesammelt wurden."
//
// Geprueft wird beides: die Darstellung selbst UND die Verdrahtung in beiden
// Profilen -- ein Abschnitt, den niemand einbindet, ist unsichtbar, egal wie
// gut er rendert.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const konfiProfil = lies('src/components/konfi/views/ProfileView.tsx');
const teamerProfil = lies('src/components/teamer/pages/TeamerProfilePage.tsx');

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

  it('ueberschreibt den Abschnitt mit "Deine Stempel"', () => {
    // Der Text steht in einem IonLabel; das Ionic-Stub der Testumgebung
    // rendert dessen Inhalt nicht, deshalb hier gegen die Quelle geprueft.
    expect(lies('src/components/shared/ChallengeStempelSektion.tsx'))
      .toContain('<IonLabel>Deine Stempel</IonLabel>');
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

  it('bleibt auch weg, wenn gar keine Liste kam', () => {
    // Ein fehlgeschlagener Abruf darf das Profil nicht mit einem leeren
    // Kasten verunstalten.
    const { container } = render(
      <ChallengeStempelSektion marks={undefined as unknown as ChallengeMark[]} />
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('Stempel-Abschnitt: Verdrahtung in beiden Profilen', () => {
  it.each([
    ['Konfi', konfiProfil],
    ['Team', teamerProfil],
  ])('%s-Profil bindet den Abschnitt ein', (_rolle, quelle) => {
    expect(quelle).toContain('ChallengeStempelSektion');
    expect(quelle).toContain('<ChallengeStempelSektion marks={challengeMarks} />');
  });

  it.each([
    ['Konfi', konfiProfil],
    ['Team', teamerProfil],
  ])('%s-Profil holt die Stempel aus dem Teilnehmer-Einstieg', (_rolle, quelle) => {
    // GET /challenges/konfi bedient Konfis UND Team (backend/routes/
    // challenges.js) -- es braucht keine zweite Route und keine Aenderung an
    // der Antwortform der Profil-Route.
    expect(quelle).toContain("api.get('/challenges/konfi')");
    expect(quelle).toContain('res.data?.marks');
  });

  it('Konfi-Profil stellt die Stempel hinter den Badge-Block', () => {
    expect(pos(konfiProfil, '<ChallengeStempelSektion'))
      .toBeGreaterThan(pos(konfiProfil, '{/* Next Badge Progress */}'));
  });

  it('Team-Profil stellt die Stempel hinter den Badge-Eintrag unter "Inhalt"', () => {
    expect(pos(teamerProfil, '<ChallengeStempelSektion'))
      .toBeGreaterThan(pos(teamerProfil, '<div className="app-list-item__title">Badges</div>'));
  });

  it.each([
    ['Konfi', konfiProfil],
    ['Team', teamerProfil],
  ])('%s-Profil laesst einen fehlgeschlagenen Abruf still durchgehen', (_rolle, quelle) => {
    // Die Stempel sind ein Zusatz. Faellt der Abruf aus, bleibt das Profil
    // stehen, statt eine Fehlermeldung zu werfen.
    const block = quelle.slice(
      pos(quelle, "api.get('/challenges/konfi')"),
      pos(quelle, "api.get('/challenges/konfi')") + 400
    );
    expect(block).toContain('.catch(');
  });
});
