import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import ControleDiario from './ControleDiario';
import TelaLogin from './TelaLogin';
import TelaFamilia from './TelaFamilia';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function App() {
  const [sessao, setSessao] = useState(null);
  const [familyId, setFamilyId] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // observa o login/logout do Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setCarregando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // depois de logado, descobre se já tem família
  useEffect(() => {
    if (!sessao) { setFamilyId(null); return; }

    (async () => {
      const { data, error } = await supabase.rpc('my_family_id');
      if (error) { console.error(error); return; }
      setFamilyId(data || null);
    })();
  }, [sessao]);

  const entrarComGoogle = async () => {
    setErro('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) setErro('Não foi possível conectar com o Google: ' + error.message);
  };

  const sair = async () => {
    await supabase.auth.signOut();
    setFamilyId(null);
  };

  const criarFamilia = async (nome) => {
    const { data, error } = await supabase.rpc('create_family', { p_name: nome });
    if (error) throw error;
    setFamilyId(data);
  };

  const reivindicarCodigoAntigo = async (codigo) => {
    const { data, error } = await supabase.rpc('claim_family_by_code', { p_code: codigo });
    if (error) throw error;
    setFamilyId(data);
  };

  const aceitarConvite = async (codigo) => {
    const { data, error } = await supabase.rpc('accept_invite', { p_code: codigo });
    if (error) throw error;
    setFamilyId(data);
  };

  if (carregando) {
    return (
      <div style={{
        background: '#EEF0EA', color: '#63736C', minHeight: '100vh',
        display: 'grid', placeItems: 'center', fontFamily: 'system-ui',
      }}>
        Abrindo...
      </div>
    );
  }

  if (!sessao) {
    return <TelaLogin onEntrarComGoogle={entrarComGoogle} erro={erro} />;
  }

  if (!familyId) {
    return (
      <TelaFamilia
        email={sessao.user.email}
        onCriar={criarFamilia}
        onReivindicar={reivindicarCodigoAntigo}
        onAceitarConvite={aceitarConvite}
        onSair={sair}
      />
    );
  }

  return <ControleDiario familyId={familyId} supabase={supabase} onSair={sair} />;
}
