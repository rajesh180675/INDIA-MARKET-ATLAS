// BSE Sensex Annual OHLC Data (1979-2025)
// Sources: BSE India, RBI Handbook of Statistics
// Note: 1979-1985 approximate (limited digitized records). 1986+ from BSE official.
// 2025 is partial (through May 2025).

export interface OHLCDataPoint {
  year: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export const sensexOHLC: OHLCDataPoint[] = [
  { year: 1979, open: 100, high: 100, low: 99, close: 100 },
  { year: 1980, open: 100, high: 129, low: 99, close: 129 },
  { year: 1981, open: 129, high: 186, low: 128, close: 186 },
  { year: 1982, open: 186, high: 218, low: 175, close: 218 },
  { year: 1983, open: 218, high: 245, low: 199, close: 245 },
  { year: 1984, open: 245, high: 282, low: 229, close: 245 },
  { year: 1985, open: 245, high: 354, low: 230, close: 354 },
  { year: 1986, open: 354, high: 615, low: 349, close: 574 },
  { year: 1987, open: 574, high: 663, low: 510, close: 510 },
  { year: 1988, open: 510, high: 799, low: 484, close: 714 },
  { year: 1989, open: 714, high: 922, low: 658, close: 781 },
  { year: 1990, open: 781, high: 1311, low: 658, close: 781 },
  { year: 1991, open: 781, high: 1955, low: 781, close: 1908 },
  { year: 1992, open: 1908, high: 4546, low: 1908, close: 2615 },
  { year: 1993, open: 2615, high: 3459, low: 1980, close: 3346 },
  { year: 1994, open: 3346, high: 4643, low: 3109, close: 3927 },
  { year: 1995, open: 3927, high: 3943, low: 2891, close: 3110 },
  { year: 1996, open: 3110, high: 4131, low: 2713, close: 3085 },
  { year: 1997, open: 3085, high: 4605, low: 3085, close: 3658 },
  { year: 1998, open: 3658, high: 4322, low: 2741, close: 3055 },
  { year: 1999, open: 3055, high: 5150, low: 3042, close: 5006 },
  { year: 2000, open: 5006, high: 6150, low: 3491, close: 3972 },
  { year: 2001, open: 3972, high: 4462, low: 2594, close: 3262 },
  { year: 2002, open: 3262, high: 3758, low: 2828, close: 3377 },
  { year: 2003, open: 3377, high: 5921, low: 2904, close: 5839 },
  { year: 2004, open: 5839, high: 6617, low: 4227, close: 6603 },
  { year: 2005, open: 6603, high: 9398, low: 6069, close: 9398 },
  { year: 2006, open: 9398, high: 14035, low: 8799, close: 13787 },
  { year: 2007, open: 13787, high: 20498, low: 12316, close: 20287 },
  { year: 2008, open: 20287, high: 21207, low: 7697, close: 9647 },
  { year: 2009, open: 9647, high: 17531, low: 8047, close: 17465 },
  { year: 2010, open: 17465, high: 21109, low: 15652, close: 20509 },
  { year: 2011, open: 20509, high: 20665, low: 15135, close: 15455 },
  { year: 2012, open: 15455, high: 19612, low: 15358, close: 19427 },
  { year: 2013, open: 19427, high: 21484, low: 17449, close: 21171 },
  { year: 2014, open: 21171, high: 28822, low: 19963, close: 27499 },
  { year: 2015, open: 27499, high: 30025, low: 24834, close: 26118 },
  { year: 2016, open: 26118, high: 29077, low: 22495, close: 26626 },
  { year: 2017, open: 26626, high: 34138, low: 26447, close: 34057 },
  { year: 2018, open: 34057, high: 38989, low: 32483, close: 36068 },
  { year: 2019, open: 36068, high: 41810, low: 35287, close: 41254 },
  { year: 2020, open: 41254, high: 47751, low: 25639, close: 47751 },
  { year: 2021, open: 47751, high: 62245, low: 46160, close: 58253 },
  { year: 2022, open: 58253, high: 63583, low: 50921, close: 60841 },
  { year: 2023, open: 60841, high: 72240, low: 57085, close: 72240 },
  { year: 2024, open: 72240, high: 85978, low: 71093, close: 78139 },
  { year: 2025, open: 78139, high: 82620, low: 71674, close: 81721 },
];

// Derived metrics
export function getAnnualReturn(d: OHLCDataPoint): number {
  return ((d.close - d.open) / d.open) * 100;
}

export function getVolatility(d: OHLCDataPoint): number {
  // Intra-year range as % of open
  return ((d.high - d.low) / d.open) * 100;
}

export function getUpperShadow(d: OHLCDataPoint): number {
  // How much of the high was given back
  const body = Math.max(d.open, d.close);
  return ((d.high - body) / d.open) * 100;
}

export function getLowerShadow(d: OHLCDataPoint): number {
  // How much it recovered from the low
  const body = Math.min(d.open, d.close);
  return ((body - d.low) / d.open) * 100;
}
