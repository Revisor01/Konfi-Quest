import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UpdateHinweisKarte from '../../../components/shared/UpdateHinweisKarte';
import { NEUERUNGEN_VERSION } from '../../../hooks/useOnboardingOnce';

// Der Versionstext folgt NEUERUNGEN_VERSION ('2_3' -> '2.3'), statt die Zahl
// ein zweites Mal festzuschreiben: Bis 26.09.2026 stand hier '2.2' fest und
// fiel bei jedem Versionswechsel um, ohne einen echten Fehler zu zeigen.
const VERSION = NEUERUNGEN_VERSION.replace('_', '.');
const TITEL = `Was ist neu in Version ${VERSION}?`;
const KNOPF = `${TITEL} Die Neuerungen ansehen`;

describe('UpdateHinweisKarte', () => {
  const setup = () => {
    const onOpen = vi.fn();
    const onDismiss = vi.fn();
    render(<UpdateHinweisKarte onOpen={onOpen} onDismiss={onDismiss} />);
    return { onOpen, onDismiss };
  };

  it('zeigt Titel und Untertitel im "Was ist neu"-Look', () => {
    setup();
    expect(screen.getByText(TITEL)).toBeInTheDocument();
    expect(
      screen.getByText('Das Postfach unter der Glocke, selbst wählen was aufs Handy kommt, Dunkelmodus — hier tippen für den Überblick.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: KNOPF })
    ).toHaveClass('app-whatsnew');
  });

  it('Tippen auf die Karte öffnet den Walkthrough (onOpen), ohne auszublenden', () => {
    const { onOpen, onDismiss } = setup();
    fireEvent.click(
      screen.getByRole('button', { name: KNOPF })
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(0);
  });

  it('das X blendet aus (onDismiss), ohne den Walkthrough zu öffnen', () => {
    const { onOpen, onDismiss } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Hinweis ausblenden' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(0);
  });

  it('Enter auf der fokussierten Karte öffnet den Walkthrough', () => {
    const { onOpen } = setup();
    fireEvent.keyDown(
      screen.getByRole('button', { name: KNOPF }),
      { key: 'Enter' }
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
