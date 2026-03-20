/**
 * WhatsApp sender abstraction (Twilio WhatsApp Business API).
 *
 * Env vars:
 *   SMS_PROVIDER=twilio          (reuses the SMS provider setting)
 *   SMS_API_KEY                  (Twilio Account SID)
 *   SMS_API_SECRET               (Twilio Auth Token)
 *   WHATSAPP_SENDER_ID           (e.g. whatsapp:+14155238886 for sandbox,
 *                                  or whatsapp:+YOUR_BUSINESS_NUMBER)
 *
 * In dev mode (no SMS_PROVIDER), messages are logged to console only.
 */

const sendWhatsApp = async (phone, message) => {
  const provider = process.env.SMS_PROVIDER;

  if (!provider) {
    console.log(`[WhatsApp] To: ${phone} | Message: ${message}`);
    return;
  }

  if (provider === 'twilio') {
    const twilio = require('twilio');
    const client = twilio(process.env.SMS_API_KEY, process.env.SMS_API_SECRET);
    const sender = process.env.WHATSAPP_SENDER_ID || `whatsapp:${process.env.SMS_SENDER_ID}`;
    await client.messages.create({
      body: message,
      from: sender,
      to: `whatsapp:${phone}`,
    });
    return;
  }

  // Other providers: log and skip gracefully
  console.warn(`[WhatsApp] Provider "${provider}" does not support WhatsApp — message skipped.`);
};

module.exports = sendWhatsApp;
