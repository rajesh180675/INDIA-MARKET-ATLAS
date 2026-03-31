import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  writable: true,
  value: vi.fn(),
});

afterEach(() => {
  cleanup();
});

vi.mock("framer-motion", () => {
  const motion = new Proxy(
    {},
    {
      get: (_, tag: string) =>
        React.forwardRef<
          HTMLElement,
          Record<string, unknown> & { children?: React.ReactNode }
        >(
          (
            {
              animate: _animate,
              exit: _exit,
              initial: _initial,
              layoutId: _layoutId,
              transition: _transition,
              viewport: _viewport,
              whileHover: _whileHover,
              whileInView: _whileInView,
              whileTap: _whileTap,
              children,
              ...props
            },
            ref,
          ) =>
            React.createElement(tag, { ...props, ref }, children as React.ReactNode),
        ),
    },
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useReducedMotion: () => false,
  };
});

vi.mock("echarts-for-react", () => {
  const MockChart = React.forwardRef(function MockChart(
    props: { option?: { series?: Array<{ name?: string }> } },
    ref: React.ForwardedRef<{ getEchartsInstance: () => { getDataURL: () => string } }>,
  ) {
    React.useImperativeHandle(ref, () => ({
      getEchartsInstance: () => ({
        getDataURL: () => "data:image/png;base64,mock",
      }),
    }));

    return React.createElement("div", {
      "data-testid": "echarts-react-mock",
      "data-series": JSON.stringify(
        props.option?.series?.map((series) => series.name ?? "unnamed") ?? [],
      ),
    });
  });

  return {
    __esModule: true,
    default: MockChart,
  };
});
