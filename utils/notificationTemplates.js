/**
 * notificationTemplates.js — Centralized notification copy (S7-BE-02)
 *
 * Each template is a function that receives a data object and returns:
 *   { title, inApp, sms, whatsapp }
 *
 * - title    : used for in-app notification title
 * - inApp    : full sentence shown in the notification center
 * - sms      : short text (< 160 chars recommended)
 * - whatsapp : can use bold (*text*) and line breaks — sent via WhatsApp
 */

const fmt = (amount) =>
  amount >= 1_000_000
    ? `${(amount / 1_000_000).toFixed(1)}M FCFA`
    : amount >= 1000
    ? `${Math.round(amount / 1000)}K FCFA`
    : `${amount} FCFA`;

module.exports = {
  // ─── Réservations ─────────────────────────────────────────────────────────

  RESERVATION_REQUESTED: ({ farmerName, storageName }) => ({
    title: 'Nouvelle demande de réservation',
    inApp: `${farmerName} a demandé votre entrepôt "${storageName}".`,
    sms: `ToleTech: ${farmerName} a demandé votre entrepôt ${storageName}. Connectez-vous pour répondre.`,
    whatsapp: `🌾 *ToleTech* — Nouvelle demande\n*${farmerName}* souhaite réserver *${storageName}*.\nConnectez-vous pour approuver ou rejeter la demande.`,
  }),

  RESERVATION_APPROVED: ({ storageName }) => ({
    title: 'Réservation approuvée',
    inApp: `Votre demande pour "${storageName}" a été approuvée.`,
    sms: `ToleTech: Votre demande pour ${storageName} a été approuvée. Confirmez pour finaliser.`,
    whatsapp: `✅ *ToleTech* — Demande approuvée\nVotre réservation pour *${storageName}* a été approuvée par le propriétaire.\nConnectez-vous pour confirmer.`,
  }),

  RESERVATION_REJECTED: ({ storageName }) => ({
    title: 'Réservation refusée',
    inApp: `Votre demande pour "${storageName}" a été refusée.`,
    sms: `ToleTech: Votre demande pour ${storageName} a malheureusement été refusée.`,
    whatsapp: `❌ *ToleTech* — Demande refusée\nVotre réservation pour *${storageName}* n'a pas été retenue.\nConsultez d'autres espaces disponibles sur la plateforme.`,
  }),

  RESERVATION_CONFIRMED: ({ storageName, reservedFrom, reservedTo }) => ({
    title: 'Réservation confirmée',
    inApp: `Votre réservation de "${storageName}" est confirmée du ${reservedFrom} au ${reservedTo}.`,
    sms: `ToleTech: Réservation confirmée — ${storageName} du ${reservedFrom} au ${reservedTo}.`,
    whatsapp: `🎉 *ToleTech* — Réservation confirmée\n*${storageName}* est réservé pour vous\nDu *${reservedFrom}* au *${reservedTo}*.\nBonne campagne agricole !`,
  }),

  RESERVATION_CANCELLED: ({ farmerName, storageName }) => ({
    title: 'Réservation annulée',
    inApp: `${farmerName} a annulé sa réservation pour "${storageName}".`,
    sms: `ToleTech: ${farmerName} a annulé sa réservation pour ${storageName}.`,
    whatsapp: `⚠️ *ToleTech* — Réservation annulée\n*${farmerName}* a annulé sa réservation pour *${storageName}*.\nL'espace est à nouveau disponible.`,
  }),

  // ─── Transport ────────────────────────────────────────────────────────────

  TRANSPORT_ASSIGNED: ({ storageName, farmerName, proposedFee }) => ({
    title: 'Nouvelle demande de transport',
    inApp: `${farmerName} vous demande un transport pour "${storageName}" — prix proposé : ${fmt(proposedFee)}.`,
    sms: `ToleTech: ${farmerName} demande un transport (${storageName}). Prix proposé: ${fmt(proposedFee)}. Connectez-vous pour accepter ou refuser.`,
    whatsapp: `🚚 *ToleTech* — Demande de transport\n*${farmerName}* demande votre service pour *${storageName}*.\nPrix proposé : *${fmt(proposedFee)}*\nConnectez-vous pour accepter ou refuser.`,
  }),

  TRANSPORT_ACCEPTED: ({ transporterName, agreedFee }) => ({
    title: 'Transport accepté',
    inApp: `${transporterName} a accepté votre demande de transport pour ${fmt(agreedFee)}.`,
    sms: `ToleTech: ${transporterName} a accepté votre transport (${fmt(agreedFee)}). Il vous contactera bientôt.`,
    whatsapp: `✅ *ToleTech* — Transport accepté\n*${transporterName}* prend en charge votre transport.\nMontant convenu : *${fmt(agreedFee)}*`,
  }),

  TRANSPORT_REJECTED: ({ transporterName, note }) => ({
    title: 'Demande de transport refusée',
    inApp: `${transporterName} a refusé votre demande de transport.${note ? ` Motif : ${note}` : ''}`,
    sms: `ToleTech: ${transporterName} a refusé votre demande de transport.${note ? ` Motif: ${note}` : ''} Contactez un autre transporteur.`,
    whatsapp: `❌ *ToleTech* — Transport refusé\n*${transporterName}* n'est pas disponible pour cette mission.${note ? `\nMotif : ${note}` : ''}\nChoisissez un autre transporteur sur la plateforme.`,
  }),

  TRANSPORT_DELIVERED: ({ storageName }) => ({
    title: 'Livraison confirmée',
    inApp: `Votre marchandise de "${storageName}" a été livrée avec succès.`,
    sms: `ToleTech: Livraison confirmée pour ${storageName}. Merci d'utiliser ToleTech.`,
    whatsapp: `📦 *ToleTech* — Livraison confirmée\nVotre marchandise depuis *${storageName}* a bien été livrée.\nMerci d'utiliser ToleTech !`,
  }),

  // ─── Litiges ──────────────────────────────────────────────────────────────

  DISPUTE_OPENED: ({ farmerName, storageName, reason }) => ({
    title: 'Nouveau litige ouvert',
    inApp: `${farmerName} a ouvert un litige sur "${storageName}" : ${reason}.`,
    sms: `ToleTech: Litige ouvert par ${farmerName} sur ${storageName}. Motif: ${reason}.`,
    whatsapp: `⚠️ *ToleTech* — Litige ouvert\n*${farmerName}* a signalé un problème sur *${storageName}*.\nMotif : ${reason}\nConnectez-vous pour traiter le litige.`,
  }),

  DISPUTE_RESOLVED: ({ storageName, resolution }) => ({
    title: 'Litige résolu',
    inApp: `Votre litige sur "${storageName}" a été résolu.`,
    sms: `ToleTech: Votre litige sur ${storageName} a été résolu. ${resolution}`,
    whatsapp: `✅ *ToleTech* — Litige résolu\nVotre litige concernant *${storageName}* a été traité par l'administration.\nRésolution : ${resolution}`,
  }),

  // ─── Paiements & Wallet ───────────────────────────────────────────────────

  PAYMENT_DUE: ({ storageName, amount }) => ({
    title: 'Paiement en attente',
    inApp: `Un paiement de ${fmt(amount)} est dû pour "${storageName}".`,
    sms: `ToleTech: Paiement de ${fmt(amount)} en attente pour ${storageName}. Réglez sur la plateforme.`,
    whatsapp: `💳 *ToleTech* — Paiement en attente\nMontant dû : *${fmt(amount)}*\nPour : *${storageName}*\nRéglez votre solde sur la plateforme pour éviter l'annulation.`,
  }),

  PAYOUT_PROCESSED: ({ amount, frequencyDays }) => ({
    title: 'Virement reçu',
    inApp: `Votre virement automatique de ${fmt(amount)} a été effectué (tous les ${frequencyDays} jours).`,
    sms: `ToleTech: Virement de ${fmt(amount)} effectué sur votre compte. Fréquence : tous les ${frequencyDays} jours.`,
    whatsapp: `💰 *ToleTech* — Virement reçu\nMontant : *${fmt(amount)}*\nVotre virement automatique (tous les ${frequencyDays} jours) a bien été traité.\nConsultez votre wallet pour les détails.`,
  }),
};
