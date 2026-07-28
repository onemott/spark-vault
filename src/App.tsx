import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { AppLayout } from '@/components/layout/AppLayout';

function App() {
  return (
    <ErrorBoundary>
      <AppLayout />
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
