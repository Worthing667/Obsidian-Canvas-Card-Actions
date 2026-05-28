const modal = {
	common: {
		cancel: "Cancel",
		close: "Close",
		confirm: "OK",
		applyChanges: "Apply",
		width: "Width",
		height: "Height",
		aspectRatio: "Lock ratio",
		listSeparator: ", ",
		emptyCard: "[Empty]",
		emptyCardTitle: "Empty card"
	},
	badge: {
		title: "Set badge",
		label: "Badge number:",
		placeholder: "Example: 1, 2.1, 10.3.2",
		hint: "Badges are saved in the Canvas file.",
		remove: "Remove badge",
		validation: {
			empty: "Leave blank to remove it, or use Remove badge.",
			valid: "Hierarchical numbers are supported, such as 1, 2.1, 10.3.2.",
			invalid: "Use numeric badge numbers only, such as 1, 2, or 2.1."
		}
	},
	batchBadge: {
		title: "Set badges in bulk",
		summary: "Cards will be numbered by Canvas position order. Selected cards: {count}.",
		startLabel: "Start badge:",
		removeSelected: "Remove selected badges",
		add: "Add badges",
		validation: {
			noCards: "The current selection has no text cards that can be badged.",
			invalid: "Use numeric badge numbers only, such as 1, 2, or 2.1.",
			valid: "Hierarchical badges increment the last segment, such as 2.1, 2.2, 2.3."
		},
		preview: "Preview: {preview}"
	},
	split: {
		title: "Split card",
		summary: "Choose how to split the current card. Content length: {count} characters.",
		empty: "No split methods are available for this card. Add a delimiter or Markdown headings first.",
		unsetDelimiter: "(not set)",
		byDelimiter: {
			title: "Split by delimiter",
			available: "Use delimiter \"{delimiter}\" to create {count} cards.",
			unavailable: "No usable delimiter \"{delimiter}\" was found."
		},
		byBlankLine: {
			title: "Split by blank lines",
			available: "Split paragraphs separated by blank lines into {count} cards.",
			unavailable: "No blank lines are available for splitting."
		},
		byHeading: {
			title: "Split by headings",
			unavailable: "No Markdown heading levels are available for splitting.",
			optionTitle: "Split by {levelLabel} headings",
			optionDescription: "Create {count} cards. Deeper headings stay in their parent cards."
		},
		headingLevel: {
			one: "level 1",
			two: "level 2",
			three: "level 3",
			four: "level 4",
			five: "level 5",
			six: "level 6",
			fallback: "level {level}"
		}
	},
	dragSort: {
		defaultTitle: "Manual copy order",
		defaultDescription: "Drag cards to adjust the copy order. Cards: {count}.",
		copy: "Copy",
		copied: "Copied {count} cards in manual order.",
		reset: "Reset order",
		resetDone: "Order reset.",
		manualMergeTitle: "Manual merge order",
		manualMergeDescription: "Drag cards to adjust the merge order. Cards: {count}.",
		addAsCard: "Add as card",
		previewGroup: "Preview group",
		newDocument: "New document"
	},
	singleProperties: {
		title: "Card properties",
		subtitle: "View and adjust the size of the current card.",
		previewTitle: "Content preview",
		currentSize: "Current size",
		widthByHeight: "Width x height",
		positionCoordinates: "Position",
		canvasCoordinates: "Canvas coordinates",
		resizeTitle: "Resize",
		hint: "Click Apply to write changes to the Canvas.",
		copySize: "Copy size",
		copyPosition: "Copy position",
		clipboardSize: "Card size: {width} x {height} px",
		clipboardPosition: "Card position: X: {x}, Y: {y}",
		notice: {
			sizeCopied: "Size copied to clipboard.",
			positionCopied: "Position copied to clipboard.",
			sizeUpdated: "Card size updated to {width}x{height}px.",
			updateFailed: "Update failed: {message}"
		}
	},
	properties: {
		title: "Card properties",
		subtitle: "{count} cards selected. You can review and resize them in bulk.",
		summary: {
			selected: "Selected",
			selectedValue: "{count} cards",
			sortedByPosition: "Sorted by position",
			size: "Size",
			widthRange: "W {min}–{max} px",
			heightAverage: "H {min}–{max}, avg {avgWidth} x {avgHeight}",
			position: "Position"
		},
		list: {
			title: "Card list",
			meta: "{count} items",
			preview: "Preview",
			size: "Size",
			position: "Position",
			badge: "Badge"
		},
		batch: {
			title: "Resize",
			meta: "Presets fill the size fields below",
			presets: "Size presets",
			minSize: "Min",
			maxSize: "Max",
			avgSize: "Average",
			customSize: "Custom size",
			noChange: "No change",
			hint: "Leave a field blank to keep that dimension. Valid range: 50-2000 px."
		},
		copy: {
			size: "Copy size",
			summary: "Copy summary",
			sizeHeader: "Batch card sizes ({count} cards):",
			statsHeader: "Card statistics:",
			statsCount: "Count: {count} cards",
			statsSizeRange: "Size range: W {minWidth}-{maxWidth}px, H {minHeight}-{maxHeight}px",
			statsAverage: "Average size: {avgWidth} x {avgHeight}px",
			statsPositionRange: "Position range: X: {minX}-{maxX}, Y: {minY}-{maxY}"
		},
		notice: {
			sizesCopied: "All card sizes copied to clipboard.",
			statsCopied: "Statistics copied to clipboard.",
			unifyFailed: "Resize failed: {message}",
			unified: "All cards resized to {width}x{height}.",
			requireWidthOrHeight: "Enter at least one width or height value.",
			calculatedOutOfRange: "The calculated size is outside the valid range (50-2000 px).",
			sizeOutOfRange: "Size must be within 50-2000 px.",
			widthOutOfRange: "Width must be within 50-2000 px.",
			heightOutOfRange: "Height must be within 50-2000 px.",
			enterSize: "Enter the width and/or height to adjust.",
			widthFailed: "Width update failed: {message}",
			heightFailed: "Height update failed: {message}"
		}
	}
} as const;

export default modal;
