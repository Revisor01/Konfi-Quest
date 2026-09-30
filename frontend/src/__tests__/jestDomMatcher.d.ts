// Typen der jest-dom-Matcher (toBeInTheDocument, toHaveTextContent,
// toBeDisabled ...) für die Typprüfung der Tests (`npm run typecheck:tests`,
// tsconfig.test.json). Zur Laufzeit hängt src/setupTests.ts sie ein.
//
// Bis Vitest 4 kamen die Typen über den Namensraum `jest` an: jest-dom erweitert
// `jest.Matchers`, und Vitests Assertion erbte davon. Vitest 5 hat diesen
// Namensraum nicht mehr; die Assertion trägt zwei Typparameter
// (`Assertion<R, T>`) und erbt von `Matchers<R, T>`. Die Datei
// `@testing-library/jest-dom/vitest` erweitert noch `Assertion<T>` mit EINEM
// Parameter und passt deshalb nicht. Ohne diese Datei meldete die Typprüfung
// 204 Fehler, alle an jest-dom-Matchern.
//
// Erweitert wird `Matchers`, wie es die Vitest-Doku für eigene Matcher vorsieht
// („Extending Matchers"): R ist der Rückgabetyp der Prüfung, T der geprüfte Wert.
import 'vitest';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars -- Deklarationsverschmelzung: Name und Parameter müssen denen von Vitest gleichen.
  interface Matchers<R, T> extends TestingLibraryMatchers<unknown, R> {}
}
