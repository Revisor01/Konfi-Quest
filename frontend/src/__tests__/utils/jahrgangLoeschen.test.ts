// Die Rueckfrage vor dem Loeschen eines Jahrgangs nennt, was mitgeht
// (28.09.2026). Seit das Loeschen die Events und Challenges des Jahrgangs
// mitnimmt (Simon, 28.09.2026), darf die Rueckfrage nicht mehr nur vom
// Chatverlauf sprechen -- sonst loescht jemand zwanzig Termine, weil er einen
// leeren Jahrgang vermutet hat.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { jahrgangLoeschHinweis, istLoeschVorschau, type JahrgangLoeschVorschau } from '../../utils/jahrgangLoeschen';

const leer: JahrgangLoeschVorschau = {
  aktive_konfis: 0, befoerderte: 0, chat_nachrichten: 0,
  events_geloescht: 0, events_kuenftig: 0, events_behalten: 0,
  challenges_geloescht: 0, challenges_behalten: 0
};

describe('jahrgangLoeschHinweis', () => {
  it('nennt die Zahl der Events und Challenges, die mitgehen, und die kuenftigen darunter', () => {
    const text = jahrgangLoeschHinweis('2023/2024', { ...leer, events_geloescht: 12, events_kuenftig: 2, challenges_geloescht: 3 });
    expect(text).toContain('Jahrgang "2023/2024" wirklich löschen?');
    expect(text).toContain('Mit dem Jahrgang werden 12 Events und 3 Challenges gelöscht — samt Anmeldungen, Chats und Beiträgen.');
    expect(text).toContain('2 Events liegen noch in der Zukunft.');
    expect(text).toContain('Stempel, die Teamer:innen und Leitung in diesen Challenges bekommen haben, bleiben ihnen erhalten.');
    expect(text).toContain('Das lässt sich nicht rückgängig machen.');
  });

  it('spricht die Einzahl richtig aus', () => {
    const text = jahrgangLoeschHinweis('A', { ...leer, events_geloescht: 1, events_kuenftig: 1, challenges_geloescht: 1, befoerderte: 1 });
    expect(text).toContain('Mit dem Jahrgang werden 1 Event und 1 Challenge gelöscht');
    expect(text).toContain('Ein Event liegt noch in der Zukunft.');
    expect(text).toContain('1 zur Teamer:in beförderte Konfi behält ihre Konfi-Zeit mit Punkten und Badges.');
  });

  it('sagt, was bleibt: Events und Challenges anderer Jahrgaenge verlieren nur die Zuordnung', () => {
    const text = jahrgangLoeschHinweis('A', { ...leer, events_behalten: 2, challenges_behalten: 1 });
    expect(text).toContain('Zum Jahrgang gehören keine eigenen Events und Challenges.');
    expect(text).toContain('2 Events und 1 Challenge gehören auch zu anderen Jahrgängen oder dem Team und bleiben bestehen; nur die Zuordnung zu diesem Jahrgang fällt weg.');
    expect(text).not.toContain('Stempel');
  });

  it('warnt vor aktiven Konfis, die das Loeschen blockieren', () => {
    const text = jahrgangLoeschHinweis('A', { ...leer, aktive_konfis: 12 });
    expect(text).toContain('Dem Jahrgang sind noch 12 aktive Konfis zugeordnet — solange ist das Löschen nicht möglich.');
  });

  it('ohne Vorschau (aelterer Server) steht die allgemeine Fassung -- ohne Zahlen, aber mit Events und Challenges', () => {
    const text = jahrgangLoeschHinweis('A', null);
    expect(text).toContain('die Events und Challenges, die nur zu ihm gehören, werden unwiderruflich entfernt');
    expect(text).not.toMatch(/\d+ Events?/);
  });
});

describe('istLoeschVorschau', () => {
  it('nimmt nur vollstaendige Antworten', () => {
    expect(istLoeschVorschau(leer)).toBe(true);
    expect(istLoeschVorschau({ ...leer, events_geloescht: '3' })).toBe(false);
    expect(istLoeschVorschau({ aktive_konfis: 0 })).toBe(false);
    expect(istLoeschVorschau(null)).toBe(false);
    expect(istLoeschVorschau([])).toBe(false);
  });
});

describe('AdminJahrgaengeePage fragt mit Zahlen nach', () => {
  const seite = readFileSync(resolve(__dirname, '../../components/admin/pages/AdminJahrgaengeePage.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('holt die Vorschau und baut den Text daraus', () => {
    expect(seite).toContain('/loeschvorschau`');
    expect(seite).toContain('message: jahrgangLoeschHinweis(jahrgang.name, vorschau)');
  });

  it('der alte Text, der nur vom Chatverlauf sprach, ist weg', () => {
    expect(seite).not.toContain('Der Jahrgang und sein Chatverlauf werden unwiderruflich entfernt.');
  });
});
