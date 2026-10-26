FROM mcr.microsoft.com/dotnet/sdk:11.0.100-rc.2@sha256:bfabf51e74c5a7cf2fc4eac852145db86f4867d475257d809518d6a2b0fe71e1 AS build
WORKDIR /source
ENV DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_GENERATE_ASPNET_CERTIFICATE=false DOTNET_PROCESSOR_COUNT=4
RUN apt-get update && apt-get install -y --no-install-recommends gcc g++ zlib1g-dev && rm -rf /var/lib/apt/lists/*
COPY global.json Directory.Build.props Directory.Build.targets Directory.Packages.props MsgCore.CSharp.slnx ./
COPY services/msgcore/csharp ./services/msgcore/csharp
COPY services/msgcore/node/apps/server/src/schema.graphql ./services/msgcore/node/apps/server/src/schema.graphql
ARG MSGCORE_APP=MsgCore.Server
FROM build AS native-build
ARG MSGCORE_APP=MsgCore.Server
RUN case "$MSGCORE_APP" in MsgCore.Server) ;; *) exit 2 ;; esac \
    && dotnet publish "services/msgcore/csharp/apps/$MSGCORE_APP/$MSGCORE_APP.csproj" \
       -c Release -r linux-x64 -p:PublishAot=true -p:CppCompilerAndLinker=gcc -p:DebugType=None -o /native \
    && mv "/native/$MSGCORE_APP" /native/msgcore
FROM build AS managed-build
ARG MSGCORE_APP=MsgCore.Server
RUN dotnet publish "services/msgcore/csharp/apps/$MSGCORE_APP/$MSGCORE_APP.csproj" \
    -c Release -p:PublishAot=false --self-contained false -o /managed \
    && printf '%s\n' '#!/bin/sh' "exec dotnet /app/$MSGCORE_APP.dll \"\$@\"" > /managed/msgcore \
    && chmod +x /managed/msgcore

FROM mcr.microsoft.com/dotnet/aspnet:11.0.0-rc.2@sha256:623c52ed3fad0fa423b8cc860910492364b0d6245870a415e997017d4a4f4513 AS managed
WORKDIR /app
COPY --from=managed-build /managed ./
USER 0
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 CMD ["/app/msgcore", "health"]
ENTRYPOINT ["/app/msgcore"]

FROM mcr.microsoft.com/dotnet/runtime-deps:11.0.0-rc.2@sha256:fccbc81aefc5cb3f40373a99844b0950d71eabd49225ce4442a5fcf11917acee AS nativeaot
WORKDIR /app
COPY --from=native-build /native ./
USER 0
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 CMD ["/app/msgcore", "health"]
ENTRYPOINT ["/app/msgcore"]
