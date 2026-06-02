const { makeFetcher } = require("./indicator-code.cjs");

const config = {
  datasetId: "RBI",
  title: "Reserve Bank of India Statistics",
  apiBase: "https://api.mospi.gov.in/api/rbi/getRbiRecords",
  rawSubdir: "rbi",
  codeParamName: "sub_indicator_code",
  defaultCodes: ["GDP", "INFLATION", "REPO", "CPI", "WPI", "IIP", "M3", "EXCHANGE", "RESERVES", "TRADE"],
};

if (require.main === module) {
  makeFetcher(config)().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { main: () => makeFetcher(config)() };
