import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Die Datenschutzerklaerung beschreibt, was der Code tut (Paket F, 29.09.2026).
 *
 * Anlass (Audit 26.09.2026, Grundgeruest BF-13): 9b versprach, ein
 * Absturzbericht entstehe "ausschliesslich dann, wenn die App abstuerzt oder
 * einen Fehler abfaengt, der die Bedienung unterbricht -- nicht im laufenden
 * Betrieb". Der Code meldet aber jede unbehandelte Promise-Ablehnung und jeden
 * window-Fehler, auch im Hintergrund, bis zu 20 je Sitzung.
 *
 * Diese Tests binden die Zahlen im Text an die Stellen im Code, aus denen sie
 * stammen. Wer die Grenze im Code aendert, muss den Text mitziehen -- und
 * umgekehrt.
 */
const lies = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8');

/**
 * Sichtbarer Text der Seite, wie ein Browser ihn zeigt: per DOMParser (jsdom)
 * statt mit Regex-Ersetzungen -- die meldete CodeQL als unvollstaendige
 * HTML-Filterung (29.09.2026). Entitaeten loest der Parser selbst auf; Skripte
 * und Stile fallen weg, Leerraum wird vereinheitlicht.
 */
const seite = new DOMParser().parseFromString(lies('public/datenschutz.html'), 'text/html');
seite.querySelectorAll('script, style').forEach((el) => el.remove());
const text = (seite.body.textContent ?? '').replace(/\s+/g, ' ');

/** Numerische Konstante aus einer Quelldatei lesen. */
function konstante(datei: string, name: string): number {
  const m = lies(datei).match(new RegExp(`const ${name} = (\\d+);`));
  if (!m) throw new Error(`${name} fehlt in ${datei}`);
  return Number(m[1]);
}

describe('4.3 Geraete-Kennung: der Text folgt dem Code', () => {
  /*
   * Bis 29.09.2026 stand dort nur "Geraetetyp und Betriebssystem" und
   * "Push-Notification-Token". Die Kennung, die die App bei Anmeldung,
   * Registrierung und jedem Refresh schickt und die der Server zu Anmeldung
   * (Spalte refresh_tokens.device_id, seit Migration 171 im Grundschema) und Push-Token speichert, kam nicht vor -- dafuer ein
   * Geraetemodell, das der Server gar nicht speichert.
   */
  const backend = (p: string) => readFileSync(join(process.cwd(), '..', 'backend', p), 'utf8');

  it('nennt die Geraete-Kennung und wofuer sie gespeichert wird', () => {
    expect(lies('src/services/geraeteKennung.ts')).toMatch(/Device\.getId\(\)/);
    expect(readFileSync(join(process.cwd(), '..', 'init-scripts', '01-create-schema.sql'), 'utf8'))
      .toMatch(/CREATE TABLE public\.refresh_tokens \([^;]*\bdevice_id text\b/);
    expect(text).toContain('Geräte-Kennung:');
    expect(text).toContain('Wir speichern sie zu Ihrer Anmeldung, damit diese nur auf dem Gerät gilt');
  });

  it('behauptet kein gespeichertes Geraetemodell', () => {
    // Das Backend kennt nur die Plattform (push_tokens.platform).
    expect(text).not.toContain('Gerätetyp und Betriebssystem');
    expect(text).toContain('Gerätemodell und Betriebssystemfassung speichern wir nicht');
  });

  it('nennt die Fristen aus dem Code', () => {
    // Anmeldung: Refresh-Token 90 Tage, rotiert bei jeder Nutzung
    expect(backend('routes/auth.js')).toMatch(/Date\.now\(\) \+ 90 \* 24 \* 60 \* 60 \* 1000/);
    expect(text).toContain('nach 90 Tagen ohne Nutzung');
    // Push-Token: 30 Tage ohne Aktualisierung
    expect(backend('services/backgroundService.js')).toContain("updated_at < NOW() - INTERVAL '30 days'");
    expect(text).toContain('30 Tage lang weder die App geöffnet noch eine Benachrichtigung erhalten hat');
  });

  it('nennt, was davon im Server-Protokoll steht', () => {
    const route = backend('routes/notifications.js');
    expect(route).toContain(".slice(0, 12)");
    expect(route).toContain(".slice(-6)");
    expect(text).toContain('höchstens die ersten 12 Zeichen der Geräte-Kennung und die letzten 6 Zeichen des Push-Tokens');
  });
});

describe('9 Push: was in einer Benachrichtigung steht', () => {
  /*
   * Audit 26.09.2026, Sicherheit, Abschnitt "Unklar": Chat-Pushes tragen den
   * Nachrichtentext als notification.body (utils/pushText.js, chatPushText),
   * er liegt damit bei Google (FCM) und auf Apple-Geraeten bei Apple (APNs).
   * Die Erklaerung sagte nur "Inhalt der Benachrichtigung (z. B. Titel und
   * Text)". Seit Simons Entscheidung vom 29.09.2026 gehen nur Absender und Art
   * mit. Wer den Push-Inhalt aendert, muss hier und im Text nachziehen.
   */
  const backend = (p: string) => readFileSync(join(process.cwd(), '..', 'backend', p), 'utf8');

  it('sagt, dass der Nachrichtentext NICHT mitgeht -- und der Code schickt ihn nicht', () => {
    // Simon, 29.09.2026: "Absender, ohne Inhalt". chatPushText liest weder
    // content noch fileName; die Route reicht sie auch nicht mehr hinein.
    const pushText = backend('utils/pushText.js');
    expect(pushText).toMatch(/function chatPushText\(\{ messageType, senderName, isDirectChat \}\)/);
    const chat = backend('routes/chat.js');
    expect(chat).toMatch(/body: chatPushText\(/);
    expect(chat).not.toMatch(/\[Umfrage\] \$\{question\}/);
    expect(text).not.toContain('vollständige Text der Nachricht');
    expect(text).not.toContain('samt ihrem Text');
    expect(text).toMatch(/nicht ihr Text\s*, keine Dateinamen und nicht die Frage einer Umfrage/);
    expect(text).toMatch(/ohne ihren Text\s*, ohne Dateinamen/);
  });

  it('nennt Apple als Zustellweg auf iPhone und iPad', () => {
    expect(backend('push/firebase.js')).toMatch(/apns: \{/);
    expect(text).toContain('über den Apple Push Notification Service zu; dabei erhält auch Apple den Inhalt');
  });
});

describe('9b Absturzberichte: der Text folgt dem Code', () => {
  const DIAGNOSE = 'src/services/absturzdiagnose.ts';

  it('verspricht nicht mehr "nur bei Absturz, nicht im laufenden Betrieb"', () => {
    expect(text).not.toContain('nicht im laufenden Betrieb');
    expect(text).not.toContain('ausschließlich dann erzeugt');
  });

  it('nennt die abgefangenen Fehler im Hintergrund', () => {
    // globaleFehlerkanaeleAnhaengen meldet unhandledrejection und window-error
    expect(lies(DIAGNOSE)).toMatch(/addEventListener\('unhandledrejection'/);
    expect(text).toContain('auch einen, der im Hintergrund auftritt und die Bedienung nicht unterbricht');
  });

  it('nennt die Obergrenze je App-Lauf aus dem Code', () => {
    const max = konstante(DIAGNOSE, 'MELDUNGEN_JE_SITZUNG_MAX');
    expect(max).toBe(20);
    expect(text).toContain(`insgesamt höchstens ${max} Berichte, bis sie neu gestartet wird`);
  });

  it('nennt die Kuerzung der Fehlermeldung aus dem Code', () => {
    const zeichen = konstante(DIAGNOSE, 'MELDUNG_MAX_ZEICHEN');
    expect(zeichen).toBe(200);
    expect(text).toContain(`die Fehlermeldung (auf ${zeichen} Zeichen gekürzt)`);
  });

  it('nennt den Schalter unter dem Namen, den die App zeigt (Sicherheit BF-22)', () => {
    const titel = lies('src/components/shared/AbsturzberichteSchalter.tsx')
      .match(/app-list-item__title">([^<]+)</)?.[1];
    expect(titel).toBe('Absturzberichte senden');
    expect(text).toContain(`der Schalter „${titel}“`);
    // und das Handbuch unter demselben Namen
    expect(readFileSync(join(process.cwd(), '../docs/handbuch/03-bedienung.md'), 'utf8'))
      .toContain(`**„${titel}"**`);
  });

  it('sagt, dass das Abschalten nativ erst mit dem naechsten Start ganz greift', () => {
    // absturzdiagnose.ts: setEnabled wirkt erst beim naechsten Start; bis
    // dahin verwirft deleteUnsentReports / diagnoseStarten. Der Text darf
    // nicht "sofort, vollstaendig" versprechen.
    expect(lies(DIAGNOSE)).toMatch(/deleteUnsentReports\(\)/);
    expect(text).toContain('Das Sammeln durch den Dienst selbst endet mit dem nächsten Start der App');
  });
});

describe('9c Anfrageformular: der Text folgt dem Code', () => {
  /*
   * POST /api/anfragen (backend/routes/anfragen.js, 03.10.2026): Was das
   * Formular auf konfi-quest.de speichert, welche Mails hinausgehen und wie
   * lange eine Anfrage bleibt. Wer ein Feld, eine Frist oder den Inhalt einer
   * Mail aendert, muss Abschnitt 9c mitziehen -- und umgekehrt.
   */
  const backend = (p: string) => readFileSync(join(process.cwd(), '..', 'backend', p), 'utf8');
  const route = backend('routes/anfragen.js');

  // Je gespeichertem Feld die Worte, unter denen der Text es nennt.
  const BEZEICHNUNG: Record<string, string> = {
    gemeinde: 'Name der Gemeinde',
    kirchenkreis: 'Kirchenkreis',
    landeskirche: 'Landeskirche',
    kontakt_name: 'Name der verantwortlichen Person',
    funktion: 'ihre Funktion',
    email: 'E-Mail-Adresse',
    mobil: 'Mobilnummer',
    anzahl_konfis: 'ungefähre Zahl der Konfis',
    anzahl_teamer: 'der Teamer:innen',
    nachricht: 'eine Nachricht',
  };

  it('nennt jedes Feld, das die Route speichert -- und kein anderes', () => {
    const block = route.match(/const FELDER = \{([\s\S]*?)\};/)?.[1] ?? '';
    const felder = [...block.matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]);
    expect(felder).toEqual(Object.keys(BEZEICHNUNG));
    for (const wort of Object.values(BEZEICHNUNG)) expect(text).toContain(wort);
    // Dazu der Zeitpunkt der Einwilligung (Spalte einwilligung_am).
    expect(route).toContain('einwilligung_am');
    expect(text).toContain('den Zeitpunkt Ihrer Einwilligung');
  });

  it('nennt die Pflichtfelder aus dem Code', () => {
    expect(route).toContain("const PFLICHT = ['gemeinde', 'kontakt_name', 'email'];");
    expect(text).toContain('Pflicht sind nur Gemeinde, Name und E-Mail-Adresse');
  });

  it('die Bestätigung trägt keine Angaben, der Hinweis ans Support-Team keine Kontaktdaten', () => {
    const mail = backend('services/emailService.js');
    // Die Bestaetigung bekommt nur die Adresse, nichts aus dem Formular.
    expect(mail).toMatch(/const sendAnfrageBestaetigungEmail = async \(email, \{ protokoll \}\) =>/);
    expect(text).toContain('eine Bestätigung mit festem Text — ohne Ihre Angaben');
    // Der Hinweis liest aus der Anfrage nur id, gemeinde, kirchenkreis, landeskirche.
    const hinweis = mail.slice(mail.indexOf('const sendAnfrageHinweisEmail'), mail.indexOf('module.exports'));
    const gelesen = [...new Set([...hinweis.matchAll(/anfrage\.([a-z_]+)/g)].map((m) => m[1]))].sort();
    expect(gelesen).toEqual(['gemeinde', 'id', 'kirchenkreis', 'landeskirche']);
    expect(text).toContain('der nur Gemeinde, Kirchenkreis und Landeskirche nennt, nicht Ihre Kontaktdaten und nicht Ihre Nachricht');
  });

  it('nennt die Zähler gegen Missbrauch aus dem Code', () => {
    expect(route).toContain('windowMs: 60 * 60 * 1000,');
    expect(route).toContain('windowMs: 24 * 60 * 60 * 1000,');
    expect(route).toMatch(/createHash\('sha256'\)/);
    expect(text).toContain('je IP-Adresse eine Stunde lang und je E-Mail-Adresse einen Tag lang; für die E-Mail-Adresse speichern wir dabei nur einen Prüfwert');
    // Abgelaufene Zaehler raeumt der Store eine Stunde nach Ablauf weg, alle zehn Minuten.
    const store = backend('utils/rateLimitStore.js');
    expect(store).toContain("ablauf < NOW() - interval '1 hour'");
    expect(store).toContain('const AUFRAEUM_INTERVALL_MS = 10 * 60 * 1000;');
    expect(text).toContain('Danach löscht der Server den Zähler binnen gut einer Stunde');
  });

  it('nennt die Fristen aus dem Code', () => {
    const tage = Number(backend('services/backgroundService.js').match(/const ABGELEHNTE_ANFRAGEN_TAGE = (\d+);/)?.[1]);
    expect(tage).toBe(180);
    expect(text).toContain(`Eine abgelehnte Anfrage löschen wir automatisch ${tage} Tage nach der Ablehnung`);
    // Mit der Gemeinde geht ihre Anfrage (DELETE /organizations/:id).
    expect(backend('routes/organizations.js')).toContain('DELETE FROM gemeinde_anfragen WHERE organization_id = $1');
    expect(text).toContain('bleibt sie gespeichert, solange die Gemeinde besteht, und wird mit ihr gelöscht');
  });
});
