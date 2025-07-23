const apn = require('apn');

const options = {
  token: {
    key: './push/AuthKey_A29U7SN796.p8', // dein .p8 Key Pfad
    keyId: 'A29U7SN796',
    teamId: 'J459G9CJT5',
  },
  production: true, // TestFlight = true
};

const apnProvider = new apn.Provider(options);

const sendApnsNotification = (deviceToken, notificationData) => {
  const note = new apn.Notification();

  note.alert = notificationData.alert;
  note.badge = notificationData.badge || 0;
  note.sound = notificationData.sound || 'default';
  note.topic = 'de.godsapp.konfipoints'; // dein Bundle ID

  apnProvider.send(note, deviceToken).then(response => {
    console.log('APNs Response:', response.sent.length, 'sent,', response.failed.length, 'failed');
    if (response.failed.length) {
      console.error('APNs Errors:', response.failed);
    }
  });
};

module.exports = { sendApnsNotification };
