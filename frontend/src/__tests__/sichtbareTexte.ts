// Sichtbare Texte aus dem Quelltext holen -- fuer Tests, die pruefen, WIE die
// App mit Menschen spricht (Umlaute, Begriffe), nicht was sie tut.
//
// WARUM DER TYPESCRIPT-PARSER UND KEIN REGEX: Die aelteren Pruefungen
// (wrappedTexteUmlaute, umlauteUndZurueckIcon) schneiden Zeichenketten per
// Regex aus Zeilen. Das reicht fuer einen Ordner mit Folientexten, aber nicht
// fuer die ganze App: Ein Apostroph im JSX-Text ("Simon's") oder ein
// Template-Ausdruck ueber mehrere Zeilen verschiebt die Anfuehrungszeichen,
// und Kommentare, die zufaellig '...' enthalten, zaehlen mit. Der Parser
// kennt JSX-Text, Zeichenketten und Template-Teile als eigene Knoten.
//
// WAS NICHT ZAEHLT, weil es niemand sieht:
//   - Import-/Export-Pfade und Literaltypen ('konfi' | 'teamer')
//   - Argumente an console.*, track() und require()
//   - Vergleichswerte (=== 'x', case 'x':) und Objektschluessel
//   - JSX-Attribute ohne Anzeige: className, key, id, style, href, ...
//   - Zeichenketten ohne Leerzeichen, die wie Bezeichner aussehen: klein
//     geschrieben oder mit _ / . : ( ) -- ('konfi_termine', 'var(--x)').
//     Ein einzelnes GROSS geschriebenes Wort ('Gluehbirne') zaehlt dagegen:
//     Das sind Namen und Beschriftungen.
import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

export const FRONTEND = resolve(__dirname, '../..');
export const REPO = resolve(FRONTEND, '..');

export interface SichtbarerText {
  /** Pfad relativ zur Repo-Wurzel, mit Zeilennummer. */
  ort: string;
  text: string;
}

/** Alle Dateien mit einer der Endungen unterhalb von `verzeichnis`, rekursiv. */
export function quelldateien(verzeichnis: string, endungen: RegExp, auslassen: RegExp = /^$/): string[] {
  const raus: string[] = [];
  for (const eintrag of readdirSync(verzeichnis)) {
    const pfad = join(verzeichnis, eintrag);
    if (auslassen.test(pfad)) continue;
    if (statSync(pfad).isDirectory()) raus.push(...quelldateien(pfad, endungen, auslassen));
    else if (endungen.test(eintrag)) raus.push(pfad);
  }
  return raus;
}

const UNSICHTBARE_ATTRIBUTE = new Set([
  'className', 'key', 'id', 'style', 'href', 'src', 'type', 'name', 'value', 'color', 'fill',
  'slot', 'mode', 'routerLink', 'routerDirection', 'path', 'icon', 'size', 'expand', 'shape',
  'lines', 'role', 'inputmode', 'inputMode', 'autocomplete', 'autoComplete', 'pattern', 'target',
  'rel', 'tab', 'trigger', 'htmlFor', 'ref', 'lang',
]);

const VERGLEICHE = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
]);

/** Steht dieser Knoten an einer Stelle, die nie auf dem Bildschirm landet? */
function unsichtbar(knoten: ts.Node): boolean {
  const p = knoten.parent;
  if (!p) return false;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p)) return true;
  if (ts.isPropertyAssignment(p) && p.name === knoten) return true;
  if (ts.isElementAccessExpression(p) && p.argumentExpression === knoten) return true;
  if (ts.isCaseClause(p)) return true;
  if (ts.isBinaryExpression(p) && VERGLEICHE.has(p.operatorToken.kind)) return true;
  for (let a: ts.Node | undefined = p; a && !ts.isSourceFile(a); a = a.parent) {
    if (ts.isCallExpression(a)) {
      const aufruf = a.expression.getText();
      if (/^console\./.test(aufruf) || /^(track|require)$/.test(aufruf)) return true;
      if (a.expression.kind === ts.SyntaxKind.ImportKeyword) return true;
    }
    if (ts.isJsxAttribute(a)) {
      const name = a.name.getText();
      return UNSICHTBARE_ATTRIBUTE.has(name) || name.startsWith('data-');
    }
  }
  return false;
}

/** Sieht die Zeichenkette aus wie ein Bezeichner, Schluessel oder Pfad? */
export function bezeichnerartig(text: string): boolean {
  const t = text.trim();
  if (/\s/.test(t)) return false;
  if (/[_/.:#()=@&?%{}$[\]<>]/.test(t)) return true;
  return !/^[A-ZÄÖÜ]/.test(t);
}

/** JSX-Text, Zeichenketten und Template-Teile einer .ts/.tsx-Datei, die jemand sieht. */
export function sichtbareTexte(pfad: string, quelle = readFileSync(pfad, 'utf8')): SichtbarerText[] {
  const datei = ts.createSourceFile(pfad, quelle, ts.ScriptTarget.Latest, true,
    pfad.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const raus: SichtbarerText[] = [];
  const besuche = (knoten: ts.Node) => {
    let text: string | null = null;
    let traeger: ts.Node = knoten;
    if (ts.isJsxText(knoten)) {
      text = knoten.getText();
    } else if (ts.isStringLiteral(knoten) || ts.isNoSubstitutionTemplateLiteral(knoten)) {
      text = knoten.text;
    } else if (ts.isTemplateHead(knoten) || ts.isTemplateMiddle(knoten) || ts.isTemplateTail(knoten)) {
      text = knoten.text;
      // Der Traeger ist der ganze Template-Ausdruck: an IHM haengt, ob er in
      // console.log oder in einem className steht.
      traeger = ts.isTemplateExpression(knoten.parent) ? knoten.parent : knoten.parent.parent;
    }
    if (text !== null && /\S/.test(text) && !unsichtbar(traeger) && !bezeichnerartig(text)) {
      const zeile = datei.getLineAndCharacterOfPosition(knoten.getStart()).line + 1;
      raus.push({ ort: `${relative(REPO, pfad)}:${zeile}`, text: text.replace(/\s+/g, ' ').trim() });
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(datei);
  return raus;
}

/** Sichtbare Texte aller .ts/.tsx unter den angegebenen Ordnern von frontend/src. */
export function sichtbareTexteDerApp(ordner: string[]): SichtbarerText[] {
  return ordner.flatMap((o) =>
    quelldateien(join(FRONTEND, 'src', o), /\.tsx?$/, /__tests__|__mocks__|\.test\.tsx?$/)
      .flatMap((pfad) => sichtbareTexte(pfad)));
}

/**
 * Texte, die das Backend an Menschen schickt: Push-Titel und -Text,
 * Postfach-Eintraege, Fehlermeldungen (`error:`), Badge-Vorlagen. Erkannt an
 * der Eigenschaft, in der sie stehen, an `fehler(...)`-Aufrufen und an
 * Konstanten in VERSALIEN. SQL und console.* fallen raus.
 */
const BACKEND_EIGENSCHAFTEN = /^(title|body|error|message|titel|text|inhalt|nachricht|hinweis|grund|beschreibung|description|help|name|subject|betreff|label)$/;

export function nutzertexteDesBackends(pfad: string, quelle = readFileSync(pfad, 'utf8')): SichtbarerText[] {
  const datei = ts.createSourceFile(pfad, quelle, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const raus: SichtbarerText[] = [];
  const sammle = (knoten: ts.Node, anker: ts.Node) => {
    const zeile = datei.getLineAndCharacterOfPosition(anker.getStart()).line + 1;
    const geh = (x: ts.Node) => {
      if (ts.isCallExpression(x) && /^console\./.test(x.expression.getText())) return;
      if (ts.isBinaryExpression(x) && VERGLEICHE.has(x.operatorToken.kind)) return;
      if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)
        || ts.isTemplateHead(x) || ts.isTemplateMiddle(x) || ts.isTemplateTail(x)) {
        const text = x.text;
        if (/\S/.test(text) && !/\b(SELECT|INSERT|UPDATE|DELETE FROM|WHERE)\b/.test(text) && !bezeichnerartig(text)) {
          raus.push({ ort: `${relative(REPO, pfad)}:${zeile}`, text: text.replace(/\s+/g, ' ').trim() });
        }
      }
      ts.forEachChild(x, geh);
    };
    geh(knoten);
  };
  const besuche = (knoten: ts.Node) => {
    if (ts.isCallExpression(knoten) && /^console\./.test(knoten.expression.getText())) return;
    if (ts.isPropertyAssignment(knoten) && BACKEND_EIGENSCHAFTEN.test(knoten.name.getText().replace(/['"]/g, ''))) {
      sammle(knoten.initializer, knoten);
      return;
    }
    if (ts.isVariableDeclaration(knoten) && knoten.initializer && /^[A-Z][A-Z_]+$/.test(knoten.name.getText())
      && (ts.isStringLiteral(knoten.initializer) || ts.isTemplateExpression(knoten.initializer))) {
      sammle(knoten.initializer, knoten);
      return;
    }
    if (ts.isCallExpression(knoten) && knoten.expression.getText() === 'fehler') {
      sammle(knoten, knoten);
      return;
    }
    // express-validator: .withMessage('...') landet ueber handleValidationErrors
    // als `error` in der Antwort und damit auf dem Bildschirm. Nur die
    // Argumente sammeln -- die Kette davor (body('feld'), isLength(...))
    // traegt Feldnamen, keine Texte.
    if (ts.isCallExpression(knoten) && ts.isPropertyAccessExpression(knoten.expression)
      && knoten.expression.name.getText() === 'withMessage') {
      const methode = knoten.expression.name;
      knoten.arguments.forEach((arg) => sammle(arg, methode));
      besuche(knoten.expression);
      return;
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(datei);
  return raus;
}

/**
 * Nutzertexte aus backend/routes, backend/services, backend/utils und
 * backend/middleware (Pruefregeln mit withMessage), dazu server.js und
 * createApp.js: Dort stehen die Meldungen der Anfragegrenzen ("Zu viele
 * Anfragen ..."), die die App bei 429 anzeigt.
 */
export function nutzertexteDesBackendsGesamt(): SichtbarerText[] {
  return [
    ...['routes', 'services', 'utils', 'middleware']
      .flatMap((o) => quelldateien(join(REPO, 'backend', o), /\.js$/)),
    ...['server.js', 'createApp.js'].map((d) => join(REPO, 'backend', d)),
  ].flatMap((pfad) => nutzertexteDesBackends(pfad));
}
