export class Validators {
    static isNonEmptyString(value: any): value is string {
        return typeof value === 'string' && value.trim().length > 0;
    }

    static isValidPosition(pos: any): pos is { x: number, y: number } {
        return pos && 
               typeof pos.x === 'number' && 
               typeof pos.y === 'number' && 
               !isNaN(pos.x) && 
               !isNaN(pos.y);
    }

    static isValidDimensions(dims: any): dims is { width: number, height: number } {
        return dims && 
               typeof dims.width === 'number' && 
               typeof dims.height === 'number' && 
               dims.width > 0 && 
               dims.height > 0 &&
               !isNaN(dims.width) && 
               !isNaN(dims.height);
    }

    static isTextNode(node: any): boolean {
        return node && 
               node.getData && 
               node.getData().type === 'text' && 
               this.isNonEmptyString(node.getData().text);
    }

    static hasValidCanvas(node: any): boolean {
        return node && 
               node.canvas && 
               typeof node.canvas.getData === 'function' && 
               typeof node.canvas.setData === 'function';
    }

    static isValidNodeId(id: any): id is string {
        return typeof id === 'string' && id.length > 0;
    }

    static isValidDelimiter(delimiter: any): delimiter is string {
        return typeof delimiter === 'string' && delimiter.length > 0;
    }

    static containsDelimiter(text: string, delimiter: string): boolean {
        return this.isNonEmptyString(text) && 
               this.isValidDelimiter(delimiter) && 
               text.includes(delimiter);
    }

    static isValidSortPriority(priority: any): priority is 'yx' | 'xy' {
        return priority === 'yx' || priority === 'xy';
    }

    static isValidBadgeType(type: any): type is 'number' | 'text' | 'emoji' {
        return type === 'number' || type === 'text' || type === 'emoji';
    }
}