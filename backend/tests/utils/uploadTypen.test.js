// Die Regel des Upload-Filters (utils/uploadTypen.js), ohne Datenbank.
// Die Wege durch die Routen stehen in tests/routes/dateienOhneTyp.test.js.
const { wirksamerTyp, dateiFilter, erlaubteEndungen, DateitypAbgelehnt } = require('../../utils/uploadTypen');

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const datei = (originalname, mimetype) => ({ originalname, mimetype });

describe('wirksamerTyp', () => {
  it('ein erlaubter, gemeldeter Typ gilt wie bisher', () => {
    expect(wirksamerTyp(datei('Einladung.docx', DOCX), 'chat')).toBe(DOCX);
    expect(wirksamerTyp(datei('foto.jpg', 'image/jpeg'), 'chat')).toBe('image/jpeg');
  });

  it.each(['application/octet-stream', '', 'binary/octet-stream', undefined])(
    'allgemeine Angabe %j: die Endung entscheidet', (typ) => {
      expect(wirksamerTyp(datei('Einladung.docx', typ), 'chat')).toBe(DOCX);
      expect(wirksamerTyp(datei('Ablauf.TXT', typ), 'chat')).toBe('text/plain');
    }
  );

  it('text/plain bei einer Nicht-Text-Endung gilt als "keine Angabe" (busboy-Vorgabe ohne Typ-Zeile)', () => {
    expect(wirksamerTyp(datei('Einladung.docx', 'text/plain'), 'chat')).toBe(DOCX);
    // Bei Text und bei unbekannter Endung bleibt es Text -- und damit bei der Textpruefung.
    expect(wirksamerTyp(datei('ablauf.txt', 'text/plain'), 'chat')).toBe('text/plain');
    expect(wirksamerTyp(datei('notiz.md', 'text/plain'), 'chat')).toBe('text/plain');
    expect(wirksamerTyp(datei('liste.csv', 'text/plain'), 'chat')).toBe('text/plain');
  });

  it('allgemeine Angabe, aber Endung nicht erlaubt oder fehlt -> abweisen', () => {
    expect(wirksamerTyp(datei('setup.exe', 'application/octet-stream'), 'chat')).toBeNull();
    expect(wirksamerTyp(datei('Einladung', 'application/octet-stream'), 'chat')).toBeNull();
    expect(wirksamerTyp(datei('Liste.xlsx', 'application/octet-stream'), 'chat')).toBeNull();
  });

  it('ein anderer Name fuer denselben Typ: die Endung entscheidet (Inhalt pruefen die Kopfbytes)', () => {
    expect(wirksamerTyp(datei('Sprachmemo.m4a', 'audio/x-m4a'), 'chat')).toBe('audio/mp4');
    expect(wirksamerTyp(datei('Sprachmemo.m4a', 'audio/x-m4a'), 'material')).toBe('audio/mp4');
    // Behauptet der Typ etwas Verbotenes, der Name aber etwas Erlaubtes, geht
    // die Datei in die Pruefung des Namens -- dort faellt ein Programm an den
    // Kopfbytes durch, HTML an der Textpruefung (tests/routes/dateienOhneTyp).
    expect(wirksamerTyp(datei('Einladung.docx', 'application/x-msdownload'), 'chat')).toBe(DOCX);
    expect(wirksamerTyp(datei('notiz.txt', 'text/html'), 'chat')).toBe('text/plain');
  });

  it('weder Typ noch Endung erlaubt -> abweisen', () => {
    expect(wirksamerTyp(datei('setup.exe', 'application/x-msdownload'), 'chat')).toBeNull();
    expect(wirksamerTyp(datei('seite.html', 'text/html'), 'chat')).toBeNull();
    expect(wirksamerTyp(datei('archiv.zip', 'application/zip'), 'chat')).toBeNull();
  });

  it('die Listen je Route: Excel im Material ja, im Chat nein; Challenges jedes Bild', () => {
    const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    expect(wirksamerTyp(datei('Liste.xlsx', 'application/octet-stream'), 'material')).toBe(xlsx);
    expect(wirksamerTyp(datei('bild.bmp', 'image/bmp'), 'challenge')).toBe('image/bmp');
    expect(wirksamerTyp(datei('bild.bmp', 'image/bmp'), 'chat')).toBeNull();
    expect(wirksamerTyp(datei('clip.m4v', 'application/octet-stream'), 'challenge')).toBe('video/x-m4v');
    expect(wirksamerTyp(datei('plan.pdf', 'application/pdf'), 'antrag')).toBeNull();
    expect(wirksamerTyp(datei('nachweis.heic', ''), 'antrag')).toBe('image/heic');
  });

  it('Gross-/Kleinschreibung und Leerzeichen der Angabe spielen keine Rolle', () => {
    expect(wirksamerTyp(datei('Foto.JPG', ' Application/Octet-Stream '), 'chat')).toBe('image/jpeg');
    expect(wirksamerTyp(datei('Foto.jpg', 'IMAGE/JPEG'), 'chat')).toBe('image/jpeg');
  });
});

describe('dateiFilter', () => {
  const filtern = (file, route = 'chat') => new Promise((fertig) => {
    dateiFilter(route)({}, file, (fehler, annehmen) => fertig({ fehler, annehmen }));
  });

  it('nimmt an und setzt den ermittelten Typ, der gemeldete bleibt erhalten', async () => {
    const file = datei('Einladung.docx', 'application/octet-stream');
    const { fehler, annehmen } = await filtern(file);
    expect(fehler).toBeNull();
    expect(annehmen).toBe(true);
    expect(file.mimetype).toBe(DOCX);
    expect(file.gemeldeterTyp).toBe('application/octet-stream');
  });

  it('weist hoerbar ab: DateitypAbgelehnt mit 415 und dem Satz der Route', async () => {
    const warnung = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { fehler } = await filtern(datei('Anna_Taufspruch.exe', 'application/octet-stream'));
      expect(fehler).toBeInstanceOf(DateitypAbgelehnt);
      expect(fehler.status).toBe(415);
      expect(fehler.message).toBe('Dieser Dateityp kann nicht gesendet werden.');
      // Protokoll: derselbe Wortlaut wie vor dem 29.09.2026, ohne Dateinamen.
      expect(warnung).toHaveBeenCalledWith('Datei abgelehnt: Endung .exe, Typ application/octet-stream');

      const material = await filtern(datei('setup.exe', 'application/x-msdownload'), 'material');
      expect(material.fehler.message).toBe('Dieser Dateityp kann nicht hochgeladen werden.');
      expect(warnung).toHaveBeenLastCalledWith('Material-Datei abgelehnt: Endung .exe, Typ application/x-msdownload');
    } finally {
      warnung.mockRestore();
    }
  });
});

describe('erlaubteEndungen', () => {
  it('Chat: genau die Formate aus dem Handbuch', () => {
    expect(erlaubteEndungen('chat').sort()).toEqual([
      'csv', 'doc', 'docx', 'gif', 'heic', 'heif', 'jpeg', 'jpg', 'm4a', 'mov', 'mp3', 'mp4',
      'ogg', 'pdf', 'png', 'ppt', 'pptx', 'txt', 'wav', 'webm', 'webp',
    ]);
  });
});
