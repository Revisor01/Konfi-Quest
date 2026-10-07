// Die Seite einer Challenge fuer Konfis in der Web-Fassung (Browser ab
// 992 px), /konfi/challenges/:id, im Aufbau aller Detailseiten
// (components/web/WebDetailSeite.tsx; Simon, 06.10.2026: „Inhalt links,
// Angaben rechts").
//
// Im Kopf Titel, Kennzeichen und die Aktion "Beitrag einreichen" (das
// Einreich-Formular der App, ChallengeSubmitModal); was bisher unter
// "Mitmachen" stand -- wer den Beitrag sieht, warum es keinen Knopf gibt --,
// steht als Hinweis ueber den Kennzahlen. Darunter die Kennzahlen (Beitraege
// im Feed, eigene Beitraege, Laufzeit, Stempel). Links breit die Aufgabe und
// die Beitraege als Raster -- der Feed der Gruppe oder die eigenen Beitraege,
// Bilder und Videos gross, anonyme Beitraege ohne Namen (der Server liefert
// dort gar keinen mit). Rechts schmal die Angaben (Status, Zeitraum,
// Sichtbarkeit) und der Stempel.
//
// Alles ueber dieselbe Logik wie die Ansicht der App
// (useKonfiChallengeAnsicht): wann die Challenge laeuft -- sie folgt der Uhr,
// auch bei offener Seite --, wer noch einreichen darf, was unter welchem
// Reiter steht. Das Gelesen-Melden macht die Seite drumherum
// (konfi/pages/KonfiChallengeDetailPage).
//
// Eine Komponente fuer ALLE Zustaende der Seite -- laedt, Hinweis ("gibt es
// nicht mehr", "nicht fuer dich", ohne Netz), Challenge -- mit einem einzigen
// Rahmen. Wechselte der Rahmen beim Laden der Challenge die Komponente,
// bauten sich Kopfzeile und IonContent neu auf; Ionic misst den alten noch
// (TypeError in readDimensions).

import React, { useId, useState } from 'react';
import { IonIcon } from '@ionic/react';
import WebBadgeSymbol from '../WebBadgeSymbol';
import { ICON_HINZUFUEGEN, ICON_OFFLINE, ICON_TEXTDOKUMENT, ICON_GRUPPE } from '../../../shared/icons';
import WebChallengeRahmen from '../../../shared/web/challenges/WebChallengeRahmen';
import WebChallengeHinweis from '../../../shared/web/challenges/WebChallengeHinweis';
import type { ChallengeHinweisArt } from '../../../shared/challengeHinweisTexte';
import WebChallengeChips, { type WebChallengeChip } from '../../../shared/web/challenges/WebChallengeChips';
import WebBeitrag from '../../../shared/web/challenges/WebBeitrag';
import WebKarte from '../../../web/WebKarte';
import type { WebKachelProps } from '../../../web/WebKachel';
import { WebDetailInhalt } from '../../../web/WebDetailSeite';
import WebAngaben from '../../../web/WebAngaben';
import WebKnopf from '../../../web/WebKnopf';
import WebPill from '../../../web/WebPill';
import WebHinweis from '../../../web/WebHinweis';
import { WebLaden, WebLeer } from '../../../web/WebZustaende';
import { useBadge } from '../../../../contexts/BadgeContext';
import { AUDIENCE_LABEL } from '../../../admin/views/ChallengesManageView';
import { formatRemaining, getChallengeBadgeIcon } from '../../views/ChallengesView';
import {
  buildGalleryAuthorLabel,
  formatDateTime,
  getOwnStatus,
  useKonfiChallengeAnsicht,
  type KonfiReiter,
} from '../../pages/useKonfiChallengeAnsicht';
import { offenerHinweis } from '../../../shared/StempelPopoverContent';
import { getVisibilityInfo } from '../../../../utils/challengeTexte';
import {
  STATUS_TON,
  STATUS_WORT,
  laufzeitKachel,
  restzeitText,
  tonVonFarbe,
  zeitraumText,
  zielgruppeVon,
} from '../../../../utils/challengesWeb';
import type { KonfiChallenge, KonfiChallengeDetail } from '../../../../types/challenges';
import '../../../../theme/web/challenges.css';

export interface WebKonfiChallengeDetailProps {
  /** Die Challenge; solange es keine gibt (laedt, Hinweis), steht der Hinweis. */
  current: KonfiChallenge | null;
  /** Was statt der Challenge steht: laedt, weg, nichtFuerDich, offline, fehler. */
  hinweisArt: ChallengeHinweisArt;
  /** Zurueck zur Liste (mit Verlauf zurueck, ohne nach einem Push auf die Liste). */
  onBack: () => void;
  /** Bei "offline" und "fehler": neu laden. */
  onNochmal?: () => void;
  detail: KonfiChallengeDetail | null;
  loading: boolean;
  /** Ohne Netz und ohne gespeicherten Stand: die Beitraege fehlen. */
  offlineOhneStand: boolean;
  /** Oeffnet das Einreich-Formular der App (ChallengeSubmitModal). */
  onSubmit: () => void;
}

const LISTEN_PFAD = '/konfi/challenges';

const WebKonfiChallengeDetail: React.FC<WebKonfiChallengeDetailProps> = ({
  current, hinweisArt, onBack, onNochmal, detail, loading, offlineOhneStand, onSubmit,
}) => {
  const {
    author,
    isActive,
    setReiter,
    ownSubmissions,
    canSubmitMore,
    effektiverReiter,
    sichtbareBeitraege,
    dateiOeffnen,
    visibilityShort,
    moderationShort,
  } = useKonfiChallengeAnsicht(current, detail);

  // Die Zahl, die beim Oeffnen noch rot an der Karte stand -- festgehalten
  // BEVOR die Seite sie als gelesen meldet (Effekt nach dem Zeichnen): in dem
  // Augenblick, in dem die Challenge da ist.
  const { challengeUpdatesByChallenge } = useBadge();
  const [neu, setNeu] = useState<number | null>(null);
  if (current && neu === null) setNeu(challengeUpdatesByChallenge?.[current.id] ?? 0);
  const beitraegeId = useId();

  // Alles Weitere gibt es nur mit einer Challenge.
  const renderChallenge = (current: KonfiChallenge) => {

    const status = isActive ? 'active' : 'ended';
    const gallery = detail?.gallery ?? [];
    const privat = current.visibility === 'private';

    const chips: Array<WebChallengeChip<KonfiReiter>> = [
      { wert: 'feed', label: 'Feed', zahl: gallery.length },
      { wert: 'meins', label: 'Meins', zahl: ownSubmissions.length },
    ];
    const ueberschrift = effektiverReiter === 'meins'
      ? (ownSubmissions.length === 1 ? 'Dein Beitrag' : 'Deine Beiträge')
      : 'Aus deiner Gruppe';

    // Hat die Person den Stempel schon? Ein freigegebener eigener Beitrag bringt ihn.
    const hatStempel = ownSubmissions.some((b) => b.moderation_status === 'approved');
    const stempelText = hatStempel
      ? 'Der Stempel gehört dir.'
      : offenerHinweis({ challenge_id: current.id, badge_icon: current.badge_icon, badge_name: current.badge_name, title: current.title, status });

    // Warum es keinen Knopf gibt, statt einfach keinen zu zeigen.
    const einreichenHinweis = canSubmitMore
      ? getVisibilityInfo(current)
      : isActive
        ? 'Du hast schon einen Beitrag eingereicht — bei dieser Challenge gibt es nur einen je Person.'
        : 'Diese Challenge ist beendet — Beiträge lassen sich nicht mehr einreichen.';

    // Die Kennzahlen aus dem, was die Seite ohnehin laedt. Solange die Beitraege fehlen (laedt noch,
    // offline ohne Stand), steht ein Strich statt einer falschen Null. Bei "nur Leitung" gibt es keine
    // Gruppen-Galerie -- dann auch keine Kachel dafuer.
    const beitraegeDa = !loading && !offlineOhneStand;
    const laufzeit = laufzeitKachel(current, status, formatRemaining(current.ends_at));
    const kennzahlen: WebKachelProps[] = [
      ...(privat ? [] : [{ label: 'Beiträge im Feed', wert: beitraegeDa ? String(gallery.length) : '–' }]),
      { label: 'Meine Beiträge', wert: beitraegeDa ? String(ownSubmissions.length) : '–' },
      { label: 'Laufzeit', wert: laufzeit.wert, zusatz: laufzeit.zusatz },
      { label: 'Stempel', wert: !beitraegeDa ? '–' : hatStempel ? 'Erhalten' : isActive ? 'Offen' : 'Nicht erhalten', zusatz: [current.badge_name] },
    ];

    return (
      <WebDetailInhalt
        hinweis={<WebHinweis art="hinweis">{einreichenHinweis}</WebHinweis>}
        kennzahlen={kennzahlen}
        haupt={(
          <>
            <WebKarte titel={isActive ? 'Worum geht es?' : 'Worum ging es?'}>
              <p className="web-challenge-aufgabe">{current.description}</p>
              <ul className="web-challenge-aufgabe__meta">
                <li>{visibilityShort}</li>
                {moderationShort && <li>{moderationShort}</li>}
                {author && <li>Gestellt von {author}</li>}
              </ul>
            </WebKarte>

            {neu !== null && neu > 0 && (
              <WebHinweis art="hinweis" titel="Seit deinem letzten Besuch">
                {neu} {neu === 1 ? 'Neuigkeit' : 'Neuigkeiten'}
              </WebHinweis>
            )}

            <section className="web-challenge-abschnitt" aria-labelledby={beitraegeId}>
              <div className="web-challenge-abschnitt__kopf">
                <h2 id={beitraegeId} className="web-karte__titel">{ueberschrift}</h2>
                {/* Bei "nur Leitung" gibt es keine Gruppen-Galerie -- dann bleibt nur "Meins", ohne Reiter. */}
                {!privat && (
                  <WebChallengeChips<KonfiReiter> beschriftung="Beiträge" chips={chips} wert={effektiverReiter} onWert={setReiter} />
                )}
              </div>

              {loading ? (
                <WebLaden karten={2} text="Die Beiträge werden geladen." />
              ) : offlineOhneStand ? (
                <div className="web-karte">
                  <WebLeer icon={ICON_OFFLINE} titel="Keine Verbindung" text="Die Liste der Beiträge ist offline nicht verfügbar." />
                </div>
              ) : sichtbareBeitraege.length === 0 ? (
                <div className="web-karte">
                  {effektiverReiter === 'meins' ? (
                    <WebLeer
                      icon={ICON_TEXTDOKUMENT}
                      titel="Noch kein Beitrag von dir"
                      text={isActive ? 'Reiche oben rechts über „Beitrag einreichen“ deinen Beitrag ein.' : 'Diese Challenge ist beendet — du hattest nichts eingereicht.'}
                    />
                  ) : (
                    <WebLeer
                      icon={ICON_GRUPPE}
                      titel="Noch keine geteilten Beiträge"
                      text={isActive
                        ? 'Sobald jemand aus deiner Gruppe etwas veröffentlicht, findest du es hier. Vielleicht machst du ja den Anfang.'
                        : 'Aus dieser Challenge hat niemand aus deiner Gruppe etwas veröffentlicht.'}
                    />
                  )}
                </div>
              ) : (
                <ul className="web-beitraege" aria-label={ueberschrift}>
                  {sichtbareBeitraege.map((b) => {
                    const eigener = effektiverReiter === 'meins';
                    const stand = eigener ? getOwnStatus(b, current) : null;
                    return (
                      <WebBeitrag
                        key={b.id}
                        // Im eigenen Reiter immer "Dein Beitrag"; in der Galerie Name und
                        // Herkunft, anonyme ohne Namen.
                        name={eigener ? 'Dein Beitrag' : buildGalleryAuthorLabel(b)}
                        wann={formatDateTime(b.created_at)}
                        mediaType={b.media_type}
                        ausgeblendet={b.moderation_status === 'hidden'}
                        text={b.text_content}
                        link={b}
                        datei={b.file_path ? { filePath: b.file_path, fileName: b.file_name } : undefined}
                        onOeffnen={(pfad, name) => { void dateiOeffnen(pfad, name); }}
                        grund={b.moderation_note}
                        marken={stand ? <WebPill ton={tonVonFarbe(stand.color)} punkt>{stand.label}</WebPill> : undefined}
                      />
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
        seite={(
          <>
            <WebKarte titel="Angaben">
              <WebAngaben
                angaben={[
                  { label: 'Status', wert: <WebPill ton={STATUS_TON[status]} punkt>{STATUS_WORT[status]}</WebPill> },
                  {
                    label: 'Zeitraum',
                    wert: (
                      <>
                        {zeitraumText(current, status)}
                        {isActive && <span className="web-zelle-leise">{restzeitText(formatRemaining(current.ends_at))}</span>}
                      </>
                    ),
                  },
                  { label: 'Zielgruppe', wert: AUDIENCE_LABEL[zielgruppeVon(current)] },
                  { label: 'Sichtbarkeit', wert: visibilityShort },
                  ...(moderationShort ? [{ label: 'Freigabe', wert: moderationShort }] : []),
                  ...(author ? [{ label: 'Gestellt von', wert: author }] : []),
                ]}
              />
            </WebKarte>

            <WebKarte titel="Stempel">
              <div className="web-challenge-stempelinfo">
                {/* Derselbe Kreis wie in den Stempel-Rastern (WebAuszeichnungen). */}
                <WebBadgeSymbol icon={getChallengeBadgeIcon(current.badge_icon)} farbe="var(--app-color-challenges)" erreicht />
                <div>
                  <strong>{current.badge_name}</strong>
                  <p className="web-challenge-hinweistext">{stempelText}</p>
                </div>
              </div>
            </WebKarte>
          </>
        )}
      />
    );
  };

  return (
    <WebChallengeRahmen
      titel={current?.title ?? 'Challenge'}
      zurueck={{ href: LISTEN_PFAD, text: 'Alle Challenges' }}
      untertitel={current ? (
        <span className="web-pillreihe">
          <WebPill ton={STATUS_TON[isActive ? 'active' : 'ended']} punkt>{STATUS_WORT[isActive ? 'active' : 'ended']}</WebPill>
          <span>{zeitraumText(current, isActive ? 'active' : 'ended')}</span>
        </span>
      ) : undefined}
      aktionen={current && canSubmitMore ? (
        <WebKnopf art="primaer" onClick={onSubmit}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Beitrag einreichen
        </WebKnopf>
      ) : undefined}
    >
      {current ? renderChallenge(current) : <WebChallengeHinweis art={hinweisArt} onBack={onBack} onNochmal={onNochmal} />}
    </WebChallengeRahmen>
  );
};

export default WebKonfiChallengeDetail;
