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
	}
} as const;

export default toolbar;
