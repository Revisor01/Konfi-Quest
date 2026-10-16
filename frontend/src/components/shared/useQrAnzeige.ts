// Der QR-Code zum Einchecken eines Events -- als Logik ohne Darstellung
// (Simon, 15.10.2026, Seiten-Inventar: im Browser ab 992 px jedes Fenster
// als kompaktes Fenster der Web-Fassung, in den Apps und darunter das Modal
// wie bisher). Die App zeigt ihn im Modal (QRDisplayModal), der Browser im
// Dialog (web/termine/WebQrDialog) -- beide für Leitung und Team.
//
//   Code      POST /events/:id/generate-qr  -> qr_token, daraus das Bild
//   Zähler    GET  /events/:id/attendance-count, alle 10 Sekunden
//
// Abbruch-Merker (14.09.2026): Die Aufraeumfunktion lief bisher ins Leere,
// wenn das Fenster geschlossen wurde, WAEHREND loadQR noch auf den Server und
// die QR-Erzeugung wartete — pollRef.current war dann noch null, und der
// danach gesetzte Intervall fragte bis zum App-Neustart alle 10 Sekunden
// weiter ab, unsichtbar. Mehrfaches Oeffnen summierte die Timer.

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import api from '../../services/api';
import { useApp } from '../../contexts/AppContext';
import { QR_FARBEN } from '../../theme/colors';
import { fehlerText } from '../../utils/fehler';

/** Alle 10 Sekunden fragt das offene Fenster, wie viele schon eingecheckt sind. */
export const QR_ZAEHLER_ABSTAND_MS = 10000;

export function useQrAnzeige(eventId: number) {
  const { isOnline } = useApp();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState(0);
  const [total, setTotal] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abgebrochenRef = useRef(false);

  const fetchAttendance = async () => {
    try {
      const response = await api.get(`/events/${eventId}/attendance-count`);
      setCheckedIn(response.data.checked_in);
      setTotal(response.data.total);
    } catch {
      // Polling-Fehler still ignorieren
    }
  };

  const loadQR = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.post(`/events/${eventId}/generate-qr`);
      const token = response.data.qr_token;

      const dataUrl = await QRCode.toDataURL(token, {
        width: 512,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: QR_FARBEN.dunkel, light: QR_FARBEN.hell }
      });

      // Inzwischen geschlossen: weder anzeigen noch mit dem Abfragen anfangen.
      if (abgebrochenRef.current) return;

      setQrDataUrl(dataUrl);

      // Start polling -- ein erneuter Versuch startet keinen zweiten Zeitgeber.
      void fetchAttendance();
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(fetchAttendance, QR_ZAEHLER_ABSTAND_MS);
    } catch (err) {
      if (abgebrochenRef.current) return;
      setError(fehlerText(err, 'QR-Code konnte nicht generiert werden'));
    } finally {
      if (!abgebrochenRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    abgebrochenRef.current = false;
    void loadQR();
    return () => {
      abgebrochenRef.current = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  // Drucken: der Druckdialog des Systems; was gedruckt wird, regeln die
  // Druckregeln der jeweiligen Darstellung.
  const handlePrint = () => {
    window.print();
  };

  return { isOnline, qrDataUrl, loading, error, checkedIn, total, loadQR, handlePrint };
}
