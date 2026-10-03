// Der Schriftwechsel einer Gemeinde in der Web-Fassung der Support-Ansicht,
// /admin/support/post/gemeinde/:id (docs/planung/support-web.md, Phase 2).
//
// Links alle Mails der Gemeinde (aelteste zuerst, Zitate eingeklappt) und der
// Antwort-Editor von support@ mit der Empfaengerauswahl wie in der App
// (Gemeindeleitungen und Leitung mit Adresse, Absender aus dem Verlauf).
// Rechts die Gemeinde: Status, Laufzeit, Konfis und Limit und die
// Gemeindeleitung (Name, Benutzername, E-Mail, zuletzt angemeldet) -- mit dem
// Link "Bearbeiten", der das Formular "Gemeinde" gleich im Bearbeiten-Modus
// oeffnet.
//
// Name und Angaben der Gemeinde kommen aus GET /organizations/:id (auch eine
// interne Gemeinde, die in der Liste fehlt); die Leitung aus GET
// /support/gemeinden, falls die Gemeinde dort steht -- sonst steht die Karte
// ohne Leitung da. Die Logik fuer Verlauf und Empfaenger ist dieselbe wie in der
// App: components/support/useGemeindePost.ts.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_BEARBEITEN, ICON_ORGANISATION } from '../../shared/icons';
import api from '../../../services/api';
import type { MailAntwortDaten } from '../../../types/support';
import { lizenzFinden, lizenzText } from '../../../utils/lizenzen';
import { POSTFACH_INFO } from '../../../utils/supportMail';
import { zeitpunktText } from '../../../utils/postfach';
import { mitEinheit } from '../../../utils/supportStatistik';
import { gemeindenLesen, laufzeitAngabe, limitAnteil, type SupportGemeinde } from '../../../utils/supportWeb';
import { useGemeindePost } from '../useGemeindePost';
import WebSeite from './WebSeite';
import WebSpalten from './WebSpalten';
import WebKarte from './WebKarte';
import WebKnopf from './WebKnopf';
import WebPill from './WebPill';
import WebAngaben from './WebAngaben';
import WebAntwortEditor from './WebAntwortEditor';
import { WebMailVerlauf } from './WebMailVerlauf';
import { WebFehler, WebLeer } from './WebZustaende';
import { useWebDaten } from './useWebDaten';

const ZURUECK = { href: '/admin/support/post', text: 'Posteingang' };

async function ladeGemeinden(): Promise<SupportGemeinde[]> {
  const antwort = await api.get('/support/gemeinden');
  const liste = gemeindenLesen(antwort.data);
  if (!liste) throw new Error('Die Gemeinden kamen in einer unbekannten Form');
  return liste;
}

const WebGemeindePost: React.FC<{ organizationId: number }> = ({ organizationId }) => {
  const { gemeinde, name, verlauf, verlaufFehler, neu, empfaenger, empfaengerFehlt, letzte, betreffVorschlag, verlaufHolen } = useGemeindePost(organizationId);
  // Die Leitung steht nur in der Liste der Gemeinden; fehlt die Gemeinde dort, bleibt die Karte ohne Leitung.
  const { daten: liste, fehler: listeFehlt } = useWebDaten(ladeGemeinden);
  const ausListe = liste?.find((g) => g.id === organizationId) ?? null;

  const wunsch = lizenzFinden(gemeinde?.wunsch_lizenz ?? ausListe?.wunsch_lizenz ?? null);
  const laufzeit = gemeinde ? laufzeitAngabe(gemeinde) : null;
  const anteil = gemeinde ? limitAnteil(gemeinde) : null;
  const kirchenkreis = ausListe?.kirchenkreis ?? null;
  const landeskirche = ausListe?.landeskirche ?? null;

  const haupt = (
    <>
      <WebKarte titel="Schriftwechsel" untertitel={verlauf ? `${verlauf.length} ${verlauf.length === 1 ? 'Mail' : 'Mails'} über ${POSTFACH_INFO.support.kurz}` : undefined}>
        {verlaufFehler ? (
          <WebFehler text="Der Schriftwechsel konnte nicht geladen werden." onErneut={() => { void verlaufHolen(true); }} />
        ) : verlauf ? (
          <WebMailVerlauf mails={verlauf} neu={neu} leer="Noch keine Mails mit dieser Gemeinde." />
        ) : (
          <p className="web-gedaempft" role="status">Verlauf wird geladen...</p>
        )}
      </WebKarte>

      <WebKarte titel={letzte ? 'Antworten' : 'Schreiben'} untertitel={`Von ${POSTFACH_INFO.support.kurz} an die Gemeinde`}>
        <WebAntwortEditor
          postfach="support"
          platzhalterFuer={{ organization_id: organizationId }}
          betreffVorschlag={betreffVorschlag}
          empfaenger={empfaenger}
          empfaengerFehlt={empfaengerFehlt}
          senden={(koerper: MailAntwortDaten) => api.post(`/support/gemeinden/${organizationId}/antworten`, koerper)}
          onGesendet={() => { void verlaufHolen(false); }}
        />
      </WebKarte>
    </>
  );

  const seite = (
    <>
      <WebKarte
        titel="Gemeinde"
        aktion={<WebKnopf klein href={`/admin/organizations?gemeinde=${organizationId}&bearbeiten=1`}>
          <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
          Bearbeiten
        </WebKnopf>}
      >
        {gemeinde ? (
          <WebAngaben
            beschriftung="Angaben zur Gemeinde"
            angaben={[
              { label: 'Name', wert: name },
              { label: 'Status', wert: <WebPill ton={gemeinde.is_active ? 'erfolg' : 'neutral'} punkt>{gemeinde.is_active ? 'Aktiv' : 'Gesperrt'}</WebPill> },
              { label: 'Laufzeit', wert: laufzeit ? <WebPill ton={laufzeit.ton} title={laufzeit.titel}>{laufzeit.text}</WebPill> : null },
              {
                label: 'Konfis',
                wert: gemeinde.max_konfis !== null && gemeinde.max_konfis > 0
                  ? <span>{mitEinheit(gemeinde.konfi_count, 'Konfi', 'Konfis')} von {gemeinde.max_konfis}{anteil !== null && anteil >= 1 ? ' — Limit erreicht' : ''}</span>
                  : <span>{mitEinheit(gemeinde.konfi_count, 'Konfi', 'Konfis')} · ohne Limit</span>,
              },
              { label: 'Team', wert: String(gemeinde.team_count) },
              { label: 'Wunschlizenz', wert: wunsch ? lizenzText(wunsch) : null },
              { label: 'Kirchenkreis', wert: kirchenkreis },
              { label: 'Landeskirche', wert: landeskirche },
            ]}
          />
        ) : (
          <p className="web-gedaempft" role="status">Die Angaben zur Gemeinde konnten nicht geladen werden.</p>
        )}
      </WebKarte>

      <WebKarte titel="Gemeindeleitung">
        {ausListe && ausListe.leitung.length > 0 ? (
          <div className="web-personen">
            {ausListe.leitung.map((l) => (
              <div key={l.id} className="web-person">
                <div className="web-person__kopf">
                  <span className="web-person__name">{l.display_name}</span>
                  {!l.is_active && <WebPill ton="fehler">gesperrt</WebPill>}
                </div>
                <div className="web-person__zeile">
                  <span>@{l.username}</span>
                  {l.email && <a className="web-link" href={`mailto:${l.email}`}>{l.email}</a>}
                  <span>{l.last_login_at ? `zuletzt angemeldet ${zeitpunktText(l.last_login_at)}` : 'noch nie angemeldet'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="web-gedaempft" role="status">
            {ausListe
              ? 'Für diese Gemeinde ist keine Gemeindeleitung hinterlegt.'
              : liste
                ? 'Diese Gemeinde steht nicht in der Liste der Gemeinden; ihre Leitung lässt sich hier nicht anzeigen.'
                : listeFehlt ? 'Die Gemeindeleitung konnte nicht geladen werden.' : 'Die Gemeindeleitung wird geladen...'}
          </p>
        )}
      </WebKarte>
    </>
  );

  return (
    <WebSeite
      bereich="Support"
      titel={name}
      untertitel={`Schriftwechsel über ${POSTFACH_INFO.support.kurz}`}
      zurueck={ZURUECK}
    >
      <WebSpalten haupt={haupt} seite={seite} seiteBeschriftung="Angaben zur Gemeinde" />
    </WebSeite>
  );
};

/** Keine gueltige Kennung in der Adresse (/admin/support/post/gemeinde/abc): Hinweis statt Abruf. */
export const WebKeineGemeinde: React.FC = () => (
  <WebSeite bereich="Support" titel="Schriftwechsel" zurueck={ZURUECK}>
    <WebLeer icon={ICON_ORGANISATION} titel="Gemeinde nicht gefunden" text="Diese Adresse nennt keine Gemeinde." />
  </WebSeite>
);

export default WebGemeindePost;
