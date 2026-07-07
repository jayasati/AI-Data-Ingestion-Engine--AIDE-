"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Error boundaries must be class components — React has no hook equivalent
 * for componentDidCatch.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Replace with the logging service once observability lands (Phase 5).
    console.error("[aide-web] Unhandled render error", error, errorInfo.componentStack);
  }

  private readonly reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error === null) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred while rendering this page. Your data has not been
              affected.
            </p>
            <Button onClick={this.reset}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}
