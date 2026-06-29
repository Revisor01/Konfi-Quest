// backend/tests/utils/photoCrypto.test.js
// Unit-Tests fuer die AES-256-GCM-Verschluesselung der Antrags-Nachweisfotos.
// Reine Funktion ohne DB. Der Schluessel wird vor dem Require gesetzt.

// 32-Byte-Testschluessel (64 Hex). Muss vor dem ersten getKey()-Aufruf stehen.
process.env.ACTIVITY_PHOTO_ENCRYPTION_KEY =
  process.env.ACTIVITY_PHOTO_ENCRYPTION_KEY ||
  '0000000000000000000000000000000000000000000000000000000000000000';

const { encryptBuffer, decryptBuffer, isEncrypted } = require('../../utils/photoCrypto');

describe('photoCrypto', () => {
  it('Roundtrip: entschluesselt zum Originalinhalt', () => {
    const original = Buffer.from('Bildinhalt mit Umlauten äöü und Bytes \x00\x01\x02\xff');
    const enc = encryptBuffer(original);
    const dec = decryptBuffer(enc);
    expect(dec.equals(original)).toBe(true);
  });

  it('verschluesselter Buffer ist NICHT gleich Klartext', () => {
    const original = Buffer.from('geheim');
    const enc = encryptBuffer(original);
    expect(enc.equals(original)).toBe(false);
    expect(enc.length).toBeGreaterThan(original.length); // Magic + IV + Tag
  });

  it('isEncrypted erkennt verschluesselte und Klartext-Buffer', () => {
    const original = Buffer.from('plain');
    expect(isEncrypted(original)).toBe(false);
    expect(isEncrypted(encryptBuffer(original))).toBe(true);
  });

  it('decryptBuffer reicht Klartext (Altdatei) unveraendert durch', () => {
    // Migration/Abwaertskompatibilitaet: alte unverschluesselte Dateien
    const original = Buffer.from('alte unverschluesselte Datei');
    expect(decryptBuffer(original).equals(original)).toBe(true);
  });

  it('zwei Verschluesselungen desselben Inhalts ergeben verschiedene Ciphertexte (IV)', () => {
    const original = Buffer.from('gleicher Inhalt');
    const a = encryptBuffer(original);
    const b = encryptBuffer(original);
    expect(a.equals(b)).toBe(false); // unterschiedliche IV
    // beide entschluesseln aber zum selben Original
    expect(decryptBuffer(a).equals(original)).toBe(true);
    expect(decryptBuffer(b).equals(original)).toBe(true);
  });

  it('manipulierter Ciphertext schlaegt die Authentifizierung fehl (GCM)', () => {
    const enc = encryptBuffer(Buffer.from('integritaet'));
    // letztes Byte kippen
    enc[enc.length - 1] = enc[enc.length - 1] ^ 0xff;
    expect(() => decryptBuffer(enc)).toThrow();
  });
});
