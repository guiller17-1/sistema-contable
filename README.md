# Sistema Contable UNI — versión 2.0

Versión ampliada a partir del proyecto inicial. Conserva el módulo de asientos y agrega una estructura navegable para Operaciones, Libros, EEFF, Costos, Cierre, Tablas y Utilitarios, además de autenticación.

## Módulos incluidos
- Login con sesión segura mediante cookie HTTP-only + JWT.
- Asientos contables: alta, modificación y eliminación.
- Libros: Diario, Mayor, Inventarios, Planillas, Compras y Ventas.
- EEFF: Balance General, Ganancias y Pérdidas, Flujo de Efectivo y Balance de Comprobación.
- Costos: Libro mayor de fábrica, Hoja de costos, Costos fijos/variables y Costo de ventas.
- Cierre: Ajustes y validación de cierre del ejercicio.
- Tablas: Cuentas contables, Productos terminados, Mercaderías, Activo fijo, Centros de costo, Inductores y Repuestos.
- Utilitarios: Backup JSON, Estadísticas y Manual de usuario.

## Instalación
1. Copia `.env.example` como `.env`.
2. Configura `DATABASE_URL` con tu PostgreSQL.
3. Ejecuta `npm install`.
4. Ejecuta `npm start`.

El sistema crea automáticamente las tablas faltantes y agrega columnas nuevas a `asientos` sin borrar la información existente.

## Credenciales iniciales
Se crean solo cuando la tabla de usuarios está vacía:
- Usuario: valor de `ADMIN_USER` (por defecto `admin`).
- Contraseña: valor de `ADMIN_PASSWORD` (por defecto `uni2026`).

**En un despliegue real cambia `JWT_SECRET` y `ADMIN_PASSWORD`.**

## Nota académica
Los EEFF incluidos son una base funcional que usa la codificación de cuentas registrada. Para un sistema contable productivo en Perú deben completarse reglas PCGE, periodos, asientos dobles validados por operación, libros electrónicos, impuestos, auditoría, roles/permisos y normativa SUNAT aplicable.
