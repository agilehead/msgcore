# MsgCore workspace

Ctlflow defines service ownership. Product source belongs under services/msgcore/:
node/{apps,packages,tests,scripts}, csharp/{apps,packages,build,scripts,tests},
database/msgcore/sqlite/migrations, knexfile.msgcore.mjs, docker, scripts and
tests/contracts. Root owns workspace orchestration and documentation.

Follow Snapped, Persona and TapTap: immutable functional domain ports, Result<T>,
cancellation and one unit-of-work contract; separate generated persistence rows;
HTTP/auth ownership outside the ASP.NET-independent GraphQL adapter. Use EF LINQ
for all native product queries. Framework classes are permitted at EF/ASP.NET,
GraphQL and serialization boundaries. The pinned EF compiler is build-only.

Preserve API responses, original Knex migration bytes/history, stored SQLite
representations and production mounts. Knex alone owns schema changes. Native
startup requires an existing database and never runs migrations or seeds. Node
is an explicit comparison target and SDK owner, never a native fallback.

Read CLAUDE.md, README.md and CODING-STANDARDS.md. No production reset. Verify a
backup before any production data change. Deploy only when explicitly authorized;
use application-user SSH and preserve configuration/secrets. No root SSH.
No new subagents. Build/test in bounded process groups. Build, lint and all local,
managed/native probe, shared HTTP, SDK and actual Docker gates must pass before
committing. Never weaken assertions or quality gates.

Use improvements only; never commit/push main, force-push, reset, clean or stash
shared work. Keep root/nested .analysis ignored and private. Users create PRs:
provide /pull/new/improvements, never invoke PR creation tools.
