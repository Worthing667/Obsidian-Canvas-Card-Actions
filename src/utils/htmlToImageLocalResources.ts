const TRANSPARENT_IMAGE_DATA_URL =
    "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

export function isDataUrl(url: string): boolean {
    return /^(data:)/.test(url);
}

export function makeDataUrl(content: string, mimeType: string): string {
    return `data:${mimeType};base64,${content}`;
}

export async function fetchAsDataURL(): Promise<never> {
    throw new Error("Remote resources are disabled for Canvas Loom image export.");
}

export async function resourceToDataURL(
    resourceUrl: string,
    _contentType: string,
    options: { imagePlaceholder?: string },
): Promise<string> {
    if (isDataUrl(resourceUrl)) {
        return resourceUrl;
    }

    return options.imagePlaceholder && isDataUrl(options.imagePlaceholder)
        ? options.imagePlaceholder
        : TRANSPARENT_IMAGE_DATA_URL;
}
