// Offene Einladungen der Gemeinde in der Web-Fassung: eine Tabelle unter der
// Benutzerliste -- Person, Rolle, eingeladen am (von wem), gueltig bis und
// "Zurueckziehen". Laden und Zurueckziehen mit Rueckfrage ist dieselbe Logik wie
// in der App (components/admin/useOffeneEinladungen.ts). Nur fuer die
// Gemeindeleitung; ohne offene Einladung steht nichts da. Die Tabelle ist
// WebListe (10.10.2026), "Zurueckziehen" steht als weiterer Knopf am Ende.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_RUECKGAENGIG } from '../../../shared/icons';
import { datumKurz } from '../../../../utils/dateUtils';
import { rollenFarbe, rollenName } from '../../../../utils/rollenNamen';
import { initialen } from '../../../../utils/konfiListe';
import { mitEinheit } from '../../../../utils/supportStatistik';
import WebKarte from '../../../web/WebKarte';
import WebKnopf from '../../../web/WebKnopf';
import { useOffeneEinladungen } from '../../useOffeneEinladungen';
import type { OffeneEinladungDerGemeinde } from '../../useOffeneEinladungen';
import WebKreis from '../../../web/WebKreis';
import WebListe, { WebNameZelle, type WebSpalte } from '../../../web/WebListe';
import { WebRolleMarke } from './WebLeitungBausteine';

const WebOffeneEinladungen: React.FC<{ aktualisierung: number }> = ({ aktualisierung }) => {
  const { einladungen, laeuft, zurueckziehen } = useOffeneEinladungen(aktualisierung);
  if (einladungen.length === 0) return null;

  const spalten: Array<WebSpalte<OffeneEinladungDerGemeinde>> = [
    {
      schluessel: 'person',
      kopf: 'Person',
      sortWert: (e) => e.display_name,
      zelle: (e) => (
        <WebNameZelle
          kreis={<WebKreis text={initialen(e.display_name) || '??'} ton={rollenFarbe(e.role_name)} />}
          titel={e.display_name}
          unterzeile={`@${e.username}`}
        />
      ),
    },
    {
      schluessel: 'rolle',
      kopf: 'Eingeladen als',
      breite: '170px',
      sortWert: (e) => rollenName(e.role_name, e.role_display_name ?? undefined),
      zelle: (e) => <WebRolleMarke rolle={e.role_name} text={rollenName(e.role_name, e.role_display_name ?? undefined)} />,
    },
    {
      schluessel: 'eingeladen',
      kopf: 'Eingeladen am',
      breite: '190px',
      optional: true,
      sortWert: (e) => new Date(e.created_at),
      zelle: (e) => (
        <>
          <span className="web-zelle-titel">{datumKurz(e.created_at)}</span>
          {e.eingeladen_von_name && <span className="web-zelle-leise web-einzeilig">von {e.eingeladen_von_name}</span>}
        </>
      ),
    },
    {
      schluessel: 'gueltig',
      kopf: 'Gültig bis',
      breite: '130px',
      sortWert: (e) => new Date(e.expires_at),
      zelle: (e) => datumKurz(e.expires_at),
    },
  ];

  return (
    <WebKarte
      titel="Offene Einladungen"
      untertitel={`${mitEinheit(einladungen.length, 'Person hat', 'Personen haben')} noch nicht geantwortet`}
      bund
    >
      <WebListe
        beschriftung="Offene Einladungen"
        spalten={spalten}
        zeilen={einladungen}
        zeileSchluessel={(e) => e.id}
        mittig
        aktionenBreite="200px"
        weitere={(e) => (
          <WebKnopf klein art="gefahr" disabled={laeuft === e.id} onClick={() => zurueckziehen(e)} aria-label={`Einladung an ${e.display_name} zurückziehen`}>
            <IonIcon icon={ICON_RUECKGAENGIG} aria-hidden="true" />
            <span className="web-knopf__text">Zurückziehen</span>
          </WebKnopf>
        )}
      />
    </WebKarte>
  );
};

export default WebOffeneEinladungen;
