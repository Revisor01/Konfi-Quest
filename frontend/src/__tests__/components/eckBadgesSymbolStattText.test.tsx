// Eck-Badges zeigen Symbole, keine Woerter (Simon, 25.09.2026: "eigentlich
// sollen die idR keine Texte sondern nur Icons haben es sei denn es geht
// nicht anders"). Vorbild ist das Freigaben-Badge in ChallengesManageView:
// Zahl plus Uhr, der ganze Satz in title und aria-label.
//
// Hier die fuenf Stellen, die bis dahin noch ein Wort in der Ecke trugen,
// plus die zwei Statusworte, die in der Status-Karte fehlten und deshalb als
// Text zurueckfielen ('Angerechnet' in der Konfi-Antragsliste, 'Anderer
// Termin' bei der Konfirmations-Sperre).
//
// Die Quelltext-Pruefungen laufen ohne Kommentare (ohneKommentare), damit ein
// erklaerender Kommentar wie 'statt "Voll"/"Frei"' nicht faelschlich
// anschlaegt -- siehe abgesagteTermineAnsichten.test.ts.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ohneKommentare } from './abgesagteTermineAnsichten.test';
import StatusBadge, { getStatusIcon } from '../../components/shared/StatusBadge';
import {
  ICON_ABSAGE,
  ICON_HAKEN_GEFUELLT,
  ICON_MAIL_GEFUELLT,
  ICON_ORGANISATION_GEFUELLT,
  ICON_SPERRE_GEFUELLT,
  ICON_UHRZEIT,
  ICON_WARNHINWEIS_GEFUELLT,
  ICON_WECHSEL,
  ICON_ZUSAGE_GEFUELLT,
} from '../../components/shared/icons';

vi.mock('@ionic/react', () => ({
  IonIcon: (props: { icon?: string }) => <span data-testid="icon" data-icon={props.icon} />,
}));

const code = (pfad: string) =>
  ohneKommentare(readFileSync(resolve(process.cwd(), pfad), 'utf8'));

/** Der Quelltext des ersten Eck-Badges in der Datei, das `marker` enthaelt. */
const badgeBlock = (pfad: string, marker: string): string => {
  const quelle = code(pfad);
  const start = quelle.indexOf(marker);
  expect(start, `${marker} in ${pfad}`).toBeGreaterThan(-1);
  const anfang = quelle.lastIndexOf('<div className="app-corner-badges">', start);
  const ende = quelle.indexOf('<div className="app-list-item__row"', start);
  expect(anfang).toBeGreaterThan(-1);
  expect(ende).toBeGreaterThan(anfang);
  return quelle.slice(anfang, ende);
};

describe('Status-Karte: die zwei Worte, die als Text zurueckfielen', () => {
  it('Angerechnet hat dasselbe Zeichen wie Verbucht und Genehmigt', () => {
    expect(getStatusIcon('Angerechnet')).toBe(ICON_ZUSAGE_GEFUELLT);
    expect(getStatusIcon('Verbucht')).toBe(ICON_ZUSAGE_GEFUELLT);
  });

  // Simon, 26.09.2026: "schloss für anders wäre auch was anderes besser". Der
  // Doppelpfeil sagt "woanders / wechseln" -- das Schloss sagte nur "zu" und
  // war von 'Ausgebucht' nicht zu unterscheiden.
  it('Anderer Termin traegt den Doppelpfeil (wechseln), nicht das Schloss von Ausgebucht', () => {
    expect(getStatusIcon('Anderer Termin')).toBe(ICON_WECHSEL);
    expect(getStatusIcon('Ausgebucht')).toBe(ICON_SPERRE_GEFUELLT);
    expect(ICON_WECHSEL).not.toBe(ICON_SPERRE_GEFUELLT);
  });

  it.each(['Angerechnet', 'Anderer Termin'])('%s rendert als Symbol mit dem Wort im title', (wort) => {
    const { container } = render(<StatusBadge statusText={wort} statusColor="red" />);
    const badge = container.querySelector('.app-corner-badge') as HTMLElement;
    expect(badge.textContent).toBe('');
    expect(badge.getAttribute('title')).toBe(wort);
    expect(badge.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe(getStatusIcon(wort));
  });

  it('der Text-Rueckfall fuer unbekannte Worte behaelt das Wort auch im title', () => {
    const { container } = render(<StatusBadge statusText="Irgendwas Neues" statusColor="red" />);
    const badge = container.querySelector('.app-corner-badge') as HTMLElement;
    expect(badge.textContent).toBe('Irgendwas Neues');
    expect(badge.getAttribute('title')).toBe('Irgendwas Neues');
  });
});

describe('Benutzerliste: Rolle als Symbol', () => {
  const pfad = 'src/components/admin/UsersView.tsx';

  it('das Badge zeigt das Rollen-Symbol, das Wort steht in title und aria-label', () => {
    const block = badgeBlock(pfad, 'title={rolleText}');
    expect(block).toContain('<IonIcon icon={rolleIcon}');
    expect(block).toContain('aria-label={rolleText}');
    expect(block).toContain('role="img"');
    expect(block).not.toContain("'Org-Admin'");
    expect(block).not.toContain("'Teamer:in'");
  });

  // Simon, 26.09.2026, zum Schluessel: "andere Idee?". Das Gebaeude ist in der
  // App das Zeichen fuer die Gemeinde (Gemeinde-Auswahl, Gemeinde-Einstellungen,
  // Postfach) -- der Org-Admin ist die Rolle fuer die ganze Gemeinde.
  it('drei Rollen, drei Zeichen: Gebaeude, Schild, Person', () => {
    const quelle = code(pfad);
    expect(quelle).toContain("const rolleText = user.role_name === 'org_admin' ? 'Org-Admin' : user.role_name === 'admin' ? 'Admin' : 'Teamer:in';");
    expect(quelle).toContain("const rolleIcon = user.role_name === 'org_admin' ? ICON_ORGANISATION_GEFUELLT : user.role_name === 'admin' ? ICON_SCHILD_GEFUELLT : ICON_PERSON_GEFUELLT;");
    expect(quelle).not.toContain('ICON_SCHLUESSEL');
    expect(ICON_ORGANISATION_GEFUELLT.length).toBeGreaterThan(0);
  });
});

describe('Serientermine der Leitung: Voll/Frei als Symbol', () => {
  it('Kreuz fuer voll, Haken fuer frei -- Wort in title und aria-label', () => {
    const block = badgeBlock('src/components/admin/views/EventDetailSections.tsx', "title={isFull ? 'Voll' : 'Frei'}\n                  role=\"img\"");
    expect(block).toContain('<IonIcon icon={isFull ? ICON_ABSAGE : ICON_ZUSAGE_GEFUELLT}');
    expect(block).toContain("aria-label={isFull ? 'Voll' : 'Frei'}");
    expect(block).not.toMatch(/>\s*\{isFull \? 'Voll' : 'Frei'\}\s*</);
    expect(ICON_ABSAGE).not.toBe(ICON_ZUSAGE_GEFUELLT);
  });
});

// 'Aktiviert' in den Einstellungen (AdminSettingsPage) stand hier bis zum
// 26.09.2026 ebenfalls. Das Badge ist mit der Push-Auswahl (f250af8c)
// entfallen -- die Benachrichtigungen haben dort keine Karte mit Eck-Badge
// mehr. Bleibt geprueft: 'Aktiv' traegt in der Status-Karte den Haken.
describe('Einstellungen: Benachrichtigungen aktiviert', () => {
  it('kein Eck-Badge mehr in den Einstellungen; Aktiv bleibt der Haken', () => {
    expect(code('src/components/admin/pages/AdminSettingsPage.tsx')).not.toContain('app-corner-badge');
    expect(getStatusIcon('Aktiv')).toBe(ICON_HAKEN_GEFUELLT);
  });
});

describe('Postfach: ungelesen als Umschlag', () => {
  it('geschlossener Umschlag statt "Neu", Klartext in title und aria-label', () => {
    const block = badgeBlock('src/components/common/PostfachModal.tsx', 'title="Neu — ungelesen"');
    expect(block).toContain('<IonIcon icon={ICON_MAIL_GEFUELLT}');
    expect(block).toContain('aria-label="Neu — ungelesen"');
    expect(block).not.toMatch(/>\s*Neu\s*</);
    expect(ICON_MAIL_GEFUELLT.length).toBeGreaterThan(0);
  });
});

describe('Einladungscodes: Resttage als Zahl plus Uhr', () => {
  const pfad = 'src/components/admin/pages/AdminInvitePage.tsx';

  it('Zahl plus Uhr wie die offenen Freigaben, der Satz in title und aria-label', () => {
    const block = badgeBlock(pfad, 'title={satz}');
    expect(block).toContain('{resttage > 0 && resttage}');
    expect(block).toContain('<IonIcon icon={abgelaufen || letzterTag ? ICON_WARNHINWEIS_GEFUELLT : ICON_UHRZEIT}');
    expect(block).toContain('aria-label={satz}');
    expect(block).toContain('role="img"');
    // Der Satz kommt weiter aus formatExpiryDate -- er wird nicht mehr als
    // Kind des Badges gerendert.
    expect(block).not.toMatch(/>\s*\{formatExpiryDate\(invite\.expires_at\)\}\s*</);
    expect(block).toContain('const satz = formatExpiryDate(invite.expires_at);');
  });

  it('abgelaufen: rotes Warnzeichen ohne Zahl', () => {
    const block = badgeBlock(pfad, 'title={satz}');
    expect(block).toContain("abgelaufen ? 'var(--app-color-danger)' : letzterTag ? 'var(--app-color-warning)' : 'var(--app-color-success-strong)'");
    expect(block).toContain('const abgelaufen = resttage < 0;');
    expect(ICON_WARNHINWEIS_GEFUELLT).not.toBe(ICON_UHRZEIT);
  });

  // Simon, 26.09.2026: "0 irritiert muss besser." Am letzten Tag stand eine
  // "0" plus Uhr in der Ecke. Jetzt: Warnzeichen ohne Zahl, orange statt rot --
  // der Code gilt heute noch und laesst sich noch verlaengern.
  it('letzter Tag: oranges Warnzeichen ohne "0", der Satz sagt "Läuft heute ab"', () => {
    const block = badgeBlock(pfad, 'title={satz}');
    expect(block).toContain('const letzterTag = resttage === 0;');
    // Die Zahl erscheint nur bei echten Resttagen -- nie eine 0.
    expect(block).not.toContain('{!abgelaufen && resttage}');
    expect(block).toContain('{resttage > 0 && resttage}');
    // Der Satz aus formatExpiryDate: 0 Resttage -> "Läuft heute ab".
    const quelle = code(pfad);
    expect(quelle).toContain("if (diffDays === 0) return 'Läuft heute ab';");
    expect(quelle).toContain("if (diffDays < 0) return 'Abgelaufen';");
  });
});
