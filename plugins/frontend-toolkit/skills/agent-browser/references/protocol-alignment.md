# agent-browser Migration Guide

## Table of Contents

- [v0.20.0: 100% Native Rust](#v0200-100-native-rust-major-breaking-change)
- [v0.22.0: Network and Dialog Enhancements](#v0220-network--dialog-enhancements)
- [v0.22.2: Proxy Improvements](#v0222-proxy-improvements)
- [v0.22.3: Keyboard and Recording Fixes](#v0223-keyboard--recording-fixes)
- [Version Compatibility](#version-compatibility)

## v0.20.0: 100% Native Rust (Major Breaking Change)

The Node.js/Playwright daemon was completely removed. The entire stack is now native Rust.

### What Changed

| Before (< v0.20) | After (v0.20+) |
|---|---|
| Rust CLI + Node.js daemon | 100% Native Rust |
| 710 MB install | 7 MB install |
| 143 MB daemon memory | 8 MB daemon memory |
| 1002ms cold start | 617ms cold start |
| Node.js required | No Node.js dependency for daemon |

### Migration Steps

- No API changes needed -- commands are backward compatible
- Remove any Node.js daemon configurations
- Video recording codec changed to VP9 (WebM)

## v0.22.0: Network & Dialog Enhancements

- `network request <id>` -- view full request details
- `network requests --type/--method/--status` -- request filtering
- `-C`/`--cursor` snapshot flag deprecated (cursor elements included by default)
- Cross-origin iframe support via Target.setAutoAttach

## v0.22.2: Proxy Improvements

- Proxy fallback to standard env vars (`HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY`)
- Proxy authentication via CDP Fetch.authRequired
- `dialog status` command

## v0.22.3: Keyboard & Recording Fixes

- `keyboard inserttext` for IME-style input
- Download behavior fixes during recording
- Stability improvements

## Version Compatibility

| Feature | Minimum Version |
|---|---|
| Native Rust daemon | v0.20.0 |
| Batch command | v0.21.0 |
| Self-update (`upgrade`) | v0.21.1 |
| HAR capture | v0.21.1 |
| Network filtering | v0.22.0 |
| Proxy env fallback | v0.22.2 |
| Clipboard commands | v0.19.0 |
| Config file support | v0.11.0 |
| Annotated screenshots | v0.12.0 |
| Diff commands | v0.13.0 |
| Keyboard command | v0.14.0 |
| Security features | v0.15.0 |
| iOS Simulator | v0.9.0 |
| Cloud providers | v0.7.0+ |
