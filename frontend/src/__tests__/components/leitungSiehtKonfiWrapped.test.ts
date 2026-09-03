import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund N5 (27.08.2026): Halb genutzter Endpunkt. GET /wrapped/history/:userId
// gestattet admin und org_admin seit jeher den Zugriff auf die Snapshots der
// eigenen Organisation (wrapped.js:660-673) -- im Leitungs-Baum rief ihn aber
// niemand auf. Teamer:innen sehen ueber TeamerKonfiStatsPage nur ihr EIGENES
// eingefrorenes Konfi-Wrapped, was korrekt ist; der Leitung fehlte die
// Ansicht ganz.
//
// Kein zusaetzliches Freigabe-Gate noetig: Snapshot-Erzeugung und
// wrapped_released_at laufen in derselben Transaktion (wrapped.js:513-537).
// Ein Konfi-Snapshot existiert also nie vor der Freigabe -- die Leitung sieht
// nichts, was die Konfi nicht selbst schon sehen kann. Diese Kopplung sichert
// der Backend-Test unten ab: faellt sie, wird aus N5 eine Datenschutzluecke.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const konfiDetail = lies('src/components/admin/views/KonfiDetailView.tsx');

describe('Leitung kann den Jahresrueckblick einer Konfi ansehen (N5)', () => {
  it('holt die Snapshots der angezeigten Konfi, nicht die eigenen', () => {
    // Der entscheidende Unterschied zur Teamer-Seite, die dort user?.id
    // verwendet: hier muss die konfiId der geoeffneten Detailseite stehen.
    expect(konfiDetail).toContain('api.get(`/wrapped/history/${konfiId}`)');
  });

  it('waehlt den zur Rolle passenden Snapshot aus der Liste', () => {
    // Ein Mensch kann beides haben (befoerderte Konfi). Gezeigt wird, was zur
    // Rolle in DIESER Ansicht gehört — sonst sähe man in der Teamer-Ansicht
    // den Konfi-Rückblick von früher.
    expect(konfiDetail).toContain("e.wrapped_type === (isTeamer ? 'teamer' : 'konfi')");
  });

  it('oeffnet das WrappedModal mit den geladenen Daten', () => {
    // initialData ist der Schalter, der das Modal daran hindert,
    // /wrapped/me zu laden -- sonst saehe die Leitung ihren eigenen
    // (leeren) Rueckblick statt dem der Konfi.
    expect(konfiDetail).toContain('initialData: wrappedModalData?.data');
    expect(konfiDetail).toContain('initialYear: wrappedModalData?.year');
    expect(konfiDetail).toContain("wrappedType: (isTeamer ? 'teamer' : 'konfi')");
  });

  it('zeigt den Namen der Konfi im Modal, nicht den der Leitung', () => {
    expect(konfiDetail).toContain('displayName: currentKonfi?.display_name || currentKonfi?.name');
  });

  it('blendet die Karte ohne vorhandenen Rueckblick aus', () => {
    // Gegenprobe: Ohne Snapshot (Jahrgang noch nicht freigegeben, oder
    // offline) darf keine leere Karte stehenbleiben.
    expect(konfiDetail).toContain('{wrappedListe.length > 0 && (');
  });

  // Bis zum 02.09.2026 stieg der Effekt bei Teamer:innen sofort aus
  // ("setKonfiWrapped(null)"). Die Leitung konnte den Teamer-Rückblick
  // deshalb NIRGENDS ansehen, obwohl das Backend ihn ausdrücklich freigibt
  // ("Teamer:innen als Ziel bleiben frei einsehbar", wrapped.js) und die
  // Route als Leitung mit HTTP 200 antwortet. Simons Befund.
  it('lädt den Rückblick auch bei Teamer:innen', () => {
    const effekt = konfiDetail.slice(
      konfiDetail.indexOf('const [wrappedListe'),
      konfiDetail.indexOf('const [wrappedModalData')
    );
    expect(effekt).not.toContain('if (isTeamer) {');
    expect(effekt).toContain('api.get(`/wrapped/history/${konfiId}`)');
  });

  it('zeigt ALLE Jahre, nicht nur eines', () => {
    // Teamer:innen bekommen jedes Jahr einen neuen Rückblick, die alten
    // bleiben erhalten. Ein einzelner Eintrag (.find) hätte die Historie
    // stillschweigend auf ein Jahr zusammengestrichen.
    expect(konfiDetail).toContain('wrappedListe.map((eintrag, i) =>');
    // GEAENDERT AM 03.09.2026: Frueher stand hier fest "Jahresrückblick
    // {eintrag.year}". Seit es mehrere Ausgaben je Jahrgang gibt
    // ("Zwischenstand", "Dein Abschluss"), war das nicht mehr
    // unterscheidbar -- im Profil stand zweimal dasselbe (Simons Befund).
    // Jetzt traegt der Titel der Ausgabe, mit der Jahreszahl als Rueckfall
    // fuer Alt-Snapshots ohne Ausgabe.
    expect(konfiDetail).toContain('eintrag.titel || `Jahresrückblick ${eintrag.year}`');
  });

  it('bricht den Abruf beim Wechsel der Konfi ab', () => {
    // Ohne das Abbruch-Flag koennte die Antwort zu Konfi A den Rueckblick
    // von Konfi B ueberschreiben, wenn man schnell weiterblaettert.
    const effekt = konfiDetail.slice(
      konfiDetail.indexOf('const [wrappedListe'),
      konfiDetail.indexOf('const [wrappedModalData')
    );
    expect(effekt).toContain('abgebrochen');
    expect(effekt).toContain('return () => { abgebrochen = true; };');
  });
});
