const express = require('express');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get('/api/asientos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM asientos ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/asientos', async (req, res) => {
  const { glosa, tipo_asiento, debe, haber, monto, actividad } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO asientos (glosa, tipo_asiento, debe, haber, monto, actividad) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [glosa, tipo_asiento, debe || 0, haber || 0, monto || 0, actividad]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));
