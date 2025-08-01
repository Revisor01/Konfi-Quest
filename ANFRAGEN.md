--> Wir wollen noch Event Chat automatisch erstellen können. Also Gruppenchat erstellen. Und dann am besten auch mit rotem Icon in der Chatliste mit Datum und Titel des Event und den angemeldeten Konfis.

MEINE Datenbank liegt in einem Docker Volume: /var/lib/docker/volumes/konfi-quest_postgres_data/_data
Sollten wir das nicht persistent machen, mit einem Volume Mount?
Damit wir da auch regelmäßig backupen können
und macht redis Sinn, für caching, oder haben wir zu wenige daten die dauerhaft gechached werden können?

Wichtig: Es wird pro Jahrgang und ORganisation ca. 3-10 Admins geben. Eher 2-6 denke ich.


BEI Den anträgen: Konfis stellen Antrag mit Foto. Auch bei Events? Nein die Approven wir einfach so, wenn die da sind, dafür haben wir ja die App.
Ein Admin kann den Antrag sehen, das Bild anzeigen und sagt ja: Dann Punkte vergeben antrag erledigt. Oder nein, mit Begründung: Antrag wird abgelehnt.
Kann ein Admin alte Anträge löschen? Nein, eher nicht oder? Das macht keinen Sinn, ein Konfi dürfte das, wenn der Antrag noch nicht von einem Admin bearbeitet ist.
Sobald ein neuer Antrag von einem Konfi erstellt wird, gibt es eine Push bei einem zuständigen Admin der die erlaubnis zum approve hat. --> das muss ja aber in den Konfi Code, richtig?

Bei Badges müssen wir alle logiken checken. Da wird vieles neu werden müssen. Weil Events ja neu ist und da auch Kategorien vorhanden sind und das dazu zählen muss. Wir müssen das insgesamt anschauen. Und gleich dabei bedenken, dass wir den Konfis, zur Motivation eine Fortschrittanzeige pro Badge zeigen wollen. Einmal als anwachsende Linie aber auch als 1/3 oder sowas.

Frage zu Chat Berechtigungen: Nochmal ganz klar.
Ich will das Konfis nur Chats eröffnen können mit Admins die ihrem Jahrgang zugewiesen sind.
Ich will als Option haben das Konfis Chats eröffnen können auch mit Konfis.
Und ich will als Option haben das Konfis auch Gruppenchats eröffnen können.

Also
Nur Direktnachrichten
Direkt + Gruppe

Nur mit Admins
Mit allen im Jahrgang

So müsste es sein und auch dann als logik in der Chatansicht der Konfis funktionieresn.


Benutzer, Rollen und Organisation müssen wir vollständig anschauen.
Bei Benutzer erstellen wir alle User jenseits der Konfis
Bei Rollen können wir neben Hauptamt, Teamer:in, Konfirmand:in und Organisations-Admin weiter Rollen pro Organisation erfinden etwa Juleica oder so und denen bestimmte Rechte geben
Bei Organisation legen wir neue Organisationen an, mit dem ersten Org-admin, alles weiter mach dann dieser und wir können dann die Infos dort ändern. Anlegen von Organisationen kann nur der SuperAdmin. Und auch nur der soll diesen Reiter sehen. Der Super Admin muss also eigentlich ein extra Login sein, der eigentlich nur diese Verwaltung sieht. Alles andere sieht der nicht, sonst sieht der ja zu viele personendaten der anderen Organisationen. Oder noch besser, wir weisen dem user admin beide Rollen zu Organisations Admin und Super Admin. Dann sieht der ORganisationen und kann diese auch bearbeiten. Da ich meine eigene ORganisation habe in der ich Admin bin, mir aber auch das ganze Ding gehört, wäre das doch sinnvoll. Was sagst 