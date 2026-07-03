-- Audit 03.07.2026 (Achse 1, F3): Der User-Delete-Handler loeschte
-- chat_participants, liess leere Direct-Raeume aber stehen (Raum-Leichen 50/51
-- mit organization_id NULL, 0 Teilnehmern, 0 Nachrichten). Bestand bereinigen;
-- der Handler in users.js raeumt kuenftig selbst auf. Die Cascade-Kette aus
-- Migration 102 nimmt Nachrichten/Teilnehmer/Read-Status automatisch mit.
-- Bewusst NUR Raeume ohne Teilnehmer — Direct-Raeume mit einem verbliebenen
-- Teilnehmer (z.B. Raum 98) bleiben unangetastet (Entscheidung des Betreibers).

DELETE FROM chat_rooms r
WHERE r.type = 'direct'
  AND NOT EXISTS (SELECT 1 FROM chat_participants p WHERE p.room_id = r.id);
