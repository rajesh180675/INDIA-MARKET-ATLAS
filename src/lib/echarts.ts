/**
 * Tree-shaken ECharts bundle — only import what we actually use.
 * This replaces `import * as echarts from "echarts"` which pulls ~1MB.
 */
import * as echarts from "echarts/core";
import { LineChart, ScatterChart } from "echarts/charts";
import {
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  TransformComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { UniversalTransition } from "echarts/features";

echarts.use([
  LineChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  DatasetComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
  ToolboxComponent,
  TransformComponent,
  CanvasRenderer,
  UniversalTransition,
]);

export default echarts;
