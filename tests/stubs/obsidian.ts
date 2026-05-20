export class Notice {
  static messages: string[] = [];

  constructor(message: string) {
    Notice.messages.push(message);
  }
}

export class App {}

export class Modal {
  contentEl = {
    empty: () => undefined,
    createEl: () => ({
      addEventListener: () => undefined,
      createSpan: () => undefined,
      setAttribute: () => undefined,
    }),
    createDiv: () => ({
      createEl: () => undefined,
      createDiv: () => undefined,
      addEventListener: () => undefined,
      setText: () => undefined,
    }),
  };

  constructor(_app: App) {}

  open(): void {}

  close(): void {}
}
