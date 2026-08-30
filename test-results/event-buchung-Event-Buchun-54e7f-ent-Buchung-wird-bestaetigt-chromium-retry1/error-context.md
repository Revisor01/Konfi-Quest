# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: event-buchung.spec.ts >> Event-Buchung >> Konfi bucht Event, Buchung wird bestaetigt
- Location: e2e/event-buchung.spec.ts:5:7

# Error details

```
TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('ion-item, ion-card').filter({ hasText: /Weihnachtsgottesdienst/i }) to be visible

```

# Page snapshot

```yaml
- generic [ref=f1e5]:
  - generic [ref=f1e8]:
    - banner [ref=f1e9]:
      - generic [ref=f1e11]:
        - generic [ref=f1e12]: Events
        - generic "QR-Code scannen" [ref=f1e16]:
          - button "QR-Code scannen" [ref=f1e17] [cursor=pointer]
    - main [ref=f1e19]:
      - generic [ref=f1e22]:
        - generic [ref=f1e23]:
          - button "Erklärung anzeigen" [ref=f1e26] [cursor=pointer]
          - generic [ref=f1e39]:
            - heading "Deine Events" [level=2] [ref=f1e40]
            - paragraph [ref=f1e41]: Termine und Veranstaltungen
          - generic [ref=f1e42]:
            - generic [ref=f1e43]:
              - generic [ref=f1e44]: "0"
              - generic [ref=f1e45]: Gebucht
            - 'button "Anstehend: 0 anzeigen" [ref=f1e46] [cursor=pointer]':
              - generic [ref=f1e47]: "0"
              - generic [ref=f1e48]: Anstehend
            - generic [ref=f1e49]:
              - generic [ref=f1e50]: "0"
              - generic [ref=f1e51]: Vergangen
        - tablist [ref=f1e53]:
          - generic:
            - generic [ref=f1e54] [cursor=pointer]:
              - tab "Events" [selected]
            - generic [ref=f1e55] [cursor=pointer]:
              - tab "Aktivitäten"
        - list [ref=f1e56]:
          - generic [ref=f1e57]: Suche & Filter
          - group [ref=f1e65]:
            - listitem [ref=f1e66]:
              - textbox [ref=f1e78]:
                - /placeholder: Events durchsuchen...
        - tablist [ref=f1e80]:
          - generic:
            - generic [ref=f1e81] [cursor=pointer]:
              - tab "Alle"
            - generic [ref=f1e82] [cursor=pointer]:
              - tab "Meine" [selected]
            - generic [ref=f1e83] [cursor=pointer]:
              - tab "Konfi"
        - list [ref=f1e84]:
          - generic [ref=f1e85]: Events (0)
          - generic [ref=f1e105]:
            - heading "Keine Events gefunden" [level=3] [ref=f1e120]
            - paragraph [ref=f1e121]: Du bist noch für keine Events angemeldet
  - tablist [ref=f1e122]:
    - generic:
      - tab "Start" [ref=f1e124] [cursor=pointer]
      - tab "Chat" [ref=f1e133] [cursor=pointer]
      - tab "Challenges" [ref=f1e142] [cursor=pointer]
      - tab "Mitmachen" [selected] [ref=f1e150] [cursor=pointer]
      - tab "Badges" [ref=f1e158] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { loginAs } from './helpers/auth';
  3  | 
  4  | test.describe('Event-Buchung', () => {
  5  |   test('Konfi bucht Event, Buchung wird bestaetigt', async ({ page }) => {
  6  |     // 1. Als Konfi einloggen
  7  |     await loginAs(page, 'konfi1');
  8  | 
  9  |     // 2. Zur Event-Seite navigieren (Route: /konfi/events)
  10 |     await page.goto('/konfi/events');
  11 |     await page.waitForSelector('ion-content', { state: 'visible' });
  12 | 
  13 |     // 3. Weihnachtsgottesdienst finden und oeffnen (Route: /konfi/events/:id)
  14 |     const eventItem = page.locator('ion-item, ion-card', { hasText: /Weihnachtsgottesdienst/i });
> 15 |     await eventItem.waitFor({ state: 'visible', timeout: 10_000 });
     |                     ^ TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
  16 |     await eventItem.click();
  17 | 
  18 |     // 4. Event-Detailseite: Anmelden-Button klicken
  19 |     //    Button-Text: "Anmelden (X/50)" — app-action-button Klasse
  20 |     const registerBtn = page.locator('.app-action-button', { hasText: /Anmelden/i });
  21 |     await registerBtn.waitFor({ state: 'visible', timeout: 10_000 });
  22 |     await registerBtn.click();
  23 | 
  24 |     // 5. Buchungsbestaetigung prüfen
  25 |     //    Nach erfolgreicher Anmeldung ändert sich der Status auf der Seite
  26 |     //    Entweder Toast oder Button wechselt zu "Abmelden"
  27 |     await expect(
  28 |       page.locator('ion-button, ion-toast, .app-action-button', { hasText: /Abmelden|Gebucht|Angemeldet/i })
  29 |     ).toBeVisible({ timeout: 10_000 });
  30 | 
  31 |     // 6. Zurück zur Event-Liste — Event sichtbar
  32 |     await page.goto('/konfi/events');
  33 |     const eventEntry = page.locator('ion-item, ion-card', { hasText: /Weihnachtsgottesdienst/i });
  34 |     await expect(eventEntry).toBeVisible({ timeout: 10_000 });
  35 |   });
  36 | });
  37 | 
```