import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

import '@cloudscape-design/global-styles/index.css'; // Cloudscape styling
import './index.css'; // Our global RTL styling

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
