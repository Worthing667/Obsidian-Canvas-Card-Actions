import enDictionary from "../en";
import errors from "./errors";
import settings from "./settings";
import type { WidenTranslationValues } from "../../types";

const dictionary: WidenTranslationValues<typeof enDictionary> = {
	errors,
	settings
};

export default dictionary;
