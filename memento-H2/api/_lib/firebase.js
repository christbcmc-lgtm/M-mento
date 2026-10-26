// Initialisation de Firebase Admin a partir des variables d'environnement Vercel.
// Aucun secret n'est stocke dans le code : tout vient de process.env.
const admin = require('firebase-admin');

let app;
function getApp() {
  if (app) return app;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
  // Vercel stocke les sauts de ligne comme \n litteraux : on les restaure.
  privateKey = privateKey.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Variables Firebase manquantes (FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY).');
  }
  app = admin.apps.length
    ? admin.app()
    : admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  return app;
}

function db() { getApp(); return admin.firestore(); }
function auth() { getApp(); return admin.auth(); }

module.exports = { admin, getApp, db, auth };
