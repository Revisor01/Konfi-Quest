// Support-Konten als Logik ohne Darstellung (/admin/support/konten,
// Entscheidungen 10 bis 15; Backend backend/routes/supportKonten.js): Konten
// ohne Gemeinde laden, anlegen, sperren und entsperren, Passwort setzen,
// loeschen -- jeweils mit Rueckfrage, wo es sich nicht rueckgaengig machen
// laesst. Die App-Fassung (SupportKontenPage) und die Web-Fassung
// (web/WebKonten) zeigen dieselbe Logik.
//
// Das letzte aktive Super-Admin-Konto laesst sich weder sperren noch loeschen;
// der Server antwortet dann 409 mit einem Satz, der sagt, was zu tun ist. Den
// zeigt die Seite als eigenen Hinweis statt als fluechtige Meldung. Das eigene
// Konto bietet sie gar nicht erst zum Sperren oder Loeschen an: Wer sich
// selbst sperrt, ist sofort draussen.

import { useCallback, useEffect, useState } from 'react';
import { useIonAlert } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type { SupportKonto } from '../../types/support';
import { fehlerStatus, fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { meldeSupportGeaendert, useSupportGeaendert } from '../../utils/supportAktualisieren';
import { isValidUsername } from '../../utils/usernameValidation';
import { istEmail, passwortRegelFehler } from '../../utils/supportAnfragen';

const BASIS = '/organizations/support-konten';

export interface NeuesKonto { username: string; display_name: string; email: string; password: string }
export const LEERES_KONTO: NeuesKonto = { username: '', display_name: '', email: '', password: '' };

/** Was am neuen Konto fehlt -- oder null. */
export function neuesKontoFehler(k: NeuesKonto): string | null {
  if (!k.username.trim() || !k.display_name.trim() || !k.password) return 'Alle Felder sind erforderlich';
  if (!isValidUsername(k.username.trim())) {
    return 'Benutzername darf nur Buchstaben, Zahlen, Punkt (.) und Bindestrich (-) enthalten — keine Leerzeichen oder Umlaute';
  }
  if (k.email.trim() && !istEmail(k.email)) return 'Ungültige E-Mail-Adresse';
  return passwortRegelFehler(k.password);
}

export function useSupportKonten() {
  const { user, setError, setSuccess, isOnline } = useApp();
  const [presentAlert] = useIonAlert();

  const [konten, setKonten] = useState<SupportKonto[] | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState(false);
  const [beschaeftigt, setBeschaeftigt] = useState(false);

  const [neu, setNeu] = useState<NeuesKonto | null>(null);
  const [neuPasswortZeigen, setNeuPasswortZeigen] = useState(false);
  const [passwortFuer, setPasswortFuer] = useState<{ id: number; password: string; zeigen: boolean } | null>(null);

  // Erst warten, dann Zustand setzen (der erste Abruf laeuft im Effekt).
  const holen = useCallback(async () => {
    try {
      const antwort = await api.get('/organizations/support-konten');
      setKonten(Array.isArray(antwort.data) ? antwort.data : []);
      setFehler(false);
    } catch {
      setKonten(null);
      setFehler(true);
    } finally {
      setLaedt(false);
    }
  }, []);

  useEffect(() => { void holen(); }, [holen]);
  useSupportGeaendert(holen);

  const laden = useCallback(() => {
    setLaedt(true);
    setFehler(false);
    return holen();
  }, [holen]);

  /**
   * 409 (letztes aktives Super-Admin-Konto, Benutzername vergeben) als
   * Hinweis, der stehen bleibt, bis man ihn wegdrueckt; alles andere als
   * Meldung.
   */
  const fehlerZeigen = (err: unknown, ersatz: string) => {
    if (fehlerStatus(err) === 409) {
      presentAlert({ header: 'Nicht möglich', message: fehlerText(err, ersatz), buttons: [{ text: 'Verstanden', role: 'cancel' }] });
    } else {
      setError(fehlerText(err, ersatz));
    }
  };

  const ausfuehren = async (aktion: () => Promise<unknown>, erfolg: string, ersatz: string): Promise<boolean> => {
    if (offlineBlockiert(isOnline, setError)) return false;
    setBeschaeftigt(true);
    try {
      await aktion();
      setSuccess(erfolg);
      meldeSupportGeaendert();
      return true;
    } catch (err) {
      fehlerZeigen(err, ersatz);
      return false;
    } finally {
      setBeschaeftigt(false);
    }
  };

  const anlegen = async () => {
    if (!neu) return;
    const meldung = neuesKontoFehler(neu);
    if (meldung) { setError(meldung); return; }
    const koerper = {
      username: neu.username.trim(),
      display_name: neu.display_name.trim(),
      password: neu.password,
      ...(neu.email.trim() ? { email: neu.email.trim() } : {}),
    };
    if (await ausfuehren(() => api.post('/organizations/support-konten', koerper), 'Support-Konto angelegt', 'Support-Konto konnte nicht angelegt werden')) {
      setNeu(null);
      setNeuPasswortZeigen(false);
    }
  };

  const sperrenUmschalten = (konto: SupportKonto) => {
    if (!konto.is_active) {
      void ausfuehren(() => api.patch(`${BASIS}/${konto.id}`, { is_active: true }), 'Konto entsperrt', 'Konto konnte nicht entsperrt werden');
      return;
    }
    presentAlert({
      header: 'Konto sperren',
      message: `„${konto.display_name}“ sperren? Alle Sitzungen des Kontos enden sofort; anmelden geht erst wieder nach dem Entsperren.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Sperren', role: 'destructive',
          handler: () => { void ausfuehren(() => api.patch(`${BASIS}/${konto.id}`, { is_active: false }), 'Konto gesperrt', 'Konto konnte nicht gesperrt werden'); },
        },
      ],
    });
  };

  const loeschen = (konto: SupportKonto) => {
    presentAlert({
      header: 'Support-Konto löschen',
      message: `„${konto.display_name}“ (${konto.username}) wirklich löschen? Gast-Mitgliedschaften, Chats und Mitteilungen des Kontos werden mit gelöscht. Das lässt sich nicht rückgängig machen.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen', role: 'destructive',
          handler: () => { void ausfuehren(() => api.delete(`${BASIS}/${konto.id}`), 'Support-Konto gelöscht', 'Support-Konto konnte nicht gelöscht werden'); },
        },
      ],
    });
  };

  const passwortSpeichern = async (konto: SupportKonto) => {
    if (!passwortFuer) return;
    const meldung = passwortRegelFehler(passwortFuer.password);
    if (meldung) { setError(meldung); return; }
    const setzen = async () => {
      if (await ausfuehren(
        () => api.put(`${BASIS}/${konto.id}/passwort`, { password: passwortFuer.password }),
        'Passwort gesetzt',
        'Passwort konnte nicht gesetzt werden'
      )) {
        setPasswortFuer(null);
      }
    };
    if (konto.id !== user?.id) { await setzen(); return; }
    presentAlert({
      header: 'Eigenes Passwort setzen',
      message: 'Alle Sitzungen dieses Kontos enden — auch diese. Danach meldest du dich mit dem neuen Passwort wieder an.',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Passwort setzen', handler: () => { void setzen(); } },
      ],
    });
  };

  return {
    userId: user?.id,
    isOnline,
    konten,
    laedt,
    fehler,
    beschaeftigt,
    neu,
    setNeu,
    neuPasswortZeigen,
    setNeuPasswortZeigen,
    passwortFuer,
    setPasswortFuer,
    laden,
    anlegen,
    sperrenUmschalten,
    loeschen,
    passwortSpeichern,
  };
}

export type SupportKontenDaten = ReturnType<typeof useSupportKonten>;
