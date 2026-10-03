// Textbausteine der Support-Ansicht, /admin/support/bausteine (Support-Mail,
// 03.10.2026, docs/planung/support-mail.md, Entscheidung 6).
//
// Simon: „Gut wären ja auch automatische Versatzstücke für Mails. Und ein
// guter Footer wäre auch gut." Hier stehen die Bausteine (anlegen,
// bearbeiten, loeschen; je Postfach oder fuer beide), die Hilfe zu den sechs
// Platzhaltern und darunter Absendername und Fusszeile mit Vorschau. Namen
// gehoeren nicht ins oeffentliche Repo -- deshalb stehen sie nur hier in der
// Ansicht, nie im Code.

import React, { useCallback, useEffect, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  useIonAlert,
} from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import EmptyState from '../shared/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  ICON_BEARBEITEN,
  ICON_EINSTELLUNGEN,
  ICON_HILFE,
  ICON_HINZUFUEGEN,
  ICON_LOESCHEN,
  ICON_TEXTDOKUMENT,
} from '../shared/icons';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type { MailBaustein, MailEinstellungen, Postfach } from '../../types/support';
import {
  LEERER_BAUSTEIN,
  PLATZHALTER,
  POSTFACH_AUSWAHL,
  auszug,
  bausteinFehler,
  bausteinFormular,
  bausteinKoerper,
  bausteinPostfachText,
  bausteineSortiert,
  platzhalterMarke,
  vorschauText,
  type BausteinFormular,
} from '../../utils/supportMail';
import { fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { triggerPullHaptic } from '../../utils/haptics';
import { SUPPORT_START } from '../../navigation/supportMenue';
import { Abschnitt, Feld, Ladefehler, Marke, NurSupport } from './SupportBausteine';
import { useSupportZurueck } from './useSupportZurueck';

/** Beispieltext fuer die Vorschau der Fusszeile. */
const VORSCHAU_BEISPIEL = 'Hallo,\n\nhier steht der Text der Antwort.';

const Textbausteine: React.FC = () => {
  const { setError, setSuccess, isOnline } = useApp();
  const [presentAlert] = useIonAlert();
  const zurueck = useSupportZurueck(SUPPORT_START);

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

  return (
    <IonPage>
      <AppKopfzeile titel="Textbausteine" onZurueck={zurueck} gemeindeUmschalter={false} />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Textbausteine" />
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void laden().finally(() => e.detail.complete()); }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        {laedt && !bausteine ? (
          <LoadingSpinner message="Bausteine werden geladen..." />
        ) : fehler || !bausteine ? (
          <Ladefehler text="Die Textbausteine konnten nicht geladen werden." onErneut={() => { void laden(); }} />
        ) : bausteine.length === 0 ? (
          <EmptyState icon={ICON_TEXTDOKUMENT} title="Noch keine Bausteine" message="Lege unten den ersten Textbaustein an." />
        ) : (
          <Abschnitt icon={ICON_TEXTDOKUMENT} titel={`${bausteine.length} ${bausteine.length === 1 ? 'Baustein' : 'Bausteine'}`} farbe="organizations">
            <ul aria-label="Textbausteine" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {bausteine.map((b) => (
                <li key={b.id} className="app-list-item app-list-item--organizations">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-eng)', flexWrap: 'wrap' }}>
                    <span className="app-list-item__title">{b.titel}</span>
                    <Marke text={bausteinPostfachText(b.postfach)} farbe="var(--app-color-neutral)" />
                  </div>
                  {b.betreff && (
                    <div style={{ fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)', marginTop: 'var(--app-abstand-mini)' }}>
                      Betreff: {b.betreff}
                    </div>
                  )}
                  <div style={{ fontSize: 'var(--app-text-meta)', color: 'var(--app-text-body)', marginTop: 'var(--app-abstand-mini)' }}>
                    {auszug(b.text, 160)}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--app-abstand-eng)', marginTop: 'var(--app-abstand-eng)' }}>
                    <IonButton size="small" fill="outline" aria-label={`${b.titel} bearbeiten`} onClick={() => bearbeiten(b)}>
                      <IonIcon icon={ICON_BEARBEITEN} slot="start" />
                      Bearbeiten
                    </IonButton>
                    <IonButton size="small" fill="clear" color="danger" aria-label={`${b.titel} löschen`} onClick={() => loeschen(b)}>
                      <IonIcon icon={ICON_LOESCHEN} slot="start" />
                      Löschen
                    </IonButton>
                  </div>
                </li>
              ))}
            </ul>
          </Abschnitt>
        )}

        <Abschnitt icon={bearbeitet ? ICON_BEARBEITEN : ICON_HINZUFUEGEN} titel={bearbeitet ? 'Baustein bearbeiten' : 'Neuer Baustein'} farbe="organizations">
          <IonList style={{ background: 'transparent' }}>
            <Feld label="Titel" pflicht wert={formular.titel} onWert={(w) => aendern({ titel: w })}
              hinweis="Name in der Auswahl beim Antworten, z. B. „Eingang bestätigt“." />
            <IonItem lines="full" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked">Postfach</IonLabel>
              <IonSelect
                aria-label="Postfach"
                interface="popover"
                value={formular.postfach}
                onIonChange={(e) => aendern({ postfach: (e.detail.value as Postfach | 'beide') ?? 'beide' })}
              >
                {POSTFACH_AUSWAHL.map((p) => (
                  <IonSelectOption key={p.wert} value={p.wert}>{p.label}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <Feld label="Betreff" wert={formular.betreff} onWert={(w) => aendern({ betreff: w })}
              hinweis="Optional. Ersetzt beim Einfügen nur einen leeren oder vorgeschlagenen Betreff." />
            <IonItem lines="full" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked">Text des Bausteins *</IonLabel>
              <IonTextarea
                aria-label="Text des Bausteins"
                aria-required="true"
                value={formular.text}
                autoGrow={true}
                rows={6}
                onIonInput={(e) => aendern({ text: String(e.detail.value ?? '') })}
              />
            </IonItem>
          </IonList>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--app-abstand-eng)', marginTop: 'var(--app-abstand-kompakt)' }}>
            <IonButton onClick={() => { void speichern(); }} disabled={speichert || !isOnline}>
              {bearbeitet ? 'Speichern' : 'Baustein anlegen'}
            </IonButton>
            {bearbeitet && (
              <IonButton fill="outline" onClick={formularLeeren}>Abbrechen</IonButton>
            )}
          </div>
        </Abschnitt>

        <Abschnitt icon={ICON_HILFE} titel="Platzhalter" farbe="organizations">
          <p style={{ margin: '0 0 var(--app-abstand-kompakt)', color: 'var(--app-text-body)', fontSize: 'var(--app-text-sekundaer)' }}>
            Beim Einfügen in eine Antwort setzt die Support-Ansicht die Werte der Anfrage bzw. Gemeinde ein.
            Was sie nicht kennt oder was leer ist, bleibt sichtbar stehen — so fällt es vor dem Senden auf.
          </p>
          <ul aria-label="Platzhalter" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {PLATZHALTER.map((p) => (
              <li key={p.schluessel} style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-eng)', flexWrap: 'wrap', padding: 'var(--app-abstand-winzig) 0' }}>
                <code style={{ color: 'var(--app-text-emphasis)' }}>{platzhalterMarke(p.schluessel)}</code>
                <span style={{ color: 'var(--app-text-system)', fontSize: 'var(--app-text-sekundaer)', flex: 1, minWidth: 0 }}>{p.beschreibung}</span>
                <IonButton size="small" fill="clear" aria-label={`${platzhalterMarke(p.schluessel)} in den Text einfügen`} onClick={() => platzhalterEinfuegen(p.schluessel)}>
                  Einfügen
                </IonButton>
              </li>
            ))}
          </ul>
        </Abschnitt>

        <Abschnitt icon={ICON_EINSTELLUNGEN} titel="Absender und Fußzeile" farbe="organizations">
          {einstellungenFehlen && (
            <p role="status" style={{ margin: '0 0 var(--app-abstand-kompakt)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-fehler)' }}>
              Absender und Fußzeile konnten nicht geladen werden.
            </p>
          )}
          <IonList style={{ background: 'transparent' }}>
            <Feld label="Absendername" wert={absendername} onWert={setAbsendername} autocomplete="name" deaktiviert={einstellungen === null}
              hinweis="Steht als Name vor der Adresse und füllt {{absender}}." />
            <IonItem lines="full" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked">Fußzeile</IonLabel>
              <IonTextarea
                aria-label="Fußzeile"
                value={fusszeile}
                disabled={einstellungen === null}
                autoGrow={true}
                rows={4}
                onIonInput={(e) => setFusszeile(String(e.detail.value ?? ''))}
              />
            </IonItem>
          </IonList>
          <h3 style={{ margin: 'var(--app-abstand-mittel) 0 var(--app-abstand-eng)', fontSize: 'var(--app-text-standard)', fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-emphasis)' }}>
            Vorschau
          </h3>
          <div
            role="region"
            aria-label="Vorschau mit Fußzeile"
            style={{
              whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: 'var(--app-abstand-kompakt)',
              borderRadius: 'var(--app-radius-knopf)', background: 'var(--app-surface-soft)', border: '1px solid var(--app-border-soft)',
              color: 'var(--app-text-body)', fontSize: 'var(--app-text-sekundaer)',
            }}
          >
            {vorschauText(VORSCHAU_BEISPIEL, fusszeile)}
          </div>
          <IonButton
            expand="block"
            style={{ marginTop: 'var(--app-abstand-mittel)' }}
            onClick={() => { void einstellungenSpeichern(); }}
            disabled={!einstellungenGeaendert || speichertEinstellungen || !isOnline}
          >
            Absender und Fußzeile speichern
          </IonButton>
        </Abschnitt>

        <div style={{ height: 'var(--app-abstand-riesig)' }} />
      </IonContent>
    </IonPage>
  );
};

const SupportTextbausteinePage: React.FC = () => (
  <NurSupport titel="Textbausteine"><Textbausteine /></NurSupport>
);

export default SupportTextbausteinePage;
