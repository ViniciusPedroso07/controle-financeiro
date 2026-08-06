import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import ControleDiario from './ControleDiario';
import TelaLogin from './TelaLogin';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function App() {
  const [familyCode, setFamilyCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    // Verifica se tem um código salvo localmente
    const saved = localStorage.getItem('family_code');
    if (saved) {
      setFamilyCode(saved);
    }
    setLoading(false);
  }, []);

  const handleEntrar = async (codigo) => {
    setCarregando(true);
    try {
      // Verifica se existe a família
      const { data, error } = await supabase
        .from('families')
        .select('id')
        .eq('code', codigo.toUpperCase())
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        // Cria uma nova família
        const { data: newFamily, error: createError } = await supabase
          .from('families')
          .insert([{ code: codigo.toUpperCase(), data: {} }])
          .select()
          .single();

        if (createError) throw createError;
        localStorage.setItem('family_code', codigo.toUpperCase());
        setFamilyCode(codigo.toUpperCase());
      } else {
        localStorage.setItem('family_code', codigo.toUpperCase());
        setFamilyCode(codigo.toUpperCase());
      }
    } catch (err) {
      alert('Erro ao conectar: ' + err.message);
    } finally {
      setCarregando(false);
    }
  };

  const handleSair = () => {
    localStorage.removeItem('family_code');
    setFamilyCode(null);
  };

  if (loading) {
    return (
      <div style={{
        background: 'var(--paper)',
        color: 'var(--soft)',
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'system-ui'
      }}>
        Abrindo...
      </div>
    );
  }

  if (!familyCode) {
    return <TelaLogin onEntrar={handleEntrar} carregando={carregando} />;
  }

  return <ControleDiario familyCode={familyCode} supabase={supabase} onSair={handleSair} />;
}
