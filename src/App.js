import React from 'react';
import WizardContainer from './wizard/WizardContainer';
import Header from './components/Header';
import Footer from './components/Footer';

export default function App() {
  return (
    <div>
      <Header />
      <div style={{ padding: '20px' }}>
        <WizardContainer />
      </div>
      <Footer />
    </div>
  );
}
