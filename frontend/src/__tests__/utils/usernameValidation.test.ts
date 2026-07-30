import { describe, it, expect } from 'vitest';
import {
  hasValidUsernameChars,
  isValidUsername,
  USERNAME_MAX_LENGTH
} from '../../utils/usernameValidation';

describe('usernameValidation', () => {
  describe('hasValidUsernameChars', () => {
    it('erlaubt Buchstaben, Zahlen, Punkt und Bindestrich', () => {
      expect(hasValidUsernameChars('anna.musterfrau')).toBe(true);
      expect(hasValidUsernameChars('Anna.Musterfrau')).toBe(true);
      expect(hasValidUsernameChars('max123')).toBe(true);
      expect(hasValidUsernameChars('lisa-marie')).toBe(true);
    });

    it('lehnt Leerzeichen ab', () => {
      expect(hasValidUsernameChars('anna musterfrau')).toBe(false);
      expect(hasValidUsernameChars(' anna')).toBe(false);
      expect(hasValidUsernameChars('anna ')).toBe(false);
    });

    it('lehnt Umlaute und Sonderzeichen ab', () => {
      expect(hasValidUsernameChars('jürgen')).toBe(false);
      expect(hasValidUsernameChars('anna_musterfrau')).toBe(false);
      expect(hasValidUsernameChars('anna@musterfrau')).toBe(false);
      expect(hasValidUsernameChars('anna!')).toBe(false);
    });

    it('lehnt leeren String ab', () => {
      expect(hasValidUsernameChars('')).toBe(false);
    });
  });

  describe('isValidUsername', () => {
    it('verlangt mindestens 3 Zeichen', () => {
      expect(isValidUsername('ab')).toBe(false);
      expect(isValidUsername('abc')).toBe(true);
    });

    it('verlangt maximal 50 Zeichen', () => {
      expect(isValidUsername('a'.repeat(USERNAME_MAX_LENGTH))).toBe(true);
      expect(isValidUsername('a'.repeat(USERNAME_MAX_LENGTH + 1))).toBe(false);
    });

    it('kombiniert Laenge und Zeichenregeln', () => {
      expect(isValidUsername('anna.musterfrau')).toBe(true);
      expect(isValidUsername('anna musterfrau')).toBe(false);
    });
  });
});
