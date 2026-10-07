// Offene Einladungen der Gemeinde in der Web-Fassung: eine Tabelle unter der
// Benutzerliste -- Person, Rolle, eingeladen am (von wem), gueltig bis und
// "Zurueckziehen". Laden und Zurueckziehen mit Rueckfrage ist dieselbe Logik wie
// in der App (components/admin/useOffeneEinladungen.ts). Nur fuer die
// Gemeindeleitung; ohne offene Einladung steht nichts da.

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
import WebSortTabelle, { type WebSortSpalte } from './WebSortTabelle';
import { WebAvatar, WebRolleMarke } from './WebLeitungBausteine';

const WebOffeneEinladungen: React.FC<{ aktualisierung: number }> = ({ aktualisierung }) => {
  const { einladungen, laeuft, zurueckziehen } = useOffeneEinladungen(aktualisierung);
  if (einladungen.length === 0) return null;

  const spalten: Array<WebSortSpalte<OffeneEinladungDerGemeinde>> = [
    {
      schluessel: 'person',
      kopf: 'Person',
      sortWert: (e) => e.display_name,
      zelle: (e) => (
        <span className="web-person-zelle">
          <WebAvatar text={initialen(e.display_name) || '??'} farbe={rollenFarbe(e.role_name)} />
          <span className="web-person-zelle__text">
            <span className="web-zelle-titel web-einzeilig">{e.display_name}</span>
            <span className="web-zelle-leise web-einzeilig">@{e.username}</span>
          </span>
        </span>
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
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      klasse: 'web-spalte-aktionen-breit',
      zelle: (e) => (
        <div className="web-zeilenaktionen">
          <WebKnopf klein art="gefahr" disabled={laeuft === e.id} onClick={() => zurueckziehen(e)} aria-label={`Einladung an ${e.display_name} zurückziehen`}>
            <IonIcon icon={ICON_RUECKGAENGIG} aria-hidden="true" />
            <span className="web-knopf__text">Zurückziehen</span>
          </WebKnopf>
        </div>
      ),
    },
  ];

  return (
    <WebKarte
      titel="Offene Einladungen"
      untertitel={`${mitEinheit(einladungen.length, 'Person hat', 'Personen haben')} noch nicht geantwortet`}
      bund
    >
      <WebSortTabelle
        beschriftung="Offene Einladungen"
        spalten={spalten}
        zeilen={einladungen}
        zeileSchluessel={(e) => e.id}
        mittig
      />
    </WebKarte>
  );
};

export default WebOffeneEinladungen;
