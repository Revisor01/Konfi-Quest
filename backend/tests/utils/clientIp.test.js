// X-Real-IP gilt nur, wenn die Anfrage vom eigenen Proxy kommt
// (Audit 26.09.2026, Sicherheit BF-13).
//
// Alle IP-Limiter zaehlen auf clientIp(). Bisher nahm die Funktion den Header
// X-Real-IP ungeprueft -- wer das Backend ohne den Proxy erreicht, haette mit
// jeder Anfrage eine andere "Adresse" geschickt und waere nie in ein Limit
// gelaufen. Jetzt zaehlt der Header nur, wenn der direkte Gegenueber
// (req.socket.remoteAddress) im Docker-Netz liegt: Loopback, Link-Local oder
// ein privater Bereich. Sonst gilt req.ip.
const express = require('express');
const request = require('supertest');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { clientIp } = require('../../utils/clientIp');

// Nachgebautes Request-Objekt: nur die drei Felder, die clientIp liest.
const anfrage = ({ header, peer, ip }) => ({
  headers: header === undefined ? {} : { 'x-real-ip': header },
  socket: { remoteAddress: peer },
  ip,
});

describe('clientIp: X-Real-IP nur vom vertrauten Proxy', () => {
  describe('erlaubt -- der Gegenueber ist der Proxy im Docker-Netz', () => {
    it('privates IPv4-Netz (Docker-Bridge 172.16/12): Header zaehlt', () => {
      expect(clientIp(anfrage({ header: '203.0.113.7', peer: '172.18.0.5', ip: '172.18.0.5' })))
        .toBe('203.0.113.7');
    });

    it('privates Netz 192.168/16 und 10/8: Header zaehlt', () => {
      expect(clientIp(anfrage({ header: '203.0.113.7', peer: '192.168.5.9', ip: '192.168.5.9' })))
        .toBe('203.0.113.7');
      expect(clientIp(anfrage({ header: '203.0.113.7', peer: '10.0.0.2', ip: '10.0.0.2' })))
        .toBe('203.0.113.7');
    });

    it('IPv4-mapped-IPv6 (::ffff:172.18.0.5), wie Node den Peer meldet: Header zaehlt', () => {
      expect(clientIp(anfrage({ header: '203.0.113.7', peer: '::ffff:172.18.0.5', ip: '172.18.0.5' })))
        .toBe('203.0.113.7');
    });

    it('Loopback (Entwicklung, Tests): Header zaehlt', () => {
      expect(clientIp(anfrage({ header: '203.0.113.7', peer: '127.0.0.1', ip: '127.0.0.1' })))
        .toBe('203.0.113.7');
      expect(clientIp(anfrage({ header: '203.0.113.7', peer: '::1', ip: '::1' })))
        .toBe('203.0.113.7');
    });

    it('Header mit Leerraum wird getrimmt', () => {
      expect(clientIp(anfrage({ header: ' 203.0.113.7 ', peer: '172.18.0.5', ip: '172.18.0.5' })))
        .toBe('203.0.113.7');
    });
  });

  describe('verboten -- kein Proxy-Merkmal', () => {
    it('oeffentliche Peer-Adresse: gefaelschter Header wird ignoriert, req.ip gilt', () => {
      expect(clientIp(anfrage({ header: '198.51.100.1', peer: '203.0.113.9', ip: '203.0.113.9' })))
        .toBe('203.0.113.9');
    });

    it('oeffentliche IPv6-Peer-Adresse: Header wird ignoriert', () => {
      expect(clientIp(anfrage({ header: '198.51.100.1', peer: '2001:db8::10', ip: '2001:db8::10' })))
        .toBe('2001:db8::10');
    });

    it('Header ohne gueltige IP-Adresse (auch vom Proxy): req.ip gilt', () => {
      expect(clientIp(anfrage({ header: 'irgendwas', peer: '172.18.0.5', ip: '172.18.0.5' })))
        .toBe('172.18.0.5');
      expect(clientIp(anfrage({ header: '', peer: '172.18.0.5', ip: '172.18.0.5' })))
        .toBe('172.18.0.5');
    });

    it('ohne Header: req.ip gilt', () => {
      expect(clientIp(anfrage({ peer: '172.18.0.5', ip: '172.18.0.5' }))).toBe('172.18.0.5');
    });

    it('ohne Peer-Adresse (Socket schon weg): req.ip gilt, Header wird nicht vertraut', () => {
      expect(clientIp({ headers: { 'x-real-ip': '198.51.100.1' }, socket: {}, ip: '203.0.113.9' }))
        .toBe('203.0.113.9');
    });
  });

  // Derselbe Aufbau wie die Limiter in server.js: keyGenerator ueber
  // ipKeyGenerator(clientIp(req)). Der Peer wird je Test auf eine feste
  // Adresse gesetzt -- supertest verbindet immer ueber Loopback, das allein
  // koennte den verbotenen Fall nicht erreichen.
  describe('im Limiter (wie server.js)', () => {
    const appMitPeer = (peer) => {
      const app = express();
      app.set('trust proxy', 1); // wie createApp.js
      app.use((req, res, next) => {
        Object.defineProperty(req.socket, 'remoteAddress', { value: peer, configurable: true });
        next();
      });
      app.use(rateLimit({
        windowMs: 60 * 1000,
        max: 2,
        keyGenerator: (req) => ipKeyGenerator(clientIp(req)),
        standardHeaders: true,
        legacyHeaders: false,
      }));
      app.get('/', (req, res) => res.json({ ok: true }));
      return app;
    };

    it('ohne Proxy-Merkmal zaehlt der Limiter auf die echte Adresse -- wechselnde X-Real-IP hilft nicht', async () => {
      const app = appMitPeer('203.0.113.9');
      const status = [];
      for (const ip of ['198.51.100.1', '198.51.100.2', '198.51.100.3']) {
        const res = await request(app).get('/').set('X-Real-IP', ip);
        status.push(res.status);
      }
      expect(status).toEqual([200, 200, 429]);
    });

    it('vom Proxy im Docker-Netz zaehlt der Limiter je X-Real-IP', async () => {
      const app = appMitPeer('172.18.0.5');
      const status = [];
      for (const ip of ['198.51.100.1', '198.51.100.2', '198.51.100.3']) {
        const res = await request(app).get('/').set('X-Real-IP', ip);
        status.push(res.status);
      }
      expect(status).toEqual([200, 200, 200]);
    });
  });
});
