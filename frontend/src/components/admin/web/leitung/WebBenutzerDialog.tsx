// Benutzer:in anlegen und bearbeiten als Dialog der Web-Fassung (Simon,
// 11.10.2026: „Web braucht eigene kompaktere Modale überall"). Dieselben
// Felder und Regeln wie das Fenster der App (modals/UserManagementModal.tsx),
// dieselbe Logik (useBenutzerFormular): Persönliche Daten, Rolle und Status,
// Jahrgänge mit den Rechten je Jahrgang. Die aktuellen Zuweisungen der App
// (wann, von wem) stehen hier unter dem jeweiligen Jahrgang.
//
// Rollen und Rechte wie in der App: Die Gemeindeleitung vergibt Gemeindeleitung,
// Leitung und Team, die Leitung nur Team; Super-Admin und Konfi nie. Die Leitung
// sieht nur ihre eigenen Jahrgänge. Die Rechte je Jahrgang setzt nur die
// Gemeindeleitung (Leitung: alle drei, Team: Challenge-Beiträge). Wer in einer
// anderen Gemeinde zuhause ist, behält Name, Benutzername und E-Mail gesperrt.
//
// Meldungen (Prüfung, Server, Laden, offline) stehen oben im Formular als
// role="alert" und rücken beim Erscheinen ins Bild -- nicht als Meldung oben:
// Die ist ein IonToast in <ion-app> und laege unter dem abgedunkelten Grund
// dieses Dialogs (Gegenprüfung 11.10.2026). Die nächste Eingabe räumt sie weg.
//
// Während des Speicherns schließt nichts den Dialog (Abbrechen, X, Escape,
// Klick daneben), wie „Schließen" in der App: Das Speichern liefe sonst
// unbemerkt weiter, und eine Ablehnung des Servers ginge ins Leere.
//
// Ungespeicherte Änderungen (isDirty aus useBenutzerFormular: Felder,
// Jahrgänge, Rechte) fragen vor dem Schließen nach -- dieselbe Frage wie die
// App, als zweites Fenster darüber wie bei Event und Badge (bis 15.10.2026
// schloss der Dialog ohne zu fragen).
//
// Geöffnet im breiten Layout von AdminUsersPage (Anlegen, Bearbeiten) und
// AdminKonfisPage (Teamer:in anlegen, festeRolle 'teamer'); unter 992 px und in
// den Apps bleibt das Fenster der App.

import React, { useEffect, useRef, useState } from 'react';
import type { JahrgangsZuweisung } from '../../../../types/user';
import { datumKurz } from '../../../../utils/dateUtils';
import { rollenName } from '../../../../utils/rollenNamen';
import { FREIGABE_RECHTE, alleRechte, rollenBeschreibung, useBenutzerFormular } from '../../useBenutzerFormular';
import WebDialog from '../../../web/WebDialog';
import WebAuswahl from '../../../web/WebAuswahl';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebMehrfachAuswahl from '../../../web/WebMehrfachAuswahl';
import WebSchalter from '../../../web/WebSchalter';

export interface WebBenutzerDialogProps {
  /** Die bearbeitete Person; null: anlegen. */
  userId: number | null;
  /** Rolle fest vorgegeben (Rollenname), z.B. 'teamer' von der Team-Seite. */
  festeRolle?: string;
  onSchliessen: () => void;
  /** Nach dem Speichern: Liste neu laden und schließen. */
  onGespeichert: () => void;
}

const titelFuer = (bearbeiten: boolean, festeRolle?: string): string => {
  if (bearbeiten) return 'Benutzer:in bearbeiten';
  return festeRolle === 'teamer' ? 'Teamer:in anlegen' : 'Benutzer:in anlegen';
};

/** Wann und von wem ein Jahrgang zugewiesen wurde (die „Aktuellen Zuweisungen" der App). */
const zuweisungWann = (z: JahrgangsZuweisung): string => [
  z.assigned_at ? `am ${datumKurz(z.assigned_at)}` : '',
  z.assigned_by_name ? `von ${z.assigned_by_name}` : '',
].filter(Boolean).join(' ');

const zuweisungText = (z?: JahrgangsZuweisung): string | undefined => (z ? ['Zugewiesen', zuweisungWann(z)].filter(Boolean).join(' ') : undefined);

const WebBenutzerDialog: React.FC<WebBenutzerDialogProps> = ({ userId, festeRolle, onSchliessen, onGespeichert }) => {
  const {
    currentUser, isOnline, isSubmitting, loading, geladen, isDirty, isEditMode, nameAutomatisch, nurRolle, formData, aendern,
    fehler, jahrgaenge, user, jahrgangAssignments, jahrgangRechte, rechteFelder, rechteVergeben, getAllowedRoles,
    handleSave, setzeRecht, handleJahrgangAssignment,
  } = useBenutzerFormular({ userId, festeRolle, onSuccess: onGespeichert, fehlerImDialog: true });
  const sperrt = isSubmitting || nurRolle;
  // Die Rückfrage „Ungespeicherte Änderungen" (zweites Fenster darüber).
  const [rueckfrage, setRueckfrage] = useState(false);
  const abbrechen = () => {
    if (isDirty) setRueckfrage(true);
    else onSchliessen();
  };
  // Das Formular steht erst da, wenn Rollen, Jahrgänge (und die Person) geladen sind.
  const laedt = loading || !geladen;

  // Der Dialog setzt den Fokus beim Öffnen -- da steht noch "wird geladen".
  // Ist das Formular da, geht er ins erste Feld, das sich bearbeiten lässt.
  const formular = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!laedt) formular.current?.querySelector<HTMLElement>('input:not([disabled])')?.focus();
  }, [laedt]);
  // Der Dialog rollt, „Anlegen“ steht unten: Eine Meldung rückt ins Bild.
  useEffect(() => {
    if (fehler) formular.current?.querySelector<HTMLElement>('[role="alert"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [fehler]);

  // Die Rollen, die dieses Konto vergeben darf (wie in der App: nie Konfi oder
  // Super-Admin, die Leitung nur Team). Eine Rolle, die nicht vergeben werden
  // darf, aber schon besteht, steht mit da -- sonst zeigte die Auswahl eine andere.
  const rollen = getAllowedRoles();
  const gewaehlteRolle = rollen.find((r) => r.id === formData.role_id);
  const rollenOptionen = [
    ...(formData.role_id > 0 ? [] : [{ wert: '0', label: 'Bitte wählen' }]),
    ...rollen.map((r) => ({ wert: String(r.id), label: rollenName(r.name) })),
    ...(formData.role_id > 0 && !gewaehlteRolle ? [{ wert: String(formData.role_id), label: rollenName(user?.role_name) }] : []),
  ];

  const zuweisungen = new Map((user?.assigned_jahrgaenge ?? []).map((z) => [z.id, z]));
  const gewaehlt = jahrgaenge.filter((j) => jahrgangAssignments[j.id]);
  // Zuweisungen, die nicht zur Wahl stehen (die Leitung sieht nur ihre eigenen Jahrgänge): Sie bleiben, wie sie sind.
  const weitere = isEditMode ? (user?.assigned_jahrgaenge ?? []).filter((z) => !jahrgaenge.some((j) => j.id === z.id)) : [];

  return (
    <>
    <WebDialog
      breit
      titel={titelFuer(isEditMode, festeRolle)}
      beschreibung={isEditMode && user ? `${user.display_name} (@${user.username})` : undefined}
      onSchliessen={abbrechen}
      onAbsenden={() => { void handleSave(); }}
      gesperrt={isSubmitting}
      aktionen={(
        <>
          <WebKnopf onClick={abbrechen} disabled={isSubmitting}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={isSubmitting || laedt || !isOnline}>
            {isEditMode ? 'Speichern' : 'Anlegen'}
          </WebKnopf>
        </>
      )}
    >
      <div className="web-formular" ref={formular}>
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
        {!isOnline && (
          <WebHinweis art="warnung">Du bist offline. Speichern geht erst wieder mit Internetverbindung.</WebHinweis>
        )}
        {laedt ? (
          <p className="web-wahl__leer" role="status">Die Angaben werden geladen.</p>
        ) : (
          <>
            {nurRolle && (
              <WebHinweis art="hinweis">
                Diese Person ist in einer anderen Gemeinde zuhause. Hier änderst du ihre Rolle, ihre
                Funktionsbeschreibung und ihre Jahrgänge bei dir und kannst sie bei dir sperren; Name,
                Benutzername und E-Mail verwaltet ihre Stamm-Gemeinde. Ein neues Passwort gilt in allen
                ihren Gemeinden.
              </WebHinweis>
            )}

            <div className="web-feldpaar">
              <WebFeld
                label="Anzeigename"
                pflicht
                wert={formData.display_name}
                onWert={(w) => aendern({ display_name: w })}
                platzhalter="Max Mustermann"
                autocomplete="name"
                deaktiviert={sperrt}
                hinweis={nameAutomatisch ? 'Der Benutzername entsteht aus dem Anzeigenamen.' : undefined}
              />
              {!nameAutomatisch && (
                <WebFeld
                  label="Benutzername"
                  pflicht
                  wert={formData.username}
                  onWert={(w) => aendern({ username: w })}
                  platzhalter="max.mustermann"
                  autocomplete="username"
                  deaktiviert={sperrt}
                />
              )}
            </div>
            <div className="web-feldpaar">
              <WebFeld
                label="Funktionsbeschreibung"
                wert={formData.role_title}
                onWert={(w) => aendern({ role_title: w })}
                platzhalter="z. B. Pastor, Diakonin, Jugendmitarbeiter"
                deaktiviert={isSubmitting}
              />
              <WebFeld
                label="E-Mail"
                typ="email"
                wert={formData.email}
                onWert={(w) => aendern({ email: w })}
                platzhalter="max@example.com"
                autocomplete="email"
                deaktiviert={sperrt}
              />
            </div>
            {/* Passwort und Rolle nebeneinander; die Rolle entfaellt beim Anlegen mit fester Rolle (wie in der App). */}
            <div className="web-feldpaar">
              <WebFeld
                label="Passwort"
                pflicht={!isEditMode}
                typ="password"
                wert={formData.password}
                onWert={(w) => aendern({ password: w })}
                autocomplete="new-password"
                deaktiviert={isSubmitting}
                hinweis={isEditMode ? 'Leer lassen, um es nicht zu ändern.' : undefined}
              />
              {!festeRolle && (
                <WebAuswahl
                  label="Rolle"
                  pflicht
                  wert={String(formData.role_id)}
                  onWert={(w) => aendern({ role_id: Number(w) })}
                  optionen={rollenOptionen}
                  deaktiviert={isSubmitting}
                  hinweis={gewaehlteRolle ? rollenBeschreibung(gewaehlteRolle.name) : undefined}
                />
              )}
            </div>
            {/* Konto aktiv nur beim Bearbeiten: Neue Konten sind aktiv (wie in der App). */}
            {isEditMode && (
              <WebSchalter
                label="Konto aktiv"
                an={formData.is_active}
                onAn={(an) => aendern({ is_active: an })}
                deaktiviert={isSubmitting}
                hinweis={nurRolle ? 'Gilt nur für diese Gemeinde' : 'Benutzer kann sich anmelden'}
              />
            )}

            <h3 className="web-gruppe">Jahrgänge</h3>
            <WebMehrfachAuswahl
              label="Zugewiesene Jahrgänge"
              eintraege={jahrgaenge.map((j) => ({ wert: String(j.id), titel: j.name, beschreibung: zuweisungText(zuweisungen.get(j.id)) }))}
              werte={gewaehlt.map((j) => String(j.id))}
              onWerte={(werte) => {
                for (const j of jahrgaenge) {
                  const an = werte.includes(String(j.id));
                  if (an !== !!jahrgangAssignments[j.id]) handleJahrgangAssignment(j.id, an);
                }
              }}
              // Fuer eine Leitung ohne eigene Jahrgaenge waere "keine verfuegbar"
              // irrefuehrend -- es gibt welche, sie darf sie nur nicht vergeben.
              leerText={currentUser?.role_name === 'admin'
                ? 'Dir ist kein Jahrgang zugewiesen. Zuweisen kann nur die Gemeindeleitung.'
                : 'Keine Jahrgänge verfügbar'}
              hinweis={rechteVergeben && jahrgaenge.length > 0
                ? 'Wer ein Recht nicht hat, sieht die Vorgänge weiter, kann sie aber nicht entscheiden. Die Gemeindeleitung hat alle Rechte immer.'
                : undefined}
              deaktiviert={isSubmitting}
            />
            {weitere.length > 0 && (
              <p className="web-wahl__leer">
                Außerdem zugewiesen: {weitere.map((z) => (zuweisungWann(z) ? `${z.name} (${zuweisungWann(z)})` : z.name)).join(', ')}
              </p>
            )}
            {rechteVergeben && gewaehlt.map((j) => {
              const rechte = alleRechte(jahrgangRechte[j.id]);
              return (
                <fieldset key={j.id} className="web-wahl" disabled={isSubmitting}>
                  <legend className="web-feld__label web-wahl__legende">Rechte für {j.name}</legend>
                  <div className="web-feldpaar">
                    {FREIGABE_RECHTE.filter(({ feld }) => rechteFelder.includes(feld)).map(({ feld, text }) => (
                      <WebSchalter key={feld} label={text} an={rechte[feld]} onAn={(an) => setzeRecht(j.id, feld, an)} />
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </>
        )}
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

export default WebBenutzerDialog;
