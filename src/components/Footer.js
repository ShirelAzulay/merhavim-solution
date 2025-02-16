import React from 'react';
import { Alert } from '@cloudscape-design/components';

export default function Footer() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        background: '#ffffff',
        padding: '16px 32px',
        boxShadow: '0 -4px 8px rgba(0, 0, 0, 0.08)',
        position: 'sticky',
        bottom: 0,
        zIndex: 1000,
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      <Alert 
        type="info" 
        style={{ 
          width: '100%', 
          maxWidth: '1400px',
          textAlign: 'center'
        }}
      >
        מוצר זה הינו POC בלבד ומוגבל ביכולותיו. השימוש בתוכנה אינו מהווה תחליף להערכה רפואית מקצועית. 
        השימוש באתר מהווה הסכמה לתנאי השימוש.
      </Alert>
    </div>
  );
} 