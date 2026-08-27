import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Konfi-Stammdaten (Name, Jahrgang) waren nach dem Anlegen in KEINER Ansicht
// aenderbar — die Backend-Route gab es, sie hatte nur keinen Knopf. Ein
// Tippfehler im Namen blieb damit dauerhaft stehen.
//
// Gebaut am 27.08.2026 nach Simons Entscheidung: Bearbeiten fuer die Leitung,
// Name UND Jahrgang.
//
// Der Jahrgangswechsel ist die heikle Haelfte. Was er ausloest, wurde vorher
// gemessen; die Entscheidungen dazu stehen in BAUSTELLEN.md. Simons Leitsatz:
// "Neuer Jahrgang, die Regeln des Jahrgangs gelten."
//
// Dieser Test haelt die Warnungen fest. Als Dateitest, weil der Fehler waere,
// dass eine davon still verschwindet — beim Umbauen des Modals faellt das
// sonst niemandem auf.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const modal = lies('src/components/admin/modals/KonfiModal.tsx');
const detail = lies('src/components/admin/views/KonfiDetailView.tsx');

describe('Stammdaten bearbeiten: der Einstieg', () => {
  it('die Leitung hat einen Bearbeiten-Knopf im Konfi-Detail', () => {
    expect(detail).toContain('Konfi bearbeiten');
    expect(detail).toContain('presentBearbeitenModal');
  });

  it('der Knopf nutzt die vorhandene Route, statt eine neue zu erfinden', () => {
    expect(detail).toMatch(/api\.put\(`\/admin\/konfis\/\$\{konfiId\}`/);
  });

  it('bei Teamer:innen erscheint er nicht', () => {
    // Teamer:innen haben keinen einzelnen Jahrgang; ihre Stammdaten liegen in
    // der Benutzerverwaltung. Ein Knopf hier waere ein Knopf ins Leere.
    expect(detail).toContain('{!isTeamer && (');
  });

  it('offline ist er gesperrt', () => {
    // Ein Speichern ohne Verbindung scheitert erst beim Antippen.
    expect(detail).toContain('disabled={!isOnline || !currentKonfi}');
  });
});

describe('Stammdaten bearbeiten: EIN Modal fuer Anlegen und Bearbeiten', () => {
  // Zwei Dateien waeren genau die Kopie, die in diesem Projekt regelmaessig
  // auseinanderlaeuft (drei Ansichtsbaeume, siehe CLAUDE.md).
  it('das Anlege-Modal kann beides', () => {
    expect(modal).toContain('const bearbeiten = !!konfi;');
    expect(modal).toContain("{bearbeiten ? 'Konfi bearbeiten' : 'Konfi erstellen'}");
  });

  it('die Felder sind mit den vorhandenen Werten vorbelegt', () => {
    expect(modal).toContain("useState(konfi?.display_name ?? '')");
    expect(modal).toContain('useState<number | null>(konfi?.jahrgang_id ?? null)');
  });

  it('der Hinweis zum Benutzernamen erscheint nur beim Bearbeiten', () => {
    // Beim Anlegen wird er erzeugt, beim Bearbeiten bleibt er unveraendert —
    // das Backend generiert ihn bewusst NICHT neu.
    expect(modal).toContain('Der Benutzername zum Anmelden ändert sich nicht');
  });
});

describe('Stammdaten bearbeiten: die Warnungen beim Jahrgangswechsel', () => {
  it('sie erscheinen nur, wenn wirklich gewechselt wird', () => {
    // Beim Anlegen und beim reinen Namensfix waere die Warnung Unsinn.
    expect(modal).toContain('const wechselt = bearbeiten && jahrgangId !== null && jahrgangId !== konfi!.jahrgang_id;');
    expect(modal).toContain('{wechselt && (');
  });

  it('sie benennen, was der Wechsel bewirkt', () => {
    // Simons Leitsatz, in vier Punkten aufgeschluesselt.
    expect(modal).toContain('Es gelten die Regeln des neuen Jahrgangs');
    expect(modal).toContain('Anmeldungen zu künftigen Terminen des alten Jahrgangs fallen weg');
    expect(modal).toContain('Pflichttermine des neuen Jahrgangs kommen dazu');
    expect(modal).toContain('Der Jahrgangs-Chat wechselt mit');
    expect(modal).toContain('Der Jahresrückblick erscheint erst wieder');
  });

  it('sie sagen auch, was NICHT passiert', () => {
    // Sonst klingt der Wechsel gefaehrlicher, als er ist.
    expect(modal).toContain('Bereits erfasste Anwesenheiten und vergangene Termine bleiben');
  });

  it('bei abgeschalteter Punkteart warnen sie konkret', () => {
    // Die Punkte bleiben in der Datenbank, verschwinden aber aus jeder
    // Anzeige. Ohne Zahl waere die Warnung folgenlos.
    expect(modal).toContain('const verlorenePunkte: string[] = [];');
    expect(modal).toContain('gottesdienst_enabled === false');
    expect(modal).toContain('gemeinde_enabled === false');
    expect(modal).toContain('werden dort nicht mehr angezeigt');
  });

  it('die Punkte-Warnung kommt nur, wenn es wirklich Punkte gibt', () => {
    // Bei 0 Punkten waere sie eine Warnung ohne Gegenstand.
    expect(modal).toMatch(/\(konfi!\.gottesdienst_points \?\? 0\) > 0/);
    expect(modal).toMatch(/\(konfi!\.gemeinde_points \?\? 0\) > 0/);
  });

  it('bei fremdem Jahrgang warnt sie vor dem Sichtverlust', () => {
    expect(modal).toContain('const verliertSicht =');
    expect(modal).toContain('nicht zugewiesen');
    expect(modal).toContain('nicht mehr');
  });

  it('die Sicht-Warnung gilt nur fuer `admin`, nicht fuer die Leitung', () => {
    // org_admin sieht ohnehin alle Jahrgaenge — dort waere sie schlicht falsch.
    expect(detail).toContain("user?.role_name === 'admin'");
    // Ohne uebergebene Liste bleibt sie aus, statt fuer alle zu erscheinen.
    expect(modal).toContain('Array.isArray(eigeneJahrgangIds)');
    expect(modal).toContain('eigeneJahrgangIds.length > 0');
  });

  it('keine der Warnungen blockiert das Speichern', () => {
    // Der Wechsel ist ein legitimer Vorgang — meist "falsch angelegt, muss in
    // den richtigen Jahrgang". Ueberraschend sind nur die Folgen.
    expect(modal).toContain('const isValid = name.trim().length > 0 && jahrgangId !== null;');
    expect(modal).not.toContain('verlorenePunkte.length > 0 && !');
  });
});

describe('Stammdaten bearbeiten: woher die Warnungen ihre Daten haben', () => {
  it('die Punktearten kommen aus der Jahrgangsliste', () => {
    // GET /jahrgaenge liefert dank SELECT j.* die Punktearten mit — kein
    // zusaetzlicher Abruf noetig.
    expect(detail).toContain("api.get('/jahrgaenge')");
    expect(modal).toContain('gottesdienst_enabled?: boolean;');
  });

  it('die eigenen Zuweisungen kommen aus dem angemeldeten Konto', () => {
    expect(detail).toContain('user.assigned_jahrgaenge');
    // can_view === false zaehlt nicht als Sicht.
    expect(detail).toContain('can_view !== false');
  });
});
