import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-10 w-full flex items-center justify-center bg-black/20 rounded-lg overflow-hidden border border-red-500/20">
          <p className="text-red-400 text-xs font-bold">Audio Failed</p>
        </div>
      );
    }

    return this.props.children;
  }
}
