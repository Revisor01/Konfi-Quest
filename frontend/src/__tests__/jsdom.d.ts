// Typen für den direkten Einsatz von jsdom in Tests (handbuchNavigation).
//
// jsdom ist die Testumgebung von Vitest und liefert keine eigenen Typen;
// @types/jsdom steht nicht in den Abhängigkeiten. Beschrieben ist nur, was die
// Tests tatsächlich nutzen -- für die Typprüfung der Tests
// (`npm run typecheck:tests`, tsconfig.test.json).
declare module 'jsdom' {
  type JsdomFenster = Window & typeof globalThis;

  interface JsdomOptionen {
    url?: string;
    runScripts?: 'dangerously' | 'outside-only';
    pretendToBeVisual?: boolean;
    beforeParse?(fenster: JsdomFenster): void;
  }

  export class JSDOM {
    constructor(html?: string, optionen?: JsdomOptionen);
    readonly window: JsdomFenster;
  }
}
