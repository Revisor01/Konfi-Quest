// „Mitglieder" eines Chats als Dialog der Web-Fassung (Simon, 15.10.2026,
// Seiten-Interview Seite 3: „mitglieder modal ist noch app design").
// Geöffnet vom Knopf „Mitglieder anzeigen" im Kopf des Raums (WebChatRaum,
// nur im breiten Layout ab 992 px); in den Apps und im schmalen Fenster
// bleibt das Modal der App (modals/MembersModal.tsx).
//
// Dieselbe Logik wie in der App (useChatMitglieder): dieselbe Liste in
// derselben Reihenfolge (Team zuerst, dann nach Namen), dieselben Personen
// zur Auswahl (Konfis der eigenen Jahrgänge, dazu Leitung und Team), dieselben
// Rechte -- verwalten nur die Leitung und nur in Gruppen; in Jahrgangs- und
// Team-Chats ergeben sich die Mitglieder von selbst, dort ist die Liste nur
// zum Ansehen. Dieselben Wege zum Server, dieselbe Rückfrage vor dem
// Entfernen (hier als Rückfrage-Fenster statt ion-alert), und danach wie in
// der App: Das Fenster schließt, der Raum lädt seinen Verlauf neu.
//
// Fehler (Laden, Hinzufügen, Entfernen, offline) stehen im Fenster.

import React, { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_LOESCHEN, ICON_PERSON_HINZUFUEGEN } from '../../shared/icons';
import type { ChatUser } from '../../../types/user';
import { initialen } from '../../../utils/konfiListe';
import { rollenDarstellung } from '../../../utils/rollenNamen';
import {
  MITGLIED_ENTFERNEN_TITEL,
  anzeigeName,
  istTeamPerson,
  jahrgangVon,
  mitgliedEntfernenFrage,
  personKennung,
  rollenText,
  useChatMitglieder,
  type ChatTeilnehmer,
} from '../useChatMitglieder';
import WebDialog from '../../web/WebDialog';
import WebHinweis from '../../web/WebHinweis';
import WebKnopf from '../../web/WebKnopf';
import WebKreis from '../../web/WebKreis';
import WebSuche from '../../web/WebSuche';
import '../../../theme/web/chat.css';

export interface WebMitgliederDialogProps {
  roomId: number;
  roomType: string;
  /** Jemand kam dazu oder wurde entfernt: Der Raum lädt seinen Verlauf neu. */
  onGeaendert: () => void;
  onSchliessen: () => void;
}

/** Kreis in der Farbe der Rolle (wie Strich und Kreis in der App), dazu die Zeile darunter. */
const darstellung = (person: ChatUser | ChatTeilnehmer) => {
  const team = istTeamPerson(person);
  const name = anzeigeName(person);
  const jahrgang = jahrgangVon(person);
  return {
    name,
    ton: rollenDarstellung(team ? person : 'konfi').farbe,
    // Team: Rolle bzw. Funktion; Konfi: „Konfi" und der Jahrgang. Die Farbe trägt nie allein.
    unterzeile: team ? rollenText(person) : ['Konfi', jahrgang].filter(Boolean).join(' · '),
  };
};

const WebMitgliederDialog: React.FC<WebMitgliederDialogProps> = ({ roomId, roomType, onGeaendert, onSchliessen }) => {
  const [meldung, setMeldung] = useState<string | null>(null);
  const [rueckfrage, setRueckfrage] = useState<ChatTeilnehmer | null>(null);
  const [entfernt, setEntfernt] = useState(false);
  const {
    isOnline, sortedParticipants, loading, adding, showAddMode, setShowAddMode,
    searchText, setSearchText, selectedUsers, canManageMembers, filteredAvailableUsers,
    handleUserToggle, addSelectedUsers, entfernenOfflineBlockiert, mitgliedEntfernen, zuruecksetzen,
  } = useChatMitglieder({ roomId, roomType, meldeFehler: setMeldung });

  // Eine Meldung soll nie unter der Knopfleiste liegen.
  const inhalt = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (meldung) inhalt.current?.querySelector<HTMLElement>('.web-hinweis')?.scrollIntoView?.({ block: 'nearest' });
  }, [meldung]);

  const schliessen = () => {
    zuruecksetzen();
    onSchliessen();
  };

  /** Wie onSuccess der App: Fenster zu, Verlauf neu. */
  const fertig = () => {
    onGeaendert();
    onSchliessen();
  };

  const hinzufuegenModus = (an: boolean) => {
    setMeldung(null);
    if (an) setShowAddMode(true);
    else zuruecksetzen();
  };

  const hinzufuegen = async () => {
    if (adding || !isOnline) return;
    setMeldung(null);
    if (await addSelectedUsers()) fertig();
  };

  const entfernenFragen = (person: ChatTeilnehmer) => {
    setMeldung(null);
    if (entfernenOfflineBlockiert()) return;
    setRueckfrage(person);
  };

  const entfernen = async () => {
    if (!rueckfrage || entfernt) return;
    setEntfernt(true);
    const geklappt = await mitgliedEntfernen(rueckfrage);
    setEntfernt(false);
    setRueckfrage(null);
    if (geklappt) fertig();
  };

  const offlineHinweis = !isOnline && canManageMembers && (
    <WebHinweis art="warnung">Du bist offline. Hinzufügen und Entfernen gehen erst wieder mit Internetverbindung.</WebHinweis>
  );

  const liste = () => {
    if (loading) return <p className="web-gedaempft" role="status">Mitglieder werden geladen …</p>;
    const zahl = sortedParticipants.length;
    if (zahl === 0) return <p className="web-gedaempft" role="status">Keine Mitglieder</p>;
    return (
      <>
        <h3 className="web-gruppe">Mitglieder ({zahl})</h3>
        <ul className="web-chat-mitglieder" aria-label={`Mitglieder (${zahl})`}>
          {sortedParticipants.map((p) => {
            const { name, ton, unterzeile } = darstellung(p);
            return (
              <li key={`${p.user_type}-${p.user_id}`} className="web-chat-mitglied">
                <WebKreis text={initialen(name) || '??'} ton={ton} />
                <span className="web-chat-mitglied__text">
                  <span className="web-chat-mitglied__name">{name}</span>
                  {unterzeile && <span className="web-chat-mitglied__zeile">{unterzeile}</span>}
                </span>
                {canManageMembers && (
                  <WebKnopf
                    art="text"
                    klein
                    symbol
                    aria-label={`${name} entfernen`}
                    title={MITGLIED_ENTFERNEN_TITEL}
                    onClick={() => entfernenFragen(p)}
                  >
                    <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
                  </WebKnopf>
                )}
              </li>
            );
          })}
        </ul>
      </>
    );
  };

  const auswahl = () => {
    const zahl = filteredAvailableUsers.length;
    return (
      <>
        <WebSuche beschriftung="Person suchen" platzhalter="Person suchen..." wert={searchText} onWert={setSearchText} />
        <fieldset className="web-wahl" disabled={adding}>
          <legend className="web-feld__label web-wahl__legende">Verfügbare Personen ({zahl})</legend>
          {zahl === 0 ? (
            <p className="web-wahl__leer" role="status">Keine verfügbaren Personen gefunden</p>
          ) : (
            <div className="web-wahl__liste web-chat-personen">
              {filteredAvailableUsers.map((u) => {
                const kennung = personKennung(u);
                const an = selectedUsers.has(kennung);
                const { name, ton, unterzeile } = darstellung(u);
                return (
                  <label key={kennung} className={`web-wahl__zeile web-chat-person${an ? ' web-wahl__zeile--gewaehlt' : ''}`}>
                    <input type="checkbox" className="web-wahl__haken" checked={an} onChange={() => handleUserToggle(u)} />
                    <WebKreis text={initialen(name) || '??'} ton={ton} />
                    <span className="web-wahl__text">
                      <span className="web-wahl__titel">{name}</span>
                      {unterzeile && <span className="web-wahl__beschreibung">{unterzeile}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
      </>
    );
  };

  return (
    <>
      <WebDialog
        titel={showAddMode ? 'Mitglied hinzufügen' : 'Mitglieder'}
        onSchliessen={schliessen}
        gesperrt={adding}
        aktionen={showAddMode ? (
          <>
            <WebKnopf onClick={() => hinzufuegenModus(false)} disabled={adding}>Zurück</WebKnopf>
            <WebKnopf art="primaer" onClick={() => { void hinzufuegen(); }} disabled={selectedUsers.size === 0 || adding || !isOnline}>
              {adding ? 'Wird hinzugefügt …' : selectedUsers.size > 0 ? `Hinzufügen (${selectedUsers.size})` : 'Hinzufügen'}
            </WebKnopf>
          </>
        ) : (
          <>
            {canManageMembers && (
              <WebKnopf onClick={() => hinzufuegenModus(true)}>
                <IonIcon icon={ICON_PERSON_HINZUFUEGEN} aria-hidden="true" />
                Mitglieder hinzufügen
              </WebKnopf>
            )}
            <WebKnopf art="primaer" onClick={schliessen}>Schließen</WebKnopf>
          </>
        )}
      >
        <div className="web-formular" ref={inhalt}>
          {meldung && <WebHinweis art="fehler" rolle="alert">{meldung}</WebHinweis>}
          {offlineHinweis}
          {showAddMode ? auswahl() : liste()}
        </div>
      </WebDialog>
      {rueckfrage && (
        <WebDialog
          titel={MITGLIED_ENTFERNEN_TITEL}
          beschreibung={mitgliedEntfernenFrage(rueckfrage.name)}
          rueckfrage="loeschen"
          gesperrt={entfernt}
          onSchliessen={() => setRueckfrage(null)}
          aktionen={(
            <>
              <WebKnopf onClick={() => setRueckfrage(null)} disabled={entfernt}>Abbrechen</WebKnopf>
              <WebKnopf art="gefahr" onClick={() => { void entfernen(); }} disabled={entfernt}>Entfernen</WebKnopf>
            </>
          )}
        >
          {null}
        </WebDialog>
      )}
    </>
  );
};

export default WebMitgliederDialog;
