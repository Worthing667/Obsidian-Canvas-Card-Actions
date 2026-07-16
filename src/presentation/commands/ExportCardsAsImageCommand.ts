import { Notice, type TFile } from "obsidian";
import type CanvasLoomSettings from "../../settings/ICanvasLoomSettings";
import {
    CardImageExportError,
    type CardImageExportService,
    selectExportableTextNodes,
} from "../../services/CardImageExportService";
import type { CanvasNode } from "../../types/canvas";
import { t } from "../../i18n";
import { isCanvasNodeEditing } from "../../utils/canvasEditingState";
import type { ICommand } from "./ICommand";

type CardImageExportExecutor = Pick<CardImageExportService, "exportSelection">;

export class ExportCardsAsImageCommand implements ICommand {
    constructor(
        private service: CardImageExportExecutor,
        private selection: CanvasNode[],
        private canvasFile: TFile | null,
        private settings?: Partial<CanvasLoomSettings>,
    ) {}

    async execute(): Promise<void> {
        try {
            const result = await this.service.exportSelection(this.selection, this.canvasFile);
            new Notice(t("notice.cardImageExported", {
                count: result.nodeCount,
                filePath: result.file.path,
            }, { settings: this.settings }));
        } catch (error) {
            console.error("Failed to export cards as an image:", error);
            new Notice(this.getFailureMessage(error));
        }
    }

    canExecute(): boolean {
        const nodes = selectExportableTextNodes(this.selection);
        return this.canvasFile?.extension === "canvas"
            && nodes.length > 0
            && !nodes.some((node) => isCanvasNodeEditing(node));
    }

    getDescription(): string {
        return t("commands.exportSelectedCardsAsImage", undefined, { settings: this.settings });
    }

    private getFailureMessage(error: unknown): string {
        if (!(error instanceof CardImageExportError)) {
            return t("errors.cardImageExportFailed", undefined, { settings: this.settings });
        }

        const errorKeys = {
            "no-text-cards": "errors.cardImageExportNoTextCards",
            "editing-card": "errors.cardImageExportEditing",
            "missing-canvas-file": "errors.cardImageExportMissingCanvasFile",
            "unsupported-canvas-runtime": "errors.cardImageExportUnsupported",
            "unmounted-card": "errors.cardImageExportUnmountedCard",
        } as const;

        return t(errorKeys[error.code], undefined, { settings: this.settings });
    }
}
