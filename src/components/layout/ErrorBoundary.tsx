import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * 全局错误边界
 * 捕获子组件树中的渲染错误，显示 IDE 风格的错误提示
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 将错误信息输出到控制台供调试
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-background text-foreground">
          <div className="flex flex-col items-center gap-4 border border-border rounded-md px-8 py-6 max-w-md text-center">
            <AlertTriangle className="size-8 text-red-500" strokeWidth={1.5} />
            <h1 className="text-sm font-medium">应用发生错误</h1>
            <p className="text-xs text-muted-foreground font-mono break-all">
              {this.state.error?.message ?? '未知渲染错误'}
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-muted px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <RotateCcw className="size-3.5" strokeWidth={1.5} />
              重新加载
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
