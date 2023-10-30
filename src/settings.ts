/**
 * obsidian-tray v0.3.3
 * (c) 2023 Joel Van Eenwyk <joel.vaneenwyk@gmail.com> (https://joelvaneenwyk.com/)
 * (c) 2023 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/obsidian-tray/) under the MIT license
 */

import { Setting } from 'obsidian';
import { LogLevels } from './logger';
import { TrayPlugin, htmlToFragment, keyToLabel } from './main';

export const DEFAULT_DATE_FORMAT: string = 'YYYY-MM-DD';

// 16x16 base64 obsidian icon: generated from obsidian.asar/icon.png
export const OBSIDIAN_BASE64_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAHZSURBVDhPlZKxTxRBFMa/XZcF7nIG7mjxjoRCwomJxgsFdhaASqzQxFDzB1AQKgstLGxIiBQGJBpiCCGx8h+wgYaGgAWNd0dyHofeEYVwt/PmOTMZV9aDIL/s5pvZvPfN9yaL/+HR3eXcypta0m4juFbP5GHuXc9IbunDFc9db/G81/ZzhDMN7g8td47mll4R5BfHwZN4LOaA+fHa259PbUmIYzWkt3e2NZNo3/V9v1vvU6kkstk+tLW3ItUVr/m+c3N8MlkwxYqmBFcbwUQQCNOcyVzDwEAWjuPi5DhAMV/tKOYPX5hCyz8Gz1zX5SmWjBvZfmTSaRBJkGAIoxJHv+pVW2yIGNxOJ8bUVNcFEWLxuG1ia6JercTbttwQTeDwPS0kCMXiXtgk/jQrFUw7ptYSMWApF40yo/ytjHq98fdk3ayVE+cn2CxMb6ruz9qAJKFUKoWza1VJSi/n0+ffgYHdWW2gHuxXymg0gjCB0sjpmiaDnkL3RzDyzLqBUKns2ztQqUR0fk2TwSrGSf1eczqF5vsPZRCQSSAFLk6gqctgQRkc6TWRQLV2YMYQki9OoNkqzFQ9r+WOGuW5CrJbOzyAlPKr6MSGLbkcDwbf35oY/jRkt6cAfgNwowruAMz9AgAAAABJRU5ErkJggg==';

export type TrayDataValue = boolean | string | number;

export enum TrayOptionType {
  Text,
  Hotkey,
  Moment,
  Image,
  Toggle
}
export type Value<IV extends TrayOptionType> = IV extends TrayOptionType.Text
  ? string
  : IV extends TrayOptionType.Hotkey
  ? string
  : IV extends TrayOptionType.Moment
  ? string
  : IV extends TrayOptionType.Image
  ? string
  : IV extends TrayOptionType.Toggle
  ? boolean
  : never;

export interface ITrayOptionData<TOption extends TrayOptionType, TOptionValue extends Value<TOption>> {
  key: string;
  desc?: string;
  type: TOption;
  default?: TOptionValue;
  onChange?: () => void;
  postprocessor?: (input: string) => string;
  onBeforeChange?: () => void;
  placeholder?: string;
}

export class TrayData<T extends TrayOptionType = TrayOptionType, V extends Value<T> = Value<T>>
  implements ITrayOptionData<T, V>
{
  public readonly key: string;
  public readonly desc?: string;
  public readonly type: T;
  public readonly default?: V;
  public placeholder?: string;

  public readonly onChange?: () => void;
  public readonly postprocessor?: (input: string) => string;
  public readonly onBeforeChange?: () => void;

  constructor(data: ITrayOptionData<T, V>) {
    if (!data) {
      throw new Error('TrayOptionData can not be initialized without data');
    }
    const tray_data = data as ITrayOptionData<T, V>;
    this.key = tray_data.key;
    this.desc = tray_data.desc;
    this.type = tray_data.type;
    this.default = tray_data.default as V;
    this.onChange = tray_data.onChange;
    this.postprocessor = tray_data.postprocessor;
    this.onBeforeChange = tray_data.onBeforeChange;
  }

  public assign(data: any): void {
    Object.assign(this, TraySettings.Default, data);
  }

  public get description(): string {
    return this.desc ?? this.key;
  }

  public get is_header(): boolean {
    return this.type === undefined;
  }

  public get value(): V {
    return TrayPlugin.instance.getSetting<T, V>(this);
  }

  public set value(value: V) {
    TrayPlugin.instance.setSetting<T, V>(this, value);
  }

  public get str(): string {
    return this.value.toString();
  }

  public get bool(): boolean {
    return this.value as boolean;
  }

  private _set(setting: Setting): void {
    if (this.is_header) {
      setting.setName(this.key);
      setting.setHeading();
    }
  }

  public set(setting: Setting): void {
    this._set(setting);

    if (!this.is_header) {
      if (this.default) {
        this.placeholder ??= `Example: ${this.default}`;
      }

      setting.setName(keyToLabel(this.key));
      setting.setDesc(htmlToFragment(this.description));

      const onChange = async (value: V) => {
        this.onBeforeChange?.();
        TrayPlugin.instance.setSetting(this, value);
        await TrayPlugin.plugin?.saveSettings();
        this.onChange?.();
      };

      if (this.type === TrayOptionType.Toggle) {
        setting.addToggle((toggle) => {
          toggle.setValue(this.bool).onChange((value) => onChange(value as V));
        });
      } else if (this.type === TrayOptionType.Image) {
        const previewImg = setting.descEl.querySelector<HTMLImageElement>('img[data-preview');
        if (previewImg) {
          previewImg.src = this.str;
        }
        const fileUpload: HTMLInputElement = setting.descEl.createEl('input');
        fileUpload.style.visibility = 'hidden';
        fileUpload.type = 'file';
        fileUpload.onchange = (event: Event) => {
          if (event.target instanceof HTMLInputElement && event.target.files != null) {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
              onChange(reader.result as V);
              if (previewImg != null && reader.result != null && reader.result) {
                previewImg.src = reader.result.toString();
              }
            };
            reader.readAsDataURL(file);
          }
        };
        setting.addButton((button) => {
          button.setIcon('image').onClick(() => fileUpload.click());
        });
      } else if (this.type === TrayOptionType.Moment) {
        setting.addMomentFormat((moment) => {
          const previewEl = setting.descEl.querySelector<HTMLElement>('[data-preview]');
          if (previewEl) {
            moment.setSampleEl(previewEl);
          }
          moment
            .setPlaceholder(this.placeholder?.toString() ?? '')
            .setDefaultFormat(this.default?.toString() ?? '')
            .setValue(this.str)
            .onChange((value) => onChange(value as V));
        });
      } else {
        const previewEl = setting.descEl.querySelector<HTMLElement>('[data-preview]');
        const updatePreview = (value: string) => {
          if (previewEl && this.postprocessor != undefined) {
            previewEl.innerText = this.postprocessor(value);
          }
        };

        updatePreview(this.str);
        setting.addText((text) => {
          text
            .setPlaceholder(this.placeholder?.toString() ?? '')
            .setValue(this.str)
            .onChange((value) => [onChange(value as V), updatePreview(value)]);
        });
      }
    }
  }
}

export type TrayOption = TrayData<TrayOptionType>;

interface Api<T extends TrayDataValue> {
  [key: string]: T;
}

type ITraySettings = Api<TrayDataValue> & {
  createTrayIcon: boolean;
  hideOnLaunch: boolean;
  hideTaskbarIcon: boolean;
  launchOnStartup: boolean;
  logLevel: string;
  quickNoteDateFormat: string;
  quickNoteHotkey: string;
  quickNoteLocation: string;
  runInBackground: boolean;
  toggleWindowFocusHotkey: string;
  trayIconImage: string;
  trayIconTooltip: string;
};

const DEFAULT_SETTINGS: ITraySettings = {
  createTrayIcon: false,
  hideOnLaunch: false,
  hideTaskbarIcon: false,
  launchOnStartup: false,
  logLevel: LogLevels.ERROR,
  quickNoteDateFormat: DEFAULT_DATE_FORMAT,
  quickNoteHotkey: 'CmdOrCtrl+Shift+Q',
  quickNoteLocation: 'Notes',
  runInBackground: false,
  toggleWindowFocusHotkey: 'Meta+Shift+Home',
  trayIconImage: OBSIDIAN_BASE64_ICON,
  trayIconTooltip: ''
};

export class TraySettingsBase implements ITraySettings {
  [key: string]: TrayDataValue;

  public createTrayIcon: boolean;
  public hideOnLaunch: boolean;
  public hideTaskbarIcon: boolean;
  public launchOnStartup: boolean;
  public logLevel: string;
  public quickNoteDateFormat: string;
  public quickNoteHotkey: string;
  public quickNoteLocation: string;
  public runInBackground: boolean;
  public toggleWindowFocusHotkey: string;
  public trayIconImage: string;
  public trayIconTooltip: string;

  constructor(settings: ITraySettings) {
    this.createTrayIcon = settings.createTrayIcon;
    this.hideOnLaunch = settings.hideOnLaunch;
    this.hideTaskbarIcon = settings.hideTaskbarIcon;
    this.launchOnStartup = settings.launchOnStartup;
    this.logLevel = settings.logLevel;
    this.quickNoteDateFormat = settings.quickNoteDateFormat;
    this.quickNoteHotkey = settings.quickNoteHotkey;
    this.quickNoteLocation = settings.quickNoteLocation;
    this.runInBackground = settings.runInBackground;
    this.toggleWindowFocusHotkey = settings.toggleWindowFocusHotkey;
    this.trayIconImage = settings.trayIconImage;
    this.trayIconTooltip = settings.trayIconTooltip;
  }
}

export class TraySettings {
  private _data: TraySettingsBase;

  public static readonly Default = new TraySettings(DEFAULT_SETTINGS);

  public get data(): ITraySettings {
    return this._data;
  }

  public static get default(): ITraySettings {
    return TraySettings.Default.data;
  }

  constructor(settings?: ITraySettings) {
    this._data = new TraySettingsBase(settings ?? TraySettings.default);
  }

  public get<TT extends TrayOptionType, VV extends Value<TT> = Value<TT>>(data: TrayData<TT, VV>): VV {
    return this._data[data.key] as VV;
  }

  public set<TT extends TrayOptionType, VV extends Value<TT> = Value<TT>>(data: TrayData<TT, VV>, value: VV): void {
    this._data[data.key] = value;
  }

  public set_data(data: any): void {
    try {
      Object.assign(this._data, TraySettings.default, data);
    } catch (error) {
      // ignore
    }
  }
}
