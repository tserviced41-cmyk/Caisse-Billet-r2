import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
    console.error('Unhandled UI Error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#063339] flex items-center justify-center p-4 selection:bg-teal-300 selection:text-teal-900">
          <div className="max-w-md w-full bg-white/10 backdrop-blur-md border border-red-400/40 rounded-2xl shadow-2xl p-6 sm:p-8 text-white text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/20 border border-red-400/40 flex items-center justify-center text-red-300">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h1 className="text-xl font-bold mb-2">Une interruption inattendue est survenue</h1>
            <p className="text-xs text-teal-100/80 mb-6 leading-relaxed">
              L'affichage a été suspendu pour protéger l'intégrité de vos écritures et calculs.
              Vos données restent parfaitement enregistrées sur le serveur.
            </p>

            <button
              onClick={this.handleReload}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#2e9e44] hover:bg-[#258237] text-white font-semibold py-2.5 px-4 rounded-xl shadow-md transition cursor-pointer text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Actualiser l'application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
