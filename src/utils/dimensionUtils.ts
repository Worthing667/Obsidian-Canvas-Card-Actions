/**
 * Canvas Card Actions 插件通用工具函数
 */

/**
 * 验证尺寸是否在合理范围(50-2000像素)内
 */
export function validateDimension(value: number): boolean {
    return !isNaN(value) && value >= 50 && value <= 2000;
}
