import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

test('renders without crashing', () => {
  const { baseElement } = render(<App />);
  // Die App-Huelle steht wirklich im DOM. `toBeDefined()` auf baseElement
  // war immer wahr -- der Test lebte nur davon, dass render() bei einem
  // Absturz wirft (Audit 26.09.2026, Tests BF-06).
  expect(baseElement.querySelector('ion-app')).not.toBeNull();
});
