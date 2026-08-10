import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_FILE ? JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8')) : { projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') };
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const email = process.env.ADMIN_EMAIL ?? 'spcarla@dbcompare.local';
const username = 'SPCARLA';
const name = 'Carla Fillmann Barcelos';
const password = process.env.ADMIN_INITIAL_PASSWORD;
const auth = getAuth();
let user;
try { user = await auth.getUserByEmail(email); }
catch {
  if (!password) throw new Error('O usuário não existe. Defina ADMIN_INITIAL_PASSWORD para criá-lo.');
  user = await auth.createUser({ email, password, displayName: name });
}
await auth.setCustomUserClaims(user.uid, { role: 'admin', username });
await getFirestore().collection('users').doc(user.uid).set({ name, username, role: 'admin', theme: 'system', updatedAt: new Date() }, { merge: true });
console.log(`Administrador ${username} provisionado.`);
