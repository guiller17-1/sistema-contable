# Sistema Contable UNI V3 — Cloudflare

Versión demostrativa preparada para funcionar como sitio estático en Cloudflare, sin depender de un servidor Express.

## Acceso de prueba
- Usuario: `admin`
- Contraseña: `uni2026`

## Incluye
- Pantalla de login.
- Panel general.
- Asientos contables con alta, edición y eliminación.
- Libro Diario y Libro Mayor.
- Inventarios y balances.
- Planillas.
- Compras y ventas.
- Balance General, Ganancias y Pérdidas, Flujo de Efectivo y Balance de Comprobación.
- Costos, hoja de costos y costo de ventas.
- Ajustes y cierre del ejercicio.
- Tablas maestras.
- Backup JSON.
- Data referencial cargada al primer ingreso.

## Cloudflare
Si utilizas Wrangler:

```bash
npm install
npm run deploy
```

Si utilizas Cloudflare Pages, publica la carpeta `public`.

## Importante
Esta versión guarda la data de prueba en `localStorage` del navegador para que todo el sistema funcione inmediatamente en Cloudflare Pages/Assets. No es todavía una base compartida entre dispositivos. Para una versión productiva se recomienda conectar Cloudflare D1 o PostgreSQL y mover la autenticación al servidor.
