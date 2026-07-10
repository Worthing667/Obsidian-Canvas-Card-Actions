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
		spacing: "Spacing",
		apply: "Apply",
		direction: {
			horizontal: "horizontal",
			vertical: "vertical"
		},
		anchor: {
			label: "Fixed edge",
			left: "fixed left",
			right: "fixed right",
			top: "fixed top",
			bottom: "fixed bottom"
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
	},
	zoomControl: {
		decrease: "Zoom out",
		increase: "Zoom in",
		percentage: "Zoom percentage"
	}
} as const;

export default toolbar;
