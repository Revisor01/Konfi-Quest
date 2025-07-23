const apn = require('apn');

const options = {
  token: {
    key: './push/AuthKey_A29U7SN796.p8', // dein .p8 Key Pfad
    keyId: 'A29U7SN796',
    teamId: 'J459G9CJT5',
  },
  production: false, // TestFlight = true
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
  note.topic = 'de.godsapp.konfipoints'; // dein Bundle ID

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
