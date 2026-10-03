// Support-Konten, /admin/support/konten (Web-Version, Entscheidungen 10 bis
// 15; Backend seit #218, backend/routes/supportKonten.js).
//
// Konten ohne Gemeinde fuer die Support-Person: auflisten (mit den Gemeinden,
// in denen sie Gast sind), anlegen, sperren und entsperren, Passwort setzen,
// loeschen. Bis hierher ging das nur ueber die API
// (docs/betrieb/support-konto.md).
//
// Das letzte aktive Super-Admin-Konto laesst sich weder sperren noch loeschen;
// der Server antwortet dann 409 mit einem Satz, der sagt, was zu tun ist. Den
// zeigt die Seite als eigenen Hinweis statt als fluechtige Meldung. Das eigene
// Konto bietet sie gar nicht erst zum Sperren oder Loeschen an: Wer sich
// selbst sperrt, ist sofort draussen.

import React from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonList,
  IonPage,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import EmptyState from '../shared/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  ICON_ENTSPERRT,
  ICON_HINZUFUEGEN,
  ICON_LOESCHEN,
  ICON_ORGANISATION,
  ICON_PERSON,
  ICON_SCHLUESSEL,
  ICON_SICHTBAR,
  ICON_SPERRE,
  ICON_UHRZEIT,
  ICON_VERBORGEN,
} from '../shared/icons';
import { generateStrongPassword } from '../../utils/passwortVorschlag';
import { datumUhrzeit } from '../../utils/dateUtils';
import { triggerPullHaptic } from '../../utils/haptics';
import { SUPPORT_START } from '../../navigation/supportMenue';
import { Abschnitt, Feld, Ladefehler, Marke, NurSupport } from './SupportBausteine';
import { useSupportZurueck } from './useSupportZurueck';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import WebKonten from './web/WebKonten';
import { LEERES_KONTO, useSupportKonten } from './useSupportKonten';

const Konten: React.FC = () => {
  const zurueck = useSupportZurueck(SUPPORT_START);
  const {
    userId, isOnline, konten, laedt, fehler, beschaeftigt, neu, setNeu, neuPasswortZeigen, setNeuPasswortZeigen, passwortFuer,
    setPasswortFuer, laden, anlegen, sperrenUmschalten, loeschen, passwortSpeichern,
  } = useSupportKonten();

  return (
    <IonPage>
      <AppKopfzeile
        titel="Support-Konten"
        onZurueck={zurueck}
        gemeindeUmschalter={false}
        rechts={(
          <IonButton aria-label="Support-Konto anlegen" onClick={() => setNeu(neu ? null : { ...LEERES_KONTO })}>
            <IonIcon icon={ICON_HINZUFUEGEN} slot="icon-only" />
          </IonButton>
        )}
      />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Support-Konten" />
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void laden().finally(() => e.detail.complete()); }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        <p style={{ margin: 'var(--app-abstand-basis)', color: 'var(--app-text-system)', fontSize: 'var(--app-text-sekundaer)' }}>
          Konten ohne Gemeinde für den Support. Sie melden sich nur im Browser an und haben dieselben Rechte
          wie jedes Super-Admin-Konto. In eine Gemeinde kommen sie nur als sichtbare Gemeindeleitung, unter
          Gemeinden › Mitglieder & Zuweisungen.
        </p>

        {neu && (
          <Abschnitt icon={ICON_HINZUFUEGEN} titel="Neues Support-Konto" farbe="organizations">
            <IonList style={{ background: 'transparent' }}>
              <Feld label="Benutzername" pflicht wert={neu.username} onWert={(w) => setNeu({ ...neu, username: w })} autocomplete="username"
                hinweis="Buchstaben, Ziffern, Punkt und Bindestrich; im ganzen System frei." />
              <Feld label="Anzeigename" pflicht wert={neu.display_name} onWert={(w) => setNeu({ ...neu, display_name: w })} autocomplete="name" />
              <Feld label="E-Mail" typ="email" wert={neu.email} onWert={(w) => setNeu({ ...neu, email: w })} autocomplete="email"
                hinweis="Freiwillig; dorthin geht „Passwort vergessen“." />
              <Feld label="Passwort" pflicht typ={neuPasswortZeigen ? 'text' : 'password'} wert={neu.password}
                onWert={(w) => setNeu({ ...neu, password: w })} autocomplete="new-password" />
            </IonList>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--app-abstand-eng)', margin: 'var(--app-abstand-eng) 0' }}>
              <IonButton size="small" fill="outline" onClick={() => { setNeu({ ...neu, password: generateStrongPassword() }); setNeuPasswortZeigen(true); }}>
                <IonIcon icon={ICON_SCHLUESSEL} slot="start" />
                Sicheres Passwort vorschlagen
              </IonButton>
              <IonButton size="small" fill="clear" onClick={() => setNeuPasswortZeigen((z) => !z)}>
                <IonIcon icon={neuPasswortZeigen ? ICON_VERBORGEN : ICON_SICHTBAR} slot="start" />
                {neuPasswortZeigen ? 'Passwort verbergen' : 'Passwort zeigen'}
              </IonButton>
            </div>
            <div style={{ display: 'flex', gap: 'var(--app-abstand-eng)' }}>
              <IonButton onClick={() => { void anlegen(); }} disabled={beschaeftigt || !isOnline}>Anlegen</IonButton>
              <IonButton fill="clear" onClick={() => setNeu(null)}>Abbrechen</IonButton>
            </div>
          </Abschnitt>
        )}

        {laedt && !konten ? (
          <LoadingSpinner message="Support-Konten werden geladen..." />
        ) : fehler || !konten ? (
          <Ladefehler text="Die Support-Konten konnten nicht geladen werden." onErneut={() => { void laden(); }} />
        ) : konten.length === 0 ? (
          <EmptyState icon={ICON_PERSON} title="Noch keine Support-Konten"
            message="Über das Plus oben rechts legst du ein Konto ohne Gemeinde an." />
        ) : (
          <Abschnitt icon={ICON_PERSON} titel={`${konten.length} ${konten.length === 1 ? 'Support-Konto' : 'Support-Konten'}`} farbe="organizations">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
              {konten.map((k) => {
                const eigenes = k.id === userId;
                return (
                  <div key={k.id} className="app-list-item app-list-item--organizations" style={{ opacity: k.is_active ? 1 : 0.75 }}>
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-icon-circle app-icon-circle--lg app-icon-circle--organizations">
                          <IonIcon icon={k.is_active ? ICON_PERSON : ICON_SPERRE} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">
                            {k.display_name}{eigenes ? ' (du)' : ''}
                          </div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">{k.username}{k.email ? ` · ${k.email}` : ''}</span>
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={ICON_UHRZEIT} style={{ color: 'var(--app-text-users)' }} />
                              {k.last_login_at ? `zuletzt angemeldet ${datumUhrzeit(k.last_login_at)}` : 'noch nie angemeldet'}
                            </span>
                            {k.gemeinden.length > 0 && (
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={ICON_ORGANISATION} style={{ color: 'var(--app-text-users)' }} />
                                Gast in {k.gemeinden.map((g) => g.display_name || g.name).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Marke text={k.is_active ? 'Aktiv' : 'Gesperrt'} farbe={k.is_active ? 'var(--app-color-success)' : 'var(--app-color-neutral)'} />
                    </div>

                    {passwortFuer?.id === k.id ? (
                      <div style={{ marginTop: 'var(--app-abstand-eng)' }}>
                        <IonList style={{ background: 'transparent' }}>
                          <Feld label={`Neues Passwort für ${k.username}`} pflicht typ={passwortFuer.zeigen ? 'text' : 'password'}
                            wert={passwortFuer.password} onWert={(w) => setPasswortFuer({ ...passwortFuer, password: w })} autocomplete="new-password"
                            hinweis="Alle Sitzungen des Kontos enden; eine Sperre nach Fehlversuchen endet auch." />
                        </IonList>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--app-abstand-eng)', marginTop: 'var(--app-abstand-eng)' }}>
                          <IonButton size="small" fill="outline" onClick={() => setPasswortFuer({ ...passwortFuer, password: generateStrongPassword(), zeigen: true })}>
                            Vorschlagen
                          </IonButton>
                          <IonButton size="small" onClick={() => { void passwortSpeichern(k); }} disabled={beschaeftigt}>Passwort setzen</IonButton>
                          <IonButton size="small" fill="clear" onClick={() => setPasswortFuer(null)}>Abbrechen</IonButton>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--app-abstand-eng)', marginTop: 'var(--app-abstand-eng)' }}>
                        <IonButton size="small" fill="outline" onClick={() => setPasswortFuer({ id: k.id, password: '', zeigen: false })}>
                          <IonIcon icon={ICON_SCHLUESSEL} slot="start" />
                          Passwort setzen
                        </IonButton>
                        {!eigenes && (
                          <>
                            <IonButton size="small" fill="outline" onClick={() => sperrenUmschalten(k)} disabled={beschaeftigt}>
                              <IonIcon icon={k.is_active ? ICON_SPERRE : ICON_ENTSPERRT} slot="start" />
                              {k.is_active ? 'Sperren' : 'Entsperren'}
                            </IonButton>
                            <IonButton size="small" fill="outline" color="danger" onClick={() => loeschen(k)} disabled={beschaeftigt}>
                              <IonIcon icon={ICON_LOESCHEN} slot="start" />
                              Löschen
                            </IonButton>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Abschnitt>
        )}

        <div style={{ height: 'var(--app-abstand-riesig)' }} />
      </IonContent>
    </IonPage>
  );
};

// Zwei Gesichter, eine Seite: im breiten Browserfenster eine Tabelle mit
// Dialogen, sonst die Darstellung der App. Beide nutzen useSupportKonten.
const SupportKontenPage: React.FC = () => {
  const breit = useBreitesLayout();
  return <NurSupport titel="Support-Konten">{breit ? <WebKonten /> : <Konten />}</NurSupport>;
};

export default SupportKontenPage;
