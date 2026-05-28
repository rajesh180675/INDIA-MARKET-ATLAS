/**
 * ECharts instance for use with echarts-for-react/lib/core.
 * We import the full echarts package for reliability — tree-shaking echarts/core
 * causes runtime errors ("getProgressive" undefined) due to incomplete internal
 * dependency resolution in echarts 6.
 */
import * as echarts from "echarts";

export default echarts;
