const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET all dogs with their owner's
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT d.dog_id, d.name, d.size, d.owner_id
      FROM Dogs d
      ORDER BY d.dog_id
    `);
    res.json(rows);
  } catch (error) {
    console.error('Failed to fetch dogs:', error);
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

module.exports = router; 