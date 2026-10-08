-- 197: Teilnehmer-Typ im Event-Chat nach der Rolle in der Gemeinde des
-- Termins (Simon, 08.10.2026; docs/planung/mehrfach-konten.md, Punkt 1).
--
-- Bis dahin trugen addToEventChat und syncEventChat (utils/eventChat.js) den
-- Typ aus der Rolle am Konto ein -- der Rolle der STAMM-Gemeinde. Wer zuhause
-- Gemeindeleitung und in B Teamer:in ist, sitzt in B's Event-Chats als
-- 'admin'; Chatliste und Zaehler in B suchen user_type = 'teamer' und finden
-- den Raum nicht. Der Code traegt seit diesem Stand die Rolle der Gemeinde
-- des Raums ein; diese Migration gleicht den Bestand an.
--
-- Regel wie ladeRolleInGemeinde (utils/orgMitglieder.js): in der
-- Stamm-Gemeinde users.role_id -- auch wenn user_organizations sie noch
-- einmal fuehrt --, in jeder weiteren user_organizations.role_id. Abbildung
-- konfi -> 'konfi', teamer -> 'teamer', alles andere -> 'admin' (wie
-- jahrgangChat.js). Nur Event-Chats (chat_rooms.event_id IS NOT NULL);
-- Jahrgangs-, Team-, Gruppen- und Einzelchats tragen die Rolle je Gemeinde
-- schon (jahrgangChat.js, teamChat.js, TEAM_MITGLIED_ROLLE in routes/chat.js).
--
-- Wer der Gemeinde des Raums nicht (mehr) angehoert, bleibt unveraendert --
-- es gibt dort keine Rolle, an der man den Typ ausrichten koennte.
--
-- ADDITIV: kein Schema, nur Werte, die der Code ohnehin so schreibt.
-- chat_participants hat keine Eindeutigkeit ueber user_type (UNIQUE ist
-- room_id, user_id), das UPDATE kann nicht kollidieren. Der Wert bleibt
-- einer der drei, die der CHECK erlaubt.
--
-- IDEMPOTENT: aktualisiert nur abweichende Zeilen; ein zweiter Lauf findet
-- keine mehr (tests/schema/migration197EventChatTeilnehmerTyp.test.js).
--
-- SPERRE: Zeilensperren nur auf den abweichenden Zeilen. Betroffen sind nur
-- Konten mit verschiedenen Rollen je Gemeinde (gemessen 01.10.2026: drei
-- Konten, docs/planung/mehrfach-konten.md); keine Tabellensperre.

UPDATE chat_participants cp
   SET user_type = soll.user_type
  FROM (
    SELECT cp2.id,
           CASE WHEN r.name = 'konfi' THEN 'konfi'
                WHEN r.name = 'teamer' THEN 'teamer'
                ELSE 'admin' END AS user_type
      FROM chat_participants cp2
      JOIN chat_rooms cr ON cr.id = cp2.room_id AND cr.event_id IS NOT NULL
      JOIN users u ON u.id = cp2.user_id
      LEFT JOIN user_organizations uo
        ON uo.user_id = u.id AND uo.organization_id = cr.organization_id
      JOIN roles r
        ON r.id = CASE WHEN u.organization_id = cr.organization_id THEN u.role_id
                       ELSE uo.role_id END
  ) soll
 WHERE cp.id = soll.id
   AND cp.user_type IS DISTINCT FROM soll.user_type;
