import { describe, it, expect } from 'vitest';
import {
  anzahlBeitraege,
  wartenAufFreigabe,
  getVisibilityInfo,
  getSuccessMessage
} from '../../utils/challengeTexte';

describe('anzahlBeitraege', () => {
  it('nennt die Einzahl bei genau einem Beitrag', () => {
    expect(anzahlBeitraege(1)).toBe('1 Beitrag');
  });

  it('nennt die Mehrzahl bei mehreren Beiträgen', () => {
    expect(anzahlBeitraege(5)).toBe('5 Beiträge');
  });

  it('nennt die Mehrzahl bei null Beiträgen', () => {
    expect(anzahlBeitraege(0)).toBe('0 Beiträge');
  });
});

describe('wartenAufFreigabe', () => {
  it('beugt das Verb in der Einzahl mit', () => {
    expect(wartenAufFreigabe(1)).toBe('1 Beitrag wartet auf Freigabe');
  });

  it('beugt das Verb in der Mehrzahl mit', () => {
    expect(wartenAufFreigabe(5)).toBe('5 Beiträge warten auf Freigabe');
  });
});

describe('getVisibilityInfo', () => {
  it('private: nur das Leitungsteam', () => {
    expect(getVisibilityInfo({ visibility: 'private', moderated: true }))
      .toBe('Deinen Beitrag sieht nur das Leitungsteam');
    // Bei "Nur Leitung" ändert Moderation nichts an der Aussage.
    expect(getVisibilityInfo({ visibility: 'private', moderated: false }))
      .toBe('Deinen Beitrag sieht nur das Leitungsteam');
  });

  it('public: nennt die Freigabe nur bei Freigabe-Pflicht', () => {
    expect(getVisibilityInfo({ visibility: 'public', moderated: true }))
      .toBe('Für deine Gruppe sichtbar — nach Freigabe durch das Leitungsteam');
    expect(getVisibilityInfo({ visibility: 'public', moderated: false }))
      .toBe('Für deine Gruppe sofort sichtbar');
  });

  it('konfi_choice: verweist auf die eigene Wahl unten im Formular', () => {
    expect(getVisibilityInfo({ visibility: 'konfi_choice', moderated: true }))
      .toBe('Du entscheidest unten, wer deinen Beitrag sieht — veröffentlicht wird nach Freigabe');
    expect(getVisibilityInfo({ visibility: 'konfi_choice', moderated: false }))
      .toBe('Du entscheidest unten, wer deinen Beitrag sieht');
  });
});

describe('getSuccessMessage', () => {
  it('moderiert und öffentlich: wartet auf Freigabe', () => {
    expect(getSuccessMessage({ visibility: 'public', moderated: true }, 'publish'))
      .toBe('Eingereicht — dein Beitrag wartet auf Freigabe.');
    expect(getSuccessMessage({ visibility: 'konfi_choice', moderated: true }, 'anonymous'))
      .toBe('Eingereicht — dein Beitrag wartet auf Freigabe.');
  });

  it('unmoderiert und öffentlich: sofort veröffentlicht', () => {
    expect(getSuccessMessage({ visibility: 'public', moderated: false }, 'publish'))
      .toBe('Veröffentlicht!');
    expect(getSuccessMessage({ visibility: 'konfi_choice', moderated: false }, 'publish'))
      .toBe('Veröffentlicht!');
  });

  it('nur Leitung: bleibt bei der Leitung, egal ob moderiert', () => {
    expect(getSuccessMessage({ visibility: 'private', moderated: true }, 'publish'))
      .toBe('Eingereicht — dein Beitrag ist nur für die Leitung sichtbar.');
    expect(getSuccessMessage({ visibility: 'konfi_choice', moderated: true }, 'private'))
      .toBe('Eingereicht — dein Beitrag ist nur für die Leitung sichtbar.');
  });
});
