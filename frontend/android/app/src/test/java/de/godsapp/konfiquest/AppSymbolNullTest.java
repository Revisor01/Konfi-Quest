package de.godsapp.konfiquest;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * AppSymbolNull -- die Sammel-Mitteilung mit 0 beim Oeffnen der App
 * (01.10.2026, Simon: "eine 0 muss doch weg oder nicht?").
 */
public class AppSymbolNullTest {

    @Test
    public void mitNullGekommenUndNichtsOffen_weg() {
        // "Gleich: Konfistunde um 16:00 Uhr" bei nichts Offenem: Samsung
        // zeigte eine 1, das iPhone nichts.
        assertTrue(AppSymbolNull.beimOeffnenWegnehmen(0, 0));
    }

    @Test
    public void keineZahlGemerkt_giltAlsNull() {
        // Frisch installiert oder Daten geloescht: keine Zahl bekannt.
        assertTrue(AppSymbolNull.beimOeffnenWegnehmen(0, -1));
    }

    @Test
    public void mitZahl_bleibt() {
        // Sie traegt die Zahl am Symbol -- ohne sie stuende dort nichts.
        assertFalse(AppSymbolNull.beimOeffnenWegnehmen(3, 3));
        assertFalse(AppSymbolNull.beimOeffnenWegnehmen(1, 0));
    }

    @Test
    public void nullAberGemerkteZahl_bleibt() {
        // Eine Erhoehung kam an, die Mitteilung ist noch nicht nachgefuehrt:
        // Sie bleibt als Traeger der Zahl.
        assertFalse(AppSymbolNull.beimOeffnenWegnehmen(0, 2));
    }
}
