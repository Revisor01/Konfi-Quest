import React from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { datumKurz } from '../../utils/dateUtils';
import { rollenName, rollenDarstellung } from '../../utils/rollenNamen';
import { ListSection } from '../shared';
import {
  ICON_AT_ZEICHEN,
  ICON_MAIL_GEFUELLT,
  ICON_PERSON_GEFUELLT,
  ICON_PERSON_HINZUFUEGEN,
  ICON_RUECKGAENGIG,
  ICON_SCHILD_GEFUELLT,
  ICON_SENDEN_GEFUELLT,
  ICON_WARTEND_GEFUELLT,
} from '../shared/icons';
import { useOffeneEinladungen } from './useOffeneEinladungen';

// Laden, Zurueckziehen und die Antwortform stehen in useOffeneEinladungen.ts --
// dieselbe Logik traegt die Web-Fassung (web/leitung/WebOffeneEinladungen.tsx).
export type { OffeneEinladungDerGemeinde } from './useOffeneEinladungen';

/**
 * Offene Einladungen der Gemeinde -- einsehen und zurueckziehen (Simon,
 * 27.09.2026).
 *
 * Die Einladung einer Person mit Konto (EinladungModal) liess sich laut
 * Handbuch und Changelog zurueckziehen; Server-Routen gab es seit dem
 * 26.09.2026 (GET und DELETE /einladungen), in der App aber keine Stelle
 * dafuer. Dieser Abschnitt steht unter der Benutzerliste.
 *
 * NUR FUER ORG-ADMINS: Einladen, die Liste sehen und zurueckziehen verlangt
 * serverseitig requireOrgAdmin -- die Seite bindet den Abschnitt deshalb nur
 * bei role_name 'org_admin' ein, derselben Bedingung wie beim Einladen-Knopf.
 * Fuer alle anderen wird GET /einladungen gar nicht erst gerufen (es gaebe
 * nur 403).
 *
 * Blendet sich aus, wenn nichts offen ist -- wie die Einladungs-Karte im
 * Profil der eingeladenen Person (shared/EinladungenKarte.tsx). Nach der
 * Zusage steht die Person ohnehin in der Liste darueber.
 */

interface Props {
  /**
   * Zaehlt hoch, wenn die Liste neu geladen werden soll: nach einer neuen
   * Einladung, beim Live-Signal 'users' (etwa nach einer Zusage) und beim
   * Ziehen zum Aktualisieren.
   */
  aktualisierung: number;
}

// Dieselben Rollenfarben und -woerter wie in der Benutzerliste (UsersView),
// beide aus utils/rollenNamen. Das Wort nach role_name: role_display_name
// traegt in bestehenden Gemeinden noch die alten Namen aus der Datenbank.

const OffeneEinladungen: React.FC<Props> = ({ aktualisierung }) => {
  const { einladungen, laeuft, zurueckziehen } = useOffeneEinladungen(aktualisierung);

  if (einladungen.length === 0) return null;

  return (
    <ListSection
      icon={ICON_PERSON_HINZUFUEGEN}
      title="Offene Einladungen"
      count={einladungen.length}
      iconColorClass="users"
    >
      {einladungen.map((einladung, index) => {
        // Strich, Kreis und Rollen-Symbol aus EINER Stelle wie in jeder
        // Personenliste (utils/rollenNamen: rollenDarstellung, 02.10.2026).
        const darstellung = rollenDarstellung(einladung.role_name);
        const rolle = rollenName(einladung.role_name, einladung.role_display_name ?? undefined);
        return (
          <div
            key={einladung.id}
            className={`app-list-item ${darstellung.strich}`}
            style={{
              marginBottom: index < einladungen.length - 1 ? 'var(--app-abstand-eng)' : '0'
            }}
          >
            <div className="app-list-item__row">
              <div className="app-list-item__main">
                <div className={`app-icon-circle app-icon-circle--lg ${darstellung.kreis}`}>
                  <IonIcon icon={ICON_MAIL_GEFUELLT} aria-hidden="true" />
                </div>
                <div className="app-list-item__content">
                  <div className="app-list-item__title">{einladung.display_name}</div>
                  <div className="app-list-item__meta">
                    <span className="app-list-item__meta-item">
                      <IonIcon icon={ICON_AT_ZEICHEN} className="app-icon-color--jahrgang" aria-hidden="true" />
                      {einladung.username}
                    </span>
                    <span className="app-list-item__meta-item">
                      <IonIcon
                        icon={einladung.role_name === 'teamer' ? ICON_PERSON_GEFUELLT : ICON_SCHILD_GEFUELLT}
                        className={darstellung.schrift}
                        aria-hidden="true"
                      />
                      als {rolle}
                    </span>
                  </div>
                  <div className="app-list-item__meta">
                    <span className="app-list-item__meta-item">
                      <IonIcon icon={ICON_SENDEN_GEFUELLT} className="app-icon-color--time" aria-hidden="true" />
                      eingeladen am {datumKurz(einladung.created_at)}
                    </span>
                    <span className="app-list-item__meta-item">
                      <IonIcon icon={ICON_WARTEND_GEFUELLT} className="app-icon-color--warning" aria-hidden="true" />
                      gültig bis {datumKurz(einladung.expires_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', marginTop: 'var(--app-abstand-mittel)' }}>
              <IonButton
                size="small"
                fill="outline"
                color="danger"
                expand="block"
                style={{ flex: 1 }}
                aria-label={`Einladung an ${einladung.display_name} zurückziehen`}
                disabled={laeuft === einladung.id}
                onClick={() => zurueckziehen(einladung)}
              >
                <IonIcon icon={ICON_RUECKGAENGIG} slot="start" aria-hidden="true" />
                Zurückziehen
              </IonButton>
            </div>
          </div>
        );
      })}
    </ListSection>
  );
};

export default OffeneEinladungen;
