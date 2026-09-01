import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Beim Typisieren aufgefallen (30.08.2026): Der Abzeichen-Typ stand doppelt --
// einmal in der Abzeichen-Seite, einmal in der Abzeichen-Ansicht -- und beide
// Fassungen fuehrten `criteria_extra` und `earned_at` als nicht-nullbar.
//
// In der Datenbank sind beide nullbar: criteria_extra ist eine optionale
// Spalte (badges.js parst sie mit `|| '{}'`), earned_at kommt aus einem LEFT
// JOIN auf user_badges und ist bei jedem noch nicht erreichten Abzeichen NULL.
// Zwei gleichnamige Typen mit widersprueglicher Nullbarkeit sind genau das
// Muster, das schon einmal sieben ActivityRequest-Definitionen erzeugt hat.
//
// Jetzt gibt es EINEN Typ (AnzeigeBadge in types/dashboard.ts) mit ehrlicher
// Nullbarkeit; die Seite und die Ansicht importieren ihn.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const typen = lies('src/types/dashboard.ts');
const seite = lies('src/components/konfi/pages/KonfiBadgesPage.tsx');
const ansicht = lies('src/components/konfi/views/BadgesView.tsx');
const popover = lies('src/components/shared/BadgePopoverContent.tsx');

describe('Abzeichen-Typ', () => {
  it('steht nur noch einmal zentral', () => {
    expect(typen).toContain('export interface AnzeigeBadge');
    expect(seite).not.toContain('interface Badge {');
    expect(ansicht).not.toContain('interface Badge {');
  });

  it('wird von Seite und Ansicht aus types/dashboard bezogen', () => {
    expect(seite).toContain("from '../../../types/dashboard'");
    expect(ansicht).toContain("from '../../../types/dashboard'");
    expect(seite).toContain('AnzeigeBadge');
    expect(ansicht).toContain('AnzeigeBadge');
  });

  it('fuehrt criteria_extra und earned_at als nullbar', () => {
    expect(typen).toContain('criteria_extra?: string | null;');
    expect(typen).toContain('earned_at?: string | null;');
  });

  it('auch der Abzeichen-Popover kennt die Nullbarkeit', () => {
    expect(popover).toContain('criteria_extra?: string | Record<string, unknown> | null;');
    expect(popover).toContain('earned_at?: string | null;');
    expect(popover).toContain('awarded_date?: string | null;');
  });

  it('die API-Antwortform von /konfi/badges ist getippt', () => {
    expect(typen).toContain('export interface BadgeUebersicht');
    expect(typen).toContain('earned: ApiBadge[]');
    expect(typen).toContain('available: ApiBadge[]');
    // Das Feld heisst in der API earned, nicht is_earned — genau diese
    // Verwechslung liess sich mit `any` nicht bemerken.
    expect(typen).toContain('earned: boolean;');
  });
});
