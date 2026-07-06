export const SUPPORT_CONTACT_EMAIL = "anitaoskar770@gmail.com";

export function shouldShowSupportQRCodes(language: string): boolean {
	return language === "zh-CN";
}

export function getSupportImageSource(source: string | undefined): string | null {
	if (!source || !source.startsWith("data:image/")) {
		return null;
	}

	return source;
}
