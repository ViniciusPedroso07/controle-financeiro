import React from 'react';

export default function TelaLogin({ onEntrarComGoogle, erro }) {
  return (
    <div style={{
      background: 'var(--paper)', minHeight: '100vh', display: 'grid',
      placeItems: 'center', padding: '20px', fontFamily: 'system-ui',
    }}>
      <div style={{ maxWidth: '360px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            fontFamily: "'Bricolage Grotesque', system-ui",
            fontSize: 'clamp(40px, 9vw, 60px)', fontWeight: 800,
            letterSpacing: '-0.035em', lineHeight: 1, color: 'var(--ink)',
          }}>
            Vistta
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px',
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'var(--soft)', marginTop: '10px',
          }}>
            Controle Financeiro
          </div>
        </div>

        <p style={{
          fontSize: '14px', color: 'var(--soft)', marginBottom: '28px',
          lineHeight: 1.6, textAlign: 'center',
        }}>
          Compartilhado entre dispositivos em tempo real. Cada pessoa entra com
          sua própria conta.
        </p>

        <button
          onClick={onEntrarComGoogle}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '10px', background: '#fff', color: 'var(--ink)',
            border: '1px solid var(--rule)', borderRadius: '10px', padding: '13px',
            fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
          </svg>
          Continuar com Google
        </button>

        {erro && (
          <div style={{
            border: '1px solid var(--rosePale)', background: 'var(--rosePale)', color: 'var(--rose)',
            borderRadius: '10px', padding: '10px 13px', fontSize: '13px', marginTop: '16px',
          }}>
            {erro}
          </div>
        )}
      </div>
    </div>
  );
}
