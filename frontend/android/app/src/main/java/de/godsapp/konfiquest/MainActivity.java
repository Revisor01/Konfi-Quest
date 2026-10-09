package de.godsapp.konfiquest;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.activity.EdgeToEdge;

import com.getcapacitor.BridgeActivity;

/**
 * Sichtschutz im App-Umschalter (Simons Befund 15.09.2026, echtes Geraet:
 * "Wenn die App per Biometrie gesperrt ist, wird sie im App-Switcher trotzdem
 * MIT INHALT angezeigt").
 *
 * Auf iOS reicht dafuer eine Abdeckung im WebView, weil dort die Momentaufnahme
 * vom eingefrorenen Bild gemacht wird. Android schiesst das Vorschaubild am
 * WebView vorbei -- eine HTML-Flaeche kann dort grundsaetzlich zu spaet kommen.
 * Der verlaessliche Weg ist FLAG_SECURE: Das System zeigt die App im Umschalter
 * dann als leere Flaeche.
 *
 * WARUM DAS FLAG NICHT DAUERHAFT GESETZT IST -- die eigentliche Entscheidung:
 * FLAG_SECURE verbietet JEDE Bildschirmaufnahme in der ganzen App, nicht nur
 * das Vorschaubild. Wer einen Termin, einen QR-Code oder seinen Punktestand
 * abfotografieren will, kann das dann nicht mehr. Das waere eine spuerbare
 * Einschraenkung fuer ALLE -- auch fuer die grosse Mehrheit, die die Sperre gar
 * nicht nutzt (Voreinstellung ist 'aus'). Deshalb haengt das Flag an genau
 * derselben Einstellung wie die Sperre selbst: eingeschaltet -> Flag gesetzt,
 * 'aus' -> kein Flag und damit keine Verhaltensaenderung.
 *
 * WARUM DIREKT AUS DEN SharedPreferences UND NICHT UEBER DIE BRUECKE:
 * Das Flag muss stehen, BEVOR das erste Bild existiert. Ein Weg ueber
 * JavaScript kaeme erst, wenn der WebView laeuft -- also moeglicherweise nach
 * der ersten Momentaufnahme. Gelesen wird deshalb genau der Topf, in den das
 * Preferences-Plugin schreibt (group "CapacitorStorage", Schluessel wie in
 * services/appSperre.ts). Bleibt die Stelle leer, gilt 'aus' -- dieselbe
 * Voreinstellung wie im JavaScript.
 */
public class MainActivity extends BridgeActivity {

    /** Topf des Capacitor-Preferences-Plugins (PreferencesConfiguration.DEFAULTS.group). */
    private static final String TOPF = "CapacitorStorage";

    /** Schluessel der Sperr-Einstellung, identisch zu services/appSperre.ts. */
    private static final String SCHLUESSEL = "konfi_app_sperre_verzoegerung";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Eigene Plugins VOR super.onCreate anmelden: Dort entsteht die
        // Bruecke, und sie kennt danach nur, was bis dahin angemeldet ist.
        // AppSymbolZahl setzt auf Android die Zahl am App-Symbol
        // (services/appSymbolZahl.ts, 29.09.2026).
        registerPlugin(AppSymbolZahlPlugin.class);
        super.onCreate(savedInstanceState);
        // Randlose Anzeige auf JEDER Android-Version (09.10.2026, Play Console
        // "randlose Anzeige ab Android 15"). Ab Android 15 erzwingt das System
        // sie fuer targetSdk 35+ ohnehin; auf Android 7 bis 14 lag die App
        // bisher nur oben unter der (durchsichtigen) Statusleiste, unten stand
        // eine eigene Navigationsleiste. So sieht sie ueberall aus wie ab 15.
        // Die Insets traegt das eingebaute SystemBars-Plugin als
        // --safe-area-inset-* in die Seite (theme/variables.css, Ionics
        // --ion-safe-area-*); die Symbolfarbe folgt bei beiden dem
        // Telefon-Thema (capacitor.config.ts, SystemBars style DEFAULT).
        //
        // NACH super.onCreate, nicht davor: EdgeToEdge holt sich die
        // DecorView. Davor gaebe es sie nur mit dem Start-Thema (Splash) --
        // BridgeActivity setzt AppTheme.NoActionBar erst in super.onCreate,
        // und eine einmal gebaute DecorView liest das Thema nicht neu.
        //
        // Die eingestellten Farb-APIs (Window.setStatusBarColor/
        // setNavigationBarColor) ruft androidx.activity bis 1.11 (aufgeloest:
        // 1.10.1) nur auf Android 6 bis 10; ab Android 11 setzt es nur Flags
        // und die Insets-Steuerung. 1.13 ruft sie auch ab Android 15 wieder --
        // vor einem Anheben im Bytecode nachsehen (EdgeToEdgeApi35).
        EdgeToEdge.enable(this);
        // Dateiauswahl: Dokumente als stabile Kopie ans WebView (30.09.2026,
        // PDF/Word gingen vom Android-Handy nicht hoch -- DateiAuswahlChromeClient).
        // Muss hier in onCreate stehen: Der Client meldet beim Anlegen seine
        // ActivityResult-Starter an, und das geht nur, bevor die Activity
        // gestartet ist. super.onCreate hat die Bruecke samt WebView gebaut.
        bridge.getWebView().setWebChromeClient(new DateiAuswahlChromeClient(bridge));
    }

    @Override
    public void onResume() {
        super.onResume();
        // Bei jeder Rueckkehr neu bewerten: Die Einstellung kann im Profil
        // geaendert worden sein, seit die Activity zuletzt sichtbar war.
        // onResume laeuft vor dem ersten Bild und ist damit frueh genug.
        sichtschutzAnwenden();
        // Samsung/Xiaomi: die Sammel-Mitteilung mit Zahl 0 beim Oeffnen
        // wegnehmen, sonst steht eine 1 am Symbol (01.10.2026,
        // AppSymbolZahl.beimOeffnen). Laeuft auch beim Kaltstart.
        AppSymbolZahl.beimOeffnen(this);
    }

    /** Setzt oder entfernt FLAG_SECURE nach der aktuellen Einstellung. */
    private void sichtschutzAnwenden() {
        if (sperreEingeschaltet()) {
            getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            );
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }
    }

    /**
     * Ist die App-Sperre eingeschaltet?
     * Jeder andere Wert als ein bekannter Sperrwert gilt als 'aus' -- inklusive
     * fehlendem Eintrag. Lieber kein Flag als eines, das niemand bestellt hat.
     */
    private boolean sperreEingeschaltet() {
        try {
            SharedPreferences topf = getSharedPreferences(TOPF, MODE_PRIVATE);
            String wert = topf.getString(SCHLUESSEL, null);
            return "sofort".equals(wert)
                || "1min".equals(wert)
                || "5min".equals(wert)
                || "15min".equals(wert);
        } catch (Exception e) {
            // Nicht lesbar -> wie 'aus' behandeln. Ein Absturz beim Start waere
            // ungleich schlimmer als ein fehlender Sichtschutz.
            return false;
        }
    }
}
