export interface ICommand {
    execute(): Promise<void>;
    undo?(): Promise<void>;
    canExecute?(): boolean;
    getDescription?(): string;
}