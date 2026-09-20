/**
 * notificationMeta.js — B4/B5 (redesign plan §6.5): derives `category` (for
 * the front's per-category push/SMS/WhatsApp preferences) and `priority`
 * (for the SMS fallback job's "is this critical, send immediately" check)
 * from a notification `type`. Computed automatically in utils/notify.js so
 * no existing call site needs to change.
 */

const CATEGORY_BY_TYPE = {
  RESERVATION_REQUESTED: 'reservations',
  RESERVATION_APPROVED: 'reservations',
  RESERVATION_REJECTED: 'reservations',
  RESERVATION_CANCELLED: 'reservations',
  RESERVATION_CONFIRMED: 'reservations',
  TRANSPORT_ASSIGNED: 'transport',
  TRANSPORT_ACCEPTED: 'transport',
  TRANSPORT_REJECTED: 'transport',
  TRANSPORT_DELIVERED: 'transport',
  TRANSPORT_EXPIRING: 'transport',
  TRANSPORT_PAYMENT_RECEIVED: 'paiements',
  PAYMENT_DUE: 'paiements',
  PAYMENT_RECEIVED: 'paiements',
  PAYMENT_CONFIRMED: 'paiements',
  PAYOUT_SENT: 'paiements',
  DISPUTE_OPENED: 'compte',
  DISPUTE_RESOLVED: 'compte',
  CAPACITY_LOW: 'compte',
  GENERAL: 'compte',
};

// Critical types always send SMS immediately (never deferred to the B5
// fallback job) and always attempt push regardless of quiet hours (future).
const CRITICAL_TYPES = new Set([
  'PAYMENT_DUE',
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
  'TRANSPORT_EXPIRING',
  'DISPUTE_OPENED',
]);

function resolveNotificationCategory(type) {
  return CATEGORY_BY_TYPE[type] || 'compte';
}

function resolveNotificationPriority(type) {
  return CRITICAL_TYPES.has(type) ? 'critical' : 'normal';
}

module.exports = { resolveNotificationCategory, resolveNotificationPriority, CRITICAL_TYPES };
