import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import { createTheme, MantineProvider } from '@mantine/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// After Mantine's styles so ours win.
import './index.css';

/** Dark palette matched to the app's navy UI (dark[7] is Mantine's dark-scheme body colour). */
const theme = createTheme({
  fontFamily: 'system-ui, sans-serif',
  primaryColor: 'blue',
  defaultRadius: 'md',
  colors: {
    dark: [
      '#e6e8ef',
      '#b8bccb',
      '#8d92a6',
      '#5f6580',
      '#3a4058',
      '#262b3d',
      '#1b2030',
      '#0b0d14',
      '#080a10',
      '#05060a',
    ],
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing from index.html');

createRoot(root).render(
  <StrictMode>
    <MantineProvider theme={theme} forceColorScheme="dark">
      <App />
    </MantineProvider>
  </StrictMode>,
);
