import React from 'react';

/**
 * Eine Mail-Adresse, die vor dem @ und vor Punkten umbricht statt mitten im
 * Wort (so umbricht, wie man Adressen im Satz trennt: die Fortsetzung beginnt
 * mit „@" oder „."). Der Text bleibt derselbe -- für Suche, Kopieren und
 * Vorlesen --, nur die Umbruchstellen kommen als <wbr> dazu. Erst wenn ein
 * Stück allein nicht in die Zeile passt, greift das Umbrechen an beliebiger
 * Stelle aus dem Stil.
 */
const AdresseMitUmbruch: React.FC<{ adresse: string }> = ({ adresse }) => (
  <>
    {adresse.split(/(?=[@.])/).map((teil, i) => (
      // Die Stücke einer Adresse ändern ihre Reihenfolge nicht: Die Stelle ist der Schlüssel.
      <React.Fragment key={i}>{i > 0 && <wbr />}{teil}</React.Fragment>
    ))}
  </>
);

export default AdresseMitUmbruch;
