import { describe, it, expect } from 'vitest';
import { istTeamTyp, istKonfiTyp } from '../../utils/chatRoles';

/**
 * Regressionstests zum Fehlerbild vom 23.08.2026: Der Chat pruefte an mehreren
 * Stellen `=== 'admin'`, um "gehoert zum Team" zu bestimmen. Teamer:innen tragen
 * aber den eigenen Typ 'teamer' — sowohl in chat_participants.user_type als auch
 * in den API-Antworten. Folgen: Der Rollenfilter "Team" im Anlegen-Modal blendete
 * Teamer:innen aus, die Liste stellte sie in Konfi-Farbe ohne Funktionsbezeichnung
 * dar, und Direktchats mit Teamer:innen landeten im falschen Reiter.
 */
describe('istTeamTyp', () => {
  it('zaehlt Teamer:innen zum Team — der eigentliche Fehler', () => {
    expect(istTeamTyp('teamer')).toBe(true);
  });

  it('zaehlt Leitung und Admins zum Team', () => {
    expect(istTeamTyp('admin')).toBe(true);
  });

  it('zaehlt Konfis NICHT zum Team', () => {
    expect(istTeamTyp('konfi')).toBe(false);
  });

  it('behandelt fehlende Angaben als "nicht Team", statt sie durchzulassen', () => {
    expect(istTeamTyp(undefined)).toBe(false);
    expect(istTeamTyp(null)).toBe(false);
    expect(istTeamTyp('')).toBe(false);
  });

  it('ordnet einen unbekannten Typ keiner Seite zu', () => {
    expect(istTeamTyp('super_admin')).toBe(false);
  });
});

describe('istKonfiTyp', () => {
  it('erkennt Konfis', () => {
    expect(istKonfiTyp('konfi')).toBe(true);
  });

  it('erkennt Team-Typen nicht als Konfi', () => {
    expect(istKonfiTyp('teamer')).toBe(false);
    expect(istKonfiTyp('admin')).toBe(false);
  });

  it('behandelt fehlende Angaben als "kein Konfi"', () => {
    expect(istKonfiTyp(undefined)).toBe(false);
    expect(istKonfiTyp(null)).toBe(false);
  });
});

describe('Team und Konfi schliessen einander aus', () => {
  it.each(['admin', 'teamer', 'konfi'])('Typ %s ist genau eine Seite', (typ) => {
    expect(istTeamTyp(typ) && istKonfiTyp(typ)).toBe(false);
    expect(istTeamTyp(typ) || istKonfiTyp(typ)).toBe(true);
  });
});
