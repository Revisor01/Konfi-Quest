// Die Bausteine der Web-Fassung fuer die Detailseiten (components/support/web/,
// Phase 2): Eingabefeld, Textfeld, Auswahl, Auswahl mit Suche, Schalter,
// Hinweis, Angaben, Dialog, Schriftwechsel (Mailverlauf) und Spalten. Gerendert
// wie eine Person sie bedient -- tippen, waehlen, Tab, Escape.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

const h = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));

import WebFeld from '../../../components/web/WebFeld';
import WebTextfeld from '../../../components/web/WebTextfeld';
import WebAuswahl from '../../../components/web/WebAuswahl';
import WebAuswahlSuche from '../../../components/web/WebAuswahlSuche';
import WebSchalter from '../../../components/web/WebSchalter';
import WebHinweis from '../../../components/web/WebHinweis';
import WebAngaben from '../../../components/web/WebAngaben';
import WebDialog from '../../../components/web/WebDialog';
import WebSpalten from '../../../components/web/WebSpalten';
import WebKnopf from '../../../components/web/WebKnopf';
import { WebMailEintrag, WebMailVerlauf } from '../../../components/support/web/WebMailVerlauf';
import type { MailNachricht } from '../../../types/support';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

describe('WebFeld und WebTextfeld', () => {
  it('die Beschriftung benennt das Feld; Tippen meldet den Wert', () => {
    const onWert = vi.fn();
    render(<WebFeld label="Benutzername" wert="anna" onWert={onWert} hinweis="Buchstaben und Ziffern" />);
    const feld = screen.getByLabelText('Benutzername') as HTMLInputElement;
    expect(feld.value).toBe('anna');
    expect(feld).toHaveAccessibleDescription('Buchstaben und Ziffern');
    fireEvent.change(feld, { target: { value: 'anna.beispiel' } });
    expect(onWert).toHaveBeenCalledWith('anna.beispiel');
  });

  it('Pflicht: aria-required am Feld und der Stern aus dem Stylesheet -- nicht im Namen', () => {
    render(<WebFeld label="Passwort" pflicht typ="password" wert="" onWert={() => {}} autocomplete="new-password" />);
    const feld = screen.getByLabelText('Passwort');
    expect(feld).toHaveAttribute('aria-required', 'true');
    expect(feld).toHaveAttribute('type', 'password');
    expect(feld).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByText('Passwort').className).toContain('web-feld__label--pflicht');
    expect(screen.getByText('Passwort').textContent).toBe('Passwort');
  });

  it('ohne Pflicht kein aria-required; deaktiviert laesst sich nicht bedienen', () => {
    render(<WebFeld label="Telefon" typ="tel" wert="" onWert={() => {}} deaktiviert />);
    const feld = screen.getByLabelText('Telefon');
    expect(feld).not.toHaveAttribute('aria-required');
    expect(feld).toBeDisabled();
  });

  it('das Textfeld ist ein <textarea> mit der Zeilenzahl als Starthoehe', () => {
    const onWert = vi.fn();
    render(<WebTextfeld label="Text der Antwort" pflicht zeilen={8} wert="Hallo" onWert={onWert} />);
    const feld = screen.getByLabelText('Text der Antwort') as HTMLTextAreaElement;
    expect(feld.tagName).toBe('TEXTAREA');
    expect(feld.rows).toBe(8);
    expect(feld).toHaveAttribute('aria-required', 'true');
    fireEvent.change(feld, { target: { value: 'Hallo Anna' } });
    expect(onWert).toHaveBeenCalledWith('Hallo Anna');
  });
});

describe('WebAuswahl', () => {
  it('ein echtes Auswahlfeld mit Beschriftung; Waehlen meldet den Wert als Text', () => {
    const onWert = vi.fn();
    render(<WebAuswahl label="Status" wert="neu" onWert={onWert} optionen={[{ wert: 'neu', label: 'Neu' }, { wert: 'in_arbeit', label: 'In Arbeit' }]} />);
    const feld = screen.getByLabelText('Status') as HTMLSelectElement;
    expect(feld.tagName).toBe('SELECT');
    expect([...feld.options].map((o) => o.textContent)).toEqual(['Neu', 'In Arbeit']);
    expect(feld.value).toBe('neu');
    fireEvent.change(feld, { target: { value: 'in_arbeit' } });
    expect(onWert).toHaveBeenCalledWith('in_arbeit');
  });

  it('eine leere Option ist waehlbar (Unbegrenzt) und deaktiviert sperrt die Auswahl', () => {
    const onWert = vi.fn();
    const { rerender } = render(<WebAuswahl label="Tarif" wert="5" onWert={onWert} optionen={[{ wert: '5', label: 'Testphase' }, { wert: '', label: 'Unbegrenzt' }]} />);
    fireEvent.change(screen.getByLabelText('Tarif'), { target: { value: '' } });
    expect(onWert).toHaveBeenCalledWith('');
    rerender(<WebAuswahl label="Tarif" wert="5" onWert={onWert} optionen={[{ wert: '5', label: 'Testphase' }]} deaktiviert />);
    expect(screen.getByLabelText('Tarif')).toBeDisabled();
  });
});

describe('WebAuswahlSuche', () => {
  const EINTRAEGE = [
    { wert: '1', titel: 'Kirchengemeinde Büsum', beschreibung: 'Anna Beispiel · Neu' },
    { wert: '2', titel: 'Kirchengemeinde Wiesengrund', beschreibung: 'Jan Vorlage · In Arbeit' },
    { wert: '3', titel: 'Jugendwerk Beispielstadt', beschreibung: 'Ole Entwurf · Abgelehnt' },
  ];
  const zeigen = (wert = '', onWert = vi.fn()) => {
    render(<WebAuswahlSuche label="Anfrage" suchePlatzhalter="Anfrage suchen" leerText="Es gibt keine Anfragen." eintraege={EINTRAEGE} wert={wert} onWert={onWert} />);
    return onWert;
  };
  const namen = () => screen.getAllByRole('radio').map((r) => r.closest('label')!.querySelector('.web-wahl__titel')!.textContent);

  it('alle Eintraege als Optionsgruppe mit dem Namen der Auswahl; Waehlen meldet den Wert', () => {
    const onWert = zeigen();
    expect(screen.getByRole('group', { name: 'Anfrage' })).toBeInTheDocument();
    expect(namen()).toEqual(['Kirchengemeinde Büsum', 'Kirchengemeinde Wiesengrund', 'Jugendwerk Beispielstadt']);
    fireEvent.click(screen.getByRole('radio', { name: /Wiesengrund/ }));
    expect(onWert).toHaveBeenCalledWith('2');
  });

  it('der gewaehlte Eintrag ist angekreuzt und hervorgehoben; kein Eintrag gewaehlt, wenn der Wert leer ist', () => {
    zeigen('3');
    expect(screen.getByRole('radio', { name: /Beispielstadt/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Beispielstadt/ }).closest('label')!.className).toContain('web-wahl__zeile--gewaehlt');
    expect(screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1);
  });

  it('die Suche findet mit Umlauten -- "buesum" findet "Büsum" -- und nennt die Zahl der Treffer', () => {
    zeigen();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Anfrage suchen' }), { target: { value: 'buesum' } });
    expect(namen()).toEqual(['Kirchengemeinde Büsum']);
    expect(screen.getByText('1 von 3')).toBeInTheDocument();
  });

  it('die Suche findet auch in der zweiten Zeile (Kontakt, Status)', () => {
    zeigen();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Anfrage suchen' }), { target: { value: 'vorlage' } });
    expect(namen()).toEqual(['Kirchengemeinde Wiesengrund']);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Anfrage suchen' }), { target: { value: 'abgelehnt' } });
    expect(namen()).toEqual(['Jugendwerk Beispielstadt']);
  });

  it('ohne Treffer: ein Satz mit dem Suchbegriff; Leeren bringt alle zurueck', () => {
    zeigen();
    const suche = screen.getByRole('searchbox', { name: 'Anfrage suchen' });
    fireEvent.change(suche, { target: { value: 'xyz' } });
    expect(screen.getByText('Keine Treffer für „xyz“.')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    fireEvent.change(suche, { target: { value: '' } });
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('ohne Eintraege steht der Leertext da, nicht "Keine Treffer"', () => {
    render(<WebAuswahlSuche label="Gemeinde" suchePlatzhalter="Gemeinde suchen" leerText="Es gibt keine Gemeinden." eintraege={[]} wert="" onWert={() => {}} />);
    expect(screen.getByText('Es gibt keine Gemeinden.')).toBeInTheDocument();
    expect(screen.queryByText(/Keine Treffer/)).toBeNull();
  });
});

describe('WebSchalter', () => {
  it('ein Schalter mit Namen und Zustand; Klick schaltet um', () => {
    const onAn = vi.fn();
    const { rerender } = render(<WebSchalter label="Testphase (30 Tage)" an onAn={onAn} hinweis="Zugang 30 Tage ab heute." />);
    const schalter = screen.getByRole('switch', { name: 'Testphase (30 Tage)' });
    expect(schalter).toBeChecked();
    expect(schalter).toHaveAccessibleDescription('Zugang 30 Tage ab heute.');
    fireEvent.click(schalter);
    expect(onAn).toHaveBeenLastCalledWith(false);
    rerender(<WebSchalter label="Testphase (30 Tage)" an={false} onAn={onAn} />);
    expect(screen.getByRole('switch', { name: 'Testphase (30 Tage)' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('switch', { name: 'Testphase (30 Tage)' }));
    expect(onAn).toHaveBeenLastCalledWith(true);
  });
});

describe('WebHinweis und WebAngaben', () => {
  it('Fehler melden sich sofort (alert), alles andere hoeflich (status); Titel und Text stehen da', () => {
    render(
      <>
        <WebHinweis art="fehler" titel="Versand gescheitert">Dein Text bleibt stehen.</WebHinweis>
        <WebHinweis art="warnung" titel="Postfach noch nicht eingerichtet" />
        <WebHinweis art="hinweis">Nur ein Hinweis.</WebHinweis>
        <WebHinweis art="erfolg" titel="Die Gemeinde ist angelegt." />
        <WebHinweis art="fehler" rolle="status">Ruhiger Fehler</WebHinweis>
      </>,
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Versand gescheitert');
    expect(screen.getByRole('alert')).toHaveTextContent('Dein Text bleibt stehen.');
    expect(screen.getAllByRole('status').map((s) => s.className)).toEqual([
      'web-hinweis web-hinweis--warnung', 'web-hinweis web-hinweis--hinweis', 'web-hinweis web-hinweis--erfolg', 'web-hinweis web-hinweis--fehler',
    ]);
  });

  it('Angaben als Liste Bezeichnung/Wert; Fehlendes steht als Strich', () => {
    render(<WebAngaben beschriftung="Angaben" angaben={[
      { label: 'Gemeinde', wert: 'Kirchengemeinde Heide' },
      { label: 'Mobilnummer', wert: null },
      { label: 'Nachricht', wert: '' },
      { label: 'E-Mail', wert: <a href="mailto:anna@example.org">anna@example.org</a> },
    ]} />);
    const liste = screen.getByLabelText('Angaben');
    expect(liste.tagName).toBe('DL');
    expect([...liste.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Gemeinde', 'Mobilnummer', 'Nachricht', 'E-Mail']);
    expect([...liste.querySelectorAll('dd')].map((d) => d.textContent)).toEqual(['Kirchengemeinde Heide', '–', '–', 'anna@example.org']);
    expect(within(liste).getByRole('link', { name: 'anna@example.org' })).toHaveAttribute('href', 'mailto:anna@example.org');
  });
});

describe('WebSpalten', () => {
  it('Hauptinhalt zuerst, die schmale Seite danach; mit seiteLinks umgekehrt (im Dokument, nicht nur im Bild)', () => {
    const { container, rerender } = render(<WebSpalten haupt={<p>Haupt</p>} seite={<p>Seite</p>} seiteBeschriftung="Angaben" />);
    expect([...container.querySelector('.web-spalten')!.children].map((k) => k.textContent)).toEqual(['Haupt', 'Seite']);
    expect(screen.getByRole('complementary', { name: 'Angaben' })).toHaveTextContent('Seite');
    rerender(<WebSpalten haupt={<p>Haupt</p>} seite={<p>Seite</p>} seiteBeschriftung="Liste" seiteLinks />);
    expect([...container.querySelector('.web-spalten')!.children].map((k) => k.textContent)).toEqual(['Seite', 'Haupt']);
    expect(container.querySelector('.web-spalten')!.className).toContain('web-spalten--links');
  });
});

describe('WebDialog', () => {
  const Harness: React.FC<{ onAbsenden?: () => void; onSchliessen?: () => void }> = ({ onAbsenden, onSchliessen }) => {
    const [offen, setOffen] = useState(false);
    return (
      <div>
        <button type="button" onClick={() => setOffen(true)}>Konto anlegen</button>
        {offen && (
          <WebDialog
            titel="Support-Konto anlegen"
            beschreibung="Ein Konto ohne Gemeinde."
            onSchliessen={() => { onSchliessen?.(); setOffen(false); }}
            onAbsenden={onAbsenden}
            aktionen={<><WebKnopf onClick={() => setOffen(false)}>Abbrechen</WebKnopf><WebKnopf art="primaer" absenden>Anlegen</WebKnopf></>}
          >
            <WebFeld label="Benutzername" wert="" onWert={() => {}} />
            <WebFeld label="Anzeigename" wert="" onWert={() => {}} />
          </WebDialog>
        )}
      </div>
    );
  };
  const oeffnen = () => {
    const knopf = screen.getByRole('button', { name: 'Konto anlegen' });
    knopf.focus();
    fireEvent.click(knopf);
    return knopf;
  };

  it('ein Dialog mit Namen und Beschreibung, an <body> gehaengt', () => {
    const { container } = render(<Harness />);
    oeffnen();
    const dialog = screen.getByRole('dialog', { name: 'Support-Konto anlegen' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Ein Konto ohne Gemeinde.');
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
  });

  it('der Fokus geht ins erste Feld und beim Schliessen zurueck an den Knopf, der ihn geoeffnet hat', () => {
    render(<Harness />);
    const knopf = oeffnen();
    expect(screen.getByLabelText('Benutzername')).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(knopf).toHaveFocus();
  });

  it('Escape schliesst', () => {
    const onSchliessen = vi.fn();
    render(<Harness onSchliessen={onSchliessen} />);
    oeffnen();
    fireEvent.keyDown(screen.getByLabelText('Benutzername'), { key: 'Escape' });
    expect(onSchliessen).toHaveBeenCalledTimes(1);
  });

  it('ein Klick auf den abgedunkelten Grund schliesst, einer ins Fenster nicht', () => {
    const onSchliessen = vi.fn();
    render(<Harness onSchliessen={onSchliessen} />);
    oeffnen();
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onSchliessen).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    expect(onSchliessen).toHaveBeenCalledTimes(1);
  });

  it('Tab bleibt im Dialog: vom letzten Element zurueck zum ersten, Umschalt+Tab vom ersten zum letzten', () => {
    render(<Harness />);
    oeffnen();
    const dialog = screen.getByRole('dialog');
    const schliessen = screen.getByRole('button', { name: 'Schließen' });
    const anlegen = screen.getByRole('button', { name: 'Anlegen' });
    anlegen.focus();
    fireEvent.keyDown(anlegen, { key: 'Tab' });
    expect(schliessen).toHaveFocus();
    fireEvent.keyDown(schliessen, { key: 'Tab', shiftKey: true });
    expect(anlegen).toHaveFocus();
    // In der Mitte laesst Tab den Browser entscheiden.
    const feld = screen.getByLabelText('Anzeigename');
    feld.focus();
    const ereignis = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    feld.dispatchEvent(ereignis);
    expect(ereignis.defaultPrevented).toBe(false);
    expect(dialog).toBeInTheDocument();
  });

  it('als Formular: der Anlegen-Knopf und Enter im Feld rufen onAbsenden', () => {
    const onAbsenden = vi.fn();
    render(<Harness onAbsenden={onAbsenden} />);
    oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));
    expect(onAbsenden).toHaveBeenCalledTimes(1);
    fireEvent.submit(screen.getByLabelText('Benutzername').closest('form')!);
    expect(onAbsenden).toHaveBeenCalledTimes(2);
    // Abbrechen schickt nichts ab.
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onAbsenden).toHaveBeenCalledTimes(2);
  });
});

describe('Schriftwechsel (WebMailVerlauf)', () => {
  const mail = (id: number, extra: Partial<MailNachricht> = {}): MailNachricht => ({
    id, postfach: 'moin', richtung: 'ein', anfrage_id: 4, organization_id: null,
    von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', an_adressen: ['moin@konfi-quest.example'],
    betreff: 'Eure Anfrage', text: 'Hallo\nwie geht es weiter?', anhaenge: [],
    gesendet_am: '2026-10-02T09:00:00Z', gelesen_am: null, ...extra,
  });

  it('eingehend und ausgehend sagen es in Worten; Absender, Postfach und Datum stehen im Kopf', () => {
    render(<WebMailVerlauf mails={[
      mail(1),
      mail(2, { richtung: 'aus', von_adresse: 'moin@konfi-quest.example', von_name: null, an_adressen: ['anna@example.org'], gesendet_am: '2026-10-02T10:00:00Z', text: 'Gern.' }),
    ]} />);
    const artikel = screen.getAllByRole('article');
    expect(artikel.map((a) => a.getAttribute('aria-label'))).toEqual(['Eingegangen am 02.10.2026, 11:00', 'Gesendet am 02.10.2026, 12:00']);
    expect(artikel[0].className).toContain('web-mail--ein');
    expect(artikel[1].className).toContain('web-mail--aus');
    expect(artikel[0]).toHaveTextContent('Anna Beispiel');
    expect(artikel[0]).toHaveTextContent('<anna@example.org>');
    expect(artikel[0]).toHaveTextContent('moin@');
    expect(artikel[0]).toHaveTextContent('An: moin@konfi-quest.example');
    expect(artikel[0]).toHaveTextContent('Eure Anfrage');
    // Ohne Namen steht die Adresse allein.
    expect(within(artikel[1]).getByText('moin@konfi-quest.example', { selector: 'strong' })).toBeInTheDocument();
    expect(artikel[1]).not.toHaveTextContent('<moin@');
  });

  it('"Neu" steht nur an den Mails, die in der Menge sind', () => {
    render(<WebMailVerlauf mails={[mail(1), mail(2)]} neu={new Set([2])} />);
    const artikel = screen.getAllByRole('article');
    expect(artikel[0]).not.toHaveTextContent('Neu');
    expect(artikel[1]).toHaveTextContent('Neu');
  });

  it('Zitate sind eingeklappt und lassen sich aufklappen -- der eigene Text bleibt sichtbar', () => {
    render(<WebMailVerlauf mails={[mail(1, { text: 'Danke, klingt gut.\n\n> Hallo\n> wie geht es weiter?' })]} />);
    expect(screen.getByText('Danke, klingt gut.')).toBeInTheDocument();
    expect(screen.queryByText(/> wie geht es weiter\?/)).toBeNull();
    const knopf = screen.getByRole('button', { name: 'Zitat einblenden' });
    expect(knopf).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(knopf);
    expect(screen.getByRole('button', { name: 'Zitat ausblenden' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/> wie geht es weiter\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zitat ausblenden' }));
    expect(screen.queryByText(/> wie geht es weiter\?/)).toBeNull();
  });

  it('Anhaenge stehen als Namen in einer benannten Liste; ohne Anhaenge keine Liste', () => {
    render(<WebMailVerlauf mails={[mail(1, { anhaenge: [{ name: 'angebot.pdf' }, { name: 'logo.png' }, { name: '  ' }] }), mail(2)]} />);
    const liste = screen.getByRole('list', { name: 'Anhänge' });
    expect(within(liste).getAllByRole('listitem').map((l) => l.textContent)).toEqual(['angebot.pdf', 'logo.png']);
    expect(screen.getAllByRole('list', { name: 'Anhänge' })).toHaveLength(1);
  });

  it('eine Mail ohne Text sagt es; ohne Mails steht der Satz der Seite', () => {
    const { rerender } = render(<WebMailVerlauf mails={[mail(1, { text: null })]} />);
    expect(screen.getByText('Ohne Text')).toBeInTheDocument();
    rerender(<WebMailVerlauf mails={[]} leer="Noch keine Mails zu dieser Anfrage." />);
    expect(screen.getByText('Noch keine Mails zu dieser Anfrage.')).toBeInTheDocument();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('die einzelne Mail (kopf="voll"): Von, An, Datum und Postfach als Liste', () => {
    render(<WebMailEintrag mail={mail(1)} kopf="voll" neu />);
    const kopf = document.querySelector('.web-mail__kopfdaten')!;
    expect([...kopf.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Von', 'An', 'Datum', 'Postfach']);
    const werte = [...kopf.querySelectorAll('dd')].map((d) => d.textContent);
    expect(werte[0]).toBe('Anna Beispiel <anna@example.org>');
    expect(werte[1]).toBe('moin@konfi-quest.example');
    expect(werte[2]).toBe('02.10.2026, 11:00');
    expect(werte[3]).toContain('moin@');
    expect(werte[3]).toContain('Eingegangen');
    expect(werte[3]).toContain('Neu');
  });
});
