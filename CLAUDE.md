# Claude-Mem Skill

Claude-Mem is installed as a user-level plugin for persistent memory across Claude Code sessions.

## Installation

Installed via `npx claude-mem install` (v11.0.0).

## What It Does

- Captures tool usage and session activity
- Compresses observations using AI
- Injects relevant context into future sessions
- Provides `/mem-search` for searching past work

## Configuration

- Plugin directory: `~/.claude/plugins/marketplaces/thedotmack/`
- Settings: `~/.claude-mem/settings.json`
- Database: `~/.claude-mem/claude-mem.db`
- Viewer UI: http://localhost:37777
