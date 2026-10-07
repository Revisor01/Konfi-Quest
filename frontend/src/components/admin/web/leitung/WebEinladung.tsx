// Konfis einladen in der Web-Fassung, /admin/settings/invite (Browser ab
// 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6): links ein
// Formular fuer den neuen Code (Jahrgang, Gueltigkeit) und die Tabelle der
// aktiven Codes, rechts der QR-Code mit Link und Teilen.
//
// Zustand und Aktionen kommen von der Seite (AdminInvitePage): Sie erzeugt den
// Code, rechnet den QR-Code, verlaengert und loescht mit denselben
// Rueckfragen wie in der App. Dort ist dieselbe Seite ein Fenster aus "Mehr";
// diese Fassung gilt fuer die Seite unter /admin/settings/invite.

import React from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_HINZUFUEGEN,
  ICON_JAHRGANG_GEFUELLT,
  ICON_KOPIEREN,
  ICON_LOESCHEN,
  ICON_QRCODE,
  ICON_QRCODE_GEFUELLT,
  ICON_TEILEN,
  ICON_UHRZEIT_GEFUELLT,
} from '../../../shared/icons';
import { tageBis } from '../../../shared/eventFormatting';
import { GUELTIGKEIT_TAGE, HOECHSTENS_TAGE, gueltigkeitText, istGueltigkeitTage, type GueltigkeitTage } from '../../../../utils/einladungsGueltigkeit';
import WebSeite from '../../../web/WebSeite';
import WebKarte from '../../../web/WebKarte';
import WebKnopf from '../../../web/WebKnopf';
import WebAuswahl from '../../../web/WebAuswahl';
import WebPill from '../../../web/WebPill';
import WebHinweis from '../../../web/WebHinweis';
import WebSpalten from '../../../web/WebSpalten';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import { WebLaden, WebLeer } from '../../../web/WebZustaende';
import { WebSymbol } from './WebLeitungBausteine';
import type { EinladungsCode } from './verwaltungTypen';

export interface WebEinladungProps {
  jahrgaenge: ReadonlyArray<{ id: number; name: string }>;
  codes: readonly EinladungsCode[];
  laedt: boolean;
  isOnline: boolean;
  /** Der gewaehlte Jahrgang fuer den neuen Code. */
  jahrgangId: number | null;
  onJahrgang: (id: number | null) => void;
  gueltigTage: GueltigkeitTage;
  onGueltigTage: (tage: GueltigkeitTage) => void;
  /** Ein Code wird gerade erzeugt. */
  erzeugt: boolean;
  onErzeugen: () => void;
  /** Der angezeigte Code und sein QR-Code (Bild als data:-Adresse). */
  inviteCode: string | null;
  qrUrl: string | null;
  /** Der Code, der gerade verlaengert wird. */
  verlaengertId: number | null;
  onQrZeigen: (code: EinladungsCode) => void;
  onVerlaengern: (code: EinladungsCode) => void;
  onLoeschen: (code: EinladungsCode) => void;
  onKopieren: () => void;
  onTeilen: () => void;
  /** Der Satz zur Gueltigkeit ("Noch 5 Tage gültig") -- derselbe wie in der App. */
  ablaufSatz: (iso: string) => string;
}

const ablaufTon = (iso: string): 'erfolg' | 'warnung' | 'fehler' => {
  const rest = tageBis(new Date(iso));
  return rest < 0 ? 'fehler' : rest === 0 ? 'warnung' : 'erfolg';
};

const WebEinladung: React.FC<WebEinladungProps> = (p) => {
  const zurueck = { href: '/admin/settings', text: 'Mehr' };

  if (p.laedt) {
    return (
      <WebSeite bereich="Verwaltung" titel="Konfis einladen" zurueck={zurueck}>
        <WebLaden karten={2} text="Die Einladungen werden geladen." />
      </WebSeite>
    );
  }

  const spalten: Array<WebSpalte<EinladungsCode>> = [
    {
      schluessel: 'jahrgang',
      kopf: 'Jahrgang',
      sortWert: (c) => c.jahrgang_name,
      zelle: (c) => (
        <span className="web-person-zelle">
          <WebSymbol icon={ICON_QRCODE_GEFUELLT} ton="erfolg" />
          <span className="web-zelle-titel web-einzeilig">{c.jahrgang_name}</span>
        </span>
      ),
    },
    {
      schluessel: 'code',
      kopf: 'Code',
      breite: '150px',
      sortWert: (c) => c.invite_code,
      zelle: (c) => <span className="web-code">{c.invite_code}</span>,
    },
    {
      schluessel: 'verwendet',
      kopf: 'Verwendet',
      zahl: true,
      breite: '100px',
      optional: true,
      sortWert: (c) => c.used_count || 0,
      zelle: (c) => c.used_count || 0,
    },
    {
      schluessel: 'gueltig',
      kopf: 'Gültigkeit',
      breite: '210px',
      sortWert: (c) => (c.expires_at ? new Date(c.expires_at) : null),
      zelle: (c) => <WebPill ton={ablaufTon(c.expires_at)} punkt>{p.ablaufSatz(c.expires_at)}</WebPill>,
    },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      klasse: 'web-spalte-aktionen-breit',
      zelle: (c) => (
        <div className="web-zeilenaktionen">
          <WebKnopf klein onClick={() => p.onQrZeigen(c)} aria-label={`QR-Code von ${c.invite_code} anzeigen`}>
            <IonIcon icon={ICON_QRCODE} aria-hidden="true" />
            <span className="web-knopf__text">QR-Code</span>
          </WebKnopf>
          <WebKnopf
            klein symbol
            onClick={() => p.onVerlaengern(c)}
            disabled={p.verlaengertId === c.id}
            aria-label={`Einladung ${c.invite_code} verlängern`}
            title="Einladung verlängern"
          >
            <IonIcon icon={ICON_UHRZEIT_GEFUELLT} aria-hidden="true" />
          </WebKnopf>
          <WebKnopf klein symbol art="gefahr" onClick={() => p.onLoeschen(c)} aria-label={`Einladung ${c.invite_code} löschen`} title="Einladung löschen">
            <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
          </WebKnopf>
        </div>
      ),
    },
  ];

  const haupt = (
    <>
      <WebKarte titel="Neuer Einladungscode" untertitel="Konfis scannen den Code und werden dem Jahrgang zugeordnet.">
        <form
          className="web-formular"
          onSubmit={(e) => { e.preventDefault(); if (p.jahrgangId && p.isOnline && !p.erzeugt) p.onErzeugen(); }}
        >
          <div className="web-formular__felder">
            <WebAuswahl
              label="Jahrgang"
              pflicht
              wert={p.jahrgangId === null ? '' : String(p.jahrgangId)}
              onWert={(w) => p.onJahrgang(w === '' ? null : Number(w))}
              optionen={[{ wert: '', label: 'Jahrgang wählen' }, ...p.jahrgaenge.map((j) => ({ wert: String(j.id), label: j.name }))]}
            />
            <WebAuswahl
              label="Gültigkeit"
              wert={String(p.gueltigTage)}
              onWert={(w) => { const n = Number(w); if (istGueltigkeitTage(n)) p.onGueltigTage(n); }}
              optionen={GUELTIGKEIT_TAGE.map((t) => ({ wert: String(t), label: gueltigkeitText(t) }))}
            />
          </div>
          <div className="web-formular__aktionen">
            <WebKnopf art="primaer" absenden disabled={p.erzeugt || !p.jahrgangId || !p.isOnline}>
              <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
              {p.isOnline ? (p.erzeugt ? 'Wird erzeugt …' : 'Einladungslink generieren') : 'Du bist offline'}
            </WebKnopf>
          </div>
        </form>
      </WebKarte>

      <WebKarte titel="Aktive Einladungscodes" untertitel={`${p.codes.length} ${p.codes.length === 1 ? 'Code' : 'Codes'}`} bund={p.codes.length > 0}>
        {p.codes.length === 0 ? (
          <WebLeer icon={ICON_QRCODE} titel="Keine Einladungscodes" text="Erzeuge oben einen Code für einen Jahrgang." />
        ) : (
          <WebTabelle
            beschriftung="Aktive Einladungscodes"
            spalten={spalten}
            zeilen={p.codes}
            zeileSchluessel={(c) => c.id}
            zeileKlasse={(c) => (c.invite_code === p.inviteCode ? 'web-zeile--gewaehlt' : undefined)}
            mittig
          />
        )}
      </WebKarte>
    </>
  );

  const seite = (
    <>
      <WebKarte titel="QR-Code" untertitel={p.inviteCode ? undefined : 'Noch kein Code gewählt'}>
        {p.qrUrl && p.inviteCode ? (
          <div className="web-qr">
            <img className="web-qr__bild" src={p.qrUrl} alt="QR-Code für die Registrierung" width={200} height={200} />
            <p className="web-karte__text">Konfis scannen diesen Code, um sich selbst zu registrieren.</p>
            <div className="web-qr__code">
              <span className="web-gedaempft">Einladungscode</span>
              <span className="web-code web-code--gross">{p.inviteCode}</span>
            </div>
            <div className="web-qr__aktionen">
              <WebKnopf onClick={p.onKopieren}>
                <IonIcon icon={ICON_KOPIEREN} aria-hidden="true" />
                Link kopieren
              </WebKnopf>
              <WebKnopf art="primaer" onClick={p.onTeilen}>
                <IonIcon icon={ICON_TEILEN} aria-hidden="true" />
                Teilen
              </WebKnopf>
            </div>
          </div>
        ) : (
          <WebLeer
            icon={ICON_JAHRGANG_GEFUELLT}
            titel="Kein Code gewählt"
            text="Erzeuge einen Code oder wähle in der Tabelle „QR-Code“ bei einem aktiven Code."
          />
        )}
      </WebKarte>
      <WebHinweis art="hinweis">
        Einladungscodes gelten je nach Wahl 7 bis 90 Tage und laufen immer ab. Verlängern geht, solange ein Code gilt — höchstens bis {HOECHSTENS_TAGE} Tage im Voraus. Ein Code kann von beliebig vielen Konfis verwendet werden; sie werden automatisch dem gewählten Jahrgang zugeordnet.
      </WebHinweis>
    </>
  );

  return (
    <WebSeite bereich="Verwaltung" titel="Konfis einladen" untertitel="QR-Code und Link für die Selbstregistrierung" zurueck={zurueck}>
      <WebSpalten haupt={haupt} seite={seite} seiteBeschriftung="QR-Code und Hinweise" />
    </WebSeite>
  );
};

export default WebEinladung;
