import admin from 'firebase-admin';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin SDK
// Expected: FIREBASE_SERVICE_ACCOUNT_KEY environment variable or serviceAccountKey.json file

let serviceAccount: any;

if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  // Parse from environment variable (for production)
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } catch (error) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON');
  }
} else {
  // Load from file (for local development)
  const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
  try {
    serviceAccount = require(keyPath);
  } catch (error) {
    console.warn('No serviceAccountKey.json found, Firebase Admin SDK may not initialize.');
    console.warn(
      'Please set FIREBASE_SERVICE_ACCOUNT_KEY env var or create serviceAccountKey.json'
    );
  }
}

let firebaseInitialized = false;

if (serviceAccount) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });
    console.log('✅ Firebase Admin SDK initialized');
    firebaseInitialized = true;
  } catch (error) {
    console.warn('⚠️  Firebase Admin SDK initialization failed:', error);
  }
} else {
  console.warn('⚠️  Firebase Admin SDK not initialized - auth may not work');
}

export const auth = firebaseInitialized ? admin.auth() : null;
export const db = firebaseInitialized ? admin.firestore() : null;
export const isFirebaseInitialized = firebaseInitialized;

// Test Firebase connection
export async function testFirebaseConnection(): Promise<boolean> {
  if (!firebaseInitialized || !auth) {
    console.warn('⚠️  Firebase not initialized - skipping connection test');
    return false;
  }
  try {
    // Try to get the Auth instance
    const testUser = await auth.getUser('test');
    console.log('Firebase connection test: Connection exists');
    return true;
  } catch (error: any) {
    // Expected to fail with user-not-found, but proves connection works
    if (error.code === 'auth/user-not-found') {
      console.log('✅ Firebase Auth connection verified');
      return true;
    }
    console.error('Firebase connection test failed:', error.message);
    return false;
  }
}

export default admin;
