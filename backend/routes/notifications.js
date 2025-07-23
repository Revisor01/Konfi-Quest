const express = require('express');

module.exports = (db, verifyTokenRBAC) => {
  const router = express.Router();

  router.post('/device-token', verifyTokenRBAC, (req, res) => {
    const { token, platform } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;

    if (!token || !platform) {
      return res.status(400).json({ error: 'Token and platform required' });
    }

    db.run(
      `INSERT OR REPLACE INTO push_tokens (user_id, user_type, token, platform, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [userId, userType, token, platform],
      (err) => {
        if (err) {
          console.error('Error saving push token:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true });
      }
    );
  });

  return router;
};
