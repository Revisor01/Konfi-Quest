// Uebersicht der Support-Ansicht in der Web-Fassung, /admin/support
// (docs/planung/support-web.md, Entscheidung 3).
//
// Simon, 03.10.2026: "Ich brauche die Liste in der Support-Ansicht nicht, ich
// hab ja alles auf der linken Seite -- sonst ist es eine Doppelung. Dann
// lieber ordentliche Statistiken und Anzeigen auf der Uebersicht: neueste
// Anfragen, neueste Support-Anfragen, saubere Statistik mit Entwicklung."
//
// Also ein Dashboard aus GET /support/uebersicht: Kennzahl-Kacheln, die
// neuesten Vorgänge und Mails (Aufgaben zuerst), Entwicklung als Diagramme,
// Testphasen, die bald enden, Gemeinden je Landeskirche (aus
// GET /support/statistik, wie bisher).
//
// Seit den Vorgängen (docs/planung/support-vorgaenge.md) zeigen Kachel und
// Liste, was früher „Anfragen" hieß, als offene und neueste Vorgänge -- aus
// GET /support/vorgaenge?filter=offen. Die Kachel „Posteingang" zählt dieselben
// Mails wie die rote Zahl der Leiste.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AKTUALISIEREN, ICON_LISTE, ICON_MAIL, ICON_ORGANISATION } from '../../shared/icons';
import api from '../../../services/api';
import { POSTFACH_INFO } from '../../../utils/supportMail';
import { datumKurz, datumUhrzeit } from '../../../utils/dateUtils';
import { zeitpunktText } from '../../../utils/postfach';
import { tageBis } from '../../shared/eventFormatting';
import { kennzahlenBaum, zahl } from '../../../utils/supportStatistik';
import {
  monatKurz,
  monatLang,
  monatName,
  uebersichtLesen,
  wocheKurz,
  wocheLang,
  zuordnungZiel,
  type SupportUebersicht,
} from '../../../utils/supportWeb';
import { artKurz, brauchtAufmerksamkeit, vorgaengeSortieren, vorgaengeZaehlen, type Vorgang } from '../../../utils/supportVorgaenge';
import { useSupportMailZaehler } from '../../../navigation/supportMailZaehler';
import { vorgaengeLaden } from '../useVorgangsliste';
import { StatusPill } from './WebVorgangTeile';
import WebSeite from '../../web/WebSeite';
import WebKarte from '../../web/WebKarte';
import WebKachel from '../../web/WebKachel';
import WebKnopf from '../../web/WebKnopf';
import WebLink from '../../web/WebLink';
import WebPill from '../../web/WebPill';
import WebSpark from '../../web/WebSpark';
import WebDiagramm from '../../web/WebDiagramm';
import WebBalkenListe from '../../web/WebBalkenListe';
import { WebFehler, WebLaden, WebLeer } from '../../web/WebZustaende';
import { useSupportDaten } from '../useSupportDaten';

interface UebersichtDaten {
  uebersicht: SupportUebersicht;
  /** Die offenen Vorgaenge; null, wenn sie nicht kamen (Kachel und Liste sagen das). */
  vorgaenge: Vorgang[] | null;
  /** Gemeinden je Landeskirche; null, wenn die Statistik nicht kam (die Karte entfaellt dann). */
  landeskirchen: Array<{ schluessel: string; name: string; gemeinden: number }> | null;
}

async function ladeUebersicht(): Promise<UebersichtDaten> {
  const [roh, statistik, vorgaenge] = await Promise.allSettled([api.get('/support/uebersicht'), api.get('/support/statistik'), vorgaengeLaden('offen')]);
  if (roh.status !== 'fulfilled') throw roh.reason;
  const uebersicht = uebersichtLesen(roh.value.data);
  if (!uebersicht) throw new Error('Die Übersicht kam in einer unbekannten Form');
  const gemeinden = statistik.status === 'fulfilled' && Array.isArray(statistik.value.data?.gemeinden) ? statistik.value.data.gemeinden : null;
  return {
    uebersicht,
    vorgaenge: vorgaenge.status === 'fulfilled' ? vorgaenge.value : null,
    landeskirchen: gemeinden
      ? kennzahlenBaum(gemeinden).landeskirchen
        .map((lk) => ({ schluessel: lk.schluessel, name: lk.name, gemeinden: lk.summe.gemeinden }))
        .sort((a, b) => b.gemeinden - a.gemeinden || a.name.localeCompare(b.name, 'de'))
      : null,
  };
}

const summe = (werte: readonly number[]): number => werte.reduce((s, w) => s + w, 0);
const letzter = (werte: readonly number[]): number => (werte.length > 0 ? werte[werte.length - 1] : 0);

/** "von November 2025 bis Oktober 2026" fuer die Zusammenfassung eines Diagramms. */
const zeitraum = (schluessel: readonly string[], lang: (k: string) => string): string =>
  schluessel.length > 0 ? `${lang(schluessel[0])} bis ${lang(schluessel[schluessel.length - 1])}` : 'ohne Daten';

/** Kopfzeile der Feeds: ein Punkt fuer Ungelesenes, sonst gleich breiter Leerraum. */
const Punkt: React.FC<{ ungelesen: boolean }> = ({ ungelesen }) => (
  ungelesen
    ? <span className="app-ungelesen-punkt" role="img" aria-label="ungelesen" />
    : <span className="web-punkt-platz" aria-hidden="true" />
);

const VorgangZeile: React.FC<{ v: Vorgang }> = ({ v }) => (
  <li className="web-feed__zeile">
    <Punkt ungelesen={brauchtAufmerksamkeit(v)} />
    <div className="web-feed__haupt">
      <WebLink href={`/admin/support/vorgaenge/${v.id}`} className="web-link--zeile web-feed__titel web-einzeilig">
        {v.betreff || '(ohne Betreff)'}
        {v.ungelesen > 0 && <span className="web-nur-vorlesen">, {v.ungelesen} ungelesene {v.ungelesen === 1 ? 'Mail' : 'Mails'}</span>}
      </WebLink>
      <div className="web-feed__meta">
        <span>{artKurz(v.art)}</span>
        <span>{v.gemeinde_name ?? 'Nicht zugeordnet'}</span>
      </div>
    </div>
    <div className="web-feed__rechts">
      <StatusPill status={v.status} />
      <span>{zeitpunktText(v.created_at)}</span>
    </div>
  </li>
);

const Uebersicht: React.FC = () => {
  const { daten, laedt, stand, neuLaden } = useSupportDaten(ladeUebersicht);
  // Dieselbe Zahl wie die rote Zahl am Posteingang in der Leiste.
  const mailZaehler = useSupportMailZaehler(true);

  const aktualisieren = (
    <WebKnopf onClick={() => { void neuLaden(); }}>
      <IonIcon icon={ICON_AKTUALISIEREN} aria-hidden="true" />
      Aktualisieren
    </WebKnopf>
  );
  const untertitel = stand ? `Alle Gemeinden im Überblick · Stand ${datumUhrzeit(stand)}` : 'Alle Gemeinden im Überblick';

  let inhalt: React.ReactNode;
  if (laedt) {
    inhalt = <WebLaden kacheln={6} karten={4} text="Die Übersicht wird geladen." />;
  } else if (!daten) {
    inhalt = <WebFehler text="Die Übersicht konnte nicht geladen werden." onErneut={() => { void neuLaden(); }} />;
  } else {
    const { uebersicht: u, landeskirchen, vorgaenge } = daten;
    const offeneZahlen = vorgaenge ? vorgaengeZaehlen(vorgaenge) : null;
    const neuesteVorgaenge = vorgaenge
      ? [...vorgaengeSortieren(vorgaenge)].sort((a, b) => (new Date(b.created_at).getTime() || 0) - (new Date(a.created_at).getTime() || 0) || b.id - a.id).slice(0, 6)
      : [];
    const posteingang = mailZaehler ? mailZaehler.posteingang : u.kennzahlen.mails_ungelesen;
    const k = u.kennzahlen;
    const e = u.entwicklung;
    const a = u.aktivitaet;
    const team = k.konten.teamer + k.konten.admin + k.konten.org_admin;
    const konten = k.konten.konfi + team;
    const aktivProzent = konten > 0 ? Math.round((k.aktiv_30_tage / konten) * 100) : 0;
    const laufenderMonat = e.monate.length > 0 ? monatName(e.monate[e.monate.length - 1]) : '';

    inhalt = (
      <>
        <div className="web-raster web-raster--kacheln">
          <WebKachel
            label="Gemeinden"
            wert={zahl(k.gemeinden.gesamt)}
            href="/admin/organizations"
            zusatz={[
              `${zahl(k.gemeinden.lizenz)} Lizenz · ${zahl(k.gemeinden.testphase)} Testphase`,
              `${zahl(k.gemeinden.unbegrenzt)} unbegrenzt · ${zahl(k.gemeinden.gesperrt)} gesperrt`,
            ]}
          />
          <WebKachel
            label="Konfis"
            wert={zahl(k.konten.konfi)}
            zusatz={[laufenderMonat ? `${zahl(letzter(e.konten_neu.konfi))} neu im ${laufenderMonat}` : '']}
            spark={<WebSpark werte={e.konten_neu.konfi} farbe="var(--web-reihe-konfi)" breite={56} hoehe={22} />}
          />
          <WebKachel
            label="Team"
            wert={zahl(team)}
            zusatz={[`davon ${zahl(k.konten.admin + k.konten.org_admin)} Leitung`, laufenderMonat ? `${zahl(letzter(e.konten_neu.team))} neu im ${laufenderMonat}` : '']}
            spark={<WebSpark werte={e.konten_neu.team} farbe="var(--web-reihe-team)" breite={56} hoehe={22} />}
          />
          <WebKachel
            label="Aktiv in 30 Tagen"
            wert={zahl(k.aktiv_30_tage)}
            zusatz={[`${aktivProzent} % von ${zahl(konten)} Konten`]}
          />
          <WebKachel
            label="Offene Vorgänge"
            wert={offeneZahlen ? zahl(offeneZahlen.offen) : zahl(k.anfragen_offen)}
            href="/admin/support/vorgaenge?filter=offen"
            achtung={(offeneZahlen ? offeneZahlen.offen : k.anfragen_offen) > 0}
            zusatz={[offeneZahlen ? `${zahl(offeneZahlen.neu)} neu · ${zahl(offeneZahlen.in_arbeit)} in Arbeit · ${zahl(offeneZahlen.wartet)} wartet` : 'Neu oder in Arbeit']}
          />
          <WebKachel
            label="Posteingang"
            wert={zahl(posteingang)}
            href="/admin/support/post?filter=ungelesen"
            achtung={posteingang > 0}
            zusatz={['Ungelesen, noch nicht einsortiert']}
          />
        </div>

        <div className="web-raster web-raster--zwei">
          <WebKarte
            titel="Neueste Vorgänge"
            untertitel="Anfragen, Support-Anliegen und Mails, die noch offen sind"
            aktion={<WebLink href="/admin/support/vorgaenge">Alle Vorgänge →</WebLink>}
            bund
          >
            {vorgaenge === null ? (
              <WebLeer icon={ICON_LISTE} titel="Vorgänge nicht geladen" text="Die Vorgänge konnten gerade nicht geladen werden. „Aktualisieren“ versucht es noch einmal." />
            ) : neuesteVorgaenge.length > 0 ? (
              <ul className="web-feed">
                {neuesteVorgaenge.map((v) => <VorgangZeile key={v.id} v={v} />)}
              </ul>
            ) : (
              <WebLeer icon={ICON_ORGANISATION} titel="Nichts offen" text="Sobald jemand das Formular auf der Startseite ausfüllt oder eine Mail kommt, steht der Vorgang hier." />
            )}
          </WebKarte>

          <WebKarte
            titel="Neueste Mails"
            untertitel="Eingang an moin@ und support@, auch die schon einem Vorgang zugeordneten"
            aktion={<WebLink href="/admin/support/post">Zum Posteingang →</WebLink>}
            bund
          >
            {u.neueste_mails.length > 0 ? (
              <ul className="web-feed">
                {u.neueste_mails.map((m) => {
                  const ungelesen = !m.gelesen_am;
                  const ziel = zuordnungZiel(m);
                  const absender = m.von_name?.trim() || m.von_adresse;
                  return (
                    <li key={m.id} className="web-feed__zeile">
                      <Punkt ungelesen={ungelesen} />
                      <div className="web-feed__haupt">
                        <WebLink
                          href={`/admin/support/post/${m.id}`}
                          className={`web-link--zeile web-feed__titel web-einzeilig${ungelesen ? '' : ' web-gedaempft'}`}
                        >
                          {m.betreff?.trim() || '(ohne Betreff)'}
                        </WebLink>
                        <div className="web-feed__meta">
                          <WebPill postfach>{POSTFACH_INFO[m.postfach]?.kurz ?? m.postfach}</WebPill>
                          <span>{absender}</span>
                          {ziel ? (
                            <WebLink href={ziel.pfad} vorn title={ziel.art === 'gemeinde' ? 'Zu den Vorgängen der Gemeinde' : 'Zum Vorgang'}>
                              → {ziel.text}
                            </WebLink>
                          ) : (
                            <WebPill ton="warnung">Nicht einsortiert</WebPill>
                          )}
                        </div>
                      </div>
                      <div className="web-feed__rechts">
                        <span>{zeitpunktText(m.gesendet_am)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <WebLeer icon={ICON_MAIL} titel="Noch keine Mails" text="Mails an moin@ und support@ erscheinen hier, sobald die Postfächer abgeholt sind." />
            )}
          </WebKarte>
        </div>

        <div className="web-raster web-raster--zwei">
          <WebKarte titel="Konten gesamt" untertitel="Konfis, Teamer:innen und Leitungen am Monatsende">
            <WebDiagramm
              art="flaeche"
              titel="Konten gesamt"
              zusammenfassung={`Verlauf von ${zahl(e.konten_gesamt[0] ?? 0)} Konten im ${e.monate.length > 0 ? monatLang(e.monate[0]) : ''} auf ${zahl(letzter(e.konten_gesamt))} im ${e.monate.length > 0 ? monatLang(e.monate[e.monate.length - 1]) : ''}.`}
              kategorien={e.monate}
              kurz={monatKurz}
              lang={monatLang}
              kategorieName="Monat"
              reihen={[{ schluessel: 'gesamt', name: 'Konten gesamt', farbe: 'var(--web-reihe-gesamt)', werte: e.konten_gesamt }]}
              hoehe={252}
            />
          </WebKarte>

          <WebKarte titel="Neue Konten je Monat" untertitel="Konfis und Team, die letzten zwölf Monate">
            <WebDiagramm
              art="gestapelt"
              titel="Neue Konten je Monat"
              zusammenfassung={`${zeitraum(e.monate, monatLang)}: ${zahl(summe(e.konten_neu.konfi))} neue Konfi-Konten und ${zahl(summe(e.konten_neu.team))} neue Team-Konten.`}
              kategorien={e.monate}
              kurz={monatKurz}
              lang={monatLang}
              kategorieName="Monat"
              summe
              reihen={[
                { schluessel: 'konfi', name: 'Konfis', farbe: 'var(--web-reihe-konfi)', werte: e.konten_neu.konfi },
                { schluessel: 'team', name: 'Team', farbe: 'var(--web-reihe-team)', werte: e.konten_neu.team },
              ]}
            />
          </WebKarte>

          <WebKarte titel="Testphase endet bald" untertitel="In den nächsten 14 Tagen" bund>
            {u.testphase_endet.length > 0 ? (
              <ul className="web-feed">
                {u.testphase_endet.map((t) => {
                  const ende = new Date(t.trial_ends_at);
                  const tage = tageBis(ende);
                  return (
                    <li key={t.id} className="web-feed__zeile">
                      <div className="web-feed__haupt">
                        <WebLink href={`/admin/organizations?gemeinde=${t.id}`} className="web-link--zeile web-feed__titel web-einzeilig">
                          {t.display_name}
                        </WebLink>
                        <div className="web-feed__meta"><span>Testphase bis {datumKurz(ende)}</span></div>
                      </div>
                      <div className="web-feed__rechts">
                        <WebPill ton={tage <= 3 ? 'fehler' : 'warnung'}>
                          {tage < 0 ? 'abgelaufen' : tage === 0 ? 'heute' : tage === 1 ? 'morgen' : `in ${tage} Tagen`}
                        </WebPill>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <WebLeer icon={ICON_ORGANISATION} titel="Keine Testphase läuft aus" text="In den nächsten 14 Tagen endet keine Testphase." />
            )}
          </WebKarte>

          {landeskirchen && (
            <WebKarte titel="Gemeinden je Landeskirche" untertitel="Alle Gemeinden nach Landeskirche">
              {landeskirchen.length > 0 ? (
                <WebBalkenListe
                  titel="Gemeinden je Landeskirche"
                  zusammenfassung={landeskirchen.map((l) => `${l.name} ${l.gemeinden}`).join(', ')}
                  eintraege={landeskirchen.map((l) => ({ schluessel: l.schluessel, name: l.name, wert: l.gemeinden }))}
                  farbe="var(--web-reihe-gemeinden)"
                  einheit="Gemeinden"
                />
              ) : (
                <WebLeer icon={ICON_ORGANISATION} titel="Noch keine Gemeinden" text="Sobald eine Gemeinde angelegt ist, steht sie hier." />
              )}
            </WebKarte>
          )}
          <WebKarte titel="Neue Gemeinden und Anfragen" untertitel="Je Monat, die letzten zwölf Monate">
            <WebDiagramm
              art="gruppiert"
              titel="Neue Gemeinden und Anfragen je Monat"
              zusammenfassung={`${zeitraum(e.monate, monatLang)}: ${zahl(summe(e.gemeinden_neu))} neue Gemeinden und ${zahl(summe(e.anfragen_neu))} neue Anfragen.`}
              kategorien={e.monate}
              kurz={monatKurz}
              lang={monatLang}
              kategorieName="Monat"
              reihen={[
                { schluessel: 'gemeinden', name: 'Neue Gemeinden', farbe: 'var(--web-reihe-gemeinden)', werte: e.gemeinden_neu },
                { schluessel: 'anfragen', name: 'Neue Anfragen', farbe: 'var(--web-reihe-anfragen)', werte: e.anfragen_neu },
              ]}
              hoehe={330}
            />
          </WebKarte>

          <WebKarte titel="Aktivität je Woche" untertitel="Anträge, Buchungen und Nachrichten in allen Gemeinden">
            <div className="web-minis">
              {[
                { schluessel: 'antraege', name: 'Anträge', farbe: 'var(--web-reihe-antraege)', werte: a.antraege },
                { schluessel: 'buchungen', name: 'Buchungen', farbe: 'var(--web-reihe-buchungen)', werte: a.buchungen },
                { schluessel: 'nachrichten', name: 'Nachrichten', farbe: 'var(--web-reihe-nachrichten)', werte: a.nachrichten },
              ].map((r, i, alle) => (
                <div key={r.schluessel} className="web-mini">
                  <div className="web-mini__kopf">
                    <span className="web-legende__marke" style={{ background: r.farbe }} aria-hidden="true" />
                    <span className="web-mini__name">{r.name}</span>
                    <span className="web-mini__summe">{zahl(summe(r.werte))} in {a.wochen.length} Wochen</span>
                  </div>
                  <WebDiagramm
                    art="gruppiert"
                    titel={`${r.name} je Woche`}
                    zusammenfassung={`${zeitraum(a.wochen, wocheLang)}: ${zahl(summe(r.werte))} ${r.name}.`}
                    kategorien={a.wochen}
                    kurz={wocheKurz}
                    lang={wocheLang}
                    kategorieName="Woche"
                    reihen={[r]}
                    hoehe={i === alle.length - 1 ? 112 : 84}
                    ziel={2}
                    xAchse={i === alle.length - 1}
                  />
                </div>
              ))}
            </div>
          </WebKarte>

        </div>
      </>
    );
  }

  return (
    <WebSeite bereich="Support" titel="Übersicht" untertitel={untertitel} aktionen={aktualisieren} wartung>
      {inhalt}
    </WebSeite>
  );
};

export default Uebersicht;
