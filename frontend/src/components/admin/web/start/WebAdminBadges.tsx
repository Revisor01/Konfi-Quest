// Badges verwalten in der Web-Fassung (Browser ab 992 px): eine Tabelle mit
// Suche, Filter und Sortierung statt der Gruppen aus Listenzeilen. Oben die
// Kennzahlen, darüber der Wechsel zwischen den Badges der Konfis und denen
// des Teams.
//
// Die Seite lädt und speichert nichts selbst: Liste, Suche, Filter, Löschen
// und das Formular zum Bearbeiten gehören der App-Fassung
// (admin/BadgesView.tsx und admin/pages/AdminBadgesPage.tsx) -- hier kommt
// alles als Daten und Funktionen an. „Bearbeiten" öffnet dasselbe Formular
// (BadgeManagementModal) wie in der App.

import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ABZEICHEN, ICON_BEARBEITEN, ICON_LOESCHEN } from '../../../shared/icons';
import { getIconFromString } from '../../../../utils/badgeIcons';
import { getCriteriaIcon } from '../../../../utils/badgeCriteria';
import WebKachel from '../../../web/WebKachel';
import WebChips from '../../../web/WebChips';
import WebSuche from '../../../web/WebSuche';
import WebAuswahl from '../../../web/WebAuswahl';
import WebTabelle from '../../../web/WebTabelle';
import WebPill from '../../../web/WebPill';
import WebKnopf from '../../../web/WebKnopf';
import WebTreffer from '../../../web/WebTreffer';
import { WebLeer } from '../../../web/WebZustaende';
import WebBadgeSymbol from '../../../konfi/web/WebBadgeSymbol';
import '../../../../theme/web/start.css';
import { badgeStatusRang } from '../../../../utils/statusReihenfolge';
import { inFassung } from '../../../../seiten/beschreibung';
import {
  BADGES_GRUPPE,
  BADGES_GRUPPE_BESCHRIFTUNG,
  LEITUNG_BADGES_LEER,
  LEITUNG_BADGES_STATUS,
  LEITUNG_BADGES_STATUS_BESCHRIFTUNG,
  type BadgesGruppe,
  type LeitungBadgesStatus,
} from '../../../../seiten/badgesLeitung';

export interface WebAdminBadge {
  id: number;
  name: string;
  icon: string;
  description?: string;
  criteria_type: string;
  criteria_value: number;
  is_active: boolean;
  is_hidden: boolean;
  earned_count: number;
  color?: string;
}

export type WebBadgeFilter = LeitungBadgesStatus;
export type WebBadgeGruppe = BadgesGruppe;
type Sortierung = 'kriterium' | 'name' | 'verliehen';

export interface WebAdminBadgesProps<T extends WebAdminBadge> {
  /** Alle Badges der gewählten Gruppe (für Zahlen und Chips). */
  badges: T[];
  /** Die Badges nach Suche und Filter, so geordnet wie in der App. */
  gefiltert: T[];
  suche: string;
  onSuche: (wert: string) => void;
  filter: WebBadgeFilter;
  onFilter: (filter: WebBadgeFilter) => void;
  gruppe: WebBadgeGruppe;
  onGruppe?: (gruppe: WebBadgeGruppe) => void;
  kriteriumText: (typ: string) => string;
  kriteriumDetail: (badge: T) => string | null;
  onBearbeiten: (badge: T) => void;
  onLoeschen: (badge: T) => void;
}

function WebAdminBadges<T extends WebAdminBadge>(p: WebAdminBadgesProps<T>): React.ReactElement {
  const [sortierung, setSortierung] = useState<Sortierung>('kriterium');

  // Zahl je Stand mit dem Prädikat der gemeinsamen Beschreibung (seiten/badgesLeitung.ts).
  const zahl = Object.fromEntries(
    LEITUNG_BADGES_STATUS.map((w) => [w.schluessel, p.badges.filter((b) => w.passt?.(b) ?? true).length]),
  ) as Record<WebBadgeFilter, number>;
  const aktiv = zahl.aktiv;
  const geheim = zahl.versteckt;
  const verliehen = p.badges.reduce((summe, b) => summe + (b.earned_count || 0), 0);

  const zeilen = [...p.gefiltert].sort((a, b) => {
    if (sortierung === 'name') return (a.name || '').localeCompare(b.name || '', 'de');
    if (sortierung === 'verliehen') return (b.earned_count || 0) - (a.earned_count || 0) || (a.name || '').localeCompare(b.name || '', 'de');
    return p.kriteriumText(a.criteria_type).localeCompare(p.kriteriumText(b.criteria_type), 'de')
      || (a.criteria_value - b.criteria_value)
      || (a.name || '').localeCompare(b.name || '', 'de');
  });

  return (
    <div className="web-start web-rolle web-rolle--leitung">
      <div className="web-raster web-raster--kacheln">
        <WebKachel label="Badges" wert={String(p.badges.length)} zusatz={[p.gruppe === 'konfi' ? 'für Konfis' : 'fürs Team']} />
        <WebKachel label="Aktiv" wert={String(aktiv)} zusatz={['sichtbar und vergebbar']} />
        <WebKachel label="Geheim" wert={String(geheim)} zusatz={['bleiben verborgen, bis sie erreicht sind']} />
        <WebKachel label="Verliehen" wert={String(verliehen)} zusatz={['insgesamt vergeben']} />
      </div>

      <div className="web-werkzeuge web-badges-werkzeuge">
        {p.onGruppe && (
          <WebChips<WebBadgeGruppe>
            beschriftung={BADGES_GRUPPE_BESCHRIFTUNG}
            wert={p.gruppe}
            onWert={p.onGruppe}
            chips={inFassung(BADGES_GRUPPE, 'web').map((g) => ({ wert: g.schluessel, label: g.label }))}
          />
        )}
        <WebSuche beschriftung="Badges durchsuchen" platzhalter="Badges durchsuchen" wert={p.suche} onWert={p.onSuche} />
        <WebChips<WebBadgeFilter>
          beschriftung={LEITUNG_BADGES_STATUS_BESCHRIFTUNG}
          wert={p.filter}
          onWert={p.onFilter}
          chips={inFassung(LEITUNG_BADGES_STATUS, 'web').map((w) => ({ wert: w.schluessel, label: w.label, zahl: zahl[w.schluessel] }))}
        />
        <div className="web-werkzeuge__rechts web-badges-kategorie">
          <WebAuswahl
            label="Sortierung"
            wert={sortierung}
            onWert={(w) => setSortierung(w as Sortierung)}
            optionen={[
              { wert: 'kriterium', label: 'Nach Kriterium' },
              { wert: 'name', label: 'Nach Name' },
              { wert: 'verliehen', label: 'Nach Verliehen' },
            ]}
          />
        </div>
      </div>

      <section className="web-karte" aria-label="Badges">
        {zeilen.length === 0 ? (
          <WebLeer
            icon={ICON_ABZEICHEN}
            titel={LEITUNG_BADGES_LEER.titel}
            text={p.badges.length === 0 ? LEITUNG_BADGES_LEER.ohneBadges : LEITUNG_BADGES_LEER.ohneTreffer}
          />
        ) : (
          <WebTabelle<T>
            beschriftung="Badges"
            mittig
            zeilen={zeilen}
            zeileSchluessel={(b) => b.id}
            zeileKlasse={(b) => (b.is_active ? undefined : 'web-zeile--gesperrt')}
            spalten={[
              {
                schluessel: 'badge',
                kopf: 'Badge',
                sortWert: (b) => b.name,
                zelle: (b) => (
                  <span className="web-badge-zelle">
                    <WebBadgeSymbol icon={getIconFromString(b.icon)} farbe={b.color || 'var(--app-color-users)'} erreicht={b.is_active} groesse="klein" />
                    <span className="web-badge-zelle__text">
                      <button type="button" className="web-badge-zelle__name" onClick={() => p.onBearbeiten(b)} aria-label={`${b.name} bearbeiten`}>
                        <WebTreffer text={b.name} suche={p.suche} />
                      </button>
                      {b.description && <span className="web-zelle-leise web-einzeilig">{b.description}</span>}
                    </span>
                  </span>
                ),
              },
              {
                schluessel: 'kriterium',
                kopf: 'Kriterium',
                optional: true,
                sortWert: (b) => p.kriteriumText(b.criteria_type),
                zelle: (b) => (
                  <span className="web-badge-kriterium">
                    <IonIcon icon={getCriteriaIcon(b.criteria_type)} className="web-badge-kriterium__symbol" aria-hidden="true" />
                    <span>
                      <span className="web-zelle-titel">{p.kriteriumText(b.criteria_type)}</span>
                      {p.kriteriumDetail(b) && <span className="web-zelle-leise">{p.kriteriumDetail(b)}</span>}
                    </span>
                  </span>
                ),
              },
              {
                schluessel: 'status',
                kopf: 'Status',
                breite: '210px',
                sortWert: (b) => badgeStatusRang(b),
                zelle: (b) => (
                  <span className="web-pillreihe">
                    <WebPill ton={b.is_active ? 'erfolg' : 'fehler'} punkt>{b.is_active ? 'Aktiv' : 'Inaktiv'}</WebPill>
                    <WebPill ton={b.is_hidden ? 'warnung' : 'info'}>{b.is_hidden ? 'Geheim' : 'Sichtbar'}</WebPill>
                  </span>
                ),
              },
              { schluessel: 'verliehen', kopf: 'Verliehen', zahl: true, breite: '110px', sortWert: (b) => b.earned_count || 0, zelle: (b) => `${b.earned_count || 0}×` },
              {
                schluessel: 'aktionen',
                kopf: 'Aktionen',
                kopfVersteckt: true,
                breite: '120px',
                zelle: (b) => (
                  <span className="web-badge-aktionen">
                    <WebKnopf klein symbol onClick={() => p.onBearbeiten(b)} aria-label={`${b.name} bearbeiten`} title="Bearbeiten">
                      <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
                    </WebKnopf>
                    <WebKnopf klein symbol art="gefahr" onClick={() => p.onLoeschen(b)} aria-label={`${b.name} löschen`} title="Löschen">
                      <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
                    </WebKnopf>
                  </span>
                ),
              },
            ]}
          />
        )}
      </section>
    </div>
  );
}

export default WebAdminBadges;
