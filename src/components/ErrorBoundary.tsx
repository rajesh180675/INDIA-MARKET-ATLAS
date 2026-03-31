import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown runtime error";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    console.error("India Market Atlas runtime error:", error);
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-8">
          <div className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">Render fallback</p>
            <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">The page hit a runtime issue.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              I’ve added this safety layer so the site won’t fail into a blank screen. Please reload once, and if the issue repeats,
              the interface will at least remain visible instead of rendering as an empty black page.
            </p>
            {this.state.message ? (
              <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                Runtime detail: {this.state.message}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Reload page
              </button>
              <a
                href="#root"
                className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Stay on page
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
