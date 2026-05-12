# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- TV network indicator (e.g. ESPN, ABC, AMZN) shown as a badge next to the game time on upcoming and live score cards
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
