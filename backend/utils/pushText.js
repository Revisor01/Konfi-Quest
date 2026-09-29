// Text einer Chat-Mitteilung.
//
// Frueher stand bei jedem Anhang nur "[Anhang]" — aus der Mitteilung war
// nicht zu erkennen, ob ein Foto, ein Video oder eine Datei wartet
// (Nutzerhinweis 31.08.2026). Der Nachrichtentyp liegt im Datensatz vor.
//
// Eine echte BILDVORSCHAU in der Mitteilung ist bewusst NICHT gebaut: Sie
// braucht auf iOS eine Notification Service Extension und auf Android eine
// BigPictureStyle-Notification, beides nativer Code. Zusaetzlich muesste das
// Bild ohne Anmeldung abrufbar sein — die Anhaenge liegen aber verschluesselt
// und hinter der Rechtepruefung. Das waere ein Loch, kein Feature.

/** Was ohne Begleittext in der Mitteilung steht. */
function anhangText(messageType, fileName) {
  const name = fileName ? `: ${fileName}` : '';
  switch (messageType) {
    case 'image': return 'Foto';
    case 'video': return `Video${name}`;
    case 'audio': return 'Sprachnachricht';
    case 'file':  return `Datei${name}`;
    case 'poll':  return 'Umfrage';
    default:      return 'Anhang';
  }
}

/** Was eine Chat-Mitteilung über die Art der Nachricht sagt — ohne ihren Inhalt. */
function chatArtText(messageType) {
  switch (messageType) {
    case 'image': return 'Neues Foto';
    case 'video': return 'Neues Video';
    case 'audio': return 'Neue Sprachnachricht';
    case 'file':  return 'Neue Datei';
    case 'poll':  return 'Neue Umfrage';
    default:      return 'Neue Nachricht';
  }
}

/**
 * Der Text einer Chat-Mitteilung: wer geschrieben hat und was für eine
 * Nachricht es ist, aber NICHT ihr Inhalt (Simon, 29.09.2026: „Absender, ohne
 * Inhalt"). Bis dahin stand hier der vollständige Nachrichtentext — er lag
 * damit bei Google (FCM) und auf iPhone und iPad bei Apple, und er war auf dem
 * Sperrbildschirm lesbar, auch aus Direktchats Minderjähriger mit der Leitung.
 * Dateinamen gehen aus demselben Grund nicht mehr mit. Nebenbei scheitern lange
 * Nachrichten nicht mehr an der 4-KB-Grenze eines FCM-Pakets.
 *
 * Im Direktchat steht der Name im Titel, der Text sagt nur die Art; in Gruppen
 * ist der Titel der Raumname, deshalb nennt der Text den Absender.
 * `content` und `fileName` werden bewusst nicht mehr gelesen.
 */
function chatPushText({ messageType, senderName, isDirectChat }) {
  const art = chatArtText(messageType);
  return isDirectChat ? art : `${art} von ${senderName}`;
}

module.exports = { anhangText, chatArtText, chatPushText };
