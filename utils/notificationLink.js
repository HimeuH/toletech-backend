/**
 * notificationLink.js — B2: resolve the front-end deep link for a notification.
 *
 * Centralized so every call site (12+ across controllers and cron jobs) gets a
 * working `link` without being touched individually, and so the mapping only
 * has to change in one place when routes are renamed (Phase 3 of the UX plan).
 *
 * Paths match the CURRENT front-end route table (tooltech-front/src/app/features/*)
 * so notifications work immediately, not only once the redesign ships.
 */
module.exports = function resolveNotificationLink(type, data = {}) {
  if (data.reservationId) {
    // The transporter side of a transport request lives on /transport/missions/:id
    // (role TRANSPORTEUR); every other reservation-related type is read by the
    // farmer/owner/agent side on /reservations/:id/detail.
    if (type === 'TRANSPORT_ASSIGNED') {
      return `/transport/missions/${data.reservationId}`;
    }
    return `/reservations/${data.reservationId}/detail`;
  }

  if (data.billingId) {
    return `/facturation/${data.billingId}/detail`;
  }

  if (data.walletId) {
    return `/facturation/wallet`;
  }

  if (data.storageId) {
    return `/espaces-disponibles/${data.storageId}/detail`;
  }

  return null;
};
