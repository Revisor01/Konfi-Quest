const admin = require('firebase-admin');

// Firebase Admin initialisieren (Service Account wird später hinzugefügt)
let firebaseApp = null;

const initializeFirebase = () => {
  if (firebaseApp) {
    console.log('🔥 Firebase already initialized');
    return firebaseApp;
  }

  try {
    // Service Account Key wird aus Environment Variable geladen
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : require('./firebase-service-account.json'); // Fallback für lokale Entwicklung

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('🔥 Firebase Admin SDK initialized');
    return firebaseApp;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    return null;
  }
};

const sendFirebasePushNotification = async (deviceToken, notificationData) => {
  try {
    const app = initializeFirebase();
    if (!app) {
      throw new Error('Firebase not initialized');
    }

    console.log('🔔 Sending Firebase notification...');
    console.log('Device Token:', deviceToken.substring(0, 20) + '...');
    console.log('Notification Data:', notificationData);

    const message = {
      token: deviceToken,
      notification: {
        title: notificationData.title || 'Konfi Quest',
        body: notificationData.body || notificationData.alert,
      },
      data: notificationData.data || {},
      apns: {
        payload: {
          aps: {
            badge: notificationData.badge || 0,
            sound: notificationData.sound || 'default',
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Firebase notification sent successfully:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('❌ Firebase notification error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { 
  initializeFirebase, 
  sendFirebasePushNotification 
};