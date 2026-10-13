// „Konfi anlegen" und „Konfi bearbeiten" als Dialog der Web-Fassung (Simon,
// 13.10.2026: „Das konfi anlegen modal ist noch nicht im neuen web modal look";
// „Konfi bearbeiten hat noch kein eigenes web modal"). Geöffnet im breiten
// Layout von AdminKonfisPage (Anlegen) und KonfiDetailView (Bearbeiten); unter
// 992 px und in den Apps bleibt das Modal der App (modals/KonfiModal.tsx).
//
// Dieselben Felder und Regeln wie in der App, dieselbe Logik
// (useKonfiFormular): Name und Jahrgang, beim Wechsel des Jahrgangs dieselben
// Warnungen, dieselbe Kennung gegen doppeltes Anlegen, dieselben Rümpfe an
// dieselben Routen (POST /admin/konfis, PUT /admin/konfis/:id).
//
// Anders als in der App bleibt der Dialog nach „Anlegen" offen: Was der
// Server antwortet, steht im Fenster -- die Rückfrage beim Konfi-Limit
// („Trotzdem anlegen"), „Keine Antwort vom Server" („Erneut versuchen", mit
// derselben Kennung), die Tarif-Grenze, ein vergebener Name, jeder andere
// Fehler; danach das Einmalpasswort mit Benutzername und „Passwort kopieren".
// Solange eine Rückfrage offen ist, bleiben Name und Jahrgang gesperrt: Sie
// gilt genau diesem Konto (in der App ist das Modal dann schon zu).
//
// Während des Sendens schließt nichts den Dialog (Abbrechen, X, Escape, Klick
// daneben), wie das X der App: Ein Fehler des Servers ginge sonst ins Leere.

import React, { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_KOPIEREN, ICON_SCHLUESSEL } from '../../../shared/icons';
import { useApp } from '../../../../contexts/AppContext';
import { fehlerText } from '../../../../utils/fehler';
import {
  AENDERUNGEN_GESPEICHERT,
  ANLEGEN_HINWEIS,
  BEARBEITEN_HINWEIS,
  EINMALPASSWORT_TITEL,
  KEINE_ANTWORT_TITEL,
  KONFI_NAME_VERGEBEN,
  LIMIT_RUECKFRAGE_TITEL,
  TARIF_GRENZE_TITEL,
  WECHSEL_BLEIBT,
  WECHSEL_FOLGEN,
  einmalpasswortText,
  konfiAendern,
  konfiAnlegen,
  useKonfiFormular,
  type KonfiJahrgang,
  type KonfiZumBearbeiten,
} from '../../useKonfiFormular';
import WebDialog from '../../../web/WebDialog';
import WebAngaben from '../../../web/WebAngaben';
import WebAuswahl from '../../../web/WebAuswahl';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import '../../../../theme/web/leitung.css';

export interface WebKonfiDialogProps {
  jahrgaenge: KonfiJahrgang[];
  /** Die bearbeitete Konfi; fehlt sie, wird angelegt. */
  konfi?: KonfiZumBearbeiten;
  /** Jahrgänge, denen die angemeldete Person zugewiesen ist (nur `admin`, für die Warnung). */
  eigeneJahrgangIds?: number[];
  /** Nach dem Anlegen bzw. Speichern: Liste oder Seite laden neu. */
  onGespeichert: () => Promise<void> | void;
  onSchliessen: () => void;
}

interface Meldung {
  art: 'fehler' | 'warnung';
  titel?: string;
  text: string;
}

/** Eine offene Rückfrage nach dem Anlegen: Sie gilt genau diesen Angaben. */
type Nachfrage = 'limit' | 'erneut' | null;

const WebKonfiDialog: React.FC<WebKonfiDialogProps> = ({ jahrgaenge, konfi, eigeneJahrgangIds, onGespeichert, onSchliessen }) => {
  const { isOnline, setSuccess } = useApp();
  const {
    bearbeiten, name, setName, jahrgangId, setJahrgangId, isSubmitting, guard, pruefen, daten, wechselt, wechselAchtung,
  } = useKonfiFormular({ jahrgaenge, konfi, eigeneJahrgangIds });
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const [nachfrage, setNachfrage] = useState<Nachfrage>(null);
  // Einmal „Trotzdem anlegen" bestätigt, gilt es auch für „Erneut versuchen"
  // danach -- wie in der App, die denselben Rumpf noch einmal schickt.
  const [bestaetigt, setBestaetigt] = useState(false);
  const [angelegt, setAngelegt] = useState<{ name: string; passwort: string; benutzername?: string } | null>(null);
  const [kopiert, setKopiert] = useState<'ja' | 'nein' | null>(null);
  const formular = useRef<HTMLDivElement>(null);
  const kopierKnopf = useRef<HTMLDivElement>(null);

  // Der Dialog ist kurz, aber eine Meldung soll nie unter der Knopfleiste liegen.
  useEffect(() => {
    if (meldung) formular.current?.querySelector<HTMLElement>('.web-hinweis')?.scrollIntoView?.({ block: 'nearest' });
  }, [meldung]);
  // Nach dem Anlegen geht der Fokus auf „Passwort kopieren" -- der Knopf, der ihn trug, ist weg.
  useEffect(() => {
    if (angelegt) kopierKnopf.current?.querySelector<HTMLElement>('button')?.focus();
  }, [angelegt]);

  const sperrt = isSubmitting || nachfrage !== null;

  const neuLaden = async () => {
    try {
      await onGespeichert();
    } catch {
      // Die Liste lädt beim nächsten Öffnen; das Konto steht.
    }
  };

  const anlegen = async () => {
    const mitBestaetigung = bestaetigt || nachfrage === 'limit';
    if (mitBestaetigung) setBestaetigt(true);
    await guard(async () => {
      const ergebnis = await konfiAnlegen({ ...daten(), ...(mitBestaetigung ? { confirm: true } : {}) });
      setNachfrage(null);
      switch (ergebnis.art) {
        case 'angelegt':
          setMeldung(null);
          if (ergebnis.passwort) setAngelegt({ name: daten().name, passwort: ergebnis.passwort, benutzername: ergebnis.benutzername });
          await neuLaden();
          // Ohne Passwort in der Antwort gibt es nichts zu zeigen (die App zeigt dann auch keins).
          if (!ergebnis.passwort) onSchliessen();
          return;
        case 'limit-rueckfrage':
          setNachfrage('limit');
          setMeldung({ art: 'warnung', titel: LIMIT_RUECKFRAGE_TITEL, text: ergebnis.text });
          return;
        case 'keine-antwort':
          setNachfrage('erneut');
          setMeldung({ art: 'warnung', titel: KEINE_ANTWORT_TITEL, text: ergebnis.text });
          return;
        case 'tarif-grenze':
          setMeldung({ art: 'fehler', titel: TARIF_GRENZE_TITEL, text: ergebnis.text });
          return;
        case 'name-vergeben':
          setMeldung({ art: 'fehler', text: KONFI_NAME_VERGEBEN });
          return;
        default:
          setMeldung({ art: 'fehler', text: ergebnis.text });
      }
    });
  };

  const speichern = async (konfiId: number) => {
    await guard(async () => {
      try {
        await konfiAendern(konfiId, daten());
      } catch (err) {
        setMeldung({ art: 'fehler', text: fehlerText(err, 'Fehler beim Speichern') });
        return;
      }
      await neuLaden();
      setSuccess(AENDERUNGEN_GESPEICHERT);
      onSchliessen();
    });
  };

  const absenden = () => {
    if (isSubmitting || !isOnline) return;
    const fehlt = pruefen();
    if (fehlt) {
      setMeldung({ art: 'fehler', text: fehlt });
      return;
    }
    if (konfi) void speichern(konfi.id);
    else void anlegen();
  };

  /** Eine Eingabe räumt die Meldung weg (eine offene Rückfrage sperrt die Felder ohnehin). */
  const aendern = (setzen: () => void) => {
    setzen();
    setMeldung(null);
  };

  const kopieren = (passwort: string) => {
    const zwischenablage = navigator.clipboard;
    if (!zwischenablage) {
      setKopiert('nein');
      return;
    }
    zwischenablage.writeText(passwort).then(() => setKopiert('ja'), () => setKopiert('nein'));
  };

  if (angelegt) {
    return (
      <WebDialog
        titel={EINMALPASSWORT_TITEL}
        beschreibung={einmalpasswortText(angelegt.name)}
        onSchliessen={onSchliessen}
        aktionen={<WebKnopf art="primaer" onClick={onSchliessen}>Fertig</WebKnopf>}
      >
        <div className="web-formular">
          <WebAngaben
            beschriftung="Zugang"
            angaben={[
              ...(angelegt.benutzername ? [{ label: 'Benutzername', wert: <span className="web-code">{angelegt.benutzername}</span> }] : []),
              {
                label: 'Einmalpasswort',
                wert: <span className="web-code web-code--gross">{angelegt.passwort}</span>,
                icon: ICON_SCHLUESSEL,
                iconKlasse: 'app-icon-color--konfis',
              },
            ]}
          />
          <div className="web-formular__knoepfe" ref={kopierKnopf}>
            <WebKnopf onClick={() => kopieren(angelegt.passwort)}>
              <IonIcon icon={ICON_KOPIEREN} aria-hidden="true" />
              Passwort kopieren
            </WebKnopf>
          </div>
          {kopiert === 'ja' && <WebHinweis art="erfolg">Passwort kopiert.</WebHinweis>}
          {kopiert === 'nein' && (
            <WebHinweis art="warnung">Kopieren ging hier nicht. Markiere das Passwort und kopiere es selbst.</WebHinweis>
          )}
          <WebHinweis art="hinweis">Einsehen lässt es sich danach nicht mehr; in der Detailansicht kannst du nur ein neues erzeugen.</WebHinweis>
        </div>
      </WebDialog>
    );
  }

  const hauptknopf = bearbeiten
    ? 'Speichern'
    : nachfrage === 'limit' ? 'Trotzdem anlegen' : nachfrage === 'erneut' ? 'Erneut versuchen' : 'Anlegen';

  const jahrgangOptionen = jahrgaenge.length === 0
    ? [{ wert: '', label: 'Keine Jahrgänge verfügbar' }]
    : [
      ...(jahrgangId === null ? [{ wert: '', label: 'Bitte wählen' }] : []),
      ...jahrgaenge.map((jg) => ({ wert: String(jg.id), label: jg.name })),
    ];

  return (
    <WebDialog
      titel={bearbeiten ? 'Konfi bearbeiten' : 'Konfi anlegen'}
      onSchliessen={onSchliessen}
      onAbsenden={absenden}
      gesperrt={isSubmitting}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen} disabled={isSubmitting}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={isSubmitting || !isOnline}>{hauptknopf}</WebKnopf>
        </>
      )}
    >
      <div className="web-formular" ref={formular}>
        {meldung && (
          <WebHinweis art={meldung.art} titel={meldung.titel} rolle="alert">{meldung.text}</WebHinweis>
        )}
        {!isOnline && (
          <WebHinweis art="warnung">Du bist offline. Speichern geht erst wieder mit Internetverbindung.</WebHinweis>
        )}
        <WebFeld
          label="Name"
          pflicht
          wert={name}
          onWert={(w) => aendern(() => setName(w))}
          platzhalter="Vor- und Nachname"
          autocomplete="name"
          deaktiviert={sperrt}
        />
        <WebAuswahl
          label="Jahrgang"
          pflicht
          wert={jahrgangId === null ? '' : String(jahrgangId)}
          onWert={(w) => aendern(() => setJahrgangId(w === '' ? null : Number(w)))}
          optionen={jahrgangOptionen}
          deaktiviert={sperrt || jahrgaenge.length === 0}
        />
        {wechselt && (
          <WebHinweis art="warnung" titel="Was der Wechsel bewirkt">
            <p className="web-hinweis__absatz">Es gelten die Regeln des neuen Jahrgangs:</p>
            <ul className="web-wechsel-folgen">
              {WECHSEL_FOLGEN.map((folge) => <li key={folge}>{folge}</li>)}
            </ul>
            <p className="web-hinweis__absatz">{WECHSEL_BLEIBT}</p>
            {wechselAchtung.map((satz) => <p key={satz} className="web-hinweis__absatz"><strong>{satz}</strong></p>)}
          </WebHinweis>
        )}
        <WebHinweis art="hinweis">{bearbeiten ? BEARBEITEN_HINWEIS : ANLEGEN_HINWEIS}</WebHinweis>
      </div>
    </WebDialog>
  );
};

export default WebKonfiDialog;
