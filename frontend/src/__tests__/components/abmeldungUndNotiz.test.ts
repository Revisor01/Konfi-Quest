import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Simons Fall (12.09.2026): Eine Mutter meldet ihre Tochter telefonisch ab,
// wegen Krankheit — nicht in der App. In der Anwesenheitsliste gab es nur
// "anwesend" (falsch) und "abwesend" (richtig, sieht aber aus wie
// unentschuldigtes Fehlen). Der Grund ging verloren, und die Kolleginnen sahen
// nicht, dass abgemeldet wurde.
//
// Zweiter Fall: Eine Konfirmandin bittet, schon um 14 Uhr zu gehen. Sie war
// da, bekommt ihre Punkte, ist ANWESEND — die Notiz soll trotzdem stehen.
//
// Zwei getrennte Felder (Entscheidung Simon): Ein gemeinsames haette je nach
// Status eine andere Bedeutung, und beide koennen nebeneinander stehen.
//
// "Vermerk" heisst seit dem 13.09.2026 ueberall NOTIZ (Simon: "nennen wir es
// lieber insgesamt Notiz."). Die Spalte attendance_note bleibt, wie sie
// heisst — sie trug den Namen ohnehin schon.
//
// Dieser Test liest die Quelldateien, statt die Ansicht zu rendern: Die
// Sichtbarkeit haengt an mehreren geladenen Datenstaenden (Teilnehmer, Rollen,
// Anwesenheitsstatus) — sie zu mocken fuehrte mehr Annahmen ein, als der Test
// absichert. Geprueft wird die Verdrahtung.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const detail = lies('src/components/admin/views/EventDetailView.tsx');
const abschnitte = lies('src/components/admin/views/EventDetailSections.tsx');
const matrixModal = lies('src/components/admin/modals/AttendanceMatrixModal.tsx');
const css = lies('src/theme/variables.css');
const typen = lies('src/types/event.ts');
const notizModal = lies('src/components/admin/modals/AnwesenheitNotizModal.tsx');
const abmeldungModal = lies('src/components/admin/modals/AbmeldungNachtragenModal.tsx');
// Seit dem 15.09.2026 stehen Text und Farbe einer Teilnehmerzeile EINMAL
// hier statt zweimal in den beiden Listen (Befund "abgesagte Termine sehen
// ueberall gleich aus"). Die Erwartungen unten sind deshalb von den
// handgeschriebenen Ternaeren auf diese Datei umgezogen -- geprueft wird
// dieselbe Regel, nur an der Stelle, an der sie jetzt steht.
const teilnahme = lies('src/utils/teilnahmeStatus.ts');
const handbuch = lies('../docs/handbuch/70-termine.md');

describe('Abmeldung nachtragen (excused)', () => {
  it('der Handler kennt den dritten Status', () => {
    expect(detail).toMatch(/status:\s*'present'\s*\|\s*'absent'\s*\|\s*'excused'/);
  });

  it('das Auswahlmenue bietet "Abgemeldet" an', () => {
    expect(detail).toContain("showAbmeldungModal(participant)");
    expect(detail).toContain("'Abmeldung bearbeiten' : 'Abgemeldet'");
  });

  it('der Grund wird als eigenes Feld erfragt und geschickt', () => {
    expect(abmeldungModal).toContain('value={grundText}');
    expect(detail).toContain('excuse_reason: neuerGrund');
    expect(detail).toContain('excuse_reason: texte.excuse_reason');
  });

  it('der Grund wird nur bei excused gesetzt', () => {
    // Sonst bliebe "krank" an einer Buchung stehen, die inzwischen auf
    // anwesend steht.
    expect(detail).toContain("const grund = status === 'excused' ? (texte?.excuse_reason || null) : null;");
  });

  it('die Zeile wird grau, nicht rot', () => {
    // Rot hiesse "hat gefehlt" — die Abmeldung war gemeldet.
    // Die Farbe kommt jetzt aus teilnahmeDarstellung(); beide Listen lesen
    // sie dort ab, statt sie je fuer sich zu bilden.
    expect(teilnahme).toContain("statusText: 'Abgemeldet (nachgetragen)', farbe: 'neutral'");
    expect(detail).toContain('listItemKlasse(darstellung)');
    expect(detail).toContain('iconKreisKlasse(darstellung)');
    expect(detail).toContain('eckBadgeKlasse(darstellung)');
  });

  it('die grauen Klassen sind im CSS definiert', () => {
    expect(css).toContain('.app-list-item--neutral, ion-item.app-list-item--neutral { border-left-color: var(--app-color-neutral); }');
    expect(css).toContain('.app-corner-badge--neutral { background-color: var(--app-color-neutral); }');
    expect(css).toContain('.app-icon-circle--neutral { background-color: var(--app-color-neutral); }');
  });

  it('die Selbstabmeldung bleibt rot — sie wird nicht mit umgefaerbt', () => {
    // Gegenprobe: Der Umbau darf den funktionierenden Fall nicht mitnehmen.
    expect(teilnahme).toContain("statusText: 'Abgemeldet', farbe: 'danger'");
  });

  it('der Grund steht in der Teilnehmerliste, nicht nur im Menue', () => {
    // "Damit das auch die Kolleginnen sehen."
    expect(detail).toContain('{isExcused && participant.excuse_reason && (');
    expect(abschnitte).toContain('{istAbgemeldet && participant.excuse_reason && (');
    // Und seit dem 15.09.2026 auch der Grund einer SELBSTabmeldung -- die
    // Zeile wurde dort vorher gar nicht erst angezeigt.
    expect(abschnitte).toContain('participant.opt_out_reason');
  });

  it('der Zeitfenster-Abschnitt faerbt ebenfalls grau', () => {
    // Seit dem 15.09.2026 aus derselben Quelle wie die Liste ohne
    // Zeitfenster -- vorher rechnete er es noch einmal selbst und kannte
    // dabei nur vier der sechs Zustaende.
    expect(abschnitte).toContain('teilnahmeDarstellung(participant)');
    expect(abschnitte).toContain('listItemKlasse(darstellung)');
  });
});

describe('Notiz (unabhaengig vom Status)', () => {
  it('wird bei JEDEM gesetzten Status angeboten, nicht nur bei excused', () => {
    expect(detail).toContain('if (participant.attendance_status) {');
    expect(detail).toContain("'Notiz bearbeiten' : 'Notiz hinzufügen'");
  });

  it('ist ein eigenes Feld, getrennt vom Grund', () => {
    // Der Grund wird beim Abmelden erfragt, die Notiz im eigenen Modal —
    // und die Ansicht schickt beide als eigene Felder mit.
    expect(detail).toContain('excuse_reason: neuerGrund');
    expect(detail).toContain('attendance_note: neueNotiz');
  });

  it('behaelt den Grund, wenn nur die Notiz geaendert wird', () => {
    // Die Route setzt excuse_reason bei jedem 'excused'-Schreiben neu —
    // ohne Mitschicken waere er nach dem Speichern der Notiz weg.
    expect(detail).toContain("? { excuse_reason: teilnehmer.excuse_reason || '' }");
  });

  it('steht in der Teilnehmerliste bei jedem Status', () => {
    // Nicht an isExcused gebunden: "ging um 14 Uhr" gilt bei Anwesenheit.
    expect(detail).toContain('{participant.attendance_note && (');
    expect(abschnitte).toContain('{participant.attendance_note && (');
  });

  it('heisst in der Oberflaeche ueberall "Notiz", nicht mehr "Vermerk"', () => {
    // Simon: "nennen wir es lieber insgesamt Notiz." Geprueft werden die
    // sichtbaren Texte — Kommentare mit Simons woertlichem Zitat bleiben.
    expect(detail).toContain('<strong>Notiz: </strong>');
    expect(abschnitte).toContain('<strong>Notiz: </strong>');
    expect(detail).not.toContain('<strong>Vermerk: </strong>');
    expect(abschnitte).not.toContain('<strong>Vermerk: </strong>');
    expect(abmeldungModal).toContain('label="Notiz (optional)"');
  });
});

// Simon, 13.09.2026: Die Notiz wurde zum Modal, die Abmeldung blieb ein Alert
// stehen — inkonsequent, denn dieselbe Begruendung traegt bei beiden. Mit zwei
// Textfeldern (Grund UND Notiz) erst recht.
describe('Die Abmeldung nachtragen ist ein Modal', () => {
  it('es gibt ein eigenes Modal, das ueber useIonModal geoeffnet wird', () => {
    expect(detail).toContain("import AbmeldungNachtragenModal from '../modals/AbmeldungNachtragenModal';");
    expect(detail).toContain('useIonModal(AbmeldungNachtragenModal, {');
    expect(detail).toContain('presentAbmeldungModal({');
  });

  it('der Alert fuer die Abmeldung ist weg', () => {
    // Gegenprobe: Bleibt der alte Weg daneben stehen, gibt es zwei Wahrheiten
    // darueber, wie eine Abmeldung nachgetragen wird.
    expect(detail).not.toContain('showAbmeldungAlert');
    expect(detail).not.toContain("subHeader: 'Abmeldung nachtragen'");
  });

  it('das Modal folgt dem Muster der anderen Modals', () => {
    expect(abmeldungModal).toContain('<IonPage>');
    expect(abmeldungModal).toContain('app-modal-close-btn');
    expect(abmeldungModal).toContain('app-modal-submit-btn');
    expect(abmeldungModal).toContain('useActionGuard');
  });

  it('es hat BEIDE Felder: Grund und Notiz', () => {
    expect(abmeldungModal).toContain('label="Grund"');
    expect(abmeldungModal).toContain('label="Notiz (optional)"');
    const textfelder = abmeldungModal.match(/<IonTextarea/g) || [];
    expect(textfelder.length).toBe(2);
  });

  it('beide Felder gehen zusammen an den Handler', () => {
    expect(abmeldungModal).toContain('await onSave(grundText.trim(), notizText.trim());');
    expect(detail).toContain("await handleAttendanceUpdate(teilnehmer, 'excused', {");
  });
});

// Der zweite Satz des alten Alert-Hinweises war seit der Umstellung auf den
// Abmelde-Push schlicht falsch.
describe('Der Hinweis im Abmeldungs-Modal ist kurz und richtig', () => {
  it('die alte Zusage "erfährt davon nichts" steht nirgends mehr', () => {
    // Gegenprobe zum Push: Die Konfi bekommt sehr wohl eine Mitteilung.
    expect(detail).not.toContain('Sie erfährt davon nichts');
    expect(abmeldungModal).not.toContain('erfährt davon nichts');
    expect(handbuch).not.toContain('erfährt davon nichts');
  });

  it('stattdessen steht die tatsaechliche Folge da', () => {
    expect(abmeldungModal).toContain('Die Konfi bekommt eine Mitteilung, dass die Abmeldung eingetragen wurde.');
  });

  it('der Erklaertext bleibt im Handbuch, nicht in der Oberflaeche', () => {
    // Simons Regel von der Notiz. Ein Satz zur Folge darf stehen, der
    // Vergleich mit der Selbstabmeldung gehoert ins Handbuch.
    expect(abmeldungModal).not.toContain('Abgemeldet (nachgetragen)');
    expect(handbuch).toContain('### Eine Abmeldung nachtragen');
    expect(handbuch).toContain('Abgemeldet (nachgetragen)');
  });
});

// Simon, 13.09.2026: "Der löschen Button hat keine ordentliche Stil. Nichts.
// Was soll das. Schau dir andere an nutze globale css und dann fertig."
describe('Gefahren-Knoepfe nutzen eine globale Klasse', () => {
  it('die Klasse ist in der globalen CSS definiert, mit Tokens', () => {
    expect(css).toContain('.app-gefahr-knopf {');
    expect(css).toContain('height: var(--app-abstand-block);');
    expect(css).toContain('--border-radius: var(--app-radius-karte);');
    expect(css).toContain('font-weight: var(--app-schrift-halbfett);');
  });

  it('der Loeschen-Knopf im Notiz-Modal benutzt sie', () => {
    expect(notizModal).toContain('className="app-gefahr-knopf"');
    // Gegenprobe: Der blasse Textknopf war genau das Problem.
    expect(notizModal).not.toContain('fill="clear"');
  });

  it('die Profile schreiben das Aussehen nicht mehr selbst ab', () => {
    const konfiProfil = lies('src/components/konfi/views/ProfileView.tsx');
    const teamerProfil = lies('src/components/teamer/pages/TeamerProfilePage.tsx');
    for (const datei of [konfiProfil, teamerProfil]) {
      // Jeder rot umrandete Knopf traegt die Klasse — und keiner schreibt
      // das Aussehen daneben noch einmal selbst hin. Die Hoehe stand vier
      // Mal als rohe 48px im Code, die Rundung ebenso oft.
      const knoepfe = datei.match(/<IonButton[\s\S]*?>/g) || [];
      const gefahrKnoepfe = knoepfe.filter(k => k.includes('color="danger"'));
      expect(gefahrKnoepfe.length).toBeGreaterThanOrEqual(2);
      for (const knopf of gefahrKnoepfe) {
        expect(knopf).toContain('className="app-gefahr-knopf"');
        expect(knopf).not.toContain("height: '48px'");
        expect(knopf).not.toContain("borderRadius:");
        expect(knopf).not.toContain('fontWeight:');
      }
    }
  });
});

// Simon in TestFlight (13.09.2026): "Die Frage ist ob es nicht ein Modal sein
// müsste in unseren Logiken. Ich glaube schon." — Die Notiz lief bis dahin
// ueber useIonAlert und fiel damit aus dem Muster: Der Absagegrund der Konfi
// laeuft ueber UnregisterModal, alle Texteingaben der Leitung sind Modals.
describe('Die Notiz-Eingabe ist ein Modal', () => {
  it('es gibt ein eigenes Modal, das ueber useIonModal geoeffnet wird', () => {
    expect(detail).toContain("import AnwesenheitNotizModal from '../modals/AnwesenheitNotizModal';");
    expect(detail).toContain('useIonModal(AnwesenheitNotizModal, {');
    expect(detail).toContain('presentNotizModal({');
  });

  it('der Alert fuer die Notiz ist weg', () => {
    // Gegenprobe: Bleibt der alte Weg daneben stehen, gibt es zwei
    // Wahrheiten darueber, wie eine Notiz erfasst wird.
    expect(detail).not.toContain('showVermerkAlert');
    expect(detail).not.toContain("subHeader: 'Vermerk'");
  });

  it('das Modal folgt dem Muster der anderen Modals', () => {
    // Wie UnregisterModal und BonusModal: IonPage mit Kopfzeile,
    // Schliessen-Knopf links, Speichern rechts.
    expect(notizModal).toContain('<IonPage>');
    expect(notizModal).toContain('app-modal-close-btn');
    expect(notizModal).toContain('app-modal-submit-btn');
    expect(notizModal).toContain('<IonTextarea');
  });

  it('der erklaerende Hinweistext steht NICHT mehr in der Oberflaeche', () => {
    // Simon: "Den Hinweis bei Notiz nicht ins Sheet sondern ins Handbuch."
    expect(detail).not.toContain('Ein freier Vermerk zur Anwesenheit');
    expect(notizModal).not.toContain('Am Status ändert er nichts');
  });

  it('das Handbuch erklaert die Notiz stattdessen', () => {
    expect(handbuch).toContain('## Die Anwesenheit verbuchen');
    expect(handbuch).toContain('Eine Notiz hinzufügen');
  });
});

// Simon: "Außerdem Vermerk löschen". Setzen und Aendern ging, Entfernen
// nicht.
describe('Eine Notiz laesst sich loeschen', () => {
  it('das Modal hat einen Loeschen-Knopf', () => {
    expect(notizModal).toContain('Notiz löschen');
    expect(notizModal).toContain('color="danger"');
  });

  it('der Knopf erscheint nur, wenn es etwas zu loeschen gibt', () => {
    // An einer leeren Notiz waere er ohne Wirkung.
    expect(notizModal).toContain('{hatBestehendeNotiz && (');
  });

  it('geloescht wird mit einem leeren String, nicht mit einem zweiten Feld', () => {
    // Ein Flag neben dem Textfeld liesse den Widerspruch zu, Text UND
    // Loeschwunsch gleichzeitig zu schicken.
    expect(notizModal).toContain("await onSave('');");
    expect(notizModal).not.toContain('loeschen: true');
  });

  it('ein leeres Feld wird beim Speichern ebenfalls als Loeschen gewertet', () => {
    expect(notizModal).toContain('const darfSpeichern = hatAenderung && (getrimmt.length > 0 || hatBestehendeNotiz);');
  });

  it('die Ansicht schickt den leeren Wert weiter, statt ihn wegzufiltern', () => {
    // Gegenprobe zum Alt-App-Vertrag: Die Unterscheidung "Feld fehlt" gegen
    // "Feld ist leer" traegt das Loeschen. Ein `|| undefined` haette sie
    // eingeebnet — dann bliebe die Notiz stehen.
    expect(detail).toContain('const notizMitgeschickt = texte?.attendance_note !== undefined;');
    expect(detail).toContain('...(notizMitgeschickt ? { attendance_note: texte!.attendance_note } : {})');
  });
});

describe('Typen tragen die neuen Felder', () => {
  it('attendance_status kennt excused', () => {
    expect(typen).toMatch(/attendance_status\?:\s*'present'\s*\|\s*'absent'\s*\|\s*'excused'\s*\|\s*null/);
  });

  it('excuse_reason und attendance_note sind deklariert', () => {
    expect(typen).toContain('excuse_reason?: string | null;');
    expect(typen).toContain('attendance_note?: string | null;');
  });
});

// Simon in TestFlight (13.09.2026): "wenn die sich selbst abgemeldet haben
// kann ich deren Status nicht ändern. Kein Action Sheet." Auf Rueckfrage:
// "Ich als Admin will eine Selbstabmeldung bearbeiten können. Doch anwesend.
// Vermerk etc."
//
// Die Sperre sass allein im Frontend: Das Backend prueft den Buchungsstatus
// gar nicht und haette die Anwesenheit auch bei 'opted_out' gesetzt.
describe('Selbstabmeldung bearbeiten', () => {
  it('der Tipp oeffnet auch bei opted_out das Anwesenheits-Menue', () => {
    expect(detail).toContain("participant.status === 'opted_out'");
    expect(detail).toContain("showAttendanceActionSheet(participant);");
  });

  // ERWEITERT 15.09.2026 (Migration 153): Seit die von der Leitung
  // eingetragene Abmeldung auch den BUCHUNGSSTATUS auf 'excused' setzt, faellt
  // genau die Person aus der Bedingung, die man am haeufigsten noch einmal
  // anfassen will -- "doch da, war nur zu spaet". Ohne den Wert passiert auf
  // den Tipp wieder gar nichts: derselbe Fehler wie am 13.09., nur mit einem
  // anderen Status.
  it('der Tipp oeffnet es AUCH bei excused', () => {
    expect(detail).toContain("if (participant.status === 'confirmed' || participant.status === 'opted_out' || participant.status === 'excused') showAttendanceActionSheet(participant);");
  });

  it('es ist DASSELBE Menue, kein eigenes mit weniger Auswahl', () => {
    // Simon will das volle Menue: anwesend, abwesend, abgemeldet, Notiz.
    // Ein zweites Menue waere eine zweite Wahrheit darueber, was geht.
    const menueAufrufe = detail.match(/showAttendanceActionSheet\(participant\)/g) || [];
    expect(menueAufrufe.length).toBeGreaterThanOrEqual(1);
    expect(detail).not.toContain('showOptedOutActionSheet');
  });

  it('die Warteliste behaelt ihr eigenes Menue', () => {
    // Gegenprobe: Der Umbau darf den funktionierenden Fall nicht mitnehmen.
    expect(detail).toContain("else if (participant.status === 'waitlist') showWaitlistActionSheet(participant);");
  });

  it('verbucht die Leitung die Abmeldung, faerbt die Zeile nach dem Anwesenheits-Status', () => {
    // Sonst bliebe die Zeile rot und "Abgemeldet", obwohl die Leitung das
    // gerade korrigiert hat. Die Reihenfolge steht jetzt in
    // istSelbstAbgemeldet(): ein gesetzter Anwesenheits-Status schlaegt die
    // Abmeldung. Seit dem 15.09.2026 gilt das fuer beide Schreibweisen des
    // Buchungsstatus ('opted_out' wie bisher, 'excused' neu).
    expect(teilnahme).toContain("(p.status === 'opted_out' || p.status === 'excused') && !p.attendance_status");
    expect(detail).toContain('const isOptedOut = darstellung.istAbgemeldet;');
  });

  it('der Absagegrund bleibt als Vorgeschichte stehen', () => {
    // Am BUCHUNGSSTATUS, nicht an isOptedOut: Er erklaert, warum ueberhaupt
    // jemand nachgetragen hat.
    expect(detail).toContain("{participant.status === 'opted_out' && (participant.opt_out_reason || participant.absage_nach_zusage) && (");
    expect(detail).toContain('Hatte sich abgemeldet');
  });

  it('die Kachel zaehlt eine verbuchte Selbstabmeldung nicht mehr als abgemeldet', () => {
    // Sonst stuende dieselbe Person zugleich unter "Anwesend" und
    // unter "Abgemeldet".
    expect(detail).toContain('konfiOnly.filter(zaehltAlsAbgemeldet)');
    expect(teilnahme).toContain("if (p.attendance_status === 'present' || p.attendance_status === 'absent') return false;");
  });
});

describe('Wer hat den Eintrag gemacht (Urheber)', () => {
  it('die Zeile steht in der Teilnehmerliste, klein unter dem Eintrag', () => {
    expect(detail).toContain('{urheberZeile(participant) && (');
    // checkinZeile kam am 15.09.2026 dazu (Migration 151) — die beiden
    // Urheber-Zeilen stehen weiter in derselben Einfuhr.
    expect(detail).toContain("import { urheberZeile, notizUrheberZeile, checkinZeile } from '../../../utils/anwesenheitUrheber';");
  });

  it('der Zeitfenster-Abschnitt zeigt dieselben Zeilen', () => {
    expect(abschnitte).toContain('{urheberZeile(participant) && (');
    expect(abschnitte).toContain('{participant.attendance_note && notizUrheberZeile(participant) && (');
  });

  it('die Typen tragen Name und Zeitpunkt', () => {
    expect(typen).toContain('attendance_set_by_name?: string | null;');
    expect(typen).toContain('attendance_set_at?: string | null;');
  });
});

// Simons Rueckfrage (13.09.2026): "Was ist wenn einer einen Vermerk schreibt
// und einer den Grund. Wie wird das angezeigt." Mit einem gemeinsamen Urheber
// gar nicht — wer zuletzt schrieb, ueberschrieb den anderen. Entscheidung:
// "Getrennt führen: Status und Notiz je eigener Urheber."
describe('Zwei Urheber, je eine eigene Zeile', () => {
  it('die Notiz hat ihre eigene Urheber-Zeile', () => {
    expect(detail).toContain('{participant.attendance_note && notizUrheberZeile(participant) && (');
  });

  it('jede Zeile steht direkt unter dem, was sie erklaert', () => {
    // "Klein darunter" (Simon): Der Status-Urheber unter Status und Grund,
    // der Notiz-Urheber unter der Notiz. Sonst waeren am Ende zwei Namen
    // untereinander und keiner wuesste, welcher wozu gehoert.
    const grundZeile = detail.indexOf('<strong>Abgemeldet: </strong>');
    const statusUrheber = detail.indexOf('{urheberZeile(participant) && (');
    const notizZeile = detail.indexOf('<strong>Notiz: </strong>');
    const notizUrheber = detail.indexOf('{participant.attendance_note && notizUrheberZeile(participant) && (');

    expect(statusUrheber).toBeGreaterThan(grundZeile);
    expect(notizZeile).toBeGreaterThan(statusUrheber);
    expect(notizUrheber).toBeGreaterThan(notizZeile);
  });

  it('die Notiz-Urheber-Zeile haengt an der Notiz, nicht am Status', () => {
    // Gegenprobe: Ohne die Bedingung auf attendance_note stuende "Notiz von
    // ..." auch dort, wo es gar keine Notiz gibt.
    expect(detail).toContain('participant.attendance_note && notizUrheberZeile(participant)');
    expect(abschnitte).toContain('participant.attendance_note && notizUrheberZeile(participant)');
  });

  it('die Typen tragen das zweite Paar', () => {
    expect(typen).toContain('note_set_by_name?: string | null;');
    expect(typen).toContain('note_set_at?: string | null;');
  });
});

describe('Anwesenheitsmatrix zeigt die Abmeldung', () => {
  it('das Modal kennt den Zellstatus und zeichnet ihn grau', () => {
    expect(matrixModal).toContain("s === 'opted_out' || s === 'excused' ? ICON_ENTFERNEN_GEFUELLT");
    expect(css).toContain('.attendance-matrix__dot--excused {');
  });

  it('die Legende benennt beide Abmelde-Wege getrennt', () => {
    expect(matrixModal).toContain('<span>Abgemeldet</span>');
    expect(matrixModal).toContain('<span>Abgemeldet (nachgetragen)</span>');
  });

  it('Grund und Notiz haengen als Hinweis an der Zelle', () => {
    expect(matrixModal).toContain('title={hinweis || undefined}');
  });

  it('der leere Statistik-Rueckfall kennt excused', () => {
    // Sonst stuende dort undefined, sobald eine Zeile keine Stats hat.
    expect(matrixModal).toContain('{ present: 0, absent: 0, excused: 0, open: 0, opted_out: 0, nenner: 0 }');
  });
});

// Simon (15.09.2026): "Checkin via QR-Code am ..." — eine per QR-Code
// gesetzte Anwesenheit soll als solche gekennzeichnet sein.
//
// Der Urheber bleibt dabei leer (Migration 148, Entscheidung 13.09.2026):
// Die Konfi checkt sich SELBST ein, ein Name laese die Zeile wie eine
// Leitungsentscheidung aussehen. Dadurch stand der Selbst-Check-in aber im
// selben Nichts wie der Altbestand. Die Quelle (Migration 151) trennt beides.
//
// Geprueft wird die VERDRAHTUNG, nicht der Kommentar daneben: dass die
// Funktion importiert, aufgerufen und ihr Ergebnis gerendert wird, und dass
// die Zeile an der richtigen Stelle steht.
describe('Selbst-Check-in per QR-Code kennzeichnen', () => {
  it('die Zeile steht in der Teilnehmerliste', () => {
    expect(detail).toContain('{checkinZeile(participant) && (');
    expect(detail).toContain("import { urheberZeile, notizUrheberZeile, checkinZeile } from '../../../utils/anwesenheitUrheber';");
  });

  it('der Zeitfenster-Abschnitt zeigt dieselbe Zeile', () => {
    expect(abschnitte).toContain('{checkinZeile(participant) && (');
    expect(abschnitte).toContain("import { urheberZeile, notizUrheberZeile, checkinZeile } from '../../../utils/anwesenheitUrheber';");
  });

  it('die Zeile wird auch ausgegeben, nicht nur abgefragt', () => {
    // Gegenprobe zur Bedingung allein: Ohne den zweiten Aufruf im Rumpf
    // stuende dort eine leere graue Zeile.
    for (const datei of [detail, abschnitte]) {
      const vorkommen = datei.split('checkinZeile(participant)').length - 1;
      expect(vorkommen).toBe(2);
    }
  });

  it('sie traegt dieselben Styles wie die Urheber-Zeilen', () => {
    // Sie gehoert in dieselbe leise Reihe -- eine abweichende Farbe machte
    // aus einer Randnotiz eine Meldung.
    for (const datei of [detail, abschnitte]) {
      const stelle = datei.indexOf('{checkinZeile(participant) && (');
      const block = datei.slice(stelle, stelle + 400);
      expect(block).toContain("color: 'var(--app-text-tertiary)'");
      expect(block).toContain("fontSize: 'var(--app-text-hinweis)'");
    }
  });

  it('sie steht direkt unter der Urheber-Zeile, vor der Notiz', () => {
    // Beide beantworten "woher kommt dieser Status" und gehoeren zusammen;
    // die Notiz ist eine andere Frage und kommt danach.
    for (const datei of [detail, abschnitte]) {
      const statusUrheber = datei.indexOf('{urheberZeile(participant) && (');
      const qrZeile = datei.indexOf('{checkinZeile(participant) && (');
      const notizZeile = datei.indexOf('<strong>Notiz: </strong>');

      expect(qrZeile).toBeGreaterThan(statusUrheber);
      expect(notizZeile).toBeGreaterThan(qrZeile);
    }
  });

  it('die Typen tragen Quelle und Zeitpunkt', () => {
    expect(typen).toContain("checkin_quelle?: 'qr' | 'manuell' | null;");
    expect(typen).toContain('checked_in_at?: string | null;');
  });

  it('das Handbuch beschreibt die Zeile', () => {
    expect(handbuch).toContain('Eingecheckt per QR-Code');
  });
});
