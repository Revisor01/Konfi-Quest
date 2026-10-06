// Zeitrahmen der gerenderten Tests von Start, Badges und Profil.
//
// Die Seiten laden ihre Daten asynchron (Abrufe der Attrappe, useWebDaten,
// Einladungen, Benachrichtigungen); die Tests warten mit findBy/waitFor. Mit
// den Vorgaben (eine Sekunde je Warten, fuenf je Test) scheitern sie, sobald der
// Rechner ausgelastet ist -- etwa wenn mehrere Suiten gleichzeitig laufen --,
// ohne dass etwas kaputt waere. Ein grosszuegigerer Rahmen macht aus dem Warten
// kein weicheres Pruefen: Jede Erwartung bleibt auf den konkreten Wert gestellt,
// nur das Zeitlimit bis dahin ist laenger.
import { vi } from 'vitest';
import { configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20000 });
