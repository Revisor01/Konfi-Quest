/**
 * Losung-Service: Tageslosung abrufen mit DB-Cache
 *
 * Die Losungen-API ist ketiv.de ("was geschrieben steht"). Sie laeuft als
 * Container `ketiv-api` auf demselben Server wie dieses Backend, im selben
 * Docker-Netzwerk `traefik`.
 *
 * Deshalb wird zuerst der containerinterne Weg versucht und erst danach die
 * oeffentliche Domain. Gemessener Unterschied: ~19ms intern gegen ~87ms
 * ueber die oeffentliche Domain — der Aufschlag ist fast vollstaendig der
 * TLS-Handshake, der intern entfaellt.
 *
 * Der Fallback bleibt wichtig: laeuft das Backend ausserhalb von Docker
 * (lokale Entwicklung, Tests) oder wird der Container umbenannt, ist der
 * interne Name nicht aufloesbar und die oeffentliche Domain uebernimmt.
 */

// Interner Weg zuerst, oeffentliche Domain als Rueckfallebene.
// Per LOSUNG_API_BASE_URL ueberschreibbar (z.B. in Tests).
const LOSUNG_ENDPUNKTE = process.env.LOSUNG_API_BASE_URL
  ? [process.env.LOSUNG_API_BASE_URL]
  : ['http://ketiv-api', 'https://ketiv.de'];

// Intern darf der Timeout knapp sein — kommt keine Antwort, ist der
// Container nicht erreichbar und der oeffentliche Weg soll sofort greifen.
const TIMEOUT_INTERN_MS = 2000;
const TIMEOUT_OEFFENTLICH_MS = 5000;

// Laufende Abrufe je Datum+Uebersetzung. Ohne dieses Register feuert JEDER
// Request bei kaltem Cache einen eigenen externen API-Call: morgens oeffnen
// alle gleichzeitig die App, keiner findet den Cache gefuellt, und die
// Losungen-API bekommt einen Schwall identischer Anfragen (Cache-Stampede).
// Mit Register wartet der zweite bis n-te Request auf denselben Promise.
const laufendeAbrufe = new Map();

async function fetchTageslosung(db, translation) {
  const today = new Date().toISOString().split('T')[0];
  const schluessel = `${today}:${translation}`;

  const laufend = laufendeAbrufe.get(schluessel);
  if (laufend) return laufend;

  const abruf = holeTageslosung(db, translation, today)
    .finally(() => { laufendeAbrufe.delete(schluessel); });
  laufendeAbrufe.set(schluessel, abruf);
  return abruf;
}

async function holeTageslosung(db, translation, today) {

  // Cache pruefen
  const { rows: [cachedVerse] } = await db.query(
    'SELECT verse_data FROM daily_verses WHERE date = $1 AND translation = $2',
    [today, translation]
  );

  if (cachedVerse) {
    return { data: cachedVerse.verse_data, translation, cached: true };
  }

  // Von API abrufen
  const fetch = (await import('node-fetch')).default;
  const losungApiKey = process.env.LOSUNG_API_KEY;
  if (!losungApiKey) {
    throw new Error('LOSUNG_API_KEY Umgebungsvariable fehlt');
  }

  // Endpunkte der Reihe nach durchgehen: erst intern, dann oeffentlich.
  let losungData = null;
  let letzterFehler = null;

  for (let i = 0; i < LOSUNG_ENDPUNKTE.length; i++) {
    const basis = LOSUNG_ENDPUNKTE[i];
    const istIntern = basis.startsWith('http://');
    const apiUrl = `${basis}/api/?api_key=${losungApiKey}&translation=${translation}`;

    try {
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Konfi-Quest-App/1.0'
        },
        timeout: istIntern ? TIMEOUT_INTERN_MS : TIMEOUT_OEFFENTLICH_MS
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const daten = await response.json();
      if (!daten.success) {
        throw new Error('API meldet success=false');
      }

      losungData = daten;
      break;
    } catch (err) {
      letzterFehler = err;
      // Nur protokollieren, wenn es noch einen weiteren Versuch gibt —
      // sonst wirft der Aufruf ohnehin gleich.
      if (i < LOSUNG_ENDPUNKTE.length - 1) {
        console.warn(`Losungen-API ${basis} nicht erreichbar (${err.message}), weiche aus auf ${LOSUNG_ENDPUNKTE[i + 1]}`);
      }
    }
  }

  if (!losungData) {
    throw new Error(`Losungen API nicht erreichbar: ${letzterFehler ? letzterFehler.message : 'unbekannter Fehler'}`);
  }

  // In Cache speichern
  try {
    await db.query(
      'INSERT INTO daily_verses (date, translation, verse_data) VALUES ($1, $2, $3) ON CONFLICT (date, translation) DO UPDATE SET verse_data = $3',
      [today, translation, losungData.data]
    );
  } catch (cacheErr) {
    console.error('Cache write error:', cacheErr.message);
  }

  // Alte Eintraege bereinigen (aelter als 7 Tage)
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    await db.query(
      'DELETE FROM daily_verses WHERE date < $1',
      [sevenDaysAgo.toISOString().split('T')[0]]
    );
  } catch (cleanupErr) {
    console.error('Cleanup error:', cleanupErr.message);
  }

  return { data: losungData.data, translation, cached: false };
}

module.exports = { fetchTageslosung };
