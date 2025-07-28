// Utility functions for password generation

const generateBiblicalPassword = () => {
  const BIBLE_BOOKS = [
    'Genesis', 'Exodus', 'Levitikus', 'Numeri', 'Deuteronomium',
    'Josua', 'Richter', 'Ruth', 'Samuel', 'Koenige', 'Chronik',
    'Esra', 'Nehemia', 'Ester', 'Hiob', 'Psalmen', 'Sprueche',
    'Prediger', 'Hohelied', 'Jesaja', 'Jeremia', 'Klagelieder',
    'Hesekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadja',
    'Jona', 'Micha', 'Nahum', 'Habakuk', 'Zephanja', 'Haggai',
    'Sacharja', 'Maleachi', 'Matthaeus', 'Markus', 'Lukas',
    'Johannes', 'Apostelgeschichte', 'Roemer', 'Korinther',
    'Galater', 'Epheser', 'Philipper', 'Kolosser', 'Thessalonicher',
    'Timotheus', 'Titus', 'Philemon', 'Hebraeer', 'Jakobus',
    'Petrus', 'Johannes', 'Judas', 'Offenbarung'
  ];
  
  const book = BIBLE_BOOKS[Math.floor(Math.random() * BIBLE_BOOKS.length)];
  const chapter = Math.floor(Math.random() * 50) + 1;
  const verse = Math.floor(Math.random() * 30) + 1;
  return `${book}${chapter},${verse}`;
};

module.exports = {
  generateBiblicalPassword
};