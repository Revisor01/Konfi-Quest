// Die Seite einer Challenge fuer Konfis in der Web-Fassung, gerendert
// (docs/planung/web-alle-bereiche.md, Entscheidung 6): zwei Spalten, links
// Aufgabe und Beitraege als Raster (Feed der Gruppe, eigene Beitraege),
// rechts "Mitmachen" mit dem Knopf zum Einreichen, Angaben und Stempel.
// Alles ueber dieselbe Logik wie die Ansicht der App
// (useKonfiChallengeAnsicht): wann die Challenge laeuft, wer einreichen darf,
// was unter welchem Reiter steht. Im schmalen Fenster bleibt die App-Ansicht.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({
  breit: true,
  push: vi.fn(),
  presentModal: vi.fn(),
  dateiOeffnen: vi.fn(),
  setError: vi.fn(),
  markChallengeAsRead: vi.fn(),
  apiGet: vi.fn(),
  neuigkeiten: {} as Record<number, number>,
}));

vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonRouter: () => ({ push: h.push }),
  useIonModal: () => [h.presentModal, vi.fn()],
}));
vi.mock('../../../contexts/AppContext', () => {
  // Stabile Identitaeten wie im echten Kontext: Eine je Rendern neue Attrappe liesse das Laden endlos neu anlaufen.
  const stabil = { user: { id: 31, type: 'konfi', organization_id: 1 }, setError: h.setError };
  return { useApp: () => stabil };
});
vi.mock('../../../contexts/BadgeContext', () => ({
  useBadge: () => ({ markChallengeAsRead: h.markChallengeAsRead, challengeUpdatesByChallenge: h.neuigkeiten }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet } }));
vi.mock('../../../hooks/useDateiOeffnen', () => ({ useDateiOeffnen: () => ({ dateiOeffnen: h.dateiOeffnen }) }));
vi.mock('../../../components/shared/ChallengeMedium', () => ({
  default: ({ filePath, mediaType, maxHoehe, onOeffnen }: { filePath: string; mediaType: string; maxHoehe: number; onOeffnen?: (p: string, n: string) => void }) => (
    <div data-testid="medium" data-art={mediaType} data-pfad={filePath} data-hoehe={maxHoehe}>
      <button type="button" onClick={() => onOeffnen?.(filePath, 'datei.jpg')}>öffnen {filePath}</button>
    </div>
  ),
}));
vi.mock('../../../components/shared/AppKopfzeile', () => ({
  default: ({ titel }: { titel: React.ReactNode }) => <header data-testid="kopfzeile">{titel}</header>,
  AppKopfzeileGross: () => null,
}));

import KonfiChallengeDetailPage from '../../../components/konfi/pages/KonfiChallengeDetailPage';
import { offlineCache } from '../../../services/offlineCache';

const JETZT = new Date('2026-10-03T08:30:00Z').getTime();
const tage = (n: number) => new Date(JETZT + n * 24 * 3600 * 1000).toISOString();
const vor = (stunden: number) => new Date(JETZT - stunden * 3600 * 1000).toISOString();

const CHALLENGE = {
  id: 7,
  title: 'Mein Lieblingsplatz',
  description: 'Fotografiert den Ort, an dem ihr euch am wohlsten fühlt.',
  challenge_type: 'frei',
  audience: 'konfis',
  visibility: 'public',
  moderated: false,
  allowed_media: ['photo', 'text'],
  allow_multiple: true,
  badge_icon: 'camera',
  badge_name: 'Fotograf:in',
  author_freetext: 'Konfi-Team',
  starts_at: tage(-8),
  ends_at: tage(6),
  is_draft: false,
};

const galerie = (id: number, name: string | null, extra: Record<string, unknown> = {}) => ({
  id, media_type: 'text', text_content: `Beitrag ${id}`, file_path: null, file_name: null, link_url: null, created_at: vor(id),
  display_name: name, role_name: name ? 'konfi' : null, jahrgang_name: name ? '2026/2027' : null, is_anonymous: !name, ...extra,
});

const GALERIE = [
  galerie(1, 'Jonas Muster', { media_type: 'photo', file_path: 'foto-abc', file_name: 'kirche.jpg', text_content: 'Die Kirche am Abend' }),
  galerie(2, null, { text_content: 'Ein Beitrag ohne Namen' }),
  galerie(3, 'Kim Zeiger', { role_name: 'teamer', text_content: 'Auch das Team macht mit' }),
];

const EIGENE = [
  { id: 9, media_type: 'text', text_content: 'Meine Bank unter dem Baum', moderation_status: 'approved', konfi_consent: 'publish', created_at: vor(30) },
  { id: 10, media_type: 'text', text_content: 'Noch nicht freigegeben', moderation_status: 'pending', konfi_consent: 'publish', created_at: vor(3) },
  { id: 11, media_type: 'text', text_content: 'Zurueckgehalten', moderation_status: 'hidden', moderation_note: 'Bitte ohne Namen Dritter.', konfi_consent: 'publish', created_at: vor(2) },
];

const fehlerMitStatus = (status: number) => Object.assign(new Error(String(status)), { response: { status, data: { error: 'x' } } });
const netzWeg = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });

const antworten = (challenge: Record<string, unknown> = CHALLENGE, gallery: unknown[] = GALERIE, own: unknown[] = []) => {
  h.apiGet.mockResolvedValue({ data: { challenge, gallery, own_submissions: own } });
};
const oeffne = (onBack = vi.fn()) => ({ onBack, ...render(<KonfiChallengeDetailPage challengeId={7} onBack={onBack} />) });
const zeigen = async () => {
  const r = oeffne();
  await screen.findByRole('heading', { level: 1, name: 'Mein Lieblingsplatz' });
  await screen.findByRole('list', { name: /Aus deiner Gruppe|Deine? Beiträge?|Dein Beitrag/ });
  return r;
};
const beitraege = () => [...screen.getByRole('list', { name: /Aus deiner Gruppe|Deine Beiträge|Dein Beitrag/ }).children] as HTMLElement[];
const chip = (name: RegExp | string) => within(screen.getByRole('group', { name: 'Beiträge' })).getByRole('button', { name });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  h.breit = true;
  h.neuigkeiten = {};
  h.apiGet.mockReset();
  antworten();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(JETZT));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Challenge der Konfis (Web): Kopf, Aufgabe und Angaben', () => {
  it('Titel, Weg zurueck als Link zur Liste, Zustand und Restzeit, Aufgabe mit Sichtbarkeit', async () => {
    await zeigen();
    expect(screen.getByRole('link', { name: 'Alle Challenges' }).getAttribute('href')).toBe('/konfi/challenges');
    const kopf = screen.getByRole('heading', { level: 1 }).closest('header')!;
    expect(kopf).toHaveTextContent('Läuft');
    expect(kopf).toHaveTextContent('Noch 6 Tage');
    const aufgabe = screen.getByRole('region', { name: 'Worum geht es?' });
    expect(aufgabe).toHaveTextContent('Fotografiert den Ort, an dem ihr euch am wohlsten fühlt.');
    expect(aufgabe).toHaveTextContent('Für die Gruppe sichtbar');
    expect(aufgabe).toHaveTextContent('Sofort sichtbar');
    expect(aufgabe).toHaveTextContent('Gestellt von Konfi-Team');
  });

  it('die Angaben: Status, Zeitraum, Zielgruppe, Sichtbarkeit, Freigabe, Urheber:in', async () => {
    await zeigen();
    const angaben = screen.getByRole('region', { name: 'Angaben' });
    const wert = (label: string) => within(angaben).getByText(label).closest('div')!.querySelector('dd')!;
    expect(wert('Status')).toHaveTextContent('Läuft');
    expect(wert('Zeitraum')).toHaveTextContent('25.09. – 09.10.2026');
    expect(wert('Zeitraum')).toHaveTextContent('Noch 6 Tage');
    expect(wert('Zielgruppe')).toHaveTextContent('Nur Konfis');
    expect(wert('Sichtbarkeit')).toHaveTextContent('Für die Gruppe sichtbar');
    expect(wert('Freigabe')).toHaveTextContent('Sofort sichtbar');
    expect(wert('Gestellt von')).toHaveTextContent('Konfi-Team');
  });

  it('mit Freigabe und ohne Urheber: "Sichtbar nach Freigabe", die Zeile "Gestellt von" entfaellt', async () => {
    antworten({ ...CHALLENGE, moderated: true, author_freetext: null });
    await zeigen();
    expect(screen.getByRole('region', { name: 'Angaben' })).toHaveTextContent('Sichtbar nach Freigabe');
    expect(within(screen.getByRole('region', { name: 'Angaben' })).queryByText('Gestellt von')).toBeNull();
  });

  it('der Stempel: ohne eigenen freigegebenen Beitrag was zu tun ist, danach "gehoert dir"', async () => {
    await zeigen();
    expect(screen.getByRole('region', { name: 'Stempel' })).toHaveTextContent('Fotograf:in');
    expect(screen.getByRole('region', { name: 'Stempel' })).toHaveTextContent('Mach bei dieser Challenge mit, dann gehört dir der Stempel.');
    cleanup();
    antworten(CHALLENGE, GALERIE, EIGENE);
    await zeigen();
    expect(screen.getByRole('region', { name: 'Stempel' })).toHaveTextContent('Der Stempel gehört dir.');
  });

  it('beendet: "Worum ging es?", Zustand "Beendet", Stempel gibt es nicht mehr', async () => {
    antworten({ ...CHALLENGE, starts_at: tage(-30), ends_at: tage(-10) });
    await zeigen();
    expect(screen.getByRole('region', { name: 'Worum ging es?' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Angaben' })).toHaveTextContent('Beendet');
    expect(screen.getByRole('region', { name: 'Stempel' })).toHaveTextContent('Diese Challenge ist vorbei. Den Stempel gibt es dafür nicht mehr.');
  });
});

describe('Challenge der Konfis (Web): Beitraege als Raster', () => {
  it('der Feed zeigt die Galerie mit Name und Herkunft, anonyme ohne Namen, das Team als Teamer:in', async () => {
    await zeigen();
    expect(screen.getByRole('heading', { level: 2, name: 'Aus deiner Gruppe' })).toBeInTheDocument();
    const namen = beitraege().map((b) => b.querySelector('.web-beitrag__name')?.textContent);
    expect(namen).toEqual(['Jonas Muster · 2026/2027', 'Anonym', 'Kim Zeiger · Teamer:in']);
    expect(beitraege()[1]).not.toHaveTextContent('Unbekannt');
    expect(beitraege()[2]).toHaveTextContent('Auch das Team macht mit');
  });

  it('Bilder gross; antippen oeffnet das Foto wie in der App', async () => {
    await zeigen();
    const medium = within(beitraege()[0]).getByTestId('medium');
    expect(medium).toHaveAttribute('data-pfad', 'foto-abc');
    expect(medium).toHaveAttribute('data-hoehe', '420');
    fireEvent.click(within(medium).getByRole('button'));
    expect(h.dateiOeffnen).toHaveBeenCalledWith('foto-abc', 'datei.jpg');
  });

  it('die Chips tragen die Zahl; "Meins" zeigt die eigenen Beitraege mit ihrem Zustand', async () => {
    antworten(CHALLENGE, GALERIE, EIGENE);
    await zeigen();
    expect(chip(/^Feed/)).toHaveTextContent('3');
    expect(chip(/^Meins/)).toHaveTextContent('3');
    fireEvent.click(chip(/^Meins/));
    expect(screen.getByRole('heading', { level: 2, name: 'Deine Beiträge' })).toBeInTheDocument();
    // Neueste zuerst im Datensatz des Servers; die Marken tragen die Worte der App.
    const texte = beitraege().map((b) => b.querySelector('.web-beitrag__text')?.textContent);
    expect(texte).toEqual(['Meine Bank unter dem Baum', 'Noch nicht freigegeben', 'Zurueckgehalten']);
    expect(beitraege()[0]).toHaveTextContent('Dein Beitrag');
    expect(beitraege()[0]).toHaveTextContent('Veröffentlicht');
    expect(beitraege()[1]).toHaveTextContent('Wartet auf Freigabe');
    expect(beitraege()[2]).toHaveTextContent('Ausgeblendet');
    expect(beitraege()[2]).toHaveTextContent('Grund der Ablehnung');
    expect(beitraege()[2]).toHaveTextContent('Bitte ohne Namen Dritter.');
  });

  it('ein einzelner eigener Beitrag: "Dein Beitrag" in der Einzahl', async () => {
    antworten(CHALLENGE, GALERIE, [EIGENE[0]]);
    await zeigen();
    fireEvent.click(chip(/^Meins/));
    expect(screen.getByRole('heading', { level: 2, name: 'Dein Beitrag' })).toBeInTheDocument();
  });

  it('"nur Leitung": keine Gruppen-Galerie, keine Reiter, nur die eigenen Beitraege', async () => {
    antworten({ ...CHALLENGE, visibility: 'private' }, [], EIGENE);
    oeffne();
    await screen.findByRole('heading', { level: 2, name: 'Deine Beiträge' });
    expect(screen.queryByRole('group', { name: 'Beiträge' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Worum geht es?' })).toHaveTextContent('Nur das Leitungsteam sieht die Beiträge');
    expect(screen.getByRole('region', { name: 'Angaben' })).not.toHaveTextContent('Freigabe');
  });

  it('leere Zustaende: Galerie, eigene Beitraege (laufend und beendet)', async () => {
    antworten(CHALLENGE, [], []);
    oeffne();
    expect(await screen.findByRole('heading', { level: 3, name: 'Noch keine geteilten Beiträge' })).toBeInTheDocument();
    fireEvent.click(chip(/^Meins/));
    expect(screen.getByRole('heading', { level: 3, name: 'Noch kein Beitrag von dir' })).toBeInTheDocument();
    expect(screen.getByText('Reiche rechts unter „Mitmachen“ deinen Beitrag ein.')).toBeInTheDocument();
    cleanup();
    antworten({ ...CHALLENGE, starts_at: tage(-30), ends_at: tage(-10) }, [], []);
    oeffne();
    expect(await screen.findByText('Aus dieser Challenge hat niemand aus deiner Gruppe etwas veröffentlicht.')).toBeInTheDocument();
    fireEvent.click(chip(/^Meins/));
    expect(screen.getByText('Diese Challenge ist beendet — du hattest nichts eingereicht.')).toBeInTheDocument();
  });

  it('ohne Netz und ohne Stand: sagt, dass die Beitraege fehlen, statt eine leere Galerie zu zeigen', async () => {
    await offlineCache.set('konfi:challenges:31', { active: [CHALLENGE], archive: [], marks: [] }, 60_000);
    h.apiGet.mockRejectedValue(netzWeg);
    oeffne();
    expect(await screen.findByText('Die Liste der Beiträge ist offline nicht verfügbar.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Mein Lieblingsplatz' })).toBeInTheDocument();
    expect(screen.queryByText('Noch keine geteilten Beiträge')).toBeNull();
  });
});

describe('Challenge der Konfis (Web): Mitmachen', () => {
  it('der Knopf oeffnet das Einreich-Formular der App; darunter, wer den Beitrag sieht', async () => {
    await zeigen();
    const karte = screen.getByRole('region', { name: 'Mitmachen' });
    expect(karte).toHaveTextContent('Für deine Gruppe sofort sichtbar');
    fireEvent.click(within(karte).getByRole('button', { name: 'Beitrag einreichen' }));
    expect(h.presentModal).toHaveBeenCalledTimes(1);
  });

  it('einmal pro Person: nach dem eigenen Beitrag kein Knopf, aber der Grund', async () => {
    antworten({ ...CHALLENGE, allow_multiple: false }, GALERIE, [EIGENE[0]]);
    await zeigen();
    const karte = screen.getByRole('region', { name: 'Mitmachen' });
    expect(within(karte).queryByRole('button')).toBeNull();
    expect(karte).toHaveTextContent('Du hast schon einen Beitrag eingereicht — bei dieser Challenge gibt es nur einen je Person.');
  });

  it('einmal pro Person, aber noch nichts eingereicht: der Knopf steht', async () => {
    antworten({ ...CHALLENGE, allow_multiple: false });
    await zeigen();
    expect(screen.getByRole('button', { name: 'Beitrag einreichen' })).toBeInTheDocument();
  });

  it('beendet: kein Knopf, der Grund steht da', async () => {
    antworten({ ...CHALLENGE, starts_at: tage(-30), ends_at: tage(-10) });
    await zeigen();
    expect(screen.queryByRole('button', { name: 'Beitrag einreichen' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Mitmachen' })).toHaveTextContent('Diese Challenge ist beendet — Beiträge lassen sich nicht mehr einreichen.');
  });
});

describe('Challenge der Konfis (Web): die Uhr', () => {
  // Wie in der App (challengeEndetBeiOffenemDetail): "laeuft" folgt der Uhr, auch bei offener Seite.
  // Echte Zeit statt Uhr-Attrappe: Die Challenge endet 1,2 s nach dem Oeffnen.
  it('endet die Challenge bei offener Seite, wechselt sie auf "Beendet" -- ohne neuen Abruf', async () => {
    vi.useRealTimers();
    const ende = new Date(Date.now() + 1200).toISOString();
    antworten({ ...CHALLENGE, starts_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), ends_at: ende }, [], []);
    oeffne();
    expect(await screen.findByRole('region', { name: 'Worum geht es?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beitrag einreichen' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('region', { name: 'Worum ging es?' })).toBeInTheDocument(), { timeout: 4000 });
    expect(screen.queryByRole('button', { name: 'Beitrag einreichen' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Mitmachen' })).toHaveTextContent('Diese Challenge ist beendet');
    expect(h.apiGet).toHaveBeenCalledTimes(1);
  });
});

describe('Challenge der Konfis (Web): Neuigkeiten und Gelesen-Melden', () => {
  it('meldet die Challenge beim Oeffnen genau einmal als gelesen', async () => {
    await zeigen();
    await waitFor(() => expect(h.markChallengeAsRead).toHaveBeenCalledTimes(1));
    expect(h.markChallengeAsRead).toHaveBeenCalledWith(7);
  });

  it('der Hinweis nennt die Zahl, die beim Oeffnen noch rot an der Karte stand', async () => {
    h.neuigkeiten = { 7: 3 };
    await zeigen();
    expect(screen.getByRole('status')).toHaveTextContent('Seit deinem letzten Besuch');
    expect(screen.getByRole('status')).toHaveTextContent('3 Neuigkeiten');
  });

  it('eine Neuigkeit in der Einzahl; nichts Neues: kein Hinweis', async () => {
    h.neuigkeiten = { 7: 1 };
    await zeigen();
    expect(screen.getByRole('status')).toHaveTextContent('1 Neuigkeit');
    expect(screen.getByRole('status')).not.toHaveTextContent('1 Neuigkeiten');
    cleanup();
    h.neuigkeiten = {};
    await zeigen();
    expect(screen.queryByText('Seit deinem letzten Besuch')).toBeNull();
  });
});

describe('Challenge der Konfis (Web): laedt, gibt es nicht, nicht fuer dich', () => {
  it('waehrend des Ladens Platzhalter', () => {
    h.apiGet.mockReturnValue(new Promise(() => undefined));
    oeffne();
    expect(screen.getByRole('status')).toHaveTextContent('Challenge wird geladen...');
  });

  it('geloescht (404): freundlicher Hinweis mit Weg zur Liste, kein Fehlerkasten, nichts gemeldet', async () => {
    h.apiGet.mockRejectedValue(fehlerMitStatus(404));
    const { onBack } = oeffne();
    expect(await screen.findByRole('heading', { level: 3, name: 'Diese Challenge gibt es nicht mehr' })).toBeInTheDocument();
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.markChallengeAsRead).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Zu den Challenges' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('anderer Jahrgang (403): eigener Hinweis', async () => {
    h.apiGet.mockRejectedValue(fehlerMitStatus(403));
    oeffne();
    expect(await screen.findByRole('heading', { level: 3, name: 'Diese Challenge ist nicht für dich' })).toBeInTheDocument();
  });

  it('ganz unbekannt ohne Netz: sagt, dass es eine Verbindung braucht', async () => {
    h.apiGet.mockRejectedValue(netzWeg);
    oeffne();
    expect(await screen.findByRole('heading', { level: 3, name: 'Keine Verbindung' })).toBeInTheDocument();
  });

  // Der Rahmen bleibt beim Wechsel von "laedt" zur Challenge derselbe: Baute er sich neu auf,
  // verschwaende Ionics IonContent mitten im Messen (TypeError in readDimensions).
  it('vom Laden zur Challenge bleibt derselbe IonContent und dieselbe IonPage', async () => {
    let antwort: (v: unknown) => void = () => undefined;
    h.apiGet.mockReturnValue(new Promise((r) => { antwort = r; }));
    const { container } = oeffne();
    const inhaltVorher = container.querySelector('ion-content');
    const seiteVorher = container.querySelector('.ion-page');
    expect(inhaltVorher).not.toBeNull();
    antwort({ data: { challenge: CHALLENGE, gallery: GALERIE, own_submissions: [] } });
    await screen.findByRole('heading', { level: 1, name: 'Mein Lieblingsplatz' });
    expect(container.querySelectorAll('ion-content')).toHaveLength(1);
    expect(container.querySelector('ion-content')).toBe(inhaltVorher);
    expect(container.querySelectorAll('.ion-page')).toHaveLength(1);
    expect(container.querySelector('.ion-page')).toBe(seiteVorher);
  });
});

describe('Challenge der Konfis: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die Ansicht der App, ohne Web-Klassen', async () => {
    h.breit = false;
    const { container } = oeffne();
    await waitFor(() => expect(container.textContent).toContain('Mein Lieblingsplatz'));
    await waitFor(() => expect(container.querySelector('.app-list-item--challenges')).not.toBeNull());
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(container.querySelector('.web-beitraege')).toBeNull();
  });

  it('im breiten Fenster stehen weder Listenelemente noch Segmente der App', async () => {
    const { container } = await zeigen();
    expect(container.querySelector('.app-list-item')).toBeNull();
    expect(container.querySelector('ion-segment, ion-item, ion-card, ion-list')).toBeNull();
  });
});
