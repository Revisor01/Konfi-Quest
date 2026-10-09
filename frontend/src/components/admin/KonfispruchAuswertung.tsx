import React, { useEffect, useState } from 'react';
import { IonSpinner } from '@ionic/react';
import api from '../../services/api';
import { fmtZahl } from '../../utils/betriebsFormat';

/**
 * Reiter „Sprüche" der Betreiber-Kennzahlen (nur super_admin): welche
 * Konfisprüche gewählt werden, über alle Gemeinden (docs/messung/umami.md,
 * S1; GET /api/metrics/konfisprueche).
 *
 * Die Zahlen sind WAHLEN, nicht Personen: Wer den Spruch wechselt, zählt
 * mit beiden. Sie bleiben nach dem Löschen eines Kontos stehen -- die
 * Tabelle hat keinen Bezug zur Person. Nichts davon geht an Umami.
 *
 * Gemeinsam für die App- und die Web-Fassung der Seite (AdminMetricsPage,
 * WebBetrieb), damit beide dieselbe Liste zeigen.
 */

export interface KonfispruchAuswertungDaten {
  gesamt: { wahlen: number; vorschlag: number; eigen: number; aus_bestand: number };
  uebersetzungen: Array<{ translation: string | null; anzahl: number }>;
  sprueche: Array<{ stelle: string | null; anzahl: number }>;
  eigene: Array<{ freitext: string; freitext_referenz: string | null; anzahl: number }>;
  monate: Array<{ monat: string | null; anzahl: number }>;
}

/** Anzeigename der Übersetzungs-Schlüssel des Konfispruchs (backend/utils/konfspruch.js). */
const UEBERSETZUNG: Record<string, string> = {
  luther2017: 'Lutherbibel 2017',
  bigs: 'Bibel in gerechter Sprache',
  gute_nachricht: 'Gute Nachricht Bibel',
  elberfelder: 'Elberfelder Bibel',
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

const Leer: React.FC = () => <p style={{ margin: 0, color: 'var(--app-text-system)', fontSize: 'var(--app-text-sekundaer)' }}>Noch keine.</p>;

const KonfispruchAuswertung: React.FC = () => {
  const [daten, setDaten] = useState<KonfispruchAuswertungDaten | null>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    let weg = false;
    api.get<KonfispruchAuswertungDaten>('/metrics/konfisprueche')
      .then((res) => { if (!weg) setDaten(res.data); })
      .catch(() => { if (!weg) setFehler(true); });
    return () => { weg = true; };
  }, []);

  if (fehler) return <p style={{ color: 'var(--app-color-danger)' }}>Die Auswertung der Sprüche konnte nicht geladen werden.</p>;
  if (!daten) return <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--app-abstand-gross)' }}><IonSpinner /></div>;

  const { gesamt } = daten;
  return (
    <div>
      <Abschnitt titel="Gewählte Sprüche">
        <p style={{ margin: 0, fontSize: 'var(--app-text-sekundaer)', lineHeight: 1.4 }}>
          {fmtZahl(gesamt.wahlen)} Wahlen über alle Gemeinden: {fmtZahl(gesamt.vorschlag)} aus den Vorschlägen,
          {' '}{fmtZahl(gesamt.eigen)} eigene. Gezählt wird jede Wahl, nicht jede Person — wer den Spruch
          wechselt, steht mit beiden in der Liste. Die Zahlen bleiben, wenn ein Konto gelöscht wird.
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
