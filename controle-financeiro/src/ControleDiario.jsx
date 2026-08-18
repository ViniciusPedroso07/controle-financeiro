import React, { useState, useEffect, useMemo, useRef } from 'react';

const C = {
  paper: '#EEF0EA',
  card: '#F7F8F4',
  ink: '#12211C',
  soft: '#63736C',
  rule: '#D5DAD1',
  deep: '#1E6B57',
  mid: '#2F8B6E',
  pale: '#CFE3D6',
  rose: '#7E2B26',
  rosePale: '#F0D6D2',
  amber: '#B4832A',
  steel: '#48607A',
};

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const ABREV = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const DIAS_SEM = ["dom","seg","ter","qua","qui","sex","sáb"];

// sugestões de categoria — a pessoa pode digitar qualquer outra
const CAT_SUGESTOES = ["Cartão de crédito","Mercado","Comer fora","Transporte","Saúde","Lazer","Compras","Viagem","Casa","Educação","Presentes","Outros"];

const RENDAS_INICIAIS = [{ id: "r1", nome: "", dia: 5, valor: "" }];
const FIXOS_INICIAIS = [{ id: "f1", nome: "", dia: 10, valor: "" }];
const VARIAVEIS_INICIAIS = [{ id: "v1", nome: "", dia: 10, valor: "", categoria: "" }];

const PADRAO = {
  ano: new Date().getFullYear(),
  rendas: RENDAS_INICIAIS,
  fixos: FIXOS_INICIAIS,
  contasVariaveis: VARIAVEIS_INICIAIS,
  dias: {},
};

const num = (v) => {
  if (v === "" || v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const brl = (n) =>
  (n < 0 ? "-" : "") + "R$ " + Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const curto = (n) => {
  const a = Math.abs(n);
  if (a >= 1000) return (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
};

// Converte o formato antigo (um gasto + uma entrada por dia) para lista de lançamentos.
// Roda ao carregar, então os dados que já existem continuam valendo.
const normalizarDias = (dias = {}) => {
  const saida = {};
  Object.entries(dias).forEach(([k, reg]) => {
    if (!reg) return;
    if (Array.isArray(reg.lancamentos)) { saida[k] = reg; return; }
    const lista = [];
    if (num(reg.entrada) > 0) {
      lista.push({ id: `${k}-e`, tipo: 'entrada', valor: reg.entrada, categoria: '' });
    }
    if (num(reg.valor) > 0) {
      lista.push({ id: `${k}-s`, tipo: 'saida', valor: reg.valor, categoria: reg.categoria || '' });
    }
    if (lista.length) saida[k] = { lancamentos: lista };
  });
  return saida;
};

// Valor de um item no mês pedido.
// Se o mês não tem valor próprio, herda do mês preenchido mais recente antes dele.
// Se nenhum mês anterior tem valor, usa o valor base do item.
const valorNoMes = (item, mes) => {
  const porMes = item.valores || {};
  for (let m = mes; m >= 0; m--) {
    const v = porMes[m];
    if (v !== undefined && v !== null) return v;
  }
  return item.valor ?? '';
};

// O mês tem valor próprio (foi editado nele) ou está herdando de outro?
const origemDoValor = (item, mes) => {
  const porMes = item.valores || {};
  if (porMes[mes] !== undefined && porMes[mes] !== null) return { proprio: true, de: mes };
  for (let m = mes - 1; m >= 0; m--) {
    if (porMes[m] !== undefined && porMes[m] !== null) return { proprio: false, de: m };
  }
  return { proprio: false, de: null };
};

const diasNoMes = (ano, mes) => new Date(ano, mes + 1, 0).getDate();
const chaveDia = (ano, mes, dia) => `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

export default function ControleDiario({ familyCode, supabase, onSair }) {
  const [d, setD] = useState(PADRAO);
  const [mes, setMes] = useState(new Date().getMonth());
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState("");
  const [abrirPainel, setAbrirPainel] = useState(true);
  const [ehMobile, setEhMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 760 : false);
  const syncRef = useRef(null);
  const trilhaRef = useRef(null);
  const mesAtivoRef = useRef(null);

  // deixa o mês selecionado visível na trilha, sem precisar arrastar
  useEffect(() => {
    if (!mesAtivoRef.current || !trilhaRef.current) return;
    const trilha = trilhaRef.current;
    const botao = mesAtivoRef.current;
    const alvo = botao.offsetLeft - (trilha.clientWidth / 2) + (botao.clientWidth / 2);
    trilha.scrollTo({ left: Math.max(0, alvo), behavior: 'smooth' });
  }, [mes, carregando, ehMobile]);

  useEffect(() => {
    const aoRedimensionar = () => setEhMobile(window.innerWidth < 760);
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);

  // Carregar dados do Supabase
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data, error } = await supabase
          .from('families')
          .select('data')
          .eq('code', familyCode)
          .single();

        if (error) throw error;

        if (data && data.data && Object.keys(data.data).length > 0) {
          const vindo = data.data;
          setD({ ...PADRAO, ...vindo, dias: normalizarDias(vindo.dias) });
        }
      } catch (err) {
        console.error('Erro ao carregar:', err);
        setAviso('Erro ao carregar dados do servidor');
      } finally {
        setCarregando(false);
      }
    };
    loadData();
  }, [familyCode]);

  // Salvar (debounce de 1s)
  useEffect(() => {
    if (carregando) return;
    if (syncRef.current) clearTimeout(syncRef.current);
    syncRef.current = setTimeout(async () => {
      try {
        await supabase.from('families').update({ data: d }).eq('code', familyCode);
      } catch (err) {
        console.error('Erro ao sincronizar:', err);
        setAviso('Erro ao salvar no servidor');
      }
    }, 1000);
    return () => clearTimeout(syncRef.current);
  }, [d]);

  // Tempo real
  useEffect(() => {
    const channel = supabase
      .channel(`family-${familyCode}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'families', filter: `code=eq.${familyCode}` },
        (payload) => {
          if (payload.new && payload.new.data) {
            const vindo = payload.new.data;
            setD({ ...PADRAO, ...vindo, dias: normalizarDias(vindo.dias) });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [familyCode]);

  const hoje = new Date();
  const hojeChave = chaveDia(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  // O controle começa sozinho no primeiro mês em que existe algo preenchido —
  // seja um valor de ganho/conta ou um lançamento no calendário.
  const mesInicial = useMemo(() => {
    let menor = null;
    const considerar = (m) => { if (m !== null && (menor === null || m < menor)) menor = m; };

    ['rendas', 'fixos', 'contasVariaveis'].forEach((chave) => {
      (d[chave] || []).forEach((item) => {
        Object.entries(item.valores || {}).forEach(([m, v]) => {
          if (num(v) > 0) considerar(Number(m));
        });
      });
    });

    Object.entries(d.dias || {}).forEach(([k, reg]) => {
      const temValor = (reg?.lancamentos || []).some((l) => num(l.valor) > 0);
      if (!temValor) return;
      const [ano, mesTexto] = k.split('-');
      if (Number(ano) !== d.ano) return;
      considerar(Number(mesTexto) - 1);
    });

    if (menor !== null) return menor;

    // dados antigos, com valor base sem mês associado: mantém o que já estava salvo
    const temValorBase = ['rendas', 'fixos', 'contasVariaveis']
      .some((chave) => (d[chave] || []).some((item) => num(item.valor) > 0));
    if (temValorBase && d.mesInicial != null) return d.mesInicial;

    return hoje.getMonth();
  }, [d]);

  const calc = useMemo(() => {
    const saldos = {};
    const mesesInfo = [];
    let saldo = 0;


    for (let m = 0; m < 12; m++) {
      const antes = m < mesInicial;
      const total = diasNoMes(d.ano, m);

      if (antes) {
        for (let dia = 1; dia <= total; dia++) saldos[chaveDia(d.ano, m, dia)] = 0;
        mesesInfo.push({ abertura: 0, ganhos: 0, fixos: 0, baseDia: 0, variaveis: 0, sobra: 0, fim: 0, cats: {}, dias: total });
        continue;
      }

      const abertura = saldo;
      const ganhosTotal = d.rendas.reduce((acc, r) => acc + num(valorNoMes(r, m)), 0);
      const fixosTotal = d.fixos.reduce((acc, f) => acc + num(valorNoMes(f, m)), 0);
      const baseDia = total > 0 ? (ganhosTotal - fixosTotal) / total : 0;
      let variaveis = 0;
      let entradasAvulsasMes = 0;
      const cats = {};

      for (let dia = 1; dia <= total; dia++) {
        const k = chaveDia(d.ano, m, dia);
        const reg = d.dias[k] || {};
        const lancs = Array.isArray(reg.lancamentos) ? reg.lancamentos : [];
        let avulso = 0;
        let entradaAvulsa = 0;
        lancs.forEach((l) => {
          const v = num(l.valor);
          if (v <= 0) return;
          if (l.tipo === 'entrada') entradaAvulsa += v;
          else avulso += v;
        });

        const ent = d.rendas.reduce((acc, r) => (Number(r.dia) === dia ? acc + num(valorNoMes(r, m)) : acc), 0);
        const fix = d.fixos.reduce((acc, f) => (Number(f.dia) === dia ? acc + num(valorNoMes(f, m)) : acc), 0);

        let varPlanejada = 0;
        d.contasVariaveis.forEach((x) => {
          if (Number(x.dia) === dia) {
            const val = num(valorNoMes(x, m));
            varPlanejada += val;
            if (val > 0) {
              const c = (x.categoria && x.categoria.trim()) || (x.nome && x.nome.trim()) || 'Sem categoria';
              cats[c] = (cats[c] || 0) + val;
            }
          }
        });

        saldo = saldo + ent + entradaAvulsa - fix - varPlanejada - avulso;
        saldos[k] = saldo;

        lancs.forEach((l) => {
          const v = num(l.valor);
          if (v <= 0 || l.tipo === 'entrada') return;
          const c = (l.categoria && l.categoria.trim()) || 'Sem categoria';
          cats[c] = (cats[c] || 0) + v;
        });
        variaveis += varPlanejada + avulso;
        entradasAvulsasMes += entradaAvulsa;
      }

      mesesInfo.push({
        abertura, ganhos: ganhosTotal + entradasAvulsasMes, fixos: fixosTotal, baseDia, variaveis,
        sobra: ganhosTotal + entradasAvulsasMes - fixosTotal - variaveis,
        fim: saldo, cats, dias: total,
        variaveisPlanejadas: d.contasVariaveis.reduce((acc, v) => acc + num(valorNoMes(v, m)), 0),
      });
    }
    return { saldos, mesesInfo };
  }, [d]);

  const temAlgumDado = useMemo(() => {
    const temItem = ['rendas', 'fixos', 'contasVariaveis'].some((chave) =>
      (d[chave] || []).some((item) =>
        num(item.valor) > 0 || Object.values(item.valores || {}).some((v) => num(v) > 0)
      )
    );
    if (temItem) return true;
    return Object.values(d.dias || {}).some((reg) =>
      (reg?.lancamentos || []).some((l) => num(l.valor) > 0)
    );
  }, [d]);

  const r = calc.mesesInfo[mes];
  const totalDias = r.dias;
  const mediaGasta = totalDias > 0 ? r.variaveis / totalDias : 0;
  const noRitmo = mediaGasta <= r.baseDia;
  const antesDoInicio = mes < mesInicial;

  // categorias já usadas, para sugerir na lista
  const categoriasUsadas = useMemo(() => {
    const usadas = new Set();
    d.contasVariaveis.forEach((v) => { if (v.categoria && v.categoria.trim()) usadas.add(v.categoria.trim()); });
    Object.values(d.dias).forEach((reg) => {
      (reg?.lancamentos || []).forEach((l) => { if (l.categoria && l.categoria.trim()) usadas.add(l.categoria.trim()); });
    });
    CAT_SUGESTOES.forEach((c) => usadas.add(c));
    return Array.from(usadas);
  }, [d]);

  const setPadrao = (lista, id, campo, valor) =>
    setD((p) => ({ ...p, [lista]: p[lista].map((i) => (i.id === id ? { ...i, [campo]: valor } : i)) }));

  // grava o valor apenas no mês aberto; os meses seguintes herdam automaticamente
  const setValorDoMes = (lista, id, valor) =>
    setD((p) => ({
      ...p,
      [lista]: p[lista].map((i) => (i.id === id ? { ...i, valores: { ...(i.valores || {}), [mes]: valor } } : i)),
    }));

  // remove o valor próprio do mês, voltando a herdar do mês anterior
  const voltarAHerdar = (lista, id) =>
    setD((p) => ({
      ...p,
      [lista]: p[lista].map((i) => {
        if (i.id !== id) return i;
        const valores = { ...(i.valores || {}) };
        delete valores[mes];
        return { ...i, valores };
      }),
    }));

  const listaDoDia = (p, k) => (Array.isArray(p.dias[k]?.lancamentos) ? p.dias[k].lancamentos : []);

  const addLancamento = (dia, tipo = 'saida') => {
    const k = chaveDia(d.ano, mes, dia);
    setD((p) => ({
      ...p,
      dias: {
        ...p.dias,
        [k]: { lancamentos: [...listaDoDia(p, k), { id: `l${Date.now()}${Math.random().toString(36).slice(2, 6)}`, tipo, valor: '', categoria: '' }] },
      },
    }));
  };

  const setLancamento = (dia, id, campo, valor) => {
    const k = chaveDia(d.ano, mes, dia);
    setD((p) => ({
      ...p,
      dias: {
        ...p.dias,
        [k]: { lancamentos: listaDoDia(p, k).map((l) => (l.id === id ? { ...l, [campo]: valor } : l)) },
      },
    }));
  };

  const delLancamento = (dia, id) => {
    const k = chaveDia(d.ano, mes, dia);
    setD((p) => {
      const restante = listaDoDia(p, k).filter((l) => l.id !== id);
      const dias = { ...p.dias };
      if (restante.length) dias[k] = { lancamentos: restante };
      else delete dias[k];
      return { ...p, dias };
    });
  };

  const addLinha = (lista) =>
    setD((p) => ({
      ...p,
      [lista]: [...p[lista], {
        id: `${lista}${Date.now()}`, nome: "", dia: 10, valor: "",
        ...(lista === 'contasVariaveis' ? { categoria: "" } : {}),
      }],
    }));
  const delLinha = (lista, id) => setD((p) => ({ ...p, [lista]: p[lista].filter((i) => i.id !== id) }));

  const reordenar = (lista, de, para) => {
    if (de === para) return;
    setD((p) => {
      const copia = [...p[lista]];
      const [movido] = copia.splice(de, 1);
      copia.splice(para, 0, movido);
      return { ...p, [lista]: copia };
    });
  };

  const catsOrdenadas = Object.entries(r.cats).sort((a, b) => b[1] - a[1]);
  const maxCat = catsOrdenadas.length ? catsOrdenadas[0][1] : 1;
  const totalCats = catsOrdenadas.reduce((s, [, v]) => s + v, 0);
  const maxMes = Math.max(1, ...Array.from({ length: totalDias }, (_, i) => Math.abs(calc.saldos[chaveDia(d.ano, mes, i + 1)] || 0)));

  const faixa = (v) => {
    if (v < 0) return { bg: C.rosePale, fg: C.rose, barra: C.rose };
    if (v >= maxMes * 0.5) return { bg: C.deep, fg: "#EEF0EA", barra: "#EEF0EA" };
    return { bg: C.pale, fg: C.deep, barra: C.mid };
  };

  if (carregando) {
    return (
      <div style={{ background: C.paper, color: C.soft, minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui' }}>
        Carregando seu controle…
      </div>
    );
  }

  // ── linhas do mês, usadas tanto na tabela (desktop) quanto nos cartões (celular) ──
  const linhasDoMes = Array.from({ length: totalDias }, (_, i) => {
    const dia = i + 1;
    const k = chaveDia(d.ano, mes, dia);
    const reg = d.dias[k] || {};
    const sem = new Date(d.ano, mes, dia).getDay();
    const lancs = Array.isArray(reg.lancamentos) ? reg.lancamentos : [];
    return {
      dia, k, reg, lancs,
      totalEntradas: lancs.reduce((t, l) => t + (l.tipo === 'entrada' ? num(l.valor) : 0), 0),
      totalSaidas: lancs.reduce((t, l) => t + (l.tipo !== 'entrada' ? num(l.valor) : 0), 0),
      saldo: calc.saldos[k] || 0,
      sem,
      fds: sem === 0 || sem === 6,
      ehHoje: k === hojeChave,
      ents: antesDoInicio ? [] : d.rendas.filter((x) => Number(x.dia) === dia && num(valorNoMes(x, mes)) > 0),
      fixs: antesDoInicio ? [] : d.fixos.filter((x) => Number(x.dia) === dia && num(valorNoMes(x, mes)) > 0),
      vars: antesDoInicio ? [] : d.contasVariaveis.filter((x) => Number(x.dia) === dia && num(valorNoMes(x, mes)) > 0),
    };
  });

  const etiqueta = (texto, bg, fg) => (
    <span style={{
      display: 'inline-block',
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '10.5px',
      padding: '3px 7px',
      borderRadius: '6px',
      background: bg,
      color: fg,
      whiteSpace: 'nowrap',
    }}>
      {texto}
    </span>
  );

  return (
    <div style={{
      background: C.paper,
      color: C.ink,
      minHeight: '100vh',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: ehMobile ? '16px 12px 48px' : '20px 16px 56px',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <style>{`
        * { box-sizing: border-box; }
        input, select, button { font-family: inherit; }
      `}</style>

      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '16px', gap: '10px', flexWrap: 'wrap',
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: C.soft,
          }}>
            {d.ano} · Código: <strong>{familyCode}</strong>
          </div>
          <button
            onClick={onSair}
            style={{
              border: `1px solid ${C.rule}`, background: 'transparent', color: C.ink,
              borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Sair
          </button>
        </div>

        <h1 style={{
          fontFamily: "'Bricolage Grotesque', system-ui",
          fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 0.95,
          margin: '6px 0 18px', fontSize: 'clamp(30px, 7vw, 52px)',
        }}>
          Vistta <span style={{
            fontWeight: 500,
            fontSize: '0.42em',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: C.soft,
            whiteSpace: 'nowrap',
          }}>— Controle Financeiro</span>
        </h1>

        <p style={{ fontSize: '12px', color: C.soft, margin: '0 0 16px', lineHeight: 1.6 }}>
          {temAlgumDado
            ? `O controle começa em ${MESES[mesInicial].toLowerCase()} — o primeiro mês que você preencheu. Meses anteriores ficam zerados.`
            : 'Preencha um ganho, uma conta ou um lançamento e o controle começa a contar daquele mês em diante.'}
        </p>

        {/* saldo do mês — centralizado, sem menção a quem usa */}
        <div style={{
          border: `1px solid ${C.rule}`, background: C.card, borderRadius: '14px',
          padding: ehMobile ? '20px 16px' : '26px 20px', margin: '18px 0', textAlign: 'center',
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
            letterSpacing: '0.12em', textTransform: 'uppercase', color: C.soft, marginBottom: '8px',
          }}>
            Saldo no fim de {MESES[mes].toLowerCase()}
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
            fontWeight: 600, fontSize: 'clamp(28px, 8vw, 44px)', lineHeight: 1,
            color: r.fim < 0 ? C.rose : C.deep,
          }}>
            {brl(r.fim)}
          </div>
          {antesDoInicio && (
            <div style={{ fontSize: '12px', color: C.soft, marginTop: '10px' }}>
              Este mês fica zerado — o controle começa em {MESES[mesInicial].toLowerCase()}.
            </div>
          )}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '8px', marginBottom: '6px',
          }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
              letterSpacing: '0.12em', textTransform: 'uppercase', color: C.soft,
            }}>
              Meses do ano
            </span>
            <span style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '11px', color: C.soft,
            }}>
              arraste para ver todos
              <span aria-hidden="true" style={{ fontSize: '13px', lineHeight: 1 }}>↔</span>
            </span>
          </div>

          <div style={{ position: 'relative' }}>
            <div
              ref={trilhaRef}
              style={{
                display: 'flex', gap: '4px', overflowX: 'auto',
                paddingBottom: '6px', paddingRight: '26px',
                scrollbarWidth: 'thin',
              }}
            >
              {MESES.map((m, i) => {
                const v = calc.mesesInfo[i].fim;
                const on = i === mes;
                const desativado = i < mesInicial;
                return (
                  <button
                    key={m}
                    ref={on ? mesAtivoRef : null}
                    onClick={() => setMes(i)}
                    style={{
                      flex: '1 0 auto', minWidth: '66px',
                      border: `1px solid ${on ? C.ink : C.rule}`,
                      background: on ? C.ink : 'transparent',
                      borderRadius: '9px', padding: '8px 6px', cursor: 'pointer', textAlign: 'left',
                      opacity: desativado && !on ? 0.45 : 1,
                    }}
                  >
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: on ? '#AFC0B7' : C.soft,
                    }}>
                      {ABREV[i]}
                    </div>
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                      fontSize: '13px', fontWeight: 600, marginTop: '3px',
                      color: on ? (v < 0 ? '#F0A9A3' : '#8FD9BE') : v < 0 ? C.rose : C.deep,
                    }}>
                      {curto(v)}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* desbotado na borda direita: mostra que tem mais conteúdo para o lado */}
            <div aria-hidden="true" style={{
              position: 'absolute', top: 0, right: 0, bottom: '6px', width: '34px',
              background: `linear-gradient(to right, rgba(238,240,234,0), ${C.paper})`,
              pointerEvents: 'none',
            }} />
          </div>
        </div>

        {aviso && (
          <div style={{
            border: `1px solid ${C.rosePale}`, background: C.rosePale, color: C.rose,
            borderRadius: '10px', padding: '10px 13px', fontSize: '13px', margin: '14px 0',
          }}>
            {aviso}
          </div>
        )}

        {/* base por dia */}
        <div style={{
          border: `1px solid ${C.pale}`, background: '#E7F0E9', borderRadius: '12px',
          padding: '16px 18px', marginBottom: '18px',
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
            letterSpacing: '0.12em', textTransform: 'uppercase', color: C.soft,
          }}>
            Base por dia em {MESES[mes].toLowerCase()}
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
            fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 600, lineHeight: 1, marginTop: '6px',
            color: r.baseDia < 0 ? C.rose : C.deep,
          }}>
            {brl(r.baseDia)}
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 400, color: C.soft, marginLeft: 12 }}>
              · {brl(r.baseDia * 7)} por semana
            </span>
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '11.5px',
            color: C.soft, marginTop: '10px', lineHeight: 1.7,
          }}>
            ({brl(r.ganhos)} de ganhos − {brl(r.fixos)} de contas fixas) ÷ {totalDias} dias
          </div>
          <p style={{ fontSize: '12px', color: C.soft, marginTop: '10px', lineHeight: 1.6 }}>
            {antesDoInicio
              ? `Mês anterior a ${MESES[mesInicial].toLowerCase()}, quando o controle começa.`
              : r.variaveis > 0 ? (
                <>
                  Você já gastou <strong style={{ color: noRitmo ? C.deep : C.rose }}>{brl(mediaGasta)} por dia</strong> em
                  média este mês — {noRitmo ? 'dentro da base.' : 'acima da base.'}
                </>
              ) : 'Lance os gastos na tabela e este número ganha um comparativo do quanto você está gastando de verdade.'}
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: ehMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px', margin: '18px 0',
        }}>
          {[
            { lab: "Vem do mês anterior", val: brl(r.abertura), cor: r.abertura < 0 ? C.rose : C.ink },
            { lab: "Ganhos", val: brl(r.ganhos), cor: C.deep },
            { lab: "Contas fixas", val: brl(r.fixos), cor: C.steel },
            { lab: "Variáveis", val: brl(r.variaveis), cor: C.amber },
            { lab: "Sobra do mês", val: brl(r.sobra), cor: r.sobra < 0 ? C.rose : C.deep },
          ].map((box, i) => (
            <div key={i} style={{
              border: `1px solid ${C.rule}`, background: C.card, borderRadius: '11px', padding: '12px 13px',
            }}>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                letterSpacing: '0.12em', textTransform: 'uppercase', color: C.soft,
              }}>
                {box.lab}
              </div>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                fontSize: '16px', fontWeight: 600, marginTop: '5px', color: box.cor,
              }}>
                {box.val}
              </div>
            </div>
          ))}
        </div>

        {/* painel dos três blocos */}
        <div style={{
          border: `1px solid ${C.rule}`, background: C.card, borderRadius: '14px',
          padding: ehMobile ? '14px' : '16px 18px', marginBottom: '18px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '12px', flexWrap: 'wrap', marginBottom: '16px',
          }}>
            <div>
              <h2 style={{
                fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700,
                fontSize: '16px', letterSpacing: '-0.01em', margin: '0 0 3px',
              }}>
                Ganhos, contas fixas e variáveis
              </h2>
              <p style={{ fontSize: '12px', color: C.soft, margin: '3px 0 0' }}>
                Os valores são de <strong>{MESES[mes].toLowerCase()}</strong>. Se você não mexer num mês,
                ele repete o valor do mês anterior — então só edite quando a conta mudar.
              </p>
            </div>
            <button
              onClick={() => setAbrirPainel(!abrirPainel)}
              style={{
                border: `1px solid ${C.rule}`, background: 'transparent', color: C.ink,
                borderRadius: '9px', padding: '9px 14px', fontSize: '13px', fontWeight: 500,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {abrirPainel ? 'Fechar' : 'Abrir'}
            </button>
          </div>

          {abrirPainel && (
            <>
              <Bloco cor={C.deep} fundo="#DCEEE4" titulo="Entra">
                <TabelaItens
                  itens={d.rendas}
                  exemploNome="ex: Salário"
                  onNome={(id, v) => setPadrao('rendas', id, 'nome', v)}
                  onDia={(id, v) => setPadrao('rendas', id, 'dia', v)}
                  onValor={(id, v) => setValorDoMes('rendas', id, v)}
                  onHerdar={(id) => voltarAHerdar('rendas', id)}
                  mes={mes}
                  onDel={(id) => delLinha('rendas', id)}
                  onReordenar={(de, para) => reordenar('rendas', de, para)}
                />
                <BotaoAdd onClick={() => addLinha('rendas')}>+ Outra entrada</BotaoAdd>
                <Total label="Total que entra" valor={brl(r.ganhos)} cor={C.deep} />
              </Bloco>

              <Bloco cor={C.steel} fundo="#E1E7EF" titulo="Sai todo mês (contas fixas)">
                <TabelaItens
                  itens={d.fixos}
                  exemploNome="ex: Aluguel"
                  onNome={(id, v) => setPadrao('fixos', id, 'nome', v)}
                  onDia={(id, v) => setPadrao('fixos', id, 'dia', v)}
                  onValor={(id, v) => setValorDoMes('fixos', id, v)}
                  onHerdar={(id) => voltarAHerdar('fixos', id)}
                  mes={mes}
                  onDel={(id) => delLinha('fixos', id)}
                  onReordenar={(de, para) => reordenar('fixos', de, para)}
                />
                <BotaoAdd onClick={() => addLinha('fixos')}>+ Outra conta fixa</BotaoAdd>
                <Total label="Total de contas fixas" valor={brl(r.fixos)} cor={C.steel} />
              </Bloco>

              <Bloco cor={C.amber} fundo="#F3E6CC" titulo="Contas variáveis">
                <p style={{ fontSize: '12px', color: C.soft, marginTop: '-4px', marginBottom: '12px', lineHeight: 1.6 }}>
                  Gastos cujo valor você não sabe de antemão. Marque uma categoria para acompanhar no
                  ranking do mês.
                </p>
                <TabelaItens
                  itens={d.contasVariaveis}
                  exemploNome="ex: Rodízio japonês"
                  comCategoria
                  categorias={categoriasUsadas}
                  onNome={(id, v) => setPadrao('contasVariaveis', id, 'nome', v)}
                  onDia={(id, v) => setPadrao('contasVariaveis', id, 'dia', v)}
                  onValor={(id, v) => setValorDoMes('contasVariaveis', id, v)}
                  onHerdar={(id) => voltarAHerdar('contasVariaveis', id)}
                  mes={mes}
                  onCategoria={(id, v) => setPadrao('contasVariaveis', id, 'categoria', v)}
                  onDel={(id) => delLinha('contasVariaveis', id)}
                  onReordenar={(de, para) => reordenar('contasVariaveis', de, para)}
                />
                <BotaoAdd onClick={() => addLinha('contasVariaveis')}>+ Outra conta variável</BotaoAdd>
                <Total label="Total de contas variáveis" valor={brl(r.variaveisPlanejadas ?? 0)} cor={C.amber} />
              </Bloco>
            </>
          )}
        </div>

        {/* calendário do mês */}
        <h2 style={{
          fontFamily: "'Bricolage Grotesque', system-ui",
          fontSize: 'clamp(22px, 4.4vw, 30px)', fontWeight: 800, marginBottom: '4px',
        }}>
          {MESES[mes]}
        </h2>
        <p style={{ fontSize: '12px', color: C.soft, marginBottom: '12px' }}>
          Adicione quantos lançamentos quiser em cada dia. O resto entra sozinho.
        </p>

        {ehMobile ? (
          <div style={{ display: 'grid', gap: '8px', marginBottom: '18px' }}>
            {linhasDoMes.map((L) => {
              const cor = faixa(L.saldo);
              const temAuto = L.ents.length || L.fixs.length || L.vars.length;
              return (
                <div key={L.dia} style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: '12px',
                  border: `1px solid ${L.ehHoje ? C.amber : C.rule}`,
                  background: C.card,
                  borderRadius: '11px',
                  padding: '12px 13px',
                }}>
                  <div style={{
                    flex: 'none',
                    width: '42px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    borderRight: `1px solid ${C.rule}`,
                    paddingRight: '10px',
                  }}>
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: '20px',
                      fontWeight: 600,
                      lineHeight: 1,
                      letterSpacing: '-0.01em',
                      color: L.ehHoje ? C.amber : L.fds ? C.soft : C.ink,
                    }}>
                      {String(L.dia).padStart(2, '0')}
                    </div>
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: '9.5px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: L.ehHoje ? C.amber : C.soft,
                      marginTop: '4px',
                    }}>
                      {L.ehHoje ? 'hoje' : DIAS_SEM[L.sem]}
                    </div>
                  </div>

                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: temAuto ? '8px' : '6px' }}>
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                        fontSize: '14px', fontWeight: 700,
                        background: cor.bg, color: cor.fg,
                        padding: '4px 9px', borderRadius: '7px', whiteSpace: 'nowrap',
                      }}>
                        {brl(L.saldo)}
                      </span>
                    </div>

                    {temAuto > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                        {L.ents.map((x) => <React.Fragment key={x.id}>{etiqueta(`+ ${x.nome || 'entrada'} ${curto(num(valorNoMes(x, mes)))}`, C.pale, C.deep)}</React.Fragment>)}
                        {L.fixs.map((x) => <React.Fragment key={x.id}>{etiqueta(`− ${x.nome || 'conta'} ${curto(num(valorNoMes(x, mes)))}`, '#E6E9E2', C.soft)}</React.Fragment>)}
                        {L.vars.map((x) => <React.Fragment key={x.id}>{etiqueta(`− ${x.nome || 'variável'} ${curto(num(valorNoMes(x, mes)))}`, '#F3E6CC', C.amber)}</React.Fragment>)}
                      </div>
                    )}

                    <Lancamentos
                      lancs={L.lancs}
                      onCampo={(id, campo, v) => setLancamento(L.dia, id, campo, v)}
                      onDel={(id) => delLancamento(L.dia, id)}
                      onAdd={(tipo) => addLancamento(L.dia, tipo)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            border: `1px solid ${C.rule}`, borderRadius: '14px', overflow: 'hidden',
            background: C.card, marginBottom: '18px',
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '680px' }}>
                <thead>
                  <tr>
                    {['Dia', 'Lançamentos automáticos', 'Lançamentos do dia', 'Saldo'].map((h, i) => (
                      <th key={h} style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                        letterSpacing: '0.12em', textTransform: 'uppercase', color: C.soft,
                        fontWeight: 500, textAlign: i === 3 ? 'right' : 'left',
                        padding: '11px 10px', background: '#E7EAE2', borderBottom: `1px solid ${C.rule}`,
                        width: i === 2 ? '340px' : undefined,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhasDoMes.map((L) => {
                    const cor = faixa(L.saldo);
                    return (
                      <tr key={L.dia} style={{
                        background: L.fds ? 'rgba(18,33,28,0.02)' : 'transparent',
                        boxShadow: L.ehHoje ? `inset 3px 0 0 ${C.amber}` : 'none',
                      }}>
                        <td style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                          padding: '10px', borderBottom: '1px solid #E2E6DE',
                          textAlign: 'left', verticalAlign: 'top', whiteSpace: 'nowrap',
                        }}>
                          <span style={{
                            fontSize: '14px', fontWeight: 600,
                            color: L.ehHoje ? C.amber : L.fds ? C.soft : C.ink,
                          }}>
                            {String(L.dia).padStart(2, '0')}
                          </span>
                          <span style={{
                            fontSize: '10px', color: C.soft, marginLeft: '6px',
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                          }}>
                            {DIAS_SEM[L.sem]}
                          </span>
                        </td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #E2E6DE', textAlign: 'left', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {L.ents.map((x) => <React.Fragment key={x.id}>{etiqueta(`+ ${x.nome || 'entrada'} ${curto(num(valorNoMes(x, mes)))}`, C.pale, C.deep)}</React.Fragment>)}
                            {L.fixs.map((x) => <React.Fragment key={x.id}>{etiqueta(`− ${x.nome || 'conta'} ${curto(num(valorNoMes(x, mes)))}`, '#E6E9E2', C.soft)}</React.Fragment>)}
                            {L.vars.map((x) => <React.Fragment key={x.id}>{etiqueta(`− ${x.nome || 'variável'} ${curto(num(valorNoMes(x, mes)))}`, '#F3E6CC', C.amber)}</React.Fragment>)}
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #E2E6DE', verticalAlign: 'top' }}>
                          <Lancamentos
                            lancs={L.lancs}
                            onCampo={(id, campo, v) => setLancamento(L.dia, id, campo, v)}
                            onDel={(id) => delLancamento(L.dia, id)}
                            onAdd={(tipo) => addLancamento(L.dia, tipo)}
                          />
                        </td>
                        <td style={{
                          textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace",
                          fontVariantNumeric: 'tabular-nums', fontSize: '14px', fontWeight: 600,
                          padding: '10px 14px', borderBottom: '1px solid #E2E6DE',
                          background: cor.bg, color: cor.fg, whiteSpace: 'nowrap', verticalAlign: 'top',
                        }}>
                          {brl(L.saldo)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <datalist id="cd-categorias">
          {categoriasUsadas.map((c) => <option key={c} value={c} />)}
        </datalist>

        <p style={{ fontSize: '12px', color: C.soft, marginTop: '14px', lineHeight: 1.6 }}>
          Verde escuro é folga, verde claro é aperto, rosa é dia no vermelho. A marca âmbar indica hoje.
        </p>

        {/* painéis de resumo */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: ehMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '18px', marginTop: '18px',
        }}>
          <div style={{
            border: `1px solid ${C.rule}`, background: C.card, borderRadius: '14px',
            padding: ehMobile ? '14px' : '16px 18px',
          }}>
            <h2 style={{
              fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700,
              fontSize: '16px', letterSpacing: '-0.01em', margin: '0 0 3px',
            }}>
              Para onde foi em {MESES[mes].toLowerCase()}
            </h2>
            <p style={{ fontSize: '12px', color: C.soft, margin: '0 0 14px' }}>
              Ranking por categoria — contas variáveis e gastos avulsos somados.
            </p>
            {catsOrdenadas.length === 0 ? (
              <p style={{ fontSize: '12px', color: C.soft, lineHeight: 1.6 }}>
                Nada lançado ainda. O primeiro gasto com categoria aparece aqui.
              </p>
            ) : (
              catsOrdenadas.map(([c, v], idx) => (
                <div key={c} style={{
                  display: 'grid', gridTemplateColumns: '22px 1fr auto', gap: '10px',
                  alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #E4E8E0',
                }}>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px',
                    fontWeight: 700, color: idx === 0 ? C.amber : C.soft,
                  }}>
                    {idx + 1}º
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: idx === 0 ? 600 : 400 }}>{c}</div>
                    <div style={{
                      height: '5px', borderRadius: '3px', background: C.amber, marginTop: '5px',
                      width: `${Math.max(4, (v / maxCat) * 100)}%`, opacity: idx === 0 ? 0.85 : 0.5,
                    }} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                      fontSize: '13px', fontWeight: 600,
                    }}>
                      {brl(v)}
                    </div>
                    <div style={{ fontSize: '10.5px', color: C.soft }}>
                      {totalCats > 0 ? Math.round((v / totalCats) * 100) : 0}%
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{
            border: `1px solid ${C.rule}`, background: C.card, borderRadius: '14px',
            padding: ehMobile ? '14px' : '16px 18px',
          }}>
            <h2 style={{
              fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700,
              fontSize: '16px', letterSpacing: '-0.01em', margin: '0 0 3px',
            }}>
              Fechamento de cada mês
            </h2>
            <p style={{ fontSize: '12px', color: C.soft, margin: '0 0 14px' }}>Saldo no último dia.</p>
            {MESES.map((m, i) => {
              const x = calc.mesesInfo[i];
              const maxAno = Math.max(1, ...calc.mesesInfo.map((y) => Math.abs(y.fim)));
              return (
                <div
                  key={m}
                  onClick={() => setMes(i)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'center',
                    padding: '7px 0', borderBottom: '1px solid #E4E8E0', cursor: 'pointer',
                    opacity: i < mesInicial ? 0.5 : 1,
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: i === mes ? 600 : 400 }}>{m}</div>
                    <div style={{
                      height: '5px', borderRadius: '3px',
                      background: x.fim < 0 ? C.rose : C.mid, marginTop: '5px',
                      width: `${Math.max(3, (Math.abs(x.fim) / maxAno) * 100)}%`,
                    }} />
                  </div>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                    fontSize: '13px', fontWeight: 600, color: x.fim < 0 ? C.rose : C.ink,
                  }}>
                    {brl(x.fim)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Bloco({ cor, fundo, titulo, children }) {
  return (
    <div style={{
      borderRadius: '12px', padding: '14px 16px 16px', marginTop: '16px',
      background: fundo, borderTop: `4px solid ${cor}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '9px',
        fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '14.5px', fontWeight: 700,
        letterSpacing: '-0.01em', marginBottom: '12px', color: cor,
      }}>
        <span style={{
          width: '11px', height: '11px', borderRadius: '50%', background: cor,
          boxShadow: '0 0 0 3px rgba(255,255,255,.5)', flex: 'none',
        }} />
        {titulo}
      </div>
      {children}
    </div>
  );
}

function BotaoAdd({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: '1px solid rgba(18,33,28,.18)', background: 'rgba(255,255,255,.55)',
        color: C.ink, borderRadius: '9px', padding: '9px 14px',
        fontSize: '13px', fontWeight: 500, cursor: 'pointer', marginTop: '10px',
      }}
    >
      {children}
    </button>
  );
}

function Total({ label, valor, cor }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(18,33,28,.14)',
      fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
      fontSize: '14px', fontWeight: 600,
    }}>
      <span>{label}</span>
      <span style={{ color: cor }}>{valor}</span>
    </div>
  );
}

function TabelaItens({ itens, exemploNome, comCategoria, categorias = [], mes = 0, onNome, onDia, onValor, onCategoria, onDel, onReordenar, onHerdar }) {
  const [arrasto, setArrasto] = useState(null); // { idx, deltaY, alvo, altura }
  const refsLinhas = useRef([]);
  const medidas = useRef([]);

  const iniciarArrasto = (idx, e) => {
    if (itens.length < 2) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);

    medidas.current = refsLinhas.current.map((el) => {
      if (!el) return { topo: 0, altura: 0, centro: 0 };
      const r = el.getBoundingClientRect();
      return { topo: r.top, altura: r.height, centro: r.top + r.height / 2 };
    });

    setArrasto({ idx, y0: e.clientY, deltaY: 0, alvo: idx, altura: medidas.current[idx]?.altura || 0 });
  };

  const moverArrasto = (e) => {
    if (!arrasto) return;
    const deltaY = e.clientY - arrasto.y0;
    const centroAtual = (medidas.current[arrasto.idx]?.centro || 0) + deltaY;

    let alvo = arrasto.idx;
    medidas.current.forEach((m, i) => {
      if (i === arrasto.idx) return;
      if (i < arrasto.idx && centroAtual < m.centro) alvo = Math.min(alvo, i);
      if (i > arrasto.idx && centroAtual > m.centro) alvo = Math.max(alvo, i);
    });

    setArrasto((p) => (p ? { ...p, deltaY, alvo } : p));
  };

  const soltarArrasto = () => {
    if (!arrasto) return;
    if (arrasto.alvo !== arrasto.idx) onReordenar?.(arrasto.idx, arrasto.alvo);
    setArrasto(null);
  };

  const deslocamento = (i) => {
    if (!arrasto) return 0;
    const { idx, alvo, altura } = arrasto;
    if (i === idx) return arrasto.deltaY;
    if (idx < alvo && i > idx && i <= alvo) return -altura;
    if (idx > alvo && i >= alvo && i < idx) return altura;
    return 0;
  };

  return (
    <>
      {itens.map((item, i) => {
        const arrastando = arrasto?.idx === i;
        const origem = origemDoValor(item, mes);
        return (
          <div
            key={item.id}
            ref={(el) => { refsLinhas.current[i] = el; }}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px 0',
              borderBottom: '1px solid rgba(18,33,28,.08)',
              transform: `translateY(${deslocamento(i)}px)`,
              transition: arrastando ? 'none' : 'transform .18s ease',
              position: 'relative',
              zIndex: arrastando ? 3 : 1,
              background: arrastando ? 'rgba(255,255,255,.75)' : 'transparent',
              borderRadius: arrastando ? '10px' : 0,
              boxShadow: arrastando ? '0 6px 18px rgba(18,33,28,.16)' : 'none',
              touchAction: arrasto ? 'none' : 'auto',
            }}
          >
            {/* alça de arrastar */}
            <button
              onPointerDown={(e) => iniciarArrasto(i, e)}
              onPointerMove={moverArrasto}
              onPointerUp={soltarArrasto}
              onPointerCancel={soltarArrasto}
              aria-label={`Arrastar ${item.nome || 'item'} para reordenar`}
              title="Arraste para reordenar"
              style={{
                flex: 'none',
                width: '26px',
                alignSelf: 'stretch',
                minHeight: '38px',
                border: 0,
                background: 'transparent',
                color: itens.length < 2 ? 'rgba(99,115,108,.3)' : C.soft,
                cursor: itens.length < 2 ? 'default' : 'grab',
                touchAction: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
                lineHeight: 1,
                letterSpacing: '-2px',
                padding: 0,
              }}
            >
              ⠿
            </button>

            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <input
                type="text"
                value={item.nome}
                onChange={(e) => onNome(item.id, e.target.value)}
                placeholder={exemploNome}
                style={{
                  display: 'block', width: '100%', border: 0, background: 'transparent',
                  fontFamily: 'Inter, sans-serif', fontSize: '14.5px', fontWeight: 600,
                  color: C.ink, padding: '4px 2px', borderRadius: '6px', marginBottom: '6px',
                }}
                onFocus={(e) => e.target.style.background = 'rgba(255,255,255,.6)'}
                onBlur={(e) => e.target.style.background = 'transparent'}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '9.5px',
                  letterSpacing: '0.08em', textTransform: 'uppercase', color: C.soft, flex: 'none',
                }}>
                  Dia
                </span>
                <select
                  value={item.dia}
                  onChange={(e) => onDia(item.id, e.target.value)}
                  style={{
                    border: '1px solid rgba(18,33,28,.16)', background: '#fff', borderRadius: '8px',
                    padding: '8px 6px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px',
                    color: C.soft, width: '58px', flex: 'none',
                  }}
                >
                  {Array.from({ length: 31 }, (_, n) => <option key={n + 1} value={n + 1}>{n + 1}</option>)}
                </select>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valorNoMes(item, mes)}
                  onChange={(e) => onValor(item.id, e.target.value)}
                  style={{
                    border: `1px solid ${origem.proprio ? 'rgba(18,33,28,.28)' : 'rgba(18,33,28,.16)'}`,
                    background: '#fff', borderRadius: '8px',
                    padding: '8px 9px', fontFamily: "'IBM Plex Mono', monospace",
                    fontVariantNumeric: 'tabular-nums', fontSize: '13px',
                    color: origem.proprio ? C.ink : C.soft,
                    textAlign: 'right', flex: '1 1 auto', minWidth: 0,
                  }}
                />
                <button
                  onClick={() => onDel(item.id)}
                  aria-label={`Remover ${item.nome || 'linha'}`}
                  style={{
                    border: '1px solid rgba(18,33,28,.16)', background: 'transparent', borderRadius: '8px',
                    width: '32px', height: '32px', flex: 'none', cursor: 'pointer',
                    color: C.soft, fontSize: '15px', lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>

              {(origem.proprio || origem.de !== null) && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
                  marginTop: '6px', fontSize: '10.5px', color: C.soft,
                }}>
                  {origem.proprio ? (
                    <>
                      <span style={{ color: C.deep }}>valor deste mês</span>
                      {origem.de !== 0 && (
                        <button
                          onClick={() => onHerdar?.(item.id)}
                          style={{
                            border: 0, background: 'transparent', color: C.soft,
                            fontSize: '10.5px', textDecoration: 'underline', cursor: 'pointer', padding: 0,
                          }}
                        >
                          voltar a repetir o mês anterior
                        </button>
                      )}
                    </>
                  ) : (
                    <span>repetindo o valor de {MESES[origem.de].toLowerCase()}</span>
                  )}
                </div>
              )}

              {comCategoria && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: '9.5px',
                    letterSpacing: '0.08em', textTransform: 'uppercase', color: C.soft, flex: 'none',
                  }}>
                    Categoria
                  </span>
                  <input
                    type="text"
                    list="cd-categorias"
                    value={item.categoria || ''}
                    onChange={(e) => onCategoria(item.id, e.target.value)}
                    placeholder="escolha ou crie uma"
                    style={{
                      border: '1px solid rgba(18,33,28,.16)', background: '#fff', borderRadius: '8px',
                      padding: '8px 9px', fontFamily: 'Inter, sans-serif', fontSize: '12.5px',
                      color: C.ink, flex: '1 1 auto', minWidth: 0,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {itens.length > 1 && (
        <p style={{
          fontSize: '11px', color: C.soft, marginTop: '10px', marginBottom: 0,
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span aria-hidden="true" style={{ letterSpacing: '-2px' }}>⠿</span>
          segure e arraste para mudar a ordem
        </p>
      )}
    </>
  );
}

// Lançamentos avulsos de um dia. Dia vazio mostra só os dois botões de adicionar —
// os campos aparecem conforme a pessoa adiciona, para o calendário não ficar carregado.
function BotoesAdicionar({ onAdd, primeiro }) {
  const base = {
    border: 0, background: 'transparent',
    fontSize: '12px', fontFamily: 'Inter, sans-serif',
    cursor: 'pointer', padding: '4px 0',
    display: 'inline-flex', alignItems: 'center', gap: '4px',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: primeiro ? '2px' : 0 }}>
      <button
        onClick={() => onAdd('saida')}
        style={{ ...base, color: C.rose }}
        title="Adicionar um gasto"
      >
        <span style={{ fontSize: '13px', lineHeight: 1, fontWeight: 700 }}>−</span>
        {primeiro ? 'gasto' : 'outro gasto'}
      </button>

      <span aria-hidden="true" style={{ color: C.rule, fontSize: '11px' }}>|</span>

      <button
        onClick={() => onAdd('entrada')}
        style={{ ...base, color: C.deep }}
        title="Adicionar uma entrada"
      >
        <span style={{ fontSize: '13px', lineHeight: 1, fontWeight: 700 }}>+</span>
        entrada
      </button>
    </div>
  );
}

function Lancamentos({ lancs, onCampo, onDel, onAdd }) {
  if (!lancs.length) {
    return <BotoesAdicionar onAdd={onAdd} primeiro />;
  }

  return (
    <div style={{ display: 'grid', gap: '6px' }}>
      {lancs.map((l) => {
        const ehEntrada = l.tipo === 'entrada';
        const cor = ehEntrada ? C.deep : C.rose;
        return (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {/* as duas opções ficam à vista: toque direto na que quiser */}
            <div style={{
              flex: 'none', display: 'flex',
              border: `1px solid ${C.rule}`, borderRadius: '7px', overflow: 'hidden',
            }}>
              <button
                onClick={() => onCampo(l.id, 'tipo', 'saida')}
                aria-pressed={!ehEntrada}
                aria-label="Marcar como gasto"
                title="Gasto"
                style={{
                  width: '26px', height: '32px', border: 0, padding: 0, cursor: 'pointer',
                  background: !ehEntrada ? C.rosePale : 'transparent',
                  color: !ehEntrada ? C.rose : 'rgba(99,115,108,.55)',
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '14px', fontWeight: 700, lineHeight: 1,
                }}
              >
                −
              </button>
              <button
                onClick={() => onCampo(l.id, 'tipo', 'entrada')}
                aria-pressed={ehEntrada}
                aria-label="Marcar como entrada"
                title="Entrada"
                style={{
                  width: '26px', height: '32px', border: 0, padding: 0, cursor: 'pointer',
                  borderLeft: `1px solid ${C.rule}`,
                  background: ehEntrada ? C.pale : 'transparent',
                  color: ehEntrada ? C.deep : 'rgba(99,115,108,.55)',
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '14px', fontWeight: 700, lineHeight: 1,
                }}
              >
                +
              </button>
            </div>

            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              aria-label="Valor"
              value={l.valor}
              onChange={(e) => onCampo(l.id, 'valor', e.target.value)}
              style={{
                flex: '0 1 84px', minWidth: 0,
                border: `1px solid ${C.rule}`, background: '#fff', borderRadius: '7px',
                padding: '7px 8px', fontFamily: "'IBM Plex Mono', monospace",
                fontVariantNumeric: 'tabular-nums', fontSize: '13px',
                color: num(l.valor) > 0 ? cor : C.ink,
                fontWeight: num(l.valor) > 0 ? 600 : 400,
                textAlign: 'right',
              }}
            />

            <input
              type="text"
              list="cd-categorias"
              placeholder={ehEntrada ? 'de onde veio' : 'categoria'}
              aria-label="Categoria"
              value={l.categoria || ''}
              onChange={(e) => onCampo(l.id, 'categoria', e.target.value)}
              style={{
                flex: '1 1 auto', minWidth: 0,
                border: `1px solid ${C.rule}`, background: '#fff', borderRadius: '7px',
                padding: '7px 8px', fontFamily: 'Inter, sans-serif', fontSize: '12.5px', color: C.ink,
              }}
            />

            <button
              onClick={() => onDel(l.id)}
              aria-label="Remover lançamento"
              style={{
                flex: 'none', width: '26px', height: '32px',
                border: 0, background: 'transparent', color: C.soft,
                fontSize: '15px', lineHeight: 1, cursor: 'pointer', padding: 0, borderRadius: '7px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.rosePale; e.currentTarget.style.color = C.rose; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.soft; }}
            >
              ×
            </button>
          </div>
        );
      })}

      <BotoesAdicionar onAdd={onAdd} />
    </div>
  );
}
