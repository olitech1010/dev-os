---
name: flutter-stack
description: Thin stack standard for Flutter
---
# Flutter Stack Standard

## Tech Stack
- Framework: Flutter / Dart
- Runtime: dart (see `.agents/project.json`)

## Standards
- Prefer composition of widgets; keep `build()` methods readable.
- Separate business logic from UI (e.g. Riverpod/Bloc/Provider as project convention).
- Confirm APIs via `.agents/knowledge/flutter/` or `devos sync-docs`.

## QA Commands
Use `commands.lint` and `commands.test` from `.agents/project.json` (typically `dart analyze` / `flutter test`).
