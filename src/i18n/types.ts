import enDictionary from "./dictionaries/en";

type TranslationLeaf = string;
type TranslationNode = TranslationLeaf | { readonly [key: string]: TranslationNode };

type JoinKey<Parent extends string, Child extends string> = `${Parent}.${Child}`;

type LeafKeys<T> = T extends TranslationLeaf
	? never
	: {
		[K in Extract<keyof T, string>]: T[K] extends TranslationLeaf
			? K
			: T[K] extends TranslationNode
				? JoinKey<K, LeafKeys<T[K]>>
				: never
	}[Extract<keyof T, string>];

export type WidenTranslationValues<T> = {
	readonly [K in keyof T]: T[K] extends TranslationLeaf ? string : WidenTranslationValues<T[K]>
};
export type TranslationDictionary = WidenTranslationValues<typeof enDictionary>;
export type TranslationKey = LeafKeys<typeof enDictionary>;
export type TranslationParams = Record<string, string | number | boolean | null | undefined>;
