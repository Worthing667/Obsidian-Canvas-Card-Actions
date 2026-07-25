import { Notice, TFile } from "obsidian";
import type { CanvasNode } from "../../types/canvas";
import type { IWorkbenchImageExportService } from "../../services/WorkbenchImageExportService";
import { t } from "../../i18n";
import type { ICommand } from "./ICommand";

export type SelectImageExportFolder = (canvasFile: TFile) => Promise<string | null>;

export class ExportSingleCardAsImageCommand implements ICommand {
    constructor(
        private imageExportService: IWorkbenchImageExportService,
        private node: CanvasNode,
        private canvasFile: TFile | null,
        private selectImageExportFolder: SelectImageExportFolder,
    ) {}

    async execute(): Promise<void> {
        if (!this.canvasFile || this.canvasFile.extension !== "canvas") {
            new Notice(t("notice.useWithOpenCanvasFile"));
            return;
        }

        const nodeElement = this.node.nodeEl;
        if (!nodeElement) {
            new Notice(t("notice.cardImageExportFailed"));
            return;
        }

        try {
            const outputFolderPath = await this.selectImageExportFolder(this.canvasFile);
            if (outputFolderPath === null) {
                return;
            }

            const file = await this.imageExportService.exportPreview(
                nodeElement,
                this.canvasFile,
                1,
                outputFolderPath,
            );
            new Notice(t("notice.cardImageExported", { filePath: file.path }));
        } catch (error) {
            console.error("Failed to export single card as an image:", error);
            new Notice(t("notice.cardImageExportFailed"));
        }
    }
}
