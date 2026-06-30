# Backlog

Ideen und aufgeschobene Features fuer zukuenftige Milestones.

## BUG-BEOBACHTUNG: Android Tab-Bar Safe-Area unten (3-Button-Nav)

Status: diagnostiziert, NICHT gefixt, NICHT in 1.4.0. Wir warten ab, ob es auf
echten Android-Geraeten auftritt (nur im Emulator reproduziert).

Symptom: Auf Android (15/16, S25-aehnlich) liegen die drei System-Navigations-
Buttons ueber der Tab-Bar — die Tab-Bar reserviert keinen Platz fuer die
Navigationsleiste.

Ursache: `env(safe-area-inset-bottom)` liefert in der WebView 0px statt des
echten Nav-Bar-Insets (~48px). targetSdk 36 erzwingt Edge-to-Edge, aber
Capacitor reicht den unteren Window-Inset nicht an die WebView durch. Die
CSS-Regel (`ion-tab-bar.md` in variables.css) ist korrekt, bekommt nur den
falschen 0-Wert.

Loesungsweg (falls bestaetigt): Window-Inset nativ an die WebView durchreichen —
Edge-to-Edge-Plugin oder in MainActivity die Bottom-Inset als CSS-Var
(--ion-safe-area-bottom) injizieren. NICHT erneut breit am CSS aendern.

(Abgrenzung: oberes Chat-Header-Safe-Area-Thema ist separat und in 1.4.0 gefixt.)

## 999.1 Design-Angleich

Finaler Design-Durchgang ueber alle Views fuer konsistentes Erscheinungsbild.

## 999.2 Test-Suite

Backend: Unit-Tests fuer alle 18 Route-Dateien, Auth-Logik, Punkte-Berechnung, Badge-Vergabe, Wrapped-Generierung.
Frontend: Komponenten-Tests fuer kritische Business-Logik.

## 999.3 Grosse Dateien aufteilen

events.js (2067 Zeilen), chat.js (1847 Zeilen), konfi-managment.js (1008 Zeilen), KonfiDetailSections.tsx (1181 Zeilen), BadgeManagementModal.tsx (1124 Zeilen), ChatRoom.tsx (1058 Zeilen) in kleinere Module splitten.
