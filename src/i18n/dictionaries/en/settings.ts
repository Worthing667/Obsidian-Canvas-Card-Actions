const settings = {
	language: {
		name: "Language",
		desc: "Choose the Canvas-Loom interface language.",
		option: {
			auto: "Auto",
			en: "English",
			zhCN: "Simplified Chinese"
		}
	},
	canvasCardDelimiter: {
		name: "Canvas card delimiter",
		desc: "Enter the delimiter used to split a single Canvas card. It can also be inserted between cards when merging."
	},
	insertDelimiterOnMerge: {
		name: "Insert delimiter when merging",
		desc: "When enabled, quick copy, merge, new document, and workbench output insert the current delimiter between adjacent cards."
	},
	splitCardsPerRow: {
		name: "Cards per row after splitting",
		desc: "Controls the maximum number of cards per row after splitting a single card, including the original card. Extra cards wrap to the next row and move down based on card height and spacing. Enter an integer from {min} to {max}."
	},
	sortPriority: {
		name: "Card sort priority",
		desc: "Choose the reading direction when sorting multiple cards by position.",
		option: {
			yx: "Reverse N order (top to bottom, then left to right)",
			xy: "Z order (left to right, then top to bottom)"
		}
	},
	enableBadges: {
		name: "Show badges",
		desc: "Show numeric badges in the top-right corner of Canvas cards. Turning this off does not delete existing badges."
	},
	showEdgesAboveCards: {
		name: "Show edges above cards",
		desc: "When idle, show Canvas edges above regular cards. Selected or edited cards temporarily stay above edges so text editing is not disrupted. Canvas files are not modified."
	},
	disableCanvasLabelFontSizeRelativeToZoom: {
		name: "Keep edge labels and group titles readable",
		desc: "Use Advanced Canvas-style zoom compensation so edge labels and group titles keep a readable size while zooming."
	},
	defaultSortMode: {
		name: "Quick action sort mode",
		desc: "Choose whether quick copy and quick merge use position order or badge order by default.",
		option: {
			position: "Position order",
			badge: "Badge order"
		}
	},
	mergeCleanupMode: {
		name: "After merge",
		desc: "Choose whether to keep the original cards after quick merge.",
		option: {
			keepSource: "Create merged card and keep originals",
			deleteSource: "Create merged card and delete originals"
		}
	},
	enablePerformanceMode: {
		name: "Enable Canvas performance mode",
		desc: "Reduce Canvas-Loom's additional rendering overhead in large Canvas files."
	},
	enablePerformanceDiagnostics: {
		name: "Enable performance diagnostic logs",
		desc: "Output Canvas-Loom operation timings and node statistics to the developer console."
	},
	largeCanvasNodeThreshold: {
		name: "Large Canvas threshold",
		desc: "When the node count reaches this value, badge loading is processed in batches."
	},
	badgeUpdateDebounceMs: {
		name: "Badge refresh delay",
		desc: "Controls the wait time before refreshing badge display, in milliseconds."
	}
} as const;

export default settings;
