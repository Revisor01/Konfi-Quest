// Mitgliedschaft einer Person in der Gemeinde (GET /users): Das Konto kann in
// dieser Gemeinde zuhause sein ('stamm') oder die Person arbeitet ueber eine
// Gemeinde-Einladung mit ('weitere'; Audit 26.09.2026).

import type { AdminUser } from '../types/user';

/**
 * Bleibt das Konto bestehen, wenn die Person aus dieser Gemeinde entfernt wird?
 * Ja bei einer Person, die hier nur mitarbeitet, und bei einer, die auch in
 * einer anderen Gemeinde Mitglied ist (DELETE /users/:id entfernt sie dann nur
 * aus dieser Gemeinde, Simon 27.09.2026) -- der Knopf heisst dann "Entfernen"
 * statt "Loeschen", und die Rueckfrage sagt es.
 */
export const kontoBleibt = (u: Pick<AdminUser, 'mitgliedschaft' | 'weitere_gemeinden'>): boolean =>
  u.mitgliedschaft === 'weitere' || (u.weitere_gemeinden ?? 0) > 0;

/**
 * Bietet die Oberflaeche das Entfernen bzw. Loeschen an? Der Server sagt es
 * mit can_delete (08.10.2026); fehlt das Feld, gilt wie bisher can_edit.
 * Bearbeiten haengt allein an can_edit -- bei einem Konto mit
 * Super-Admin-Merkmal ist beides aus, beim Support-Gast nur das Bearbeiten.
 */
export const darfEntfernen = (u: Pick<AdminUser, 'can_edit' | 'can_delete'>): boolean =>
  u.can_delete ?? u.can_edit !== false;
