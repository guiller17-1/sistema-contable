# Sistema Contable UNI V4

Versión estática autocontenida para Cloudflare. El CSS y JavaScript están dentro de `public/index.html` para evitar mezclar archivos de versiones anteriores.

## Acceso
- Usuario: `admin`
- Contraseña: `uni2026`

## Importante
- La pantalla de login aparece siempre al cargar o recargar la web.
- La data referencial se carga automáticamente con una clave nueva V4.
- Los datos se guardan en `localStorage` del navegador.
- Cada opción del menú muestra un módulo diferente.
- Para desplegar con Wrangler: `npm install` y luego `npm run deploy`.
- Para Cloudflare Pages, publica la carpeta `public`.

Si reemplazas una versión anterior, elimina del repositorio los archivos viejos del frontend y sube el contenido de esta V4 completo.
