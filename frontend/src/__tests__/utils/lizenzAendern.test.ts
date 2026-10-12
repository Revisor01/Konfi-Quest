// Lizenz im Vorgang „Lizenz und Abrechnung" ändern (utils/lizenzAendern.ts;
// docs/planung/support-detailseiten.md, „Lizenz-Vorgang"). Rein: Tarif als
// Text, Vorbelegung, „Wunschlizenz übernehmen", Prüfung, die Änderung je
// Route, der volle Körper des PUT und die Vorschau. Die Testläufe stehen auf
// Europe/Berlin; „jetzt" ist der 11.10.2026, 12:00 Uhr.
import { describe, it, expect } from 'vitest';
import {
  gemeindeStammLesen,
  laufzeitWahlen,
  lizenzAenderung,
  lizenzFehler,
  lizenzPutKoerper,
  lizenzTestphaseSetzen,
  lizenzVorbelegen,
  lizenzVorschau,
  lizenzWunschUebernehmen,
  lizenzZusatz,
  tarifAngabe,
  wunschAnbieten,
  type GemeindeStamm,
  type LizenzBestand,
  type LizenzFormular,
} from '../../utils/lizenzAendern';

const JETZT = new Date('2026-10-11T10:00:00Z');

/** Testphase mit 5 Konfis bis 20.10., Wunsch Standard, 3 Konfis angelegt. */
const BESTAND: LizenzBestand = {
  id: 7, display_name: 'Test-Gemeinde St. Martin', max_konfis: 5, is_trial: true, trial_ends_at: '2026-10-20T10:00:00Z',
  konfi_count: 3, wunsch_lizenz: 'standard', is_active: true,
};
const bestand = (teil: Partial<LizenzBestand> = {}): LizenzBestand => ({ ...BESTAND, ...teil });
const formular = (teil: Partial<LizenzFormular> = {}): LizenzFormular => ({ ...lizenzVorbelegen(BESTAND), ...teil });

const STAMM: GemeindeStamm = {
  name: 'st-martin', slug: 'st-martin', display_name: 'Test-Gemeinde St. Martin', description: 'Gemeinde am Deich', contact_name: 'Test Org-Admin 1',
  contact_email: 'kontakt@example.org', contact_phone: '0481 1234', address: 'Kirchweg 1', website_url: 'https://example.org', kirchenkreis: 'Dithmarschen',
  kirchenkreis_id: 11, is_active: true,
};

describe('tarifAngabe: Name, Text und Preis je Konfi-Limit', () => {
  it('die Tarife der Startseite, Unbegrenzt und ein eigenes Limit', () => {
    expect(tarifAngabe(5)).toMatchObject({ name: 'Testphase', text: 'Testphase — bis 5 Konfis · kostenlos', euro: 0, konfis: 5, eigen: false, lizenz: null });
    expect(tarifAngabe(15)).toMatchObject({ name: 'Klein', text: 'Klein — bis 15 Konfis · 49\u00a0€ pro Jahr', euro: 49, konfis: 15, eigen: false });
    expect(tarifAngabe(50)).toMatchObject({ name: 'Standard', text: 'Standard — bis 50 Konfis · 99\u00a0€ pro Jahr', euro: 99, konfis: 50, eigen: false });
    expect(tarifAngabe(75)).toMatchObject({ name: 'Plus', text: 'Plus — bis 75 Konfis · 139\u00a0€ pro Jahr', euro: 139, konfis: 75, eigen: false });
    expect(tarifAngabe(100)).toMatchObject({ name: 'Groß', text: 'Groß — bis 100 Konfis · 179\u00a0€ pro Jahr', euro: 179, konfis: 100, eigen: false });
    expect(tarifAngabe(null)).toEqual({ name: 'Unbegrenzt', text: 'Unbegrenzt — ohne Konfi-Grenze', euro: null, konfis: null, lizenz: null, eigen: false });
    expect(tarifAngabe(120)).toEqual({ name: 'Eigenes Limit', text: 'Eigenes Limit — 120 Konfis', euro: null, konfis: 120, lizenz: null, eigen: true });
    expect(tarifAngabe(50).lizenz?.schluessel).toBe('standard');
  });
});

describe('Vorbelegen und Laufzeit-Wahlen', () => {
  it('aus { max 5, is_trial, trial_ends_at }: nichts geändert, Datum für das Feld, Testphase an', () => {
    expect(lizenzVorbelegen(BESTAND)).toEqual({ tarif: '5', eigenesLimit: false, laufzeit: 'unveraendert', datum: '2026-10-20', testphase: true });
  });

  it('ein Limit außerhalb der Tarife ist ein eigenes; ohne Datum ist die Testphase aus; unbegrenzt ist ""', () => {
    expect(lizenzVorbelegen(bestand({ max_konfis: 120 }))).toMatchObject({ tarif: '120', eigenesLimit: true });
    expect(lizenzVorbelegen(bestand({ trial_ends_at: null }))).toMatchObject({ datum: '', testphase: false });
    expect(lizenzVorbelegen(bestand({ max_konfis: null }))).toMatchObject({ tarif: '', eigenesLimit: false });
  });

  it('die Wahlen mit Datum; „1 Jahr ab Laufzeitende" nur, solange die Lizenz läuft (ein Jahr = 365 Tage)', () => {
    expect(laufzeitWahlen(BESTAND, JETZT)).toEqual([
      { wert: 'unveraendert', label: 'Unverändert (Testphase bis 20.10.)' },
      { wert: 'jahr_ab_heute', label: '1 Jahr ab heute (bis 11.10.2027)' },
      { wert: 'jahr_ab_ende', label: '1 Jahr ab Laufzeitende (bis 20.10.2027)' },
      { wert: 'testphase', label: '30 Tage Testphase (bis 10.11.2026)' },
      { wert: 'unbegrenzt', label: 'Unbegrenzt' },
      { wert: 'datum', label: 'Eigenes Datum…' },
    ]);
    const abgelaufen = laufzeitWahlen(bestand({ trial_ends_at: '2026-10-01T10:00:00Z' }), JETZT);
    expect(abgelaufen.map((w) => w.wert)).toEqual(['unveraendert', 'jahr_ab_heute', 'testphase', 'unbegrenzt', 'datum']);
    expect(abgelaufen[0].label).toBe('Unverändert (Testphase abgelaufen)');
  });
});

describe('Wunschlizenz übernehmen', () => {
  it('Standard: Tarif 50, Testphase aus, ein Jahr ab heute, wenn die Lizenz nicht mehr läuft', () => {
    expect(lizenzWunschUebernehmen(bestand({ trial_ends_at: '2026-10-01T10:00:00Z' }), JETZT)).toEqual({
      tarif: '50', eigenesLimit: false, laufzeit: 'jahr_ab_heute', datum: '2027-10-11', testphase: false,
    });
  });

  it('läuft die Lizenz noch: ein Jahr ab ihrem Ende', () => {
    expect(lizenzWunschUebernehmen(BESTAND, JETZT)).toMatchObject({ tarif: '50', laufzeit: 'jahr_ab_ende', datum: '2027-10-20', testphase: false });
  });

  it('Verbund: unbegrenzt (sein Limit wird abgesprochen); ohne Wunsch kein Knopf', () => {
    expect(lizenzWunschUebernehmen(bestand({ wunsch_lizenz: 'verbund' }), JETZT)?.tarif).toBe('');
    expect(lizenzWunschUebernehmen(bestand({ wunsch_lizenz: null }), JETZT)).toBeNull();
  });
});

describe('Wunschlizenz anbieten', () => {
  // Dieselbe Regel wie die Zusatzzeile (Wunsch nur, wenn er vom Tarif abweicht) -- dazu, solange
  // die Testphase läuft: Dann macht der Knopf aus ihr die Lizenz. Sonst setzte er etwa einer
  // unbegrenzten Standard-Lizenz eine Laufzeit von einem Jahr.
  it('nur, wenn der Wunsch vom Tarif abweicht oder die Testphase läuft; ohne Wunsch nie', () => {
    expect(wunschAnbieten(BESTAND)).toBe(true);
    expect(wunschAnbieten(bestand({ max_konfis: 50, is_trial: false, trial_ends_at: null }))).toBe(false);
    expect(wunschAnbieten(bestand({ max_konfis: 50, is_trial: false, trial_ends_at: '2027-03-01T10:00:00Z' }))).toBe(false);
    expect(wunschAnbieten(bestand({ max_konfis: 50, is_trial: true }))).toBe(true);
    expect(wunschAnbieten(bestand({ max_konfis: 75, is_trial: false, trial_ends_at: null }))).toBe(true);
    expect(wunschAnbieten(bestand({ wunsch_lizenz: null }))).toBe(false);
    // Verbund: unbegrenzt -- gleich dem Tarif „Unbegrenzt".
    expect(wunschAnbieten(bestand({ wunsch_lizenz: 'verbund', max_konfis: null, is_trial: false, trial_ends_at: null }))).toBe(false);
  });
});

describe('Prüfung', () => {
  it('ein eigenes Limit muss eine ganze Zahl ab 1 sein; „Eigenes Datum" braucht ein Datum', () => {
    const limit = 'Das Konfi-Limit muss eine ganze Zahl ab 1 sein';
    expect(lizenzFehler(formular({ eigenesLimit: true, tarif: 'abc' }))).toBe(limit);
    expect(lizenzFehler(formular({ eigenesLimit: true, tarif: '-1' }))).toBe(limit);
    expect(lizenzFehler(formular({ eigenesLimit: true, tarif: '0' }))).toBe(limit);
    expect(lizenzFehler(formular({ eigenesLimit: true, tarif: '' }))).toBe(limit);
    expect(lizenzFehler(formular({ laufzeit: 'datum', datum: '' }))).toBe('Bitte ein Enddatum wählen');
    expect(lizenzFehler(formular({ eigenesLimit: true, tarif: '120', laufzeit: 'datum', datum: '2027-06-30' }))).toBeNull();
    expect(lizenzFehler(formular())).toBeNull();
  });
});

describe('Die Änderung je Route', () => {
  it('nur der Tarif: { limit } -- kein PUT', () => {
    expect(lizenzAenderung(BESTAND, formular({ tarif: '50' }), JETZT)).toEqual({ limit: { max_konfis: 50 } });
    expect(lizenzAenderung(BESTAND, formular({ tarif: '' }), JETZT)).toEqual({ limit: { max_konfis: null } });
  });

  it('nur die Laufzeit: { laufzeit } mit ISO-Zeit; ohne Testphase-Hinweis', () => {
    expect(lizenzAenderung(BESTAND, formular({ laufzeit: 'jahr_ab_heute', testphase: false }), JETZT)).toEqual({
      laufzeit: { trial_ends_at: '2027-10-11T10:00:00.000Z', is_trial: false },
    });
  });

  it('nichts geändert: {}', () => {
    expect(lizenzAenderung(BESTAND, formular(), JETZT)).toEqual({});
    // Dasselbe Datum als „Eigenes Datum" ist keine Änderung.
    expect(lizenzAenderung(BESTAND, formular({ laufzeit: 'datum', datum: '2026-10-20' }), JETZT)).toEqual({});
  });

  it('Unbegrenzt: Ende null, Testphase aus -- auch wenn der Schalter noch an war', () => {
    expect(lizenzAenderung(BESTAND, formular({ laufzeit: 'unbegrenzt', testphase: true }), JETZT)).toEqual({ laufzeit: { trial_ends_at: null, is_trial: false } });
  });

  it('nur der Schalter: is_trial ändert sich, das Ende bleibt', () => {
    expect(lizenzAenderung(BESTAND, formular({ testphase: false }), JETZT)).toEqual({ laufzeit: { trial_ends_at: '2026-10-20T10:00:00Z', is_trial: false } });
  });

  it('ein ungültiges Limit ändert das Limit nicht', () => {
    expect(lizenzAenderung(BESTAND, formular({ eigenesLimit: true, tarif: 'abc' }), JETZT)).toEqual({});
  });
});

describe('Testphase umschalten', () => {
  it('aus: das Limit, das noch auf der Testphase-Vorgabe stand, folgt dem Wunsch', () => {
    expect(lizenzTestphaseSetzen(BESTAND, formular(), false, JETZT)).toMatchObject({ testphase: false, tarif: '50', eigenesLimit: false });
  });

  it('ohne Laufzeitende bleibt der Schalter aus', () => {
    expect(lizenzTestphaseSetzen(BESTAND, formular({ laufzeit: 'unbegrenzt', testphase: false, tarif: '50' }), true, JETZT)).toMatchObject({ testphase: false, tarif: '50' });
  });

  it('ein bewusst gewählter Tarif bleibt stehen', () => {
    expect(lizenzTestphaseSetzen(BESTAND, formular({ tarif: '75' }), false, JETZT)).toMatchObject({ testphase: false, tarif: '75' });
  });
});

describe('Der volle Körper des PUT', () => {
  it('alle Stammfelder unverändert, dazu Laufzeit und Testphase', () => {
    expect(lizenzPutKoerper(STAMM, { trial_ends_at: '2027-10-11T10:00:00.000Z', is_trial: false })).toEqual({
      name: 'st-martin', slug: 'st-martin', display_name: 'Test-Gemeinde St. Martin', description: 'Gemeinde am Deich', contact_name: 'Test Org-Admin 1',
      contact_email: 'kontakt@example.org', contact_phone: '0481 1234', address: 'Kirchweg 1', website_url: 'https://example.org', kirchenkreis: 'Dithmarschen',
      is_active: true, kirchenkreis_id: 11, trial_ends_at: '2027-10-11T10:00:00.000Z', is_trial: false,
    });
  });

  it('kirchenkreis_id nur, wenn gesetzt; ohne Datum keine Testphase', () => {
    const koerper = lizenzPutKoerper({ ...STAMM, kirchenkreis_id: null }, { trial_ends_at: null, is_trial: true });
    expect(Object.prototype.hasOwnProperty.call(koerper, 'kirchenkreis_id')).toBe(false);
    expect(koerper).toMatchObject({ trial_ends_at: null, is_trial: false, kirchenkreis: 'Dithmarschen' });
  });

  it('GET /organizations/:id lesen: Werte wie geliefert; ohne name, slug oder Anzeigename unbrauchbar', () => {
    const roh = { ...STAMM, id: 7, contact_phone: '', address: null, max_konfis: 5, konfi_count: 3, user_count: 4 };
    expect(gemeindeStammLesen(roh)).toEqual({ ...STAMM, contact_phone: '', address: null });
    expect(gemeindeStammLesen({ ...roh, display_name: null })).toMatchObject({ display_name: 'st-martin' });
    expect(gemeindeStammLesen({ ...roh, slug: '' })).toBeNull();
    expect(gemeindeStammLesen({ ...roh, kirchenkreis_id: 'elf' })?.kirchenkreis_id).toBeNull();
    expect(gemeindeStammLesen({ ...roh, is_active: false })?.is_active).toBe(false);
    expect(gemeindeStammLesen([roh])).toBeNull();
    expect(gemeindeStammLesen(null)).toBeNull();
  });
});

describe('Vorschau', () => {
  it('nach „Wunsch übernehmen": Standard, ein Jahr', () => {
    const wunsch = lizenzWunschUebernehmen(bestand({ trial_ends_at: '2026-10-01T10:00:00Z' }), JETZT)!;
    expect(lizenzVorschau(BESTAND, wunsch, JETZT)).toEqual({ text: 'Danach: Standard — bis 50 Konfis · 99\u00a0€ pro Jahr · Lizenz bis 11.10.2027.', warnung: null, gesperrt: null });
  });

  // Nach Ablauf sperrt der nächtliche Lauf die Gemeinde (is_active false). „Lizenz ändern" schreibt
  // is_active unverändert zurück -- die Vorschau sagt, dass der Zugang gesperrt bleibt.
  it('eine gesperrte Gemeinde (etwa nach Ablauf): die Vorschau sagt, dass der Zugang gesperrt bleibt', () => {
    const gesperrt = bestand({ trial_ends_at: '2026-10-01T00:00:00Z', is_active: false, konfi_count: 4 });
    const wunsch = lizenzWunschUebernehmen(gesperrt, JETZT)!;
    expect(lizenzVorschau(gesperrt, wunsch, JETZT)).toEqual({
      text: 'Danach: Standard — bis 50 Konfis · 99\u00a0€ pro Jahr · Lizenz bis 11.10.2027.',
      warnung: null,
      gesperrt: 'Der Zugang der Gemeinde bleibt gesperrt – freigeben lässt er sich im Formular der Gemeinde.',
    });
    expect(lizenzVorschau(BESTAND, wunsch, JETZT).gesperrt).toBeNull();
  });

  it('Testphase und unbegrenzt', () => {
    // Endet die Laufzeit auf einen Punkt („20.10."), steht keiner doppelt.
    expect(lizenzVorschau(BESTAND, formular(), JETZT).text).toBe('Danach: Testphase — bis 5 Konfis · kostenlos · Testphase bis 20.10.');
    expect(lizenzVorschau(BESTAND, formular({ tarif: '', laufzeit: 'unbegrenzt', testphase: false }), JETZT).text).toBe('Danach: Unbegrenzt — ohne Konfi-Grenze · Laufzeit unbegrenzt.');
  });

  it('mehr Konfis als das neue Limit: Warnung nach der Regel des Servers (bis 5 darüber mit Bestätigung)', () => {
    expect(lizenzVorschau(bestand({ konfi_count: 17 }), formular({ tarif: '15' }), JETZT).warnung)
      .toBe('17 Konfis sind schon angelegt – mehr als 15. Neue Konfis nur noch mit Bestätigung, ab 20 gar nicht.');
    expect(lizenzVorschau(bestand({ konfi_count: 15 }), formular({ tarif: '15' }), JETZT).warnung)
      .toBe('15 Konfis sind schon angelegt – so viele wie 15. Neue Konfis nur noch mit Bestätigung, ab 20 gar nicht.');
    expect(lizenzVorschau(bestand({ konfi_count: 31 }), formular({ tarif: '15' }), JETZT).warnung)
      .toBe('31 Konfis sind schon angelegt – mehr als 15. Neue Konfis lassen sich nicht mehr anlegen (gesperrt ab 20).');
    expect(lizenzVorschau(bestand({ konfi_count: 14 }), formular({ tarif: '15' }), JETZT).warnung).toBeNull();
    expect(lizenzVorschau(bestand({ konfi_count: 400 }), formular({ tarif: '' }), JETZT).warnung).toBeNull();
  });
});

describe('Zusatzzeile im Stand', () => {
  it('nennt Namen, keine Zahlen; der Wunsch nur, wenn er abweicht', () => {
    expect(lizenzZusatz(BESTAND, null, JETZT)).toEqual({ text: 'Lizenz heute: Testphase bis 20.10. · bei der Anmeldung gewünscht: Standard.', ton: 'neutral' });
    expect(lizenzZusatz(bestand({ max_konfis: 50, is_trial: false, trial_ends_at: null }), null, JETZT)).toEqual({ text: 'Lizenz heute: Standard.', ton: 'neutral' });
    expect(lizenzZusatz(bestand({ max_konfis: 50, is_trial: true }), null, JETZT).text).toBe('Lizenz heute: Standard (Testphase) bis 20.10.');
    expect(lizenzZusatz(bestand({ trial_ends_at: '2027-01-31T10:00:00Z', wunsch_lizenz: null }), null, JETZT).text).toBe('Lizenz heute: Testphase bis 31.01.2027.');
  });

  it('ohne Gemeinde: erst zuordnen -- mit oder ohne Angabe im Formular', () => {
    expect(lizenzZusatz(null, 'Kirchengemeinde Heide', JETZT)).toEqual({
      text: 'Die Lizenz lässt sich erst ändern, wenn eine Gemeinde zugeordnet ist – laut Formular: Kirchengemeinde Heide.', ton: 'hinweis',
    });
    expect(lizenzZusatz(null, null, JETZT).text).toBe('Die Lizenz lässt sich erst ändern, wenn eine Gemeinde zugeordnet ist.');
  });
});
