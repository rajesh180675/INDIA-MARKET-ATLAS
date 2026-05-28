import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  name?: string;
};

type State = {
  hasError: boolean;
};

export default class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`Section "${this.props.name ?? "unknown"}" crashed:`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-6 text-center text-sm text-rose-200">
          This section encountered an error and could not render.
        </div>
      );
    }
    return this.props.children;
  }
}
