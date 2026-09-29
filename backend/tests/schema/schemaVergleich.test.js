// backend/tests/schema/schemaVergleich.test.js
//
// Die Kommandozeile von scripts/schemaVergleich.js -- mit ihr misst der
// Betrieb, ob die Produktion dem Repo entspricht (Audit Datenbank BF-17,
// Auftrag docs/auftraege/lokaler-agent/11-schema-und-rueckspielprobe.md).
// Sie muss bei Gleichheit 0 und bei einer Abweichung 1 liefern, sonst meldet
// ein Messlauf "gleich", wo er es nicht ist.
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkOhneTypumwandlung } = require('../../scripts/schemaVergleich');
const { urlFuer } = require('../helpers/schemaAufbau');

const SKRIPT = path.join(__dirname, '..', '..', 'scripts', 'schemaVergleich.js');
const TEST_DB_URL = urlFuer('konfi_test');

describe('schemaVergleich.js auf der Kommandozeile', () => {
  let ordner;
  let stand;

  beforeAll(() => {
    ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'schemavergleich-'));
    stand = path.join(ordner, 'stand.json');
    const json = execFileSync('node', [SKRIPT, 'erfassen', TEST_DB_URL], { encoding: 'utf8' });
    fs.writeFileSync(stand, json);
  });

  afterAll(() => {
    fs.rmSync(ordner, { recursive: true, force: true });
  });

  it('erfassen schreibt alle Objektarten mit Inhalt', () => {
    const abdruck = JSON.parse(fs.readFileSync(stand, 'utf8'));
    expect(abdruck.tabellen).toContain('users');
    expect(abdruck.indizes.length).toBeGreaterThan(100);
  });

  it('vergleichen: gleicher Stand -> Exit 0', () => {
    const lauf = spawnSync('node', [SKRIPT, 'vergleichen', stand, TEST_DB_URL], { encoding: 'utf8' });
    expect(lauf.status).toBe(0);
    expect(lauf.stdout).toMatch(/^Gleich: /);
  });

  it('vergleichen: eine Abweichung -> Exit 1 und die Zeile im Bericht', () => {
    const abdruck = JSON.parse(fs.readFileSync(stand, 'utf8'));
    abdruck.indizes = abdruck.indizes.filter((z) => !z.includes('idx_chat_messages_reply_to'));
    const veraendert = path.join(ordner, 'veraendert.json');
    fs.writeFileSync(veraendert, JSON.stringify(abdruck));

    const lauf = spawnSync('node', [SKRIPT, 'vergleichen', veraendert, TEST_DB_URL], { encoding: 'utf8' });
    expect(lauf.status).toBe(1);
    expect(lauf.stdout).toContain('## indizes: 0 nur in A, 1 nur in B');
    expect(lauf.stdout).toContain('+ B: CREATE INDEX idx_chat_messages_reply_to');
  });

  it('ohne gueltige Argumente -> Exit 2 mit Aufruf-Hinweis', () => {
    const lauf = spawnSync('node', [SKRIPT, 'vergleichen', stand], { encoding: 'utf8' });
    expect(lauf.status).toBe(2);
    expect(lauf.stderr).toContain('Aufruf:');
  });
});

describe('CHECK-Schreibweise nach Dump und Wiedereinspielen', () => {
  it('beide Darstellungen derselben Bedingung werden gleich', () => {
    const gewachsen = "chat_message_reactions chat_message_reactions_user_type_check c: CHECK (((user_type)::text = ANY ((ARRAY['admin'::character varying, 'teamer'::character varying, 'konfi'::character varying])::text[])))";
    const zurueckgespielt = "chat_message_reactions chat_message_reactions_user_type_check c: CHECK (((user_type)::text = ANY (ARRAY[('admin'::character varying)::text, ('teamer'::character varying)::text, ('konfi'::character varying)::text])))";
    expect(checkOhneTypumwandlung(gewachsen)).toBe(checkOhneTypumwandlung(zurueckgespielt));
  });

  it('ein anderer Wert bleibt ein Unterschied', () => {
    const a = "t t_check c: CHECK (((x)::text = ANY ((ARRAY['a'::character varying, 'b'::character varying])::text[])))";
    const b = "t t_check c: CHECK (((x)::text = ANY ((ARRAY['a'::character varying, 'c'::character varying])::text[])))";
    expect(checkOhneTypumwandlung(a)).not.toBe(checkOhneTypumwandlung(b));
  });

  it('Fremdschluessel und Indizes bleiben unveraendert', () => {
    const fk = 'chat_messages chat_messages_reply_to_fkey f: FOREIGN KEY (reply_to) REFERENCES chat_messages(id) ON DELETE SET NULL';
    expect(checkOhneTypumwandlung(fk)).toBe(fk);
  });
});
