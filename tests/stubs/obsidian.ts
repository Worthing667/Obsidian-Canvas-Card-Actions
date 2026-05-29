export class Notice {
  static messages: string[] = [];

  constructor(message: string) {
    Notice.messages.push(message);
  }
}

export class App {}

export class View {}

export const moment = {
  locale: () => 'en',
};

export function setIcon(_el: unknown, _icon: string): void {}
