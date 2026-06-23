import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AppStoreProvider } from './state/AppStore';
import { UiProvider } from './components/common/UiProvider';
import { ModalsProvider } from './state/ModalsProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStoreProvider>
      <UiProvider>
        <ModalsProvider>
          <App />
        </ModalsProvider>
      </UiProvider>
    </AppStoreProvider>
  </StrictMode>,
);
