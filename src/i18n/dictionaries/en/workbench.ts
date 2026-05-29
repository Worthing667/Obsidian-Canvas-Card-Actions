const workbench = {
	title: "Loom workbench",
	scope: {
		selection: "Current selection",
		canvas: "Current Canvas",
		waiting: "Waiting for card group"
	},
	colorGroup: {
		sameColor: "Same-color card group",
		noColor: "Cards without a color",
		multipleColors: "Same-color card group ({count} types)"
	},
	fileName: {
		mergedCards: "Merged cards"
	},
	tab: {
		preview: "Preview",
		sort: "Sort",
		find: "Find"
	},
	button: {
		clear: "Clear",
		clearWorkbench: "Clear workbench",
		viewPreview: "View preview",
		copy: "Copy",
		addAsCard: "Add as new card",
		newDocument: "New document",
		replaceCurrent: "Replace current",
		replaceCard: "Replace current card",
		replaceAll: "Replace all"
	},
	count: {
		textCards: "text cards",
		workbenchCards: "workbench cards"
	},
	panel: {
		previewTitle: "Card group preview",
		previewWaiting: "Waiting for cards to render into the workbench.",
		previewReady: "The current content is generated from the workbench order; output buttons use the same result.",
		snapshot: "Snapshot {count} cards",
		currentOrder: "Current order {order}",
		orderDescription: ", {description}",
		emptyList: "Select multiple text cards, then use the right-click menu \"Preview card group\" to load the current selection.",
		renderingPreview: "Generating preview...",
		emptyPreview: "No content to preview",
		findUnavailable: "Open the workbench from a Canvas before using find and replace."
	},
	sortMode: {
		position: "Position",
		badge: "Badge"
	},
	find: {
		label: {
			query: "Find",
			replacement: "Replace with",
			caseSensitive: "Case sensitive",
			regex: "Regex"
		},
		placeholder: {
			query: "Enter text to find",
			replacement: "Leave empty to replace with nothing"
		},
		status: {
			promptSelection: "Enter text to search {scope}.",
			promptCanvas: "Enter text to search the current Canvas.",
			noMatches: "No matches. The scope contains {totalCards} text cards.",
			matches: "Found {totalMatches} matches across {matchedCards} / {totalCards} text cards. Current {currentLabel}."
		},
		result: {
			waiting: "Waiting for search text.",
			noCards: "No matching cards."
		},
		subtitle: {
			selection: "Searching {scope}.",
			canvas: "Searching the current Canvas.",
			canvasNoSelection: "No text cards are selected, so search will run across the whole Canvas."
		}
	},
	source: {
		findReplace: "Find & Replace"
	},
	order: {
		manualSuffix: "{label} + manual adjustments",
		position: "Position",
		badge: "Badge",
		badgeManualTitle: "Badge order with manual adjustments",
		badgeTitle: "Badge order",
		positionManualTitle: "Position order with manual adjustments",
		positionTitle: "Position order"
	},
	sortDescription: {
		empty: "The workbench generates output after receiving card snapshots",
		manual: "The dragged order is used directly for copy, new card, and new document",
		badge: "Cards with the same badge continue to follow Canvas position order",
		xy: "Z order: left to right, then top to bottom",
		yx: "Reverse N order: top to bottom, then left to right"
	},
	aria: {
		dragHandle: "Drag to adjust order"
	}
} as const;

export default workbench;
