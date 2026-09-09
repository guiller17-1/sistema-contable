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

// 1. OBTENER
app.get('/api/asientos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM asientos ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GRABAR
app.post('/api/asientos', async (req, res) => {
  const { cuenta, glosa, tipo_asiento, debe, haber, monto, actividad } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO asientos (cuenta, glosa, tipo_asiento, debe, haber, monto, actividad) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [cuenta, glosa, tipo_asiento, debe || 0, haber || 0, monto || 0, actividad]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. MODIFICAR
app.put('/api/asientos/:id', async (req, res) => {
  const { id } = req.params;
  const { cuenta, glosa, tipo_asiento, debe, haber, monto, actividad } = req.body;
  try {
    const result = await pool.query(
      `UPDATE asientos 
       SET cuenta = $1, glosa = $2, tipo_asiento = $3, debe = $4, haber = $5, monto = $6, actividad = $7 
       WHERE id = $8 RETURNING *`,
      [cuenta, glosa, tipo_asiento, debe || 0, haber || 0, monto || 0, actividad, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. BORRAR
app.delete('/api/asientos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM asientos WHERE id = $1', [id]);
    res.json({ message: 'Asiento eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));
