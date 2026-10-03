// Die Badge-Seite in der Web-Fassung (Browser ab 992 px) -- für Konfis UND Team:
// Kennzahlen oben, darunter Suche und Filter (erhalten, offen, in Arbeit,
// Kategorie), dann je Kategorie ein Raster aus Badge-Karten. Ein Klick auf eine
// Karte öffnet die Einzelheiten im Dialog (WebBadgeDialog).
//
// Die Seite lädt nichts selbst: Badges, Kategorien und Zahlen reicht die
// App-Fassung durch (konfi/views/BadgesView.tsx, dieselbe Ansicht für Konfis und
// Team). Hier wird nur gefiltert und gezeigt.

import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_POKAL, ICON_VERBORGEN_GEFUELLT, ICON_ZUSAGE_GEFUELLT } from '../../shared/icons';
import { useApp } from '../../../contexts/AppContext';
import { datumKurz } from '../../../utils/dateUtils';
import { getIconFromString } from '../../../utils/badgeIcons';
import { getBadgeColor } from '../../shared/BadgePopoverContent';
import type { AnzeigeBadge } from '../../../types/dashboard';
import WebKachel from '../../web/WebKachel';
import WebChips from '../../web/WebChips';
import WebSuche from '../../web/WebSuche';
import WebAuswahl from '../../web/WebAuswahl';
import WebPill from '../../web/WebPill';
import { WebLeer } from '../../web/WebZustaende';
import WebBadgeSymbol from './WebBadgeSymbol';
import WebBadgeDialog from './WebBadgeDialog';
import WebFortschritt from './WebFortschritt';
import '../../../theme/web/start.css';

export interface WebBadgeKategorie {
  key: string;
  title: string;
  icon: string;
  color: string;
  badges: AnzeigeBadge[];
}

export interface WebBadgesRasterProps {
  /** Alle Kategorien mit ihren Badges, ungefiltert. */
  kategorien: WebBadgeKategorie[];
  badgeStats: { totalVisible: number; totalSecret: number };
}

type Status = 'alle' | 'erhalten' | 'offen' | 'arbeit';

const inArbeit = (b: AnzeigeBadge): boolean => !b.is_earned && (b.progress_percentage ?? 0) > 0;

const normal = (text: string): string => text.toLowerCase();

/** Eine Badge-Karte: Symbol (mit Fortschrittsring), Name, Beschreibung, Stand. */
const BadgeKarte: React.FC<{ badge: AnzeigeBadge; onOeffnen: (id: number) => void }> = ({ badge, onOeffnen }) => {
  const arbeit = inArbeit(badge);
  const prozent = Math.round(badge.progress_percentage ?? 0);
  const stand = badge.is_earned
    ? 'erreicht'
    : arbeit ? `in Arbeit, ${prozent} Prozent` : 'noch nicht erreicht';
  return (
    <li>
      <button
        type="button"
        className={`web-abzeichen-karte${badge.is_earned ? '' : ' web-abzeichen-karte--offen'}`}
        onClick={() => onOeffnen(badge.id)}
        aria-label={`${badge.name}, ${stand}: Einzelheiten ansehen`}
      >
        <WebBadgeSymbol
          icon={getIconFromString(badge.icon)}
          farbe={getBadgeColor(badge)}
          erreicht={badge.is_earned}
          fortschritt={arbeit ? prozent : 0}
          groesse="mittel"
        />
        <span className="web-abzeichen-karte__text">
          <span className="web-abzeichen-karte__name">
            {badge.name}
            {badge.is_hidden && badge.is_earned && (
              <span className="web-abzeichen-karte__geheim" title="Geheimes Badge">
                <IonIcon icon={ICON_VERBORGEN_GEFUELLT} aria-hidden="true" />
                <span className="web-nur-vorlesen">Geheimes Badge</span>
              </span>
            )}
          </span>
          {badge.description && <span className="web-abzeichen-karte__beschreibung">{badge.description}</span>}
          <span className="web-abzeichen-karte__stand">
            {badge.is_earned ? (
              <WebPill ton="erfolg" punkt>
                Erreicht{badge.earned_at ? ` am ${datumKurz(badge.earned_at)}` : ''}
              </WebPill>
            ) : arbeit ? (
              <span className="web-abzeichen-karte__fortschritt" aria-hidden="true">
                <WebFortschritt prozent={prozent} beschriftung="Fortschritt" ton="level" />
                <span>{badge.progress_points ?? 0} / {badge.criteria_value}</span>
              </span>
            ) : (
              <span className="web-gedaempft">Noch nicht erreicht</span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
};

const WebBadgesRaster: React.FC<WebBadgesRasterProps> = ({ kategorien, badgeStats }) => {
  const { user } = useApp();
  const [status, setStatus] = useState<Status>('alle');
  const [kategorie, setKategorie] = useState('alle');
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState<number | null>(null);

  const alle = useMemo(() => kategorien.flatMap((k) => k.badges), [kategorien]);
  const erreichte = alle.filter((b) => b.is_earned);
  const sichtbarErreicht = erreichte.filter((b) => !b.is_hidden).length;
  const geheimErreicht = erreichte.filter((b) => b.is_hidden).length;
  const gesamt = badgeStats.totalVisible + badgeStats.totalSecret;
  const prozent = gesamt === 0 ? 0 : Math.round((erreichte.length / gesamt) * 100);

  const zahl = {
    alle: alle.length,
    erhalten: erreichte.length,
    offen: alle.filter((b) => !b.is_earned).length,
    arbeit: alle.filter(inArbeit).length,
  };

  const passt = (b: AnzeigeBadge): boolean => {
    if (status === 'erhalten' && !b.is_earned) return false;
    if (status === 'offen' && b.is_earned) return false;
    if (status === 'arbeit' && !inArbeit(b)) return false;
    const q = normal(suche.trim());
    return !q || normal(b.name).includes(q) || normal(b.description ?? '').includes(q);
  };

  const gezeigt = kategorien
    .filter((k) => kategorie === 'alle' || k.key === kategorie)
    .map((k) => ({ ...k, sichtbar: k.badges.filter(passt) }))
    .filter((k) => k.sichtbar.length > 0);

  const gewaehlt = offen === null ? null : alle.find((b) => b.id === offen) ?? null;
  const gefiltert = status !== 'alle' || suche.trim() !== '' || kategorie !== 'alle';

  const leer = (() => {
    if (suche.trim() !== '') return { titel: 'Keine Badges gefunden', text: 'Zu diesem Suchbegriff gibt es kein Badge. Versuch es mit einem anderen Wort.' };
    if (status === 'offen') return { titel: 'Alle Badges erreicht!', text: 'Du hast alle sichtbaren Badges eingesammelt.' };
    if (status === 'arbeit') return { titel: 'Keine Badges in Arbeit', text: 'Sammle Punkte, um den Fortschritt bei Badges zu starten!' };
    if (status === 'erhalten') return { titel: 'Noch keine Badges erhalten', text: 'Sammle Punkte für deine ersten Badges!' };
    return { titel: 'Keine Badges gefunden', text: 'Sammle Punkte für deine ersten Badges!' };
  })();

  return (
    <div className={user?.type === 'teamer' ? 'web-start web-rolle web-rolle--team' : 'web-start web-rolle'}>
      <div className="web-raster web-raster--kacheln">
        <WebKachel label="Erreicht" wert={String(sichtbarErreicht)} zusatz={[`von ${badgeStats.totalVisible} sichtbaren`]} />
        {badgeStats.totalSecret > 0 && (
          <WebKachel label="Geheim" wert={String(geheimErreicht)} zusatz={[`von ${badgeStats.totalSecret} geheimen`]} />
        )}
        <WebKachel label="In Arbeit" wert={String(zahl.arbeit)} zusatz={['Badges mit Fortschritt']} />
        <WebKachel label="Geschafft" wert={`${prozent} %`} zusatz={[`${erreichte.length} von ${gesamt} Badges`]} />
      </div>

      <div className="web-werkzeuge web-badges-werkzeuge">
        <WebSuche beschriftung="Badges durchsuchen" platzhalter="Badges durchsuchen" wert={suche} onWert={setSuche} />
        <WebChips<Status>
          beschriftung="Status"
          wert={status}
          onWert={setStatus}
          chips={[
            { wert: 'alle', label: 'Alle', zahl: zahl.alle },
            { wert: 'erhalten', label: 'Erhalten', zahl: zahl.erhalten },
            { wert: 'offen', label: 'Offen', zahl: zahl.offen },
            { wert: 'arbeit', label: 'In Arbeit', zahl: zahl.arbeit },
          ]}
        />
        <div className="web-werkzeuge__rechts web-badges-kategorie">
          <WebAuswahl
            label="Kategorie"
            wert={kategorie}
            onWert={setKategorie}
            optionen={[{ wert: 'alle', label: 'Alle Kategorien' }, ...kategorien.map((k) => ({ wert: k.key, label: k.title }))]}
          />
        </div>
      </div>

      {gezeigt.length === 0 ? (
        <div className="web-karte">
          <WebLeer icon={gefiltert ? ICON_ZUSAGE_GEFUELLT : ICON_POKAL} titel={leer.titel} text={leer.text} />
        </div>
      ) : (
        gezeigt.map((k) => {
          const erreicht = k.badges.filter((b) => b.is_earned).length;
          const anteil = Math.round((erreicht / k.badges.length) * 100);
          const geheimOffen = k.badges.some((b) => b.is_hidden && !b.is_earned);
          return (
            <section key={k.key} className="web-karte" aria-labelledby={`web-badges-${k.key}`}>
              <header className="web-karte__kopf">
                <div className="web-kategorie__kopf">
                  <span className="web-kategorie__symbol" style={{ background: k.color }} aria-hidden="true">
                    <IonIcon icon={k.icon} />
                  </span>
                  <div>
                    <h2 id={`web-badges-${k.key}`} className="web-karte__titel">{k.title}</h2>
                    <p className="web-karte__untertitel">
                      {erreicht} von {k.badges.length} erreicht{geheimOffen && anteil === 100 ? ' – ein geheimes Badge fehlt noch' : ''}
                    </p>
                  </div>
                </div>
                <div className="web-karte__aktion web-kategorie__fortschritt">
                  <WebFortschritt prozent={anteil} beschriftung={`${k.title}: erreicht`} ton="level" wertText={`${erreicht} von ${k.badges.length}`} />
                  <span className="web-kategorie__prozent">{anteil} %</span>
                </div>
              </header>
              <div className="web-karte__inhalt">
                <ul className="web-abzeichen-raster" aria-label={`${k.title}: Badges`}>
                  {k.sichtbar.map((b) => <BadgeKarte key={b.id} badge={b} onOeffnen={setOffen} />)}
                </ul>
              </div>
            </section>
          );
        })
      )}

      {gewaehlt && (
        <WebBadgeDialog badge={gewaehlt} erreicht={gewaehlt.is_earned} zeigeFortschritt onSchliessen={() => setOffen(null)} />
      )}
    </div>
  );
};

export default WebBadgesRaster;
