// Textbausteine der Support-Ansicht als Logik ohne Darstellung
// (/admin/support/bausteine, Support-Mail, 03.10.2026, Entscheidung 6):
// Bausteine laden, anlegen, bearbeiten, loeschen (mit Rueckfrage), Platzhalter
// in den Text einfuegen; Absendername und Fusszeile laden und speichern. Die
// App-Fassung (SupportTextbausteinePage) und die Web-Fassung
// (web/WebTextbausteine) zeigen dieselbe Logik.

import { useCallback, useEffect, useState } from 'react';
import { useIonAlert } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type { MailBaustein, MailEinstellungen } from '../../types/support';
import {
  LEERER_BAUSTEIN,
  bausteinFehler,
  bausteinFormular,
  bausteinKoerper,
  bausteineSortiert,
  platzhalterMarke,
  type BausteinFormular,
} from '../../utils/supportMail';
import { fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';

export function useTextbausteine() {
  const { setError, setSuccess, isOnline } = useApp();
  const [presentAlert] = useIonAlert();

  const [bausteine, setBausteine] = useState<MailBaustein[] | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState(false);
  const [formular, setFormular] = useState<BausteinFormular>(LEERER_BAUSTEIN);
  const [bearbeitet, setBearbeitet] = useState<MailBaustein | null>(null);
  const [speichert, setSpeichert] = useState(false);

  const [einstellungen, setEinstellungen] = useState<MailEinstellungen | null>(null);
  const [einstellungenFehlen, setEinstellungenFehlen] = useState(false);
  const [absendername, setAbsendername] = useState('');
  const [fusszeile, setFusszeile] = useState('');
  const [speichertEinstellungen, setSpeichertEinstellungen] = useState(false);

  // Erst warten, dann Zustand setzen (der erste Abruf laeuft im Effekt).
  const bausteineHolen = useCallback(async () => {
    try {
      const antwort = await api.get('/support/mail/bausteine');
      setBausteine(Array.isArray(antwort.data) ? bausteineSortiert(antwort.data) : []);
      setFehler(false);
    } catch {
      setBausteine(null);
      setFehler(true);
    } finally {
      setLaedt(false);
    }
  }, []);

  const einstellungenHolen = useCallback(async () => {
    try {
      const antwort = await api.get('/support/mail/einstellungen');
      const daten = antwort.data && typeof antwort.data === 'object' ? antwort.data as Partial<MailEinstellungen> : {};
      const werte = { fusszeile: daten.fusszeile ?? '', absendername: daten.absendername ?? '' };
      setEinstellungen(werte);
      setFusszeile(werte.fusszeile);
      setAbsendername(werte.absendername);
      setEinstellungenFehlen(false);
    } catch {
      setEinstellungenFehlen(true);
    }
  }, []);

  useEffect(() => {
    void bausteineHolen();
    void einstellungenHolen();
  }, [bausteineHolen, einstellungenHolen]);

  const laden = () => {
    setLaedt(true);
    setFehler(false);
    return Promise.all([bausteineHolen(), einstellungenHolen()]);
  };

  const aendern = (teil: Partial<BausteinFormular>) => setFormular((f) => ({ ...f, ...teil }));

  const formularLeeren = () => {
    setFormular(LEERER_BAUSTEIN);
    setBearbeitet(null);
  };

  const bearbeiten = (b: MailBaustein) => {
    setBearbeitet(b);
    setFormular(bausteinFormular(b));
  };

  const speichern = async () => {
    if (offlineBlockiert(isOnline, setError)) return;
    const meldung = bausteinFehler(formular);
    if (meldung) {
      setError(meldung);
      return;
    }
    setSpeichert(true);
    const koerper = bausteinKoerper(formular);
    try {
      if (bearbeitet) {
        await api.put(`/support/mail/bausteine/${bearbeitet.id}`, koerper);
        setSuccess('Baustein gespeichert');
      } else {
        await api.post('/support/mail/bausteine', koerper);
        setSuccess('Baustein angelegt');
      }
      formularLeeren();
      await bausteineHolen();
    } catch (err) {
      setError(fehlerText(err, 'Baustein konnte nicht gespeichert werden'));
    } finally {
      setSpeichert(false);
    }
  };

  const loeschen = (b: MailBaustein) => {
    if (offlineBlockiert(isOnline, setError)) return;
    presentAlert({
      header: 'Baustein löschen',
      message: `„${b.titel}“ löschen? Das lässt sich nicht rückgängig machen.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            void (async () => {
              try {
                await api.delete(`/support/mail/bausteine/${b.id}`);
                setSuccess('Baustein gelöscht');
                if (bearbeitet?.id === b.id) formularLeeren();
                await bausteineHolen();
              } catch (err) {
                setError(fehlerText(err, 'Baustein konnte nicht gelöscht werden'));
              }
            })();
          },
        },
      ],
    });
  };

  const platzhalterEinfuegen = (schluessel: string) => {
    const marke = platzhalterMarke(schluessel);
    setFormular((f) => ({ ...f, text: f.text && !/\s$/.test(f.text) ? `${f.text} ${marke}` : `${f.text}${marke}` }));
  };

  const einstellungenSpeichern = async () => {
    if (offlineBlockiert(isOnline, setError)) return;
    setSpeichertEinstellungen(true);
    const koerper: MailEinstellungen = { fusszeile: fusszeile.replace(/\s+$/, ''), absendername: absendername.trim() };
    try {
      await api.put('/support/mail/einstellungen', koerper);
      setEinstellungen(koerper);
      setFusszeile(koerper.fusszeile);
      setAbsendername(koerper.absendername);
      setSuccess('Absender und Fußzeile gespeichert');
    } catch (err) {
      setError(fehlerText(err, 'Absender und Fußzeile konnten nicht gespeichert werden'));
    } finally {
      setSpeichertEinstellungen(false);
    }
  };

  const einstellungenGeaendert = einstellungen !== null
    && (fusszeile.replace(/\s+$/, '') !== einstellungen.fusszeile || absendername.trim() !== einstellungen.absendername);

  return {
    isOnline,
    bausteine,
    laedt,
    fehler,
    formular,
    bearbeitet,
    speichert,
    einstellungen,
    einstellungenFehlen,
    absendername,
    setAbsendername,
    fusszeile,
    setFusszeile,
    speichertEinstellungen,
    laden,
    aendern,
    formularLeeren,
    bearbeiten,
    speichern,
    loeschen,
    platzhalterEinfuegen,
    einstellungenSpeichern,
    einstellungenGeaendert,
  };
}

export type TextbausteineDaten = ReturnType<typeof useTextbausteine>;
