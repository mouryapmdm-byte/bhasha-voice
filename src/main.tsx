import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { FirebaseProvider } from './components/FirebaseProvider';

// Global Error Boundary for Catching Boot Crashes
class GlobalErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '20px',
          textAlign: 'center',
          backgroundColor: '#0f172a',
          color: 'white',
          fontFamily: 'sans-serif'
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Oops! Application Error</h1>
          <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '14px' }}>
            We encountered a problem loading the app on this device.
          </p>
          <div style={{ 
            backgroundColor: '#1e293b', 
            padding: '12px', 
            borderRadius: '8px', 
            fontSize: '12px', 
            marginBottom: '24px',
            maxWidth: '100%',
            overflow: 'auto'
          }}>
            <code>{this.state.error?.message || 'Unknown Error'}</code>
          </div>
          <button 
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              window.location.reload();
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Clear Cache & Restart
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <GlobalErrorBoundary>
    <FirebaseProvider>
      <App />
    </FirebaseProvider>
  </GlobalErrorBoundary>,
);

// Register PWA Service Worker for Web Share Target and offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('PWA Service Worker registered successfully:', registration.scope);
      })
      .catch(registrationError => {
        console.warn('PWA Service Worker registration failed:', registrationError);
      });
  });
}
