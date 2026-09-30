/**
 * Shared helpers for the prod seed / purge scripts.
 *
 * MONGO_URI is read from the environment first (dotenv never overrides an
 * existing var), so prod runs look like:
 *   MONGO_URI="mongodb+srv://.../toletech?..." node scripts/seed-prod.js --staff
 */
const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../config/config.env') });

// Every demo account uses this email domain — it is the single marker
// purge-demo.js relies on, so never create a real user with it.
const DEMO_EMAIL_DOMAIN = 'demo.toletech.sn';
const DEMO_EMAIL_REGEX = new RegExp(`@${DEMO_EMAIL_DOMAIN.replace(/\./g, '\\.')}$`, 'i');

const ask = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

/**
 * Connects, prints the target cluster/db, and asks the operator to type the
 * db name back before anything is written. Refuses the default `test` db —
 * a URI without `/<dbname>` silently lands there.
 */
const connectAndConfirm = async (action) => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');

  await mongoose.connect(process.env.MONGO_URI);
  const { host, name } = mongoose.connection;

  if (name === 'test') {
    throw new Error('Connected to the default "test" database — add /<dbname> to MONGO_URI before the "?"');
  }

  console.log(`\nTarget : ${host}`);
  console.log(`DB     : ${name}`);
  console.log(`Action : ${action}\n`);

  if (!process.argv.includes('--yes')) {
    const answer = await ask(`Type the database name ("${name}") to continue: `);
    if (answer !== name) throw new Error('Aborted — database name did not match');
  }
};

module.exports = { DEMO_EMAIL_DOMAIN, DEMO_EMAIL_REGEX, connectAndConfirm };
