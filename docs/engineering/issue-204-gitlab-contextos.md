# Issue #204: GitLab y aislamiento de contextos Kubernetes

Esta rama parte de develop y se limita a dos puntos de la [issue #204](https://github.com/open-source-uct/kubero/issues/204), según el alcance solicitado por el usuario.

| Ficha del informe issues_seguridad_kubero_github.pdf | Páginas | Hallazgo | Corrección |
| --- | --- | --- | --- |
| ISSUE-10 | 21-22 | GitLab omite el verificador y descarta eventos | El handler delega en GitlabApi.getWebhook, exige un secreto válido y normaliza push y merge requests reales. Conserva ramas con barras. |
| ISSUE-11 | 22-23 | KubeConfig mutable compartido entre peticiones | Cada contexto dispone de clientes con una copia privada de la configuración. Cada operación recibe explícitamente el contexto autorizado. |

## Implementación y compatibilidad

GitLab verifica X-Gitlab-Token con el secreto existente KUBERO_WEBHOOK_SECRET antes de procesar el payload. Sin secreto o con token inválido no se disparan rebuilds ni acciones de review apps. Los eventos válidos conservan las ramas completas y normalizan apertura, reapertura, cierre y merge de merge requests. Los payloads malformados se descartan.

Se elimina el setter global del servicio Kubernetes. Los consumidores pasan el contexto autorizado por PipelinesService.getContext. Cada cliente, incluidos Log y Exec, conserva su configuración durante los awaits y la vida de sus streams. Al recargar la configuración se renuevan clientes y caché; las operaciones iniciadas conservan su copia anterior. El alias de contexto desconocido solo se admite con un único clúster; con varios, se rechaza. Las operaciones del plano de control mantienen el contexto seleccionado al inicializar el servicio.

El contexto se propaga también al crear/consultar Jobs, abrir terminales, consultar logs y leer métricas de pods. Estos son ajustes internos del aislamiento multiclúster. No se modifican la autenticación de /status o /metrics, las plantillas de build ni la salida de terminal. No se añaden KUBERO_METRICS_TOKEN, variables de recursos, requisitos de user namespaces ni comprobaciones de admisión de Pods.

No cambian los contratos HTTP, Prisma, dependencias npm, imágenes ni CRDs. Los repositorios externos del CLI y del operador no necesitan cambios por este alcance. No hay migraciones ni permisos Kubernetes adicionales.

## Verificación

Las pruebas de contexto utilizan configuraciones Kubernetes sintéticas y clientes simulados: comprueban llamadas intercaladas de distintos clústeres y credenciales, operaciones con varios awaits y clientes Log por contexto. Las pruebas de GitLab cubren delegación al verificador, rechazo de credenciales inválidas, ramas con barras y eventos de merge request. No se leen kubeconfigs reales ni se opera sobre clústeres o bases compartidos.

Verificación de esta rama: pnpm --dir server run build completó correctamente. pnpm --dir server exec jest --runInBand --coverage=false --silent pasó 987 pruebas en 73 suites. ESLint de solo lectura sobre los 18 archivos TypeScript afectados terminó con 0 errores y 1 advertencia preexistente de promesa no esperada en la terminal original. git diff --check no encontró errores. Se comprobó que no existen diferencias frente a develop en server/src/status, server/.env.template ni server/src/deployments/templates.

## Alcance pendiente y reversión

La autenticación de métricas, el hardening de templates y la fuga de salida de terminal quedan fuera de esta rama. Los dos cambios no cierran por sí solos la issue #204 completa.

Revertir el commit restaura el comportamiento previo de GitLab y del contexto Kubernetes, sin migraciones de datos ni ajustes de configuración.
