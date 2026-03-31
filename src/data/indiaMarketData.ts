export type MarketPoint = {
  year: number;
  value: number;
};

export type KeyStat = {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  note: string;
};

export type Regime = {
  id: string;
  name: string;
  years: string;
  driver: string;
  returns: string;
  risk: string;
  lesson: string;
  summary: string;
  tone: "red" | "amber" | "blue" | "emerald" | "violet";
};

export type Milestone = {
  year: number;
  value: number;
  label: string;
  detail: string;
  tone: "emerald" | "amber" | "rose" | "blue";
};

export type CrashEvent = {
  year: number;
  name: string;
  period: string;
  decline: number;
  monthsToBottom: number;
  monthsToRecover: number | null;
  note: string;
};

export type DecadeReturn = {
  period: string;
  nominal: number;
  real: number;
};

export type RollingWindow = {
  period: string;
  cagr: number;
  verdict: string;
};

export type TableRow = {
  year: string;
  normalizedIndex: string;
  sensex: string;
  yoy: string;
  cagrFrom1947: string;
  inrUsd: string;
  event: string;
};

export type Insight = {
  title: string;
  body: string;
};

export type YearAnnotation = {
  year: number;
  title: string;
  detail: string;
};

export type SectorSnapshot = {
  year: number;
  era: string;
  dominant: string;
  challengers: string[];
  breadthSignal: string;
  note: string;
};

export type BreadthPoint = {
  year: number;
  marketCapLakhCr: number;
  marketCapToGdp: number;
  listedCompaniesK: number;
  dematCrore: number;
  dailyTurnoverCr: number;
  note: string;
};

export type GlobalComparisonPoint = {
  year: number;
  india: number;
  usa: number;
  china: number;
};

export type SipGrowthPoint = {
  year: number;
  dematCrore: number;
  sipMonthlyCr: number;
  annualSipCr: number;
};

export type Scenario2050 = {
  name: string;
  probability: string;
  cagr: number;
  inflation: number;
  projectedSensex2050: number;
  realMultiple: number;
  note: string;
  tone: "emerald" | "amber" | "sky" | "violet";
};

export type TickerStat = {
  label: string;
  value: string;
  change?: string;
  tone?: "emerald" | "amber" | "sky" | "rose" | "violet";
};

const years = [
  1947, 1948, 1949, 1950, 1951, 1952, 1953, 1954, 1955, 1956,
  1957, 1958, 1959, 1960, 1961, 1962, 1963, 1964, 1965, 1966,
  1967, 1968, 1969, 1970, 1971, 1972, 1973, 1974, 1975, 1976,
  1977, 1978, 1979, 1980, 1981, 1982, 1983, 1984, 1985, 1986,
  1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996,
  1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006,
  2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016,
  2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
];

const normalizedIndexValues = [
  100, 92, 87, 102, 150, 135, 123, 146, 177, 169,
  131, 144, 169, 183, 188, 162, 173, 169, 158, 144,
  163, 173, 183, 177, 183, 202, 188, 154, 150, 183,
  169, 183, 192,
  248, 357, 419, 401, 472, 1096, 979, 849, 1215, 1498,
  1500, 3663, 5024, 7540, 5973, 5923, 7025, 5868, 9612,
  7627, 6263, 6484, 11211, 12678, 18044, 26471, 38951,
  18522, 33533, 39377, 29674, 37300, 40648, 52798, 50147,
  51122, 65389, 69251, 79208, 91682, 111848, 116815,
  138701, 150027, 153600,
];

export const continuousIndex: MarketPoint[] = years.map((year, index) => ({
  year,
  value: normalizedIndexValues[index],
}));

export const keyStats: KeyStat[] = [
  {
    label: "Years covered",
    value: 78,
    suffix: " years",
    note: "From Independence in 1947 to the 2025 estimate.",
  },
  {
    label: "Nominal CAGR",
    value: 10.3,
    suffix: "%",
    decimals: 1,
    note: "Approximate annualized return across the full 78-year record.",
  },
  {
    label: "Real CAGR",
    value: 3.3,
    suffix: "%",
    decimals: 1,
    note: "Inflation-adjusted compounding after accounting for India’s long-run price rise.",
  },
  {
    label: "Post-1979 CAGR",
    value: 15.5,
    suffix: "%",
    decimals: 1,
    note: "Sensex-era annualized return from 100 to roughly 80,000.",
  },
  {
    label: "2025 market cap",
    value: 450,
    prefix: "₹",
    suffix: " lakh cr",
    note: "Approximate market-cap scale cited in the supplied narrative.",
  },
  {
    label: "Demat accounts",
    value: 18,
    suffix: " cr",
    note: "Retail participation has moved from niche to structural force.",
  },
];

export const tickerStats: TickerStat[] = [
  { label: "Sensex", value: "~80,000", change: "2025 estimate", tone: "sky" },
  { label: "Full-period CAGR", value: "10.3%", change: "1947–2025", tone: "emerald" },
  { label: "Real CAGR", value: "3.3%", change: "inflation-adjusted", tone: "amber" },
  { label: "Market Cap/GDP", value: "124%", change: "2025 snapshot", tone: "violet" },
  { label: "Demat Accounts", value: "18 Cr", change: "structural retail bid", tone: "emerald" },
  { label: "SIP Flow", value: "₹25,000 Cr/mo", change: "new domestic floor", tone: "sky" },
  { label: "USD CAGR", value: "~10.7%", change: "since 1979", tone: "amber" },
  { label: "Crash Frequency", value: "1 major shock / 5–8 yrs", change: "historical pattern", tone: "rose" },
];

export const marketRegimes: Regime[] = [
  {
    id: "suppressed-market",
    name: "The Suppressed Market",
    years: "1947–1979",
    driver: "State-led planning, licensing, nationalization, and capital controls.",
    returns: "2.1% nominal CAGR / -5.1% real CAGR",
    risk: "Government policy itself was the dominant market risk.",
    lesson:
      "When the policy regime suppresses private capital, even an old stock exchange can fail to create real wealth for decades.",
    summary:
      "India kept the exchange alive, but the combination of socialism, inflation, and repeated controls flattened equity returns.",
    tone: "red",
  },
  {
    id: "awakening",
    name: "The Awakening",
    years: "1979–1991",
    driver: "Low-base rerating, Reliance-era equity cult, gradual opening, and liquidity.",
    returns: "27.6% nominal CAGR / 18.1% real CAGR",
    risk: "Thin market structure and manipulation risk remained high.",
    lesson: "Deregulation from a low base can create extraordinary catch-up returns.",
    summary:
      "The Sensex era started with a dramatic repricing of entrepreneurial India long before the reforms were fully institutionalized.",
    tone: "amber",
  },
  {
    id: "reform-crisis",
    name: "Reform & Crisis",
    years: "1991–2003",
    driver: "Liberalization, FII entry, SEBI/NSE reforms, offset by scams and global stress.",
    returns: "9.5% nominal CAGR / 1.7% real CAGR",
    risk: "Harshad, Ketan Parekh, sanctions, dot-com bust, and 9/11 all hit trust.",
    lesson: "Structural reform can be directionally right while the investment path remains painful.",
    summary:
      "This regime changed India’s capital-market DNA, but investors still endured long trust drawdowns before the next secular bull arrived.",
    tone: "blue",
  },
  {
    id: "golden-era",
    name: "The Golden Era",
    years: "2003–2014",
    driver: "Global liquidity, the India growth narrative, institutional deepening, and FII inflows.",
    returns: "14.8% nominal CAGR / 8.6% real CAGR",
    risk: "FII dependence imported the full force of global crises into Indian equities.",
    lesson: "Integration with the world raised both the upside and the drawdown speed.",
    summary:
      "India went from poster-child emerging market to GFC casualty and then into the 2014 rerating on the hope of renewed reform.",
    tone: "emerald",
  },
  {
    id: "structural-bull",
    name: "The Structural Bull",
    years: "2014–2025",
    driver: "GST, IBC, DPI, China+1, manufacturing hopes, and the retail participation explosion.",
    returns: "10.5% nominal CAGR / ~5.0% real CAGR",
    risk: "Valuation stretch, rupee pressure, FPI outflows, and geopolitical shocks remain live risks.",
    lesson: "A stronger domestic flow base improves resilience, but it does not abolish cycles.",
    summary:
      "The modern Indian market is faster, wider, more financialized, and far more retail-owned than anything seen before 2020.",
    tone: "violet",
  },
];

export const milestones: Milestone[] = [
  {
    year: 1947,
    value: 100,
    label: "Independence",
    detail: "BSE was already 72 years old when India became independent.",
    tone: "emerald",
  },
  {
    year: 1979,
    value: 192,
    label: "Sensex base era",
    detail: "The official Sensex story begins as the socialist drift finally gives way.",
    tone: "blue",
  },
  {
    year: 1985,
    value: 1096,
    label: "Rajiv rally",
    detail: "The equity cult expands dramatically and the market starts to reprice growth.",
    tone: "amber",
  },
  {
    year: 1991,
    value: 3663,
    label: "Liberalization",
    detail: "The single most important policy turning point in modern Indian capital-market history.",
    tone: "emerald",
  },
  {
    year: 2003,
    value: 11211,
    label: "Golden bull begins",
    detail: "Global liquidity and domestic growth kick off a super-bull phase.",
    tone: "amber",
  },
  {
    year: 2008,
    value: 18522,
    label: "GFC reset",
    detail: "The deepest modern drawdown proved how global India had become.",
    tone: "rose",
  },
  {
    year: 2020,
    value: 79208,
    label: "COVID V-recovery",
    detail: "Retail participation and liquidity create the fastest rebound on record.",
    tone: "blue",
  },
  {
    year: 2025,
    value: 153600,
    label: "~80,000 Sensex",
    detail: "A structurally deeper market stands near all-time highs after a 78-year journey.",
    tone: "emerald",
  },
];

export const crashEvents: CrashEvent[] = [
  {
    year: 1962,
    name: "China War",
    period: "1962",
    decline: -16,
    monthsToBottom: 2,
    monthsToRecover: 18,
    note: "War-driven panic caused a sharp but temporary regime interruption.",
  },
  {
    year: 1966,
    name: "Rupee Devaluation",
    period: "1966",
    decline: -17,
    monthsToBottom: 4,
    monthsToRecover: 30,
    note: "Currency shock and drought stress combined into a classic macro-policy hit.",
  },
  {
    year: 1974,
    name: "Oil Shock Bear",
    period: "1973–74",
    decline: -21,
    monthsToBottom: 15,
    monthsToRecover: 36,
    note: "Imported inflation, stagflation, and nationalization pressure punished equities.",
  },
  {
    year: 1987,
    name: "Black Monday spillover",
    period: "1987",
    decline: -13,
    monthsToBottom: 2,
    monthsToRecover: 14,
    note: "The crash was milder than later episodes but proved India was not insulated from global fear.",
  },
  {
    year: 1992,
    name: "Harshad Crash",
    period: "1992",
    decline: -54,
    monthsToBottom: 5,
    monthsToRecover: 132,
    note: "Trust damage lasted years longer than the initial collapse.",
  },
  {
    year: 2001,
    name: "Dot-Com / KP unwind",
    period: "2000–01",
    decline: -56,
    monthsToBottom: 30,
    monthsToRecover: 54,
    note: "Speculation unwound into a multi-year credibility and valuation reset.",
  },
  {
    year: 2008,
    name: "Global Financial Crisis",
    period: "2008",
    decline: -63,
    monthsToBottom: 12,
    monthsToRecover: 24,
    note: "Still the benchmark for speed and depth of modern drawdowns in India.",
  },
  {
    year: 2011,
    name: "Eurozone / India slowdown",
    period: "2011",
    decline: -28,
    monthsToBottom: 13,
    monthsToRecover: 23,
    note: "Local politics and global credit stress hit at the same time.",
  },
  {
    year: 2020,
    name: "COVID Crash",
    period: "2020",
    decline: -38,
    monthsToBottom: 1,
    monthsToRecover: 5,
    note: "The fastest crash in modern India also produced the fastest recovery.",
  },
  {
    year: 2025,
    name: "2024–25 correction",
    period: "2024–25",
    decline: -19,
    monthsToBottom: 4,
    monthsToRecover: null,
    note: "A healthy correction so far, not yet evidence of a structural bear market.",
  },
];

export const decadeReturns: DecadeReturn[] = [
  { period: "1947–1957", nominal: 2.7, real: -4.3 },
  { period: "1957–1967", nominal: 2.5, real: -5.5 },
  { period: "1967–1977", nominal: 0, real: -7 },
  { period: "1977–1987", nominal: 18.5, real: 9 },
  { period: "1987–1997", nominal: 16.2, real: 8.2 },
  { period: "1997–2007", nominal: 18.8, real: 12.8 },
  { period: "2007–2017", nominal: 11.2, real: 4.8 },
  { period: "2017–2025", nominal: 11.3, real: 5.8 },
];

export const rollingWindows: RollingWindow[] = [
  { period: "1979 → 1994", cagr: 27.8, verdict: "Extraordinary" },
  { period: "1985 → 2000", cagr: 13.7, verdict: "Good" },
  { period: "1990 → 2005", cagr: 18.1, verdict: "Excellent" },
  { period: "1992 peak → 2007", cagr: 10.5, verdict: "Decent" },
  { period: "1995 → 2010", cagr: 13.4, verdict: "Good" },
  { period: "2000 → 2015", cagr: 13.3, verdict: "Good" },
  { period: "2003 → 2018", cagr: 12.8, verdict: "Good" },
  { period: "2005 → 2020", cagr: 11.4, verdict: "Good" },
  { period: "2008 → 2023", cagr: 14.4, verdict: "Excellent" },
  { period: "2010 → 2025", cagr: 9.5, verdict: "Decent" },
];

export const sectorEvolution: SectorSnapshot[] = [
  {
    year: 1955,
    era: "Planning era",
    dominant: "Textiles, jute, cotton, and traditional industrial houses",
    challengers: ["Cement", "Basic engineering", "Plantation-linked companies"],
    breadthSignal: "Capital allocation was tightly controlled and sector dynamism was limited.",
    note: "The market existed, but it mainly served existing business houses operating inside a tightly managed economy.",
  },
  {
    year: 1985,
    era: "Equity-cult expansion",
    dominant: "Reliance-led manufacturing, petrochemicals, and legacy industrial names",
    challengers: ["Autos", "Capital goods", "Consumer brands"],
    breadthSignal: "Retail participation began to matter and corporate storytelling started moving valuations.",
    note: "The Rajiv rally widened the market’s imagination beyond the old-license regime stalwarts.",
  },
  {
    year: 2000,
    era: "IT and telecom turn",
    dominant: "IT services, software exporters, telecom dreams, private banks",
    challengers: ["Pharma", "Media", "Early financial services"],
    breadthSignal: "The market shifted from asset-heavy incumbents to earnings-light growth narratives.",
    note: "This was the first big new-economy rotation, but it arrived with dot-com excess and the Ketan Parekh unwind.",
  },
  {
    year: 2007,
    era: "Infra and banking supercycle",
    dominant: "Banks, real estate, metals, infrastructure, capital goods",
    challengers: ["Power", "Construction", "Global cyclicals"],
    breadthSignal: "Global liquidity rewarded balance-sheet expansion and leverage-sensitive sectors.",
    note: "The market believed India was entering a multi-decade capex and urbanization boom all at once.",
  },
  {
    year: 2025,
    era: "Platform + financialization era",
    dominant: "Financials, IT, consumer platforms, manufacturing, EMS, defense, capital markets",
    challengers: ["Renewables", "EV supply chain", "Digital infrastructure"],
    breadthSignal: "The index now reflects formalization, platform economics, and domestic savings migration.",
    note: "Today’s market is structurally broader and far more tied to household financialization than the earlier cycles were.",
  },
];

export const marketBreadth: BreadthPoint[] = [
  {
    year: 1979,
    marketCapLakhCr: 5,
    marketCapToGdp: 8,
    listedCompaniesK: 2.2,
    dematCrore: 0,
    dailyTurnoverCr: 10,
    note: "Tiny market, low participation, and almost no domestic financialization depth.",
  },
  {
    year: 1991,
    marketCapLakhCr: 110,
    marketCapToGdp: 12,
    listedCompaniesK: 6,
    dematCrore: 0,
    dailyTurnoverCr: 100,
    note: "Reform begins to expand market breadth, but institutions are still early in the journey.",
  },
  {
    year: 2000,
    marketCapLakhCr: 900,
    marketCapToGdp: 32,
    listedCompaniesK: 9.9,
    dematCrore: 0.3,
    dailyTurnoverCr: 3000,
    note: "The market becomes much wider, though not yet structurally stable.",
  },
  {
    year: 2010,
    marketCapLakhCr: 6800,
    marketCapToGdp: 95,
    listedCompaniesK: 5.1,
    dematCrore: 1.6,
    dailyTurnoverCr: 15000,
    note: "Formal institutions deepen, but the market is still far from a mass-retail product.",
  },
  {
    year: 2020,
    marketCapLakhCr: 16300,
    marketCapToGdp: 79,
    listedCompaniesK: 5.2,
    dematCrore: 4.1,
    dailyTurnoverCr: 50000,
    note: "COVID becomes the pivot from institutional market to household-owned market.",
  },
  {
    year: 2025,
    marketCapLakhCr: 45000,
    marketCapToGdp: 124,
    listedCompaniesK: 5.3,
    dematCrore: 18,
    dailyTurnoverCr: 120000,
    note: "India is now a deeply financialized market with a meaningful domestic demand floor.",
  },
];

const globalComparisonYears = Array.from({ length: 36 }, (_, index) => 1990 + index);
const indiaNormalized = [
  100, 244, 335, 429, 503, 399, 395, 469, 392, 641,
  509, 418, 433, 748, 846, 1204, 1766, 2599, 1236, 2238,
  2628, 1980, 2489, 2713, 3523, 3345, 3412, 4363, 4621, 5286,
  6118, 7462, 7793, 9256, 10011, 10250,
];
const usaNormalized = [
  100, 126, 135, 149, 146, 201, 247, 329, 423, 512,
  466, 411, 322, 414, 459, 481, 557, 589, 371, 469,
  539, 549, 569, 753, 857, 868, 970, 1098, 1152, 1468,
  1748, 1889, 1543, 2013, 2084, 2250,
];
const chinaNormalized = [
  100, 375, 863, 523, 484, 406, 711, 859, 803, 1087,
  1418, 1259, 1063, 988, 955, 784, 1819, 3773, 1322, 2252,
  1971, 1593, 1509, 1457, 2187, 2472, 2193, 2303, 1775, 2124,
  2382, 2490, 2165, 2076, 2259, 2300,
];

export const indiaVsWorld: GlobalComparisonPoint[] = globalComparisonYears.map((year, index) => ({
  year,
  india: indiaNormalized[index],
  usa: usaNormalized[index],
  china: chinaNormalized[index],
}));

const sipDematBase = [
  { year: 2016, dematCrore: 2.2, sipMonthlyCr: 3050 },
  { year: 2017, dematCrore: 2.6, sipMonthlyCr: 4300 },
  { year: 2018, dematCrore: 3.0, sipMonthlyCr: 6700 },
  { year: 2019, dematCrore: 4.0, sipMonthlyCr: 8300 },
  { year: 2020, dematCrore: 4.1, sipMonthlyCr: 8600 },
  { year: 2021, dematCrore: 7.5, sipMonthlyCr: 9700 },
  { year: 2022, dematCrore: 10.0, sipMonthlyCr: 12200 },
  { year: 2023, dematCrore: 13.0, sipMonthlyCr: 15600 },
  { year: 2024, dematCrore: 16.4, sipMonthlyCr: 20400 },
  { year: 2025, dematCrore: 18.0, sipMonthlyCr: 25000 },
];

export const sipDematGrowth: SipGrowthPoint[] = sipDematBase.map((point) => ({
  ...point,
  annualSipCr: point.sipMonthlyCr * 12,
}));

export const scenario2050: Scenario2050[] = [
  {
    name: "Stress case",
    probability: "Low probability",
    cagr: 6,
    inflation: 5,
    projectedSensex2050: 343000,
    realMultiple: 1.27,
    note: "A mediocre market with high inflation still compounds nominally, but real wealth creation is thin.",
    tone: "amber",
  },
  {
    name: "Conservative",
    probability: "Reasonable floor",
    cagr: 7.7,
    inflation: 5,
    projectedSensex2050: 500000,
    realMultiple: 1.94,
    note: "This broadly matches the cautious 2050 path sketched in the supplied analysis.",
    tone: "sky",
  },
  {
    name: "Base case",
    probability: "Highest conviction",
    cagr: 10.1,
    inflation: 5,
    projectedSensex2050: 900000,
    realMultiple: 3.44,
    note: "A sustained reform path plus continued financialization can plausibly take the market near 9 lakh by 2050.",
    tone: "emerald",
  },
  {
    name: "Optimistic",
    probability: "Upside scenario",
    cagr: 12.4,
    inflation: 5,
    projectedSensex2050: 1500000,
    realMultiple: 5.76,
    note: "This requires stronger manufacturing, durable premium valuations, and successful China+1 execution.",
    tone: "violet",
  },
];

export const yearAnnotations: YearAnnotation[] = [
  {
    year: 1949,
    title: "First major currency shock",
    detail: "The rupee devaluation of 1949 showed how fragile the post-Independence market framework was.",
  },
  {
    year: 1951,
    title: "First Five Year Plan",
    detail: "Development optimism briefly lifted the market even as the control architecture hardened.",
  },
  {
    year: 1969,
    title: "Bank nationalization",
    detail: "Indira Gandhi’s socialist turn deepened the sense that the state, not the market, would command capital.",
  },
  {
    year: 1974,
    title: "Oil shock + inflation crisis",
    detail: "Imported inflation and domestic stress drove one of the harshest pre-Sensex drawdowns.",
  },
  {
    year: 1987,
    title: "Global contagion arrives",
    detail: "Black Monday hit India less severely than later crises, but it announced a more interconnected era.",
  },
  {
    year: 1992,
    title: "Harshad peak and crash",
    detail: "The 1992 boom-bust proved that reform momentum and market integrity are not the same thing.",
  },
  {
    year: 2001,
    title: "Dot-com and Ketan Parekh unwind",
    detail: "Speculation in new-economy narratives turned into a brutal reset for market trust.",
  },
  {
    year: 2014,
    title: "Modi rerating",
    detail: "Markets rallied on the hope that policy execution would finally catch up with reform ambition.",
  },
  {
    year: 2024,
    title: "All-time highs",
    detail: "The September 2024 peak near 85,978 capped one of the greatest multi-year rallies in Indian history.",
  },
];

export const masterTable: TableRow[] = [
  {
    year: "1947",
    normalizedIndex: "100",
    sensex: "—",
    yoy: "—",
    cagrFrom1947: "—",
    inrUsd: "3.31",
    event: "Independence; BSE already 72 years old.",
  },
  {
    year: "1949",
    normalizedIndex: "87",
    sensex: "—",
    yoy: "-5.4%",
    cagrFrom1947: "-6.7%",
    inrUsd: "4.76",
    event: "Rupee devalued about 30%.",
  },
  {
    year: "1951",
    normalizedIndex: "150",
    sensex: "—",
    yoy: "+47.1%",
    cagrFrom1947: "10.7%",
    inrUsd: "4.76",
    event: "First Five Year Plan launches with development optimism.",
  },
  {
    year: "1962",
    normalizedIndex: "162",
    sensex: "—",
    yoy: "-11.3%",
    cagrFrom1947: "3.2%",
    inrUsd: "4.76",
    event: "Sino-Indian war shock.",
  },
  {
    year: "1969",
    normalizedIndex: "183",
    sensex: "—",
    yoy: "+8.3%",
    cagrFrom1947: "2.8%",
    inrUsd: "7.50",
    event: "14 banks nationalized; the socialist turn deepens.",
  },
  {
    year: "1974",
    normalizedIndex: "154",
    sensex: "—",
    yoy: "-18.1%",
    cagrFrom1947: "1.6%",
    inrUsd: "8.10",
    event: "Oil shock, inflation spike, and coal nationalization.",
  },
  {
    year: "1979",
    normalizedIndex: "192",
    sensex: "100",
    yoy: "+6.4%",
    cagrFrom1947: "2.1%",
    inrUsd: "8.13",
    event: "Sensex base year; the official index era begins.",
  },
  {
    year: "1985",
    normalizedIndex: "1,096",
    sensex: "571",
    yoy: "+132.1%",
    cagrFrom1947: "6.5%",
    inrUsd: "12.37",
    event: "Rajiv rally and Reliance-led equity cult.",
  },
  {
    year: "1991",
    normalizedIndex: "3,663",
    sensex: "1,908",
    yoy: "+144.3%",
    cagrFrom1947: "8.7%",
    inrUsd: "25.83",
    event: "Liberalization and IMF-era reforms.",
  },
  {
    year: "1992 peak",
    normalizedIndex: "8,577",
    sensex: "4,467",
    yoy: "—",
    cagrFrom1947: "—",
    inrUsd: "28.14",
    event: "Harshad Mehta peak before the scam unwind.",
  },
  {
    year: "2001",
    normalizedIndex: "6,263",
    sensex: "3,262",
    yoy: "-17.9%",
    cagrFrom1947: "8.0%",
    inrUsd: "47.19",
    event: "9/11 and Ketan Parekh aftermath hit confidence.",
  },
  {
    year: "2003",
    normalizedIndex: "11,211",
    sensex: "5,839",
    yoy: "+33.0%",
    cagrFrom1947: "8.8%",
    inrUsd: "45.61",
    event: "Golden bull run begins.",
  },
  {
    year: "2008 Dec",
    normalizedIndex: "18,522",
    sensex: "9,647",
    yoy: "-52.4%",
    cagrFrom1947: "8.6%",
    inrUsd: "48.45",
    event: "Global Financial Crisis washout.",
  },
  {
    year: "2014",
    normalizedIndex: "52,798",
    sensex: "27,499",
    yoy: "+29.9%",
    cagrFrom1947: "10.0%",
    inrUsd: "63.33",
    event: "Modi wave rerating.",
  },
  {
    year: "2020 Mar low",
    normalizedIndex: "49,227",
    sensex: "25,639",
    yoy: "—",
    cagrFrom1947: "—",
    inrUsd: "75.39",
    event: "COVID crash low before the greatest V-shaped recovery.",
  },
  {
    year: "2020 Dec",
    normalizedIndex: "91,682",
    sensex: "47,751",
    yoy: "+15.8%",
    cagrFrom1947: "9.8%",
    inrUsd: "73.53",
    event: "The greatest V-shaped recovery in market history.",
  },
  {
    year: "2024 Dec",
    normalizedIndex: "150,027",
    sensex: "78,139",
    yoy: "+8.2%",
    cagrFrom1947: "10.3%",
    inrUsd: "84.29",
    event: "Correction from peak, but still near historic highs.",
  },
  {
    year: "2025 est",
    normalizedIndex: "153,600",
    sensex: "~80,000",
    yoy: "~+2.4%",
    cagrFrom1947: "10.3%",
    inrUsd: "85.50",
    event: "High base, tariff worries, energy and rupee stress.",
  },
];

export const insights: Insight[] = [
  {
    title: "The socialist tax was real",
    body:
      "From 1947 to 1979, nominal gains were weak and real returns were deeply negative. Policy regime mattered more than stock selection.",
  },
  {
    title: "1991 changed the market’s DNA",
    body:
      "Liberalization, FII access, SEBI reforms, and private-sector scaling created the foundation for sustainable long-run compounding.",
  },
  {
    title: "Crashes are normal, not exceptional",
    body:
      "India’s market history is a chain of drawdowns and recoveries. Volatility is part of the asset class, not evidence that the story is broken.",
  },
  {
    title: "Inflation eats most headline return",
    body:
      "A 10.3% nominal CAGR collapses to roughly 3.3% real over the full 78-year horizon. Real purchasing power is the right lens.",
  },
  {
    title: "The rupee is a structural drag",
    body:
      "Long-run INR depreciation compresses USD returns, which is why domestic and foreign investors experience India differently.",
  },
  {
    title: "Trust shocks can last a decade",
    body:
      "The Harshad aftermath shows that scams do not just create crashes; they suppress multiples and confidence for years afterward.",
  },
  {
    title: "Retail flows changed the floor",
    body:
      "The post-2020 demat and SIP boom created a domestic bid that did not exist in prior cycles, making the market structurally more resilient.",
  },
  {
    title: "Valuations still matter",
    body:
      "A structural bull market does not mean a straight line. High starting valuations reduce future expected returns even in strong economies.",
  },
  {
    title: "Diversification beats nostalgia",
    body:
      "Index returns benefited from replacing weak companies with stronger ones. Owning broad quality beats idolizing once-famous stocks.",
  },
  {
    title: "Patience was the edge",
    body:
      "The strongest evidence in the dataset is behavioral: investors who stayed invested for 15 years were consistently rewarded.",
  },
];
