// Die Seite einer Challenge fuer Team und Leitung in der Web-Fassung
// (Browser ab 992 px), /admin/challenges/:id und /teamer/challenges/:id, im
// Aufbau aller Detailseiten (components/web/WebDetailSeite.tsx; Simon,
// 06.10.2026: „Inhalt links, Angaben rechts").
//
// Im Kopf Titel, Kennzeichen und ALLE Aktionen (Bearbeiten, eigenen Beitrag
// einreichen, Beitraege exportieren); darunter die Kennzahlen -- Beitraege,
// Teilnehmende, Warten auf Freigabe, Laufzeit. Links breit die Aufgabe und die
// Beitraege als Raster -- Bilder und Videos gross, Text, Musik-Link, darunter
// je Beitrag die Knoepfe der Moderation (Freigeben, Anonym stellen,
// Ausblenden, Wieder einblenden, Loeschen). Rechts schmal die Angaben
// (Status, Zeitraum, Zielgruppe, Sichtbarkeit) und der Stempel.
//
// Alles ueber dieselbe Logik wie die Ansicht der App: useChallengeLeitung
// laedt die Beitraege, haelt die Reiter, rechnet die Zahlen und sagt, welche
// Aktionen ein Beitrag zulaesst (availableActions -- wer loeschen darf, wer
// ausblenden darf, steht dort einmal). Das Gelesen-Melden beim Aufgehen und
// Verlassen macht die Seite drumherum (shared/ChallengeLeitungPage); die
// Zahl der neuen Beitraege, die beim Oeffnen noch rot an der Karte stand,
// steht hier als Hinweis ueber den Beitraegen.
//
// Eine Komponente fuer ALLE Zustaende der Seite -- laedt, Hinweis ("gibt es
// nicht mehr", "nicht deinem Jahrgang zugeordnet", ohne Netz), Challenge --
// mit einem einzigen Rahmen. Wechselte der Rahmen beim Laden der Challenge
// die Komponente, bauten sich Kopfzeile und IonContent neu auf; Ionic misst
// den alten noch (TypeError in readDimensions).

import React, { useId, useState, type RefObject } from 'react';
import { IonIcon } from '@ionic/react';
import WebBadgeSymbol from '../../../konfi/web/WebBadgeSymbol';
import { ICON_BEARBEITEN, ICON_HINZUFUEGEN, ICON_OFFLINE, ICON_ALBEN, ICON_TEILEN } from '../../icons';
import WebChallengeRahmen from './WebChallengeRahmen';
import WebChallengeHinweis from './WebChallengeHinweis';
import WebChallengeChips, { type WebChallengeChip } from './WebChallengeChips';
import WebBeitrag from './WebBeitrag';
import WebKarte from '../../../web/WebKarte';
import { type WebKachelProps } from '../../../web/WebKachel';
import { WebDetailInhalt } from '../../../web/WebDetailSeite';
import WebAngaben from '../../../web/WebAngaben';
import WebKnopf from '../../../web/WebKnopf';
import WebPill from '../../../web/WebPill';
import WebHinweis from '../../../web/WebHinweis';
import WebDialog from '../../../web/WebDialog';
import WebTextfeld from '../../../web/WebTextfeld';
import { WebLaden, WebLeer } from '../../../web/WebZustaende';
import { useBadge } from '../../../../contexts/BadgeContext';
import type { ChallengeHinweisArt } from '../../challengeHinweisTexte';
import {
  CONSENT_BADGE,
  HINWEIS_OHNE_FREIGABERECHT,
  getStatusBadge,
  useChallengeLeitung,
  type StatusFilter,
} from '../../../admin/views/useChallengeLeitung';
import { AUDIENCE_LABEL, VISIBILITY_LABEL } from '../../../admin/views/ChallengesManageView';
import { formatRemaining, getChallengeBadgeIcon } from '../../../konfi/views/ChallengesView';
import { anzahlBeitraege } from '../../../../utils/challengeTexte';
import { datumUhrzeit } from '../../../../utils/dateUtils';
import {
  MEDIEN_WORT,
  STATUS_TON,
  STATUS_WORT,
  kugelAmEintrag,
  laufzeitKachel,
  restzeitText,
  tonVonFarbe,
  zeitraumText,
  zielgruppeVon,
} from '../../../../utils/challengesWeb';
import type { AdminChallenge, ChallengeSubmission } from '../../../../types/challenges';
import '../../../../theme/web/challenges.css';
import { leerVon } from '../../../../seiten/beschreibung';
import {
  CHALLENGE_DETAIL_FEED_WARTET,
  CHALLENGE_DETAIL_LEER_TITEL,
  CHALLENGE_DETAIL_LEITUNG_REITER,
  CHALLENGE_DETAIL_REITER_BESCHRIFTUNG,
  detailReiterFuer,
} from '../../../../seiten/challengeDetailLeitung';

export interface WebChallengeLeitungDetailProps {
  /** Die Challenge; solange es keine gibt (laedt, Hinweis), steht der Hinweis. */
  challenge: AdminChallenge | null;
  /** Was statt der Challenge steht: laedt, weg, jahrgang, offline, fehler. */
  hinweisArt: ChallengeHinweisArt;
  /** Zurueck zur Liste (mit Verlauf zurueck, ohne nach einem Push auf die Liste). */
  onBack: () => void;
  /** Bei "offline" und "fehler": neu laden. */
  onNochmal?: () => void;
  /** Oeffnet das Bearbeiten-Formular (useChallengeFormular). */
  onEdit?: (challenge: AdminChallenge) => void;
  /** Nach jeder Moderation und nach eigenem Einreichen: Liste und Zaehler aktuell halten. */
  onChanged?: () => void;
  /** Die IonPage der Seite -- fuer die Card-Optik des Einreich-Modals. */
  seitenRef?: RefObject<HTMLElement | null>;
  /** Liste dieser Rolle (/admin/challenges): der Weg zurueck. */
  listenPfad: string;
}

const WebChallengeLeitungDetail: React.FC<WebChallengeLeitungDetailProps> = ({
  challenge, hinweisArt, onBack, onNochmal, onEdit, onChanged, seitenRef, listenPfad,
}) => {
  const {
    user,
    submissions,
    loading,
    offlineOhneStand,
    busyId,
    setStatusFilter,
    effectiveFilter,
    counts,
    status,
    ownSubmissions,
    canSubmitMore,
    filtered,
    dateiOeffnen,
    moderate,
    availableActions,
    darfFreigeben,
    handleExport,
    oeffneEinreichen,
  } = useChallengeLeitung({ challenge, onChanged, seitenRef });

  // Die Zahl, die beim Oeffnen noch rot an der Karte stand -- festgehalten in
  // dem Augenblick, in dem die Challenge da ist, BEVOR die Seite sie als
  // gelesen meldet (ChallengeLeitungPage, Effekt nach dem Zeichnen). Dieselbe
  // Rechnung wie die Liste.
  const zaehler = useBadge();
  const [neu, setNeu] = useState<{ anzahl: number; text: string } | null>(null);
  if (challenge && neu === null) {
    setNeu(kugelAmEintrag(challenge.id, {
      offeneFreigaben: zaehler.pendingChallengesByChallenge,
      neuigkeiten: zaehler.challengeUpdatesByChallenge,
      neueBeitraege: zaehler.challengeNeueBeitraegeByChallenge ?? undefined,
      neueWartend: zaehler.challengeNeueWartendByChallenge,
    }));
  }

  // "Ausblenden" fragt nach einer Begruendung -- in der Web-Fassung ein Dialog statt des Alerts der App.
  const [ausblenden, setAusblenden] = useState<ChallengeSubmission | null>(null);
  const [grund, setGrund] = useState('');
  const beitraegeId = useId();

  const ausblendenAbschicken = () => {
    const beitrag = ausblenden;
    if (!beitrag) return;
    setAusblenden(null);
    void moderate(beitrag, 'hide', grund.trim() || undefined);
    setGrund('');
  };

  // Alles Weitere gibt es nur mit einer Challenge.
  const renderChallenge = (challenge: AdminChallenge) => {
    const zielgruppe = AUDIENCE_LABEL[zielgruppeVon(challenge)];
    const jahrgaenge = challenge.jahrgaenge ?? [];
    const autor = challenge.author_name || challenge.author_freetext || null;
    const beendet = status === 'ended';

    // Reiter aus der gemeinsamen Beschreibung (seiten/challengeDetailLeitung.ts); jeder Chip zaehlt seine Beitraege.
    const zahlVon: Record<StatusFilter, number> = { feed: counts.approved, pending: counts.pending, hidden: counts.hidden, meins: ownSubmissions.length };
    const chips: Array<WebChallengeChip<StatusFilter>> = detailReiterFuer(challenge).map((r) => ({
      wert: r.schluessel,
      label: r.label,
      zahl: zahlVon[r.schluessel],
      ...(r.zahlText ? { ton: 'orange' as const, zahlText: r.zahlText(zahlVon[r.schluessel]) } : {}),
    }));

    const statusZeile = status === 'draft'
      ? 'Entwurf — noch nicht veröffentlicht'
      : status === 'scheduled'
        ? 'Startet erst noch'
        : status === 'active'
          ? 'Läuft gerade'
          : 'Beendet';

    // Die Kennzahlen aus dem, was die Seite ohnehin laedt. Solange die Beitraege fehlen (laedt noch,
    // offline ohne Stand), steht ein Strich statt einer falschen Null.
    const beitraegeDa = !loading && !offlineOhneStand;
    const teilnehmende = new Set(submissions.map((b) => b.user_id).filter((id): id is number => id != null)).size;
    const laufzeit = laufzeitKachel(challenge, status, formatRemaining(challenge.ends_at));
    const kennzahlen: WebKachelProps[] = [
      { label: 'Beiträge', wert: beitraegeDa ? String(counts.total) : '–', zusatz: beitraegeDa ? [`${counts.approved} im Feed`] : [] },
      { label: 'Teilnehmende', wert: beitraegeDa ? String(teilnehmende) : '–', zusatz: beitraegeDa ? ['mit mindestens einem Beitrag'] : [] },
      ...(challenge.moderated
        ? [{
          label: 'Warten auf Freigabe',
          wert: beitraegeDa ? String(counts.pending) : '–',
          achtung: beitraegeDa && counts.pending > 0,
        }]
        : []),
      { label: 'Laufzeit', wert: laufzeit.wert, zusatz: laufzeit.zusatz },
    ];

    return (
      <WebDetailInhalt
        kennzahlen={kennzahlen}
        haupt={(
          <>
            <WebKarte titel={beendet ? 'Worum ging es?' : 'Worum geht es?'}>
              <p className="web-challenge-aufgabe">{challenge.description}</p>
              <ul className="web-challenge-aufgabe__meta">
                <li>{statusZeile}</li>
                {autor && <li>Gestellt von {autor}</li>}
              </ul>
            </WebKarte>

            {neu && neu.anzahl > 0 && (
              <WebHinweis art="hinweis" titel="Seit deinem letzten Besuch">
                {neu.anzahl} {neu.text}
              </WebHinweis>
            )}

            {!darfFreigeben && (
              <WebHinweis art="hinweis">{HINWEIS_OHNE_FREIGABERECHT}</WebHinweis>
            )}

            <section className="web-challenge-abschnitt" aria-labelledby={beitraegeId}>
              <div className="web-challenge-abschnitt__kopf">
                <h2 id={beitraegeId} className="web-karte__titel">{anzahlBeitraege(filtered.length)}</h2>
                <WebChallengeChips<StatusFilter>
                  beschriftung={CHALLENGE_DETAIL_REITER_BESCHRIFTUNG}
                  chips={chips}
                  wert={effectiveFilter}
                  onWert={setStatusFilter}
                />
              </div>

              {loading ? (
                <WebLaden karten={2} text="Die Beiträge werden geladen." />
              ) : offlineOhneStand ? (
                <div className="web-karte">
                  <WebLeer icon={ICON_OFFLINE} titel="Keine Verbindung" text="Die Liste der Beiträge ist offline nicht verfügbar." />
                </div>
              ) : filtered.length === 0 ? (
                <div className="web-karte">
                  <WebLeer
                    icon={ICON_ALBEN}
                    titel={CHALLENGE_DETAIL_LEER_TITEL}
                    text={effectiveFilter === 'feed' && counts.pending > 0
                      ? CHALLENGE_DETAIL_FEED_WARTET
                      : leerVon(CHALLENGE_DETAIL_LEITUNG_REITER, effectiveFilter)}
                  />
                </div>
              ) : (
                <ul className="web-beitraege" aria-label="Beiträge">
                  {filtered.map((b) => {
                    const stand = getStatusBadge(b, challenge);
                    const einwilligung = b.konfi_consent ? CONSENT_BADGE[b.konfi_consent] : null;
                    const name = b.konfi_name || 'Unbekannt';
                    const eigen = Boolean(user?.id) && b.user_id === user?.id;
                    const beschaeftigt = busyId === b.id;
                    return (
                      <WebBeitrag
                        key={b.id}
                        name={name}
                        wann={`${b.jahrgang_name ? `${b.jahrgang_name} · ` : ''}${datumUhrzeit(b.created_at)}`}
                        mediaType={b.media_type}
                        eigen={eigen}
                        ausgeblendet={b.moderation_status === 'hidden'}
                        text={b.text_content}
                        link={b}
                        datei={b.file_path ? { filePath: b.file_path, fileName: b.file_name } : undefined}
                        onOeffnen={(pfad, dateiname) => { void dateiOeffnen(pfad, dateiname); }}
                        grund={b.moderation_note}
                        marken={(
                          <>
                            <WebPill ton={tonVonFarbe(stand.color)} punkt>{stand.label}</WebPill>
                            {einwilligung && <WebPill ton={tonVonFarbe(einwilligung.color)}>{einwilligung.label}</WebPill>}
                          </>
                        )}
                        fuss={(
                          <>
                            {availableActions(b).map((a) => (
                              <WebKnopf
                                key={a.key}
                                klein
                                art={a.key === 'approve' ? 'primaer' : a.role === 'destructive' ? 'gefahr' : 'sekundaer'}
                                disabled={beschaeftigt}
                                aria-label={`${a.text}: ${name}`}
                                onClick={() => { if (a.key === 'hide') { setGrund(''); setAusblenden(b); } else a.run(); }}
                              >
                                <IonIcon icon={a.icon} aria-hidden="true" />
                                {a.text}
                              </WebKnopf>
                            ))}
                          </>
                        )}
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
                        {zeitraumText(challenge, status)}
                        {status === 'active' && <span className="web-zelle-leise">{restzeitText(formatRemaining(challenge.ends_at))}</span>}
                      </>
                    ),
                  },
                  { label: 'Zielgruppe', wert: zielgruppe },
                  {
                    label: 'Jahrgänge',
                    wert: zielgruppeVon(challenge) === 'nur_team' ? 'Alle im Team der Gemeinde' : jahrgaenge.map((j) => j.name).join(', '),
                  },
                  { label: 'Sichtbarkeit', wert: VISIBILITY_LABEL[challenge.visibility] ?? challenge.visibility },
                  ...(challenge.visibility !== 'private'
                    ? [{ label: 'Freigabe', wert: challenge.moderated ? 'Das Team gibt Beiträge frei' : 'Beiträge sind sofort sichtbar' }]
                    : []),
                  { label: 'Antwort mit', wert: (challenge.allowed_media ?? []).map((m) => MEDIEN_WORT[m] ?? m).join(', ') },
                  { label: 'Beiträge je Person', wert: challenge.allow_multiple ? 'Beliebig viele' : 'Einer' },
                ]}
              />
            </WebKarte>

            <WebKarte titel="Stempel">
              <div className="web-challenge-stempelinfo">
                {/* Derselbe Kreis wie in den Stempel-Rastern (WebAuszeichnungen). */}
                <WebBadgeSymbol icon={getChallengeBadgeIcon(challenge.badge_icon)} farbe="var(--app-color-challenges)" erreicht />
                <div>
                  <strong>{challenge.badge_name}</strong>
                  <p className="web-challenge-hinweistext">
                    {challenge.moderated
                      ? 'Mit der Freigabe ihres ersten Beitrags bekommt eine Person diesen Stempel.'
                      : 'Wer einen Beitrag einreicht, bekommt diesen Stempel.'}
                  </p>
                </div>
              </div>
            </WebKarte>
          </>
        )}
      />
    );
  };

  // Alle Aktionen der Seite stehen im Kopf; die wichtigste -- der eigene Beitrag -- rechts und primaer.
  const kopfAktionen = challenge ? (
    <>
      <WebKnopf onClick={() => { void handleExport(); }}>
        <IonIcon icon={ICON_TEILEN} aria-hidden="true" />
        Beiträge exportieren
      </WebKnopf>
      {onEdit && (
        <WebKnopf onClick={() => onEdit(challenge)}>
          <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
          Challenge bearbeiten
        </WebKnopf>
      )}
      {canSubmitMore && (
        <WebKnopf art="primaer" onClick={oeffneEinreichen}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Beitrag einreichen
        </WebKnopf>
      )}
    </>
  ) : undefined;

  return (
    <WebChallengeRahmen
      titel={challenge?.title ?? 'Challenge'}
      zurueck={{ href: listenPfad, text: 'Alle Challenges' }}
      untertitel={challenge ? (
        <span className="web-pillreihe">
          <WebPill ton={STATUS_TON[status]} punkt>{STATUS_WORT[status]}</WebPill>
          <WebPill>{AUDIENCE_LABEL[zielgruppeVon(challenge)]}</WebPill>
          <span>{zeitraumText(challenge, status)}</span>
        </span>
      ) : undefined}
      aktionen={kopfAktionen}
    >
      {challenge ? renderChallenge(challenge) : <WebChallengeHinweis art={hinweisArt} onBack={onBack} onNochmal={onNochmal} />}

      {ausblenden && (
        <WebDialog
          titel="Beitrag ausblenden"
          beschreibung={`Der Beitrag von ${ausblenden.konfi_name || 'dieser Person'} wird für die Gruppe nicht mehr sichtbar sein. Die einreichende Person sieht ihren Beitrag weiterhin — und die Begründung, falls du eine einträgst.`}
          onSchliessen={() => setAusblenden(null)}
          onAbsenden={ausblendenAbschicken}
          aktionen={(
            <>
              <WebKnopf onClick={() => setAusblenden(null)}>Abbrechen</WebKnopf>
              <WebKnopf art="gefahr" absenden>Ausblenden</WebKnopf>
            </>
          )}
        >
          <WebTextfeld label="Begründung (optional)" wert={grund} onWert={(w) => setGrund(w.slice(0, 500))} zeilen={4} hinweis="Höchstens 500 Zeichen." />
        </WebDialog>
      )}
    </WebChallengeRahmen>
  );
};

export default WebChallengeLeitungDetail;
