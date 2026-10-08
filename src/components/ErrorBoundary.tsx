import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[EduMath AI Runtime Error caught by Boundary]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleClearAndReset = () => {
    try {
      localStorage.removeItem('edumath_app_user');
      localStorage.removeItem('edumath_teacher_profile');
    } catch {}
    window.location.href = window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
          <div className="max-w-lg w-full bg-slate-850 rounded-3xl border border-slate-700/80 shadow-2xl p-8 text-center backdrop-blur-xl bg-slate-800/90">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-5 text-rose-400">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h1 className="text-xl font-black text-white mb-2 tracking-tight">
              Đã khôi phục an toàn EduMath AI
            </h1>

            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Hệ thống đã tự động ngăn chặn sự cố hiển thị. Vui lòng bấm làm mới để tiếp tục phiên làm việc bình thường.
            </p>

            {this.state.error && (
              <div className="text-left bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 mb-6 text-xs text-rose-300 font-mono break-all max-h-32 overflow-y-auto">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tải lại phiên làm việc</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearAndReset}
                className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Về trang chủ</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
