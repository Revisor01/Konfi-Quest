/**
 * Hat die Person im System „Bewegung reduzieren" eingeschaltet?
 *
 * CSS-Übergänge und -Animationen der App-eigenen Klassen stellt
 * theme/barrierefreiheit.css unter derselben Abfrage still. Was nicht per
 * CSS läuft, fragt hier nach: die Seitenübergänge von Ionic (Web Animations,
 * `animated` in setupIonicReact) und der Wisch der Einführung (Swiper,
 * `speed`). Audit 26.09.2026, UI BF-12. Seit 09.10.2026 auch die Punkte-Ringe
 * (ActivityRings) und die hochzählenden Zahlen (useCountUp), die per
 * requestAnimationFrame laufen, und der Wisch durch den Rückblick.
 *
 * Ohne matchMedia (alte WebViews, Tests ohne Mock): nicht reduziert -- die
 * App verhält sich dann wie bisher.
 */
export const bewegungReduziert = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
};
