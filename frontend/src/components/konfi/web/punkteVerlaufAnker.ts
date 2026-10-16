// Anker der Tabelle „Punkte-Verlauf" (WebPunkteVerlauf) und der Sprung dorthin.
// Im Browser zeigt die „Punkte-Übersicht" keine eigene Übersicht wie das Modal
// der App, sondern springt zur Tabelle -- dieselben Einträge stehen dort schon
// (Simon, 15.10.2026). Gebraucht im Profil der Konfis (Knopf und ?punkte=1)
// und in der Konfi-Historie des Teams. Eine eigene Datei, damit
// WebProfilBausteine nur Komponenten ausgibt.

export const PUNKTE_VERLAUF_ANKER = 'web-punkte-verlauf';

/** Zum Punkte-Verlauf springen; der Fokus geht mit, damit Tastatur und Vorleser dort weitermachen. */
export const zeigePunkteVerlauf = (): void => {
  const ziel = document.getElementById(PUNKTE_VERLAUF_ANKER);
  if (!ziel) return;
  ziel.scrollIntoView?.({ block: 'start' });
  ziel.focus({ preventScroll: true });
};
