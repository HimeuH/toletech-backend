/**
 * SMS provider abstraction.
 * Supported providers: twilio, africastalking
 * Configure via env vars:
 *   SMS_PROVIDER=twilio|africastalking
 *   SMS_API_KEY
 *   SMS_API_SECRET
 *   SMS_SENDER_ID
 */

const sendSms = async (phone, message) => {
  const provider = process.env.SMS_PROVIDER;

  if (!provider) {
    // Dev mode: just log the SMS
    console.log(`[SMS] To: ${phone} | Message: ${message}`);
    return;
  }

  if (provider === 'twilio') {
    const twilio = require('twilio');
    const client = twilio(process.env.SMS_API_KEY, process.env.SMS_API_SECRET);
    await client.messages.create({
      body: message,
      from: process.env.SMS_SENDER_ID,
      to: phone
    });
    return;
  }

  if (provider === 'africastalking') {
    const AfricasTalking = require('africastalking');
    const at = AfricasTalking({
      apiKey: process.env.SMS_API_KEY,
      username: process.env.SMS_API_SECRET
    });
    await at.SMS.send({
      to: [phone],
      message,
      from: process.env.SMS_SENDER_ID
    });
    return;
  }

  throw new Error(`Unknown SMS_PROVIDER: ${provider}`);
};

module.exports = sendSms;
