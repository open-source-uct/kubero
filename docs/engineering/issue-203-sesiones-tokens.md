# Issue #203: sesiones y tokens

La [issue #203](https://github.com/open-source-uct/kubero/issues/203), «Sesiones y tokens no se invalidan de forma consistente», agrupa seis fichas del informe **Catálogo Consolidado y Deduplicado de GitHub Issues de Seguridad — Kubero** (`issues_seguridad_kubero_github.pdf`, auditoría del 18-10-2026, commit `ceb7028d02a9560460efd0f0e7b68e54ee6e6815`). Las fichas son referencias de diagnóstico; el alcance de esta entrega corresponde a los seis puntos de la issue.

| Ficha del PDF | Páginas | Problema | Solución |
| --- | --- | --- | --- |
| ISSUE-06 / KUB-006 / SEC-G06 | 16–18 | WebSocket conserva permisos y salas antiguos | Revalidación de JWT e identidad en cada mensaje y antes de cada entrega. Cambios de rol, equipos o permisos desconectan el socket y eliminan sus suscripciones. Se comprueba también el acceso actual al pipeline antes de entregar logs o salida de terminal. |
| ISSUE-07 / SEC-G07 | 18–19 | Un token personal puede emitir otro con más capacidades | Se adopta la opción A del informe: solo sesiones interactivas `local` y `oauth2` pueden crear tokens personales. El servicio recibe la identidad verificada; no toma la estrategia del cuerpo HTTP. |
| ISSUE-17 / KUB-013 | 28–29 | Logout y contraseña no revocan JWT normales | `User.sessionVersion` persistida y comparada en cada autenticación HTTP/WebSocket. Logout incrementa la versión de todas las sesiones interactivas del titular. Los cambios de contraseña incrementan la versión y desactivan sus tokens personales en la misma escritura Prisma. Incluye el reset administrativo del CLI interno. |
| ISSUE-18 / message.txt #7 | 29–30 | Credenciales y sockets permanecen en memoria | Logout llama al backend y limpia Pinia, Authorization, almacenamiento heredado y el socket compartido. El cambio de contraseña propio vuelve al login y ejecuta la misma limpieza. |
| ISSUE-20 / Chat #6 / A02 | 31–32 | Cookie accesible desde JavaScript y sin atributos explícitos | Login local y callbacks OAuth/GitHub emiten la cookie desde el servidor con HttpOnly, SameSite=Lax, Path=/ y Secure en producción o conexión HTTPS. Vue carga la identidad desde `/api/auth/session`; HTTP y Socket.IO aceptan la cookie sin exponerla al código del navegador. |
| ISSUE-29 / A04 | 39 | Hashes HMAC-SHA256 conservados indefinidamente | Después de validar una contraseña heredada se guarda bcrypt con coste 10. La escritura condicional por hash anterior evita sobrescribir un reset concurrente. Una contraseña incorrecta no migra el hash. |

## Contratos y despliegue

- La migración SQLite `20261021120000_add_session_version` añade una columna entera con valor predeterminado 0. Regenerar Prisma al construir y aplicar las migraciones habituales antes de servir el código nuevo. El arranque existente ya ejecuta `prisma migrate deploy`. No se han aplicado migraciones a bases compartidas.
- Los JWT interactivos anteriores, que no incluyen `sessionVersion`, reciben 401 y requieren login nuevo. Los tokens personales anteriores sin `jti` también deben emitirse de nuevo: no se mantiene una excepción que impida revocarlos.
- Logout revoca todas las sesiones interactivas del mismo usuario; no revoca sus tokens personales. El cambio o restablecimiento de contraseña revoca ambos tipos de credenciales.
- `POST /api/auth/logout` permite el cierre desde el navegador. La ruta GET anterior sigue disponible con Bearer. Ambas requieren autenticación; un token personal no puede cerrar las sesiones interactivas del titular.
- `/api/auth/session` conserva los campos existentes y añade `user` con la identidad y los permisos efectivos, sin JWT, hash ni secreto 2FA. La respuesta y el login usan `Cache-Control: no-store`. El login conserva `access_token` en su respuesta para consumidores API.
- La autenticación por cookie exige el mismo origen para peticiones mutables y rechaza solicitudes de otro sitio. El handshake WebSocket comprueba el origen cuando usa cookie. Bearer y `handshake.auth.token` siguen disponibles para consumidores explícitos de tokens.
- UI y API deben servirse desde el mismo origen. Producción requiere HTTPS para enviar cookies Secure. No se añaden dependencias ni variables de configuración.
- Los consumidores API/CLI deben volver a iniciar sesión si usan JWT antiguos. Los flujos que renovaban tokens desde otro token personal deben pasar por una sesión interactiva. Esto requiere coordinación con el CLI Go externo si usa dicho flujo; ese repositorio no se ha editado ni probado aquí. Operador, CRDs y recursos Kubernetes no cambian.
- Los cambios de autorización desconectan un WebSocket en su siguiente mensaje o intento de entrega; una conexión ociosa no recibe datos mientras no haya eventos. La UI necesita recargar o volver a iniciar sesión para abrir una nueva conexión después de esa desconexión. Los mensajes de salida se serializan por socket para mantener su orden.

## Verificación

Las pruebas nuevas de servidor emplean una base SQLite temporal creada desde todas las migraciones, bcrypt y JWT reales, Passport y solicitudes HTTP locales. Verifican login por cookie y Bearer, atributos de cookie, revocación de varios JWT al cerrar sesión, cambio y reset de contraseña, revocación de tokens personales, bloqueo de reemisión tras promoción, migración de hash heredado y protección de origen.

Las pruebas con Socket.IO real comprueban que un suscriptor pasivo deja de recibir logs y salida de terminal al perder equipos, permisos o rol; también rechazan entrada de terminal tras revocación y eventos después de caducidad. Las pruebas del cliente comprueban hidratación desde la identidad del servidor, limpieza de credenciales y liberación de la conexión compartida.

La suite completa de servidor pasa con 957 pruebas en 70 suites (pnpm --dir server exec jest --runInBand --coverage=false --silent), las dos pruebas del cliente pasan (pnpm --dir client run test:unit) y ambos builds completan correctamente. El lint acotado del servidor tiene 0 errores; el global sigue bloqueado por formato previo. En los archivos modificados del cliente se mantienen únicamente los dos errores de efectos secundarios de loginprompt.vue, comprobados también contra origin/develop. Los comandos completos quedan registrados en la descripción del PR. Playwright contra una instalación completa, OAuth con un proveedor real y una prueba de carga con múltiples suscriptores quedan pendientes; las comprobaciones locales no usan clústeres compartidos.

## Riesgos y reversión

Cada entrega WebSocket revalida al destinatario en la base de datos. Los logs y terminales consultan además la autorización actual del pipeline. Los streams con muchos suscriptores pueden añadir latencia; validar capacidad antes de ampliar la carga de producción.

Desplegar backend y cliente juntos, evitando versiones antiguas que sigan aceptando JWT sin comprobación de revocación. Para revertir, restaurar el código anterior conservando la columna aditiva y su historial de migración. El código anterior no respeta la versión de sesión: rotar la clave de firma durante esa reversión para no reactivar JWT revocados y volver a emitir los tokens personales afectados. No borrar ni reconstruir tablas para deshacer esta columna.
