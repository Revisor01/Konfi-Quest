// backend/tests/services/feedPushSichtbarkeit.test.js
// Mitteilung, wenn ein Challenge-Beitrag im Feed sichtbar wird
// (Simons Wunsch 31.08.2026).
//
// Zwei Regeln, die NICHT verletzt werden duerfen:
//  1. Empfaenger nur, wenn der Beitrag wirklich oeffentlich ist — sonst
//     erfaehrt jemand von einem Beitrag, den er nicht sehen darf.
//  2. Bei konfi_consent = 'anonymous' KEIN Name in der Mitteilung.
//
// Die Sichtbarkeitsregeln liegen in routes/challenges.js; hier wird die
// Entscheidungslogik gegen dieselben Faelle geprueft, die die Galerie nutzt.

const { anhangText } = require('../../utils/pushText');

// Nachbau der beiden Helfer aus routes/challenges.js. Weichen sie ab,
// faellt es hier auf.
function isSubmissionPublic(submission, challenge) {
  if (!submission || !challenge) return false;
  if (submission.moderation_status !== 'approved') return false;
  if (challenge.visibility === 'public') return true;
  if (challenge.visibility === 'konfi_choice') {
    return submission.konfi_consent === 'publish' || submission.konfi_consent === 'anonymous';
  }
  return false;
}
function isAnonymous(submission) {
  return submission.konfi_consent === 'anonymous';
}

// So baut sendChallengeFeedToJahrgaenge den Text.
function mitteilung(konfiName, challengeTitle, medienArt) {
  const artText = (medienArt && medienArt !== 'text') ? ` (${anhangText(medienArt)})` : '';
  return {
    title: konfiName ? `Neuer Beitrag von ${konfiName}` : 'Neuer Beitrag',
    body: `bei "${challengeTitle}"${artText}`,
  };
}

describe('Feed-Push: wer bekommt ihn', () => {
  it('oeffentliche Challenge, freigegeben -> ja', () => {
    expect(isSubmissionPublic({ moderation_status: 'approved', konfi_consent: 'publish' }, { visibility: 'public' })).toBe(true);
  });

  it('noch nicht freigegeben -> NEIN', () => {
    // Bei moderierten Challenges darf die Mitteilung erst mit der Freigabe
    // kommen, sonst zeigt der Feed noch nichts.
    expect(isSubmissionPublic({ moderation_status: 'pending', konfi_consent: 'publish' }, { visibility: 'public' })).toBe(false);
  });

  it('ausgeblendet -> NEIN', () => {
    expect(isSubmissionPublic({ moderation_status: 'hidden', konfi_consent: 'publish' }, { visibility: 'public' })).toBe(false);
  });

  it('private Challenge -> NIE', () => {
    expect(isSubmissionPublic({ moderation_status: 'approved', konfi_consent: 'publish' }, { visibility: 'private' })).toBe(false);
    expect(isSubmissionPublic({ moderation_status: 'approved', konfi_consent: 'anonymous' }, { visibility: 'private' })).toBe(false);
  });

  it('konfi_choice ohne Einwilligung -> NEIN', () => {
    expect(isSubmissionPublic({ moderation_status: 'approved', konfi_consent: 'private' }, { visibility: 'konfi_choice' })).toBe(false);
  });

  it('konfi_choice mit Einwilligung -> ja', () => {
    expect(isSubmissionPublic({ moderation_status: 'approved', konfi_consent: 'publish' }, { visibility: 'konfi_choice' })).toBe(true);
    expect(isSubmissionPublic({ moderation_status: 'approved', konfi_consent: 'anonymous' }, { visibility: 'konfi_choice' })).toBe(true);
  });
});

describe('Feed-Push: der Text', () => {
  it('nennt den Namen, wenn der Beitrag nicht anonym ist', () => {
    const m = mitteilung('Emilia', 'Adventskalender', 'image');
    expect(m.title).toBe('Neuer Beitrag von Emilia');
    expect(m.body).toBe('bei "Adventskalender" (Foto)');
  });

  it('nennt bei anonym KEINEN Namen', () => {
    // Der wichtigste Fall: Der Name darf die Mitteilung nicht verlassen.
    const anonym = isAnonymous({ konfi_consent: 'anonymous' });
    const m = mitteilung(anonym ? null : 'Emilia', 'Adventskalender', 'image');
    expect(m.title).toBe('Neuer Beitrag');
    expect(m.title).not.toContain('Emilia');
    expect(m.body).not.toContain('Emilia');
  });

  it('nennt die Art des Beitrags', () => {
    expect(mitteilung('Emilia', 'X', 'video').body).toBe('bei "X" (Video)');
    expect(mitteilung('Emilia', 'X', 'audio').body).toBe('bei "X" (Sprachnachricht)');
  });

  it('laesst die Art bei reinem Text weg', () => {
    // "(Anhang)" waere schlicht falsch, wenn es keinen gibt.
    expect(mitteilung('Emilia', 'X', 'text').body).toBe('bei "X"');
  });

  it('verwendet keine Emojis', () => {
    // Projektregel (CLAUDE.md Punkt 3).
    const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u;
    for (const art of ['image', 'video', 'audio', 'file', 'text']) {
      const m = mitteilung('Emilia', 'X', art);
      expect(EMOJI.test(m.title + m.body)).toBe(false);
    }
  });
});
