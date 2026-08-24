// Tests fuer die Frontend-Seite der Musik-Link-Erlaubnisliste und die
// Link-Beschriftung. Die verbindliche Pruefung liegt im Backend
// (backend/utils/musikLinks.js, dort auch die Paritaetspruefung beider
// Listen) — hier geht es um die Vorab-Pruefung im Formular und darum, dass
// die Anzeige mit UND ohne Metadaten (Alt-Beitraege) das Richtige zeigt.
import { describe, it, expect } from 'vitest';
import { pruefeMusikLink, dienstNameAus } from '../../utils/musikLinks';
import { linkBeschriftung, istWebLink } from '../../utils/linkDisplay';

describe('pruefeMusikLink (Frontend)', () => {
  it('laesst die vier Musikdienste durch', () => {
    const faelle: Array<[string, string]> = [
      ['https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC?si=x', 'Spotify'],
      ['https://spotify.link/AbCdEf', 'Spotify'],
      ['https://music.apple.com/de/album/x/123?i=456', 'Apple Music'],
      ['https://music.youtube.com/watch?v=abc', 'YouTube Music'],
      ['https://www.deezer.com/de/track/3135556', 'Deezer'],
      ['https://dzr.page.link/abcdef', 'Deezer']
    ];
    for (const [url, name] of faelle) {
      const ergebnis = pruefeMusikLink(url);
      expect(ergebnis.ok).toBe(true);
      if (ergebnis.ok) expect(ergebnis.dienst.name).toBe(name);
    }
  });

  it('lehnt Umgehungsversuche und fremde Seiten ab', () => {
    const verboten = [
      'https://boese.de/?x=open.spotify.com',
      'https://open.spotify.com.boese.de/track/x',
      'https://open.spotify.com@boese.de/track/x',
      'javascript:alert(1)',
      'https://www.youtube.com/watch?v=abc',
      'https://example.org/song',
      'nicht-http',
      '',
      null,
      undefined
    ];
    for (const url of verboten) {
      expect(pruefeMusikLink(url as string | null | undefined)).toEqual({ ok: false });
    }
  });
});

describe('linkBeschriftung', () => {
  it('mit Metadaten: "Titel · Interpret · Dienst"', () => {
    expect(linkBeschriftung({
      link_url: 'https://www.deezer.com/de/track/3135556',
      link_title: 'Harder, Better, Faster, Stronger',
      link_author: 'Daft Punk'
    })).toBe('Harder, Better, Faster, Stronger · Daft Punk · Deezer');
  });

  it('nur Titel (Spotify-oEmbed liefert keinen Interpreten): "Titel · Dienst"', () => {
    expect(linkBeschriftung({
      link_url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
      link_title: 'Never Gonna Give You Up',
      link_author: null
    })).toBe('Never Gonna Give You Up · Spotify');
  });

  it('ohne Metadaten (Alt-Beitrag): faellt auf die Domain zurueck', () => {
    expect(linkBeschriftung({
      link_url: 'https://open.spotify.com/track/altbeitrag',
      link_title: null,
      link_author: null
    })).toBe('open.spotify.com');
  });

  it('Alt-Beitrag von einem Dienst ausserhalb der Liste: Domain ohne www', () => {
    expect(linkBeschriftung({ link_url: 'https://www.example.org/song' }))
      .toBe('example.org');
  });

  it('ohne URL: leerer Text', () => {
    expect(linkBeschriftung({ link_url: null })).toBe('');
  });
});

describe('dienstNameAus', () => {
  it('liefert den Anzeigenamen bzw. null', () => {
    expect(dienstNameAus('https://music.youtube.com/watch?v=x')).toBe('YouTube Music');
    expect(dienstNameAus('https://example.org')).toBeNull();
  });
});

describe('istWebLink bleibt der href-Waechter', () => {
  it('laesst http(s) durch, blockt javascript:', () => {
    // Bewusst NICHT auf die Erlaubnisliste verengt: Alt-Beitraege von vor
    // der Liste waren regelkonform und muessen anklickbar bleiben.
    expect(istWebLink('https://example.org/song')).toBe(true);
    expect(istWebLink('javascript:alert(1)')).toBe(false);
  });
});
