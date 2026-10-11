// „Aktivität prüfen" der Leitung -- als Logik ohne Darstellung. Die App
// (Modal ActivityRequestModal) und die Web-Fassung (Dialog
// web/termine/WebAntragPruefenDialog) zeigen dieselbe Logik (wie im Support:
// useEinsortieren, useNeuerVorgang):
//
//   - Laden: GET /admin/activities/requests/:id -- nur DIESER Antrag
//     (28.09.2026, Leitung BF-04), in der Form eines Listeneintrags.
//   - Vorbelegt: die Begründung mit admin_comment des Antrags, keine
//     Entscheidung gewählt.
//   - Foto löschen: DELETE /admin/activities/requests/:id/photo.
//   - Entscheiden: PUT /admin/activities/requests/:id
//       { status: 'approved' | 'rejected', admin_comment }
//     Ablehnen nur mit Begründung. Ohne Netz in die Warteschlange; danach
//     lädt die Seite neu (onSuccess) und das Fenster schließt (onClose).
//   - Fehler meldet die App als Meldung (setError); der Web-Dialog zeigt sie
//     im Fenster (fehlerImFenster).
//
// triggerRefresh nicht hier: Das Modal der App rendert via useIonModal
// außerhalb des Provider-Baums. Die Seite stößt es in onSuccess an.

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
import api from '../../../services/api';
import { writeQueue } from '../../../services/writeQueue';
import { networkMonitor } from '../../../services/networkMonitor';
import { trackHandlung } from '../../../services/analytics';
import { fehlerText } from '../../../utils/fehler';
import { safeUUID } from '../../../utils/uuid';

export interface PruefAntrag {
  id: number;
  konfi_id: number;
  konfi_name: string;
  jahrgang_name?: string;
  activity_id: number;
  activity_name: string;
  activity_type?: string;
  activity_points?: number;
  activity_target_role?: 'konfi' | 'teamer';
  requested_date: string;
  comment?: string;
  photo_filename?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment?: string;
  approved_by?: number;
  approved_by_name?: string;
  created_at: string;
  updated_at: string;
  /**
   * Darf die angemeldete Leitung über diesen Antrag entscheiden
   * (genehmigen, ablehnen, zurücksetzen)? Recht „Anträge entscheiden" je
   * Jahrgang (09.10.2026). Fehlt bei älteren Servern -- dann wie bisher.
   */
  darf_entscheiden?: boolean;
}

export type AntragEntscheidung = 'approve' | 'reject';

export const GRUND_FEHLT = 'Bitte gib einen Grund für die Ablehnung an';

export interface AntragPruefenOptionen {
  requestId?: number | null;
  /** Nach der Entscheidung (gesendet oder eingereiht): die Seite lädt neu. */
  onSuccess: () => void;
  /** Schließt das Fenster. */
  onClose: () => void;
  /** Prüfung und Fehler im Fenster zeigen (Web-Dialog) statt als Meldung der App. */
  fehlerImFenster?: boolean;
}

export function useAntragPruefen({ requestId, onSuccess, onClose, fehlerImFenster = false }: AntragPruefenOptionen) {
  const { setSuccess, setError: meldungDerApp, isOnline } = useApp();
  const { isSubmitting, guard } = useActionGuard();
  const [loading, setLoading] = useState(false);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [request, setRequest] = useState<PruefAntrag | null>(null);
  const [adminComment, setAdminCommentRoh] = useState('');
  const [selectedAction, setSelectedAction] = useState<AntragEntscheidung | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Prüfung und Fehler: in der App als Meldung (setError aus AppContext,
  // mit der anonymen Fehlermessung), im Web-Dialog im Fenster. Heißt
  // bewusst setError: Die Positivliste der Fehlertexte
  // (bekannteFehlertexte.test.ts) liest die Texte an den Aufrufstellen von
  // setError -- in der App gehen sie genau dorthin.
  // Ist der Dialog schon fort (er ist während des Sendens gesperrt, aber die
  // Seite kann verlassen werden), käme ein Fehler im Fenster nirgends an: Er
  // geht dann als Meldung der App.
  const dialogDa = useRef(true);
  useEffect(() => {
    dialogDa.current = true;
    return () => { dialogDa.current = false; };
  }, []);
  const setError = (text: string) => (fehlerImFenster && dialogDa.current ? setFehler(text) : meldungDerApp(text));

  const loadRequest = async () => {
    if (!requestId) return;

    setLoading(true);
    setLadeFehler(null);
    try {
      // Nur DIESER Antrag (28.09.2026, Leitung BF-04). Vorher kam die ganze
      // Antragsgeschichte der Gemeinde über die Leitung, um per .find() einen
      // Eintrag herauszusuchen. Die Antwort hat die Form eines Listeneintrags.
      const response = await api.get<PruefAntrag>(`/admin/activities/requests/${requestId}`);
      const foundRequest = response.data;
      setRequest(foundRequest);
      setAdminCommentRoh(foundRequest.admin_comment || '');
      // Das Nachweisfoto lädt NachweisFoto selbst, sobald es gezeigt wird —
      // für die Leitung in jedem Status (auch verbucht/abgelehnt).
    } catch (err) {
      // 404: Antrag gibt es (in dieser Gemeinde) nicht; 403: Konfi außerhalb
      // der eigenen Jahrgänge. Beides meldet der Server mit eigenem Text.
      const text = fehlerText(err, 'Fehler beim Laden der Aktivität');
      if (fehlerImFenster) setLadeFehler(text);
      else meldungDerApp(text);
      console.error('Error loading request:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (requestId) {
      void loadRequest();
    }
    // Nur der Antrag bestimmt, was geladen wird (wie bisher im Modal).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const handleDeletePhoto = async () => {
    if (!request) return;
    setDeletingPhoto(true);
    try {
      await api.delete(`/admin/activities/requests/${request.id}/photo`);
      // Ohne photo_filename haengt NachweisFoto ab und gibt dabei seine
      // Blob-URL frei (Befund 30.08.2026, geprueft in
      // adminActivityRequestFoto).
      setRequest({ ...request, photo_filename: undefined });
      setSuccess('Foto erfolgreich gelöscht');
    } catch (err) {
      setError('Fehler beim Löschen des Fotos');
      console.error('Error deleting photo:', err);
    } finally {
      setDeletingPhoto(false);
    }
  };

  /**
   * Entscheidet über den Antrag. Die App wählt erst (selectedAction) und
   * bestätigt dann mit dem Haken; der Web-Dialog entscheidet mit einem Knopf
   * je Entscheidung und gibt sie mit.
   */
  const handleSubmit = async (aktion: AntragEntscheidung | null = selectedAction) => {
    // Nur eine echte Entscheidung -- kein Klick-Ereignis, das ein onClick
    // als erstes Argument weiterreicht (es fiele sonst unter „Ablehnen").
    if (!request || (aktion !== 'approve' && aktion !== 'reject')) return;

    if (aktion === 'reject' && !adminComment.trim()) {
      setError(GRUND_FEHLT);
      return;
    }
    setFehler(null);

    await guard(async () => {
      const body = {
        status: aktion === 'approve' ? 'approved' : 'rejected',
        admin_comment: adminComment
      };

      if (networkMonitor.isOnline) {
        try {
          await api.put(`/admin/activities/requests/${request.id}`, body);
          // Anonyme Messung NACH der erfolgreichen Antwort: wie oft wird
          // angenommen, wie oft abgelehnt, bei Konfis und beim Team (Simon,
          // 27.09.2026). Kein Grund, keine Aktivitaet, keine Punkte, keine
          // Person. Offline eingereiht zaehlt nicht — dort ist noch nichts
          // entschieden.
          trackHandlung('antrag-entschieden', {
            entscheidung: aktion === 'approve' ? 'angenommen' : 'abgelehnt',
            antrag_von: request.activity_target_role
          });
          // Die Seite laedt neu (onSuccess + useLiveRefresh)
          onSuccess();
          onClose();
        } catch (err) {
          setError(fehlerText(err, `Fehler beim ${aktion === 'approve' ? 'Genehmigen' : 'Ablehnen'} der Aktivität`));
        }
      } else {
        await writeQueue.enqueue({
          method: 'PUT',
          url: `/admin/activities/requests/${request.id}`,
          body,
          maxRetries: 5,
          hasFileUpload: false,
          metadata: {
            type: 'admin',
            clientId: safeUUID(),
            label: `Aktivität ${aktion === 'approve' ? 'genehmigen' : 'ablehnen'}`
          }
        });
        setSuccess('Wird gespeichert sobald du wieder online bist');
        // Die Seite laedt neu (onSuccess + useLiveRefresh)
        onSuccess();
        onClose();
      }
    });
  };

  const isPending = request?.status === 'pending';
  const isApproved = request?.status === 'approved';
  // Recht "Anträge entscheiden" (09.10.2026). Nur ein ausdrückliches false
  // nimmt die Knöpfe weg -- fehlt das Feld (älterer Server), bleibt alles wie
  // bisher; der Server prüft ohnehin selbst (403).
  const darfEntscheiden = request?.darf_entscheiden !== false;

  return {
    request,
    loading,
    /** Nur im Web-Dialog: Der Antrag ließ sich nicht laden (Text des Servers). */
    ladeFehler,
    erneutLaden: () => { void loadRequest(); },
    adminComment,
    setAdminComment: (text: string) => { setFehler(null); setAdminCommentRoh(text); },
    selectedAction,
    setSelectedAction,
    deletingPhoto,
    handleDeletePhoto,
    handleSubmit,
    isSubmitting,
    isPending,
    isApproved,
    darfEntscheiden,
    /** Nur im Web-Dialog: Prüfung oder Fehler des Servers. */
    fehler,
    /** Für den Hinweis im Web-Dialog: Ohne Netz geht die Entscheidung in die Warteschlange. */
    ohneNetz: !isOnline,
  };
}

export type AntragPruefenZustand = ReturnType<typeof useAntragPruefen>;
