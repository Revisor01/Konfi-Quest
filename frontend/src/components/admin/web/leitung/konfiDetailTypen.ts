// Die Daten der Detailseite einer Konfi bzw. Teamer:in (GET /admin/konfis/:id und
// die Abrufe daneben), so wie die Web-Fassung sie liest. Die Formen sind die der
// Seite (admin/views/KonfiDetailView.tsx): Sie haelt Daten und Aktionen, die
// Web-Fassung stellt sie dar.

import type { Activity, Konfi } from '../../views/KonfiDetailSections';
import type { BonusEintrag, EventPunkteEintrag } from '../../../../types/user';
import type { KonfiZeit } from '../../../../types/konfiZeit';
import type { ChallengeMark, OffenerStempel } from '../../../../types/challenges';
import type { WrappedHistoryEntry } from '../../../../types/wrapped';

export interface TeamerTermin {
  id: number;
  name: string;
  event_date: string;
  location: string;
  teamer_only: boolean;
  teamer_needed: boolean;
  booking_status: string;
  booking_date: string;
}

export interface Zertifikat {
  id: number;
  certificate_type_id: number;
  name: string;
  icon: string;
  issued_date: string;
  expiry_date: string | null;
  status: string;
}

export interface KonfiHistorie {
  history: Array<{ id: number; title: string; points: number; category: string; date: string; source_type: string; event_date?: string | null }>;
  totals: { gottesdienst: number; gemeinde: number; total: number };
}

export interface Anwesenheit {
  total_mandatory: number;
  attended: number;
  percentage: number;
  missed_events?: Array<{
    event_id: number;
    event_name: string;
    event_date: string;
    location: string;
    status: 'opted_out' | 'absent';
    opt_out_reason: string | null;
  }>;
}

export interface KonfiPunkteSumme {
  gottesdienst: number;
  gemeinde: number;
  gesamt: number;
  bonus: number;
}

export interface WebKonfiDetailProps {
  konfiId: number;
  laedt: boolean;
  /** Die Person ist eine Teamer:in (befoerderte Konfi oder Teamer:in). */
  istTeamer: boolean;
  konfi: Konfi | null;
  punkte: KonfiPunkteSumme;
  /** Verbuchte Aktivitaeten UND offene Antraege (isPending), wie in der App gemischt. */
  aktivitaeten: Activity[];
  bonus: BonusEintrag[];
  eventPunkte: EventPunkteEintrag[];
  teamerEvents: TeamerTermin[];
  zertifikate: Zertifikat[];
  konfiHistorie: KonfiHistorie | null;
  konfiZeit: KonfiZeit | null;
  anwesenheit: Anwesenheit | null;
  rueckblicke: WrappedHistoryEntry[];
  stempel: ChallengeMark[];
  offeneStempel: OffenerStempel[];
  isOnline: boolean;
  /** Fuer die Fenster, die auf dieser Seite aufklappen (Ionic-Modale). */
  pageRef?: React.Ref<HTMLElement>;

  // --- Aktionen (dieselben Fenster und Rueckfragen wie in der App) ---
  onNeuLaden: () => void;
  onBearbeiten: () => void;
  onAktivitaetEintragen: () => void;
  onBonusVergeben: () => void;
  onZertifikatZuweisen: () => void;
  onPasswort: () => void;
  onBefoerdern: () => void;
  onMatrix: () => void;
  onAktivitaetLoeschen: (aktivitaet: Activity) => void;
  onBonusLoeschen: (bonus: BonusEintrag) => void;
  onZertifikatEntfernen: (zertifikat: { id: number; name: string }) => void;
  onFoto: (aktivitaet: Activity) => void;
  onRueckblick: (eintrag: WrappedHistoryEntry) => void;
  /** Datum als 'JJJJ-MM-TT'. */
  onTeamerSeit: (datum: string) => void;
}
