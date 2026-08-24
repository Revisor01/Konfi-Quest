// Anmeldung für die API-Dokumentation unter /docs/api.
//
// Warum nicht Basic-Auth: Der Browser-Dialog passt nicht zur App, lässt sich
// nicht gestalten und man kommt ohne Neustart des Browsers nicht wieder heraus.
// Simon wollte eine Anmeldung im Look von Konfi Quest (24.08.2026).
//
// Wie es zusammenspielt:
//   1. Der Reverse-Proxy fragt bei jedem Aufruf von /docs/api/* per Forward-Auth
//      hier nach (GET /api/docs-auth/pruefen). Antwortet die Route mit 200,
//      liefert der Proxy die Datei aus; bei 401 geht es zur Anmeldeseite.
//
//      Caddy baut den Redirect selbst (handle_response). Traefik kann das nicht
//      — es reicht die Antwort der Auth-Route unveraendert durch. Damit dieselbe
//      Route hinter beiden Proxys funktioniert, antwortet sie mit 302 statt 401,
//      sobald der Proxy per X-Forwarded-Uri sagt, welche Seite gemeint war.
//      Ohne diesen Header bleibt es bei 401 (Caddy-Weg, unveraendert).
//   2. Die Anmeldeseite (/docs/api/login.html) sendet das Passwort an
//      POST /api/docs-auth/anmelden und bekommt ein Cookie.
//   3. Das Cookie ist ein signiertes JWT — kein Passwort im Klartext, und der
//      Server muss sich keine Sitzungen merken.
//
// Das Passwort steht in DOCS_PASSWORD (Umgebungsvariable). Ohne die Variable
// bleibt die Doku gesperrt, statt versehentlich offen zu stehen.

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const COOKIE = 'kq_docs';
const GUELTIG_TAGE = 30;

/** Liest einen einzelnen Cookie-Wert aus dem Header (ohne Zusatzpaket). */
function cookieLesen(header, name) {
  if (!header) return null;
  for (const teil of header.split(';')) {
    const [k, ...rest] = teil.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

module.exports = () => {
  const express = require('express');
  const router = express.Router();

  const PASSWORT = process.env.DOCS_PASSWORD || '';
  const SECRET = process.env.JWT_SECRET;

  /**
   * Weist den Aufruf ab: 302 auf die Anmeldeseite, wenn der Proxy per
   * X-Forwarded-Uri mitteilt, welche Seite gemeint war (Traefik), sonst 401
   * und der Proxy leitet selbst um (Caddy).
   */
  function abweisen(req, res, grund) {
    const ziel = req.headers['x-forwarded-uri'];
    if (!ziel) {
      // Kein Proxy-Header: Caddy-Weg. Dort baut der Proxy den Redirect selbst.
      return res.status(401).json({ error: grund });
    }

    // Traefik-Weg. Das Ziel muss ABSOLUT und auf die oeffentliche Adresse
    // zeigen — ein relativer Pfad reicht hier nicht:
    //   - res.redirect() ergaenzt den Host DIESER Anfrage, und die kommt vom
    //     Proxy: "backend:5000", also das Container-Netz.
    //   - Ein von Hand gesetzter relativer Pfad wird von Traefik beim
    //     Durchreichen ebenfalls gegen die Adresse der Auth-Anfrage
    //     aufgeloest — dasselbe kaputte Ergebnis.
    // Beides in Produktion beobachtet (24.08.2026). Deshalb bauen wir die
    // URL aus den Headern, die der Proxy ueber den urspruenglichen Aufruf
    // mitschickt, und fallen nur zur Not auf den Host-Header zurueck.
    // Schema fest https: Die Doku ist oeffentlich nur ueber HTTPS erreichbar.
    // X-Forwarded-Proto taugt hier nicht als Quelle — auf godsapp steht
    // Apache (TLS) vor Traefik und setzt den Header nicht, Traefik meldet
    // deshalb "http". Ein http-Redirect schickt den Browser dann ueber einen
    // ueberfluessigen Umweg zurueck nach https.
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const pfad = `/docs/api/login.html?weiter=${encodeURIComponent(ziel)}`;
    res.setHeader('Location', host ? `https://${host}${pfad}` : pfad);
    return res.status(302).end();
  }

  /** Prüft das Cookie. Vom Reverse-Proxy per Forward-Auth aufgerufen. */
  router.get('/pruefen', (req, res) => {
    const wert = cookieLesen(req.headers.cookie, COOKIE);
    if (!wert) return abweisen(req, res, 'Nicht angemeldet');
    try {
      const inhalt = jwt.verify(wert, SECRET);
      if (inhalt.zweck !== 'docs') throw new Error('falscher Zweck');
      return res.status(200).json({ ok: true });
    } catch {
      return abweisen(req, res, 'Anmeldung abgelaufen');
    }
  });

  router.post('/anmelden', express.json(), (req, res) => {
    if (!PASSWORT) {
      console.error('DOCS_PASSWORD ist nicht gesetzt — die API-Doku bleibt gesperrt.');
      return res.status(503).json({ error: 'Die Anmeldung ist nicht eingerichtet.' });
    }

    const eingabe = String(req.body?.passwort || '');

    // Zeitkonstanter Vergleich: Ein einfaches === verrät über die Laufzeit,
    // wie viele Zeichen stimmen. Bei einem einzelnen Passwort ohne Benutzernamen
    // ist das die einzige Hürde, die es gibt.
    const a = crypto.createHash('sha256').update(eingabe).digest();
    const b = crypto.createHash('sha256').update(PASSWORT).digest();
    if (!crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Das Passwort stimmt nicht.' });
    }

    const token = jwt.sign({ zweck: 'docs' }, SECRET, { expiresIn: `${GUELTIG_TAGE}d` });
    res.setHeader('Set-Cookie',
      `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${GUELTIG_TAGE * 24 * 3600}; HttpOnly; Secure; SameSite=Lax`);
    return res.json({ ok: true });
  });

  router.post('/abmelden', (req, res) => {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    return res.json({ ok: true });
  });

  return router;
};
