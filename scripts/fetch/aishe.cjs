const { makeFetcher } = require("./indicator-code.cjs");

const config = {
  datasetId: "AISHE",
  title: "All India Survey on Higher Education",
  apiBase: "https://api.mospi.gov.in/api/aishe/getAisheRecords",
  rawSubdir: "aishe",
  codeParamName: "indicator_code",
  defaultCodes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
};

if (require.main === module) {
  makeFetcher(config)().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { main: () => makeFetcher(config)() };
