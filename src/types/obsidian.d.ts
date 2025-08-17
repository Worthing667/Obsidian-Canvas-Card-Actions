import { View } from 'obsidian';
import { Canvas } from 'obsidian/canvas';

declare module 'obsidian' {
    interface View {
        canvas?: Canvas;
        getViewType(): string;
    }
    
    interface WorkspaceLeaf {
        view: View & {
            canvas?: Canvas;
        };
    }
}