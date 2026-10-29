# MsgCore

A standalone conversation service with GraphQL, authenticated internal HTTP,
participant read tracking and user activity counts. The native implementation
preserves the existing SQLite schema, migration history and wire contracts.

## Layout

```text
services/msgcore/
  node/
    packages/               TypeScript SDK, logger and test fixtures
  csharp/
    apps/MsgCore.Server/     Thin application composition root
    packages/               Kernel, domain, contracts and adapters
    build/                  Pinned EF compiler and design-time host
    scripts/                Generated mapping and native publication
    tests/                  Managed/native database probes
    Dockerfile
  database/msgcore/sqlite/migrations/
  database/msgcore/sqlite/schema.d.ts
  database/Dockerfile        One-shot Knex schema owner
  contracts/graphql/        Shared GraphQL schema
  knexfile.msgcore.mjs
  docker/development/docker-compose.yml
  scripts/                  Service orchestration and acceptance
  tests/{contracts,http}/   Runtime-independent HTTP assertions
```

The C# architecture matches Snapped, Persona and TapTap. Domain modules expose
immutable records of function delegates with Result<T> and cancellation tokens.
EF adapters map generated persistence rows to domain records. A shared unit of
work controls multi-write operations. HTTP extracts identity through AdapterAuth;
AdapterGraphql has no ASP.NET dependency. The GraphQL SDL and TypeScript SDK have
their own service owners. The application runs as managed .NET or NativeAOT.

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
checks the database contract against a fresh database created by the existing Knex
migration. Application startup requires an existing database and initializes WAL
through the provider without creating tables or migration history.

The HTTP service suite and C# storage probes run against managed .NET and actual
NativeAOT binaries, alongside the SDK tests. Docker acceptance also
checks fresh migration mounts, application health, native ELF/no Node/no dotnet,
clean shutdown, stored representations and complete migration replay preservation.

```bash
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
