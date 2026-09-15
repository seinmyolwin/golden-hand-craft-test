import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  title?: string;
  isSection?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
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
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public handleReset = () => {
    (this as unknown as { setState: (s: Partial<State>) => void }).setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.isSection) {
        return (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 my-4 text-center space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-rose-900">
              {this.props.title || 'ဤကဏ္ဍတွင် ယာယီ ချွတ်ယွင်းချက် ဖြစ်ပေါ်ပါသည်'}
            </h3>
            <p className="text-xs text-rose-700 leading-relaxed max-w-sm mx-auto">
              အချက်အလက် စစ်ဆေးရာတွင် ယာယီ ချို့ယွင်းချက် ရှိနေပါသည်။ အောက်ပါ ခလုတ်ကို နှိပ်၍ ပြန်လည် ကြိုးစားကြည့်ပါ။
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ပြန်လည်ကြိုးစားမည်</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 bg-white border border-rose-300 text-rose-800 text-xs font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer hover:bg-rose-100 transition-colors"
              >
                <span>စာမျက်နှာ ပြန်ဖွင့်မည်</span>
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white">
              {this.props.title || 'စနစ်တွင် ချွတ်ယွင်းချက်တစ်ခု ဖြစ်ပေါ်သွားပါသည်'}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              စာမျက်နှာကို ပြန်လည်ဖွင့်ပါ (Refresh)။ ပြဿနာဆက်လက်ရှိနေပါက မိတ္တူဖိုင်မှတစ်ဆင့် စာရင်းကို ပြန်လည်သွင်းယူနိုင်ပါသည်။
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ပြန်စတင်မည်</span>
              </button>
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
        </div>
      );
    }

    return this.props.children;
  }
}
