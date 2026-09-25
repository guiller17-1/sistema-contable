const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'cambiar-esta-clave-en-produccion';
const COOKIE_NAME = 'uni_contable_token';

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      username VARCHAR(80) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nombre VARCHAR(120) NOT NULL,
      rol VARCHAR(30) NOT NULL DEFAULT 'ADMIN',
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS asientos (
      id SERIAL PRIMARY KEY,
      fecha DATE NOT NULL DEFAULT CURRENT_DATE,
      numero_asiento VARCHAR(40),
      cuenta VARCHAR(160) NOT NULL,
      glosa TEXT NOT NULL,
      tipo_asiento VARCHAR(40) NOT NULL,
      debe NUMERIC(14,2) NOT NULL DEFAULT 0,
      haber NUMERIC(14,2) NOT NULL DEFAULT 0,
      monto NUMERIC(14,2) NOT NULL DEFAULT 0,
      actividad VARCHAR(40),
      centro_costo VARCHAR(120),
      documento VARCHAR(100),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cuentas (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(20) UNIQUE NOT NULL,
      nombre VARCHAR(160) NOT NULL,
      tipo VARCHAR(40) NOT NULL DEFAULT 'Activo',
      naturaleza VARCHAR(10) NOT NULL DEFAULT 'DEBE',
      activa BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS catalogos (
      id SERIAL PRIMARY KEY,
      tipo VARCHAR(50) NOT NULL,
      codigo VARCHAR(40),
      nombre VARCHAR(180) NOT NULL,
      descripcion TEXT,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE(tipo, codigo)
    );

    CREATE TABLE IF NOT EXISTS compras (
      id SERIAL PRIMARY KEY,
      fecha DATE NOT NULL DEFAULT CURRENT_DATE,
      documento VARCHAR(80),
      proveedor VARCHAR(180) NOT NULL,
      ruc VARCHAR(20),
      descripcion TEXT,
      subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
      igv NUMERIC(14,2) NOT NULL DEFAULT 0,
      total NUMERIC(14,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ventas (
      id SERIAL PRIMARY KEY,
      fecha DATE NOT NULL DEFAULT CURRENT_DATE,
      documento VARCHAR(80),
      cliente VARCHAR(180) NOT NULL,
      ruc_dni VARCHAR(20),
      descripcion TEXT,
      subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
      igv NUMERIC(14,2) NOT NULL DEFAULT 0,
      total NUMERIC(14,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS planillas (
      id SERIAL PRIMARY KEY,
      periodo VARCHAR(7) NOT NULL,
      trabajador VARCHAR(180) NOT NULL,
      sueldo_bruto NUMERIC(14,2) NOT NULL DEFAULT 0,
      sistema_pension VARCHAR(20) NOT NULL DEFAULT 'AFP',
      descuento_pension NUMERIC(14,2) NOT NULL DEFAULT 0,
      retencion_sunat NUMERIC(14,2) NOT NULL DEFAULT 0,
      otros_descuentos NUMERIC(14,2) NOT NULL DEFAULT 0,
      neto NUMERIC(14,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS costos (
      id SERIAL PRIMARY KEY,
      fecha DATE NOT NULL DEFAULT CURRENT_DATE,
      concepto VARCHAR(180) NOT NULL,
      tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('FIJO','VARIABLE')),
      categoria VARCHAR(80),
      centro_costo VARCHAR(120),
      monto NUMERIC(14,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Compatibilidad con la versión inicial del usuario: agrega columnas sin borrar datos.
  const alterStatements = [
    `ALTER TABLE asientos ADD COLUMN IF NOT EXISTS fecha DATE DEFAULT CURRENT_DATE`,
    `ALTER TABLE asientos ADD COLUMN IF NOT EXISTS numero_asiento VARCHAR(40)`,
    `ALTER TABLE asientos ADD COLUMN IF NOT EXISTS centro_costo VARCHAR(120)`,
    `ALTER TABLE asientos ADD COLUMN IF NOT EXISTS documento VARCHAR(100)`,
    `ALTER TABLE asientos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`
  ];
  for (const sql of alterStatements) await pool.query(sql);

  const seedCuentas = [
    ['10', 'Caja y Bancos', 'Activo', 'DEBE'],
    ['12', 'Cuentas por Cobrar', 'Activo', 'DEBE'],
    ['20', 'Mercaderías', 'Activo', 'DEBE'],
    ['33', 'Propiedad, Planta y Equipo', 'Activo', 'DEBE'],
    ['40', 'Tributos / IGV por pagar', 'Pasivo', 'HABER'],
    ['41', 'Remuneraciones por Pagar', 'Pasivo', 'HABER'],
    ['42', 'Cuentas por Pagar Comerciales', 'Pasivo', 'HABER'],
    ['50', 'Capital', 'Patrimonio', 'HABER'],
    ['60', 'Compras / Gastos', 'Gasto', 'DEBE'],
    ['69', 'Costo de Ventas', 'Gasto', 'DEBE'],
    ['70', 'Ventas', 'Ingreso', 'HABER']
  ];
  for (const c of seedCuentas) {
    await pool.query(
      `INSERT INTO cuentas (codigo, nombre, tipo, naturaleza)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (codigo) DO NOTHING`, c
    );
  }

  const count = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios');
  if (count.rows[0].n === 0) {
    const username = process.env.ADMIN_USER || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'uni2026';
    const nombre = process.env.ADMIN_NAME || 'Administrador UNI';
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO usuarios (username, password_hash, nombre, rol) VALUES ($1,$2,$3,$4)',
      [username, hash, nombre, 'ADMIN']
    );
    console.log(`Usuario inicial creado: ${username}. Cambia ADMIN_PASSWORD en producción.`);
  }
}

function createToken(user) {
  return jwt.sign({ id: user.id, username: user.username, nombre: user.nombre, rol: user.rol }, JWT_SECRET, { expiresIn: '10h' });
}

function requireAuth(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Sesión vencida' });
  }
}

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  const result = await pool.query('SELECT * FROM usuarios WHERE username=$1 AND activo=TRUE LIMIT 1', [username]);
  if (!result.rowCount) return res.status(401).json({ error: 'Credenciales incorrectas' });
  const user = result.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });
  const token = createToken(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 60 * 1000
  });
  res.json({ id: user.id, username: user.username, nombre: user.nombre, rol: user.rol });
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json(req.user));
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  return requireAuth(req, res, next);
});

app.get('/api/cuentas', async (_req, res) => {
  const r = await pool.query('SELECT * FROM cuentas WHERE activa=TRUE ORDER BY codigo');
  res.json(r.rows);
});

app.post('/api/cuentas', async (req, res) => {
  const { codigo, nombre, tipo, naturaleza } = req.body;
  try {
    const r = await pool.query(
      `INSERT INTO cuentas(codigo,nombre,tipo,naturaleza) VALUES($1,$2,$3,$4) RETURNING *`,
      [codigo, nombre, tipo || 'Activo', naturaleza || 'DEBE']
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ASIENTOS
app.get('/api/asientos', async (_req, res) => {
  try {
    const r = await pool.query('SELECT * FROM asientos ORDER BY fecha DESC, id DESC');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/asientos', async (req, res) => {
  const { fecha, numero_asiento, cuenta, glosa, tipo_asiento, debe, haber, monto, actividad, centro_costo, documento } = req.body;
  try {
    const r = await pool.query(
      `INSERT INTO asientos(fecha,numero_asiento,cuenta,glosa,tipo_asiento,debe,haber,monto,actividad,centro_costo,documento)
       VALUES(COALESCE($1::date,CURRENT_DATE),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [fecha || null, numero_asiento || null, cuenta, glosa, tipo_asiento, debe || 0, haber || 0, monto || 0, actividad, centro_costo || null, documento || null]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/asientos/:id', async (req, res) => {
  const { fecha, numero_asiento, cuenta, glosa, tipo_asiento, debe, haber, monto, actividad, centro_costo, documento } = req.body;
  try {
    const r = await pool.query(
      `UPDATE asientos SET fecha=COALESCE($1::date,fecha), numero_asiento=$2, cuenta=$3, glosa=$4, tipo_asiento=$5,
       debe=$6, haber=$7, monto=$8, actividad=$9, centro_costo=$10, documento=$11 WHERE id=$12 RETURNING *`,
      [fecha || null, numero_asiento || null, cuenta, glosa, tipo_asiento, debe || 0, haber || 0, monto || 0, actividad, centro_costo || null, documento || null, req.params.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/asientos/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM asientos WHERE id=$1', [req.params.id]);
    res.json({ message: 'Asiento eliminado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function crudRoutes(name, fields) {
  app.get(`/api/${name}`, async (_req, res) => {
    const r = await pool.query(`SELECT * FROM ${name} ORDER BY id DESC`);
    res.json(r.rows);
  });
  app.post(`/api/${name}`, async (req, res) => {
    const vals = fields.map(f => req.body[f] ?? null);
    const cols = fields.join(',');
    const params = fields.map((_, i) => `$${i + 1}`).join(',');
    try {
      const r = await pool.query(`INSERT INTO ${name}(${cols}) VALUES(${params}) RETURNING *`, vals);
      res.json(r.rows[0]);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.delete(`/api/${name}/:id`, async (req, res) => {
    await pool.query(`DELETE FROM ${name} WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  });
}

crudRoutes('compras', ['fecha','documento','proveedor','ruc','descripcion','subtotal','igv','total']);
crudRoutes('ventas', ['fecha','documento','cliente','ruc_dni','descripcion','subtotal','igv','total']);
crudRoutes('planillas', ['periodo','trabajador','sueldo_bruto','sistema_pension','descuento_pension','retencion_sunat','otros_descuentos','neto']);
crudRoutes('costos', ['fecha','concepto','tipo','categoria','centro_costo','monto']);

app.get('/api/catalogos/:tipo', async (req, res) => {
  const r = await pool.query('SELECT * FROM catalogos WHERE tipo=$1 AND activo=TRUE ORDER BY nombre', [req.params.tipo]);
  res.json(r.rows);
});
app.post('/api/catalogos/:tipo', async (req, res) => {
  const { codigo, nombre, descripcion } = req.body;
  try {
    const r = await pool.query(
      'INSERT INTO catalogos(tipo,codigo,nombre,descripcion) VALUES($1,$2,$3,$4) RETURNING *',
      [req.params.tipo, codigo || null, nombre, descripcion || null]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/catalogos/:tipo/:id', async (req, res) => {
  await pool.query('UPDATE catalogos SET activo=FALSE WHERE id=$1 AND tipo=$2', [req.params.id, req.params.tipo]);
  res.json({ ok: true });
});

app.get('/api/dashboard', async (_req, res) => {
  const [a, c, v, co] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int total, COALESCE(SUM(debe),0) debe, COALESCE(SUM(haber),0) haber FROM asientos`),
    pool.query(`SELECT COALESCE(SUM(total),0) total FROM compras WHERE date_trunc('month',fecha)=date_trunc('month',CURRENT_DATE)`),
    pool.query(`SELECT COALESCE(SUM(total),0) total FROM ventas WHERE date_trunc('month',fecha)=date_trunc('month',CURRENT_DATE)`),
    pool.query(`SELECT COALESCE(SUM(monto),0) total FROM costos WHERE date_trunc('month',fecha)=date_trunc('month',CURRENT_DATE)`)
  ]);
  res.json({
    asientos: a.rows[0].total,
    debe: a.rows[0].debe,
    haber: a.rows[0].haber,
    compras_mes: c.rows[0].total,
    ventas_mes: v.rows[0].total,
    costos_mes: co.rows[0].total
  });
});

app.get('/api/reportes/diario', async (_req, res) => {
  const r = await pool.query(`SELECT fecha,id,numero_asiento,cuenta,glosa,documento,debe,haber FROM asientos ORDER BY fecha,id`);
  res.json(r.rows);
});

app.get('/api/reportes/mayor', async (_req, res) => {
  const r = await pool.query(`
    SELECT cuenta, COUNT(*)::int movimientos, COALESCE(SUM(debe),0) debe, COALESCE(SUM(haber),0) haber,
           COALESCE(SUM(debe-haber),0) saldo
    FROM asientos GROUP BY cuenta ORDER BY cuenta`);
  res.json(r.rows);
});

app.get('/api/reportes/balance-comprobacion', async (_req, res) => {
  const r = await pool.query(`
    SELECT cuenta, COALESCE(SUM(debe),0) debe, COALESCE(SUM(haber),0) haber,
           GREATEST(COALESCE(SUM(debe-haber),0),0) saldo_deudor,
           GREATEST(COALESCE(SUM(haber-debe),0),0) saldo_acreedor
    FROM asientos GROUP BY cuenta ORDER BY cuenta`);
  res.json(r.rows);
});

app.get('/api/reportes/flujo-efectivo', async (_req, res) => {
  const r = await pool.query(`
    SELECT COALESCE(actividad,'Sin clasificar') actividad,
           COALESCE(SUM(debe),0) entradas, COALESCE(SUM(haber),0) salidas,
           COALESCE(SUM(debe-haber),0) flujo_neto
    FROM asientos GROUP BY actividad ORDER BY actividad`);
  res.json(r.rows);
});

app.get('/api/reportes/resultados', async (_req, res) => {
  const r = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN split_part(cuenta,' ',1) LIKE '7%' THEN haber-debe ELSE 0 END),0) ingresos,
      COALESCE(SUM(CASE WHEN split_part(cuenta,' ',1) LIKE '6%' THEN debe-haber ELSE 0 END),0) gastos
    FROM asientos`);
  const row = r.rows[0];
  res.json([{ concepto:'Ingresos', monto: row.ingresos }, { concepto:'Gastos / Costos', monto: row.gastos }, { concepto:'Resultado', monto: Number(row.ingresos) - Number(row.gastos) }]);
});

app.get('/api/reportes/balance-general', async (_req, res) => {
  const r = await pool.query(`
    SELECT c.tipo,
           COALESCE(SUM(CASE WHEN c.naturaleza='DEBE' THEN a.debe-a.haber ELSE a.haber-a.debe END),0) saldo
    FROM cuentas c
    LEFT JOIN asientos a ON split_part(a.cuenta,' ',1)=c.codigo
    GROUP BY c.tipo ORDER BY c.tipo`);
  res.json(r.rows);
});

app.get('/api/reportes/costo-ventas', async (_req, res) => {
  const r = await pool.query(`
    SELECT tipo, COALESCE(SUM(monto),0) monto FROM costos GROUP BY tipo ORDER BY tipo`);
  res.json(r.rows);
});

app.get('/api/backup', async (_req, res) => {
  const tables = ['asientos','cuentas','catalogos','compras','ventas','planillas','costos'];
  const data = { generado_en: new Date().toISOString(), version: '2.0.0', tablas: {} };
  for (const t of tables) data.tablas[t] = (await pool.query(`SELECT * FROM ${t}`)).rows;
  res.setHeader('Content-Disposition', `attachment; filename="backup-contable-${new Date().toISOString().slice(0,10)}.json"`);
  res.json(data);
});

app.get('/api/cierre/resumen', async (_req, res) => {
  const r = await pool.query(`SELECT COALESCE(SUM(debe),0) debe, COALESCE(SUM(haber),0) haber, COUNT(*)::int asientos FROM asientos`);
  const row = r.rows[0];
  res.json({ ...row, diferencia: Number(row.debe) - Number(row.haber), cuadrado: Math.abs(Number(row.debe) - Number(row.haber)) < 0.01 });
});

app.get('*', (req, res) => {
  if (req.path === '/login') return res.sendFile(path.join(__dirname, 'public', 'login.html'));
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
initDb()
  .then(() => app.listen(PORT, () => console.log(`Sistema Contable UNI iniciado en puerto ${PORT}`)))
  .catch(err => {
    console.error('No se pudo inicializar la base de datos:', err);
    process.exit(1);
  });
