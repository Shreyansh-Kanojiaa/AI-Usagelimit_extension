import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const ROWS = [
    ['show-claude', 'Claude', 'Needs Claude Code (claude) logged in'],
    ['show-codex', 'ChatGPT', 'Needs Codex CLI (codex) signed in with ChatGPT'],
];

export default class AIUsageLimitPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const group = new Adw.PreferencesGroup({title: 'Show in top bar'});
        for (const [key, title, subtitle] of ROWS) {
            const row = new Adw.SwitchRow({title, subtitle});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
        }
        const page = new Adw.PreferencesPage();
        page.add(group);
        window.add(page);
    }
}
