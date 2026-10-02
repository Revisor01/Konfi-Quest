// backend/tests/schema/chatNachrichtenIndizes.test.js
//
// Waechter fuer die beiden Indizes auf chat_messages.reply_to und user_id
// (Audit 26.09.2026, Datenbank BF-01): Die Fremdschluessel
// chat_messages.reply_to (ON DELETE SET NULL) und chat_messages.user_id
// (ON DELETE CASCADE) brauchen einen fuehrenden Index. Ohne ihn ist jeder
// RI-Trigger beim harten Loeschen einer Nachricht ein Seq Scan ueber die
// ganze Tabelle -- gemessen 32,1 s fuer 1000 Nachrichten bei 490.400 Zeilen,
// mit Index 12 ms.
//
// Angelegt hat sie Migration 160; seit dem 02.10.2026 stehen sie im
// Schema-Dump (init-scripts/01-create-schema.sql, Stand 173), die Datei
// selbst liegt nur noch in der Git-Historie. Geprueft wird deshalb das
// Schema, aus dem die Test-DB entsteht (globalSetup: Dump plus die Migrationen
// danach): Verliert ein erneuerter Dump oder eine spaetere Migration einen der
// beiden Indizes, fallen die Existenz-Tests. Die Plan-Tests pruefen
// zusaetzlich, dass der Planer den partiellen Index fuer genau die Bedingung
// des RI-Triggers (`reply_to = $1`) auch verwenden KANN -- ein Index, der da
// ist, aber nicht zum Praedikat passt, waere ebenso wertlos wie keiner.
const { getTestPool, closePool } = require('../helpers/db');

describe('Indizes auf chat_messages.reply_to und user_id', () => {
  let db;

  beforeAll(() => {
    db = getTestPool();
  });

  afterAll(async () => {
    await closePool();
  });

  const indexDefinition = async (name) => {
    const { rows } = await db.query(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'chat_messages' AND indexname = $1`,
      [name]
    );
    return rows.length === 1 ? rows[0].indexdef : null;
  };

  it('idx_chat_messages_reply_to existiert, partiell auf reply_to IS NOT NULL', async () => {
    expect(await indexDefinition('idx_chat_messages_reply_to')).toBe(
      'CREATE INDEX idx_chat_messages_reply_to ON public.chat_messages USING btree (reply_to) WHERE (reply_to IS NOT NULL)'
    );
  });

  it('idx_chat_messages_user_id existiert', async () => {
    expect(await indexDefinition('idx_chat_messages_user_id')).toBe(
      'CREATE INDEX idx_chat_messages_user_id ON public.chat_messages USING btree (user_id)'
    );
  });

  it('der Planer nutzt den partiellen Index fuer die Bedingung des RI-Triggers (reply_to = $1)', async () => {
    // Auf einer leeren Tabelle bevorzugt der Planer immer den Seq Scan. Mit
    // abgeschaltetem Seq Scan (nur in dieser Verbindung, nur fuer diesen
    // Plan) bleibt ihm der Index -- wenn er zum Praedikat passt. Ohne Index
    // bleibt trotz enable_seqscan = off nur der Seq Scan.
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL enable_seqscan = off');
      const { rows } = await client.query(
        'EXPLAIN (FORMAT TEXT) SELECT id FROM chat_messages WHERE reply_to = 1'
      );
      const plan = rows.map(r => r['QUERY PLAN']).join('\n');
      expect(plan).toContain('idx_chat_messages_reply_to');
      expect(plan).not.toContain('Seq Scan');
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('der Planer nutzt den Index auf user_id fuer die Kaskade beim Kontoloeschen', async () => {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL enable_seqscan = off');
      const { rows } = await client.query(
        'EXPLAIN (FORMAT TEXT) SELECT id FROM chat_messages WHERE user_id = 1'
      );
      const plan = rows.map(r => r['QUERY PLAN']).join('\n');
      expect(plan).toContain('idx_chat_messages_user_id');
      expect(plan).not.toContain('Seq Scan');
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
});
