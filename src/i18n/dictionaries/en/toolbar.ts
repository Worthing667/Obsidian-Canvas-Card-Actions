const toolbar = {
	autoHeight: {
		label: "Auto height",
		fallbackText: "H"
	},
	arrange: {
		label: "Arrange spacing",
		fallbackText: "Space",
		horizontalSpacing: "Horizontal spacing",
		verticalSpacing: "Vertical spacing",
		adjust: "Adjust",
		direction: {
			horizontal: "horizontal",
			vertical: "vertical"
		}
	},
	sequenceTools: {
		label: "Number tools",
		fallbackText: "No.",
		single: {
			summaryWithBadge: "Current badge: {badge}",
			summaryWithoutBadge: "This card has no badge",
			setNumber: "Set number...",
			remove: "Remove badge"
		},
		multiple: {
			summary: "{selectedCount} cards selected, {badgeCount} with badges",
			batchNumber: "Number cards...",
			remove: "Remove {count} badges"
		}
	}
} as const;

export default toolbar;
