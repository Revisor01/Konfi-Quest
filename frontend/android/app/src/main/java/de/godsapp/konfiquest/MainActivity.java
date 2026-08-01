package de.godsapp.konfiquest;

import android.content.pm.ActivityInfo;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Orientierung geraeteabhaengig festlegen.
 *
 * Das Manifest deklariert "fullUser", damit Tablets frei drehen koennen (der
 * Chat nutzt im Querformat einen Split-View aus Raumliste und Raum). Auf
 * Telefonen ist Querformat aber unerwuenscht — dort wird die Activity hier
 * wieder auf Hochformat festgelegt.
 *
 * Schwelle: smallestScreenWidthDp >= 600 = Tablet (dieselbe Grenze wie der
 * sw600dp-Ressourcen-Qualifier und wie der Split-View im Frontend).
 */
public class MainActivity extends BridgeActivity {

    private static final int TABLET_SMALLEST_WIDTH_DP = 600;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        boolean isTablet = getResources().getConfiguration().smallestScreenWidthDp >= TABLET_SMALLEST_WIDTH_DP;
        if (!isTablet) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }
    }
}
