// Detailseite einer Konfi bzw. Teamer:in in der Web-Fassung, /admin/konfis/:id
// (Browser ab 992 px). Aufbau wie jede Detailseite (WebDetailSeite; Simon,
// 06.10.2026: „Person gleich auch noch erledigen"):
//
//   Kopf      Name, darunter Jahrgang bzw. die Selbstbeschreibung der
//             Teamer:in (sonst "Teamer:in") und Benutzername;
//             alle Aktionen als Knoepfe oben rechts
//   Kennzahl  Gottesdienst, Gemeinde, Gesamt, Badges -- bei einer Teamer:in
//             Zertifikate, Events, Badges
//   links     Aktivitaeten, Events, Bonuspunkte -- bei einer Teamer:in
//             Aktivitaeten, Events, Zertifikate, Konfi-Historie und die
//             Events der Konfi-Zeit; Events stehen immer unter den
//             Aktivitaeten (Simon, 07.10.2026);
//   rechts    Angaben, Konfirmation, Badges, Stempel, Rueckblick und
//             "Rolle aendern".
//
// Offenes steht OBEN in der jeweiligen Liste (Simon, 09.10.2026): offene
// Antraege in den Aktivitaeten (Pruefen), zu verbuchende und anstehende
// Termine in den Events (Anwesend / Nicht anwesend).
//
// Seiten-Interview 13.10.2026: Aktivitaeten, Events und Bonuspunkte tragen
// vorn den Kreis ihrer Punkteart; eine verbuchte Aktivitaet mit Antrag oeffnet
// ihn (onAntrag); die Events sind EINE Tabelle mit allen Terminen der Person,
// Pflicht-Marke und Stand (eventListe.ts), ein Event fuehrt mit Rueckweg zur
// Person (?person=, utils/rueckweg.ts). Kopf und rechte Spalte bleiben.
//
// Rahmen, Angaben-Karte und Zustaende stellt WebDetailSeite, die Tabellen
// WebDetailListe (WebKonfiKarten; 10.10.2026). Vor dem Namen steht derselbe
// Kreis wie in der Liste (WebKonfis): Initialen, gruen bei erreichtem Ziel.
//
// Daten und Aktionen kommen von der Seite (KonfiDetailView): Sie laedt, haelt
// den Zustand und oeffnet dieselben Fenster und Rueckfragen wie in der App
// (Zertifikat, Bearbeiten, Passwort, Foto, Rueckblick). Aktivitaet und
// Bonuspunkte gehen seit 11.10.2026 in eigenen Dialogen der Web-Fassung auf
// (WebAktivitaetDialog, WebBonusDialog) -- mit der Logik der App-Modale.

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
import WebDetailSeite from '../../../web/WebDetailSeite';
import WebKarte from '../../../web/WebKarte';
import WebKnopf from '../../../web/WebKnopf';
import type { WebAngabe } from '../../../web/WebAngaben';
import WebKreis from '../../../web/WebKreis';
import WebHinweis from '../../../web/WebHinweis';
import type { WebKachelProps } from '../../../web/WebKachel';
import { KENNZAHL_SYMBOL, type KennzahlSymbol } from '../../../web/kennzahlSymbole';
import WebKonfiBadges from './WebKonfiBadges';
import {
  AktivitaetenKarte,
  BefoerdernKarte,
  BonusKarte,
  EventListeKarte,
  KonfiHistorieKarte,
  KonfiZeitKarte,
  KonfirmationKarte,
  RueckblickKarte,
  StempelKarte,
  ZertifikateKarte,
} from './WebKonfiKarten';
import { konfiEventZeilen, teamerEventZeilen } from './eventListe';
import type { WebKonfiDetailProps } from './konfiDetailTypen';

const WebKonfiDetail: React.FC<WebKonfiDetailProps> = (p) => {
  const { konfi, istTeamer, isOnline } = p;
  const zurueck = istTeamer
    ? { href: '/admin/konfis?filter=team', text: 'Alle im Team' }
    : { href: '/admin/konfis', text: 'Alle Konfis' };
  const platzhalter = istTeamer ? 'Teamer:in' : 'Konfi';
  const name = konfi?.display_name || konfi?.name || platzhalter;

  if (p.laedt || !konfi) {
    return (
      <WebDetailSeite
        bereich="Verwaltung"
        titel={platzhalter}
        zurueck={zurueck}
        pageRef={p.pageRef}
        laden={p.laedt ? (istTeamer ? 'Die Teamer:in wird geladen.' : 'Die Konfi wird geladen.') : undefined}
        fehler={{ text: 'Diese Person konnte nicht geladen werden.', onErneut: p.onNeuLaden }}
      />
    );
  }

  const jahrgang = konfi.jahrgang_name || konfi.jahrgang;
  const verbucht = p.aktivitaeten.filter((a) => !a.isPending);
  const offene = p.aktivitaeten.filter((a) => a.isPending);
  // Bei einer Teamer:in zaehlen nur Teamer-Aktivitaeten.
  const aktivitaetenAnzeige = istTeamer ? verbucht.filter((a) => a.target_role === 'teamer') : verbucht;
  const mitKonfirmation = (!istTeamer && konfi.role_name === 'konfi') || (istTeamer && !!(konfi.konfspruch || konfi.confirmation_date));
  const gesamt = konfiPunkte(konfi);

  // Eine abgeschaltete Punkteart zaehlt nicht mit; die Kachel sagt das, statt
  // eine Null zu zeigen.
  const punkteKachel = (label: string, symbol: KennzahlSymbol, wert: number, ziel: number, an: boolean): WebKachelProps => (an
    ? { label, symbol, wert: `${wert} / ${ziel}`, zusatz: [wert >= ziel ? 'Ziel erreicht' : `noch ${ziel - wert}`] }
    : { label, symbol, wert: '–', zusatz: ['im Jahrgang abgeschaltet'], 'aria-label': `${label}: im Jahrgang abgeschaltet` });

  const kennzahlen: WebKachelProps[] = istTeamer
    ? [
      { label: 'Zertifikate', symbol: KENNZAHL_SYMBOL.zertifikate, wert: String(p.zertifikate.length) },
      { label: 'Events', symbol: KENNZAHL_SYMBOL.events, wert: String(p.teamerEvents.length) },
      { label: 'Badges', symbol: KENNZAHL_SYMBOL.badges, wert: String(konfi.badgeCount || 0) },
    ]
    : [
      punkteKachel('Gottesdienst', KENNZAHL_SYMBOL.gottesdienst, gesamt.gottesdienst, gesamt.zielGottesdienst, gesamt.gottesdienstAn),
      punkteKachel('Gemeinde', KENNZAHL_SYMBOL.gemeinde, gesamt.gemeinde, gesamt.zielGemeinde, gesamt.gemeindeAn),
      {
        label: 'Gesamt',
        symbol: KENNZAHL_SYMBOL.punkte,
        wert: `${gesamt.gesamt} / ${gesamt.zielGesamt}`,
        zusatz: [gesamt.erreicht ? 'Ziel erreicht' : `${gesamt.prozentGesamt} %`],
        achtung: gesamt.erreicht,
      },
      { label: 'Badges', symbol: KENNZAHL_SYMBOL.badges, wert: String(konfi.badgeCount || 0) },
    ];

  // Bei einer Teamer:in steht vorn ihre Selbstbeschreibung (role_title, im
  // eigenen Profil gesetzt; Simon, 10.10.2026), ohne Eintrag "Teamer:in".
  const selbstbeschreibung = istTeamer ? konfi.role_title?.trim() : '';
  const kennzeichen = (
    <>
      <span>{istTeamer ? (selbstbeschreibung || 'Teamer:in') : (jahrgang || 'Kein Jahrgang')}</span>
      {konfi.username && <span> · @{konfi.username}</span>}
      {istTeamer && konfi.teamer_since && <span> · seit {datumKurz(konfi.teamer_since)}</span>}
    </>
  );

  const angaben: WebAngabe[] = istTeamer
    ? [
      { label: 'Benutzername', wert: konfi.username ? `@${konfi.username}` : null },
      { label: 'Rolle', wert: 'Teamer:in' },
    ]
    : [
      { label: 'Jahrgang', wert: jahrgang || null },
      { label: 'Benutzername', wert: konfi.username ? `@${konfi.username}` : null },
      { label: 'Bonuspunkte', wert: mitEinheit(p.punkte.bonus, 'Punkt', 'Punkte') },
    ];

  const aktionen = (
    <>
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
      {/* Bearbeiten nur bei Konfis: Teamer:innen haben keinen einzelnen Jahrgang, ihre Stammdaten liegen in der Benutzerverwaltung. */}
      {!istTeamer && (
        <WebKnopf disabled={!isOnline} onClick={p.onBearbeiten}>
          <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
          Konfi bearbeiten
        </WebKnopf>
      )}
      {!istTeamer && (
        <WebKnopf onClick={p.onBonusVergeben}>
          <IonIcon icon={ICON_BONUS} aria-hidden="true" />
          Bonuspunkte vergeben
        </WebKnopf>
      )}
      <WebKnopf art="primaer" onClick={p.onAktivitaetEintragen}>
        <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
        Aktivität eintragen
      </WebKnopf>
    </>
  );

  const hinweis = !isOnline ? (
    <WebHinweis art="hinweis">Ohne Verbindung geht nur das Eintragen von Aktivitäten und Bonuspunkten; alles andere wartet auf das Netz.</WebHinweis>
  ) : null;

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
      {!isOnline && !p.ausSpeicher && aktivitaetenAnzeige.length === 0 && (
        // Punkte-Historie, Aktivitaeten und Anwesenheit haengen an GET /admin/konfis/:id und fehlen offline.
        <WebHinweis art="hinweis">Die Aktivitäten- und Punkte-Historie ist offline nicht verfügbar.</WebHinweis>
      )}
      <AktivitaetenKarte
        aktivitaeten={aktivitaetenAnzeige}
        offene={offene}
        isOnline={isOnline}
        konfi={konfi}
        istTeamer={istTeamer}
        onEintragen={p.onAktivitaetEintragen}
        onLoeschen={p.onAktivitaetLoeschen}
        onFoto={p.onFoto}
        onAntrag={p.onAntrag}
      />
      <EventListeKarte
        zeilen={istTeamer ? teamerEventZeilen(p.teamerEvents, p.termine) : konfiEventZeilen(p.alleTermine, p.termine, p.eventPunkte)}
        istTeamer={istTeamer}
        konfi={konfi}
        personId={p.konfiId}
        personName={name}
        kannVerbuchen={p.kannVerbuchen}
        isOnline={isOnline}
        onAnwesenheit={p.onAnwesenheit}
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
      {mitKonfirmation && <KonfirmationKarte konfi={konfi} anwesenheit={p.anwesenheit} onMatrix={p.onMatrix} />}
      {teamerSeit}
      <WebKonfiBadges konfiId={p.konfiId} rolle={istTeamer ? 'teamer' : 'konfi'} />
      <StempelKarte marks={p.stempel} offene={p.offeneStempel} />
      <RueckblickKarte eintraege={p.rueckblicke} istTeamer={istTeamer} onOeffnen={p.onRueckblick} />
      {!istTeamer && <BefoerdernKarte isOnline={isOnline} onBefoerdern={p.onBefoerdern} />}
    </>
  );

  return (
    <WebDetailSeite
      bereich="Verwaltung"
      zurueck={zurueck}
      titel={name}
      kreis={istTeamer
        ? <WebKreis text={initialen(name) || '??'} ton="teamer" gross />
        : <WebKreis text={initialen(konfi.name || name)} ton={gesamt.erreicht ? 'erreicht' : 'konfis'} gross />}
      kennzeichen={kennzeichen}
      aktionen={aktionen}
      hinweis={hinweis}
      kennzahlen={kennzahlen}
      haupt={haupt}
      angaben={angaben}
      seite={seite}
      pageRef={p.pageRef}
    />
  );
};

export default WebKonfiDetail;
