// „Neuer Chat" als Dialog der Web-Fassung (Simon, 15.10.2026, Seite 3 des
// Seiten-Interviews: „neuer chat modal ist noch app"). Geöffnet im Chat des
// Browsers ab 992 px (WebChat: „Neuer Chat" über der Liste und im leeren
// rechten Teil); unter 992 px und in den Apps bleibt das Modal der App
// (modals/SimpleCreateChatModal.tsx).
//
// Dieselbe Logik wie in der App (useNeuerChat): dieselben wählbaren Personen
// (Konfis nur Direktnachrichten an ihr Team, das Team Direktnachricht oder
// Gruppenchat; Teamer:innen erreichen nur die Konfis ihrer Jahrgänge), dieselbe
// Suche und dieselben Filter, dieselbe Prüfung mit denselben Texten, dieselben
// Rümpfe an dieselben Routen (POST /chat/direct, POST /chat/rooms). Wie in der
// App startet ein Klick auf eine Person die Direktnachricht sofort; der
// Gruppenchat entsteht über „Gruppenchat erstellen".
//
// Anders als in der App ist „Gruppenchat erstellen" anklickbar, solange nichts
// gesendet wird: Fehlt der Name oder eine Person, sagt es der Dialog in sich
// selbst, wie die übrigen Dialoge der Web-Fassung. Meldungen (Laden, Prüfung,
// Server, offline) stehen oben im Dialog; die nächste Eingabe räumt sie weg.
// Während des Sendens schließt nichts den Dialog (Abbrechen, X, Escape, Klick
// daneben). Schließen mit Gruppenname oder gewählten Personen fragt nach
// („Ungespeicherte Änderungen"), wie in der App.

import React, { useEffect, useRef, useState } from 'react';
import type { ChatUser } from '../../../types/user';
import { istTeamTyp } from '../../../utils/chatRoles';
import { initialen } from '../../../utils/konfiListe';
import { rollenDarstellung, rollenName } from '../../../utils/rollenNamen';
import { personKennung, personName, useNeuerChat, type NeuerChatArt } from '../useNeuerChat';
import WebDialog from '../../web/WebDialog';
import WebFeld from '../../web/WebFeld';
import WebFilterAuswahl from '../../web/WebFilterAuswahl';
import WebHinweis from '../../web/WebHinweis';
import WebKnopf from '../../web/WebKnopf';
import WebKreis from '../../web/WebKreis';
import WebSuche from '../../web/WebSuche';
import '../../../theme/web/chat.css';

export interface WebNeuerChatDialogProps {
  /** Der Chat ist angelegt (oder bestand schon): der Raum, den der Server nennt. */
  onAngelegt: (roomId?: number) => void;
  onSchliessen: () => void;
}

const ARTEN: ReadonlyArray<{ wert: NeuerChatArt; label: string }> = [
  { wert: 'direct', label: 'Direktnachricht' },
  { wert: 'group', label: 'Gruppenchat' },
];

const ROLLEN = [
  { wert: 'alle', label: 'Alle' },
  { wert: 'konfi', label: 'Konfis' },
  { wert: 'admin', label: 'Team' },
];

/** Die zweite Zeile einer Person: im Team die Funktion, bei Konfis der Jahrgang -- wie Eck-Marke und Zeile der App. */
const personZeile = (person: ChatUser): string => {
  if (istTeamTyp(person.type)) return person.role_description || rollenName(person.role_name, 'Team');
  const jahrgang = person.jahrgang_name || person.jahrgang;
  return jahrgang ? `Konfi · ${jahrgang}` : 'Konfi';
};

/** Kreis in der Farbe der Rolle (dieselbe Stelle wie in der App: rollenDarstellung). */
const PersonKreis: React.FC<{ person: ChatUser }> = ({ person }) => (
  <WebKreis
    text={initialen(personName(person)) || '??'}
    ton={rollenDarstellung(istTeamTyp(person.type) ? person : 'konfi').farbe}
  />
);

const WebNeuerChatDialog: React.FC<WebNeuerChatDialogProps> = ({ onAngelegt, onSchliessen }) => {
  const {
    isOnline, isAdmin, isTeamer, chatType, setChatType, isDirty, filteredUsers, loading, creating,
    searchText, setSearchText, selectedRole, setSelectedRole, selectedJahrgang, setSelectedJahrgang,
    availableJahrgaenge, groupName, setGroupName, selectedParticipants, handleParticipantToggle,
    createDirectMessage, createGroupChat, fehler, fehlerLeeren,
  } = useNeuerChat({ onAngelegt, fehlerImDialog: true });
  const [rueckfrage, setRueckfrage] = useState(false);
  const formular = useRef<HTMLDivElement>(null);
  const team = isAdmin || isTeamer;
  const gruppe = chatType === 'group';

  // Der Dialog rollt: Eine Meldung rückt ins Bild.
  useEffect(() => {
    if (fehler) formular.current?.querySelector<HTMLElement>('[role="alert"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [fehler]);

  /** Jede Eingabe räumt eine alte Meldung weg. */
  const aendern = (setzen: () => void) => {
    fehlerLeeren();
    setzen();
  };

  // Schließen mit Gruppenname oder gewählten Personen fragt nach -- dieselbe
  // Frage wie das Modal der App, als kleiner Dialog über diesem.
  const abbrechen = () => {
    if (creating) return;
    if (isDirty) setRueckfrage(true);
    else onSchliessen();
  };

  const titel = gruppe ? 'Neuer Gruppenchat' : 'Neue Direktnachricht';
  const anzahl = `Personen (${filteredUsers.length})`;

  const personen = () => {
    if (loading) return <p className="web-wahl__leer" role="status">Die Personen werden geladen.</p>;
    if (filteredUsers.length === 0) return <p className="web-wahl__leer" role="status">Keine Personen gefunden</p>;
    if (gruppe) {
      return (
        <div className="web-wahl__liste">
          {filteredUsers.map((person) => {
            const kennung = personKennung(person);
            const gewaehlt = selectedParticipants.has(kennung);
            return (
              <label key={kennung} className={`web-wahl__zeile web-neuer-chat__zeile${gewaehlt ? ' web-wahl__zeile--gewaehlt' : ''}`}>
                <input
                  type="checkbox"
                  className="web-wahl__haken"
                  aria-label={`${personName(person)}, ${personZeile(person)}`}
                  checked={gewaehlt}
                  onChange={() => aendern(() => handleParticipantToggle(kennung))}
                />
                <PersonKreis person={person} />
                <span className="web-wahl__text">
                  <span className="web-wahl__titel">{personName(person)}</span>
                  <span className="web-wahl__beschreibung">{personZeile(person)}</span>
                </span>
              </label>
            );
          })}
        </div>
      );
    }
    // Direktnachricht: Ein Klick auf die Person startet sie, wie in der App.
    return (
      <div className="web-wahl__liste">
        {filteredUsers.map((person) => (
          <button
            key={personKennung(person)}
            type="button"
            className="web-wahl__zeile web-neuer-chat__zeile web-neuer-chat__person"
            aria-label={`${personName(person)}, ${personZeile(person)}`}
            disabled={creating}
            onClick={() => { fehlerLeeren(); void createDirectMessage(person); }}
          >
            <PersonKreis person={person} />
            <span className="web-wahl__text">
              <span className="web-wahl__titel">{personName(person)}</span>
              <span className="web-wahl__beschreibung">{personZeile(person)}</span>
            </span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <>
      <WebDialog
        titel={titel}
        beschreibung={gruppe
          ? 'Gib der Gruppe einen Namen und wähle die Personen.'
          : 'Ein Klick auf eine Person startet die Direktnachricht.'}
        onSchliessen={abbrechen}
        gesperrt={creating}
        aktionen={(
          <>
            <WebKnopf onClick={abbrechen} disabled={creating}>Abbrechen</WebKnopf>
            {gruppe && (
              <WebKnopf art="primaer" onClick={() => { fehlerLeeren(); void createGroupChat(); }} disabled={creating || !isOnline}>
                Gruppenchat erstellen
              </WebKnopf>
            )}
          </>
        )}
      >
        <div className="web-formular" ref={formular}>
          {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
          {!isOnline && (
            <WebHinweis art="warnung">Du bist offline. Einen Chat anlegen geht erst wieder mit Internetverbindung.</WebHinweis>
          )}

          {/* Direktnachricht oder Gruppenchat -- nur fürs Team, wie das Segment der App. */}
          {team && (
            <div>
              <div className="web-ansicht-umschalter" role="group" aria-label="Art des Chats">
                {ARTEN.map((art) => (
                  <button
                    key={art.wert}
                    type="button"
                    className="web-ansicht-umschalter__knopf"
                    aria-pressed={chatType === art.wert}
                    disabled={creating}
                    onClick={() => aendern(() => setChatType(art.wert))}
                  >
                    {art.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {gruppe && (
            <WebFeld
              label="Gruppenname"
              pflicht
              wert={groupName}
              onWert={(w) => aendern(() => setGroupName(w))}
              platzhalter="Gruppenname eingeben"
              deaktiviert={creating}
            />
          )}

          <div className="web-werkzeuge">
            <WebSuche beschriftung="Person suchen" platzhalter="Person suchen..." wert={searchText} onWert={setSearchText} />
            {team && (
              <WebFilterAuswahl label="Nach Rolle filtern" wert={selectedRole} onWert={setSelectedRole} optionen={ROLLEN} />
            )}
            {team && availableJahrgaenge.length > 0 && (
              <WebFilterAuswahl
                label="Nach Jahrgang filtern"
                wert={selectedJahrgang}
                onWert={setSelectedJahrgang}
                optionen={[{ wert: 'alle', label: 'Alle Jahrgänge' }, ...availableJahrgaenge.map((jg) => ({ wert: jg, label: jg }))]}
              />
            )}
          </div>

          <fieldset className="web-wahl" disabled={creating}>
            <legend className="web-feld__label web-wahl__legende">{anzahl}</legend>
            {personen()}
            {gruppe && selectedParticipants.size > 0 && (
              <p className="web-wahl__zahl" role="status">{selectedParticipants.size} ausgewählt</p>
            )}
          </fieldset>
        </div>
      </WebDialog>
      {rueckfrage && (
        <WebDialog
          titel="Ungespeicherte Änderungen"
          beschreibung="Möchtest du die Änderungen verwerfen?"
          rueckfrage="warnung"
          onSchliessen={() => setRueckfrage(false)}
          aktionen={(
            <>
              <WebKnopf onClick={() => setRueckfrage(false)}>Abbrechen</WebKnopf>
              <WebKnopf art="gefahr" onClick={onSchliessen}>Verwerfen</WebKnopf>
            </>
          )}
        >
          {null}
        </WebDialog>
      )}
    </>
  );
};

export default WebNeuerChatDialog;
