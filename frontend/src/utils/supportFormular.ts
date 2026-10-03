// Das Support-Formular auf der Homepage (docs/planung/support-vorgaenge.md,
// Entscheidung 4: „Support kommt auf die HP"). Es steht auf konfi-quest.de neben
// dem Anfrageformular, offen für alle -- ein eigenes Formular in der App gibt es
// nicht. „Hilfe und Support" unter „Mehr" führt dorthin, als Link nach draußen
// (services/systemDialoge.ts, linkOeffnen).

/** Die Sprungmarke des Formulars auf der Startseite (frontend/public/landing.html, id="support"). */
export const SUPPORT_FORMULAR_URL = 'https://konfi-quest.de/#support';

/**
 * Wer den Eintrag „Hilfe und Support" unter „Mehr" sieht: die Gemeindeleitung
 * und die Leitung einer Gemeinde. Teamer:innen und Konfis haben „Mehr" so nicht;
 * ein Support-Konto ohne Gemeinde braucht das Formular nicht.
 */
export const sieheHilfeEintrag = (rolle: string | undefined): boolean => rolle === 'org_admin' || rolle === 'admin';
