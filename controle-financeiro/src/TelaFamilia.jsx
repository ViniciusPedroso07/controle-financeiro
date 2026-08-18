import React, { useState } from 'react';

const CAMPO = {
  width: '100%', border: '1px solid var(--rule)', background: 'var(--card)',
  borderRadius: '10px', padding: '11px 13px', fontFamily: "'IBM Plex Mono', monospace",
  fontSize: '15px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '0.06em',
  textTransform: 'uppercase', marginBottom: '10px',
};

const BOTAO = (ativo) => ({
  width: '100%', background: ativo ? 'var(--ink)' : 'var(--rule)',
  color: ativo ? 'var(--paper)' : 'var(--soft)', border: 'none', borderRadius: '10px',
  padding: '11px', fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600,
  cursor: ativo ? 'pointer' : 'not-allowed', transition: 'opacity .15s',
});

export default function TelaFamilia({ email, onCriar, onReivindicar, onAceitarConvite, onSair }) {
  const [modo, setModo] = useState(null); // null | 'criar' | 'codigo'
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const criar = async (e) => {
    e.preventDefault();
    setCarregando(true); setErro('');
    try {
      await onCriar(nome.trim() || 'Minha família');
    } catch (err) {
      setErro(err.message || 'Não foi possível criar a família.');
    } finally {
      setCarregando(false);
    }
  };

  // Um código pode ser: um convite novo (accept_invite) ou o código antigo
  // de antes do login com Google (claim_family_by_code). Tenta os dois —
  // o que existir, funciona; se nenhum existir, mostra o erro.
  const usarCodigo = async (e) => {
    e.preventDefault();
    setCarregando(true); setErro('');
    const cod = codigo.trim();
    try {
      await onAceitarConvite(cod);
      return;
    } catch (_erroConvite) {
      // não era um convite válido — tenta como código antigo
    }
    try {
      await onReivindicar(cod);
    } catch (err) {
      setErro('Código inválido, expirado ou já usado.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{
      background: 'var(--paper)', minHeight: '100vh', display: 'grid',
      placeItems: 'center', padding: '20px', fontFamily: 'system-ui',
    }}>
      <div style={{ maxWidth: '380px', width: '100%' }}>
        <div style={{
          fontFamily: "'Bricolage Grotesque', system-ui", fontSize: '28px', fontWeight: 800,
          letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: '6px',
        }}>
          Olá!
        </div>
        <p style={{ fontSize: '13px', color: 'var(--soft)', marginBottom: '28px', lineHeight: 1.6 }}>
          Você entrou como <strong style={{ color: 'var(--ink)' }}>{email}</strong>. Agora escolha:
          começar uma família nova, ou entrar numa que já existe com um código.
        </p>

        {!modo && (
          <div style={{ display: 'grid', gap: '10px' }}>
            <button onClick={() => setModo('criar')} style={{
              width: '100%', textAlign: 'left', border: '1px solid var(--rule)', background: 'var(--card)',
              borderRadius: '12px', padding: '14px 16px', cursor: 'pointer',
            }}>
              <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--ink)' }}>
                Criar uma família
              </div>
              <div style={{ fontSize: '12px', color: 'var(--soft)', marginTop: '3px' }}>
                Você vira o dono e pode convidar outras pessoas depois.
              </div>
            </button>

            <button onClick={() => setModo('codigo')} style={{
              width: '100%', textAlign: 'left', border: '1px solid var(--rule)', background: 'var(--card)',
              borderRadius: '12px', padding: '14px 16px', cursor: 'pointer',
            }}>
              <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--ink)' }}>
                Tenho um código
              </div>
              <div style={{ fontSize: '12px', color: 'var(--soft)', marginTop: '3px' }}>
                Convite de alguém, ou o código que você já usava antes.
              </div>
            </button>
          </div>
        )}

        {modo === 'criar' && (
          <form onSubmit={criar}>
            <label style={{
              display: 'block', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px',
              letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--soft)', marginBottom: '8px',
            }}>
              Nome da família (opcional)
            </label>
            <input
              type="text" value={nome} onChange={(e) => setNome(e.target.value)}
              placeholder="ex: Família Pedroso"
              style={{ ...CAMPO, textTransform: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 400 }}
            />
            <button type="submit" disabled={carregando} style={BOTAO(true)}>
              {carregando ? 'Criando...' : 'Criar família'}
            </button>
            <button type="button" onClick={() => { setModo(null); setErro(''); }} style={{
              width: '100%', background: 'transparent', border: 'none', color: 'var(--soft)',
              fontSize: '13px', padding: '10px', cursor: 'pointer',
            }}>
              Voltar
            </button>
          </form>
        )}

        {modo === 'codigo' && (
          <form onSubmit={usarCodigo}>
            <label style={{
              display: 'block', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px',
              letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--soft)', marginBottom: '8px',
            }}>
              Código
            </label>
            <input
              type="text" value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="ABCD12" maxLength={6} style={CAMPO}
            />
            <button type="submit" disabled={carregando || codigo.length < 3} style={BOTAO(codigo.length >= 3)}>
              {carregando ? 'Verificando...' : 'Entrar'}
            </button>
            <button type="button" onClick={() => { setModo(null); setErro(''); }} style={{
              width: '100%', background: 'transparent', border: 'none', color: 'var(--soft)',
              fontSize: '13px', padding: '10px', cursor: 'pointer',
            }}>
              Voltar
            </button>
          </form>
        )}

        {erro && (
          <div style={{
            border: '1px solid var(--rosePale)', background: 'var(--rosePale)', color: 'var(--rose)',
            borderRadius: '10px', padding: '10px 13px', fontSize: '13px', marginTop: '14px',
          }}>
            {erro}
          </div>
        )}

        <button onClick={onSair} style={{
          display: 'block', margin: '28px auto 0', background: 'transparent', border: 'none',
          color: 'var(--soft)', fontSize: '12.5px', cursor: 'pointer', textDecoration: 'underline',
        }}>
          Sair
        </button>
      </div>
    </div>
  );
}
