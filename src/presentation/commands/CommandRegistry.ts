import { ICommand } from "./ICommand";

export class CommandRegistry {
    private commands: Map<string, ICommand> = new Map();
    private menuItems: Map<string, any> = new Map();

    registerCommand(id: string, command: ICommand): void {
        this.commands.set(id, command);
    }

    async executeCommand(id: string): Promise<void> {
        const command = this.commands.get(id);
        if (!command) {
            throw new Error(`Command not found: ${id}`);
        }

        if (command.canExecute && !command.canExecute()) {
            return;
        }

        await command.execute();
    }

    getCommand(id: string): ICommand | undefined {
        return this.commands.get(id);
    }

    hasCommand(id: string): boolean {
        return this.commands.has(id);
    }

    registerMenuItem(id: string, menu: any, item: any): void {
        this.menuItems.set(id, { menu, item });
    }

    addCommandToMenu(menu: any, commandId: string, title: string, icon?: string): void {
        const command = this.commands.get(commandId);
        if (!command) {
            console.warn(`Command not found when adding to menu: ${commandId}`);
            return;
        }

        menu.addItem((item: any) => {
            item.setTitle(title);
            if (icon) {
                item.setIcon(icon);
            }
            item.onClick(async () => {
                try {
                    await this.executeCommand(commandId);
                } catch (error) {
                    console.error(`Error executing command ${commandId}:`, error);
                }
            });
        });
    }

    clear(): void {
        this.commands.clear();
        this.menuItems.clear();
    }
}