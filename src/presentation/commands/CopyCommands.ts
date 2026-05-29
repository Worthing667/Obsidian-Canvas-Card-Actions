import { ICommand } from "./ICommand";
import { IContentService } from "../../services/ContentService";
import type { CanvasNode } from "../../types/canvas";
import { t } from "../../i18n";
import type CanvasLoomSettings from "../../settings/ICanvasLoomSettings";

export class CopySingleCardCommand implements ICommand {
    constructor(
        private contentService: IContentService,
        private node: CanvasNode,
        private settings?: Partial<CanvasLoomSettings>
    ) {}

    async execute(): Promise<void> {
        await this.contentService.copySingleCardContent(this.node);
    }

    canExecute(): boolean {
        return !!this.node.text;
    }

    getDescription(): string {
        return t("commands.copyCardContent", undefined, { settings: this.settings });
    }
}
