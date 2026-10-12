// Ein Vorgang im Lesebereich der Web-Fassung (rechts neben der Liste,
// web/WebVorgaenge) -- wie in einem guten Mailprogramm (Simon, 11.10.2026)
// und mit dem Gerüst jeder Detailseite des Hauptwebs
// (docs/planung/support-detailseiten.md, Skizzen A bis C, F bis H):
//
//   Kopf (klebt): Kreis der Art, Betreff (höchstens zwei Zeilen, ganz im
//     Tooltip), Kennzeichen (Nr., Status, Dringend, Art › Bereich, Gemeinde
//     nur mit Zuordnung); rechts alle Aktionen -- Löschen, Archivieren,
//     Einordnen, bei einer Anfrage Ablehnen, die Nebenknöpfe und rechts
//     außen der eine Hauptknopf, der dem Stand folgt.
//   Rumpf (WebDetailRumpf, wie jede Detailseite): die Stand-Zeile (wer dran
//     ist und seit wann), die Kennzahlen nur, wenn zwei Spalten Platz haben;
//     links die Notiz und der flache Verlauf mit der Antwort direkt unter der
//     jüngsten Mail, rechts bzw. darunter die Angaben als offene Karten.
//   Dialoge: Einordnen, Gemeinde anlegen, Lizenz ändern, Mail verschieben
//     oder herauslösen (Menü ··· an jeder offenen Mail).
//
// Die Logik (laden, Stand, Angaben, einordnen, Notiz, archivieren, löschen,
// Antwortweg, Ablehnen) steht in components/support/useVorgangDetail.ts,
// dieselbe wie in der App; die Regeln in utils/supportVorgaenge.ts.
//
// Der Lese-Rahmen (web/leseRahmen.ts) kommt von der Liste: Nach Erledigt,
// Archivieren oder Löschen öffnet er den nächsten Eintrag (Frage 6); steht im
// Editor oder in der Notiz ein Entwurf, fragen Erledigt, Archivieren und
// Ablehnen vorher („Ungespeicherte Änderungen", useEntwurfSchutz), `?mail=`
// hebt eine Mail hervor, „Breit lesen" zeigt über dem Kopf die Leiste zum
// Blättern. Ohne Rahmen (LESE_RAHMEN_NEUTRAL) bleibt der Vorgang nach einem
// Abschluss stehen, und `onGeloescht` leert nach dem Löschen den Lesebereich;
// mit Rahmen übernimmt das `abgeschlossen` (sonst wählte onGeloescht den
// eben geöffneten nächsten Eintrag wieder ab).

import React, { useEffect, useRef, useState } from 'react';
import {
  ICON_ABLEHNEN,
  ICON_ANTWORTEN,
  ICON_ARCHIV,
  ICON_BEARBEITEN,
  ICON_HAKEN,
  ICON_HINZUFUEGEN,
  ICON_KATEGORIE,
  ICON_LISTE,
  ICON_LOESCHEN,
  ICON_ORGANISATION,
  ICON_RUECKGAENGIG,
  ICON_WARNHINWEIS,
} from '../../shared/icons';
import type { MailNachricht } from '../../../types/support';
import { istZugeordnet, kontaktVon, type AngabeAktion, type StandAktion, type StandMarke } from '../../../utils/supportVorgaenge';
import { AKTION_TEXT, LIZENZ_TEXT, MAIL_MENUE } from '../../../seiten/supportDetail';
import { useVorgangDetail } from '../useVorgangDetail';
import { vorgewaehlterEmpfaenger } from '../useAntwortEditor';
import MailGespraeche from '../MailGespraeche';
import WebDetailRumpf from '../../web/WebDetailRumpf';
import WebKnopf from '../../web/WebKnopf';
import WebLink from '../../web/WebLink';
import WebPill from '../../web/WebPill';
import WebAntwortStelle from './WebAntwortStelle';
import WebEinordnen from './WebEinordnen';
import WebEinsortieren from './WebEinsortieren';
import WebGemeindeAnlegen from './WebGemeindeAnlegen';
import WebLizenzAendern from './WebLizenzAendern';
import { WebLesen } from './WebLeseRahmen';
import { LESE_RAHMEN_NEUTRAL, useLeseRahmen } from './leseRahmen';
import { WebLeseHinweis } from './WebPostfach';
import { useAntwortStelle, useEntwurfSchutz } from './useAntwortStelle';
import { AngabenKarten, DringlichPill, KopfAktionen, KopfKnopf, StandZeile, StatusPill, VorgangKreis, WebNotiz } from './WebVorgangTeile';
import '../../../theme/web/support.css';

export interface WebVorgangDetailProps {
  vorgangId: number;
  /** Der Vorgang ist gelöscht: den Lesebereich leeren (ohne Lese-Rahmen der Liste). */
  onGeloescht?: () => void;
}

/** Welches Fenster offen ist. */
type Fenster = null | 'einordnen' | 'anlegen' | 'lizenz' | { art: 'verschieben' | 'herausloesen'; mail: MailNachricht };

const WebVorgangDetail: React.FC<WebVorgangDetailProps> = ({ vorgangId, onGeloescht }) => {
  const rahmen = useLeseRahmen();
  const mitRahmen = rahmen !== LESE_RAHMEN_NEUTRAL;
  const d = useVorgangDetail(vorgangId, {
    nachAbschluss: (_art, id) => rahmen.abgeschlossen(id),
    nachLoeschen: mitRahmen ? () => {} : onGeloescht,
  });
  const {
    isOnline, vorgang, neu, laedt, fehler, nichtGefunden, speichert, laden, antwort, notiz, setNotiz, notizGeaendert,
    notizSpeichern, archivieren, wiederherstellen, loeschenFragen, archiviert, anlegen, stand, kennzahlen, angaben,
    statusSetzen, ablehnbar, ablehnenFragen, antwortAn, empfaenger, beantwortet, lizenzAenderbar,
  } = d;
  // Unter der jüngsten Mail: die Antwortzeile bzw. der Editor (G) -- Rollen
  // und Fokus wie bei der Mail im Posteingang (web/useAntwortStelle.ts).
  const stelle = useAntwortStelle();
  const [fenster, setFenster] = useState<Fenster>(null);

  // Ein Entwurf -- Antwort oder Notiz -- ginge verloren, wenn der Rahmen nach einem Abschluss den
  // nächsten Eintrag öffnet: vorher fragen. Ohne Rahmen bleibt der Vorgang stehen, und nichts geht verloren.
  const entwurfSchutz = useEntwurfSchutz();
  const entwurf = () => ({ antwort: stelle.hatEntwurf(), notiz: d.notizGeaendert });
  const vorWechsel = (weiter: () => void) => (mitRahmen ? entwurfSchutz(entwurf(), weiter) : weiter());
  // Die Sammelleiste der Liste fragt nicht; sie lässt einen Eintrag mit Entwurf offen.
  const { entwurfMelden } = rahmen;
  const entwurfAktuell = useRef(entwurf);
  useEffect(() => { entwurfAktuell.current = entwurf; });
  useEffect(() => {
    entwurfMelden(() => { const e = entwurfAktuell.current(); return e.antwort || e.notiz; });
    return () => entwurfMelden(null);
  }, [entwurfMelden]);

  // Angelegt: Der Dialog schließt, der Stand sagt, wer die Zugangsdaten bekommt (nachgezogen beim Rendern).
  const [angelegtGesehen, setAngelegtGesehen] = useState(anlegen.angelegt);
  if (anlegen.angelegt !== angelegtGesehen) {
    setAngelegtGesehen(anlegen.angelegt);
    if (anlegen.angelegt && fenster === 'anlegen') setFenster(null);
  }

  if (!vorgang || !stand) {
    if (laedt) return <WebLeseHinweis icon={ICON_LISTE} titel="Der Vorgang wird geladen." />;
    if (fehler && !nichtGefunden) {
      return (
        <WebLeseHinweis icon={ICON_WARNHINWEIS} titel="Der Vorgang konnte nicht geladen werden.">
          <WebKnopf onClick={() => { void laden(); }}>Erneut versuchen</WebKnopf>
        </WebLeseHinweis>
      );
    }
    return <WebLeseHinweis icon={ICON_LISTE} titel="Vorgang nicht gefunden" text="Diesen Vorgang gibt es nicht (mehr) — vielleicht wurde er gelöscht." />;
  }

  const anfrage = vorgang.anfrage;
  const kontakt = kontaktVon(vorgang);
  const formularText = vorgang.beschreibung ?? anfrage?.nachricht ?? null;
  // Nur eine zugeordnete Gemeinde; gemeinde_name nennt sonst den Freitext aus Formular oder Anfrage (Fehler vorab 3).
  const gemeindeText = istZugeordnet(vorgang) ? vorgang.gemeinde?.display_name ?? vorgang.gemeinde_name ?? `Gemeinde ${vorgang.organization_id}` : null;
  const gemeindeId = anlegen.gemeindeId ?? vorgang.organization_id;

  const oeffneAntwort = stelle.oeffnen;
  const einordnenOeffnen = () => setFenster('einordnen');

  // --- Kopf ----------------------------------------------------------------------------
  const marke = (m: StandMarke): React.ReactNode => {
    if (m.schluessel === 'status') return <StatusPill key={m.schluessel} status={vorgang.status} />;
    if (m.schluessel === 'dringend') return <DringlichPill key={m.schluessel} dringlichkeit={vorgang.dringlichkeit} />;
    if (m.schluessel === 'art') return <span key={m.schluessel} className="web-lesen__art">{m.text}</span>;
    if (m.schluessel === 'bereich_fehlt' || m.schluessel === 'keine_gemeinde') {
      return (
        <button key={m.schluessel} type="button" className="web-markenknopf" onClick={einordnenOeffnen} disabled={!isOnline} title="Einordnen" aria-label={`${m.text}: Einordnen`}>
          <WebPill ton={m.ton}>{m.text}</WebPill>
        </button>
      );
    }
    return <WebPill key={m.schluessel} ton={m.ton}>{m.text}</WebPill>;
  };
  const kennzeichen = (
    <>
      <span className="web-lesen__nummer">Nr. {vorgang.id}</span>
      {stand.marken.map(marke)}
      {gemeindeText && (
        <WebLink href={`/admin/organizations?gemeinde=${vorgang.organization_id}`} className="web-lesen__gemeinde">{gemeindeText}</WebLink>
      )}
      {/* Schmal stehen die Zahlen der Anfrage hier, breit als Kennzahlen -- jede Zahl einmal. */}
      {anfrage && (anfrage.anzahl_konfis !== null || anfrage.anzahl_teamer !== null) && (
        <span className="web-lesen__nur-schmal">
          {[anfrage.anzahl_konfis !== null ? `${anfrage.anzahl_konfis} Konfis` : null, anfrage.anzahl_teamer !== null ? `${anfrage.anzahl_teamer} Teamer:innen` : null].filter(Boolean).join(' · ')}
        </span>
      )}
    </>
  );

  /** Ein Knopf des Stands: Hauptknopf rechts außen (mit Text) oder Nebenknopf (schmal nur Symbol). */
  const aktion = (a: StandAktion, haupt: boolean): React.ReactNode => {
    const t = AKTION_TEXT[a];
    const symbol = haupt ? undefined : a === 'ablehnen' ? 'immer' : a === 'lizenz_aendern' ? 'unter760' : 'unter600';
    const basis = { label: t.label, titel: t.titel, art: haupt ? 'primaer' : 'sekundaer', symbol } as const;
    switch (a) {
      case 'antworten':
        return <KopfKnopf key={a} {...basis} icon={ICON_ANTWORTEN} onClick={oeffneAntwort} disabled={!antwort || !isOnline} />;
      case 'erledigt':
        return <KopfKnopf key={a} {...basis} icon={ICON_HAKEN} onClick={() => vorWechsel(() => { void statusSetzen('erledigt'); })} disabled={speichert || !isOnline} />;
      case 'gemeinde_anlegen':
        return <KopfKnopf key={a} {...basis} icon={ICON_HINZUFUEGEN} onClick={() => setFenster('anlegen')} disabled={!anlegen.anlegbar || !isOnline} />;
      case 'gemeinde_oeffnen':
        return gemeindeId !== null ? <KopfKnopf key={a} {...basis} icon={ICON_ORGANISATION} href={`/admin/organizations?gemeinde=${gemeindeId}`} /> : null;
      case 'wiederherstellen':
        return <KopfKnopf key={a} {...basis} icon={ICON_RUECKGAENGIG} onClick={() => { void wiederherstellen(); }} disabled={speichert || !isOnline} />;
      case 'gemeinde_zuordnen':
        return <KopfKnopf key={a} {...basis} icon={ICON_ORGANISATION} onClick={einordnenOeffnen} disabled={!isOnline} />;
      case 'ablehnen':
        return <KopfKnopf key={a} {...basis} icon={ICON_ABLEHNEN} onClick={() => vorWechsel(ablehnenFragen)} disabled={!ablehnbar || speichert || !isOnline} />;
      case 'lizenz_aendern':
        return <KopfKnopf key={a} {...basis} icon={ICON_KATEGORIE} onClick={() => setFenster('lizenz')} disabled={!lizenzAenderbar || !isOnline} />;
      default:
        return null;
    }
  };
  const symbole = (
    <>
      <KopfKnopf label="Löschen" icon={ICON_LOESCHEN} art="gefahr" symbol="immer" onClick={loeschenFragen} disabled={speichert || !isOnline} />
      {!archiviert && <KopfKnopf label="Archivieren" icon={ICON_ARCHIV} symbol="immer" onClick={() => vorWechsel(() => { void archivieren(); })} disabled={speichert || !isOnline} />}
      <KopfKnopf label="Einordnen" titel="Status, Art, Bereich, Gemeinde und Betreff" icon={ICON_BEARBEITEN} symbol="unter760" onClick={einordnenOeffnen} disabled={!isOnline} />
      {stand.neben.includes('ablehnen') && aktion('ablehnen', false)}
    </>
  );

  // --- Antwort ---------------------------------------------------------------------------
  /**
   * An wen die Antwort geht, wie die Antwortzeile es nennt: dieselbe Wahl wie
   * im Editor (vorgewaehlterEmpfaenger) -- wählt er niemanden vor, nennt die
   * Zeile auch niemanden („Antwort schreiben …").
   */
  const antwortAdresse = antwort ? (antwort.empfaenger ? vorgewaehlterEmpfaenger(antwort.empfaenger, antwort.empfaengerVorgabe) || null : antwort.an ?? null) : null;
  const gleich = (a: string | null | undefined) => !!a && !!antwortAdresse && a.toLowerCase() === antwortAdresse.toLowerCase();
  const antwortWer = antwortAdresse
    ? empfaenger.find((e) => gleich(e.adresse))?.name ?? (beantwortet && gleich(beantwortet.von_adresse) ? beantwortet.von_name : null) ?? antwortAdresse
    : null;
  const nachJuengster = <WebAntwortStelle stelle={stelle} antwort={antwort} wer={antwortWer} schluessel={vorgang.id} disabled={!isOnline} />;

  const angabeAktion = (art: AngabeAktion, adresse?: string) => {
    if (art === 'im_vorgang_antworten') {
      antwortAn(adresse ?? null);
      oeffneAntwort();
    } else if (art === 'zuordnen') {
      einordnenOeffnen();
    } else if (art === 'lizenz_aendern') {
      setFenster('lizenz');
    } else if (art === 'kirchenkreis_anlegen') {
      void anlegen.kirchenkreisAnlegen();
    }
  };

  const haupt = (
    <>
      <WebNotiz
        notiz={notiz}
        setNotiz={setNotiz}
        gespeichert={vorgang.notiz ?? ''}
        geaendert={notizGeaendert}
        speichern={notizSpeichern}
        gesperrt={speichert || !isOnline}
      />
      <MailGespraeche
        key={vorgang.id}
        mails={vorgang.verlauf}
        neu={neu}
        anfang={formularText ? {
          marke: vorgang.quelle === 'anfrage' || anfrage ? 'Anfrage' : 'Formular',
          name: kontakt.name,
          // Die Adresse steht in der Karte „Kontakt"; am Anfang nur, wenn es keinen Namen gibt.
          adresse: kontakt.name ? null : kontakt.email,
          datum: vorgang.created_at,
          text: formularText,
        } : null}
        titelKern={vorgang.betreff}
        leer="Noch keine Mails in diesem Vorgang."
        hervorheben={rahmen.hervorheben}
        menue={(m) => [
          { schluessel: 'verschieben', label: MAIL_MENUE.verschieben, onKlick: () => setFenster({ art: 'verschieben', mail: m }) },
          { schluessel: 'herausloesen', label: MAIL_MENUE.herausloesen, onKlick: () => setFenster({ art: 'herausloesen', mail: m }) },
        ]}
        nachJuengster={nachJuengster}
      />
    </>
  );

  return (
    <WebLesen
      titel={vorgang.betreff || '(ohne Betreff)'}
      kreis={<VorgangKreis art={vorgang.art} gross />}
      kennzeichen={kennzeichen}
      aktionen={<KopfAktionen symbole={symbole} neben={stand.neben.filter((a) => a !== 'ablehnen').map((a) => aktion(a, false))} haupt={aktion(stand.haupt, true)} />}
    >
      <WebDetailRumpf
        hinweis={<StandZeile satz={stand.satz} ton={stand.ton} zusatz={stand.zusatz} />}
        kennzahlen={kennzahlen.map((k) => ({ label: k.label, wert: k.wert }))}
        haupt={haupt}
        seite={<AngabenKarten karten={angaben} onAktion={angabeAktion} gesperrt={!isOnline} gesperrtTitel={LIZENZ_TEXT.ohneGemeindeGesperrt} />}
      />

      {fenster === 'einordnen' && <WebEinordnen d={d} onSchliessen={() => setFenster(null)} />}
      {fenster === 'anlegen' && anfrage && <WebGemeindeAnlegen anfrage={anfrage} d={anlegen} onSchliessen={() => setFenster(null)} />}
      {fenster === 'lizenz' && vorgang.gemeinde && <WebLizenzAendern gemeinde={vorgang.gemeinde} onSchliessen={() => setFenster(null)} />}
      {fenster !== null && typeof fenster === 'object' && (
        <WebEinsortieren
          mail={{ id: fenster.mail.id, betreff: fenster.mail.betreff }}
          ausVorgang={vorgang.id}
          modus={fenster.art === 'herausloesen' ? 'neu' : 'bestehend'}
          onSchliessen={() => setFenster(null)}
        />
      )}
    </WebLesen>
  );
};

export default WebVorgangDetail;
