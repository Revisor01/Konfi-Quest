// Detailseite einer Konfi bzw. Teamer:in in der Web-Fassung, /admin/konfis/:id
// (Browser ab 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6):
// zweispaltig.
//
//   links   Person mit den Ringen (Punkte, Ziele), Aktivitaeten, Bonuspunkte --
//           bei einer Teamer:in Zertifikate, Konfi-Historie und die Events der
//           Konfi-Zeit;
//   rechts  Aktionen, Konfirmation, Badges, Events, offene Antraege, Stempel,
//           Rueckblick und "Rolle aendern".
//
// Daten und Aktionen kommen von der Seite (KonfiDetailView): Sie laedt, haelt
// den Zustand und oeffnet dieselben Fenster und Rueckfragen wie in der App
// (Aktivitaet, Bonus, Zertifikat, Bearbeiten, Passwort, Foto, Rueckblick).

import React from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_ABZEICHEN,
  ICON_BEARBEITEN,
  ICON_BONUS,
  ICON_HINZUFUEGEN,
  ICON_SCHLUESSEL,
} from '../../../shared/icons';
import { datumKurz } from '../../../../utils/dateUtils';
import { initialen, konfiPunkte } from '../../../../utils/konfiListe';
import { mitEinheit } from '../../../../utils/supportStatistik';
import WebSeite from '../../../web/WebSeite';
import WebKarte from '../../../web/WebKarte';
import WebKnopf from '../../../web/WebKnopf';
import WebSpalten from '../../../web/WebSpalten';
import WebHinweis from '../../../web/WebHinweis';
import { WebFehler, WebLaden } from '../../../web/WebZustaende';
import ActivityRings from '../../views/ActivityRings';
import { WebAvatar } from './WebLeitungBausteine';
import WebKonfiBadges from './WebKonfiBadges';
import {
  AktivitaetenKarte,
  AntraegeKarte,
  BefoerdernKarte,
  BonusKarte,
  EventPunkteKarte,
  KonfiHistorieKarte,
  KonfiZeitKarte,
  KonfirmationKarte,
  RueckblickKarte,
  StempelKarte,
  TeamerEventsKarte,
  ZertifikateKarte,
} from './WebKonfiKarten';
import type { WebKonfiDetailProps } from './konfiDetailTypen';

const WebKonfiDetail: React.FC<WebKonfiDetailProps> = (p) => {
  const { konfi, istTeamer, isOnline } = p;
  const zurueck = istTeamer
    ? { href: '/admin/konfis?filter=team', text: 'Alle im Team' }
    : { href: '/admin/konfis', text: 'Alle Konfis' };
  const platzhalter = istTeamer ? 'Teamer:in' : 'Konfi';
  const name = konfi?.display_name || konfi?.name || platzhalter;

  if (p.laedt) {
    return (
      <WebSeite bereich="Verwaltung" titel={platzhalter} zurueck={zurueck} pageRef={p.pageRef}>
        <WebLaden karten={2} text={istTeamer ? 'Die Teamer:in wird geladen.' : 'Die Konfi wird geladen.'} />
      </WebSeite>
    );
  }
  if (!konfi) {
    return (
      <WebSeite bereich="Verwaltung" titel={platzhalter} zurueck={zurueck} pageRef={p.pageRef}>
        <WebFehler text="Diese Person konnte nicht geladen werden." onErneut={p.onNeuLaden} />
      </WebSeite>
    );
  }

  const jahrgang = konfi.jahrgang_name || konfi.jahrgang;
  const verbucht = p.aktivitaeten.filter((a) => !a.isPending);
  const offene = p.aktivitaeten.filter((a) => a.isPending);
  // Bei einer Teamer:in zaehlen nur Teamer-Aktivitaeten.
  const aktivitaetenAnzeige = istTeamer ? verbucht.filter((a) => a.target_role === 'teamer') : verbucht;
  const mitKonfirmation = (!istTeamer && konfi.role_name === 'konfi') || (istTeamer && !!(konfi.konfspruch || konfi.confirmation_date));
  const gesamt = konfiPunkte(konfi);

  const hero = (
    <section className={`web-person-hero${istTeamer ? ' web-person-hero--teamer' : ''}`} aria-label="Person">
      <div className="web-person-hero__kopf">
        <WebAvatar text={initialen(name) || '??'} farbe={istTeamer ? 'teamer' : 'konfis'} gross />
        <div className="web-person-hero__text">
          <h2 className="web-person-hero__name">{istTeamer ? 'Teamer:in' : (jahrgang || 'Kein Jahrgang')}</h2>
          {konfi.username && <p className="web-person-hero__zeile">@{konfi.username}</p>}
          {istTeamer && konfi.teamer_since && <p className="web-person-hero__zeile">seit {datumKurz(konfi.teamer_since)}</p>}
          {!istTeamer && <p className="web-person-hero__zeile">{mitEinheit(konfi.badgeCount || 0, 'Badge', 'Badges')}</p>}
        </div>
      </div>
      {istTeamer ? (
        <ul className="web-person-hero__zahlen">
          {[
            { wert: p.zertifikate.length, label: 'Zertifikate' },
            { wert: p.teamerEvents.length, label: 'Events' },
            { wert: konfi.badgeCount || 0, label: 'Badges' },
          ].map((z) => (
            <li key={z.label}>
              <strong>{z.wert}</strong>
              <span>{z.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="web-person-hero__ringe">
          <ActivityRings
            totalPoints={p.punkte.gesamt}
            gottesdienstPoints={p.punkte.gottesdienst}
            gemeindePoints={p.punkte.gemeinde}
            gottesdienstGoal={konfi.target_gottesdienst || 10}
            gemeindeGoal={konfi.target_gemeinde || 10}
            gottesdienstEnabled={konfi.gottesdienst_enabled}
            gemeindeEnabled={konfi.gemeinde_enabled}
            size={168}
          />
        </div>
      )}
    </section>
  );

  const aktionen = (
    <WebKarte titel="Aktionen">
      <div className="web-aktionsliste">
        <WebKnopf art="primaer" onClick={p.onAktivitaetEintragen}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Aktivität eintragen
        </WebKnopf>
        {!istTeamer && (
          <WebKnopf onClick={p.onBonusVergeben}>
            <IonIcon icon={ICON_BONUS} aria-hidden="true" />
            Bonuspunkte vergeben
          </WebKnopf>
        )}
        {/* Bearbeiten nur bei Konfis: Teamer:innen haben keinen einzelnen Jahrgang, ihre Stammdaten liegen in der Benutzerverwaltung. */}
        {!istTeamer && (
          <WebKnopf disabled={!isOnline} onClick={p.onBearbeiten}>
            <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
            Konfi bearbeiten
          </WebKnopf>
        )}
        {istTeamer && (
          <WebKnopf disabled={!isOnline} onClick={p.onZertifikatZuweisen}>
            <IonIcon icon={ICON_ABZEICHEN} aria-hidden="true" />
            Zertifikat zuweisen
          </WebKnopf>
        )}
        <WebKnopf disabled={!isOnline} onClick={p.onPasswort}>
          <IonIcon icon={ICON_SCHLUESSEL} aria-hidden="true" />
          Passwort zurücksetzen
        </WebKnopf>
      </div>
      {!isOnline && <p className="web-karte__text">Ohne Verbindung geht nur das Eintragen von Aktivitäten und Bonuspunkten; alles andere wartet auf das Netz.</p>}
    </WebKarte>
  );

  const teamerSeit = istTeamer ? (
    <WebKarte titel="Teamer:in seit">
      <div className="web-feld">
        <label htmlFor="web-teamer-seit" className="web-feld__label">Datum</label>
        <input
          id="web-teamer-seit"
          type="date"
          className="web-eingabe"
          value={konfi.teamer_since ? new Date(konfi.teamer_since).toISOString().split('T')[0] : ''}
          disabled={!isOnline}
          onChange={(e) => { if (e.target.value) p.onTeamerSeit(e.target.value); }}
        />
      </div>
    </WebKarte>
  ) : null;

  const haupt = (
    <>
      {hero}
      {!isOnline && aktivitaetenAnzeige.length === 0 && (
        // Punkte-Historie, Aktivitaeten und Anwesenheit haengen an GET /admin/konfis/:id und fehlen offline.
        <WebHinweis art="hinweis">Die Aktivitäten- und Punkte-Historie ist offline nicht verfügbar.</WebHinweis>
      )}
      <AktivitaetenKarte
        aktivitaeten={aktivitaetenAnzeige}
        konfi={konfi}
        istTeamer={istTeamer}
        onEintragen={p.onAktivitaetEintragen}
        onLoeschen={p.onAktivitaetLoeschen}
        onFoto={p.onFoto}
      />
      {!istTeamer && (
        <BonusKarte bonus={p.bonus} konfi={konfi} summe={p.punkte.bonus} onVergeben={p.onBonusVergeben} onLoeschen={p.onBonusLoeschen} />
      )}
      {istTeamer && p.zertifikate.length > 0 && (
        <ZertifikateKarte zertifikate={p.zertifikate} isOnline={isOnline} onZuweisen={p.onZertifikatZuweisen} onEntfernen={p.onZertifikatEntfernen} />
      )}
      {istTeamer && p.konfiHistorie && <KonfiHistorieKarte historie={p.konfiHistorie} />}
      {istTeamer && p.konfiZeit && <KonfiZeitKarte zeit={p.konfiZeit} />}
    </>
  );

  const seite = (
    <>
      {aktionen}
      {mitKonfirmation && <KonfirmationKarte konfi={konfi} anwesenheit={p.anwesenheit} onMatrix={p.onMatrix} />}
      {teamerSeit}
      <WebKonfiBadges konfiId={p.konfiId} rolle={istTeamer ? 'teamer' : 'konfi'} />
      {istTeamer ? <TeamerEventsKarte events={p.teamerEvents} /> : <EventPunkteKarte eventPunkte={p.eventPunkte} konfi={konfi} />}
      <AntraegeKarte antraege={offene} onFoto={p.onFoto} />
      <StempelKarte marks={p.stempel} offene={p.offeneStempel} />
      <RueckblickKarte eintraege={p.rueckblicke} istTeamer={istTeamer} onOeffnen={p.onRueckblick} />
      {!istTeamer && <BefoerdernKarte isOnline={isOnline} onBefoerdern={p.onBefoerdern} />}
    </>
  );

  return (
    <WebSeite
      bereich="Verwaltung"
      titel={name}
      untertitel={istTeamer ? undefined : `${gesamt.gesamt} von ${gesamt.zielGesamt} ${gesamt.zielGesamt === 1 ? 'Punkt' : 'Punkten'}`}
      zurueck={zurueck}
      pageRef={p.pageRef}
    >
      <WebSpalten haupt={haupt} seite={seite} seiteBeschriftung="Aktionen und weitere Angaben" />
    </WebSeite>
  );
};

export default WebKonfiDetail;
