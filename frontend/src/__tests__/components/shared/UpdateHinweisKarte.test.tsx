import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UpdateHinweisKarte from '../../../components/shared/UpdateHinweisKarte';

describe('UpdateHinweisKarte', () => {
  const setup = () => {
    const onOpen = vi.fn();
    const onDismiss = vi.fn();
    render(<UpdateHinweisKarte onOpen={onOpen} onDismiss={onDismiss} />);
    return { onOpen, onDismiss };
  };

  it('zeigt Titel und Untertitel im "Was ist neu"-Look', () => {
    setup();
    expect(screen.getByText('Was ist neu in Version 2.0?')).toBeInTheDocument();
    expect(
      screen.getByText('Challenges, der Mitmachen-Tab und mehr — hier tippen für den Überblick.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Was ist neu in Version 2.0? Die Neuerungen ansehen' })
    ).toHaveClass('app-whatsnew');
  });

  it('Tippen auf die Karte öffnet den Walkthrough (onOpen), ohne auszublenden', () => {
    const { onOpen, onDismiss } = setup();
    fireEvent.click(
      screen.getByRole('button', { name: 'Was ist neu in Version 2.0? Die Neuerungen ansehen' })
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
      screen.getByRole('button', { name: 'Was ist neu in Version 2.0? Die Neuerungen ansehen' }),
      { key: 'Enter' }
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
