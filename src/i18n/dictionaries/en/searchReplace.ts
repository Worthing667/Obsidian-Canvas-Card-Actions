const searchReplace = {
	openInCanvasNotice: "Use find and replace while a Canvas file is open",
	button: {
		open: "Find and replace current Canvas",
		fallbackText: "Find",
		previous: "Previous",
		next: "Next",
		replace: "Replace",
		close: "Close",
		replaceCurrent: "Replace current",
		replaceAll: "Replace all",
		caseSensitive: "Case sensitive",
		regex: "Regular expression"
	},
	input: {
		queryPlaceholder: "Find in current Canvas",
		replacementPlaceholder: "Replace with"
	},
	status: {
		prompt: "Enter text to search the current Canvas. The scope contains {totalCards} text cards.",
		noMatches: "No matches. The scope contains {totalCards} text cards.",
		matches: "Found {totalMatches} matches across {matchedCards} / {totalCards} text cards."
	}
} as const;

export default searchReplace;
