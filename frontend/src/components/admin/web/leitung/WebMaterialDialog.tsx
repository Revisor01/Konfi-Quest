// Material anlegen, bearbeiten und ansehen als Dialog der Web-Fassung (Simon,
// 11.10.2026: „Web braucht eigene kompaktere Modale überall"), geöffnet aus
// „Material verwalten" (AdminMaterialPage im breiten Layout). Breit, weil viel
// darin steht: Titel und Beschreibung, Zuordnung zu Events und Jahrgängen als
// Ankreuzlisten nebeneinander, Links als Felder, Dateien als Liste.
//
// Die Logik ist die der App (admin/modals/useMaterialFormular.ts): dieselbe
// Vorbelegung, dieselben Prüfungen, derselbe Rumpf an dieselben Routen, ohne
// Netz dieselbe Warteschlange. Anders als in der App:
//   - Fehler und Prüfung stehen im Dialog (eine Meldung der App läge darunter).
//   - Eine vorhandene Datei löschen fragt in ihrer Zeile nach -- ein Alert
//     der App läge ebenfalls unter dem Dialog. Escape bricht dort nur die
//     Rückfrage ab.
//   - Solange gesendet oder gelöscht wird, lässt er sich nicht schließen (X,
//     Escape, Klick daneben); in der App bleibt das X frei, ein Fehler kommt
//     dort als Meldung der App.
//   - Eine Datei ansehen öffnet den Betrachter der App (Zoom, PDF-Seiten,
//     Herunterladen). Er ist ein ion-modal und läge unter dem Dialog; der
//     Dialog tritt deshalb zur Seite, solange der Betrachter offen ist, und
//     kommt danach mit allen Eingaben wieder (sie stehen im Hook, nicht hier).
//   - Wer das Material nicht bearbeiten darf, sieht statt gesperrter Felder
//     die Angaben zum Lesen; Links sind echte Links, Dateien lassen sich öffnen.

import React, { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_DATEI_GEFUELLT,
  ICON_HINZUFUEGEN,
  ICON_HOCHLADEN,
  ICON_LINK,
  ICON_LOESCHEN,
  ICON_TEXTDOKUMENT_GEFUELLT,
} from '../../../shared/icons';
import FortschrittsBalken from '../../../shared/FortschrittsBalken';
import { datumKurz } from '../../../../utils/dateUtils';
import { hostAus, materialLinks } from '../../../../utils/linkDisplay';
import { ladeText, sendeText } from '../../../../utils/fortschritt';
import { UPLOAD_GRENZE } from '../../../../services/mediaCompression';
import { useMaterialFormular, type Material, type MaterialFile, type MaterialFormularZustand } from '../../modals/useMaterialFormular';
import { dateiGroesse, dateiSymbol } from '../../../teamer/web/material/materialAnzeige';
import WebDialog from '../../../web/WebDialog';
import WebAngaben from '../../../web/WebAngaben';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebMehrfachAuswahl from '../../../web/WebMehrfachAuswahl';
import WebTextfeld from '../../../web/WebTextfeld';
import { WebExternLink, WebExternSymbol } from './WebLeitungBausteine';
import '../../../../theme/web/leitung.css';

export interface WebMaterialDialogProps {
  /** Das vorher geladene Material (GET /material/:id); null: neues Material. */
  material: Material | null;
  /** Bearbeiten darf nur die erstellende Person oder die Gemeindeleitung. */
  nurLesen: boolean;
  onSchliessen: () => void;
  /** Nach dem Speichern bzw. Einreihen: Die Seite schließt den Dialog und lädt neu. */
  onGespeichert: () => void;
}

const GRENZE_MB = Math.round(UPLOAD_GRENZE.material / (1024 * 1024));

/** Wer das Material bearbeiten darf -- derselbe Satz wie in der App. */
const rechteText = (material: Material | null): string => (material?.created_by_name
  ? `Angelegt von ${material.created_by_name}. Bearbeiten und löschen kann nur diese Person oder die Gemeindeleitung.`
  : 'Das Konto der erstellenden Person wurde gelöscht. Bearbeiten und löschen kann nur noch die Gemeindeleitung.');

const sichtbarkeitText = (anzahl: number): string => (anzahl > 0
  ? `Nur das Team ${anzahl === 1 ? 'dieses Jahrgangs' : 'dieser Jahrgänge'} sieht das Material`
  : 'Ohne Zuordnung sieht das ganze Team das Material');

/** Eine Datei des Materials: antippen zeigt sie an; daneben, was sich damit tun lässt. */
const DateiZeile: React.FC<{
  name: string;
  mimeType: string;
  /** Größe oder Ladestand. */
  unterzeile: string;
  laedtProzent?: number | null;
  onAnsehen: () => void;
  aktion?: React.ReactNode;
}> = ({ name, mimeType, unterzeile, laedtProzent, onAnsehen, aktion }) => (
  <li className="web-material-datei">
    <div className="web-material-datei__zeile">
      <button type="button" className="web-material-eintrag" onClick={onAnsehen} aria-label={`${name} ansehen`}>
        <span className="web-symbol web-symbol--material" aria-hidden="true"><IonIcon icon={dateiSymbol(mimeType)} /></span>
        <span className="web-material-eintrag__text">
          <span className="web-zelle-titel web-einzeilig">{name}</span>
          <span className="web-zelle-leise" aria-live={laedtProzent !== undefined ? 'polite' : undefined}>{unterzeile}</span>
        </span>
      </button>
      {aktion}
    </div>
    {laedtProzent != null && (
      <span className="web-material-fortschritt">
        <FortschrittsBalken prozent={laedtProzent} beschriftung={`Datei wird geladen: ${laedtProzent} Prozent`} />
      </span>
    )}
  </li>
);

/**
 * Löschen mit Rückfrage in der Zeile. Der Zustand steht im Dialog: Er sperrt
 * sich, solange gelöscht wird, und führt den Fokus (die Knöpfe nehmen sich
 * dabei selbst aus dem Dialog).
 */
interface DateiLoeschen {
  /** Die Datei, deren Rückfrage offen ist. */
  rueckfrage: number | null;
  loescht: boolean;
  fragen: (datei: MaterialFile, zeile: number) => void;
  abbrechen: (zeile: number) => void;
  bestaetigen: (datei: MaterialFile, zeile: number) => void;
}

/** Die vorhandenen Dateien; mit `loeschen` je Zeile ein Löschen mit Rückfrage in der Zeile. */
const VorhandeneDateien: React.FC<{ f: MaterialFormularZustand; loeschen?: DateiLoeschen }> = ({ f, loeschen }) => (
  <>
    {f.existingFiles.map((datei, zeile) => {
      if (loeschen && loeschen.rueckfrage === datei.id) {
        return (
          <li key={datei.id} className="web-material-datei">
            {/* Escape bricht nur die Rückfrage ab; der Dialog mit allen
                Eingaben bleibt. */}
            <div
              className="web-material-rueckfrage"
              role="group"
              aria-label={`${datei.original_name} löschen`}
              onKeyDown={(ereignis) => {
                if (ereignis.key !== 'Escape') return;
                ereignis.stopPropagation();
                if (!loeschen.loescht) loeschen.abbrechen(zeile);
              }}
            >
              <p className="web-material-rueckfrage__text">„{datei.original_name}“ wirklich löschen?</p>
              <WebKnopf klein onClick={() => loeschen.abbrechen(zeile)} disabled={loeschen.loescht}>Abbrechen</WebKnopf>
              <WebKnopf klein art="gefahr" onClick={() => loeschen.bestaetigen(datei, zeile)} disabled={loeschen.loescht}>Löschen</WebKnopf>
            </div>
          </li>
        );
      }
      const laedt = f.ladendeDatei?.pfad === datei.stored_name;
      return (
        <DateiZeile
          key={datei.id}
          name={datei.original_name}
          mimeType={datei.mime_type}
          unterzeile={laedt ? ladeText(f.ladendeDatei?.prozent) : dateiGroesse(datei.file_size)}
          laedtProzent={laedt ? (f.ladendeDatei?.prozent ?? null) : undefined}
          onAnsehen={() => { void f.openFile(datei); }}
          aktion={loeschen && (
            <WebKnopf
              klein
              art="gefahr"
              symbol
              onClick={() => loeschen.fragen(datei, zeile)}
              aria-label={`${datei.original_name} löschen`}
              title="Datei löschen"
              disabled={f.isSubmitting || loeschen.loescht}
            >
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
            </WebKnopf>
          )}
        />
      );
    })}
  </>
);

/** Der letzte Knopf in einem Element: in einer Zeile ihr Entfernen bzw. Löschen. */
const letzterKnopf = (element: Element | null | undefined): HTMLElement | null => {
  const knoepfe = element?.querySelectorAll<HTMLElement>('button');
  return knoepfe && knoepfe.length > 0 ? knoepfe[knoepfe.length - 1] : null;
};

/** Die Angaben eines Materials, das diese Person nicht bearbeiten darf. */
const MaterialLesen: React.FC<{ material: Material | null; f: MaterialFormularZustand }> = ({ material, f }) => {
  const events = material?.events ?? [];
  const jahrgaenge = material?.jahrgaenge ?? [];
  const links = material ? materialLinks(material) : [];
  return (
    <div className="web-formular">
      <WebHinweis art="hinweis">{rechteText(material)}</WebHinweis>
      <WebAngaben
        beschriftung="Angaben zum Material"
        angaben={[
          { label: 'Titel', wert: material?.title, icon: ICON_DATEI_GEFUELLT, iconKlasse: 'app-icon-color--material' },
          {
            label: 'Beschreibung',
            wert: material?.description ? <span className="web-material-beschreibung">{material.description}</span> : null,
            icon: ICON_TEXTDOKUMENT_GEFUELLT,
            iconKlasse: 'app-icon-color--material',
          },
          {
            label: 'Events',
            wert: events.length > 0
              ? events.map((ev) => (ev.event_date ? `${ev.name} (${datumKurz(ev.event_date)})` : ev.name)).join(', ')
              : 'Keine Events zugeordnet',
          },
          {
            label: 'Jahrgänge',
            wert: jahrgaenge.length > 0
              ? `${jahrgaenge.map((j) => j.name).join(', ')} – ${sichtbarkeitText(jahrgaenge.length)}`
              : sichtbarkeitText(0),
          },
          { label: 'Erstellt von', wert: material?.created_by_name },
          { label: 'Erstellt am', wert: material?.created_at ? datumKurz(material.created_at) : null },
        ]}
      />
      {links.length > 0 && (
        <>
          <h3 className="web-gruppe">{links.length === 1 ? 'Link' : 'Links'}</h3>
          <ul className="web-material-liste" aria-label="Links">
            {links.map((url) => (
              <li key={url}>
                <WebExternLink href={url} className="web-material-eintrag" onOeffnen={f.linkAnsehen}>
                  <span className="web-symbol web-symbol--material" aria-hidden="true"><IonIcon icon={ICON_LINK} /></span>
                  <span className="web-material-eintrag__text">
                    <span className="web-zelle-titel web-einzeilig">{hostAus(url)}</span>
                    <span className="web-zelle-leise web-einzeilig">{url}</span>
                  </span>
                  <WebExternSymbol />
                </WebExternLink>
              </li>
            ))}
          </ul>
        </>
      )}
      {f.existingFiles.length > 0 && (
        <>
          <h3 className="web-gruppe">Dateien</h3>
          <ul className="web-material-liste" aria-label="Dateien">
            <VorhandeneDateien f={f} />
          </ul>
        </>
      )}
    </div>
  );
};

const WebMaterialDialog: React.FC<WebMaterialDialogProps> = ({ material, nurLesen, onSchliessen, onGespeichert }) => {
  // Solange der Betrachter der App offen ist, steht der Dialog nicht da: Der
  // Betrachter ist ein ion-modal und laege sonst darunter. Die Eingaben
  // bleiben im Hook und stehen danach wieder in den Feldern.
  const [betrachterOffen, setBetrachterOffen] = useState(false);
  const f = useMaterialFormular({
    material,
    nurLesen,
    onSuccess: onGespeichert,
    fehlerImFenster: true,
    betrachter: { vorher: () => setBetrachterOffen(true), nachher: () => setBetrachterOffen(false) },
  });
  const [rueckfrage, setRueckfrage] = useState<number | null>(null);
  const [loescht, setLoescht] = useState(false);

  // DER FOKUS BLEIBT IM DIALOG (Gegenprüfung 11.10.2026): Papierkorb, die
  // Knöpfe der Rückfrage und Entfernen nehmen sich beim Klick selbst aus dem
  // Dialog. Der Fokus fiel dann auf <body>, und Tab lief in die Seite dahinter
  // (die Fokusfalle hängt am Dialog). Wer eine Zeile ändert, sagt hier, wohin
  // der Fokus nach dem nächsten Zeichnen geht: die Rückfrage auf ihr
  // Abbrechen, danach zurück auf den Papierkorb; nach dem Entfernen auf die
  // Zeile, die nachrückt, sonst die davor, sonst auf „Dateien auswählen“
  // bzw. „Link hinzufügen“.
  const formularRef = useRef<HTMLDivElement>(null);
  const dateienRef = useRef<HTMLUListElement>(null);
  const dateiKnoepfeRef = useRef<HTMLDivElement>(null);
  const linkKnoepfeRef = useRef<HTMLDivElement>(null);
  const fokusDanach = useRef<(() => HTMLElement | null | undefined) | null>(null);
  useEffect(() => {
    const ziel = fokusDanach.current;
    if (!ziel) return;
    fokusDanach.current = null;
    ziel()?.focus();
  });

  const dateiZeile = (zeile: number) => dateienRef.current?.children.item(zeile);
  const nachDateiEntfernt = (zeile: number) => () => letzterKnopf(dateiZeile(zeile))
    ?? letzterKnopf(dateiZeile(zeile - 1))
    ?? dateiKnoepfeRef.current?.querySelector<HTMLElement>('button');
  const linkZeile = (zeile: number) => formularRef.current?.querySelectorAll('.web-material-link').item(zeile);
  const nachLinkEntfernt = (zeile: number) => () => letzterKnopf(linkZeile(zeile))
    ?? letzterKnopf(linkZeile(zeile - 1))
    ?? linkKnoepfeRef.current?.querySelector<HTMLElement>('button');

  const dateiLoeschen: DateiLoeschen = {
    rueckfrage,
    loescht,
    fragen: (datei, zeile) => {
      fokusDanach.current = () => dateiZeile(zeile)?.querySelector<HTMLElement>('[role="group"] button');
      setRueckfrage(datei.id);
    },
    abbrechen: (zeile) => {
      fokusDanach.current = () => letzterKnopf(dateiZeile(zeile));
      setRueckfrage(null);
    },
    bestaetigen: (datei, zeile) => {
      setLoescht(true);
      void f.dateiLoeschen(datei).then((geloescht) => {
        // Gelöscht: die Zeile, die nachrückt. Gescheitert: Die Datei bleibt,
        // der Fokus geht zurück auf ihren Papierkorb (die Meldung steht unten).
        fokusDanach.current = geloescht ? nachDateiEntfernt(zeile) : () => letzterKnopf(dateiZeile(zeile));
        setLoescht(false);
        setRueckfrage(null);
      });
    },
  };

  if (betrachterOffen) return null;

  if (nurLesen) {
    return (
      <WebDialog
        breit
        titel="Material ansehen"
        onSchliessen={onSchliessen}
        aktionen={<WebKnopf art="primaer" onClick={onSchliessen}>Schließen</WebKnopf>}
      >
        <MaterialLesen material={material} f={f} />
      </WebDialog>
    );
  }

  const linkName = (index: number) => `Adresse ${f.linkUrls.length > 1 ? index + 1 : ''}`.trim();
  const hatDateien = f.existingFiles.length > 0 || f.newFiles.length > 0;
  const gesperrt = f.isSubmitting || loescht;

  return (
    <WebDialog
      breit
      titel={material ? 'Material bearbeiten' : 'Neues Material'}
      onSchliessen={onSchliessen}
      // Solange gesendet oder gelöscht wird, schließen weder das X noch
      // Escape noch ein Klick daneben (Gegenprüfung 11.10.2026): Ein Fehler
      // danach ginge sonst still verloren.
      gesperrt={gesperrt}
      onAbsenden={() => { void f.handleSave(); }}
      aktionen={(
        <>
          {/* Prüfung, Fehler und Sendestand stehen über den Knöpfen: Die
              Leiste bleibt beim Scrollen unten im Bild (web-ansicht.css). */}
          {f.fehler && (
            <div className="web-material-meldung">
              <WebHinweis art="fehler" rolle="alert">{f.fehler}</WebHinweis>
            </div>
          )}
          {f.isSubmitting && f.sendeProzent > 0 && (
            <div className="web-material-meldung web-material-fortschritt" aria-live="polite">
              {sendeText(f.sendeProzent)}
              <FortschrittsBalken
                prozent={f.sendeProzent}
                beschriftung={`${f.newFiles.length === 1 ? 'Datei wird' : 'Dateien werden'} gesendet: ${f.sendeProzent} Prozent`}
              />
            </div>
          )}
          <WebKnopf onClick={onSchliessen} disabled={gesperrt}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={gesperrt}>{material ? 'Speichern' : 'Material anlegen'}</WebKnopf>
        </>
      )}
    >
      <div ref={formularRef} className="web-formular web-material-formular">
        {f.ohneNetz && (
          <WebHinweis art="hinweis">Ohne Verbindung wird das Material gespeichert, sobald du wieder online bist. Dateien lassen sich erst dann hochladen.</WebHinweis>
        )}
        <WebFeld label="Titel" pflicht platzhalter="Material-Titel" wert={f.title} onWert={f.setTitle} deaktiviert={f.isSubmitting} />
        <WebTextfeld
          label="Beschreibung"
          zeilen={3}
          platzhalter="Optionale Beschreibung …"
          wert={f.description}
          onWert={f.setDescription}
          deaktiviert={f.isSubmitting}
        />

        <h3 className="web-gruppe">Zuordnung</h3>
        {/* Was die Listen nicht anbieten (ein vergangenes Event, ein Jahrgang,
            den diese Person nicht sieht), behält die Ankreuzliste beim Umschalten. */}
        <div className="web-feldpaar">
          <WebMehrfachAuswahl
            label="Events"
            eintraege={f.eventsZurAuswahl.map((ev) => ({
              wert: String(ev.id),
              titel: ev.name,
              beschreibung: ev.event_date ? datumKurz(ev.event_date) : undefined,
            }))}
            werte={f.eventIds.map(String)}
            onWerte={(werte) => f.setEventIds(werte.map(Number))}
            leerText="Keine anstehenden Events."
            hinweis={f.eventIds.length > 0
              ? `${f.eventIds.length} ${f.eventIds.length === 1 ? 'Event' : 'Events'} ausgewählt`
              : 'Keine Events zugeordnet'}
            deaktiviert={f.isSubmitting}
          />
          <WebMehrfachAuswahl
            label="Jahrgänge"
            eintraege={f.jahrgaenge.map((j) => ({ wert: String(j.id), titel: j.name }))}
            werte={f.jahrgangIds.map(String)}
            onWerte={(werte) => f.setJahrgangIds(werte.map(Number))}
            leerText="Keine Jahrgänge vorhanden."
            hinweis={sichtbarkeitText(f.jahrgangIds.length)}
            deaktiviert={f.isSubmitting}
          />
        </div>

        <h3 className="web-gruppe">Links</h3>
        {f.linkUrls.length === 0 && (
          <p className="web-feld__hinweis">Verknüpfte Internetseiten öffnen sich im Browser — zum Beispiel eine eigene Seite oder ein YouTube-Video.</p>
        )}
        {f.linkUrls.map((url, index) => (
          // Die Reihenfolge ist die Kennung, wie in der App.
          <div key={index} className="web-material-link">
            <WebFeld
              label={linkName(index)}
              platzhalter="https://konfi-quest.de/gottesbilder"
              wert={url}
              onWert={(wert) => f.setLinkUrls((vorher) => vorher.map((l, i) => (i === index ? wert : l)))}
              deaktiviert={f.isSubmitting}
            />
            <WebKnopf
              art="gefahr"
              symbol
              onClick={() => {
                fokusDanach.current = nachLinkEntfernt(index);
                f.setLinkUrls((vorher) => vorher.filter((_, i) => i !== index));
              }}
              aria-label={`${linkName(index)} entfernen`}
              title="Link entfernen"
              disabled={f.isSubmitting}
            >
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
            </WebKnopf>
          </div>
        ))}
        <div ref={linkKnoepfeRef} className="web-formular__knoepfe">
          <WebKnopf onClick={() => f.setLinkUrls((vorher) => [...vorher, ''])} disabled={f.isSubmitting}>
            <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
            Link hinzufügen
          </WebKnopf>
        </div>

        <h3 className="web-gruppe">Dateien</h3>
        {hatDateien && (
          <ul ref={dateienRef} className="web-material-liste" aria-label="Dateien">
            <VorhandeneDateien f={f} loeschen={dateiLoeschen} />
            {f.newFiles.map((datei, index) => (
              <DateiZeile
                key={`neu-${index}`}
                name={datei.name}
                mimeType={datei.type}
                unterzeile={`Neu · ${dateiGroesse(datei.size)} · geht beim Speichern hoch`}
                onAnsehen={() => f.openInAppViewer(datei, datei.name, datei.type)}
                aktion={(
                  <WebKnopf
                    klein
                    art="gefahr"
                    symbol
                    onClick={() => {
                      fokusDanach.current = nachDateiEntfernt(f.existingFiles.length + index);
                      f.removeNewFile(index);
                    }}
                    aria-label={`${datei.name} entfernen`}
                    title="Datei entfernen"
                    disabled={gesperrt}
                  >
                    <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
                  </WebKnopf>
                )}
              />
            ))}
          </ul>
        )}
        <div ref={dateiKnoepfeRef} className="web-formular__knoepfe">
          <WebKnopf onClick={() => { void f.dateienWaehlen(); }} disabled={f.isSubmitting}>
            <IonIcon icon={ICON_HOCHLADEN} aria-hidden="true" />
            Dateien auswählen
          </WebKnopf>
          <span className="web-feld__hinweis">Bilder, PDF, Videos, Audio und Office-Dateien, bis {GRENZE_MB} MB je Datei.</span>
        </div>
      </div>
    </WebDialog>
  );
};

export default WebMaterialDialog;
