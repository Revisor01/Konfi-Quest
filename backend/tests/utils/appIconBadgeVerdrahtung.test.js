// backend/tests/utils/appIconBadgeVerdrahtung.test.js
//
// Befund B2b, zweite Haelfte: Die Summe zu BERECHNEN reicht nicht -- sie muss
// auch im Push ankommen. Genau dort sass der Fehler:
//
//   pushService.sendChatNotification setzte `notificationData.badge`, also
//   die CHAT-Zahl allein, die chat.js hereinreicht.
//   pushService.sendToUser setzte hart 1.
//
// Ein Test, der nur berechneAppIconSumme prueft, bleibt gruen, wenn die
// Verdrahtung zurueckfaellt -- beim Gegenproben aufgefallen. Deshalb liest
// dieser Test die Quelldatei: gerendert wird hier nichts, geprueft wird, dass
// beide Sendestellen die berechnete Zahl verwenden.
const { readFileSync } = require('fs');
const { resolve } = require('path');

const quelle = readFileSync(resolve(__dirname, '../../services/pushService.js'), 'utf8');

describe('Der Push-Weg verwendet die berechnete Summe (B2b)', () => {
  it('sendToUser setzt nicht mehr hart 1', () => {
    expect(quelle).not.toContain('badge: notification.badge || 1');
  });

  it('sendChatNotification setzt nicht mehr die Chat-Zahl allein', () => {
    // Das war der eigentliche Befund: Eine Chat-Nachricht ueberschrieb
    // Antraege, Termine, Freigaben und Abzeichen im Icon.
    expect(quelle).not.toContain('badge: notificationData.badge || 1');
  });

  it('beide Sendestellen nutzen einen berechneten Wert', () => {
    expect(quelle).toContain('badge: berechneterBadge != null ? berechneterBadge : 1');
    // Der Chat-Weg (seit 26.09.2026 sendChatNotificationToMany, Betrieb
    // BF-04) rechnet die Summe einmal fuer alle und reicht sie je Kopf als
    // vorberechneten Wert an sendToUser.
    const chatStelle = quelle.slice(
      quelle.indexOf('static async sendChatNotificationToMany('),
      quelle.indexOf('static async sendChatNotification(')
    );
    expect(chatStelle).toContain('await this.berechneBadgesFuerAlle(db, empfaenger)');
    expect(chatStelle).toContain('badges.get(userId)');
  });

  it('die Chat-Stelle ERSETZT den uebergebenen Wert, statt ihn zu bevorzugen', () => {
    // Wichtiger Unterschied zu sendToUser: Der von chat.js gereichte Wert ist
    // per Definition zu niedrig (nur Chat) und darf nicht gewinnen. Er gilt
    // nur als Rueckfall, wenn die Zaehlung fehlschlaegt.
    //
    // In sendToUser hat `notification.badge` Vorrang vor allem Berechneten.
    // Der Chat-Weg darf den gereichten Wert deshalb NICHT in die notification
    // schreiben -- nur als Rueckfall in `vorberechnet.badge`, wenn die Summe
    // fuer diese Person fehlt.
    const chatStelle = quelle.slice(
      quelle.indexOf('static async sendChatNotificationToMany('),
      quelle.indexOf('static async sendChatNotification(')
    );
    const notification = chatStelle.slice(
      chatStelle.indexOf('const notification = {'),
      chatStelle.indexOf('data: {')
    );
    expect(notification).not.toContain('badge');
    expect(chatStelle).toContain('badges.has(userId)');
    expect(chatStelle).toContain('notificationData.badge != null ? notificationData.badge : null');
  });

  it('sendToUser laesst einen ausdruecklich uebergebenen Wert gewinnen', () => {
    // Umgekehrt hier: Wer bewusst einen Badge mitgibt, meint ihn auch.
    const stelle = quelle.slice(
      quelle.indexOf('const berechneterBadge = notification.badge != null'),
      quelle.indexOf('badge: berechneterBadge != null')
    );
    expect(stelle).toContain('notification.badge != null');
    expect(stelle).toContain('await this.berechneBadge(db, userId)');
  });

  it('die Zaehlung ist fehlertolerant verdrahtet', () => {
    // Eine Push-Nachricht darf nicht daran scheitern, dass eine Zahl fehlt.
    expect(quelle).toContain('appIconSummeOderNull');
  });
});
