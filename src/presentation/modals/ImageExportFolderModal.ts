import { App, Modal, TFolder } from "obsidian";
import { modalT } from "./modalI18n";

export class ImageExportFolderModal extends Modal {
    private readonly folders: TFolder[];
    private readonly resolveSelection: (path: string | null) => void;
    private selectedPath: string;
    private settled = false;

    constructor(
        app: App,
        folders: TFolder[],
        defaultPath: string,
        resolveSelection: (path: string | null) => void,
    ) {
        super(app);
        this.folders = [...folders].sort((left, right) => {
            return left.path.localeCompare(right.path);
        });
        this.selectedPath = this.folders.some((folder) => folder.path === defaultPath)
            ? defaultPath
            : "";
        this.resolveSelection = resolveSelection;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("canvas-loom-folder-picker-modal");
        contentEl.createEl("h2", {
            text: modalT(this.app, "modal.folderPicker.title"),
        });
        contentEl.createDiv({
            cls: "cl-subtitle",
            text: modalT(this.app, "modal.folderPicker.description"),
        });

        const field = contentEl.createDiv({ cls: "cl-section" });
        field.createEl("label", {
            text: modalT(this.app, "modal.folderPicker.label"),
        });
        const select = field.createEl("select");

        for (const folder of this.folders) {
            select.createEl("option", {
                text: folder.path || modalT(this.app, "modal.folderPicker.root"),
                value: folder.path,
            });
        }
        select.value = this.selectedPath;
        select.addEventListener("change", () => {
            this.selectedPath = select.value;
        });

        const footer = contentEl.createDiv({ cls: "cca-action-footer" });
        const cancelButton = footer.createEl("button", {
            text: modalT(this.app, "modal.common.cancel"),
            cls: "cca-btn cca-btn-secondary",
        });
        cancelButton.addEventListener("click", () => this.close());

        const exportButton = footer.createEl("button", {
            text: modalT(this.app, "modal.folderPicker.export"),
            cls: "cca-btn cca-btn-primary mod-cta",
        });
        exportButton.addEventListener("click", () => {
            this.settle(this.selectedPath);
            this.close();
        });
    }

    onClose(): void {
        this.contentEl.empty();
        if (!this.settled) {
            this.settle(null);
        }
    }

    private settle(path: string | null): void {
        if (this.settled) {
            return;
        }

        this.settled = true;
        this.resolveSelection(path);
    }
}

export function pickImageExportFolder(
    app: App,
    folders: TFolder[],
    defaultPath: string,
): Promise<string | null> {
    return new Promise((resolve) => {
        new ImageExportFolderModal(app, folders, defaultPath, resolve).open();
    });
}
