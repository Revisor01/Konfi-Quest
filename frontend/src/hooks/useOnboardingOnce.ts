import { useState } from 'react';
import { useIonViewDidEnter } from '@ionic/react';
import { Preferences } from '@capacitor/preferences';

// Flag-Praefix des Update-Walkthroughs 2.0 (Challenges + Umzug der Anträge in
// den Events-Tab). Rollenuebergreifend derselbe Praefix, der Account-Suffix
// trennt die Nutzer.
export const UPDATE_WALKTHROUGH_KEY = 'update_walkthrough_2_0_gesehen';

// Zeigt eine Onboarding-Tour EINMAL pro Account (geraetelokal via Preferences).
// `keyPrefix` trennt die Rollen (z.B. 'admin_onboarding_seen'), `userId` macht
// den Marker accountspezifisch. Rueckgabe: [show, close] — `show` rendert das
// Tour-Overlay, `close` schließt es. Der Marker wird beim ERSTEN Anzeigen
// gesetzt (nicht erst beim Schliessen), damit die Tour nicht doppelt aufpoppt.
export function useOnboardingOnce(keyPrefix: string, userId?: number | string): [boolean, () => void] {
  const [show, setShow] = useState(false);
  const storageKey = `${keyPrefix}_${userId ?? 'x'}`;

  useIonViewDidEnter(() => {
    if (userId === undefined || userId === null) return;
    Preferences.get({ key: storageKey }).then(({ value }) => {
      if (!value) {
        Preferences.set({ key: storageKey, value: '1' });
        // Kleiner Versatz, damit die Seite erst sauber rendert.
        setTimeout(() => setShow(true), 400);
      }
    }).catch(() => { /* Preferences nicht verfuegbar -> Tour ueberspringen */ });
  });

  return [show, () => setShow(false)];
}

export interface OnboardingWithUpdate {
  // Normale Rollen-Tour (erster Start eines Accounts).
  showOnboarding: boolean;
  closeOnboarding: () => void;
  // Einmaliger Update-Hinweis, NUR für Bestandsnutzer.
  showUpdateWalkthrough: boolean;
  closeUpdateWalkthrough: () => void;
}

// Entscheidet in EINEM Ablauf, ob die normale Onboarding-Tour oder der
// Update-Walkthrough gezeigt wird — nie beides gleichzeitig:
//
// - Onboarding-Flag fehlt  -> frischer Account: volle Tour zeigen und den
//   Update-Hinweis direkt als gesehen markieren. Neue Nutzer lernen Challenges
//   ohnehin in der Tour kennen und sollen nicht zusaetzlich "was ist neu" lesen.
// - Onboarding-Flag gesetzt, Update-Flag fehlt -> Bestandsnutzer: einmalig den
//   Update-Walkthrough zeigen.
// - beide gesetzt -> nichts.
//
// Mechanik identisch zu useOnboardingOnce (Preferences, Marker beim ERSTEN
// Anzeigen gesetzt). Beide Flags werden in EINEM Promise.all gelesen, damit
// sich Lese-/Schreibzugriffe der beiden Entscheidungen nicht ueberholen.
export function useOnboardingWithUpdateOnce(
  onboardingKeyPrefix: string,
  userId?: number | string
): OnboardingWithUpdate {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showUpdateWalkthrough, setShowUpdateWalkthrough] = useState(false);
  const onboardingKey = `${onboardingKeyPrefix}_${userId ?? 'x'}`;
  const updateKey = `${UPDATE_WALKTHROUGH_KEY}_${userId ?? 'x'}`;

  useIonViewDidEnter(() => {
    if (userId === undefined || userId === null) return;
    Promise.all([
      Preferences.get({ key: onboardingKey }),
      Preferences.get({ key: updateKey })
    ]).then(([onboarding, update]) => {
      if (!onboarding.value) {
        Preferences.set({ key: onboardingKey, value: '1' });
        Preferences.set({ key: updateKey, value: '1' });
        setTimeout(() => setShowOnboarding(true), 400);
        return;
      }
      if (!update.value) {
        Preferences.set({ key: updateKey, value: '1' });
        // Etwas mehr Versatz als bei der Tour, damit die Seite steht.
        setTimeout(() => setShowUpdateWalkthrough(true), 600);
      }
    }).catch(() => { /* Preferences nicht verfuegbar -> Touren ueberspringen */ });
  });

  return {
    showOnboarding,
    closeOnboarding: () => setShowOnboarding(false),
    showUpdateWalkthrough,
    closeUpdateWalkthrough: () => setShowUpdateWalkthrough(false)
  };
}
