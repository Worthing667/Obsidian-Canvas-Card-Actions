import { Notice } from "obsidian";
import { CardPropertiesModal } from "../modals/CardPropertiesModal";
import { SingleCardPropertiesModal } from "../modals/SingleCardPropertiesModal";
import { CardService } from "../../services/CardService";
import { ClipboardAdapter } from "../../adapters/ClipboardAdapter";

export class OpenCardPropertiesCommand {
  constructor(
    private app: any,
    private cardService: CardService,
    private selection: any[],
    private clipboardAdapter: ClipboardAdapter
  ) {}

  async execute(): Promise<void> {
    try {
      // 过滤出文本卡片
      const textCards = this.selection.filter(node => {
        try {
          const data = node.getData && node.getData();
          return data && data.type === "text";
        } catch (error) {
          console.warn("Error getting node data:", error);
          return false;
        }
      });
      
      if (textCards.length === 0) {
        new Notice("请选择至少一个文本卡片");
        return;
      }
      
      // 根据卡片数量选择不同的查看器
      if (textCards.length === 1) {
        // 单卡片使用专门的编辑器
        const modal = new SingleCardPropertiesModal(this.app, textCards[0], this.cardService, this.clipboardAdapter);
        modal.open();
      } else {
        // 多卡片使用批量管理器
        const modal = new CardPropertiesModal(this.app, textCards, this.cardService);
        modal.open();
      }
      
    } catch (error) {
      console.error("打开卡片属性查看器失败:", error);
      new Notice("打开属性查看器失败，请重试");
    }
  }

  canExecute(): boolean {
    if (!this.selection || this.selection.length === 0) {
      return false;
    }
    
    // 检查是否至少有一个文本卡片
    const hasTextCards = this.selection.some(node => {
      try {
        const data = node.getData && node.getData();
        return data && data.type === "text";
      } catch (error) {
        return false;
      }
    });
    
    return hasTextCards;
  }

  getDescription(): string {
    return "查看卡片属性";
  }
}

// 另一个实用命令：快速复制卡片尺寸到剪贴板
export class CopyCardDimensionsCommand {
  constructor(
    private selection: any[]
  ) {}

  async execute(): Promise<void> {
    try {
      const textCards = this.selection.filter(node => {
        const data = node.getData && node.getData();
        return data && data.type === "text";
      });
      
      if (textCards.length === 0) {
        new Notice("请选择至少一个文本卡片");
        return;
      }
      
      // 获取所有卡片的尺寸信息
      const dimensions = textCards.map(card => {
        const data = card.getData();
        return `${data.width}×${data.height}`;
      });
      
      // 去重并排序
      const uniqueDimensions = [...new Set(dimensions)].sort();
      
      // 构建复制内容
      let copyText = "";
      if (uniqueDimensions.length === 1) {
        copyText = `统一尺寸: ${uniqueDimensions[0]}`;
      } else {
        copyText = `尺寸列表:\n${uniqueDimensions.join('\n')}`;
      }
      
      // 复制到剪贴板
      await navigator.clipboard.writeText(copyText);
      new Notice(`已复制 ${textCards.length} 个卡片的尺寸信息`);
      
    } catch (error) {
      console.error("复制尺寸信息失败:", error);
      new Notice("复制失败，请重试");
    }
  }

  canExecute(): boolean {
    const hasTextCards = this.selection.some(node => {
      const data = node.getData && node.getData();
      return data && data.type === "text";
    });
    return this.selection.length > 0 && hasTextCards;
  }

  getDescription(): string {
    return "复制卡片尺寸";
  }
}