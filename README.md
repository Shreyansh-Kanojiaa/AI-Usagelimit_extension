# AI Usage Limit

GNOME Shell extension (45–50) that shows your AI plan usage limits in the top bar, one gauge per service:

| Gauge | Inner circle | Outer arc | Colors |
|---|---|---|---|
| Claude | 5-hour session | Weekly | orange / blue |
| ChatGPT (Codex) | Shortest window your plan has (5-hour on Plus/Pro) | Next window (weekly), if any | white / black |

The circle fills with the "used" color as you use the limit, with the % used in the middle. Click a gauge for exact percentages and reset times. Pick which gauges to show in the extension's settings (Extension Manager → AI Usage Limit → ⚙).

## Requirements

Each gauge reuses the login of the official command-line tool, read-only:

- **Claude:** [Claude Code](https://claude.com/claude-code) logged in (`~/.claude/.credentials.json`). If the login expires, run `claude` once.
- **ChatGPT:** [Codex CLI](https://github.com/openai/codex) signed in with ChatGPT (`~/.codex/auth.json`). If the login expires, run `codex` once.

Usage is polled every 2 minutes from api.anthropic.com and chatgpt.com. These endpoints are undocumented and may change. Not affiliated with Anthropic or OpenAI.

## Install from source

```sh
git clone https://github.com/Shreyansh-Kanojiaa/AI-Usagelimit_extension.git
cd AI-Usagelimit_extension
glib-compile-schemas ai-usage-limit@shreyansh-kanojiaa.github.io/schemas
cp -r ai-usage-limit@shreyansh-kanojiaa.github.io ~/.local/share/gnome-shell/extensions/
gnome-extensions enable ai-usage-limit@shreyansh-kanojiaa.github.io
```

Then log out and back in.

## License

GPL-2.0-or-later
