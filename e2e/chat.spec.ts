import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Chat', () => {
  test('Nachricht wird gesendet und beim Empfaenger angezeigt', async ({ browser }) => {
    const uniqueMsg = `E2E-Test-Nachricht ${Date.now()}`;

    // 1. Als konfi1 einloggen und Nachricht senden
    const konfiPage = await browser.newPage();
    await loginAs(konfiPage, 'konfi1');

    // 2. Zum Chat navigieren (Route: /konfi/chat)
    await konfiPage.goto('/konfi/chat');
    await konfiPage.waitForSelector('ion-content', { state: 'visible' });

    // 3. Jahrgangs-Chat oeffnen (Route: /konfi/chat/room/:roomId)
    const chatRoom = konfiPage.locator('ion-item, ion-card', { hasText: /Jahrgang 2025/i });
    await chatRoom.waitFor({ state: 'visible', timeout: 10_000 });
    await chatRoom.click();

    // 4. Nachricht eingeben — IonTextarea mit placeholder "Nachricht schreiben..."
    const textarea = konfiPage.locator('ion-textarea[placeholder="Nachricht schreiben..."]');
    await textarea.waitFor({ state: 'visible', timeout: 10_000 });
    // IonTextarea: Wert ueber native textarea setzen
    const nativeTextarea = textarea.locator('textarea');
    await nativeTextarea.fill(uniqueMsg);

    // 5. Sende-Button klicken (runder IonButton fill="solid" shape="round")
    const sendBtn = konfiPage.locator('ion-footer ion-button[shape="round"][fill="solid"]');
    await sendBtn.click();

    // 6. Nachricht erscheint im eigenen Chat
    await expect(
      konfiPage.locator('ion-content').locator('text=' + uniqueMsg)
    ).toBeVisible({ timeout: 10_000 });
    await konfiPage.close();

    // 7. Als admin1 einloggen und Nachricht pruefen
    const adminPage = await browser.newPage();
    await loginAs(adminPage, 'admin1');

    // 8. Zum selben Chat-Raum navigieren (Route: /admin/chat)
    await adminPage.goto('/admin/chat');
    await adminPage.waitForSelector('ion-content', { state: 'visible' });

    const adminChatRoom = adminPage.locator('ion-item, ion-card', { hasText: /Jahrgang 2025/i });
    await adminChatRoom.waitFor({ state: 'visible', timeout: 10_000 });
    await adminChatRoom.click();

    // 9. Gesendete Nachricht sichtbar beim Empfaenger
    await expect(
      adminPage.locator('ion-content').locator('text=' + uniqueMsg)
    ).toBeVisible({ timeout: 15_000 });
    await adminPage.close();
  });
});
