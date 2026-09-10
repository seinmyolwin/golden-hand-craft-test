import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

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
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white">စနစ်တွင် ချွတ်ယွင်းချက်တစ်ခု ဖြစ်ပေါ်သွားပါသည်</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              စာမျက်နှာကို ပြန်လည်ဖွင့်ပါ (Refresh)။ ပြဿနာဆက်လက်ရှိနေပါက မိတ္တူဖိုင်မှတစ်ဆင့် စာရင်းကို ပြန်လည်သွင်းယူနိုင်ပါသည်။
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg inline-flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>စာမျက်နှာ ပြန်ဖွင့်မည်</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
