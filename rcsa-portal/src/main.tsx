import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { UiProvider } from './components/common/UiProvider';
import { ThemeProvider } from './state/ThemeProvider';

// Global providers only. RCSA's data store + modals now live inside the RCSA
// module (src/modules/rcsa) so each module owns its own data layer.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <UiProvider>
        <App />
      </UiProvider>
    </ThemeProvider>
  </StrictMode>,
);
