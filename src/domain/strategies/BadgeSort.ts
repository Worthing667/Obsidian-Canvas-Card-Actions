import { SortStrategy, BadgedCard } from "./SortStrategy";
import { BadgeData } from "../models/Badge";

export class BadgeSortStrategy implements SortStrategy<BadgedCard> {
    sort(cards: BadgedCard[]): BadgedCard[] {
        return [...cards].sort((a, b) => {
            const aBadge = BadgeData.create(a.badge);
            const bBadge = BadgeData.create(b.badge);
            
            // 按类型优先级排序：number < text < emoji
            const typeOrder = { 'number': 1, 'text': 2, 'emoji': 3 };
            const aTypeOrder = typeOrder[aBadge.type] || 4;
            const bTypeOrder = typeOrder[bBadge.type] || 4;
            
            if (aTypeOrder !== bTypeOrder) {
                return aTypeOrder - bTypeOrder;
            }
            
            // 相同类型内部排序
            if (aBadge.type === 'number') {
                // 数字徽章按数值排序
                const aNum = aBadge.getNumericValue() || 0;
                const bNum = bBadge.getNumericValue() || 0;
                return aNum - bNum;
            } else {
                // 文字和emoji按字典序排序
                return aBadge.content.localeCompare(bBadge.content);
            }
        });
    }
}