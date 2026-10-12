// Die Texte der Detailseiten des Supports (seiten/supportDetail.ts;
// docs/planung/support-detailseiten.md): Stand-Sätze, Rückfragen zum Löschen
// und Ablehnen je EIN Text für App und Web, „Danach", Archiv-Satz der Mail,
// Menü und „Breit lesen". Wortlaut fest, damit beide Fassungen dasselbe sagen.
import { describe, it, expect } from 'vitest';
import { schluesselIn } from '../../seiten/beschreibung';
import {
  ABLEHNEN_RUECKFRAGE,
  AKTION_TEXT,
  BREIT_LESEN,
  DANACH_FEHLER,
  DANACH_WAHLEN,
  EINSORTIEREN_HINWEIS,
  LIZENZ_TEXT,
  LOESCHEN_RUECKFRAGE,
  MAIL_ARCHIV_SATZ,
  MAIL_MENUE,
  STAND_TEXT,
} from '../../seiten/supportDetail';

describe('Stand-Sätze: nur Tatsachen, kein Befehl', () => {
  it('je Fall der Stand-Regel', () => {
    expect(STAND_TEXT.angelegt('10.10.2026', 'a.beispiel')).toBe('Gemeinde angelegt am 10.10.2026. Benutzername der Gemeindeleitung: a.beispiel – Benutzername und Passwort getrennt weitergeben.');
    expect(STAND_TEXT.angelegt('10.10.2026', null)).toBe('Gemeinde angelegt am 10.10.2026.');
    expect(STAND_TEXT.abgelehnt('10.10.2026')).toBe('Anfrage abgelehnt am 10.10.2026. Sie wird nach 180 Tagen gelöscht; Wiederherstellen holt sie zurück.');
    expect(STAND_TEXT.erledigt('10.10.2026')).toBe('Erledigt am 10.10.2026. Eine neue Mail holt ihn zurück.');
    expect(STAND_TEXT.archiv('01.10.2026')).toBe('Im Archiv seit 01.10.2026. Eine neue Mail holt ihn zurück.');
    expect(STAND_TEXT.keinWeg('Kirchengemeinde Heide')).toBe('Niemand, dem sich antworten ließe: keine Gemeinde, kein Kontakt. Laut Formular: Kirchengemeinde Heide.');
    expect(STAND_TEXT.wartetAufUns('Test Org-Admin 1', 'heute, 12:23')).toBe('Test Org-Admin 1 wartet seit heute, 12:23 auf Antwort.');
    expect(STAND_TEXT.anlegenOderAblehnen('heute, 15:23')).toBe('Support hat heute, 15:23 geantwortet. Anlegen oder ablehnen?');
    expect(STAND_TEXT.wartetAuf('03.10., 09:00', 'Anna Beispiel', false)).toBe('Wartet seit 03.10., 09:00 auf Anna Beispiel.');
    expect(STAND_TEXT.wartetAuf('03.10., 09:00', 'Anna Beispiel', true)).toBe('Wartet seit 03.10., 09:00 auf Anna Beispiel – nachfassen?');
    expect(STAND_TEXT.geantwortet('Test Super-Admin', 'heute, 15:23')).toBe('Support (Test Super-Admin) hat heute, 15:23 geantwortet.');
    expect(STAND_TEXT.geantwortet(null, 'heute, 15:23')).toBe('Support hat heute, 15:23 geantwortet.');
    expect(STAND_TEXT.ohneNachricht('heute, 09:00', null)).toBe('Angelegt heute, 09:00, noch ohne Nachricht.');
  });
});

describe('Aktionen und Rückfragen', () => {
  it('jede Aktion des Stands hat Beschriftung und Tooltip', () => {
    expect(Object.keys(AKTION_TEXT).sort()).toEqual(
      ['ablehnen', 'antworten', 'erledigt', 'gemeinde_anlegen', 'gemeinde_oeffnen', 'gemeinde_zuordnen', 'lizenz_aendern', 'wiederherstellen'],
    );
    expect(AKTION_TEXT.ablehnen).toEqual({ label: 'Ablehnen', titel: 'Anfrage ablehnen' });
    expect(AKTION_TEXT.lizenz_aendern.label).toBe(LIZENZ_TEXT.aendern);
  });

  it('Löschen: ein Text, mit und ohne Anfrage', () => {
    expect(LOESCHEN_RUECKFRAGE('Chat zeigt nichts Neues', false)).toEqual({
      header: 'Vorgang löschen',
      message: '„Chat zeigt nichts Neues“ wird mit seinen Mails in Konfi Quest gelöscht. Im Postfach selbst bleibt alles stehen. Das lässt sich nicht rückgängig machen.',
    });
    expect(LOESCHEN_RUECKFRAGE('Anfrage: Musterdorf', true).message).toContain('in Konfi Quest und der Anfrage gelöscht.');
  });

  it('Ablehnen: nennt die Folge -- erledigt, archiviert, 180 Tage, keine Absage-Mail, Wiederherstellen', () => {
    expect(ABLEHNEN_RUECKFRAGE).toEqual({
      header: 'Anfrage ablehnen?',
      message: 'Der Vorgang wird erledigt und archiviert, die Anfrage gilt als abgelehnt und wird nach 180 Tagen gelöscht. Eine Absage-Mail geht dabei nicht hinaus. Wiederherstellen holt beides zurück.',
      knopf: 'Ablehnen',
    });
  });
});

describe('Danach, Mail, Rahmen', () => {
  it('„Danach": Wartet auf Rückmeldung · In Arbeit · Erledigt; der Fehler wird nie still', () => {
    expect(schluesselIn(DANACH_WAHLEN, 'web')).toEqual(['wartet', 'in_arbeit', 'erledigt']);
    expect(DANACH_WAHLEN.map((w) => w.label)).toEqual(['Wartet auf Rückmeldung', 'In Arbeit', 'Erledigt']);
    expect(DANACH_FEHLER).toBe('Gesendet, Status nicht gesetzt.');
  });

  it('Archiv-Satz der Mail ohne Widerspruch zum Einsortieren (Fehler vorab 6)', () => {
    expect(MAIL_ARCHIV_SATZ('02.10.2026')).toBe('Im Archiv seit 02.10.2026 · wird nach 180 Tagen gelöscht · Einsortieren holt sie zurück.');
    expect(MAIL_ARCHIV_SATZ('02.10.2026')).not.toMatch(/stelle sie wieder her/i);
  });

  it('Menü, Einsortieren und „Breit lesen"', () => {
    expect(MAIL_MENUE).toEqual({ verschieben: 'In anderen Vorgang verschieben', herausloesen: 'In neuen Vorgang herauslösen', kopfzeilen: 'Kopfzeilen zeigen' });
    expect(EINSORTIEREN_HINWEIS.allein).toBe('Nur diese Mail wird verschoben; der Rest des Vorgangs bleibt, wo er ist.');
    expect(BREIT_LESEN.zurueck('Alle Vorgänge')).toBe('Zurück zu „Alle Vorgänge“');
  });
});
