import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { OptionChainDashboard } from './components/dashboard/OptionChainDashboard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled UI Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xl">
              !
            </div>
            <h2 className="text-lg font-bold text-white">Application Notice</h2>
            <p className="text-xs font-mono text-rose-300 bg-rose-950/40 p-3 rounded-lg border border-rose-900/50 break-words text-left">
              {this.state.error?.message || 'Unexpected application error'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition cursor-pointer text-xs"
              >
                Reload
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="flex-1 py-2 px-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition cursor-pointer text-xs"
              >
                Clear Cache & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#07090e] flex flex-col items-center justify-center transition-colors">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 tracking-widest uppercase">
          Initializing NIFTY 50 Pro Terminal...
        </p>
      </div>
    );
  }

  // Protected Admin Route
  if (!user) {
    return <LoginScreen />;
  }

  return <OptionChainDashboard />;
};

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
