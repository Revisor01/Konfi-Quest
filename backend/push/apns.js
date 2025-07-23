const apn = require('apn');
const path = require('path');

const keyPath = path.join(__dirname, 'AuthKey_47RSW287BV.p8');
console.log('🔑 APNS Key Path:', keyPath);

// Check if key file exists
const fs = require('fs');
if (!fs.existsSync(keyPath)) {
  console.error('❌ APNS Key file not found:', keyPath);
}

const options = {
  token: {
    key: keyPath,
    keyId: '47RSW287BV',
    teamId: 'J459G9CJT5',
  },
  production: false, // false = Sandbox (für Development/TestFlight), true = Production
};

const apnProvider = new apn.Provider(options);

const sendApnsNotification = (deviceToken, notificationData) => {
  console.log('🔔 Sending APNs notification...');
  console.log('Device Token:', deviceToken);
  console.log('Notification Data:', notificationData);
  console.log('APNS Options:', options);

  const note = new apn.Notification();

  note.alert = notificationData.alert;
  note.badge = notificationData.badge || 0;
  note.sound = notificationData.sound || 'default';
  note.topic = 'de.godsapp.konfiquest'; // Bundle ID muss mit capacitor.config.ts übereinstimmen

  apnProvider.send(note, deviceToken).then(response => {
    console.log('✅ APNs Response:', response.sent.length, 'sent,', response.failed.length, 'failed');
    if (response.failed.length) {
      console.error('❌ APNs Errors:', response.failed);
      response.failed.forEach(failure => {
        console.error('Failed device:', failure.device);
        console.error('Error:', failure.error);
        console.error('Status:', failure.status);
      });
    }
  }).catch(error => {
    console.error('❌ APNs Send Error:', error);
  });
};

module.exports = { sendApnsNotification };
