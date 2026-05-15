import { TFile } from "obsidian";
import type { Canvas as CanvasRuntime } from "./canvas";

declare module "obsidian" {
    interface View {
        canvas?: CanvasRuntime;
        file?: TFile | null;
    }
}
