const express = require('express');
const router = express.Router();
const axios = require('axios');

// GET /api/tageslosung - Proxy für Tageslosung API
router.get('/', async (req, res) => {
  try {
    const translation = req.query.translation || 'BIGS';
    
    // Direkter Zugriff auf die Losung-API im gleichen Docker-Netzwerk
    const apiUrl = `http://127.0.0.1:8374/?api_key=ksadh8324oijcff45rfdsvcvhoids44&translation=${translation}`;
    
    console.log('Proxying Tageslosung request to:', apiUrl);
    
    const response = await axios.get(apiUrl, {
      timeout: 5000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    // Weiterleiten der Antwort
    res.json(response.data);
    
  } catch (error) {
    console.error('Tageslosung proxy error:', error.message);
    
    // Fallback auf öffentliche URL
    try {
      const translation = req.query.translation || 'BIGS';
      const publicUrl = `https://losung.konfi-quest.de/?api_key=ksadh8324oijcff45rfdsvcvhoids44&translation=${translation}`;
      
      console.log('Trying public URL fallback:', publicUrl);
      
      const response = await axios.get(publicUrl, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      res.json(response.data);
      
    } catch (fallbackError) {
      console.error('Public URL fallback also failed:', fallbackError.message);
      res.status(500).json({ 
        success: false, 
        error: 'Tageslosung API nicht erreichbar',
        details: fallbackError.message
      });
    }
  }
});

module.exports = router;