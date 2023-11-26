/**
 * obsidian-tray v0.3.3
 * (c) 2023 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/obsidian-tray/) under the MIT license
 */

import {
  ElectronBrowserWindow,
  ElectronTray,
  Menu,
  Tray,
  app,
  getCurrentWindow,
  globalShortcut,
  nativeImage
} from '@electron/remote';
import { App, Plugin, PluginManifest, moment, normalizePath } from 'obsidian';
import { logError, logMessage, logWarning } from './logger';
import { TrayData, TrayOptionType, TraySettings, TraySettingsBase, Value } from './settings';
import { SettingsTab } from './settingsTab';

const LOG_LOADING: string = 'loading';
const LOG_CLEANUP: string = 'cleaning up';
const LOG_SHOWING_WINDOWS: string = 'showing windows';
const LOG_HIDING_WINDOWS: string = 'hiding windows';
const LOG_WINDOW_CLOSE: string = 'intercepting window close';
const LOG_TRAY_ICON: string = 'creating tray icon';
const LOG_REGISTER_HOTKEY: string = 'registering hotkey';
const LOG_UNREGISTER_HOTKEY: string = 'unregistering hotkey';

const ACTION_QUICK_NOTE: string = 'Quick Note';
const ACTION_SHOW: string = 'Show Vault';
const ACTION_HIDE: string = 'Hide Vault';
const ACTION_RELAUNCH: string = 'Relaunch Obsidian';
const ACTION_CLOSE: string = 'Close Vault';

export const ACCELERATOR_FORMAT: string = `
    This hotkey is registered globally and will be detected even if Obsidian does
    not have keyboard focus. Format:
    <a href="https://www.electronjs.org/docs/latest/api/accelerator" target="_blank" rel="noopener">
    Electron accelerator</a>
  `;
export const MOMENT_FORMAT: string = `
    Format:
    <a href="https://momentjs.com/docs/#/displaying/format/" target="_blank" rel="noopener">
    Moment.js format string</a>
  `;

function observeChildWindows() {
  // 1. Get the current window
  const currentWindow = getCurrentWindow();

  // 2. When a new window is created, add it to the set of child windows
  currentWindow.webContents.on('did-create-window', (win: ElectronBrowserWindow) => {
    TrayPlugin.instance.addWindow(win);

    // 3. When the child window is closed, remove it from the set of child windows
    win.on('close', () => TrayPlugin.instance.deleteWindow(win));

    // 4. Set the child window to hide its taskbar icon
    win.setSkipTaskbar(TrayPlugin.instance.data.hideTaskbarIcon);
  });
}

export function showWindows() {
  logMessage(LOG_SHOWING_WINDOWS);
  TrayPlugin.instance.getAllWindows().forEach((win: ElectronBrowserWindow) => win.show());
}

export function hideWindows() {
  logMessage(LOG_HIDING_WINDOWS);
  TrayPlugin.instance
    .getAllWindows()
    .forEach((win: ElectronBrowserWindow) => [
      win.isFocused() && win.blur(),
      TrayPlugin.instance.data.runInBackground ? win.hide() : win.minimize()
    ]);
}

function toggleWindows(checkForFocus = true) {
  const openWindows = TrayPlugin.instance.getAllWindows().some((win) => {
    return (!checkForFocus || win.isFocused()) && win.isVisible();
  });
  if (openWindows) hideWindows();
  else showWindows();
}

function onWindowClose(event: CloseEvent) {
  event.preventDefault();
}

function onWindowUnload(event: BeforeUnloadEvent) {
  logMessage(LOG_WINDOW_CLOSE);
  getCurrentWindow().hide();

  event.stopImmediatePropagation();

  // setting return value manually is more reliable than
  // via `return false` according to electron
  event.returnValue = false;
}

function interceptWindowClose() {
  // intercept in renderer
  window.addEventListener('beforeunload', onWindowUnload, true);

  // intercept in main: is asynchronously executed when registered
  // from renderer, so won't prevent close by itself, but counteracts
  // the 3-second delayed window force close in `obsidian.asar/main.js`
  getCurrentWindow().on('close', onWindowClose);
}

function allowWindowClose() {
  getCurrentWindow().removeListener('close', onWindowClose);
  window.removeEventListener('beforeunload', onWindowUnload, true);
}

export function setHideTaskbarIcon() {
  TrayPlugin.instance.getAllWindows().forEach((win) => {
    win.setSkipTaskbar(TrayPlugin.instance.data.hideTaskbarIcon);
  });
}
export function setLaunchOnStartup() {
  app.setLoginItemSettings({
    openAtLogin: TrayPlugin.instance.data.launchOnStartup,
    openAsHidden: TrayPlugin.instance.data.runInBackground && TrayPlugin.instance.data.hideOnLaunch
  });
}

function relaunchApp() {
  app.relaunch();
  app.exit(0);
}

function closeVault() {
  logMessage(LOG_CLEANUP);
  unregisterHotkeys();
  allowWindowClose();
  destroyTray();
  TrayPlugin.instance.getAllWindows().forEach((win) => win.destroy());
}

function addQuickNote(): void {
  const pattern = TrayPlugin.data.quickNoteDateFormat;
  const date = moment().format(pattern);
  const name = normalizePath(`${TrayPlugin.data.quickNoteLocation ?? ''}/${date}`).replace(/\*|"|\\|<|>|:|\||\?/g, '-');
  TrayPlugin.plugin?.app.fileManager.createAndOpenMarkdownFile(name, PaneType.FLOATING);
  showWindows();
}

export function replaceVaultName(str: string) {
  return str.replace(/{{vault}}/g, TrayPlugin.plugin?.app.vault.getName() ?? '');
}

export function destroyTray() {
  TrayPlugin.instance.getTray()?.destroy();
  TrayPlugin.instance.setTray(null);
}

export function createTrayIcon() {
  if (!TrayPlugin.data.createTrayIcon) return;
  logMessage(LOG_TRAY_ICON);

  destroyTray();
  const obsidianIcon = nativeImage.createFromDataURL(TrayPlugin.data.trayIconImage);
  const newTray = new Tray(obsidianIcon);
  TrayPlugin.instance.setTray(newTray);

  try {
    const contextMenu = Menu.buildFromTemplate([
      {
        type: 'normal',
        label: ACTION_QUICK_NOTE,
        accelerator: TrayPlugin.data.quickNoteHotkey,
        click: addQuickNote
      },
      {
        type: 'normal',
        label: ACTION_SHOW,
        accelerator: TrayPlugin.data.toggleWindowFocusHotkey,
        click: showWindows
      },
      {
        type: 'normal',
        label: ACTION_HIDE,
        accelerator: TrayPlugin.data.toggleWindowFocusHotkey,
        click: hideWindows
      },
      { type: 'separator' },
      { label: ACTION_RELAUNCH, click: relaunchApp },
      { label: ACTION_CLOSE, click: closeVault }
    ]);
    newTray.setContextMenu(contextMenu);
  } catch {
    logError('Failed to set tray context menu.');
  }

  newTray.setToolTip(replaceVaultName(TrayPlugin.data.trayIconTooltip));
  newTray.on('click', () => showWindows());
}

export function registerHotkeys() {
  logMessage(LOG_REGISTER_HOTKEY);
  try {
    if (TrayPlugin.data.toggleWindowFocusHotkey) {
      globalShortcut.register(TrayPlugin.data.toggleWindowFocusHotkey, toggleWindows);
    }
    if (TrayPlugin.data.quickNoteHotkey) {
      globalShortcut.register(TrayPlugin.data.quickNoteHotkey, addQuickNote);
    }
  } catch {
    logWarning('Failed to register hotkeys');
  }
}

export function unregisterHotkeys() {
  logMessage(LOG_UNREGISTER_HOTKEY);
  try {
    globalShortcut.unregister(TrayPlugin.data.toggleWindowFocusHotkey);
    globalShortcut.unregister(TrayPlugin.data.quickNoteHotkey);
  } catch {
    logError('Failed to register hotkeys');
  }
}

export function keyToLabel(key: string) {
  return (
    key[0].toUpperCase() +
    key
      .slice(1)
      .split(/(?=[A-Z])/)
      .map((word) => word.toLowerCase())
      .join(' ')
  );
}

export function htmlToFragment(html: string) {
  return document.createRange().createContextualFragment((html ?? '').replace(/\s+/g, ' '));
}

export class TrayPlugin extends Plugin {
  private readonly _settings: TraySettings = new TraySettings();
  settingsTab: SettingsTab | null = null;

  private static _instance: TrayPlugin;

  private _plugin: TrayPlugin | null = null;
  private _tray: ElectronTray | null = null;
  private _childWindows: Set<ElectronBrowserWindow>;

  private static _defaultManifest: PluginManifest = {
    id: 'mycoshiro-tray',
    name: 'Mycoshiro Tray',
    author: 'joelvaneenwyk',
    authorUrl: 'https://joelvaneenwyk.com/',
    description: 'Run Obsidian from the system tray for customizable window management & global quick notes',
    version: '0.3.4',
    isDesktopOnly: true,
    minAppVersion: '1.0.0'
  };

  /**
   * The constructor should always be private to prevent direct
   * construction calls with the `new` operator.
   */
  constructor(app?: App, manifest?: PluginManifest) {
    super(app ?? new App(), manifest ?? TrayPlugin._defaultManifest);
    TrayPlugin._instance = this;
    this._childWindows = new Set<ElectronBrowserWindow>();
  }

  /**
   * The static method that controls the access to the singleton instance.
   *
   * This implementation let you subclass the Globals class while keeping
   * just one instance of each subclass around.
   */
  public static get instance(): TrayPlugin {
    if (!TrayPlugin._instance) {
      TrayPlugin._instance = new TrayPlugin();
    }

    return TrayPlugin._instance;
  }

  public static get settings(): TraySettings {
    return TrayPlugin.instance.settings;
  }

  public static get data(): TraySettingsBase {
    return TrayPlugin.instance.data;
  }

  get plugin(): TrayPlugin | null {
    return this._plugin as TrayPlugin | null;
  }

  public static get plugin(): TrayPlugin | null {
    return TrayPlugin.instance.plugin;
  }

  public static setPlugin(value: TrayPlugin | null) {
    if (TrayPlugin._instance) {
      TrayPlugin._instance._plugin = value;
    }
  }

  private getSettings(): TraySettings {
    return this._plugin?.settings ?? TraySettings.Default;
  }

  public setSetting<T extends TrayOptionType, V extends Value<T> = Value<T>>(data: TrayData<T, V>, value: V) {
    try {
      this._settings.set(data, value);
    } catch (error) {
      logError('Failed to update setting.');
    }
  }

  public get settings(): TraySettings {
    return this._settings;
  }

  public get data(): TraySettingsBase {
    return this._settings.data;
  }

  public getSetting<T extends TrayOptionType, V extends Value<T> = Value<T>>(data: TrayData<T, V>): V {
    return data.value ?? data.default ?? TraySettings.Default.get(data);
  }

  public setTray(value: ElectronTray | null) {
    this._tray = value;
  }

  public getTray() {
    return this._tray as ElectronTray | null;
  }

  public getChildWindows() {
    return this._childWindows;
  }

  public getAllWindows(): ElectronBrowserWindow[] {
    // Return an array of all child windows, plus the current window
    return [...this._childWindows, getCurrentWindow()];
  }

  public addWindow(window: ElectronBrowserWindow) {
    this._childWindows.add(window);
  }

  public deleteWindow(window: ElectronBrowserWindow) {
    this._childWindows.delete(window);
  }

  async onload() {
    logMessage(LOG_LOADING);

    try {
      await this.loadSettings();
      this.settingsTab = new SettingsTab(this.app, this);
      this.addSettingTab(this.settingsTab);
      createTrayIcon();
      registerHotkeys();
      setHideTaskbarIcon();
      setLaunchOnStartup();
      observeChildWindows();

      if (this.data.runInBackground) {
        interceptWindowClose();
      }

      if (this.data.hideOnLaunch) {
        this.app.workspace.onLayoutReady(hideWindows);
      }
    } catch (loadError) {
      logError(`Error loading plugin: ${loadError}`);
    } finally {
      this.addCommand({
        id: 'relaunch-app',
        name: ACTION_RELAUNCH,
        callback: relaunchApp
      });

      this.addCommand({
        id: 'close-vault',
        name: ACTION_CLOSE,
        callback: closeVault
      });
    }
  }

  onunload() {
    logMessage(LOG_CLEANUP);
    unregisterHotkeys();
    allowWindowClose();
    destroyTray();
  }

  async loadSettings() {
    this._settings.set_data(await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this._settings.data);
  }
}

export default TrayPlugin;
