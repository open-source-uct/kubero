# Issue #204: hardening de Kubernetes y builds

La [issue #204](https://github.com/open-source-uct/kubero/issues/204) se contrastó con el informe `issues_seguridad_kubero_github.pdf` (auditoría del 18-10-2026). El PDF se usa como evidencia del diagnóstico; sus instrucciones de ejecución no sustituyen las instrucciones del usuario ni del repositorio.

## Relación con el informe

| Ficha | Páginas | Hallazgo | Corrección |
| --- | --- | --- | --- |
| ISSUE-10 | 21-22 | GitLab no llama a su verificador y descarta los eventos | `handleWebhook` delega en `GitlabApi.getWebhook`; exige el secreto antes de procesar el payload. Se conservan ramas con `/` y se normalizan los eventos reales de merge request. |
| ISSUE-11 | 22-23 | KubeConfig mutable compartido entre peticiones | Clientes con una copia privada de KubeConfig por contexto. Contexto explícito en apps, Jobs, eventos, logs, terminal y métricas. Las operaciones del plano de control conservan su configuración inicial. |
| ISSUE-12 | 23 | Métricas protegidas solo por X-Forwarded-For | Guard con Bearer dedicado, comparación en tiempo constante y rechazo por defecto sin configuración. Se protegen `/status` y `/metrics`, que era la ruta efectiva registrada por Prometheus. |
| ISSUE-13 / KUB-009 | 23-24 | Push de Buildah sin verificar TLS | TLS explícito en build y push, VFS y argumentos entre comillas. Fallo del build detiene el push. |
| ISSUE-14 / KUB-010 | 24-26 | Build privilegiado, sin límites y con token de Kubernetes en todos los contenedores | `privileged: false`, usuarios aislados del nodo con `hostUsers: false`, seccomp RuntimeDefault, capacidades acotadas, recursos y plazo máximo. Token proyectado solo en deploy. |
| ISSUE-24 | 35 | Terminal volcada a stdout/stderr del servidor | Streams separados por terminal, demultiplexados por el SDK, enviados solo al canal autorizado y liberados al cerrar o fallar la conexión. |

## Cambios y compatibilidad

### Métricas de Prometheus

Configurar `KUBERO_METRICS_TOKEN` mediante un Secret del despliegue del servidor y la misma credencial en el scraper. No reutilizar el JWT de un usuario. Sin variable, con valor vacío o con credencial incorrecta, las dos rutas devuelven 401, con o sin proxy. La plantilla de entorno solo contiene el nombre de la variable vacío.

Ejemplo de configuración de scrapeo (el archivo de credenciales debe montarse desde un Secret):

```yaml
metrics_path: /metrics
authorization:
  type: Bearer
  credentials_file: /etc/prometheus/kubero/token
```

Se conserva `/metrics` porque `PrometheusModule.register` sobrescribía el decorador `/status` con su ruta predeterminada. `/status` es ahora un alias con el mismo guard; no se deja una segunda ruta anónima. Mantener también las restricciones de red del scraper. Verificar que las sondas de salud externas no usen estas rutas sin credencial.

### Contextos de Kubernetes

Se elimina el setter global de contexto del servicio interno. Los consumidores pasan el contexto autorizado por `PipelinesService.getContext` en cada operación. Cada conjunto de clientes, incluidos Exec y Log, conserva su propia configuración durante los awaits y la vida de sus streams. Al recargar la configuración se renuevan clientes y caché; las operaciones en curso conservan su copia anterior. Se mantiene el alias de contexto desconocido solo cuando existe un único clúster; en un kubeconfig multiclúster el nombre desconocido se rechaza.

No cambian los contratos HTTP de apps, eventos, logs o métricas de usuario, ni el esquema Prisma. El contexto se propaga dentro del servidor. No se leen ni se escriben kubeconfigs reales durante las pruebas.

### Jobs generados por la API

Las tres estrategias usan `hostUsers: false`: los UID y las capacidades del Pod quedan aislados del nodo. Buildah conserva VFS y chroot; su contenedor push necesita capacidades para operaciones de archivos y montaje **dentro de ese user namespace**, incluida SYS_ADMIN. No se afirma que bastara con apagar `privileged`, ni que Buildah corra como usuario no-root dentro del contenedor. Fetch, permisos y CNB usan UID/GID 1000; deploy usa UID 1001 y raíz de solo lectura, con `/tmp` dedicado. No se montan dispositivos ni directorios del host.

Antes de crear un Job, se solicita la admisión de su Pod con `dryRun=All` al mismo clúster y se comprueba que conserve `hostUsers: false`. Si el API no admite el perfil, elimina ese campo o la credencial del servidor carece del permiso necesario, el build falla antes de crear el Job. No hay fallback privilegiado. Los rechazos de creación del Job se propagan al solicitante, sin anunciar un build iniciado.

Requisitos de despliegue:

1. Kubernetes con `UserNamespacesSupport` activo, runtime compatible y filesystem con idmap mounts para los volúmenes utilizados. La [documentación oficial](https://kubernetes.io/docs/concepts/workloads/pods/user-namespaces/) detalla kernel, containerd/CRI-O y OCI runtime compatibles. Verificar la versión efectiva del clúster; no asumir soporte por el número de versión del servidor Kubero.
2. La identidad Kubernetes del servidor necesita `create` sobre Pods para la comprobación de admisión en dry-run, además de sus permisos existentes sobre Jobs. Una petición dry-run se autoriza igual que una creación, aunque no persista recursos. Coordinar este RBAC con quien administra el despliegue; no se amplía automáticamente desde la aplicación.
3. Verificar que las políticas de admisión permitan las capacidades del builder dentro del Pod aislado. Este perfil no se presenta como compatible sin excepciones con Pod Security Restricted. No desactivar globalmente las políticas del clúster.
4. Registro con certificado TLS confiable para las imágenes builder. Una CA privada debe distribuirse en el trust store del builder por el administrador. No se ofrece una opción HTTP/TLS insegura.
5. La ServiceAccount `<app>-kuberoapp` debe conservar únicamente los permisos de despliegue necesarios: patch del KuberoApp correspondiente. El token proyectado de una hora, su CA y namespace se montan exclusivamente en deploy, que no monta el repositorio. Los initContainers no reciben token del API; solo fetch recibe la clave Git y solo el exportador recibe las credenciales del registro.

Valores iniciales por contenedor: requests de CPU `100m`, memoria `128Mi` y almacenamiento efímero `256Mi`; limits de CPU `2`, memoria `2Gi` y almacenamiento efímero `4Gi`. `app-storage` tiene límite de `4Gi`, `/tmp` del despliegue `64Mi` y el Job un plazo de 1800 segundos. El administrador puede ajustar CPU/memoria/almacenamiento mediante las seis variables `KUBERO_BUILD_*` documentadas en `server/.env.template`. El límite de emptyDir se mantiene en 4Gi; un aumento de almacenamiento del contenedor no lo amplía automáticamente. Las cuotas y límites de procesos del namespace/nodo siguen siendo responsabilidad del administrador.

### Operador y componentes externos

Estos cambios afectan los Jobs creados por `KubernetesService.createBuildJob`. Los builds generados de forma independiente por el operador externo deben adoptar el mismo perfil; ese código y sus CRDs no están en este checkout. El CLI Go que consuma los endpoints HTTP mantiene sus rutas, pero el scraper necesita su nueva credencial y los nodos de build requieren el perfil anterior. No se añaden dependencias npm, imágenes nuevas ni migraciones Prisma.

## Verificación

Pruebas aisladas: autenticación HTTP real de ambas rutas de métricas, separación de clúster y credenciales con promesas intercaladas, copia TLS con awaits concurrentes, selección de contexto y streams Exec, verificación GitLab, payloads reales de push/merge request, parseo de las tres plantillas y generación de Jobs. Los scripts de deploy se ejecutan con Bash y un kubectl simulado para comprobar JSON, argumentos y rechazo de valores malformados; no se ejecutan operaciones contra un clúster.

Verificación final: `pnpm --dir server exec jest --runInBand --coverage=false --silent` pasó **1036 pruebas en 75 suites**. `pnpm --dir server run build` completó correctamente. ESLint de solo lectura sobre los **28 archivos TypeScript modificados/nuevos** terminó con **0 errores y 0 advertencias**. `git diff --check` no encontró errores. La comprobación global inicial de ESLint falló e incluyó numerosos errores de formato CRLF en archivos ajenos al cambio. Se corrigieron los problemas encontrados en la entrega y se repitió su lint con el resultado indicado; no se reformatea el resto del repositorio. La repetición final de las suites de contexto, métricas y logs pasó 39 pruebas en 3 suites tras los ajustes de lint.

No se ejecutaron builds de imágenes ni pruebas de admisión contra un clúster real: `docker info --format '{{.ServerVersion}}'` confirmó que no existe la conexión al motor Linux Docker Desktop. Quedan pendientes una construcción y push de cada estrategia contra un registro descartable, la comprobación del trust store y de la imagen fetch sin privilegios, y la política efectiva de user namespaces/RBAC del entorno destino. `yamllint` no está instalado; las plantillas TypeScript se parsean y validan en Jest con la librería YAML del proyecto. No se modifican plantillas de `services/`.

## Reversión

Revertir el commit restaura código y plantillas anteriores; no hay migración de datos que deshacer. Los Jobs ya creados conservan su spec: detenerlos o eliminarlos debe decidirlo el administrador del clúster. Revertir también restaura las debilidades anteriores, por lo que deben mantenerse las restricciones de red de métricas y suspender los builds no confiables hasta aplicar un perfil equivalente. Si hubo exposición previa de credenciales de registro o claves Git, su rotación se realiza en el gestor de secretos del entorno, no en este repositorio.
