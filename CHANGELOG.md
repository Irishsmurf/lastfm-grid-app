# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.6.0] — 2026-06-15

### Added
- GitHub Actions CI pipeline for automated linting and testing on every PR and push to main
- `/api/health` endpoint for Redis connection health checks with structured logging
- Redis error and reconnecting event listeners for improved monitoring and debugging
- Playcount overlay on album art tiles that appears on hover with album name, artist, and play count
- Configurable grid size selector (3×3, 4×4, 5×5) with query parameter persistence (`?limit=9|16|25`)
- Copy link button on the share page for easy sharing of generated grids
- Brand identity system with custom color tokens, logo, and Open Graph image templates
- Structured logging (Pino) throughout API routes for better observability

### Changed
- Replaced all `console.log` and `console.error` calls with structured logger in API routes
- Removed redundant `initializeRemoteConfig()` calls from server-side API routes
- Lazy-initialized Firebase Remote Config to prevent module-level crashes in Node.js environments
- Optimized Remote Config usage to safely handle server vs. browser contexts
- Dynamic grid layout sizing based on selected grid dimensions
- Canvas renderer updated to use dynamic column count for grid exports

### Fixed
- Firebase Remote Config SDK initialization no longer crashes when imported in Node.js server context
- Removed inappropriate server-side Firebase Remote Config initialization
- Fixed TypeScript compatibility issues with nullable `remoteConfig` in client components

### Technical
- Redis cache key for albums now includes limit parameter: `lastfm:albums:<user>:<period>:<limit>:minimized`
- Added `brand-*` color tokens to Tailwind configuration (brand-red, brand-dark, brand-surface, brand-success)
- Created `BRAND.md` for brand guidelines and usage documentation
