# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f api/Dockerfile .
# The engine embeds shared/engine/*.json at build time, so shared/ must be in the build context.

# ---- Build stage ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
# Restore first, from project files only, so the package layer is cached until a dependency changes.
COPY api/Directory.Build.props api/.editorconfig ./api/
COPY api/src/TrustGuard.Engine/TrustGuard.Engine.csproj ./api/src/TrustGuard.Engine/
COPY api/src/TrustGuard.Api/TrustGuard.Api.csproj ./api/src/TrustGuard.Api/
COPY shared/ ./shared/
RUN dotnet restore api/src/TrustGuard.Api/TrustGuard.Api.csproj
COPY api/src ./api/src
RUN dotnet publish api/src/TrustGuard.Api/TrustGuard.Api.csproj -c Release -o /out --no-restore -p:UseAppHost=false

# ---- Runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /out ./
# The runtime image ships an unprivileged user; never run the API as root.
USER $APP_UID
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_EnableDiagnostics=0
EXPOSE 8080
ENTRYPOINT ["dotnet", "TrustGuard.Api.dll"]
