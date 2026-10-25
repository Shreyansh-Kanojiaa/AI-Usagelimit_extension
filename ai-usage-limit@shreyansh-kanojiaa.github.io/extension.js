import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup?version=3.0';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {draw, SIZE} from './gauge.js';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');

const CREDS = GLib.build_filenamev([GLib.get_home_dir(), '.claude', '.credentials.json']);
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const POLL_SECONDS = 120;
const RETRY_SECONDS = 30; // after a failure, e.g. network not up yet at login

// "Sun 14:30 (in 3d 4h)", or "no active window" when the limit isn't running
function resetText(iso) {
    if (!iso)
        return 'no active window';
    const d = new Date(iso);
    const opts = {hour: '2-digit', minute: '2-digit'};
    if (d.toDateString() !== new Date().toDateString())
        opts.weekday = 'short';
    const mins = Math.max(0, Math.round((d - Date.now()) / 60000));
    const left = mins >= 1440 ? `${Math.floor(mins / 1440)}d ${Math.floor(mins % 1440 / 60)}h`
        : mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    return `${d.toLocaleString([], opts)} (in ${left})`;
}

// Claude Code's login; Claude Code itself renews it whenever you use it
function readToken() {
    const [, bytes] = Gio.File.new_for_path(CREDS).load_contents(null);
    const oauth = JSON.parse(new TextDecoder().decode(bytes)).claudeAiOauth;
    if (!oauth?.accessToken)
        throw new Error('Not logged in — run `claude` and /login');
    if (oauth.expiresAt < Date.now())
        throw new Error('Login expired — run `claude` once to renew it');
    return oauth.accessToken;
}

function usageText(u) {
    const used = u?.utilization ?? 0;
    return `${used.toFixed(1)}% used · ${(100 - used).toFixed(1)}% left\nResets ${resetText(u?.resets_at)}`;
}

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'AI Usage Limit');
        this._used = [null, null]; // [session, week] as 0..1
        this._gauge = new St.DrawingArea({width: SIZE, height: SIZE, y_align: Clutter.ActorAlign.CENTER});
        this._gauge.connect('repaint', () => {
            const cr = this._gauge.get_context();
            draw(cr, ...this._used);
            cr.$dispose();
        });
        this.add_child(this._gauge);

        const item = () => {
            const i = new PopupMenu.PopupMenuItem('', {reactive: false});
            this.menu.addMenuItem(i);
            return i;
        };
        this._session = item();
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._week = item();
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._status = item();
        this.menu.addAction('Refresh now', () => this.refresh());

        this._http = new Soup.Session({timeout: 15});
        this._cancel = new Gio.Cancellable();
        this._timer = 0;
        this.refresh();
    }

    async refresh() {
        // one at a time, so "Refresh now" during a poll doesn't double up
        if (this._busy)
            return;
        this._busy = true;
        let next = POLL_SECONDS;
        try {
            const msg = Soup.Message.new('GET', USAGE_URL);
            msg.request_headers.append('Authorization', `Bearer ${readToken()}`);
            msg.request_headers.append('anthropic-beta', 'oauth-2025-04-20');
            const body = await this._http.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, this._cancel);
            if (msg.status_code !== 200)
                throw new Error(`Usage API: HTTP ${msg.status_code}`);
            this._show(JSON.parse(new TextDecoder().decode(body.get_data())));
            this._updated = `Updated ${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
            this._status.label.text = this._updated;
        } catch (e) {
            if (e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                return; // destroyed
            // keep the last good reading on screen; only show "?" if there never was one
            if (!this._session.label.text)
                this._session.label.text = 'Waiting for data…';
            this._status.label.text = [this._updated, `⚠ ${e.message}`].filter(Boolean).join('\n');
            next = RETRY_SECONDS;
        }
        this._busy = false;
        if (this._timer)
            GLib.source_remove(this._timer);
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, next, () => {
            this._timer = 0;
            this.refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _show({five_hour: s, seven_day: w}) {
        this._used = [(s?.utilization ?? 0) / 100, (w?.utilization ?? 0) / 100];
        this._gauge.queue_repaint();
        this._session.label.text = `Session (5h)\n${usageText(s)}`;
        this._week.label.text = `Weekly\n${usageText(w)}`;
    }

    destroy() {
        this._cancel.cancel();
        this._http.abort();
        if (this._timer)
            GLib.source_remove(this._timer);
        super.destroy();
    }
});

export default class AIUsageLimit extends Extension {
    enable() {
        this._indicator = new Indicator();
        // index 0 of the right box = just left of the network/battery/system menu
        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'right');
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
