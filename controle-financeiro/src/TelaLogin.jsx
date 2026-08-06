import React, { useState } from 'react';

export default function TelaLogin({ onEntrar, carregando }) {
  const [codigo, setCodigo] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (codigo.trim().length >= 3) {
      onEntrar(codigo.trim());
    }
  };

  return (
    <div style={{
      background: 'var(--paper)',
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: '20px',
      fontFamily: 'system-ui'
    }}>
      <div style={{
        maxWidth: '380px',
        width: '100%'
      }}>
        <div style={{
          fontFamily: "'Bricolage Grotesque', system-ui",
          fontSize: 'clamp(32px, 6vw, 48px)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 0.92,
          marginBottom: '8px',
          color: 'var(--ink)'
        }}>
          Controle<br />Financeiro
        </div>

        <p style={{
          fontSize: '14px',
          color: 'var(--soft)',
          marginBottom: '32px',
          lineHeight: 1.6
        }}>
          Compartilhado com sua esposa em tempo real. Sincroniza automaticamente nos dois celulares.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{
            display: 'block',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '11px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--soft)',
            marginBottom: '8px'
          }}>
            Código da família
          </label>

          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="ex: ABC123"
            maxLength="6"
            style={{
              width: '100%',
              border: '1px solid var(--rule)',
              background: 'var(--card)',
              borderRadius: '10px',
              padding: '12px 14px',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--ink)',
              marginBottom: '12px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}
            onFocus={(e) => e.target.style.outline = '2px solid var(--deep)'}
            onBlur={(e) => e.target.style.outline = 'none'}
          />

          <p style={{
            fontSize: '12px',
            color: 'var(--soft)',
            marginBottom: '20px',
            lineHeight: 1.6
          }}>
            Use o mesmo código no celular da sua esposa para sincronizar automaticamente.
            Se for primeira vez, cria um novo.
          </p>

          <button
            type="submit"
            disabled={codigo.trim().length < 3 || carregando}
            style={{
              width: '100%',
              background: codigo.trim().length >= 3 ? 'var(--ink)' : 'var(--rule)',
              color: codigo.trim().length >= 3 ? 'var(--paper)' : 'var(--soft)',
              border: 'none',
              borderRadius: '10px',
              padding: '12px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '15px',
              fontWeight: 600,
              cursor: codigo.trim().length >= 3 ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
              opacity: carregando ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (codigo.trim().length >= 3 && !carregando) {
                e.target.style.background = '#22382F';
              }
            }}
            onMouseLeave={(e) => {
              if (codigo.trim().length >= 3 && !carregando) {
                e.target.style.background = 'var(--ink)';
              }
            }}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{
          marginTop: '32px',
          padding: '14px',
          background: 'var(--card)',
          border: '1px solid var(--rule)',
          borderRadius: '10px',
          fontSize: '12px',
          color: 'var(--soft)',
          lineHeight: 1.7
        }}>
          <strong style={{ color: 'var(--ink)' }}>💡 Dica:</strong> Ambos usam o mesmo código. Um cria (ou testa), o outro entra. Automático!
        </div>
      </div>
    </div>
  );
}
