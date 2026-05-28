import enToolbar from "../en/toolbar";
import type { WidenTranslationValues } from "../../types";

const toolbar: WidenTranslationValues<typeof enToolbar> = {
	autoHeight: {
		label: "自适应高度",
		fallbackText: "高"
	},
	arrange: {
		label: "整理间距",
		fallbackText: "间距",
		horizontalSpacing: "水平间距",
		verticalSpacing: "垂直间距",
		adjust: "调整",
		direction: {
			horizontal: "水平",
			vertical: "垂直"
		}
	}
};

export default toolbar;
