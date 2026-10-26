# MsgCore

A standalone conversation service with GraphQL, authenticated internal HTTP,
participant read tracking and user activity counts. The native implementation
preserves the existing SQLite schema, migration history and wire contracts.

## Layout

```text
services/msgcore/
  node/
    apps/server/            Retained Node comparison server
    packages/               Database utilities, logger, SDK and fixtures
    tests/                  Original service assertions
    scripts/
    Dockerfile
  csharp/
    apps/MsgCore.Server/     Thin application composition root
    packages/               Kernel, domain, contracts and adapters
    build/                  Pinned EF compiler and design-time host
    scripts/                Generated mapping and native publication
    tests/                  Managed/native database probes
    Dockerfile
  database/msgcore/sqlite/migrations/
  database/Dockerfile        One-shot Knex schema owner
  knexfile.msgcore.mjs
  docker/development/docker-compose.yml
  scripts/                  Service orchestration and acceptance
  tests/contracts/          One cross-runtime HTTP assertion bank
```

The C# architecture matches Snapped, Persona and TapTap. Domain modules expose
immutable records of function delegates with Result<T> and cancellation tokens.
EF adapters map generated persistence rows to domain records. A shared unit of
work controls multi-write operations. HTTP extracts identity through AdapterAuth;
AdapterGraphql has no ASP.NET dependency. GraphQL SDL and the TypeScript SDK are
shared with the retained Node implementation. Native applications never invoke Node.

## Build and verify

```bash
npm ci
npm run build
npm run lint
npm run build:native
npm test
npm run test:integration
```

Use the same .NET 11 RC2, EF 11 RC2 and GraphQL.NET 8.8.5 pins as the other native
services. Native publishing generates EF compiled models and query interceptors;
product queries and writes use EF LINQ without handwritten SQL. Mapping generation
checks the Node contract against a fresh database created by the original Knex
migration. Application startup requires an existing database and initializes WAL
through the provider without creating tables or migration history.

The original service suites and SDK tests remain. Shared HTTP assertions run
against Node, managed C# and actual NativeAOT binaries. Docker acceptance also
checks fresh migration mounts, application health, native ELF/no Node/no dotnet,
clean shutdown, stored representations and complete migration replay preservation.
Node-only JWT/repository assertions are reported separately from HTTP parity.

```bash
node services/msgcore/scripts/test-services.mjs node
node services/msgcore/scripts/test-services.mjs csharp
node services/msgcore/scripts/test-services.mjs nativeaot
node services/msgcore/csharp/scripts/generate-model.mjs
node services/msgcore/csharp/scripts/generate-model.mjs --check
```

## Run

Copy .env.example to .env and configure the required host, data directory, internal
secret, JWT secret and CORS origins. Relative database paths resolve from the
workspace root in the service launcher and Knex configuration.

```bash
npm run migrate:msgcore:latest
npm start
./services/msgcore/scripts/start.sh nativeaot
./services/msgcore/scripts/start.sh node
```

Authentication prefers a valid bearer token and falls back to access_token cookies.
The application userId claim takes precedence over the Persona sub claim. Internal
HTTP endpoints require the shared bearer secret. Internal create/send responses
retain snake_case rows; GraphQL and internal conversation reads retain camelCase.

## Containers and publishing

```bash
./services/msgcore/scripts/docker-build.sh
./services/msgcore/scripts/docker-push.sh
```

The default application image is NativeAOT; MSGCORE_DOTNET_CONTAINER_TARGET=managed
selects the managed build. The publisher preflights and publishes both msgcore
and msgcore-migrations with commit and selected tags. The Knex runner remains a
one-shot job and contains Node; the persistent application image contains neither
Node nor a dotnet runtime. docker/development/docker-compose.yml retains existing data mounts.

Knex alone owns schema migration. Never edit the existing migration, reseed or
reset production. Verify database and media backups before deploying any consumer.
