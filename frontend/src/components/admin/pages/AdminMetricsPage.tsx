import { FARBEN, METRIK_AMPEL } from '../../../theme/colors';
import {
  ICON_AKTION,
  ICON_AKTUALISIEREN,
  ICON_DAUMEN_HOCH,
  ICON_GRUPPE,
  ICON_NETZWERK,
  ICON_PULS,
  ICON_STATISTIK,
  ICON_STUFEN,
  ICON_UHRZEIT,
  ICON_WARTEND,
  ICON_WARNUNG,
  ICON_WERKZEUG,
  ICON_ZURUECK,
} from '../../shared/icons';
import { fehlerStatus } from '../../../utils/fehler';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSpinner,
  IonToggle
} from '@ionic/react';
import api from '../../../services/api';
import { triggerPullHaptic } from '../../../utils/haptics';
import {
  apdexStufe,
  gesamtzustand,
  tagesbilanz,
  vergleichHeuteGegenVortage,
  type BetriebsSnapshot,
} from '../../../utils/betriebsKennzahlen';

interface RouteRow {
  route: string;
  count: number;
  errors: number;
  errorRate: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  // Serverzeit: ab vollstaendig empfangenem Body bis zur fertigen Antwort.
  // Ohne das Warten auf die Verbindung des Geraets.
  serverAvgMs?: number;
  serverP95Ms?: number;
  serverMaxMs?: number;
  netzAvgMs?: number;
  notModified?: number;
  cacheQuote?: number;
  // Seit dem 22.09.2026: Median (die typische Anfrage), Anteil ueber 1 s und
  // die gesamte Serverzeit dieser Route.
  p50Ms?: number;
  serverP50Ms?: number;
  langsam?: number;
  langsamQuote?: number;
  serverZeitGesamtMs?: number;
  apdex?: number | null;
}
interface TimelinePoint { t: string; requests: number; errors: number; avgMs: number; }
interface ErrorRow { route: string; url: string; status: number; durationMs: number; at: string; }
interface FehlerGruppe { route: string; status: number; anzahl: number; seit: string; zuletzt: string; beispielUrl: string; }
interface Snapshot extends BetriebsSnapshot {
  uptimeSeconds: number;
  totalRequests: number;
  // Anfragen, die mit 304 beantwortet wurden: Der Client hatte die Daten
  // schon, es ging nur die Rueckfrage ueber die Leitung.
  totalNotModified?: number;
  cacheQuote?: number;
  totalErrors: number;
  errorRate: number;
  inFlight: number;
  maxInFlight: number;
  rps: number;
  routesSlowest: RouteRow[];
  routesBusiest: RouteRow[];
  recentErrors: ErrorRow[];
  timeline: TimelinePoint[];
  replicas?: { replica: string; requests: number; inFlight: number; share: number }[];
  apdex?: { wert: number | null; zufrieden: number; toleriert: number; frustriert: number; schwelleMs: number; toleriertBisMs: number };
  ueber1s?: { anzahl: number; quote: number; schwelleMs: number };
  statusKlassen?: { erfolg: number; ausDemCache: number; umleitung: number; nichtGefunden: number; abgelehnt: number; serverfehler: number };
  nutzer?: { fensterMinuten: number; aktiv: number; betroffen: number };
  routesPotenzial?: RouteRow[];
  fehlerGruppen?: FehlerGruppe[];
}
interface HistorySnap {
  captured_at: string;
  total_requests: number;
  total_errors: number;
  max_in_flight: number;
  worst_p95_ms: number;
  worst_route: string | null;
}

const fmtUptime = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} T ${h} Std`;
  if (h > 0) return `${h} Std ${m} Min`;
  return `${m} Min`;
};
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtZahl = (n: number) => n.toLocaleString('de-DE');

// Millisekunden lesbar: unter einer Sekunde in ms, darueber in s/min.
const fmtDauer = (ms: number) => {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
  return `${Math.round(ms / 60000)} Min`;
};

// "vor 3 Std" statt einer nackten Uhrzeit — bei der Frage "seit wann geht
// das so" ist die Spanne die Antwort, nicht der Zeitpunkt.
const fmtSeit = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  const std = Math.round(min / 60);
  if (std < 24) return `vor ${std} Std`;
  return `vor ${Math.round(std / 24)} T`;
};

const msColor = (ms: number) => ms >= 1000 ? METRIK_AMPEL.kritisch : ms >= 500 ? METRIK_AMPEL.erhoeht : ms >= 200 ? METRIK_AMPEL.maessig : METRIK_AMPEL.gut;
const statusColor = (s: number) => s >= 500 ? METRIK_AMPEL.kritisch : s >= 400 ? METRIK_AMPEL.erhoeht : METRIK_AMPEL.gut;

// Kleines KPI-Kaestchen
const Kpi: React.FC<{ icon: string; label: string; value: string; color: string; sub?: string }> = ({ icon, label, value, color, sub }) => (
  <div style={{ flex: '1 1 140px', background: 'white', borderRadius: 'var(--app-radius-weich)', padding: 'var(--app-abstand-mittelweit)', boxShadow: 'var(--app-schatten-fein)', minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-kompakt)', color: 'var(--app-text-system)', fontSize: 'var(--app-text-klein)', fontWeight: 'var(--app-schrift-halbfett)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
      <IonIcon icon={icon} style={{ color, fontSize: 'var(--app-text-standard)' }} />
      {label}
    </div>
    <div style={{ fontSize: 'var(--app-text-ueberschrift-gross)', fontWeight: 'var(--app-schrift-fett)', color: 'var(--app-text-emphasis)', marginTop: 'var(--app-abstand-mini)', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    {sub && <div style={{ fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)', marginTop: 'var(--app-abstand-winzig)' }}>{sub}</div>}
  </div>
);

// Karte mit Titelzeile — das wiederkehrende Gehaeuse auf dieser Seite.
const Karte: React.FC<{ icon: string; titel: string; farbe?: string; hinweis?: string; children: React.ReactNode }> = ({ icon, titel, farbe, hinweis, children }) => (
  <div style={{ background: 'white', borderRadius: 'var(--app-radius-weich)', padding: 'var(--app-abstand-mittel)', marginBottom: 'var(--app-abstand-basis)', boxShadow: 'var(--app-schatten-fein)' }}>
    <div style={{ fontSize: 'var(--app-text-hinweis)', fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-secondary)', marginBottom: 'var(--app-abstand-kompakt)', display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-kompakt)' }}>
      <IonIcon icon={icon} style={{ color: farbe || 'var(--app-color-chat)' }} /> {titel}
    </div>
    {children}
    {hinweis && <div style={{ fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)', marginTop: 'var(--app-abstand-eng)', lineHeight: 1.4 }}>{hinweis}</div>}
  </div>
);

// Waagerechter Anteilsbalken aus mehreren Abschnitten.
const Anteilsbalken: React.FC<{ teile: { wert: number; farbe: string; name: string }[] }> = ({ teile }) => {
  const summe = teile.reduce((s, t) => s + t.wert, 0);
  if (summe === 0) return null;
  return (
    <>
      <div style={{ display: 'flex', height: '10px', borderRadius: 'var(--app-radius-fein)', overflow: 'hidden', background: 'var(--app-border-soft)' }}>
        {teile.filter(t => t.wert > 0).map(t => (
          <div key={t.name} title={`${t.name}: ${fmtZahl(t.wert)}`} style={{ width: `${(t.wert / summe) * 100}%`, background: t.farbe }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--app-abstand-mittel)', marginTop: 'var(--app-abstand-kompakt)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
        {teile.filter(t => t.wert > 0).map(t => (
          <span key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-mini)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: 'var(--app-radius-kreis)', background: t.farbe, flexShrink: 0 }} />
            {t.name} {fmtZahl(t.wert)} ({Math.round((t.wert / summe) * 100)} %)
          </span>
        ))}
      </div>
    </>
  );
};

// Verlaufs-Chart (Anfragen pro Minute, Fehler rot ueberlagert) — reines SVG.
const TimelineChart: React.FC<{ data: TimelinePoint[] }> = ({ data }) => {
  if (data.length === 0) return <div style={{ color: 'var(--app-text-system)', textAlign: 'center', padding: 'var(--app-abstand-gross)', fontSize: 'var(--app-text-sekundaer)' }}>Noch keine Verlaufsdaten (sammelt sich live).</div>;
  const W = 320, H = 90, pad = 4;
  const max = Math.max(1, ...data.map(d => d.requests));
  const bw = (W - pad * 2) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} preserveAspectRatio="none">
      {data.map((d, i) => {
        const h = (d.requests / max) * (H - 16);
        const eh = (d.errors / max) * (H - 16);
        const x = pad + i * bw;
        return (
          <g key={i}>
            <rect x={x} y={H - h} width={Math.max(1, bw - 1)} height={h} fill={FARBEN.chat} opacity={0.75} rx={1} />
            {d.errors > 0 && <rect x={x} y={H - eh} width={Math.max(1, bw - 1)} height={eh} fill={FARBEN.danger} rx={1} />}
          </g>
        );
      })}
      <text x={pad} y={10} fontSize="8" fill={FARBEN.textSystem}>höchstens {max} Anfragen/Min</text>
    </svg>
  );
};

const RouteTable: React.FC<{ rows: RouteRow[]; mode: 'slow' | 'busy' }> = ({ rows, mode }) => (
  <div style={{ background: 'white', borderRadius: 'var(--app-radius-weich)', overflow: 'hidden', boxShadow: 'var(--app-schatten-fein)' }}>
    {rows.length === 0 && <div style={{ padding: 'var(--app-abstand-basis)', color: 'var(--app-text-system)', fontSize: 'var(--app-text-sekundaer)' }}>Keine Daten.</div>}
    {rows.map((r, i) => (
      <div key={r.route} style={{ padding: 'var(--app-abstand-schmal) var(--app-abstand-mittel)', borderTop: i ? '1px solid var(--app-surface-dim)' : 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--app-abstand-eng)' }}>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 'var(--app-text-hinweis)', color: 'var(--app-text-emphasis)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{r.route}</span>
          {mode === 'slow'
            ? <span style={{ fontWeight: 'var(--app-schrift-fett)', fontSize: 'var(--app-text-sekundaer)', color: msColor(r.serverP95Ms ?? r.p95Ms), flexShrink: 0 }}>{r.serverP95Ms ?? r.p95Ms} ms</span>
            : <span style={{ fontWeight: 'var(--app-schrift-fett)', fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-color-chat)', flexShrink: 0 }}>{fmtZahl(r.count)}×</span>}
        </div>
        {/* Erste Zeile: was der SERVER gebraucht hat — die einzige Zahl, an
            der eine Backend-Aenderung etwas dreht. Der Median steht vor dem
            p95: Er sagt, wie die Route sich normalerweise verhaelt, das p95
            nur, wie der schlechte Rand aussieht. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--app-abstand-mittel)', marginTop: 'var(--app-abstand-mini)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
          <span>{fmtZahl(r.count)}× aufgerufen</span>
          {r.serverP50Ms !== undefined && <span title="Die Hälfte aller Anfragen war schneller">Mitte {r.serverP50Ms} ms</span>}
          <span title="95 von 100 Anfragen waren schneller">p95 {r.serverP95Ms ?? r.p95Ms} ms</span>
          <span>höchstens {r.serverMaxMs ?? r.maxMs} ms</span>
          {r.errors > 0 && <span style={{ color: 'var(--app-color-danger)', fontWeight: 'var(--app-schrift-halbfett)' }}>{r.errors} Fehler</span>}
        </div>
        {/* Zweite Zeile: was auf der Leitung lag.
            Ein erster Anlauf (31.08.2026) wurde entfernt, weil er von
            Middleware-Eintritt bis res.end mass und damit dasselbe Warten
            enthielt — bei 20 von 20 Routen stand zweimal dieselbe Zahl.
            Seit dem 21.09.2026 wird der Moment genommen, in dem der Body
            VOLLSTAENDIG gelesen ist; nachgestellt mit echter Verzoegerung
            (400 kB in Haeppchen): 1269 ms gesamt, davon 1221 ms Leitung und
            26 ms Server. Die Gesamtzeit steht daneben — sie sagt, wie schnell
            es sich fuer die Konfis anfuehlt. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--app-abstand-mittel)', marginTop: 'var(--app-abstand-winzig)', fontSize: 'var(--app-text-meta)', color: METRIK_AMPEL.blass }}>
          {/* Immer anzeigen, auch bei 0 ms: Sonst stand die Zeile nur bei
              Uploads da und es sah aus, als fehle bei den uebrigen Routen
              etwas (Simon, 21.09.2026). 0 ms ist eine Aussage — die Antwort
              ging in einem Rutsch raus. */}
          {r.netzAvgMs !== undefined && (
            <span title="Warten auf die Verbindung des Geräts — nicht vom Server beeinflussbar">
              {r.netzAvgMs > 0 ? `+ ${r.netzAvgMs} ms Leitung` : 'Leitung ohne Verzögerung'}
              {' '}(gesamt Ø {r.avgMs} ms)
            </span>
          )}
          {r.langsam !== undefined && r.langsam > 0 && (
            <span style={{ color: METRIK_AMPEL.erhoeht }} title="Anfragen, die insgesamt über einer Sekunde gedauert haben">
              {fmtZahl(r.langsam)}× über 1 s ({r.langsamQuote} %)
            </span>
          )}
          {r.cacheQuote !== undefined && r.cacheQuote > 0 && (
            <span style={{ color: r.cacheQuote >= 50 ? METRIK_AMPEL.gut : METRIK_AMPEL.blass }}>
              {r.cacheQuote} % aus dem Zwischenspeicher
            </span>
          )}
        </div>
      </div>
    ))}
  </div>
);

const AdminMetricsPage: React.FC = () => {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<HistorySnap[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ueberblick' | 'aufwand' | 'fehler' | 'routen' | 'verlauf'>('ueberblick');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [routenSicht, setRoutenSicht] = useState<'slow' | 'busy'>('slow');
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (withHistory = false) => {
    try {
      // Zwei Endpunkte mit unterschiedlicher Antwortform: der zweite wird nur
      // bei withHistory geholt, deshalb die Union statt eines gemeinsamen Typs.
      // 14 Tage, damit der Vergleich "heute gegen die Vortage" eine Grundlage hat.
      const [m, h] = await Promise.all([
        api.get<Snapshot>('/metrics'),
        withHistory
          ? api.get<{ snapshots?: HistorySnap[] }>('/metrics/history?days=14')
          : Promise.resolve(null),
      ]);
      setSnap(m.data);
      if (h) setHistory(h.data.snapshots || []);
      setError(null);
    } catch (e) {
      setError(fehlerStatus(e) === 403 ? 'Nur für Super-Admins.' : 'Die Kennzahlen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (autoRefresh) {
      timerRef.current = setInterval(() => load(false), 5000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, load]);

  // Historie-Deltas: Differenz aufeinanderfolgender Snapshots (Reset bei Deploy -> Delta 0).
  const historyDeltas = useMemo(() => history.map((s, i) => {
    if (i === 0) return null;
    const prev = history[i - 1];
    const dReq = s.total_requests - prev.total_requests;
    const dErr = s.total_errors - prev.total_errors;
    return {
      at: s.captured_at,
      requests: dReq >= 0 ? dReq : s.total_requests,
      errors: dErr >= 0 ? dErr : s.total_errors,
      worstP95: s.worst_p95_ms,
      worstRoute: s.worst_route,
    };
  }).filter(Boolean) as { at: string; requests: number; errors: number; worstP95: number; worstRoute: string | null }[], [history]);

  /*
   * Tagesbilanz aus der persistenten Historie.
   *
   * Die Snapshots laufen alle fuenf Minuten und werden beim Deploy auf 0
   * zurueckgesetzt (neuer Prozess, leerer Speicher). Deshalb wird NICHT die
   * gespeicherte Gesamtzahl genommen, sondern die Summe der Deltas je Tag —
   * ein Deploy kostet dabei hoechstens ein Intervall, nicht den ganzen Tag.
   */
  const tage = useMemo(() => tagesbilanz(historyDeltas), [historyDeltas]);

  /*
   * Was ist auffaellig? Heute gegen den Durchschnitt der Vortage.
   *
   * Der heutige Tag ist noch nicht vorbei, ein roher Vergleich der
   * Tagessummen waere deshalb morgens immer alarmierend niedrig. Verglichen
   * wird darum je STUNDE: heutige Summe geteilt durch die bisher
   * vergangenen Stunden, gegen den Vortagesschnitt geteilt durch 24.
   */
  const veraenderung = useMemo(() => vergleichHeuteGegenVortage(tage), [tage]);

  const zustand = snap ? gesamtzustand(snap) : null;
  const zustandsFarbe = zustand?.stufe === 'gut' ? METRIK_AMPEL.gut : zustand?.stufe === 'auffaellig' ? METRIK_AMPEL.maessig : METRIK_AMPEL.kritisch;
  const apdexInfo = apdexStufe(snap?.apdex?.wert);

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton aria-label="Zurück" onClick={() => window.history.back()}><IonIcon icon={ICON_ZURUECK} /></IonButton>
          </IonButtons>
          <IonTitle>Betrieb</IonTitle>
          <IonButtons slot="end">
            <IonButton aria-label="Daten neu laden" onClick={() => load(true)}><IonIcon icon={ICON_AKTUALISIEREN} /></IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar"><IonTitle size="large">Betrieb</IonTitle></IonToolbar>
        </IonHeader>
        <IonRefresher slot="fixed" onIonRefresh={async (e) => { await load(true); e.detail.complete(); }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && !snap ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--app-freiraum-kopf-m)' }}><IonSpinner /></div>
        ) : error ? (
          <div style={{ padding: 'var(--app-abstand-riesig) var(--app-abstand-gross)', textAlign: 'center', color: 'var(--app-color-danger)' }}>
            <IonIcon icon={ICON_WARNUNG} style={{ fontSize: 'var(--app-anzeige-gross)' }} /><p>{error}</p>
          </div>
        ) : snap && zustand ? (
          <div style={{ padding: 'var(--app-abstand-mittel) var(--app-abstand-basis) var(--app-abstand-extraweit)' }}>

            {/* 1. Läuft gerade alles? — das Urteil zuerst, die Zahlen danach. */}
            <div style={{ background: 'white', borderRadius: 'var(--app-radius-weich)', padding: 'var(--app-abstand-mittel)', marginBottom: 'var(--app-abstand-basis)', boxShadow: 'var(--app-schatten-fein)', borderLeft: `4px solid ${zustandsFarbe}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-eng)' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: 'var(--app-radius-kreis)', background: zustandsFarbe, flexShrink: 0 }} />
                <span style={{ fontSize: 'var(--app-text-gross)', fontWeight: 'var(--app-schrift-fett)', color: 'var(--app-text-emphasis)' }}>{zustand.titel}</span>
              </div>
              <div style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-text-secondary)', marginTop: 'var(--app-abstand-mini)', lineHeight: 1.4 }}>{zustand.satz}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--app-abstand-eng)', paddingTop: 'var(--app-abstand-eng)', borderTop: '1px solid var(--app-surface-dim)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
                <span>Ohne Neustart seit {fmtUptime(snap.uptimeSeconds)} · {snap.rps} Anfragen/Sek</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-kompakt)' }}>
                  alle 5 s
                  <IonToggle checked={autoRefresh} onIonChange={(e) => setAutoRefresh(e.detail.checked)} />
                </span>
              </div>
            </div>

            {/* Tabs */}
            <IonSegment scrollable value={tab} onIonChange={(e) => setTab(e.detail.value as typeof tab)} style={{ marginBottom: 'var(--app-abstand-mittel)' }}>
              <IonSegmentButton value="ueberblick"><IonLabel>Überblick</IonLabel></IonSegmentButton>
              <IonSegmentButton value="aufwand"><IonLabel>Aufwand</IonLabel></IonSegmentButton>
              <IonSegmentButton value="fehler"><IonLabel>Fehler{(snap.fehlerGruppen?.length ?? 0) > 0 ? ` (${snap.fehlerGruppen!.length})` : ''}</IonLabel></IonSegmentButton>
              <IonSegmentButton value="routen"><IonLabel>Routen</IonLabel></IonSegmentButton>
              <IonSegmentButton value="verlauf"><IonLabel>Verlauf</IonLabel></IonSegmentButton>
            </IonSegment>

            {tab === 'ueberblick' && (
              <>
                {/* 2. Merken Nutzer:innen etwas? */}
                {snap.apdex && (
                  <Karte
                    icon={ICON_DAUMEN_HOCH}
                    titel="Merken Nutzer:innen etwas?"
                    farbe={apdexInfo.farbe}
                    hinweis={`Gemessen an der Serverzeit ohne Warten auf die Verbindung. Zügig heißt hier bis ${snap.apdex.schwelleMs} ms, erträglich bis ${snap.apdex.toleriertBisMs} ms. ${apdexInfo.rat}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--app-abstand-eng)', marginBottom: 'var(--app-abstand-eng)' }}>
                      <span style={{ fontSize: 'var(--app-text-ueberschrift-gross)', fontWeight: 'var(--app-schrift-fett)', color: apdexInfo.farbe, lineHeight: 1 }}>
                        {snap.apdex.wert === null ? '–' : snap.apdex.wert.toFixed(2).replace('.', ',')}
                      </span>
                      <span style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-text-secondary)' }}>von 1,00 — {apdexInfo.text}</span>
                    </div>
                    <Anteilsbalken teile={[
                      { name: 'zügig', wert: snap.apdex.zufrieden, farbe: METRIK_AMPEL.gut },
                      { name: 'erträglich', wert: snap.apdex.toleriert, farbe: METRIK_AMPEL.maessig },
                      { name: 'zu langsam', wert: snap.apdex.frustriert, farbe: METRIK_AMPEL.kritisch },
                    ]} />
                  </Karte>
                )}

                {/* Gefühlte Wartezeit + betroffene Menschen */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--app-abstand-schmal)', marginBottom: 'var(--app-abstand-basis)' }}>
                  {snap.ueber1s && (
                    /* Die GESAMTZEIT inkl. Leitung — das ist das Warten, das
                       auf dem Gerät ankommt. Bei Foto-Uploads über Mobilfunk
                       ist das meist die Verbindung, nicht der Server; deshalb
                       steht es getrennt vom Apdex oben. */
                    <Kpi
                      icon={ICON_WARTEND}
                      label="Warten über 1 s"
                      value={`${String(snap.ueber1s.quote).replace('.', ',')} %`}
                      color={snap.ueber1s.quote >= 10 ? METRIK_AMPEL.kritisch : snap.ueber1s.quote >= 5 ? METRIK_AMPEL.erhoeht : METRIK_AMPEL.gut}
                      sub={`${fmtZahl(snap.ueber1s.anzahl)}× inkl. Leitung`}
                    />
                  )}
                  {snap.nutzer && (
                    <Kpi
                      icon={ICON_GRUPPE}
                      label={`Aktiv (${snap.nutzer.fensterMinuten} Min)`}
                      value={String(snap.nutzer.aktiv)}
                      color="var(--app-color-chat)"
                      sub={snap.nutzer.betroffen > 0 ? `${snap.nutzer.betroffen} davon mit Warten oder Fehler` : 'niemand mit Warten oder Fehler'}
                    />
                  )}
                  <Kpi icon={ICON_AKTION} label="Gleichzeitig" value={String(snap.inFlight)} color="var(--app-color-wrapped)" sub={`bisher höchstens ${snap.maxInFlight}`} />
                  <Kpi icon={ICON_PULS} label="Anfragen" value={fmtZahl(snap.totalRequests)} color="var(--app-color-chat-dunkel)" sub="seit dem letzten Neustart" />
                </div>

                {/* 3. Was ist auffällig/neu? */}
                <Karte
                  icon={ICON_STATISTIK}
                  titel="Heute gegen die Vortage"
                  farbe="var(--app-color-wrapped)"
                  hinweis={veraenderung ? `Verglichen wird je Stunde gegen den Schnitt der ${veraenderung.vergleichstage} Vortage — der heutige Tag ist noch nicht vorbei.` : undefined}
                >
                  {!veraenderung ? (
                    <div style={{ color: 'var(--app-text-system)', fontSize: 'var(--app-text-sekundaer)' }}>
                      Für einen Vergleich braucht es mindestens zwei Tage Aufzeichnung.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-schmal)' }}>
                      <Vergleich
                        name="Anfragen je Stunde"
                        jetzt={fmtZahl(Math.round(veraenderung.anfragen.heute))}
                        vorher={`sonst ${fmtZahl(Math.round(veraenderung.anfragen.vorher))}`}
                        delta={veraenderung.anfragen.delta}
                        /* Mehr Anfragen sind Nutzung, kein Problem — deshalb
                           hier keine Ampel, nur die Richtung. */
                        bewertung="neutral"
                      />
                      <Vergleich
                        name="Fehler heute"
                        jetzt={fmtZahl(veraenderung.fehler.heute)}
                        vorher={`sonst ${veraenderung.fehler.vorher.toFixed(1).replace('.', ',')} am Tag`}
                        delta={veraenderung.fehler.delta}
                        bewertung="wenigerIstBesser"
                      />
                      <Vergleich
                        name="Langsamste Route"
                        jetzt={fmtDauer(veraenderung.schlimmste.heute)}
                        vorher={veraenderung.schlimmste.route ? veraenderung.schlimmste.route : `sonst ${fmtDauer(veraenderung.schlimmste.vorher)}`}
                        delta={veraenderung.schlimmste.delta}
                        bewertung="wenigerIstBesser"
                      />
                    </div>
                  )}
                </Karte>

                {/* Antwort-Klassen: was kommt eigentlich zurück */}
                {snap.statusKlassen && (
                  <Karte
                    icon={ICON_STUFEN}
                    titel="Was der Server zurückgibt"
                    farbe="var(--app-color-chat)"
                    hinweis="„Schon bekannt“ ist gut: Die App hatte die Daten bereits, es ging nur die Rückfrage über die Leitung. „Nicht gefunden“ ist keine Störung, aber viele davon heißen, dass eine App auf etwas zeigt, das es nicht mehr gibt."
                  >
                    <Anteilsbalken teile={[
                      { name: 'in Ordnung', wert: snap.statusKlassen.erfolg, farbe: METRIK_AMPEL.gut },
                      { name: 'schon bekannt', wert: snap.statusKlassen.ausDemCache, farbe: 'var(--app-color-chat)' },
                      { name: 'weitergeleitet', wert: snap.statusKlassen.umleitung, farbe: METRIK_AMPEL.blass },
                      { name: 'nicht gefunden', wert: snap.statusKlassen.nichtGefunden, farbe: METRIK_AMPEL.maessig },
                      { name: 'abgelehnt', wert: snap.statusKlassen.abgelehnt, farbe: METRIK_AMPEL.erhoeht },
                      { name: 'Serverfehler', wert: snap.statusKlassen.serverfehler, farbe: METRIK_AMPEL.kritisch },
                    ]} />
                  </Karte>
                )}

                {/* Lastverteilung ueber die Backend-Replicas (nur bei >1 Replica) */}
                {snap.replicas && snap.replicas.length > 1 && (
                  <Karte icon={ICON_NETZWERK} titel={`Lastverteilung (${snap.replicas.length} Instanzen)`} farbe="var(--app-color-wrapped)">
                    {snap.replicas.map((r, i) => (
                      <div key={r.replica} style={{ marginBottom: i < snap.replicas!.length - 1 ? 'var(--app-abstand-eng)' : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--app-text-hinweis)', marginBottom: 'var(--app-abstand-mini)' }}>
                          <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--app-text-body)' }}>{r.replica.slice(0, 12)}</span>
                          <span style={{ color: 'var(--app-text-secondary)' }}>{fmtZahl(r.requests)} Anfragen · {(r.share * 100).toFixed(0)} % · {r.inFlight} aktiv</span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--app-border-soft)', borderRadius: 'var(--app-radius-fein)', overflow: 'hidden' }}>
                          <div style={{ width: `${r.share * 100}%`, height: '100%', background: i === 0 ? 'var(--app-color-chat)' : 'var(--app-color-wrapped)', borderRadius: 'var(--app-radius-fein)' }} />
                        </div>
                      </div>
                    ))}
                    {/* Hinweis auf Schieflast, wenn eine Instanz >70% traegt */}
                    {snap.replicas.some(r => r.share > 0.7) && (
                      <div style={{ fontSize: 'var(--app-text-meta)', color: METRIK_AMPEL.erhoeht, marginTop: 'var(--app-abstand-kompakt)' }}>
                        Hinweis: Last ungleich verteilt — eine Instanz trägt den Großteil.
                      </div>
                    )}
                  </Karte>
                )}

                {/* Live-Verlauf */}
                <Karte icon={ICON_UHRZEIT} titel="Anfragen pro Minute (letzte 30 Min)" hinweis="Rot markiert die Minuten mit Fehlern.">
                  <TimelineChart data={snap.timeline} />
                </Karte>
              </>
            )}

            {/* 4. Wo lohnt sich Arbeit? */}
            {tab === 'aufwand' && <AufwandListe rows={snap.routesPotenzial ?? []} uptimeSeconds={snap.uptimeSeconds} />}

            {/* 5. Fehler: was, wie oft, seit wann */}
            {tab === 'fehler' && <FehlerListe gruppen={snap.fehlerGruppen ?? []} letzte={snap.recentErrors} />}

            {tab === 'routen' && (
              <>
                <IonSegment value={routenSicht} onIonChange={(e) => setRoutenSicht(e.detail.value as 'slow' | 'busy')} style={{ marginBottom: 'var(--app-abstand-mittel)' }}>
                  <IonSegmentButton value="slow"><IonLabel>Langsamste</IonLabel></IonSegmentButton>
                  <IonSegmentButton value="busy"><IonLabel>Häufigste</IonLabel></IonSegmentButton>
                </IonSegment>
                <RouteTable rows={routenSicht === 'slow' ? snap.routesSlowest : snap.routesBusiest} mode={routenSicht} />
                <div style={{ fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)', marginTop: 'var(--app-abstand-eng)', lineHeight: 1.4 }}>
                  Alle Zeiten oben sind Serverzeiten, also ohne Warten auf die Verbindung des Geräts.
                  Nur daran ändert eine Änderung am Server etwas.
                </div>
              </>
            )}

            {tab === 'verlauf' && <VerlaufListe tage={tage} deltas={historyDeltas} />}
          </div>
        ) : null}
      </IonContent>
    </IonPage>
  );
};

// Eine Zeile "heute gegen sonst" mit Richtungspfeil.
const Vergleich: React.FC<{ name: string; jetzt: string; vorher: string; delta: number | null; bewertung: 'neutral' | 'wenigerIstBesser' }> = ({ name, jetzt, vorher, delta, bewertung }) => {
  // Unter 10 % Abweichung ist es Rauschen und bekommt keine Farbe — sonst
  // leuchtet jeden Morgen irgendetwas rot, ohne dass etwas passiert waere.
  const merklich = delta !== null && Math.abs(delta) >= 10;
  const farbe = !merklich || bewertung === 'neutral'
    ? 'var(--app-text-system)'
    : delta! > 0 ? METRIK_AMPEL.erhoeht : METRIK_AMPEL.gut;
  const pfeil = delta === null ? '' : delta > 0 ? '▲' : delta < 0 ? '▼' : '=';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--app-abstand-eng)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-text-body)' }}>{name}</div>
        <div style={{ fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vorher}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 'var(--app-text-gross)', fontWeight: 'var(--app-schrift-fett)', color: 'var(--app-text-emphasis)' }}>{jetzt}</div>
        {delta !== null && (
          <div style={{ fontSize: 'var(--app-text-meta)', color: farbe, fontWeight: merklich ? 'var(--app-schrift-halbfett)' : 'normal' }}>
            {pfeil} {Math.abs(delta)} %
          </div>
        )}
      </div>
    </div>
  );
};

/*
 * Wo lohnt sich Arbeit?
 *
 * Sortiert nach der GESAMTEN Serverzeit einer Route (Anzahl x Dauer), nicht
 * nach dem p95. Eine Route mit 800 ms p95 und drei Aufrufen kostet zwei
 * Sekunden am Tag; eine mit 70 ms und 4000 Aufrufen kostet fuenf Minuten.
 * Nach p95 stuende die erste oben — und die Arbeit daran waere vertan.
 *
 * Danebengestellt wird, was eine Verbesserung auf 100 ms brächte: Das ist
 * die Zahl, aus der sich eine Entscheidung ableiten laesst.
 */
const ZIEL_MS = 100;
const AufwandListe: React.FC<{ rows: RouteRow[]; uptimeSeconds: number }> = ({ rows, uptimeSeconds }) => {
  const mitPotenzial = rows
    .map(r => {
      const gesamt = r.serverZeitGesamtMs ?? 0;
      const schnitt = r.serverAvgMs ?? r.avgMs;
      // Nur der Anteil ueber dem Ziel ist einsparbar; unter dem Ziel gibt es
      // nichts zu holen.
      const einsparbar = schnitt > ZIEL_MS ? (schnitt - ZIEL_MS) * r.count : 0;
      return { ...r, gesamt, schnitt, einsparbar };
    })
    .filter(r => r.gesamt > 0);
  const summe = mitPotenzial.reduce((s, r) => s + r.gesamt, 0);
  // Auf einen Tag hochgerechnet, damit "8 s" nicht nach nichts aussieht,
  // wenn der Server erst 20 Minuten läuft.
  const proTag = (ms: number) => uptimeSeconds > 0 ? (ms / uptimeSeconds) * 86400 : 0;

  if (mitPotenzial.length === 0) {
    return <div style={{ background: 'white', borderRadius: 'var(--app-radius-weich)', padding: 'var(--app-abstand-gross)', textAlign: 'center', color: 'var(--app-text-system)', fontSize: 'var(--app-text-sekundaer)', boxShadow: 'var(--app-schatten-fein)' }}>
      Noch keine Daten. Die Liste füllt sich mit den ersten Anfragen.
    </div>;
  }

  return (
    <>
      <div style={{ background: 'white', borderRadius: 'var(--app-radius-weich)', overflow: 'hidden', boxShadow: 'var(--app-schatten-fein)' }}>
        <div style={{ padding: 'var(--app-abstand-schmal) var(--app-abstand-mittel)', fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', borderBottom: '1px solid var(--app-surface-dim)', lineHeight: 1.4, display: 'flex', gap: 'var(--app-abstand-kompakt)' }}>
          <IonIcon icon={ICON_WERKZEUG} style={{ color: 'var(--app-color-wrapped)', flexShrink: 0, marginTop: 'var(--app-abstand-winzig)' }} />
          <span>Sortiert nach gesamter Serverzeit (Aufrufe × Dauer) — nicht nach der
          langsamsten einzelnen Anfrage. Oben steht, wo die Zeit tatsächlich hingeht.</span>
        </div>
        {mitPotenzial.slice(0, 12).map((r, i) => (
          <div key={r.route} style={{ padding: 'var(--app-abstand-schmal) var(--app-abstand-mittel)', borderTop: i ? '1px solid var(--app-surface-dim)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--app-abstand-eng)' }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 'var(--app-text-hinweis)', color: 'var(--app-text-emphasis)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{r.route}</span>
              <span style={{ fontWeight: 'var(--app-schrift-fett)', fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-text-emphasis)', flexShrink: 0 }}>{fmtDauer(r.gesamt)}</span>
            </div>
            {/* Anteil an der gesamten Serverzeit als Balken */}
            <div style={{ height: '6px', background: 'var(--app-border-soft)', borderRadius: 'var(--app-radius-fein)', overflow: 'hidden', margin: 'var(--app-abstand-kompakt) 0' }}>
              <div style={{ width: `${summe > 0 ? (r.gesamt / summe) * 100 : 0}%`, height: '100%', background: msColor(r.schnitt), borderRadius: 'var(--app-radius-fein)' }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--app-abstand-mittel)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
              <span>{fmtZahl(r.count)}× à {Math.round(r.schnitt)} ms</span>
              <span>{summe > 0 ? Math.round((r.gesamt / summe) * 100) : 0} % der Serverzeit</span>
              {r.einsparbar > 0
                ? <span style={{ color: METRIK_AMPEL.gut, fontWeight: 'var(--app-schrift-halbfett)' }}>
                  auf {ZIEL_MS} ms gebracht: {fmtDauer(proTag(r.einsparbar))} am Tag gespart
                </span>
                : <span style={{ color: METRIK_AMPEL.blass }}>schon unter {ZIEL_MS} ms — nichts zu holen</span>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)', marginTop: 'var(--app-abstand-eng)', lineHeight: 1.4 }}>
        Die Ersparnis ist auf einen vollen Tag hochgerechnet, gemessen an der
        bisherigen Laufzeit. Eine Route, die schon unter {ZIEL_MS} ms liegt, ist
        kein lohnendes Ziel — auch wenn sie oben in der Liste steht.
      </div>
    </>
  );
};

// Fehler: gruppiert statt als Rohliste. "Seit wann" ist die eigentliche Frage.
const FehlerListe: React.FC<{ gruppen: FehlerGruppe[]; letzte: ErrorRow[] }> = ({ gruppen, letzte }) => {
  if (gruppen.length === 0) {
    return (
      <div style={{ background: 'white', borderRadius: 'var(--app-radius-weich)', padding: 'var(--app-abstand-weit)', textAlign: 'center', color: METRIK_AMPEL.gut, fontSize: 'var(--app-text-basis)', boxShadow: 'var(--app-schatten-fein)' }}>
        <IonIcon icon={ICON_PULS} style={{ fontSize: 'var(--app-anzeige-zahl)' }} /><div>Kein Fehler seit dem letzten Neustart.</div>
      </div>
    );
  }
  const bezeichnung = (s: number) => s >= 500 ? 'Serverfehler' : s === 404 ? 'nicht gefunden' : s === 403 ? 'abgelehnt' : s === 401 ? 'nicht angemeldet' : 'abgewiesen';
  return (
    <>
      <div style={{ background: 'white', borderRadius: 'var(--app-radius-weich)', overflow: 'hidden', boxShadow: 'var(--app-schatten-fein)' }}>
        <div style={{ padding: 'var(--app-abstand-schmal) var(--app-abstand-mittel)', fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', borderBottom: '1px solid var(--app-surface-dim)', lineHeight: 1.4 }}>
          Zusammengefasst nach Route und Art. Nur Serverfehler (500er) sind
          eine Störung — der Rest sagt meist, dass eine App etwas anfragt, das
          es nicht gibt oder das ihr nicht zusteht.
        </div>
        {gruppen.map((g, i) => (
          <div key={`${g.route}-${g.status}`} style={{ padding: 'var(--app-abstand-schmal) var(--app-abstand-mittel)', borderTop: i ? '1px solid var(--app-surface-dim)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--app-abstand-eng)' }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 'var(--app-text-hinweis)', color: 'var(--app-text-emphasis)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{g.route}</span>
              <span style={{ fontWeight: 'var(--app-schrift-fett)', fontSize: 'var(--app-text-sekundaer)', color: statusColor(g.status), flexShrink: 0 }}>{fmtZahl(g.anzahl)}×</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--app-abstand-mittel)', marginTop: 'var(--app-abstand-mini)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
              <span style={{ color: statusColor(g.status), fontWeight: 'var(--app-schrift-halbfett)' }}>{g.status} · {bezeichnung(g.status)}</span>
              <span>erstmals {fmtSeit(g.seit)}</span>
              <span>zuletzt {fmtSeit(g.zuletzt)}</span>
            </div>
            <div style={{ fontSize: 'var(--app-text-meta)', color: METRIK_AMPEL.blass, marginTop: 'var(--app-abstand-winzig)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              zuletzt: {g.beispielUrl}
            </div>
          </div>
        ))}
      </div>

      {letzte.length > 0 && (
        <div style={{ background: 'white', borderRadius: 'var(--app-radius-weich)', overflow: 'hidden', boxShadow: 'var(--app-schatten-fein)', marginTop: 'var(--app-abstand-basis)' }}>
          <div style={{ padding: 'var(--app-abstand-schmal) var(--app-abstand-mittel)', fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', borderBottom: '1px solid var(--app-surface-dim)' }}>
            Die letzten Einzelfälle
          </div>
          {letzte.slice(0, 15).map((er, i) => (
            <div key={i} style={{ padding: 'var(--app-abstand-eng) var(--app-abstand-mittel)', borderTop: i ? '1px solid var(--app-surface-dim)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--app-abstand-eng)' }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 'var(--app-text-hinweis)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{er.url}</span>
                <span style={{ fontWeight: 'var(--app-schrift-fett)', fontSize: 'var(--app-text-hinweis)', color: statusColor(er.status), flexShrink: 0 }}>{er.status}</span>
              </div>
              <div style={{ fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)', marginTop: 'var(--app-abstand-winzig)' }}>{fmtTime(er.at)} Uhr · {er.durationMs} ms</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

// Verlauf: erst die Tagesbilanz, darunter die Fünf-Minuten-Schritte.
const VerlaufListe: React.FC<{
  tage: { tag: string; anfragen: number; fehler: number; schlimmsteMs: number; schlimmsteRoute: string | null }[];
  deltas: { at: string; requests: number; errors: number; worstP95: number; worstRoute: string | null }[];
}> = ({ tage, deltas }) => (
  <>
    <div style={{ background: 'white', borderRadius: 'var(--app-radius-weich)', overflow: 'hidden', boxShadow: 'var(--app-schatten-fein)', marginBottom: 'var(--app-abstand-basis)' }}>
      <div style={{ padding: 'var(--app-abstand-schmal) var(--app-abstand-mittel)', fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', borderBottom: '1px solid var(--app-surface-dim)' }}>
        Je Tag (letzte 14 Tage) — übersteht Neustarts und Aktualisierungen
      </div>
      {tage.length === 0 ? (
        <div style={{ padding: 'var(--app-abstand-gross)', color: 'var(--app-text-system)', fontSize: 'var(--app-text-sekundaer)', textAlign: 'center' }}>Noch keine Aufzeichnung (erster Eintrag nach etwa 5 Min).</div>
      ) : [...tage].reverse().map((t, i) => (
        <div key={t.tag} style={{ padding: 'var(--app-abstand-eng) var(--app-abstand-mittel)', borderTop: i ? '1px solid var(--app-surface-dim)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--app-abstand-eng)' }}>
            <span style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-text-body)', fontWeight: 'var(--app-schrift-halbfett)' }}>{t.tag}</span>
            <span style={{ display: 'flex', gap: 'var(--app-abstand-mittel)', fontSize: 'var(--app-text-klein)' }}>
              <span style={{ color: 'var(--app-color-chat)' }}>{fmtZahl(t.anfragen)} Anfragen</span>
              <span style={{ color: t.fehler > 0 ? 'var(--app-color-danger)' : METRIK_AMPEL.gut, fontWeight: t.fehler > 0 ? 'var(--app-schrift-halbfett)' : 'normal' }}>{t.fehler} Fehler</span>
              <span style={{ color: msColor(t.schlimmsteMs) }}>{fmtDauer(t.schlimmsteMs)}</span>
            </span>
          </div>
          {t.schlimmsteRoute && (
            <div style={{ fontSize: 'var(--app-text-meta)', color: METRIK_AMPEL.blass, marginTop: 'var(--app-abstand-winzig)', fontFamily: 'ui-monospace, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              langsamste Route: {t.schlimmsteRoute}
            </div>
          )}
        </div>
      ))}
    </div>

    <div style={{ background: 'white', borderRadius: 'var(--app-radius-weich)', overflow: 'hidden', boxShadow: 'var(--app-schatten-fein)' }}>
      <div style={{ padding: 'var(--app-abstand-schmal) var(--app-abstand-mittel)', fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', borderBottom: '1px solid var(--app-surface-dim)' }}>
        In Fünf-Minuten-Schritten
      </div>
      {deltas.length === 0 ? (
        <div style={{ padding: 'var(--app-abstand-gross)', color: 'var(--app-text-system)', fontSize: 'var(--app-text-sekundaer)', textAlign: 'center' }}>Noch keine Aufzeichnung.</div>
      ) : [...deltas].reverse().slice(0, 60).map((d, i) => (
        <div key={i} style={{ padding: 'var(--app-abstand-eng) var(--app-abstand-mittel)', borderTop: i ? '1px solid var(--app-surface-dim)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--app-abstand-eng)' }}>
          <span style={{ fontSize: 'var(--app-text-klein)', color: 'var(--app-text-secondary)', flexShrink: 0 }}>{fmtDateTime(d.at)}</span>
          <span style={{ display: 'flex', gap: 'var(--app-abstand-schmal)', fontSize: 'var(--app-text-klein)' }}>
            <span style={{ color: 'var(--app-color-chat)' }}>{fmtZahl(d.requests)} Anfragen</span>
            {d.errors > 0 && <span style={{ color: 'var(--app-color-danger)', fontWeight: 'var(--app-schrift-halbfett)' }}>{d.errors} Fehler</span>}
            <span style={{ color: msColor(d.worstP95) }}>{fmtDauer(d.worstP95)}</span>
          </span>
        </div>
      ))}
    </div>
  </>
);

export default AdminMetricsPage;
