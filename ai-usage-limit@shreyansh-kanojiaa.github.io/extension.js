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
import {PROVIDERS} from './providers.js';

const POLL_SECONDS = 120;
const RETRY_SECONDS = 30; // after a failure, e.g. network not up yet at login

// "Sun 14:30 (in 3d 4h)", or "no active window" when the limit isn't running
function resetText(d) {
    if (!d)
        return 'no active window';
    const opts = {hour: '2-digit', minute: '2-digit'};
    if (d.toDateString() !== new Date().toDateString())
        opts.weekday = 'short';
    const mins = Math.max(0, Math.round((d - Date.now()) / 60000));
    const left = mins >= 1440 ? `${Math.floor(mins / 1440)}d ${Math.floor(mins % 1440 / 60)}h`
        : mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    return `${d.toLocaleString([], opts)} (in ${left})`;
}

function windowText(w) {
    const lines = [w.title, `${w.used.toFixed(1)}% used · ${(100 - w.used).toFixed(1)}% left`,
        `Resets ${resetText(w.resetsAt)}`];
    if (w.note)
        lines.push(w.note);
    return lines.join('\n');
}

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init(provider) {
        super._init(0.0, `${provider.name} usage`);
        this._provider = provider;
        this._used = [null, null]; // [inner, outer] as 0..1
        this._gauge = new St.DrawingArea({width: SIZE, height: SIZE, y_align: Clutter.ActorAlign.CENTER});
        this._gauge.connect('repaint', () => {
            const cr = this._gauge.get_context();
            draw(cr, ...this._used, provider.palette);
            cr.$dispose();
        });
        this.add_child(this._gauge);

        const item = () => {
            const i = new PopupMenu.PopupMenuItem('', {reactive: false});
            this.menu.addMenuItem(i);
            return i;
        };
        item().label.text = provider.name;
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._inner = item();
        this._outerSep = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(this._outerSep);
        this._outer = item();
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
            this._show(await this._provider.fetch(this._http, this._cancel));
            this._updated = `Updated ${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
            this._status.label.text = this._updated;
        } catch (e) {
            if (e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                return; // destroyed
            // keep the last good reading on screen; only show "?" if there never was one
            if (!this._inner.label.text)
                this._inner.label.text = 'Waiting for data…';
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

    _show({inner, outer}) {
        this._used = [inner ? inner.used / 100 : null, outer ? outer.used / 100 : null];
        this._gauge.queue_repaint();
        this._inner.label.text = inner ? windowText(inner) : 'No usage limit reported';
        this._outer.label.text = outer ? windowText(outer) : '';
        this._outer.visible = this._outerSep.visible = !!outer;
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
        this._settings = this.getSettings();
        this._indicators = [];
        this._settingsId = this._settings.connect('changed', () => this._sync());
        this._sync();
    }

    // rebuild the gauges for whichever services are switched on
    _sync() {
        this._indicators.forEach(i => i.destroy());
        this._indicators = PROVIDERS
            .filter(p => this._settings.get_boolean(`show-${p.id}`))
            .map((p, i) => {
                const indicator = new Indicator(p);
                // from index 0 of the right box: side by side, just left of the network/battery/system menu
                Main.panel.addToStatusArea(`${this.uuid}-${p.id}`, indicator, i, 'right');
                return indicator;
            });
    }

    disable() {
        this._settings.disconnect(this._settingsId);
        this._indicators.forEach(i => i.destroy());
        this._indicators = null;
        this._settings = null;
    }
}
