import enDictionary from "../en";
import commands from "./commands";
import errors from "./errors";
import menu from "./menu";
import modal from "./modal";
import notice from "./notice";
import searchReplace from "./searchReplace";
import settings from "./settings";
import toolbar from "./toolbar";
import workbench from "./workbench";
import type { WidenTranslationValues } from "../../types";

const dictionary: WidenTranslationValues<typeof enDictionary> = {
	commands,
	errors,
	menu,
	modal,
	notice,
	searchReplace,
	settings,
	toolbar,
	workbench
};

export default dictionary;
