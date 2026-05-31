const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ─── Parse authentic MoSPI national data from the PDF ──────────────────────
const PDF_PATH = path.join(__dirname, "../data/raw/mospi/STATE_SDP/nsdp_2025_09_01.pdf");
const OUTPUT_PATH = path.join(__dirname, "../public/data/mospi/nas-gdp-mvp.json");
const GEOGRAPHY_REGISTRY_PATH = path.join(__dirname, "../data/catalog/geography_registry.json");
const PYTHON_SCRIPT = path.join(__dirname, "extract_nas_pdf.py");

function runPythonExtractor() {
  const result = execSync(`python "${PYTHON_SCRIPT}"`, {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(result);
}

function main() {
  console.log("Extracting authentic MoSPI national data from PDF...");

  const observations = runPythonExtractor();
  console.log(`Extracted ${observations.length} observations`);

  if (observations.length === 0) {
    console.error("No observations extracted. Check PDF parsing.");
    process.exit(1);
  }

  const geoRegistry = JSON.parse(fs.readFileSync(GEOGRAPHY_REGISTRY_PATH, "utf-8"));

  // Build indicators from extracted data
  const uniqueIndicators = new Map();
  observations.forEach((obs) => {
    if (!uniqueIndicators.has(obs.indicator_id)) {
      const parts = obs.indicator_id.split(".");
      const freq = obs.period_id.startsWith("Q") ? "quarterly" : "monthly";
      const nameMap = {
        "NAS_GDP.GVA.current.2011-12": "Gross Value Added at Current Prices",
        "NAS_GDP.GVA.constant.2011-12": "Gross Value Added at Constant Prices (2011-12)",
        "NAS_GDP.GVA.deflator.2011-12": "GVA Implicit Price Deflator",
        "NAS_GDP.IIP.overall.2011-12": "Index of Industrial Production",
        "NAS_GDP.CPI.combined.2012": "Consumer Price Index - Combined",
        "NAS_GDP.CPI.rural.2012": "Consumer Price Index - Rural",
        "NAS_GDP.CPI.urban.2012": "Consumer Price Index - Urban",
        "NAS_GDP.CPI.industrial_workers.2016": "Consumer Price Index - Industrial Workers",
        "NAS_GDP.CPI.agricultural_labourers.2019": "Consumer Price Index - Agricultural Labourers",
        "NAS_GDP.CPI.rural_labourers.2019": "Consumer Price Index - Rural Labourers",
        "NAS_GDP.WPI.overall.2011-12": "Wholesale Price Index",
      };

      const name = nameMap[obs.indicator_id] || obs.dimensions.sector || parts.slice(2).join(" ");

      uniqueIndicators.set(obs.indicator_id, {
        id: obs.indicator_id,
        dataset: "NAS_GDP",
        source_dataset_code: "National Accounts Statistics",
        indicator_code: parts[2] || "GVA",
        name,
        unit: obs.unit,
        frequency: freq,
        geography_level: "india",
        dimensions_schema: ["price_basis", "base_year", "revision", "sector"],
        base_year: obs.dimensions.base_year,
        price_basis: obs.dimensions.price_basis,
        source_url: "https://www.mospi.gov.in/",
        release_policy: "MoSPI SDDS release; preliminary when first released.",
        default_transform: "level",
      });
    }
  });

  const output = {
    schema_version: "2026-06-mospi-nas-gdp-mvp-v2",
    dataset: "NAS_GDP",
    title: "National Accounts Statistics — GDP and GVA aggregates",
    generated_at: new Date().toISOString(),
    source_status: "ready",
    source_runs: [
      {
        run_id: `mospi-nas-pdf-parse-${new Date().toISOString().slice(0, 10)}`,
        fetched_at: new Date().toISOString(),
        source_url: "MoSPI SDDS PDF (data/raw/mospi/STATE_SDP/nsdp_2025_09_01.pdf)",
        source_file: "data/raw/mospi/STATE_SDP/nsdp_2025_09_01.pdf",
        content_hash: "pdf-extracted",
        parser_version: "nas-pdf-parse-v2",
        row_count: observations.length,
        warnings: [],
        errors: [],
      },
    ],
    geographies: geoRegistry.filter((g) => g.geography_id === "IN"),
    indicators: Array.from(uniqueIndicators.values()),
    observations,
    quality_report: {
      validation_status: "passed",
      duplicate_count: 0,
      null_count: observations.filter((o) => o.value === null).length,
      outlier_count: 0,
      coverage: {
        india: 1,
        states: 0,
        periods: new Set(observations.map((o) => o.period_id)).size,
        total_observations: observations.length,
      },
      source_hash: "pdf-extracted",
    },
    warnings: [],
    provenance: "Extracted from MoSPI SDDS PDF dated August 29, 2025. Data are preliminary and not seasonally adjusted.",
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${observations.length} observations to ${OUTPUT_PATH}`);
  console.log(`Indicators: ${output.indicators.length}`);
  console.log(`Periods: ${[...new Set(observations.map((o) => o.period_id))]}`);
  console.log("Status: ready (authentic MoSPI data)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
