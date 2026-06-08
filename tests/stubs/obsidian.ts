export class Notice {
  static messages: string[] = [];

  constructor(message: string) {
    Notice.messages.push(message);
  }
}

export class App {}

export class View {}

export class ItemView {
  contentEl: any;
  app: any;

  constructor(public leaf: any) {
    this.app = leaf?.app || {};
    this.contentEl = {
      empty: () => undefined,
      addClass: () => undefined,
    };
  }
}

export const moment = {
  locale: () => 'en',
};

export function setIcon(_el: unknown, _icon: string): void {}
