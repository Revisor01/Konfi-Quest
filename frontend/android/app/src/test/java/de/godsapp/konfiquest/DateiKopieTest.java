package de.godsapp.konfiquest;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

/**
 * DateiKopie -- das reine Java der Dateiauswahl auf Android (30.09.2026).
 * Tester-Rueckmeldung Build 130: PDF und Word gingen vom Android-Handy weder
 * im Chat noch im Material hoch; die gewaehlte Datei wird deshalb vor der
 * Uebergabe ans WebView in den Cache kopiert (DateiAuswahlChromeClient).
 */
public class DateiKopieTest {

    @Rule
    public TemporaryFolder ordner = new TemporaryFolder();

    @Test
    public void kopiertDokumenteUndDateienOhneTyp() {
        assertTrue(DateiKopie.sollKopieren("application/pdf"));
        assertTrue(DateiKopie.sollKopieren("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
        assertTrue(DateiKopie.sollKopieren("application/octet-stream"));
        assertTrue(DateiKopie.sollKopieren(null));
    }

    @Test
    public void laesstBilderUndVideosUnveraendert() {
        assertFalse(DateiKopie.sollKopieren("image/jpeg"));
        assertFalse(DateiKopie.sollKopieren("IMAGE/HEIC"));
        assertFalse(DateiKopie.sollKopieren("video/mp4"));
    }

    @Test
    public void behaeltDenNamenMitUmlautenUndLeerzeichen() {
        assertEquals("Elternbrief März 2026.pdf", DateiKopie.dateiname("Elternbrief März 2026.pdf", "pdf"));
    }

    @Test
    public void ergaenztDieEndungAusDemTyp() {
        assertEquals("Elternbrief.pdf", DateiKopie.dateiname("Elternbrief", "pdf"));
        assertEquals("Datei.docx", DateiKopie.dateiname(null, "docx"));
        assertEquals("Datei", DateiKopie.dateiname("", null));
    }

    @Test
    public void entferntNurWasImDateisystemNichtGeht() {
        assertEquals("_etc_passwd.pdf", DateiKopie.dateiname("/etc/passwd", "pdf"));
        assertEquals("a_b_c.pdf", DateiKopie.dateiname("a\\b:c.pdf", "pdf"));
        assertEquals("Datei.pdf", DateiKopie.dateiname("..", "pdf"));
        assertEquals("versteckt.pdf", DateiKopie.dateiname(".versteckt.pdf", "pdf"));
        assertEquals("Zeile_Umbruch.pdf", DateiKopie.dateiname("Zeile\nUmbruch.pdf", "pdf"));
    }

    @Test
    public void kuerztLangeNamenUndBehaeltDieEndung() {
        String lang = "x".repeat(300) + ".docx";
        String name = DateiKopie.dateiname(lang, "docx");
        assertEquals(DateiKopie.NAME_HOECHSTENS, name.length());
        assertTrue(name.endsWith(".docx"));
    }

    @Test
    public void kopiertDenInhaltVollstaendig() throws IOException {
        byte[] inhalt = new byte[200_000];
        for (int i = 0; i < inhalt.length; i++) inhalt[i] = (byte) (i % 251);
        File ziel = new File(ordner.getRoot(), "brief.pdf");
        assertTrue(DateiKopie.kopieren(new ByteArrayInputStream(inhalt), ziel, 1_000_000));
        assertArrayEquals(inhalt, Files.readAllBytes(ziel.toPath()));
    }

    @Test
    public void brichtUeberDerGrenzeAbUndLaesstNichtsLiegen() throws IOException {
        File ziel = new File(ordner.getRoot(), "gross.pdf");
        assertFalse(DateiKopie.kopieren(new ByteArrayInputStream(new byte[1001]), ziel, 1000));
        assertFalse(ziel.exists());
    }

    @Test
    public void genauAufDerGrenzeGehtEsNoch() throws IOException {
        File ziel = new File(ordner.getRoot(), "grenze.pdf");
        assertTrue(DateiKopie.kopieren(new ByteArrayInputStream(new byte[1000]), ziel, 1000));
        assertEquals(1000, ziel.length());
    }

    @Test
    public void lesefehlerLaesstKeineHalbeDateiLiegen() {
        File ziel = new File(ordner.getRoot(), "halb.pdf");
        InputStream kaputt = new InputStream() {
            private int n = 0;
            @Override
            public int read() throws IOException {
                if (n++ > 10) throw new IOException("Anbieter weg");
                return 1;
            }
        };
        try {
            DateiKopie.kopieren(kaputt, ziel, 1000);
        } catch (IOException erwartet) {
            assertFalse(ziel.exists());
            return;
        }
        throw new AssertionError("Lesefehler wurde verschluckt");
    }

    @Test
    public void raeumtNurAlteKopienWeg() throws IOException {
        File wurzel = ordner.newFolder("dateiauswahl");
        File alt = new File(wurzel, "1-0");
        File neu = new File(wurzel, "2-0");
        assertTrue(alt.mkdirs());
        assertTrue(neu.mkdirs());
        Files.write(new File(alt, "alt.pdf").toPath(), new byte[] {1});
        Files.write(new File(neu, "neu.pdf").toPath(), new byte[] {1});
        long jetzt = System.currentTimeMillis();
        assertTrue(alt.setLastModified(jetzt - DateiKopie.AUFBEWAHREN_MS - 1000));

        DateiKopie.aufraeumen(wurzel, jetzt, DateiKopie.AUFBEWAHREN_MS);

        assertFalse(alt.exists());
        assertTrue(new File(neu, "neu.pdf").exists());
    }

    @Test
    public void aufraeumenOhneOrdnerIstKeinFehler() {
        DateiKopie.aufraeumen(new File(ordner.getRoot(), "gibt-es-nicht"), 0, 0);
    }
}
