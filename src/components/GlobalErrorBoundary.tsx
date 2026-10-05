import { Component, type ErrorInfo, type ReactNode } from 'react';

type GlobalErrorBoundaryState = {
  hasError: boolean;
};

export class GlobalErrorBoundary extends Component<{ children: ReactNode }, GlobalErrorBoundaryState> {
  state: GlobalErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): GlobalErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    this.setState({ hasError: true });
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className='mx-auto grid min-h-screen max-w-3xl content-center gap-4 px-6 text-white' role='alert'>
          <h1 className='text-2xl font-semibold'>TINAN AI needs a refresh.</h1>
          <p className='text-sm text-white/70'>The page could not be displayed. No transaction was confirmed by this error screen.</p>
          <button className='w-fit rounded-xl bg-tinan-cyan px-4 py-2 font-semibold text-black' onClick={() => window.location.reload()} type='button'>Reload application</button>
        </main>
      );
    }
    return this.props.children;
  }
}
