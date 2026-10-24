import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import 'leaflet/dist/leaflet.css';
import './css/tokens.css';
import './css/components.css';
import './css/layout.css';
import './css/home.css';
import './css/donations.css';
import './css/maps.css';
import './css/auth.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster position="top-right" toastOptions={{ style: { fontFamily: 'inherit' }, success: { iconTheme: { primary: '#15803d', secondary: '#fff' } } }} />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
