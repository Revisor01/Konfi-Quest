// Die Adressen des Chats je Rolle: /konfi/chat, /teamer/chat, /admin/chat und
// darunter /room/:id. Dieselben, die navigation/rollenBaeume.ts fuehrt -- die
// Web-Fassung navigiert zwischen ihnen, ohne die Routen zu aendern.

/** Der Pfadanfang der Rolle (Leitung und Admins: /admin). */
export const chatBasis = (nutzerTyp: string | undefined): string =>
  nutzerTyp === 'admin' ? '/admin' : nutzerTyp === 'teamer' ? '/teamer' : '/konfi';

/** Die Liste ohne geoeffneten Raum. */
export const chatListeAdresse = (nutzerTyp: string | undefined): string => `${chatBasis(nutzerTyp)}/chat`;

/** Ein Raum neben der Liste. */
export const chatRaumAdresse = (nutzerTyp: string | undefined, raumId: number): string =>
  `${chatListeAdresse(nutzerTyp)}/room/${raumId}`;
