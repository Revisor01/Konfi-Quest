package de.godsapp.konfiquest;

/**
 * Wann die App die Sammel-Mitteilung mit der Zahl 0 beim Oeffnen wegnimmt
 * (01.10.2026). Ohne Android-Klassen, damit es sich ohne Geraet pruefen
 * laesst (src/test/.../AppSymbolNullTest.java); angewandt in
 * AppSymbolZahl.beimOeffnen.
 *
 * Auf Samsung und Xiaomi (Weg "mitteilungen") rechnet der Startbildschirm die
 * Zahl am Symbol aus den liegenden Mitteilungen und zaehlt eine mit number 0
 * als 1. Eine Mitteilung, die schon mit 0 kam (nichts offen, etwa "Gleich:
 * Konfistunde um 16:00 Uhr"), liess deshalb eine 1 am Symbol stehen, bis sie
 * jemand antippte oder wegwischte -- auf dem iPhone steht dort nichts. Simon,
 * 01.10.2026: "eine 0 muss doch weg oder nicht?"
 *
 * Sofort wegnehmen ginge nicht: Dann saehe niemand die Mitteilung. Deshalb
 * beim Oeffnen der App -- wer die App oeffnet, hat sie vor sich. Die
 * Mitteilung mit Zahl, die auf 0 sinkt, nimmt weiter mitteilungNachfuehren.
 */
final class AppSymbolNull {

    private AppSymbolNull() {}

    /**
     * Soll die liegende Sammel-Mitteilung beim Oeffnen weg?
     *
     * Nur wenn sie selbst 0 traegt UND die zuletzt gesetzte Zahl 0 ist (oder
     * keine bekannt). Traegt sie eine Zahl, ist etwas offen -- dann traegt sie
     * die Zahl am Symbol und bleibt. Ist sie 0, die gemerkte Zahl aber nicht,
     * kam eine Erhoehung an, die die Mitteilung noch nicht nachgefuehrt hat
     * (das tut der naechste Aufruf von setzen); auch dann bleibt sie, damit
     * die Zahl einen Traeger hat.
     *
     * @param nummerDerMitteilung Notification.number der liegenden Sammel-Mitteilung
     * @param gemerkteZahl        zuletzt gesetzte Zahl am Symbol, negativ = unbekannt
     */
    static boolean beimOeffnenWegnehmen(int nummerDerMitteilung, int gemerkteZahl) {
        return nummerDerMitteilung == 0 && gemerkteZahl <= 0;
    }
}
