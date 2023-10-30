import { App, PluginSettingTab, Setting } from 'obsidian';
import TrayPlugin, {
  ACCELERATOR_FORMAT,
  MOMENT_FORMAT,
  createTrayIcon,
  registerHotkeys,
  replaceVaultName,
  setHideTaskbarIcon,
  setLaunchOnStartup,
  showWindows,
  unregisterHotkeys
} from './main';
import {
  DEFAULT_DATE_FORMAT,
  OBSIDIAN_BASE64_ICON,
  TrayData,
  TrayOption,
  TrayOptionType,
  TraySettings
} from './settings';

export class SettingsTab extends PluginSettingTab {
  constructor(app: App, hostPlugin: TrayPlugin) {
    super(app, hostPlugin);
    TrayPlugin.setPlugin(hostPlugin);
  }

  public get settings(): TraySettings {
    return TrayPlugin.instance.settings;
  }

  display() {
    const options: TrayOption[] = [
      new TrayData({
        key: 'Window management',
        type: TrayOptionType.Text
      }),
      new TrayData({
        key: 'launchOnStartup',
        desc: 'Open Obsidian automatically whenever you log into your computer.',
        type: TrayOptionType.Toggle,
        default: false,
        onChange: setLaunchOnStartup
      }),
      new TrayData({
        key: 'hideOnLaunch',
        desc: `
Minimizes Obsidian automatically whenever the app is launched. If the
"Run in background" option is enabled, windows will be hidden to the system
tray/menubar instead of minimized to the taskbar/dock.
    `,
        type: TrayOptionType.Toggle,
        default: false
      }),
      new TrayData({
        key: 'runInBackground',
        desc: `
Hides the app and continues to run it in the background instead of quitting
it when pressing the window close button or toggle focus hotkey.
    `,
        type: TrayOptionType.Toggle,
        default: false,
        onChange() {
          setLaunchOnStartup();
          const runInBackground = TrayPlugin.data.runInBackground;
          if (!runInBackground) {
            showWindows();
          }
        }
      }),
      new TrayData({
        key: 'hideTaskbarIcon',
        desc: `
Hides the window's icon from from the dock/taskbar. Enabling the tray icon first
is recommended if using this option. This may not work on Linux-based OSes.
    `,
        type: TrayOptionType.Toggle,
        default: false,
        onChange: setHideTaskbarIcon
      }),
      new TrayData({
        key: 'createTrayIcon',
        desc: `
Adds an icon to your system tray/menubar to bring hidden Obsidian windows
back into focus on click or force a full quit/relaunch of the app through
the right-click menu.
    `,
        type: TrayOptionType.Toggle,
        default: true,
        onChange: createTrayIcon
      }),
      new TrayData({
        key: 'trayIconImage',
        desc: `
Set the image used by the tray/menubar icon. Recommended size: 16x16
<br>Preview: <img data-preview style="height: 16px; vertical-align: bottom;">
    `,
        type: TrayOptionType.Image,
        default: OBSIDIAN_BASE64_ICON,
        onChange: createTrayIcon
      }),
      new TrayData({
        key: 'trayIconTooltip',
        desc: `
Set a title to identify the tray/menubar icon by. The
<code>{{vault}}</code> placeholder will be replaced by the vault name.
<br>Preview: <b class="u-pop" data-preview></b>
    `,
        type: TrayOptionType.Text,
        default: '{{vault}} | Obsidian',
        postprocessor: replaceVaultName,
        onChange: createTrayIcon
      }),
      new TrayData({
        key: 'toggleWindowFocusHotkey',
        desc: ACCELERATOR_FORMAT,
        type: TrayOptionType.Hotkey,
        default: 'CmdOrCtrl+Shift+Tab',
        onBeforeChange: unregisterHotkeys,
        onChange: registerHotkeys
      }),
      new TrayData({
        key: 'Quick notes',
        type: TrayOptionType.Text
      }),
      new TrayData({
        key: 'quickNoteLocation',
        desc: 'New quick notes will be placed in this folder.',
        type: TrayOptionType.Text,
        placeholder: 'Example: notes/quick'
      }),
      new TrayData({
        key: 'quickNoteDateFormat',
        desc: `
      New quick notes will use a filename of this pattern. ${MOMENT_FORMAT}
      <br>Preview: <b class="u-pop" data-preview></b>
    `,
        type: TrayOptionType.Moment,
        default: DEFAULT_DATE_FORMAT
      }),
      new TrayData({
        key: 'quickNoteHotkey',
        desc: ACCELERATOR_FORMAT,
        type: TrayOptionType.Hotkey,
        default: 'CmdOrCtrl+Shift+Q',
        onBeforeChange: unregisterHotkeys,
        onChange: registerHotkeys
      })
    ];

    const { containerEl } = this;

    containerEl.empty();

    for (const trayOption of options) {
      const setting = new Setting(containerEl);
      trayOption.set(setting);
    }
  }
}
