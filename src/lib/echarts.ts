/**
 * Tree-shaken ECharts bundle — only import what we actually use.
 * This replaces `import * as echarts from "echarts"` which pulls ~1MB.
 */
import * as echarts from "echarts/core";
import { LineChart, ScatterChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
  ToolboxComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  LineChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
  ToolboxComponent,
  CanvasRenderer,
]);

export default echarts;
