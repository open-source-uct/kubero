# Actividad y auditoría

El audit log está habilitado por defecto. El rol `admin` ya incluye `audit:read`
en la configuración inicial de roles. Una instalación con `KUBERO_AUDIT=false`
conserva esa desactivación explícita: para activarlo, establece
`KUBERO_AUDIT=true` en el entorno del servidor y reinícialo. No se recuperan
eventos anteriores que no se hayan registrado. No se modifican roles existentes.

Actividad muestra 20 registros por página y permite filtrar por nombre exacto
de pipeline, acción, parte del nombre de usuario y fechas. El intervalo de fechas
usa la zona horaria del navegador e incluye todo el día final seleccionado.
Los filtros se aplican con «Aplicar filtros»; cambiar de página conserva los
criterios aplicados. «Actualizar» vuelve a consultar la página actual.

Actividad y Pipelines comparten `client/src/styles/resource-list.css` para
mantener idénticos el panel, encabezados, filas, estados vacíos y paginación.
Los campos pipeline y usuario sugieren nombres mientras se escribe, con una
espera de 250 ms y cancelación de consultas anteriores. Se permite escribir
manualmente si no hay sugerencias o si la consulta falla.

`GET /api/audit/suggestions` acepta `kind` (`pipeline` o `username`), `q` y
`pipeline` (opcional, para acotar usuarios). Devuelve hasta 20 nombres distintos
que ya aparecen en registros de auditoría accesibles. Requiere `audit:read`
o `audit:write` y aplica el mismo alcance por equipos que la lista de actividad;
no concede acceso al directorio de cuentas ni expone correos o perfiles. Un
pipeline eliminado puede aparecer para el equipo admin si conserva actividad.

`GET /api/audit` conserva `audit`, `count` y `limit`, y añade `page` y `enabled`.
Acepta `limit` (1–100), `page` (desde 1), `pipeline`, `action`, `username`, `from`
y `to` (ISO 8601; límite final exclusivo). El servidor filtra y cuenta antes de
paginar y ordena por fecha e ID descendentes. Nuevos eventos pueden desplazar
filas entre páginas; «Actualizar» permite refrescar la consulta.

Los permisos existentes siguen siendo obligatorios. El equipo `admin` mantiene
su acceso global; los demás usuarios solo consultan pipelines autorizados,
incluso cuando solicitan otro pipeline mediante filtros. No se cambian el esquema
Prisma, recursos Kubernetes ni contratos con CLI u operador. No se necesitan
migraciones ni dependencias adicionales. Para revertir, restaurar los componentes,
servicio y controlador y desactivar `KUBERO_AUDIT` si corresponde.
