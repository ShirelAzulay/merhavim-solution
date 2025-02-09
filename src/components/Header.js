import React from 'react';
import Button from '@cloudscape-design/components/button';
import logo from './assets/מרחבים.jpg';

export default function Header() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#ffffff',
        padding: '16px 32px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        direction: 'ltr',
        width: '100%',
        boxSizing: 'border-box',
        
      }}
    >
      {/* Left: Logo */}
      <div style={{ width: '200px' }}>
        <img
          src={logo}
          alt="Merhavim Logo"
          style={{
            height: '50px',
            objectFit: 'contain',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
          }}
        />
      </div>

      {/* Center: Hospital Name */}
      <div
        style={{
          flex: 1,
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontWeight: '600',
            fontSize: '24px',
            color: '#16191f',
            textShadow: 'none',
          }}
        >
          מרכז רפואי מרחבים
        </span>
      </div>

      {/* Right: Doctor Name and Buttons */}
      <div
        style={{
          width: 'auto',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {['external', 'notification', 'settings'].map((iconName, index) => (
          <React.Fragment key={iconName}>
            {index > 0 && (
              <div
                style={{
                  height: '24px',
                  width: '1px',
                  backgroundColor: '#e9ebed',
                  margin: '0 4px',
                }}
              />
            )}
            <Button
              variant="icon"
              iconName={iconName}
              style={{
                backgroundColor: 'transparent',
                borderRadius: '4px',
                transition: 'all 0.2s ease',
                padding: '4px',
              }}
            />
          </React.Fragment>
        ))}
        <div
          style={{
            height: '24px',
            width: '1px',
            backgroundColor: '#e9ebed',
            margin: '0 4px',
          }}
        />
        <span
          style={{
            fontWeight: '500',
            color: '#16191f',
          }}
        >
          ד״ר גדי כהן רפפורט
        </span>
      </div>
    </div>
  );
}
