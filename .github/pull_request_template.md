## Resumen y motivo

<!-- Explica el problema, la solución y por qué se necesita. -->

**Issue:** <!-- Escribe Closes #ID o Refs #ID; elimina la opción que no corresponda. -->
**Destino del PR:** <!-- Escribe develop o main; main solo para promoción o hotfix. -->

## Componentes afectados

- [ ] `client/` — interfaz Vue/Vuetify
- [ ] `server/` — API, autenticación, Kubernetes o Prisma
- [ ] `services/` — plantillas YAML
- [ ] Integración con CLI, operador o CRDs externos a este checkout
- [ ] Documentación, Docker o GitHub

## Impacto y compatibilidad

<!-- Escribe "No aplica" donde corresponda. Describe contratos, migraciones y dependencias externas. -->

- API, autenticación o permisos:
- Prisma o datos existentes:
- Recursos Kubernetes, despliegue o configuración:
- CLI, operador o CRDs:
- UI, accesibilidad y temas claro/oscuro:
- Cambio incompatible y ruta de actualización:

## Verificación

<!-- Registra solo pruebas ejecutadas. Incluye comando, resultado y entorno; explica las pendientes. -->

| Comprobación | Comando o pasos | Resultado / motivo si no se ejecutó |
| --- | --- | --- |
| Build y pruebas del componente | | |
| Revisión manual o E2E local | | |

**Entorno de integración, si aplica:** versión de Kubernetes, CLI y operador; tipo de clúster.

## Riesgos y reversión

<!-- Riesgo principal, señales para detectarlo y pasos concretos para revertir. -->

## Evidencia visual

<!-- Para cambios UI, adjunta capturas de temas claro y oscuro. Si no aplica, indícalo. -->

## Revisión final

- [ ] Revisé el diff y excluí cambios o archivos generados ajenos al issue.
- [ ] No incluí secretos, kubeconfigs, tokens ni logs sin depurar.
- [ ] Revisé autorización y exposición de datos si el cambio toca API, WebSocket o Kubernetes.
- [ ] Documenté el impacto en contratos, Prisma, despliegue o componentes externos, o indiqué que no aplica.
- [ ] Registré pruebas reales y señalé las que quedaron pendientes.
- [ ] Actualicé documentación y comprobé accesibilidad y ambos temas visuales cuando corresponde.
