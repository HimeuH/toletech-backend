/**
 * ProviderBalance — tracks funds held in escrow for a storage owner or transporter.
 *
 * Must be a separate collection (not a Wallet subdoc) because the number of
 * providers is unbounded over time.
 *
 * heldAmount   = collected but not yet released (payout pending VALIDÉ status)
 * releasedAmount = total released to date (informational)
 *
 * Payout rule: only release heldAmount when Reservation.status === 'VALIDÉ'
 *              and no open LITIGE. Triggered by cron or ADMIN — never frontend.
 */

const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const providerBalanceSchema = new Schema(
  {
    provider:       { type: Types.ObjectId, ref: 'User', required: true, unique: true },
    currency:       { type: String, default: 'XOF' },
    heldAmount:     { type: Number, default: 0, min: 0 },
    releasedAmount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProviderBalance', providerBalanceSchema);
