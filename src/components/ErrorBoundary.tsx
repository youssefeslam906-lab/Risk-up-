import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = 'حدث خطأ غير متوقع أثناء تحميل البيانات.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed?.error) {
        readable = `تعذّر تنفيذ العملية (${parsed.operationType ?? 'data'}): ${parsed.error}`;
      }
    } catch {
      if (error.message) {
        readable = error.message;
      }
    }
    return { hasError: true, message: readable };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-ink text-tx flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-card border border-line rounded-2xl p-6 space-y-4 text-right">
            <div className="flex items-center gap-3 text-bad">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-xl font-black">حصل خطأ في التطبيق</h2>
            </div>
            <p className="text-sm text-mu leading-relaxed break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 bg-gold text-on font-black rounded-xl px-4 py-2.5 text-sm transition-opacity hover:opacity-90 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة تحميل الصفحة</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
