// Absturz beim Antippen einer Push-Nachricht auf Android (Gerätetest 23.09.2026):
// "Da oeffnet sich die App fuer ganz kurz und stuerzt direkt ab. Aus'm
// Hintergrund wo sie dann noch laeuft holen geht nicht, direkt Absturz. Muss
// sie einmal schliessen um sie dann neu zu oeffnen um reinzukommen dann."
//
// Der Tap-Handler setzte `window.location.href` auf die Ziel-Route. Im nativen
// WebView ist das ein VOLLSTAENDIGER Neuaufbau der App (capacitor://localhost),
// und zwar genau in dem Moment, in dem Android die Activity gerade hochfaehrt.
// Dieselbe Ursache ist in App.tsx schon einmal behoben worden (Handler fuer
// 'auth:relogin-required': "im nativen Capacitor-WebView laedt das die App
// komplett neu und konnte beim Wiederaufbau crashen") und pushNavigation.ts
// warnt im Kopfkommentar selbst davor -- nur an der Absturzstelle war die
// Konsequenz nicht gezogen.
//
// Statt des harten Reloads wird das Ziel jetzt uebergeben: Der Handler legt es
// ab und feuert 'push:navigate', eine Komponente MIT Router-Zugriff navigiert
// (genau das Muster von 'auth:relogin-required', 'org:switched' & Co.).
//
// Der Merker ist noetig, weil ein Org-Wechsel vor der Navigation den
// Router-Subtree neu montiert (orgVersion-Schluessel in App.tsx): Das Event
// kann dann in der Luecke zwischen Abbau und Aufbau landen. Die neu montierte
// Komponente liest das Ziel beim Mount aus dem Merker nach.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  pushZielMelden,
  pushZielAbholen,
  PUSH_ZIEL_EVENT,
} from '../../utils/pushNavigation';

describe('pushZielMelden: Uebergabe ohne harten Reload', () => {
  beforeEach(() => {
    // Merker aus einem vorherigen Test leeren.
    pushZielAbholen();
  });

  it('feuert das Ereignis mit dem Ziel im detail', () => {
    const empfangen: string[] = [];
    const lauscher = (e: Event) => {
      empfangen.push((e as CustomEvent<{ ziel: string }>).detail.ziel);
    };
    window.addEventListener(PUSH_ZIEL_EVENT, lauscher);
    try {
      pushZielMelden('/konfi/chat/room/5');
    } finally {
      window.removeEventListener(PUSH_ZIEL_EVENT, lauscher);
    }
    expect(empfangen).toEqual(['/konfi/chat/room/5']);
  });

  it('legt das Ziel im Merker ab, auch wenn gerade NIEMAND lauscht', () => {
    // Genau der Fall nach einem Org-Wechsel: Der Router-Subtree ist beim
    // Feuern abgebaut, die neue Komponente holt das Ziel beim Mount nach.
    pushZielMelden('/teamer/events');
    expect(pushZielAbholen()).toEqual({ ziel: '/teamer/events', herkunft: 'push' });
  });

  it('gibt das Ziel nur EINMAL heraus', () => {
    // Sonst navigierte die App bei jedem Neu-Montieren des Routers wieder
    // auf das alte Push-Ziel -- man kaeme nicht mehr weg davon.
    pushZielMelden('/admin/requests');
    expect(pushZielAbholen()).toEqual({ ziel: '/admin/requests', herkunft: 'push' });
    expect(pushZielAbholen()).toBeNull();
  });

  it('leerer Merker liefert null', () => {
    expect(pushZielAbholen()).toBeNull();
  });

  it('ohne Ziel wird nichts gemeldet und nichts gemerkt', () => {
    // buildPushTargetUrl liefert '' fuer unbekannte Typen.
    const lauscher = vi.fn();
    window.addEventListener(PUSH_ZIEL_EVENT, lauscher);
    try {
      pushZielMelden('');
    } finally {
      window.removeEventListener(PUSH_ZIEL_EVENT, lauscher);
    }
    expect(lauscher).toHaveBeenCalledTimes(0);
    expect(pushZielAbholen()).toBeNull();
  });

  it('ein zweiter Push ueberschreibt das noch nicht abgeholte Ziel', () => {
    // Zwei Taps in Folge: Es gilt der letzte, nicht der erste.
    pushZielMelden('/konfi/events');
    pushZielMelden('/konfi/badges');
    expect(pushZielAbholen()).toEqual({ ziel: '/konfi/badges', herkunft: 'push' });
    expect(pushZielAbholen()).toBeNull();
  });

  it('meldet OHNE window.location anzufassen', () => {
    // Die eigentliche Absturzursache: ein Schreibzugriff auf location.href.
    // Hier als Zusicherung festgehalten, dass der Weg jetzt ein anderer ist.
    const vorher = window.location.href;
    pushZielMelden('/admin/events/12');
    expect(window.location.href).toBe(vorher);
    expect(pushZielAbholen()).toEqual({ ziel: '/admin/events/12', herkunft: 'push' });
  });
});

// Dass der Push-Handler das Ziel ueber pushZielMelden uebergibt und die Seite
// nicht mehr per window.location.href neu laedt, prueft seit dem 29.09.2026
// contexts/pushAntippenNavigiert.test.tsx am echten AppProvider (Audit Tests
// BF-02) -- vorher stand hier eine Quelltext-Zusicherung.
