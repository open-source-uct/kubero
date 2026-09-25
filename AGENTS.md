# Guía del repositorio para Codex

## Mapa del proyecto

- `client/`: interfaz Vue 3, Vuetify 3 y pruebas Playwright.
- `server/`: API NestJS, autenticación, integración con Kubernetes, Prisma y CLI interno en TypeScript (`server/src/cli`).
- `services/`: plantillas YAML de aplicaciones y servicios.
- El CLI de Kubero en Go, el operador y sus CRDs se mantienen fuera de este checkout. Si un cambio modifica un contrato compartido, documenta el impacto y la coordinación necesaria; no supongas que puedes editar o probar esos repositorios aquí.

## Alcance y diseño

- Antes de editar, identifica el componente afectado y los archivos necesarios. Mantén cada cambio centrado en la tarea y conserva las modificaciones ajenas que ya existan.
- Para trabajo visual en `client/`, consulta `.agents/skills/uct-kubero-design/SKILL.md`; verifica el resultado en los temas claro y oscuro cuando corresponda.
- No agregues dependencias ni cambies contratos API, esquema Prisma o recursos Kubernetes sin explicar el motivo y el impacto en la entrega.

## Seguridad y entorno

- Usa `client/.env.example`, `server/.env.template` y `server/config.example.yaml` como referencias. Evita leer, imprimir, copiar o confirmar archivos `.env`, `config.yaml`, `kubeconfig`, secretos, tokens y salidas de depuración con credenciales.
- No despliegues ni ejecutes migraciones contra clústeres o bases de datos compartidos para verificar una tarea local. Las pruebas de integración deben apuntar a un entorno descartable.
- `AGENTS.md` orienta el trabajo, pero las restricciones reales de acceso se configuran mediante permisos y protección de ramas.

## Dependencias y comprobaciones

- El Dockerfile usa Node 22 y el servidor declara pnpm 10.33.0. `client/` y `server/` tienen lockfiles separados; instala dependencias por componente con `pnpm install --frozen-lockfile` desde su directorio.
- Servidor: `pnpm --dir server run build` y `pnpm --dir server exec jest --runInBand` cuando el cambio lo requiera. Para ESLint sin reescribir archivos: `pnpm --dir server exec eslint "src/**/*.ts"`.
- Cliente: `pnpm --dir client run build` y `pnpm --dir client exec eslint . --ignore-path .gitignore`. Playwright (`pnpm --dir client run test:e2e`) solo contra un entorno local descartable y configurado.
- Plantillas: valida el YAML modificado con `yamllint -c services/.yamllint services/` si la herramienta está disponible; informa cuando no se pudo ejecutar.
- Los scripts `lint` de ambos paquetes incluyen `--fix`; no los uses como comprobaciones de solo lectura. `server:test:e2e` apunta a `server/test/jest-e2e.json`, que no existe actualmente; no lo presentes como prueba disponible.

## Entrega

- Resume qué cambió, por qué, qué comprobaciones ejecutaste y qué riesgos o verificaciones pendientes quedan. No declares pruebas que no ejecutaste.
- Sigue `docs/engineering/codex-workflow.md` para ramas, commits y descripción del PR.

## Code Review Rules

- Revisa autorización y separación entre equipos o roles en API, WebSocket y operaciones de Kubernetes.
- Señala exposición de secretos en código, logs, capturas, plantillas y respuestas API.
- Comprueba compatibilidad y reversión de cambios en Prisma, contratos API, configuración y despliegues; identifica dependencias externas con CLI, operador o CRDs.
- En la UI, comprueba accesibilidad, estados de error y coherencia visual en temas claro y oscuro cuando el diff los afecte.
