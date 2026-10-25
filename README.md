# AI Usage Limit

GNOME Shell extension (45–50) that shows your Claude usage limits in the top bar:

- **Inner circle:** 5-hour session limit, filled blue as you use it, with the % used in the middle
- **Outer arc:** weekly limit
- **Click** for exact percentages and reset times

## Requirements

[Claude Code](https://claude.com/claude-code) logged in with a Claude subscription. The extension reads the login from `~/.claude/.credentials.json` (it never writes to it) and polls `api.anthropic.com` every 2 minutes. If the login expires, run `claude` once and Claude Code renews it.

The usage endpoint is undocumented and may change. Not affiliated with Anthropic.

## Install from source

```sh
git clone https://github.com/Shreyansh-Kanojiaa/AI-Usagelimit_extension.git
cp -r AI-Usagelimit_extension/ai-usage-limit@shreyansh-kanojiaa.github.io ~/.local/share/gnome-shell/extensions/
gnome-extensions enable ai-usage-limit@shreyansh-kanojiaa.github.io
```

Then log out and back in.

## License

GPL-2.0-or-later
