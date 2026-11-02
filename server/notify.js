// Notifications: one place every feature writes to, so the bell always tells the truth.
import { getDb, save, newId, nowIso } from './store.js';

export const NOTIFY_TYPES = ['love', 'like', 'comment', 'share', 'request', 'accepted', 'sos', 'game', 'housing', 'system'];

export function notify(userId, type, text, fromId = null, ref = null) {
  if (!userId) return null;
  const d = getDb();
  if (!d.notifications) d.notifications = [];
  const row = {
    id: newId('n'),
    userId,
    type: NOTIFY_TYPES.includes(type) ? type : 'system',
    text,
    fromId,
    ref,
    at: nowIso(),
    read: false,
  };
  d.notifications.push(row);
  if (d.notifications.length > 3000) d.notifications = d.notifications.slice(-2000);
  save();
  return row;
}

export function notifyCircle(userId, type, text, ref = null) {
  const d = getDb();
  const mates = (d.circle || [])
    .filter((c) => c.a === userId || c.b === userId)
    .map((c) => (c.a === userId ? c.b : c.a));
  for (const mate of mates) notify(mate, type, text, userId, ref);
}
