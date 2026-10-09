import React, { useEffect, useState } from 'react';
import { IonItem, IonLabel, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonSpinner } from '@ionic/react';
import api from '../../services/api';
import { fmtZahl } from '../../utils/betriebsFormat';
import WebChips from '../web/WebChips';
import WebAuswahl from '../web/WebAuswahl';

/**
 * Reiter „Sprüche" der Betreiber-Kennzahlen (nur super_admin): welche
 * Konfisprüche gewählt werden (docs/messung/umami.md, S1;
 * GET /api/metrics/konfisprueche).
 *
 * Ebene wählbar (Simon, 09.10.2026: „nach Gemeinde, Kirchenkreis und
 * Landeskirche"): alle Wahlen oder die einer Landeskirche, eines
 * Kirchenkreises oder einer Gemeinde. Die Einträge der Auswahl liefert der
 * Server mit (`auswahl`, nur Einträge mit Wahlen). Kirchenkreis und
 * Landeskirche einer Wahl sind die vom Zeitpunkt der Wahl (Migration 208).
 *
 * Die Zahlen sind WAHLEN, nicht Personen: Wer den Spruch wechselt, zählt
 * mit beiden. Sie bleiben nach dem Löschen eines Kontos stehen -- die
 * Tabelle hat keinen Bezug zur Person. Keine Namen von Personen. Nichts davon
 * geht an Umami.
 *
 * Gemeinsam für die App- und die Web-Fassung der Seite (AdminMetricsPage,
 * WebBetrieb), damit beide dieselbe Liste zeigen; `web` wählt nur die
 * Bedienelemente (Chips und Auswahlfeld statt Segment und Auswahlliste).
 */

export type SpruchEbene = 'alle' | 'landeskirche' | 'kirchenkreis' | 'gemeinde';

export interface KonfispruchAuswahl {
  landeskirchen: Array<{ id: number; name: string; anzahl: number }>;
  kirchenkreise: Array<{ id: number; name: string; landeskirche: string | null; anzahl: number }>;
  gemeinden: Array<{ id: number; name: string; kirchenkreis: string | null; anzahl: number }>;
}

export interface KonfispruchAuswertungDaten {
  gesamt: { wahlen: number; vorschlag: number; eigen: number; aus_bestand: number };
  uebersetzungen: Array<{ translation: string | null; anzahl: number }>;
  sprueche: Array<{ stelle: string | null; anzahl: number }>;
  eigene: Array<{ freitext: string; freitext_referenz: string | null; anzahl: number }>;
  monate: Array<{ monat: string | null; anzahl: number }>;
  ebene?: { art: SpruchEbene; id: number | null };
  auswahl?: KonfispruchAuswahl;
}

/** Anzeigename der Übersetzungs-Schlüssel des Konfispruchs (backend/utils/konfspruch.js). */
const UEBERSETZUNG: Record<string, string> = {
  luther2017: 'Lutherbibel 2017',
  bigs: 'Bibel in gerechter Sprache',
  gute_nachricht: 'Gute Nachricht Bibel',
  elberfelder: 'Elberfelder Bibel',
};

const EBENEN: ReadonlyArray<{ wert: SpruchEbene; label: string }> = [
  { wert: 'alle', label: 'Alle' },
  { wert: 'landeskirche', label: 'Landeskirche' },
  { wert: 'kirchenkreis', label: 'Kirchenkreis' },
  { wert: 'gemeinde', label: 'Gemeinde' },
];

const LEER_JE_EBENE: Record<Exclude<SpruchEbene, 'alle'>, string> = {
  landeskirche: 'Noch keine Wahlen aus einer Gemeinde mit Landeskirche.',
  kirchenkreis: 'Noch keine Wahlen aus einer Gemeinde mit Kirchenkreis.',
  gemeinde: 'Noch keine Wahlen.',
};

interface Eintrag { id: number; label: string; name: string }

/** Die Einträge einer Ebene für die Auswahl: Name, Zusatz zum Unterscheiden gleicher Namen, Anzahl. */
const eintraegeDer = (auswahl: KonfispruchAuswahl | undefined, ebene: SpruchEbene): Eintrag[] => {
  if (!auswahl || ebene === 'alle') return [];
  const mit = (name: string, zusatz: string | null, anzahl: number) =>
    `${name}${zusatz ? ` · ${zusatz}` : ''} (${fmtZahl(anzahl)})`;
  if (ebene === 'landeskirche') return auswahl.landeskirchen.map((e) => ({ id: e.id, name: e.name, label: mit(e.name, null, e.anzahl) }));
  if (ebene === 'kirchenkreis') return auswahl.kirchenkreise.map((e) => ({ id: e.id, name: e.name, label: mit(e.name, e.landeskirche, e.anzahl) }));
  return auswahl.gemeinden.map((e) => ({ id: e.id, name: e.name, label: mit(e.name, e.kirchenkreis, e.anzahl) }));
};

// Monatsnamen statt eines weiteren Datumsformats: utils/dateUtils.ts haelt
// bewusst nur drei Formate (datumsformate.test.ts), und hier ist der Monat
// selbst der Wert, kein Zeitpunkt.
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const monatText = (monat: string | null): string => {
  if (!monat) return 'vor Oktober 2026 (Bestand, Monat unbekannt)';
  const [jahr, m] = monat.split('-').map(Number);
  return `${MONATE[m - 1] ?? monat} ${jahr}`;
};

const Abschnitt: React.FC<{ titel: string; children: React.ReactNode }> = ({ titel, children }) => (
  <section style={{ background: 'var(--app-surface-card)', borderRadius: 'var(--app-radius-weich)', padding: 'var(--app-abstand-mittel)', marginBottom: 'var(--app-abstand-basis)', boxShadow: 'var(--app-schatten-fein)' }}>
    <h3 style={{ fontSize: 'var(--app-text-hinweis)', fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-secondary)', margin: '0 0 var(--app-abstand-kompakt)' }}>{titel}</h3>
    {children}
  </section>
);

const Zeile: React.FC<{ links: React.ReactNode; anzahl: number }> = ({ links, anzahl }) => (
  <li style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--app-abstand-eng)', padding: 'var(--app-abstand-kompakt) 0', borderBottom: '1px solid var(--app-surface-dim)' }}>
    <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{links}</span>
    <span style={{ fontWeight: 'var(--app-schrift-halbfett)', fontVariantNumeric: 'tabular-nums' }}>{fmtZahl(anzahl)}</span>
  </li>
);

const Liste: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 'var(--app-text-sekundaer)' }}>{children}</ul>
);

const Hinweis: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ margin: 0, color: 'var(--app-text-system)', fontSize: 'var(--app-text-sekundaer)' }}>{children}</p>
);

const Leer: React.FC = () => <Hinweis>Noch keine.</Hinweis>;

const KonfispruchAuswertung: React.FC<{ web?: boolean }> = ({ web = false }) => {
  const [daten, setDaten] = useState<KonfispruchAuswertungDaten | null>(null);
  const [auswahl, setAuswahl] = useState<KonfispruchAuswahl | undefined>(undefined);
  const [fehler, setFehler] = useState(false);
  const [ebene, setEbene] = useState<SpruchEbene>('alle');
  const [eintragId, setEintragId] = useState<number | null>(null);

  // Geladen wird "alle" oder eine Ebene mit gewähltem Eintrag; die Auswahl
  // kommt mit jeder Antwort und ist nicht gefiltert.
  useEffect(() => {
    if (ebene !== 'alle' && eintragId === null) return undefined;
    let weg = false;
    const anfrage = ebene === 'alle'
      ? api.get<KonfispruchAuswertungDaten>('/metrics/konfisprueche')
      : api.get<KonfispruchAuswertungDaten>('/metrics/konfisprueche', { params: { ebene, id: eintragId } });
    anfrage
      .then((res) => {
        if (weg) return;
        setDaten(res.data);
        if (res.data.auswahl) setAuswahl(res.data.auswahl);
        setFehler(false);
      })
      .catch(() => { if (!weg) setFehler(true); });
    return () => { weg = true; };
  }, [ebene, eintragId]);

  const eintraege = eintraegeDer(auswahl, ebene);

  const ebeneWaehlen = (neu: SpruchEbene) => {
    setEbene(neu);
    // Der erste Eintrag der neuen Ebene ist gleich gewählt; ohne Einträge bleibt nichts gewählt.
    setEintragId(neu === 'alle' ? null : (eintraegeDer(auswahl, neu)[0]?.id ?? null));
  };

  if (fehler) return <p style={{ color: 'var(--app-color-danger)' }}>Die Auswertung der Sprüche konnte nicht geladen werden.</p>;
  if (!daten) return <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--app-abstand-gross)' }}><IonSpinner /></div>;

  const gewaehlt = eintraege.find((e) => e.id === eintragId);
  const ohneEintraege = ebene !== 'alle' && eintraege.length === 0;

  const bedienung = web ? (
    <div className="web-werkzeuge">
      <WebChips<SpruchEbene> beschriftung="Ebene" chips={EBENEN} wert={ebene} onWert={ebeneWaehlen} />
      {ebene !== 'alle' && eintraege.length > 0 && (
        <WebAuswahl
          label={EBENEN.find((e) => e.wert === ebene)!.label}
          wert={String(eintragId ?? '')}
          onWert={(w) => setEintragId(Number(w))}
          optionen={eintraege.map((e) => ({ wert: String(e.id), label: e.label }))}
        />
      )}
    </div>
  ) : (
    <Abschnitt titel="Ebene">
      <IonSegment value={ebene} onIonChange={(e) => ebeneWaehlen(e.detail.value as SpruchEbene)}>
        {EBENEN.map((e) => <IonSegmentButton key={e.wert} value={e.wert}><IonLabel>{e.label}</IonLabel></IonSegmentButton>)}
      </IonSegment>
      {ebene !== 'alle' && eintraege.length > 0 && (
        <IonItem lines="none" className="app-item-transparent">
          <IonLabel position="stacked">{EBENEN.find((e) => e.wert === ebene)!.label}</IonLabel>
          <IonSelect
            aria-label={EBENEN.find((e) => e.wert === ebene)!.label}
            interface="popover"
            interfaceOptions={{ arrow: false }}
            value={eintragId}
            onIonChange={(e) => setEintragId(Number(e.detail.value))}
          >
            {eintraege.map((e) => <IonSelectOption key={e.id} value={e.id}>{e.label}</IonSelectOption>)}
          </IonSelect>
        </IonItem>
      )}
    </Abschnitt>
  );

  if (ohneEintraege) {
    return (
      <div>
        {bedienung}
        <Abschnitt titel="Gewählte Sprüche"><Hinweis>{LEER_JE_EBENE[ebene as Exclude<SpruchEbene, 'alle'>]}</Hinweis></Abschnitt>
      </div>
    );
  }

  // Noch die Antwort der vorigen Ebene: nicht unter dem neuen Namen zeigen.
  const passend = (daten.ebene?.art ?? 'alle') === ebene && (ebene === 'alle' || daten.ebene?.id === eintragId);
  if (!passend) {
    return <div>{bedienung}<div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--app-abstand-gross)' }}><IonSpinner /></div></div>;
  }

  const { gesamt } = daten;
  const wo = ebene === 'alle' || !gewaehlt ? 'über alle Gemeinden' : `in ${gewaehlt.name}`;
  return (
    <div>
      {bedienung}

      <Abschnitt titel="Gewählte Sprüche">
        <p style={{ margin: 0, fontSize: 'var(--app-text-sekundaer)', lineHeight: 1.4 }}>
          {fmtZahl(gesamt.wahlen)} Wahlen {wo}: {fmtZahl(gesamt.vorschlag)} aus den Vorschlägen,
          {' '}{fmtZahl(gesamt.eigen)} eigene. Gezählt wird jede Wahl, nicht jede Person — wer den Spruch
          wechselt, steht mit beiden in der Liste. Die Zahlen bleiben, wenn ein Konto gelöscht wird.
          {ebene !== 'alle' && ebene !== 'gemeinde' && ' Kirchenkreis und Landeskirche gelten, wie sie beim Wählen zugeordnet waren.'}
        </p>
      </Abschnitt>

      <Abschnitt titel="Aus den Vorschlägen">
        {daten.sprueche.length === 0 ? <Leer /> : (
          <Liste>{daten.sprueche.map((s) => <Zeile key={s.stelle ?? '-'} links={s.stelle ?? 'Spruch gelöscht'} anzahl={s.anzahl} />)}</Liste>
        )}
      </Abschnitt>

      <Abschnitt titel="Übersetzung der Vorschläge">
        {daten.uebersetzungen.length === 0 ? <Leer /> : (
          <Liste>{daten.uebersetzungen.map((u) => <Zeile key={u.translation ?? '-'} links={(u.translation && UEBERSETZUNG[u.translation]) || u.translation || 'ohne Angabe'} anzahl={u.anzahl} />)}</Liste>
        )}
      </Abschnitt>

      <Abschnitt titel="Eigene Sprüche">
        {daten.eigene.length === 0 ? <Leer /> : (
          <Liste>
            {daten.eigene.map((e, i) => (
              <Zeile
                key={i}
                links={<><strong>{e.freitext_referenz || 'ohne Stelle'}</strong> — {e.freitext}</>}
                anzahl={e.anzahl}
              />
            ))}
          </Liste>
        )}
      </Abschnitt>

      <Abschnitt titel="Je Monat">
        {daten.monate.length === 0 ? <Leer /> : (
          <Liste>{daten.monate.map((m) => <Zeile key={m.monat ?? 'bestand'} links={monatText(m.monat)} anzahl={m.anzahl} />)}</Liste>
        )}
      </Abschnitt>
    </div>
  );
};

export default KonfispruchAuswertung;
