// One entry per service. fetch() returns {inner, outer}: the windows drawn as the
// pie and the arc, each {title, used (0-100), resetsAt (Date|null), note?} or null.
// No shell imports, so it can be run standalone.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');

const home = (...p) => GLib.build_filenamev([GLib.get_home_dir(), ...p]);

function readJson(path) {
    const [, bytes] = Gio.File.new_for_path(path).load_contents(null);
    return JSON.parse(new TextDecoder().decode(bytes));
}

// body: [contentType, string]
async function request(http, cancel, hint, method, url, headers = {}, body = null) {
    const msg = Soup.Message.new(method, url);
    for (const [k, v] of Object.entries(headers))
        msg.request_headers.append(k, v);
    if (body)
        msg.set_request_body_from_bytes(body[0], new GLib.Bytes(new TextEncoder().encode(body[1])));
    const bytes = await http.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, cancel);
    if (msg.status_code === 401)
        throw new Error(`Login expired — ${hint}`);
    if (msg.status_code !== 200)
        throw new Error(`HTTP ${msg.status_code} from ${GLib.Uri.parse(url, 0).get_host()}`);
    return JSON.parse(new TextDecoder().decode(bytes.get_data()));
}

const win = (title, used, resetsAt, note) =>
    ({title, used: used ?? 0, resetsAt: resetsAt ? new Date(resetsAt) : null, note});

function windowName(seconds) {
    const h = Math.round(seconds / 3600), d = Math.round(seconds / 86400);
    return h < 24 ? `${h}-hour` : d === 1 ? 'Daily' : d === 7 ? 'Weekly' : `${d}-day`;
}

const claude = {
    id: 'claude',
    name: 'Claude',
    // used, unused part of the pie
    palette: {used: [0.29, 0.64, 1], base: [0.8, 0.47, 0.23]},
    async fetch(http, cancel) {
        const hint = 'run `claude` once to renew it';
        const oauth = readJson(home('.claude', '.credentials.json')).claudeAiOauth;
        if (!oauth?.accessToken)
            throw new Error('Not logged in — run `claude` and /login');
        if (oauth.expiresAt < Date.now())
            throw new Error(`Login expired — ${hint}`);
        const u = await request(http, cancel, hint, 'GET', 'https://api.anthropic.com/api/oauth/usage', {
            'Authorization': `Bearer ${oauth.accessToken}`,
            'anthropic-beta': 'oauth-2025-04-20',
        });
        return {
            inner: win('Session (5h)', u.five_hour?.utilization, u.five_hour?.resets_at),
            outer: win('Weekly', u.seven_day?.utilization, u.seven_day?.resets_at),
        };
    },
};

const codex = {
    id: 'codex',
    name: 'ChatGPT (Codex)',
    palette: {used: [0.07, 0.07, 0.07], base: [0.95, 0.95, 0.95], ring: [0.95, 0.95, 0.95], outline: 1},
    async fetch(http, cancel) {
        const {tokens} = readJson(home('.codex', 'auth.json'));
        if (!tokens?.access_token)
            throw new Error('Not logged in — run `codex` and sign in with ChatGPT');
        const u = await request(http, cancel, 'run `codex` once to renew it', 'GET',
            'https://chatgpt.com/backend-api/wham/usage', {
                'Authorization': `Bearer ${tokens.access_token}`,
                'ChatGPT-Account-Id': tokens.account_id,
                'User-Agent': 'codex_cli_rs',
            });
        // Plus/Pro: 5-hour + weekly; some plans have a single longer window
        const [inner = null, outer = null] = [u.rate_limit?.primary_window, u.rate_limit?.secondary_window]
            .filter(Boolean)
            .map(w => win(windowName(w.limit_window_seconds), w.used_percent, w.reset_at * 1000));
        return {inner, outer};
    },
};

// left-to-right order in the top bar
export const PROVIDERS = [claude, codex];
