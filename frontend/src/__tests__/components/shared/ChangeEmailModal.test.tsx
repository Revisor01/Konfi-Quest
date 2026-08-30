import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react';

// Verhaltens-Test fuer das geteilte E-Mail-Modal (nach der Vereinheitlichung
// der frueheren admin/- und konfi/-Kopien): Die Validierung muss den
// verbotenen Fall (ungueltige Adresse -> kein Request) und den erlaubten Fall
// (gueltige Adresse -> POST an /auth/update-email) sauber trennen.

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
vi.mock('../../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

const mockSetError = vi.fn();
const mockSetSuccess = vi.fn();
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({
    setSuccess: mockSetSuccess,
    setError: mockSetError,
    isOnline: true,
  }),
}));

vi.mock('../../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: <T,>(fn: () => Promise<T>) => fn() }),
}));

import ChangeEmailModal from '../../../components/shared/ChangeEmailModal';

const speichernButton = (container: HTMLElement) =>
  container.querySelector('[aria-label="E-Mail-Adresse speichern"]') as HTMLElement;

describe('ChangeEmailModal (geteilt)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // /auth/me schlaegt fehl -> Modal faellt auf initialEmail zurueck. So
    // steuern die Tests die Eingabe ohne fragile IonInput-Interaktion.
    mockApiGet.mockRejectedValue(new Error('offline'));
    mockApiPost.mockResolvedValue({ data: {} });
  });

  it('verbotener Fall: ungueltige Adresse wird abgelehnt, KEIN Request', async () => {
    const onSuccess = vi.fn();
    const { container } = render(
      <ChangeEmailModal onClose={() => {}} onSuccess={onSuccess} initialEmail="kein-at-zeichen" />
    );
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/auth/me'));

    fireEvent.click(speichernButton(container));

    await waitFor(() =>
      expect(mockSetError).toHaveBeenCalledWith('Ungültige E-Mail-Adresse')
    );
    expect(mockApiPost).toHaveBeenCalledTimes(0);
    expect(onSuccess).toHaveBeenCalledTimes(0);
  });

  it('erlaubter Fall: gueltige Adresse geht an /auth/update-email', async () => {
    const onSuccess = vi.fn();
    const { container } = render(
      <ChangeEmailModal onClose={() => {}} onSuccess={onSuccess} initialEmail="neu@example.de" />
    );
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/auth/me'));

    fireEvent.click(speichernButton(container));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/auth/update-email', { email: 'neu@example.de' })
    );
    expect(mockApiPost).toHaveBeenCalledTimes(1);
    expect(mockSetSuccess).toHaveBeenCalledWith('E-Mail-Adresse erfolgreich aktualisiert');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(mockSetError).toHaveBeenCalledTimes(0);
  });

  it('leere Adresse ist erlaubt und wird als null gespeichert', async () => {
    const onSuccess = vi.fn();
    const { container } = render(
      <ChangeEmailModal onClose={() => {}} onSuccess={onSuccess} initialEmail="" />
    );
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/auth/me'));

    fireEvent.click(speichernButton(container));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/auth/update-email', { email: null })
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
