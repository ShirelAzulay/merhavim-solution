import React from 'react';
import WizardContainer from './wizard/WizardContainer';
import Header from './components/Header';

export default function App() {
  return (
    <div>
      <Header />
      <div style={{ padding: '20px' }}>
        <WizardContainer />
      </div>
    </div>
  );
}
