# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-08-29

### Changed
- build(deps-dev): bump vite from 6.4.2 to 6.4.3 (#17)
- chore: bump version to v1.2.0 (#19)
- Show EPL goal scorers with minutes on score cards (#18)
- chore: bump version to v1.1.0 (#16)
- fix: move inline Python heredoc to a script file to fix YAML syntax error (#15)
- fix: add issues:write permission so create-pull-request can create the automated label (#14)
- Add TV network indicator to score cards (#13)
- fix: fix bump-version workflow for protected main branch (#10)
- fix: show all NBA and NHL playoff rounds (#12)
- Show live score in playoff series card during active games (#11)
- docs: expand README with overview, features, and local dev (#9)
- feat: add CHANGELOG, semver versioning, and version display in footer (#8)
- build(deps-dev): bump vite from 5.4.21 to 6.4.2 (#6)
- Add playoff series view for NBA and NHL (#7)
- Add reset preferences button to footer
- Filter leagues by active games by default
- Add NCAA Men's Basketball Tournament scores with bracket view
- Add NCAA Men's Basketball scores and tournament bracket
- title tweaks
- fix: correct EPL standings draws, add MP column, fix sort order


## [1.2.0] - 2026-08-29

### Changed
- Show EPL goal scorers with minutes on score cards (#18)
- chore: bump version to v1.1.0 (#16)
- fix: move inline Python heredoc to a script file to fix YAML syntax error (#15)
- fix: add issues:write permission so create-pull-request can create the automated label (#14)
- Add TV network indicator to score cards (#13)
- fix: fix bump-version workflow for protected main branch (#10)
- fix: show all NBA and NHL playoff rounds (#12)
- Show live score in playoff series card during active games (#11)
- docs: expand README with overview, features, and local dev (#9)
- feat: add CHANGELOG, semver versioning, and version display in footer (#8)
- build(deps-dev): bump vite from 5.4.21 to 6.4.2 (#6)
- Add playoff series view for NBA and NHL (#7)
- Add reset preferences button to footer
- Filter leagues by active games by default
- Add NCAA Men's Basketball Tournament scores with bracket view
- Add NCAA Men's Basketball scores and tournament bracket
- title tweaks
- fix: correct EPL standings draws, add MP column, fix sort order
- feat: add EPL, league logos, print optimizations, and UI improvements
- feat: add standings, 3-day scoreboard view, and enhanced favorite teams UI


## [1.1.0] - 2026-05-12

### Changed
- fix: move inline Python heredoc to a script file to fix YAML syntax error (#15)
- fix: add issues:write permission so create-pull-request can create the automated label (#14)
- Add TV network indicator to score cards (#13)
- fix: fix bump-version workflow for protected main branch (#10)
- fix: show all NBA and NHL playoff rounds (#12)
- Show live score in playoff series card during active games (#11)
- docs: expand README with overview, features, and local dev (#9)
- feat: add CHANGELOG, semver versioning, and version display in footer (#8)
- build(deps-dev): bump vite from 5.4.21 to 6.4.2 (#6)
- Add playoff series view for NBA and NHL (#7)
- Add reset preferences button to footer
- Filter leagues by active games by default
- Add NCAA Men's Basketball Tournament scores with bracket view
- Add NCAA Men's Basketball scores and tournament bracket
- title tweaks
- fix: correct EPL standings draws, add MP column, fix sort order
- feat: add EPL, league logos, print optimizations, and UI improvements
- feat: add standings, 3-day scoreboard view, and enhanced favorite teams UI
- feat: scaffold The Sports Page – Vite + React sports dashboard
- Initial commit


### Added
- TV network indicator (e.g. ESPN, ABC, AMZN) shown on upcoming and live games — as a badge on regular score cards and appended to the NEXT/LIVE lines on playoff series cards
- Playoff series cards now show the home team location for the next scheduled game (e.g. `@ CLE`)

### Fixed
- Live playoff series cards now show the current score alongside the game clock instead of the clock alone

## [1.0.0] - 2026-04-21

### Added
- Multi-sport scoreboard dashboard (NBA, NFL, MLB, NHL, NCAA Men's Basketball, EPL)
- Playoff series view for NBA and NHL
- NCAA Men's Basketball Tournament bracket view with full 64-team display
- Favorite teams filtering with localStorage persistence
- Active-games-only league filtering by default
- Auto-refreshing data every 5 minutes via ESPN API
- Print-optimized layout
- Standings tables per league with EPL draw/MP columns
- League logo display with sport branding
- Headless/automated generation mode
- Reset preferences button in footer
