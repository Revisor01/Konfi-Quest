// Tests fuer die Musik-Link-Erlaubnisliste (utils/musikLinks.js).
//
// Die Liste ist eine Sicherheitsgrenze: Link-Beitraege duerfen NUR zu den
// vier Musikdiensten fuehren. Deshalb hier beide Seiten — erlaubte Links
// UND die bekannten Umgehungsversuche (Query-Trick, fremde Subdomain,
// Userinfo, javascript:). Dazu der Metadaten-Abruf mit injiziertem fetch
// (nie echtes Netz im Test) und die Paritaetspruefung gegen die
// Frontend-Kopie der Liste.
const {
  MUSIK_DIENSTE,
  ERLAUBTE_DIENSTE_TEXT,
  pruefeMusikLink,
  holeLinkMetadaten
} = require('../../utils/musikLinks');

describe('pruefeMusikLink — erlaubte Links', () => {
  const erlaubt = [
    ['https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', 'spotify'],
    // Sprach-Segment im Pfad, Query-Parameter
    ['https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC?si=abc123', 'spotify'],
    // Grossschreibung: URL normalisiert Protokoll und Host
    ['HTTPS://OPEN.SPOTIFY.COM/track/4uLU6hMCjMI75M1A2tKUQC', 'spotify'],
    // http statt https: die Dienste leiten selbst um
    ['http://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', 'spotify'],
    // Angehaengter Punkt im Host wird normalisiert
    ['https://open.spotify.com./track/4uLU6hMCjMI75M1A2tKUQC', 'spotify'],
    // Kurzlink aus dem Teilen-Dialog der App
    ['https://spotify.link/AbCdEfGhIj', 'spotify'],
    ['https://music.apple.com/de/album/album-name/1440833098?i=1440833544', 'apple_music'],
    ['https://music.apple.com/de/song/song-name/1440833544', 'apple_music'],
    ['https://geo.music.apple.com/de/album/x/1440833098', 'apple_music'],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube_music'],
    ['https://www.deezer.com/de/track/3135556', 'deezer'],
    ['https://deezer.com/track/3135556', 'deezer'],
    ['https://link.deezer.com/s/abcdef', 'deezer'],
    ['https://dzr.page.link/abcdef', 'deezer'],
    ['https://deezer.page.link/abcdef', 'deezer'],
    // Fuehrende/abschliessende Leerzeichen (Copy-Paste vom Handy)
    ['  https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC  ', 'spotify']
  ];

  it.each(erlaubt)('%s -> erlaubt (%s)', (url, dienstId) => {
    const ergebnis = pruefeMusikLink(url);
    expect(ergebnis.ok).toBe(true);
    expect(ergebnis.dienst.id).toBe(dienstId);
  });
});

describe('pruefeMusikLink — verbotene Links und Umgehungsversuche', () => {
  const verboten = [
    // Erlaubter Host nur im Query-String — includes() wuerde reinfallen
    'https://boese.de/?x=open.spotify.com',
    // Erlaubter Host als Praefix einer fremden Domain
    'https://open.spotify.com.boese.de/track/x',
    // Userinfo-Trick: echter Host ist boese.de
    'https://open.spotify.com@boese.de/track/x',
    // Schema-Angriffe
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://open.spotify.com/track/x',
    // Normales YouTube ist NICHT YouTube Music
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    // Hauptseiten/Kurzlinks, die nicht auf der Liste stehen
    'https://spotify.com/track/x',
    'https://www.spotify.com/de/',
    'https://apple.co/abcdef',
    'https://itunes.apple.com/de/album/x/1440833098',
    // Beliebige fremde Seiten
    'https://example.org/song',
    'https://soundcloud.com/artist/track',
    // Kein Link
    'nicht-http',
    'open.spotify.com/track/x',
    ''
  ];

  it.each(verboten)('%s -> abgelehnt', (url) => {
    expect(pruefeMusikLink(url)).toEqual({ ok: false });
  });

  it('null/undefined/Nicht-String -> abgelehnt', () => {
    expect(pruefeMusikLink(null)).toEqual({ ok: false });
    expect(pruefeMusikLink(undefined)).toEqual({ ok: false });
    expect(pruefeMusikLink(42)).toEqual({ ok: false });
  });
});

describe('holeLinkMetadaten', () => {
  const okAntwort = (body) => ({ ok: true, json: async () => body });

  const htmlAntwort = (body) => ({ ok: true, text: async () => body });
  const SPOTIFY_TRACK = 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC';

  it('Spotify: fragt den oEmbed-Endpunkt an und liefert Titel', async () => {
    const fetchImpl = vi.fn(async () =>
      okAntwort({ title: 'Never Gonna Give You Up', author_name: 'Rick Astley', provider_name: 'Spotify' }));
    const meta = await holeLinkMetadaten(SPOTIFY_TRACK, { fetchImpl });
    expect(meta).toEqual({ title: 'Never Gonna Give You Up', author: 'Rick Astley', album: null });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://open.spotify.com/oembed?url=' + encodeURIComponent(SPOTIFY_TRACK)
    );
  });

  // Spotifys oEmbed liefert seit 2026 KEIN author_name mehr (am 26.08.2026
  // gemessen). Dann wird der Interpret aus der Embed-Seite nachgeholt —
  // sonst staende bei Spotify-Links kein Interpret, wo Deezer, YouTube und
  // Apple einen zeigen (User-Hinweis 26.08.2026).
  describe('Spotify ohne author_name im oEmbed', () => {
    it('holt den Interpreten aus der Embed-Seite nach (Titel-Link)', async () => {
      const fetchImpl = vi.fn(async (url) =>
        String(url).includes('/oembed')
          ? okAntwort({ title: 'Never Gonna Give You Up', provider_name: 'Spotify' })
          : htmlAntwort('{"artists":[{"name":"Rick Astley","uri":"spotify:artist:0gx"}]}'));
      const meta = await holeLinkMetadaten(SPOTIFY_TRACK, { fetchImpl });
      expect(meta).toEqual({ title: 'Never Gonna Give You Up', author: 'Rick Astley', album: null });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(fetchImpl.mock.calls[1][0]).toBe(
        'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC'
      );
    });

    it('Album-Links tragen den Interpreten unter "subtitle"', async () => {
      const fetchImpl = vi.fn(async (url) =>
        String(url).includes('/oembed')
          ? okAntwort({ title: 'Whenever You Need Somebody', provider_name: 'Spotify' })
          : htmlAntwort('{"subtitle":"Rick Astley"}'));
      const meta = await holeLinkMetadaten(
        'https://open.spotify.com/album/6N9PS4QXF1D0OWPk0Sxtb4', { fetchImpl });
      expect(meta).toEqual({ title: 'Whenever You Need Somebody', author: 'Rick Astley', album: null });
    });

    it('loest JSON-Escapes im Namen auf', async () => {
      const fetchImpl = vi.fn(async (url) =>
        String(url).includes('/oembed')
          ? okAntwort({ title: 'Halo', provider_name: 'Spotify' })
          : htmlAntwort('{"artists":[{"name":"Beyonc\\u00e9"}]}'));
      const meta = await holeLinkMetadaten(SPOTIFY_TRACK, { fetchImpl });
      expect(meta.author).toBe('Beyoncé');
    });

    it('bleibt beim Titel, wenn die Embed-Seite nichts hergibt', async () => {
      // Faellt der Weg weg (Spotify aendert die Seite), soll der Titel
      // erhalten bleiben statt der ganze Link ohne Angaben dazustehen.
      const fetchImpl = vi.fn(async (url) =>
        String(url).includes('/oembed')
          ? okAntwort({ title: 'Never Gonna Give You Up', provider_name: 'Spotify' })
          : htmlAntwort('<html>nichts brauchbares</html>'));
      const meta = await holeLinkMetadaten(SPOTIFY_TRACK, { fetchImpl });
      expect(meta).toEqual({ title: 'Never Gonna Give You Up', author: null, album: null });
    });

    it('bleibt beim Titel, wenn die Embed-Seite gar nicht antwortet', async () => {
      const fetchImpl = vi.fn(async (url) =>
        String(url).includes('/oembed')
          ? okAntwort({ title: 'Never Gonna Give You Up', provider_name: 'Spotify' })
          : { ok: false });
      const meta = await holeLinkMetadaten(SPOTIFY_TRACK, { fetchImpl });
      expect(meta).toEqual({ title: 'Never Gonna Give You Up', author: null, album: null });
    });
  });

  it('Deezer: liefert Titel UND Interpret (author_name)', async () => {
    const fetchImpl = vi.fn(async () => okAntwort({ title: 'Harder, Better, Faster, Stronger', author_name: 'Daft Punk' }));
    const meta = await holeLinkMetadaten('https://www.deezer.com/de/track/3135556', { fetchImpl });
    expect(meta).toEqual({ title: 'Harder, Better, Faster, Stronger', author: 'Daft Punk', album: null });
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://api.deezer.com/oembed?url=' + encodeURIComponent('https://www.deezer.com/de/track/3135556') + '&format=json'
    );
  });

  it('YouTube Music: fragt das YouTube-oEmbed mit umgeschriebenem Host an', async () => {
    const fetchImpl = vi.fn(async () => okAntwort({ title: 'Song Title', author_name: 'Artist - Topic' }));
    const meta = await holeLinkMetadaten('https://music.youtube.com/watch?v=dQw4w9WgXcQ', { fetchImpl });
    // "- Topic" ist ein Auto-Kanal von YouTube, kein Interpretenname.
    expect(meta).toEqual({ title: 'Song Title', author: 'Artist', album: null });
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=dQw4w9WgXcQ') + '&format=json'
    );
  });

  it('Apple Music: Track im Album (?i=...) laeuft ueber den iTunes-Lookup', async () => {
    const fetchImpl = vi.fn(async () => okAntwort({
      resultCount: 1,
      results: [{ trackName: 'Hey Jude', artistName: 'The Beatles', collectionName: '1 (2015)' }]
    }));
    const meta = await holeLinkMetadaten('https://music.apple.com/de/album/1-2015/1441133100?i=1441133277', { fetchImpl });
    expect(meta).toEqual({ title: 'Hey Jude', author: 'The Beatles', album: '1 (2015)' });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://itunes.apple.com/lookup?id=1441133277&country=de');
  });

  it('Apple Music: Album ohne ?i nimmt die Pfad-ID und den Album-Titel', async () => {
    const fetchImpl = vi.fn(async () => okAntwort({
      resultCount: 1,
      results: [{ collectionName: 'Abbey Road', artistName: 'The Beatles' }]
    }));
    const meta = await holeLinkMetadaten('https://music.apple.com/de/album/abbey-road/1441164426', { fetchImpl });
    // Album-Link: der Album-Titel IST der Titel und darf nicht doppelt stehen.
    expect(meta).toEqual({ title: 'Abbey Road', author: 'The Beatles', album: null });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://itunes.apple.com/lookup?id=1441164426&country=de');
  });

  it('YouTube: "Interpret - Titel" wird aufgeteilt, Kanalname weicht', async () => {
    const fetchImpl = vi.fn(async () => okAntwort({ title: 'Coldplay - Yellow', author_name: 'ColdplayVEVO' }));
    const meta = await holeLinkMetadaten('https://music.youtube.com/watch?v=abc12345678', { fetchImpl });
    expect(meta).toEqual({ title: 'Yellow', author: 'Coldplay', album: null });
  });

  it('YouTube: Titel mit mehreren Bindestrichen wird NICHT zerlegt', async () => {
    // Verbotener Fall: "Ich - Du - Wir" darf nicht zu author "Ich" werden.
    const fetchImpl = vi.fn(async () => okAntwort({ title: 'Ich - Du - Wir', author_name: 'Chor - Topic' }));
    const meta = await holeLinkMetadaten('https://music.youtube.com/watch?v=abc12345678', { fetchImpl });
    expect(meta).toEqual({ title: 'Ich - Du - Wir', author: 'Chor', album: null });
  });

  it('Apple Music: Track ohne eigenes Album bekommt kein Album-Feld', async () => {
    const fetchImpl = vi.fn(async () => okAntwort({
      resultCount: 1,
      results: [{ trackName: 'Single', artistName: 'Wer', collectionName: 'Single' }]
    }));
    const meta = await holeLinkMetadaten('https://music.apple.com/de/album/x/1?i=2', { fetchImpl });
    // Gleicher Text -> kein doppeltes Album.
    expect(meta).toEqual({ title: 'Single', author: 'Wer', album: null });
  });

  it('Apple Music: Playlist (pl.u-...) hat keine numerische ID -> null, kein Request', async () => {
    const fetchImpl = vi.fn();
    const meta = await holeLinkMetadaten('https://music.apple.com/de/playlist/mix/pl.u-abc123', { fetchImpl });
    expect(meta).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('Kurzlinks (spotify.link, dzr.page.link) -> null OHNE Netzanfrage', async () => {
    const fetchImpl = vi.fn();
    expect(await holeLinkMetadaten('https://spotify.link/AbCdEf', { fetchImpl })).toBeNull();
    expect(await holeLinkMetadaten('https://dzr.page.link/abcdef', { fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('Verbotene URL -> null ohne Netzanfrage', async () => {
    const fetchImpl = vi.fn();
    expect(await holeLinkMetadaten('https://example.org/song', { fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('HTTP-Fehler (404) -> null statt Exception', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }));
    expect(await holeLinkMetadaten('https://open.spotify.com/track/x', { fetchImpl })).toBeNull();
  });

  it('Netzwerkfehler (fetch wirft) -> null statt Exception', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('ECONNREFUSED'); });
    expect(await holeLinkMetadaten('https://open.spotify.com/track/x', { fetchImpl })).toBeNull();
  });

  it('Kaputtes JSON -> null statt Exception', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => { throw new Error('Unexpected token'); } }));
    expect(await holeLinkMetadaten('https://open.spotify.com/track/x', { fetchImpl })).toBeNull();
  });

  it('Timeout: haengender Server bricht nach timeoutMs ab -> null', async () => {
    // fetchImpl reagiert wie echtes fetch auf das Abort-Signal, antwortet
    // aber selbst nie — nur der Timeout kann den Aufruf beenden.
    const fetchImpl = vi.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('AbortError')));
    }));
    const start = Date.now();
    const meta = await holeLinkMetadaten('https://open.spotify.com/track/x', { fetchImpl, timeoutMs: 50 });
    expect(meta).toBeNull();
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('Antwort ohne Titel UND ohne Interpret -> null (kein leeres Metadaten-Objekt)', async () => {
    const fetchImpl = vi.fn(async () => okAntwort({ provider_name: 'Spotify' }));
    expect(await holeLinkMetadaten('https://open.spotify.com/track/x', { fetchImpl })).toBeNull();
  });

  it('Metadaten werden entschaerft: Steuerzeichen raus, Laenge gedeckelt', async () => {
    const fetchImpl = vi.fn(async () => okAntwort({
      title: '  Titel\u0000mit\u001fSteuerzeichen  ',
      author_name: 'A'.repeat(500)
    }));
    const meta = await holeLinkMetadaten('https://open.spotify.com/track/x', { fetchImpl });
    expect(meta.title).toBe('Titel mit Steuerzeichen');
    expect(meta.author).toBe('A'.repeat(300));
  });
});

describe('Paritaet Backend/Frontend', () => {
  it('Frontend-Erlaubnisliste ist identisch mit der Backend-Liste', async () => {
    // Die Liste existiert zweimal, weil backend/ und frontend/ getrennte
    // Docker-Build-Kontexte sind (jedes Image kopiert nur sein Verzeichnis).
    // Dieser Test ist die Drift-Bremse: laufen die Kopien auseinander,
    // wird die Suite rot.
    const frontend = await import('../../../frontend/src/utils/musikLinks.ts');
    expect(frontend.MUSIK_DIENSTE).toEqual(MUSIK_DIENSTE);
    expect(frontend.ERLAUBTE_DIENSTE_TEXT).toBe(ERLAUBTE_DIENSTE_TEXT);
  });
});
