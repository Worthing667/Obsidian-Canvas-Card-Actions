import { App, SuggestModal, TFolder } from "obsidian";
import { modalT } from "./modalI18n";

export class FolderSuggestModal extends SuggestModal<TFolder> {
    private readonly folders: TFolder[];
    private readonly resolveSelection: (path: string | null) => void;
    private settled = false;

    constructor(
        app: App,
        folders: TFolder[],
        defaultPath: string,
        resolveSelection: (path: string | null) => void,
    ) {
        super(app);
        this.folders = [...folders].sort((left, right) => {
            if (left.path === defaultPath) return -1;
            if (right.path === defaultPath) return 1;
            return left.path.localeCompare(right.path);
        });
        this.resolveSelection = resolveSelection;
        this.setPlaceholder(modalT(app, "modal.folderPicker.placeholder"));
        this.emptyStateText = modalT(app, "modal.folderPicker.empty");
    }

    getSuggestions(query: string): TFolder[] {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        if (!normalizedQuery) {
            return this.folders;
        }

        return this.folders.filter((folder) => folder.path.toLocaleLowerCase().includes(normalizedQuery));
    }

    renderSuggestion(folder: TFolder, element: HTMLElement): void {
        element.setText(folder.path || modalT(this.app, "modal.folderPicker.root"));
    }

    onChooseSuggestion(folder: TFolder): void {
        this.settle(folder.path);
        this.close();
    }

    onClose(): void {
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
        new FolderSuggestModal(app, folders, defaultPath, resolve).open();
    });
}
