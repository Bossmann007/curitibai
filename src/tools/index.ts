import { datasetFiles } from "./datasetFiles.js";
import { healthUnitsSearch } from "./healthUnitsSearch.js";
import { localCsvSummary } from "./localCsvSummary.js";
import { openDatasetsSearch } from "./openDatasetsSearch.js";

export const tools = [openDatasetsSearch, datasetFiles, healthUnitsSearch, localCsvSummary] as const;
