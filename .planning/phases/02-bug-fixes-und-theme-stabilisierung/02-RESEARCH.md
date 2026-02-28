# Phase 02: Bug-Fixes und Theme-Stabilisierung - Research

**Researched:** 2026-02-28
**Domain:** Ionic React Theme-Konfiguration, iOS 26 Tab Bar, Punkte-Berechnung, Date Utilities
**Confidence:** HIGH

## Summary

Diese Phase adressiert 8 Requirements (BUG-01 bis BUG-04, THM-01 bis THM-04), die sich in drei klar getrennte Arbeitsbereiche aufteilen: (1) TabBar-Fix durch Entfernung von `registerTabBarEffect` und Ersatz durch reines CSS, (2) Verifikation der Theme-Isolation zwischen iOS26 und MD3, und (3) kleinere Code-Cleanups (deprecated dateUtils, Badge-Punktelogik, UI-Review).

Die Analyse des Quellcodes zeigt, dass das bestehende Theme-Setup bereits weitgehend korrekt plattform-isoliert ist: iOS26-CSS scoped auf `.ios:not(.ios26-disabled)`, MD3-CSS scoped auf `.md:not(.md3-disabled)`. Es gibt lediglich 3 unscoped CSS-Regeln in der iOS26-Bibliothek (ion-content-Gradienten), die auf Android sichtbar sein koennten. Die Punkte-Berechnung im Backend ist korrekt kommentiert und folgt dem Prinzip "konfi_profiles enthaelt bereits alles", aber die Badge-Seite im Frontend hat einen Fallback-Pfad, der bei `null`-Werten Punkte manuell aus Activities + Bonus berechnet -- hier besteht theoretisches Double-Count-Risiko. Die deprecated dateUtils-Funktionen (`parseGermanTime`, `getGermanNow`) werden nirgends aufgerufen und koennen direkt entfernt werden.

**Primary recommendation:** TabBar-Fix zuerst (hoechstes User-Impact), dann Theme-Verifikation (geringerer Aufwand als erwartet, da Plattform-Scoping bereits funktioniert), dann Cleanup-Tasks parallel.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- `registerTabBarEffect` aus `@rdlabo/ionic-theme-ios26` komplett entfernen (JS-Import + useEffect in MainTabs.tsx)
- Durch eigenes CSS ersetzen: `backdrop-filter: blur()` fuer transluzenten iOS 26 TabBar-Look
- iOS26 Library bleibt als Dependency -- nur der JS-basierte TabBar-Effect wird ersetzt
- CSS-Styles der Library fuer die TabBar (Floating-Style, kompakte Darstellung) weiterhin nutzen
- Fix betrifft nur iOS -- Android TabBar bleibt unveraendert
- Ionic 8.7 hat noch kein eingebautes iOS 26 Theme (Issue #30466 offen), daher bleibt @rdlabo/ionic-theme-ios26 der Standard
- Beide Theme-CSS-Dateien bleiben bedingungslos geladen (Library isoliert intern per Plattform-Klassen)
- JS-Animationen sind bereits plattformspezifisch konfiguriert (iosTransitionAnimation vs mdTransitionAnimation in App.tsx)
- Ansatz: Testen und nur bei Bedarf fixen -- keine proaktive Variablen-Isolation
- Phase 2 = technische Korrektheit der Theme-Konfiguration, kein visuelles Redesign
- Code-Review aller relevanten Endpoints (Dashboard, Profile, Points-History) auf Double-Count-Risiko
- Live-Daten-Abgleich via SSH + Docker psql gegen die produktive Datenbank
- `parseGermanTime` und `getGermanNow` aus dateUtils.ts entfernen
- Code-basierter Review aller Views/Pages auf typische Probleme (fehlende safe-area, hardcodierte Hoehen, overflow)
- Keine manuelle App-Durchklickung -- Code-Analyse reicht
- Design-Angleich (gleiche Listen, Layouts, Farblogiken) ist NICHT Phase 2 Scope -- das kommt in Phase 3-5

### Claude's Discretion
- Konkretes CSS fuer den iOS TabBar blur-Effekt (backdrop-filter Werte, Farben, Transparenz)
- Welche Theme-Variablen ggf. angepasst werden muessen falls Konflikte gefunden werden
- Umfang des Code-Reviews bei BUG-04 (welche Views prioritaer geprueft werden)
- SQL-Queries fuer den Live-Daten-Abgleich bei BUG-02

### Deferred Ideas (OUT OF SCOPE)
- Design-Angleich aller Views (gleiche Listen, Layouts, Farblogiken) -- Phase 3-5 Scope
- Proaktive CSS-Variablen-Isolation zwischen iOS26 und MD3 -- nur bei Bedarf in Phase 2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUG-01 | TabBar-Rendering mit 6+ Tabs auf iOS stabil | registerTabBarEffect-Analyse (sheets-of-glass Quellcode), CSS-Ersatzstrategie mit backdrop-filter, Bestaetigung dass v2.2.1 das Problem NICHT fixt |
| BUG-02 | Badge Double-Count Risiko eliminiert | Backend-Code-Analyse zeigt korrekte Kommentierung, Frontend KonfiBadgesPage hat Fallback-Pfad mit theoretischem Risiko, SQL-Queries fuer Live-Verifikation |
| BUG-03 | Deprecated dateUtils entfernt | Codebase-Scan bestaetigt: parseGermanTime/getGermanNow nur in dateUtils.ts definiert, nirgends importiert -- reines Cleanup |
| BUG-04 | UI-Fehler identifiziert und behoben | Inventar aller Views/Pages, keine safe-area-Referenzen im Codebase gefunden, Tab-Bar-Overlap-Risiko bei iOS26 Floating-Style |
| THM-01 | iOS 26 Theme korrekt angewandt | iOS26 CSS ist `.ios:not(.ios26-disabled)` scoped, Tab-Bar-Styles verifiziert, brightness-Variablen in variables.css korrekt gesetzt |
| THM-02 | MD3 Theme fuer Android geprueft | MD3 CSS ist `.md:not(.md3-disabled)` scoped, md-remove-ios-class-effect.css korrigiert Button-Styles auf MD |
| THM-03 | Theme-Kollision geloest | 3 unscoped Regeln in iOS26 identifiziert (ion-content Gradienten), beide :root Variablen-Bloecke definieren unterschiedliche Namespaces (ios26-* vs token-*) -- geringes Kollisionsrisiko |
| THM-04 | registerTabBarEffect Bug geloest | Entscheidung: Entfernen statt Fixen, CSS-only-Ansatz mit den bestehenden Library-Styles |
</phase_requirements>

## Standard Stack

### Core (bereits im Projekt)
| Library | Version | Purpose | Rolle in Phase 2 |
|---------|---------|---------|-------------------|
| @ionic/react | 8.6.4 (installiert) | UI-Framework | Basis fuer alle Component-Styles und Plattform-Detection |
| @rdlabo/ionic-theme-ios26 | 2.2.0 (installiert) | iOS 26 CSS + JS Effects | CSS behalten, registerTabBarEffect JS-Code entfernen |
| @rdlabo/ionic-theme-md3 | 1.0.2 (installiert) | Material Design 3 | Unveraendert, Verifikation der Isolation |
| React | 19.0.0 | UI-Library | Keine Aenderungen |

### Keine neuen Dependencies
Phase 2 fuegt keine neuen Bibliotheken hinzu. Alle Aenderungen nutzen bestehende CSS-Faehigkeiten und Codebase-Patterns.

## Architecture Patterns

### Pattern 1: Plattform-CSS-Scoping in Ionic
**What:** Ionic setzt automatisch `.ios` oder `.md` Klasse auf `<html>` und auf jede Ionic-Komponente. Theme-Bibliotheken nutzen dies fuer Plattform-Isolation.
**Confidence:** HIGH -- verifiziert durch Quellcode-Analyse beider Libraries.

iOS26 Theme Scoping-Pattern:
```css
/* JEDE Regel in ionic-theme-ios26.css folgt diesem Pattern: */
ion-tab-bar.ios:not(.ios26-disabled) { ... }
ion-tab-button.ios:not(.ios26-disabled) { ... }
```

MD3 Theme Scoping-Pattern:
```css
/* JEDE Regel in ionic-theme-md3.css folgt diesem Pattern: */
ion-tab-bar.md:not(.md3-disabled) { ... }
ion-card.md:not(.md3-disabled) { ... }
```

**Konsequenz:** Beide Themes koennen bedingungslos geladen werden. `.ios`-Regeln greifen NUR auf iOS-Plattform, `.md`-Regeln NUR auf Android. Die `not(.ios26-disabled)` / `not(.md3-disabled)` Klassen erlauben opt-out pro Komponente.

### Pattern 2: registerTabBarEffect Funktionsweise
**What:** Die Funktion erstellt einen Gesture-Handler auf der TabBar, der bei Tap/Swipe eine Scale-Animation auf Tab-Buttons anwendet. Intern nutzt sie `createGesture` und `createAnimation` aus `@ionic/core`.
**Confidence:** HIGH -- verifiziert durch Quellcode-Analyse von `dist/index.js` und `dist/sheets-of-glass/index.js`.

Aktuelle Implementierung in MainTabs.tsx (zu entfernen):
```typescript
// Zeile 29: Import
import { registerTabBarEffect } from '@rdlabo/ionic-theme-ios26';

// Zeile 155-169: Effect-Lifecycle (zu entfernen)
const tabBarEffectRef = useRef<ReturnType<typeof registerTabBarEffect>>(undefined);
useEffect(() => {
  const timer = setTimeout(() => {
    tabBarEffectRef.current?.destroy();
    const tabBar = document.querySelector<HTMLElement>('ion-tab-bar');
    if (tabBar) {
      tabBarEffectRef.current = registerTabBarEffect(tabBar);
    }
  }, 100);
  return () => {
    clearTimeout(timer);
    tabBarEffectRef.current?.destroy();
  };
}, [location.pathname]); // <-- Re-registriert bei JEDEM Route-Wechsel!
```

**Warum es bei 6 Tabs bricht:**
1. `registerEffect` erstellt ein `cloneElement('ion-tab-button')` global im DOM
2. Die Gesture berechnet `animationPosition` basierend auf `getBoundingClientRect()`
3. Bei 6 Tabs ist die TabBar breiter als der `max-width: 474px` (Standard) -- die Library hat `max-width: 546px` NUR fuer `:has(:nth-child(5))`, also exakt 5 Tabs
4. Bei 6 Tabs greift der Default-Width (`474px`), die Tabs werden komprimiert, und die Gesture-Berechnung (`elementFromPoint`) verfehlt die Tab-Buttons

### Pattern 3: iOS26 TabBar CSS-Styling (bleibt erhalten)
**What:** Die Library wendet bereits per CSS den Floating-TabBar-Look an.
**Confidence:** HIGH -- verifiziert durch CSS-Analyse.

Relevante CSS-Regeln die BLEIBEN:
```css
/* Floating TabBar mit abgerundeten Ecken */
ion-tab-bar.ios:not(.ios26-disabled) {
  background: rgba(var(--ios26-glass-background-rgb), 0.72);
  backdrop-filter: blur(2px) saturate(360%);
  box-shadow: inset 0 0 8px 0 rgba(var(--ios26-glass-box-shadow-color-rgb), 0.2),
              0 0 10px 0 rgba(var(--ios26-glass-box-shadow-color-rgb), 0.82);
  border-radius: 40px;
  z-index: 2;
  /* Position floating */
  position: absolute;
  bottom: var(--ios26-floating-safe-area-bottom);
  left: calc(16px + var(--ion-safe-area-left, 0px));
}

/* Width-Berechnung -- NUR fuer 5 Tabs optimiert! */
ion-tab-bar.ios:not(.ios26-disabled) {
  width: calc(100% - (18px + var(--ion-safe-area-left, 0px)) - (18px + var(--ion-safe-area-left, 0px)) - 60px - 12px);
  max-width: 474px;  /* Default: < 5 Tabs */
}
ion-tab-bar.ios:not(.ios26-disabled):has(:nth-child(5)) {
  width: calc(100% - (18px + var(--ion-safe-area-left, 0px)) - (18px + var(--ion-safe-area-left, 0px)));
  max-width: 546px;  /* 5+ Tabs */
}
```

**Wichtig:** Die CSS-Regel `:has(:nth-child(5))` matcht bei 5 ODER MEHR Kindern (`:nth-child(5)` selektiert das 5. Kind, `:has()` prueft ob mindestens eines existiert). Das heisst: Bei 6 Tabs greift die breitere Width-Berechnung (546px max-width). Die CSS-Darstellung der TabBar ist also korrekt fuer 6 Tabs -- nur der JS-Effect (`registerTabBarEffect`) bricht.

### Pattern 4: Tab-Button Activated-Animation (bleibt per CSS)
**What:** Die Library hat bereits CSS-basierte Press-Animationen fuer Tab-Buttons.
**Confidence:** HIGH -- verifiziert durch CSS-Analyse.

```css
/* Tab-Button Press-Effect (CSS, nicht JS) */
ion-tab-button.ios:not(.ios26-disabled).ion-activated {
  transform: scale(1.1);
}

/* Tab-Bar Scale bei aktiviertem Button */
ion-tab-bar.ios:not(.ios26-disabled):has(ion-tab-button.ion-activated) {
  will-change: transform;
  transform: scale(1.038) translateZ(0);
}

/* Selected Tab Background */
ion-tab-button.ios:not(.ios26-disabled).tab-selected::part(native) {
  background: rgba(var(--ios26-button-color-selected-rgb), 0.095);
}
```

Diese CSS-Animationen funktionieren OHNE `registerTabBarEffect`. Der JS-Effect fuegt lediglich die Swipe-Gesture und eine feinere Scale-Animation hinzu (die bei 6 Tabs sowieso bricht).

### Anti-Patterns to Avoid
- **registerTabBarEffect bei jedem Route-Wechsel neu registrieren:** Das aktuelle Pattern (`[location.pathname]` Dependency) zerstoert und erstellt den Gesture-Handler bei jeder Navigation. Das ist die Hauptursache fuer Flackern.
- **Unscoped :root Variablen zwischen Themes:** Die ios26-Variablen (`--ios26-*`) und MD3-Variablen (`--token-*`) verwenden verschiedene Namespaces, aber die `--ion-color-*-brightness` Variablen aus variables.css sind global sichtbar. Das ist akzeptabel, da sie NUR von iOS26-CSS referenziert werden.
- **Manuelles Plattform-Switching in CSS:** NICHT `@media (platform: ios)` oder aehnliches verwenden. Ionic's `.ios`/`.md` Klassen-System ist der korrekte Ansatz.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plattform-Detection | Eigene Browser-Detection | `isPlatform('ios')` / `.ios`-CSS-Klassen | Ionic kennt alle Plattformen inkl. Edge-Cases (PWA auf iOS, etc.) |
| TabBar Floating-Style | Eigenes CSS-Layout fuer Floating-TabBar | Bestehende ionic-theme-ios26 CSS-Styles | Die Library handhabt safe-area, Positionierung und Border-Radius korrekt |
| Tab-Button Press-Animation | Eigene JS-Animation | CSS-Regeln der Library (transform: scale) | Die Library-CSS ist bereits plattform-korrekt und performant |

**Key insight:** Die `registerTabBarEffect`-Entfernung bedeutet NICHT, dass das gesamte TabBar-Styling verloren geht. 95% des iOS 26 TabBar-Looks kommt aus den CSS-Regeln der Library. Der JS-Effect fuegt nur eine Swipe-Gesture und verfeinerte Scale-Animationen hinzu, die bei 6 Tabs sowieso nicht funktionieren.

## Common Pitfalls

### Pitfall 1: ion-content Gradient ohne .ios Scoping
**What goes wrong:** 3 CSS-Regeln in ionic-theme-ios26.css sind NICHT auf `.ios` scoped:
```css
/* Unscoped Regeln: */
.ion-page:has(>ion-header.header-translucent)>ion-content::part(background)::before { ... }
ion-content::part(background)::after { ... }
.ion-page:has(>ion-footer:not(.footer-translucent)) ion-content::part(background)::after { content: none }
```
**Why it happens:** Die Library wendet Content-Schatten an, die den "Sheets of Glass"-Effekt simulieren.
**How to avoid:** Pruefen ob diese Gradienten auf Android sichtbar sind. Falls ja, mit `.md ion-content::part(background)::after { content: none }` ueberschreiben. Falls nein (weil `header-translucent` auf Android nicht gesetzt wird), ignorieren.
**Warning signs:** Subtile Schatten am oberen/unteren Bildschirmrand auf Android-Geraeten.
**Confidence:** MEDIUM -- theoretisches Risiko, muss visuell verifiziert werden.

### Pitfall 2: TabBar Width bei 6 Tabs ueberschreiben
**What goes wrong:** Die Library setzt `max-width: 546px` fuer 5+ Tabs. Bei 6 Tabs koennte dies zu eng sein.
**Why it happens:** Die `:has(:nth-child(5))`-Regel greift bei 5 ODER MEHR Tabs, aber der `max-width` wurde fuer 5 Tabs optimiert.
**How to avoid:** Nach Entfernung des JS-Effects testen ob die 6 Tab-Buttons visuell in die 546px passen. Falls Beschriftungen abgeschnitten werden: eigenes CSS mit angepasstem `max-width`.
**Warning signs:** Abgeschnittene Labels, ueberlappende Tab-Buttons auf schmalen Geraeten.
**Confidence:** MEDIUM -- haengt von der Labellaenge ab (aktuelle Labels: "Konfis", "Chat", "Events", "Badges", "Antraege", "Mehr" / "Dashboard", "Chat", "Events", "Badges", "Aktivitaeten", "Profil").

### Pitfall 3: Badge-Punkte Fallback-Berechnung in KonfiBadgesPage
**What goes wrong:** Die KonfiBadgesPage (Zeile 88-141) hat einen Fallback-Pfad: Wenn `konfiData.gottesdienst_points` null/undefined ist, berechnet sie Punkte manuell aus `activities + bonusPoints`. Wenn das Backend aber korrekte Werte liefert UND gleichzeitig activities/bonusPoints als separate Arrays, koennte der Fallback-Pfad bei einem API-Aenderung doppelt zaehlen.
**Why it happens:** Historischer Code aus der SQLite-Migration. Das Backend liefert inzwischen immer korrekte Werte in `konfi_profiles`.
**How to avoid:** Verifizieren dass das Backend IMMER `gottesdienst_points` und `gemeinde_points` zurueckliefert (nie null). Falls gesichert: Fallback-Code entfernen oder markieren.
**Warning signs:** Badge-Progress zeigt hoehere Werte als die Dashboard-Anzeige.
**Confidence:** HIGH -- Backend-Code (konfi.js:122-124) berechnet totalPoints korrekt.

### Pitfall 4: CSS-Reihenfolge bei Theme-Imports
**What goes wrong:** Die import-Reihenfolge in variables.css bestimmt die CSS-Kaskade:
```css
/* 1. */ @import '@rdlabo/ionic-theme-ios26/dist/css/default-variables.css';
/* 2. */ @import '@rdlabo/ionic-theme-ios26/dist/css/ionic-theme-ios26.css';
/* 3. */ @import '@rdlabo/ionic-theme-ios26/dist/css/md-remove-ios-class-effect.css';
/* 4. */ @import '@rdlabo/ionic-theme-md3/dist/css/default-variables.css';
/* 5. */ @import '@rdlabo/ionic-theme-md3/dist/css/ionic-theme-md3.css';
```
MD3 wird NACH iOS26 geladen. Bei gleicher Spezifitaet gewinnt MD3. Da die Selektoren verschiedene Plattform-Klassen nutzen (`.ios` vs `.md`), matcht immer nur einer -- aber die `:root`-Variablen von MD3 ueberschreiben die von iOS26.
**How to avoid:** `:root`-Variablen sind namespaced (`--ios26-*` vs `--token-*`), kein Konflikt. Die `--ion-color-*-brightness` Variablen in variables.css werden NACH beiden Imports gesetzt und gewinnen daher. Reihenfolge ist korrekt.
**Confidence:** HIGH -- verifiziert durch Analyse beider default-variables.css Dateien.

## Code Examples

### Entfernung von registerTabBarEffect (MainTabs.tsx)

**Entfernen -- Import (Zeile 29):**
```typescript
// ENTFERNEN:
import { registerTabBarEffect } from '@rdlabo/ionic-theme-ios26';
```

**Entfernen -- useEffect Block (Zeile 155-169):**
```typescript
// KOMPLETT ENTFERNEN:
const tabBarEffectRef = useRef<ReturnType<typeof registerTabBarEffect>>(undefined);
useEffect(() => {
  const timer = setTimeout(() => {
    tabBarEffectRef.current?.destroy();
    const tabBar = document.querySelector<HTMLElement>('ion-tab-bar');
    if (tabBar) {
      tabBarEffectRef.current = registerTabBarEffect(tabBar);
    }
  }, 100);
  return () => {
    clearTimeout(timer);
    tabBarEffectRef.current?.destroy();
  };
}, [location.pathname]);
```

**Optionales CSS-Enhancement (fuer verstaerkten Blur-Effekt):**
```css
/* In variables.css oder separater Datei */
/* Die Library setzt bereits backdrop-filter: blur(2px) saturate(360%) */
/* Fuer staerkeren nativen iOS-26-Look optional erhoehen: */
ion-tab-bar.ios:not(.ios26-disabled) {
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}
```
Quelle: Verifiziert durch Analyse der Library CSS -- die Default-Werte sind `blur(2px) saturate(360%)`. Native iOS 26 TabBars verwenden typischerweise `blur(20px)` mit moderater Saturierung.

### Deprecated dateUtils entfernen (dateUtils.ts)

**Entfernen -- Zeile 117-133:**
```typescript
// KOMPLETT ENTFERNEN:
/**
 * DEPRECATED - use parseLocalTime instead
 * Converts a UTC date string to German local time
 */
export const parseGermanTime = (dateString: string): Date => {
  console.warn('parseGermanTime is deprecated, use parseLocalTime instead');
  return parseLocalTime(dateString);
};

/**
 * DEPRECATED - use getLocalNow instead
 * Gets current time in German timezone
 */
export const getGermanNow = (): Date => {
  console.warn('getGermanNow is deprecated, use getLocalNow instead');
  return getLocalNow();
};
```

### SQL-Queries fuer Live-Daten-Verifikation (BUG-02)

```sql
-- Pruefen ob konfi_profiles.gottesdienst_points die Summe aus Aktivitaeten + Events + Bonus ist
-- Ausfuehren via: ssh root@server.godsapp.de "docker exec -it konfi-quest-db-1 psql -U konfi_user -d konfi_db"

-- 1. Vergleich: konfi_profiles vs. Summe aus konfi_activities + bonus_points + event_bookings
SELECT
  u.display_name,
  kp.gottesdienst_points as profil_gd,
  kp.gemeinde_points as profil_gem,
  (kp.gottesdienst_points + kp.gemeinde_points) as profil_total,
  COALESCE(act_gd.sum, 0) as activities_gd,
  COALESCE(act_gem.sum, 0) as activities_gem,
  COALESCE(bp_gd.sum, 0) as bonus_gd,
  COALESCE(bp_gem.sum, 0) as bonus_gem,
  COALESCE(ev_gd.sum, 0) as event_gd,
  COALESCE(ev_gem.sum, 0) as event_gem
FROM users u
JOIN konfi_profiles kp ON u.id = kp.user_id
LEFT JOIN LATERAL (
  SELECT SUM(a.points) as sum FROM konfi_activities ka JOIN activities a ON ka.activity_id = a.id WHERE ka.konfi_id = u.id AND a.type = 'gottesdienst'
) act_gd ON true
LEFT JOIN LATERAL (
  SELECT SUM(a.points) as sum FROM konfi_activities ka JOIN activities a ON ka.activity_id = a.id WHERE ka.konfi_id = u.id AND a.type = 'gemeinde'
) act_gem ON true
LEFT JOIN LATERAL (
  SELECT SUM(points) as sum FROM bonus_points WHERE konfi_id = u.id AND type = 'gottesdienst'
) bp_gd ON true
LEFT JOIN LATERAL (
  SELECT SUM(points) as sum FROM bonus_points WHERE konfi_id = u.id AND type = 'gemeinde'
) bp_gem ON true
LEFT JOIN LATERAL (
  SELECT SUM(e.points) as sum FROM event_bookings eb JOIN events e ON eb.event_id = e.id WHERE eb.user_id = u.id AND eb.status = 'confirmed' AND e.type = 'gottesdienst'
) ev_gd ON true
LEFT JOIN LATERAL (
  SELECT SUM(e.points) as sum FROM event_bookings eb JOIN events e ON eb.event_id = e.id WHERE eb.user_id = u.id AND eb.status = 'confirmed' AND e.type = 'gemeinde'
) ev_gem ON true
JOIN roles r ON u.role_id = r.id
WHERE r.name = 'konfi'
ORDER BY u.display_name
LIMIT 20;

-- 2. Quick-Check: Gibt es Diskrepanzen?
-- profil_gd sollte = activities_gd + bonus_gd + event_gd sein
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| registerTabBarEffect JS fuer TabBar-Animation | CSS-only TabBar-Styling (Library CSS reicht) | Phase 2 (jetzt) | Entfernt JS-Fehlerquelle, CSS-Animationen funktionieren weiterhin |
| parseGermanTime / getGermanNow | parseLocalTime / getLocalNow | Bereits migriert, Altcode noch vorhanden | Reines Cleanup, keine funktionale Aenderung |
| Beide Themes bedingt laden | Beide Themes immer laden, Plattform-Scoping per CSS-Klassen | Standard-Ansatz der Libraries | Kein Switching-Code noetig, geringere Komplexitaet |

**Deprecated/outdated:**
- `registerTabBarEffect`: Funktioniert nicht zuverlaessig bei 6+ Tabs. v2.2.1 hat keinen Fix dafuer. Ionic Issue #30466 (nativer iOS 26 Support) ist weiterhin offen ohne Timeline.
- `parseGermanTime` / `getGermanNow`: Wrapper die nur die neuen Funktionen aufrufen. Werden nirgends importiert.

## Open Questions

1. **ion-content Gradient auf Android**
   - Was wir wissen: 3 unscoped CSS-Regeln in iOS26 koennten auf Android greifen
   - Was unklar ist: Ob `header-translucent` auf Android-Geraeten gesetzt wird (Ionic setzt dies normalerweise nur auf iOS)
   - Recommendation: Beim Theme-Review (THM-03) visuell pruefen. Falls sichtbar: eine CSS-Override-Zeile hinzufuegen

2. **TabBar max-width bei 6 Tabs**
   - Was wir wissen: `:has(:nth-child(5))` greift fuer 5+ Tabs, setzt max-width 546px
   - Was unklar ist: Ob 546px ausreicht fuer 6 Tabs mit den aktuellen Labels auf schmalen Screens (iPhone SE: 375px Breite)
   - Recommendation: Nach JS-Entfernung testen. Die Width-Berechnung `calc(100% - 36px - padding)` sollte auf kleinen Screens die volle Breite nutzen (max-width greift nur auf breiteren Geraeten)

3. **KonfiBadgesPage Fallback-Pfad**
   - Was wir wissen: Der Code hat einen Fallback fuer null-Punkte. Das Backend liefert inzwischen immer korrekte Werte.
   - Was unklar ist: Ob es Edge-Cases gibt wo gottesdienst_points null sein kann (z.B. neuer Konfi ohne Eintraege)
   - Recommendation: Backend-Query pruefen ob `COALESCE` verwendet wird. Falls ja: Fallback-Code im Frontend als toten Code markieren oder entfernen.

## Sources

### Primary (HIGH confidence)
- `frontend/node_modules/@rdlabo/ionic-theme-ios26/dist/index.js` -- registerTabBarEffect Quellcode, v2.2.0
- `frontend/node_modules/@rdlabo/ionic-theme-ios26/dist/sheets-of-glass/index.js` -- registerEffect Implementierung mit .ios Guard
- `frontend/node_modules/@rdlabo/ionic-theme-ios26/dist/css/ionic-theme-ios26.css` -- Vollstaendiges CSS mit Plattform-Scoping
- `frontend/node_modules/@rdlabo/ionic-theme-md3/dist/css/ionic-theme-md3.css` -- MD3 CSS mit .md Scoping
- `backend/routes/konfi.js:115-124` -- Dashboard Punkte-Berechnung
- `backend/routes/konfi.js:496-520` -- Points-History Berechnung
- `frontend/src/components/konfi/pages/KonfiBadgesPage.tsx:88-141` -- Badge Punkte-Fallback-Logik
- `frontend/src/utils/dateUtils.ts:117-133` -- Deprecated Funktionen
- `frontend/src/components/layout/MainTabs.tsx:29,155-169` -- registerTabBarEffect Usage

### Secondary (MEDIUM confidence)
- [GitHub rdlabo-team/ionic-theme-ios26 Releases](https://github.com/rdlabo-team/ionic-theme-ios26/releases) -- v2.2.1 Changelog: Kein TabBar-Fix enthalten
- [Ionic Framework Issue #30466](https://github.com/ionic-team/ionic-framework/issues/30466) -- iOS 26 Support: Offen, kein Timeline, "needs: investigation" Label

### Tertiary (LOW confidence)
- iOS 26 native TabBar backdrop-filter Werte (blur(20px)) -- basiert auf Community-Beobachtungen, nicht offizielle Apple-Dokumentation

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH -- alle Libraries sind bereits installiert, Versionen verifiziert
- Architecture: HIGH -- Plattform-Scoping durch Quellcode-Analyse bestaetigt
- Pitfalls: MEDIUM-HIGH -- CSS-Kollisionspunkte identifiziert, visueller Test auf Android fehlt
- Bug-Fix Strategie: HIGH -- registerTabBarEffect Quellcode analysiert, Root-Cause verstanden, Entfernungsstrategie klar

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stabile Libraries, keine groesseren Updates erwartet)
