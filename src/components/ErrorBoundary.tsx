import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown runtime error";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    console.error("India Market Atlas runtime error:", error);
  }

  handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="px-6 py-16 sm:px-8" style={{ minHeight: "100vh", background: "var(--paper)" }}>
          <div className="surface mx-auto max-w-2xl p-8">
            <div className="eyebrow">Render fallback</div>
            <h1 className="display mt-3 text-3xl">The console hit a runtime issue.</h1>
            <p className="mt-3 text-[15px]" style={{ color: "var(--ink-soft)" }}>
              A safety layer caught the error so the page stays usable. Reload once; if it
              repeats the detail below will help locate the cause.
            </p>
            {this.state.message ? (
              <p
                className="num mt-4 px-3 py-2 text-[13px]"
                style={{ background: "var(--neg-wash)", color: "var(--neg)", border: "1px solid var(--rule)" }}
              >
                {this.state.message}
              </p>
            ) : null}
            <button
              type="button"
              onClick={this.handleReload}
              className="segmented mt-6 px-4 py-2 text-[13px]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
