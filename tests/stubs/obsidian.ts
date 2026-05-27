export class Notice {
  static messages: string[] = [];

  constructor(message: string) {
    Notice.messages.push(message);
  }
}

export class App {}

export class TFile {
  path: string;
  basename: string;
  extension: string;

  constructor(path = 'test.canvas') {
    this.path = path;
    const filename = path.split('/').pop() || path;
    const parts = filename.split('.');
    this.extension = parts.length > 1 ? parts.pop() || '' : '';
    this.basename = parts.join('.') || filename;
  }
}

export class View {}

function createElementStub() {
  return {
    empty: () => undefined,
    addClass: () => undefined,
    removeClass: () => undefined,
    setText: () => undefined,
    createSpan: () => createElementStub(),
    createDiv: () => createElementStub(),
    createEl: () => createElementStub(),
    setAttribute: () => undefined,
    addEventListener: () => undefined,
    appendChild: () => undefined,
  };
}

export class WorkspaceLeaf {
  view: Record<string, unknown> = {};

  async openFile(_file: TFile, _options?: Record<string, unknown>): Promise<void> {}
}

export class ItemView extends View {
  leaf: WorkspaceLeaf;
  contentEl = createElementStub();

  constructor(leaf: WorkspaceLeaf) {
    super();
    this.leaf = leaf;
  }
}

export function setIcon(_el: unknown, _icon: string): void {}

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
