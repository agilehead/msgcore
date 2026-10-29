# MsgCore C# implementation

The directory structure, pinned toolchain, functional Result<T>/cancellation ports,
unit of work, generated EF rows, HTTP/auth separation and source-generated JSON
follow Snapped, Persona and TapTap. Root README.md owns commands and verification.

Conversations, Messages and Activity are separate domain/storage features. Kernel
owns time, IDs, Result<T> and transactions. AdapterAuth verifies HMAC JWTs;
AdapterHttp owns request identity, CORS and internal routes. AdapterGraphql embeds
the service-owned GraphQL SDL and exposes the transport without ASP.NET.
No native application query uses handwritten SQL.

The four generated mappings are validated against the service-owned database type
and actual immutable Knex schema. The compiled model/query compiler runs only at
build time. Startup needs an existing database; migrations are never run by the app.
A managed build is insufficient evidence of NativeAOT behavior: execute the shared
HTTP bank, native database probe and actual Docker gates before release.

Native images run /app/msgcore; /app/msgcore health is the health probe. Node is
retained for the SDK, test tooling and one-shot migration runner. Publish msgcore
and msgcore-migrations together from the working commit;
the shared publisher preflights both before pushing commit and selected tags.
