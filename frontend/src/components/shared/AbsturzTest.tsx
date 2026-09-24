import React, { useCallback } from 'react';
import { IonIcon, useIonAlert } from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
import { ICON_WARNUNG_GEFUELLT } from './icons';
import { useApp } from '../../contexts/AppContext';

/**
 * Loest absichtlich einen Absturz aus — um zu pruefen, dass die
 * Absturzdiagnose wirklich meldet.
 *
 * WARUM ES DAS GIBT (24.09.2026):
 *
 * Auf Android meldet sich eine App bei Crashlytics schon beim BAUEN, weil das
 * Gradle-Plugin die Mapping-Datei hochlaedt. Auf iOS gibt es dieses
 * Gegenstueck nicht: Dort sieht Firebase die App erst, wenn das SDK einen
 * Absturzbericht sendet. Ein reiner App-Start genuegt NICHT — die
 * Firebase-Doku sagt dazu woertlich: "To finish setting up Crashlytics and see
 * initial data in the Crashlytics dashboard of the Firebase console, you need
 * to force a test crash."
 *
 * Konkret passiert: Build 213 lief auf einem iPhone, der Push-Token wurde
 * registriert (also lief die App nachweislich) — und Crashlytics stand
 * trotzdem weiter auf "warte auf die erste Meldung". Ohne diesen Knopf ist
 * nicht zu unterscheiden, ob die Diagnose nicht laeuft oder nur noch nichts
 * abgestuerzt ist.
 *
 * WER IHN SIEHT: nur super_admin, und nur in der App (nicht im Browser). Ein
 * Knopf, der die App abschiesst, hat in der Hand von Konfis oder Teamenden
 * nichts zu suchen — und bei einem Ausrollen an viele tausend Menschen waere
 * ein versehentlicher Treffer teuer. Die Pruefung liegt bewusst hier in der
 * Komponente und nicht erst an der Einbaustelle: So kann sie an einer
 * weiteren Stelle eingehaengt werden, ohne dass jemand die Sperre vergisst.
 *
 * WARUM ZWEIMAL BESTAETIGEN: Der erste Hinweis erklaert, was passiert (die App
 * schliesst sich, nichts geht verloren), der zweite ist die Ruecknahme-Chance.
 * Ein einzelner Knopf, der die App sofort beendet, waere zu leicht versehentlich
 * getroffen.
 *
 * WIE DIE MELDUNG ANKOMMT: Crashlytics schreibt den Bericht beim Absturz auf
 * das Geraet und sendet ihn beim NAECHSTEN Start. Nach dem Absturz muss die App
 * also noch einmal geoeffnet werden — sonst wartet die Konsole weiter, und es
 * sieht wie ein Fehlschlag aus, obwohl alles richtig lief. Genau das steht
 * deshalb im zweiten Hinweis.
 */
const AbsturzTest: React.FC<{ variante?: string }> = ({ variante = 'danger' }) => {
  const { user } = useApp();
  const [presentAlert] = useIonAlert();

  const ausloesen = useCallback(() => {
    presentAlert({
      header: 'Absturz auslösen?',
      message:
        `<div style="text-align:left;line-height:1.7">` +
        `Die App schließt sich sofort. Das ist gewollt — so lässt sich prüfen, ` +
        `dass Abstürze wirklich gemeldet werden.<br><br>` +
        `<b>Es geht nichts verloren.</b> Du bleibst angemeldet.<br><br>` +
        `<b>Wichtig:</b> Die Meldung geht erst beim <b>nächsten Öffnen</b> raus. ` +
        `Also die App danach noch einmal starten.` +
        `</div>`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Wirklich abstürzen',
          role: 'destructive',
          handler: () => {
            // Kein await und kein catch: Der Aufruf kehrt bewusst nicht zurueck.
            void FirebaseCrashlytics.crash({ message: 'Testabsturz aus dem Profil' });
          },
        },
      ],
    });
  }, [presentAlert]);

  // Nur in der App und nur fuer super_admin (Begruendung im Kopfkommentar).
  //
  // Die Pruefung folgt dem Muster aus OrganizationManagementModal.tsx: Der
  // Super-Admin steckt im FLAG is_super_admin; `role_name` lautet bei diesen
  // Konten meist `org_admin` (siehe navigation/rollenBaeume.ts). Eine Pruefung
  // allein auf role_name === 'super_admin' wuerde also gerade die Konten
  // uebersehen, um die es geht.
  if (!Capacitor.isNativePlatform()) return null;
  const istSuperAdmin = user?.is_super_admin === true || user?.role_name === 'super_admin';
  if (!istSuperAdmin) return null;

  return (
    <div
      className={`app-list-item app-list-item--${variante}`}
      style={{ width: '100%', cursor: 'pointer' }}
      onClick={ausloesen}
    >
      <div className="app-list-item__row">
        <div className="app-list-item__main">
          <div className={`app-icon-circle app-icon-circle--${variante}`}>
            <IonIcon icon={ICON_WARNUNG_GEFUELLT} />
          </div>
          <div className="app-list-item__content">
            <div className="app-list-item__title">Absturzmeldung prüfen</div>
            <div className="app-list-item__meta">
              <span className="app-list-item__meta-item">
                Löst einen Absturz aus · nur für die Entwicklung
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AbsturzTest;
