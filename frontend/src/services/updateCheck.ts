// updateCheck.ts — prueft dezent, ob in den Stores eine neuere App-Version
// liegt als die installierte (Nutzerwunsch 01.09.2026).
//
// ABLAUF: Der Backend-Endpunkt GET /api/app-version meldet die aktuell im
// Store VEROEFFENTLICHTE Version (Quelle: iTunes-Lookup, gecacht — Details
// und Begruendung in backend/utils/storeVersion.js). Verglichen wird gegen
// die tatsaechlich installierte Version (App.getInfo, also
// CFBundleShortVersionString bzw. versionName), NICHT gegen version.json —
// die beschreibt nur, was gebaut wuerde, nicht was installiert ist.
//
// GRUNDSAETZE (Apple Review Guidelines / Play-Policy, recherchiert 01.09.2026):
// - Nur ein HINWEIS, nie eine Blockade: Ein erzwungenes Update oder eine
//   gesperrte App waere bei Apple ein Ablehnungsgrund und bei einer
//   Gemeinde-App ohnehin unangemessen. Der Link fuehrt lediglich zur
//   Store-Seite der App — das ist auf beiden Plattformen der uebliche und
//   zulaessige Weg.
//   Das gilt auch unter einer Mindestversion, die der Betrieb setzt
//   (services/betriebsstatus.ts, Simon 27.09.2026: "Keine Zwangsupdates"):
//   Dort erscheint ein deutlicherer Dialog, der sich ebenfalls schliessen
//   laesst (components/common/MindestversionHinweis). Blockiert wird nie.
// - Offline stoert nichts: ohne Verbindung wird gar nicht erst angefragt.
// - Fehler sind still: Kein Hinweis ist immer ein gueltiges Ergebnis.
//
// ANDROID: GOOGLES IN-APP-UPDATES (Simon, 09.10.2026)
// Auf Android holt die App das Update selbst ueber Googles In-App-Updates
// (Plugin @capawesome/capacitor-app-update, nur Android eingebunden, siehe
// capacitor.config.ts). Zwei Wege, je nach Lage:
//   - Unter der Mindestversion (android.min_version): SOFORT-UPDATE — Googles
//     Vollbild laedt und installiert, die App startet neu
//     (versucheSofortUpdate, ausgeloest vom MindestversionHinweis).
//   - Nur eine neuere Store-Version: FLEXIBLES UPDATE — Google fragt einmal,
//     laedt im Hintergrund, danach zeigt die blaue Karte "Neustarten zum
//     Aktualisieren" (holeUpdateImHintergrund, ausgeloest vom
//     StoreUpdateBanner). Ob es eine neuere Version gibt, sagt hier Google
//     Play selbst: Die Store-Version des Servers kommt aus dem App Store,
//     Play kennt den Stand fuer genau dieses Geraet.
// Auch das ist kein Zwang: Googles Vollbild laesst sich mit der Zurueck-Taste
// schliessen, und die App laeuft dann normal weiter.
// Kann Google nicht (App nicht aus Play installiert, kein Play-Dienst,
// Emulator, Play kennt das Update noch nicht, Fehler), bleibt alles wie
// vorher: Hinweis mit Link zur Store-Seite. Jeder Weg laeuft hoechstens
// einmal je App-Start. iOS und der Browser rufen das Plugin nie.

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import {
  AppUpdate,
  AppUpdateAvailability,
  AppUpdateResultCode,
  FlexibleUpdateInstallStatus,
} from '@capawesome/capacitor-app-update';
import api from './api';
import { networkMonitor } from './networkMonitor';
import { istNeuereVersion } from '../utils/versionVergleich';

export interface StoreUpdateInfo {
  /** Die im Store veroeffentlichte, neuere Version (z.B. "2.2.0"). */
  version: string;
  /** Store-Seite der App auf der jeweiligen Plattform. */
  url: string;
}

// Wegklicken haftet PRO VERSION, nicht fuer immer: Wer den Hinweis auf 2.2.0
// wegklickt, sieht ihn erst wieder, wenn 2.3.0 erscheint. Geraetelokal ohne
// Account-Suffix — ein App-Update betrifft das Geraet, nicht den Account.
const WEGGEKLICKT_PREFIX = 'store_update_hinweis_weggeklickt_';

// Einmal pro App-Start pruefen (Modul-Level-Memo wie networkMonitor):
// Der Banner haengt auf allen drei Dashboards; ohne Memo wuerde jede
// Tab-Rueckkehr einen Request ausloesen. Bewusst KEIN Neuversuch innerhalb
// der Session, wenn die erste Pruefung offline war — der Hinweis ist dezent,
// beim naechsten App-Start klappt es.
let laufendePruefung: Promise<StoreUpdateInfo | null> | null = null;
// Aus derselben Antwort: liegt die installierte Version unter der
// Mindestversion der eigenen Plattform? Dann gehoert das Update dem
// Sofort-Weg, und der flexible startet nicht zusaetzlich einen zweiten
// Google-Dialog.
let mindestversionUnterschritten = false;

async function fuehrePruefungAus(): Promise<StoreUpdateInfo | null> {
  // Im Browser gibt es nichts zu aktualisieren — dort laeuft immer der
  // zuletzt deployte Web-Build.
  if (!Capacitor.isNativePlatform()) return null;
  // Offline: nicht anfragen, nicht stoeren (axios wuerde sonst 3x retryen).
  if (!networkMonitor.isOnline) return null;

  const appInfo = await App.getInfo();
  const antwort = await api.get('/app-version');
  const plattform = Capacitor.getPlatform(); // 'ios' | 'android'
  const eintrag = plattform === 'android' ? antwort.data?.android : antwort.data?.ios;
  if (!eintrag || typeof eintrag.version !== 'string' || typeof eintrag.url !== 'string') {
    return null;
  }
  mindestversionUnterschritten =
    typeof eintrag.min_version === 'string' && istNeuereVersion(eintrag.min_version, appInfo.version);
  if (!istNeuereVersion(eintrag.version, appInfo.version)) return null;
  return { version: eintrag.version, url: eintrag.url };
}

/**
 * Liefert die neuere Store-Version samt Store-URL — oder null, wenn es
 * nichts hinzuweisen gibt. Wirft nie, fragt hoechstens einmal pro App-Start.
 */
export function pruefeStoreUpdate(): Promise<StoreUpdateInfo | null> {
  if (!laufendePruefung) {
    laufendePruefung = fuehrePruefungAus().catch(() => null);
  }
  return laufendePruefung;
}

/** true, wenn der Hinweis auf GENAU diese Version schon weggeklickt wurde. */
export async function istHinweisWeggeklickt(version: string): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: WEGGEKLICKT_PREFIX + version });
    return value === '1';
  } catch {
    // Preferences kaputt -> lieber keinen Hinweis zeigen als einen, der
    // sich nicht dauerhaft wegklicken laesst.
    return true;
  }
}

/** Merkt das Wegklicken dauerhaft (pro Version, geraetelokal). */
export async function merkeHinweisWeggeklickt(version: string): Promise<void> {
  try {
    await Preferences.set({ key: WEGGEKLICKT_PREFIX + version, value: '1' });
  } catch {
    /* Preferences nicht verfuegbar -> Hinweis kommt beim naechsten Start erneut */
  }
}

// ---------------------------------------------------------------------------
// Android: In-App-Updates ueber Google Play
// ---------------------------------------------------------------------------

/**
 * 'gestartet': Google hat das Update angenommen (die App startet neu).
 * 'abgelehnt': Die Nutzerin hat Googles Vollbild geschlossen — wie "Später".
 * 'nicht_moeglich': Google kann nicht; es bleibt beim bisherigen Hinweis.
 */
export type SofortUpdateErgebnis = 'gestartet' | 'abgelehnt' | 'nicht_moeglich';

/**
 * zustand 'bereit': Das Update ist geladen — "Neustarten zum Aktualisieren".
 * zustand 'abgelehnt': Googles Rueckfrage wurde eben verneint (gemerkt wie das X).
 * zustand 'weggeklickt': Fuer dieses Update schon frueher verneint oder weggetippt.
 * zustand 'nicht_moeglich': Google kann nicht; es bleibt beim Hinweis mit Store-Link.
 * schluessel: Merkname fuer das Wegklicken (merkeHinweisWeggeklickt), oder null.
 */
export interface HintergrundUpdateErgebnis {
  zustand: 'bereit' | 'abgelehnt' | 'weggeklickt' | 'nicht_moeglich';
  schluessel: string | null;
}

const NICHT_MOEGLICH: HintergrundUpdateErgebnis = { zustand: 'nicht_moeglich', schluessel: null };

// Wegklicken je Update wie beim Store-Hinweis, aber nach Googles versionCode:
// Play meldet keinen Versionsnamen, und der Store-Hinweis kennt nur die
// Version aus dem App Store (siehe Kopf von backend/utils/storeVersion.js).
const PLAY_SCHLUESSEL_PREFIX = 'play-';

let sofortVersuch: Promise<SofortUpdateErgebnis> | null = null;
let hintergrundVersuch: Promise<HintergrundUpdateErgebnis> | null = null;

function istAndroidApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

async function fuehreSofortUpdateAus(): Promise<SofortUpdateErgebnis> {
  // getAppUpdateInfo muss vorausgehen: Das Plugin startet den Ablauf mit der
  // Auskunft, die es dabei bekommen hat (sonst INFO_MISSING).
  const info = await AppUpdate.getAppUpdateInfo();
  if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) return 'nicht_moeglich';
  if (info.immediateUpdateAllowed !== true) return 'nicht_moeglich';
  const { code } = await AppUpdate.performImmediateUpdate();
  if (code === AppUpdateResultCode.OK) return 'gestartet';
  if (code === AppUpdateResultCode.CANCELED) return 'abgelehnt';
  return 'nicht_moeglich';
}

/**
 * Sofort-Update ueber Googles Vollbild — nur auf Android und nur, wenn der
 * Aufrufer festgestellt hat, dass die Mindestversion unterschritten ist
 * (MindestversionHinweis). Wirft nie, laeuft hoechstens einmal je App-Start.
 */
export function versucheSofortUpdate(): Promise<SofortUpdateErgebnis> {
  if (!istAndroidApp()) return Promise.resolve('nicht_moeglich');
  if (!sofortVersuch) {
    sofortVersuch = fuehreSofortUpdateAus().catch((): SofortUpdateErgebnis => 'nicht_moeglich');
  }
  return sofortVersuch;
}

async function fuehreHintergrundUpdateAus(): Promise<HintergrundUpdateErgebnis> {
  // Die Antwort des Servers nur fuer die Mindestversion: Darunter ist das
  // Sofort-Update dran, ein zweiter Google-Dialog waere doppelt.
  await pruefeStoreUpdate();
  if (mindestversionUnterschritten) return NICHT_MOEGLICH;
  if (!networkMonitor.isOnline) return NICHT_MOEGLICH;

  // OB es ein Update gibt, sagt auf Android Google Play selbst — und zwar
  // fuer genau dieses Geraet (Track, gestaffelte Freigabe). Die Store-Version
  // des Servers stammt aus dem App Store und kann davon abweichen.
  const info = await AppUpdate.getAppUpdateInfo();
  const schluessel = PLAY_SCHLUESSEL_PREFIX + String(info.availableVersionCode ?? '');
  const geladenSchon = info.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED;
  if (!geladenSchon) {
    if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) return NICHT_MOEGLICH;
    if (info.flexibleUpdateAllowed !== true) return NICHT_MOEGLICH;
  }
  if (await istHinweisWeggeklickt(schluessel)) return { zustand: 'weggeklickt', schluessel };
  // In einem frueheren Start geladen, aber noch nicht installiert.
  if (geladenSchon) return { zustand: 'bereit', schluessel };

  // Zuhoeren, BEVOR der Ablauf startet — sonst ginge ein schnelles
  // "geladen" verloren.
  let melde: (zustand: HintergrundUpdateErgebnis['zustand']) => void = () => {};
  const geladen = new Promise<HintergrundUpdateErgebnis['zustand']>((aufloesen) => { melde = aufloesen; });
  const zuhoerer = await AppUpdate.addListener('onFlexibleUpdateStateChange', ({ installStatus }) => {
    if (installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) melde('bereit');
    else if (
      installStatus === FlexibleUpdateInstallStatus.FAILED
      || installStatus === FlexibleUpdateInstallStatus.CANCELED
    ) melde('nicht_moeglich');
  });
  try {
    const { code } = await AppUpdate.startFlexibleUpdate();
    if (code === AppUpdateResultCode.CANCELED) {
      // Nein zu genau diesem Update: wie das X der Karte, bis zum naechsten.
      await merkeHinweisWeggeklickt(schluessel);
      return { zustand: 'abgelehnt', schluessel };
    }
    if (code !== AppUpdateResultCode.OK) return NICHT_MOEGLICH;
    const zustand = await geladen;
    return zustand === 'bereit' ? { zustand, schluessel } : NICHT_MOEGLICH;
  } finally {
    void zuhoerer.remove().catch(() => { /* Zuhoerer schon weg */ });
  }
}

/**
 * Flexibles Update: Google fragt einmal, laedt im Hintergrund und meldet
 * 'bereit', sobald das Update geladen ist. Nur auf Android und nicht unter
 * der Mindestversion; ob es ein Update gibt, sagt Google Play. Wirft nie,
 * laeuft hoechstens einmal je App-Start; wer spaeter fragt, bekommt dasselbe
 * Ergebnis.
 */
export function holeUpdateImHintergrund(): Promise<HintergrundUpdateErgebnis> {
  if (!istAndroidApp()) return Promise.resolve(NICHT_MOEGLICH);
  if (!hintergrundVersuch) {
    hintergrundVersuch = fuehreHintergrundUpdateAus().catch(() => NICHT_MOEGLICH);
  }
  return hintergrundVersuch;
}

/**
 * Installiert das geladene Update; Google startet die App dabei neu.
 * Geht das nicht, oeffnet sie die Seite der App bei Google Play.
 * false, wenn auch das nicht ging.
 */
export async function installiereGeladenesUpdate(): Promise<boolean> {
  try {
    await AppUpdate.completeFlexibleUpdate();
    return true;
  } catch {
    try {
      await AppUpdate.openAppStore();
      return true;
    } catch {
      return false;
    }
  }
}

// Nur fuer Tests: Session-Memo zuruecksetzen.
export function _nurFuerTests_reset(): void {
  laufendePruefung = null;
  mindestversionUnterschritten = false;
  sofortVersuch = null;
  hintergrundVersuch = null;
}
