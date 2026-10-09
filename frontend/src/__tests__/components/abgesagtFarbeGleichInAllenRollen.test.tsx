// Ein abgesagter Termin hat in allen drei Rollen dieselbe Farbe
// (Nachpruefung zu Simons Befund vom 17.09.2026)
//
// SIMONS BEFUND LAUTETE: "Termin abgesagt erscheint in rot bei Teamer nicht
// in grau wie bei Konfis. Das Konfi grau finde ich besser."
//
// GEGEN DEN CODE GEPRUEFT — DIE ERSTE HAELFTE STIMMT NICHT:
// Die Konfi-Ansicht faerbt abgesagte Termine NICHT grau, sondern rot, in
// Liste und Detail. Genau dasselbe tut die Teamer-Ansicht. Die gemeinsame
// Legende (shared/EventLegendModal.tsx) fuehrt "Absage / Abmeldung"
// ausdruecklich fuer konfi, teamer UND admin in --app-color-danger.
//
// WAS IN DER KONFI-LISTE GRAU IST, IST DER TITEL: Ein abgesagter Termin wird
// durchgestrichen und in --app-text-muted gesetzt. Die Teamer-Liste tut das
// seit dem 15.09.2026 ebenfalls.
//
// DESHALB WURDE HIER NICHTS UMGEFAERBT. Waere die Teamer-Ansicht auf Grau
// gestellt worden, waere sie als EINZIGE der drei Rollen grau geworden.
//
// NACHTRAG 17.09.2026: Simons Befund war doch berechtigt -- nur an einer
// anderen Stelle: am HINWEIS IN DER KARTE "Bist du dabei?" (Konfi grau als
// IonNote, Team rot als Statusbox). Simon: "ich will sie nur grau auf dem
// button bis du dabei? an allen anderen stellen nicht." Geaendert wurde
// ausschliesslich der Karten-Hinweis.
//
// Seit dem 09.10.2026 gerendert statt am Quelltext geprueft (Audit Tests
// 26.09.2026, BF-02): Konfi-Liste, Konfi-Detail, Team-Liste und Team-Detail
// sind die ECHTEN Ansichten (Geruest teamerTerminSeite), die Legende das
// echte Modal. Geprueft wird, was auf dem Bildschirm ankommt: Randfarbe,
// Symbolkreis, Kopf-Verlauf, Titel-Stil und die Farbe des Hinweises.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, act, within } from '@testing-library/react';
import { zustand, zuruecksetzen, oeffneListe, oeffneTermin, termin, zeileVon, zusageKarte } from './gerueste/teamerTerminSeite';
import type { EventLegendVariant } from '../../components/shared/EventLegendModal';

// Das Geruest zeichnet IonNote als schlichtes <span> ohne Farbe. Hier geht es
// genau um die Farbe des Hinweises -- deshalb wird IonNote fuer diese Datei um
// data-color ergaenzt, der Rest der Geruest-Attrappe bleibt. Die Ansichten
// laedt das Geruest erst beim Rendern, die Ergaenzung greift also fuer sie.
beforeAll(async () => {
  const geruest = await import('@ionic/react');
  vi.doMock('@ionic/react', () => ({
    ...geruest,
    IonNote: ({ children, color }: { children?: React.ReactNode; color?: string }) => (
      <span data-note="ja" data-color={color}>{children}</span>
    ),
  }));
});

const ROT = 'var(--app-color-danger)';
const GRAU_TEXT = 'var(--app-text-muted)';

const abgesagt = () => termin({
  id: 77, name: 'Konfi-Freizeit', cancelled: true, cancelled_reason: 'Krankheit',
  booking_status: 'excused', is_registered: false,
} as Partial<import('../../types/event').Event>);

const offen = () => termin({ id: 78, name: 'Stadtrallye', cancelled: false });

/** Rand, Symbolkreis und Titel einer Listenkarte. */
const karte = (zeile: HTMLElement) => {
  const item = zeile.querySelector('.app-list-item') as HTMLElement;
  const kreis = zeile.querySelector('.app-icon-circle') as HTMLElement;
  const titel = zeile.querySelector('.app-list-item__title') as HTMLElement;
  return {
    rand: item.style.borderLeftColor,
    kreis: kreis.style.backgroundColor,
    titelFarbe: titel.style.color,
    titelDeko: titel.style.textDecoration,
  };
};

const kopfVerlauf = () => (document.querySelector('.app-header-banner') as HTMLElement).style.background;

const oeffneKonfiListe = async () => {
  const KonfiEventsPage = (await import('../../components/konfi/pages/KonfiEventsPage')).default;
  render(<KonfiEventsPage />);
  await act(async () => { await Promise.resolve(); });
  // Der abgesagte Termin hat eine Buchung (excused) und steht unter "Meine",
  // der offene nur unter "Alle".
};

const oeffneKonfiDetail = async (id: number) => {
  const EventDetailView = (await import('../../components/konfi/views/EventDetailView')).default;
  render(<EventDetailView eventId={id} onBack={() => undefined} />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
};

/** Der Hinweis "Dieses Event ist abgesagt" und wie er gezeichnet ist. */
const absageHinweis = () => {
  const text = screen.getByText('Dieses Event ist abgesagt');
  const note = text.closest('[data-note="ja"]') as HTMLElement | null;
  return { note, rotBox: text.closest('.app-status-box--danger') };
};

beforeEach(() => {
  zuruecksetzen();
  zustand.events = [abgesagt(), offen()];
});

describe('Abgesagte Termine tragen in Konfi, Team und Legende dieselbe Farbe', () => {
  it('die Konfi-Liste faerbt abgesagte Termine rot (nicht grau)', async () => {
    await oeffneKonfiListe();
    const k = karte(zeileVon('Konfi-Freizeit'));
    expect(k.rand).toBe(ROT);
    expect(k.kreis).toBe(ROT);
    // Das Eck-Badge sagt "Abgesagt" und ist ebenfalls rot.
    const badge = within(zeileVon('Konfi-Freizeit')).getByRole('img', { name: 'Abgesagt' });
    expect(badge.style.backgroundColor).toBe(ROT);
  });

  it('das Konfi-Detail faerbt abgesagte Termine rot', async () => {
    await oeffneKonfiDetail(77);
    expect(kopfVerlauf()).toBe(`linear-gradient(135deg, ${ROT} 0%, ${ROT} 100%)`);
    expect(document.querySelector('.app-header-banner__subtitle')!.textContent).toBe('Abgesagt');
  });

  it('die Teamer-Liste faerbt abgesagte Termine rot -- also genauso wie die Konfi-Liste', async () => {
    await oeffneListe('alle');
    const k = karte(zeileVon('Konfi-Freizeit'));
    expect(k.rand).toBe(ROT);
    expect(k.kreis).toBe(ROT);
    // Gegenprobe: der offene Termin daneben ist nicht rot.
    expect(karte(zeileVon('Stadtrallye')).rand).not.toBe(ROT);
  });

  it('das Teamer-Detail faerbt abgesagte Termine rot -- also genauso wie das Konfi-Detail', async () => {
    await oeffneTermin('Konfi-Freizeit');
    expect(kopfVerlauf()).toBe(`linear-gradient(135deg, ${ROT} 0%, ${ROT} 100%)`);
    expect(document.querySelector('.app-header-banner__subtitle')!.textContent).toBe('Abgesagt');
  });

  it.each(['konfi', 'teamer', 'admin'] as EventLegendVariant[])(
    'die gemeinsame Legende nennt die Absage fuer %s in Rot',
    async (variante) => {
      const EventLegendModal = (await import('../../components/shared/EventLegendModal')).default;
      render(<EventLegendModal variant={variante} onClose={() => undefined} />);
      const eintraege = screen.getAllByText('Absage / Abmeldung');
      expect(eintraege).toHaveLength(1);
      // Zeile der Legende: Farbkreis, daneben Titel und Beschreibung.
      const kreis = eintraege[0].parentElement!.previousElementSibling as HTMLElement;
      expect(kreis.style.background).toBe(ROT);
    },
  );
});

describe('Das Graue an einem abgesagten Termin ist der Titel -- in Konfi UND Team', () => {
  it('die Konfi-Liste setzt den Titel eines abgesagten Termins auf app-text-muted', async () => {
    await oeffneKonfiListe();
    expect(karte(zeileVon('Konfi-Freizeit')).titelFarbe).toBe(GRAU_TEXT);
  });

  it('die Teamer-Liste tut dasselbe -- gleiche Bedingung, gleiches Token', async () => {
    await oeffneListe('alle');
    expect(karte(zeileVon('Konfi-Freizeit')).titelFarbe).toBe(GRAU_TEXT);
    // Der offene Termin behaelt die normale Titelfarbe.
    expect(karte(zeileVon('Stadtrallye')).titelFarbe).toBe('');
  });

  it('und beide streichen den Titel durch -- den offenen nicht', async () => {
    await oeffneKonfiListe();
    expect(karte(zeileVon('Konfi-Freizeit')).titelDeko).toBe('line-through');
    document.body.innerHTML = '';
    await oeffneListe('alle');
    expect(karte(zeileVon('Konfi-Freizeit')).titelDeko).toBe('line-through');
    expect(karte(zeileVon('Stadtrallye')).titelDeko).toBe('none');
  });
});

describe('Der Hinweis in der Karte "Bist du dabei?" ist grau -- in beiden Rollen', () => {
  it('die Konfi-Ansicht zeigt ihn als graue Notiz (IonNote color="medium")', async () => {
    await oeffneKonfiDetail(77);
    const { note, rotBox } = absageHinweis();
    expect(note?.getAttribute('data-color')).toBe('medium');
    expect(rotBox).toBeNull();
  });

  it('die Teamer-Ansicht zeigt ihn in derselben Darstellung, in der Karte "Bist du dabei?"', async () => {
    await oeffneTermin('Konfi-Freizeit');
    const { note } = absageHinweis();
    expect(note?.getAttribute('data-color')).toBe('medium');
    expect(zusageKarte()!.textContent).toContain('Dieses Event ist abgesagt');
  });

  it('und NICHT mehr in der roten Statusbox', async () => {
    await oeffneTermin('Konfi-Freizeit');
    expect(absageHinweis().rotBox).toBeNull();
    expect(zusageKarte()!.querySelector('.app-status-box--danger')).toBeNull();
  });

  it('die Listenfarbe bleibt in BEIDEN Rollen rot -- nur der Hinweis wird grau', async () => {
    // Simons Vorgabe: "an allen anderen stellen nicht."
    await oeffneKonfiListe();
    expect(karte(zeileVon('Konfi-Freizeit')).rand).toBe(ROT);
    document.body.innerHTML = '';
    await oeffneListe('alle');
    expect(karte(zeileVon('Konfi-Freizeit')).rand).toBe(ROT);
  });
});
