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
  clay: '#8C5A3C',
  azul: '#1E4A73',
  azulMedio: '#3A6E9E',
  azulPale: '#CFE0EE',
  azulBg: '#E3EDF6',
  azulPaper: '#E7EDF3',
  azulCard: '#F1F5F9',
  azulRule: '#C4D4E3',
  vinho: '#7A2E3E',
  vinhoClaro: '#A34558',
};

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const ABREV = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const DIAS_SEM = ["dom","seg","ter","qua","qui","sex","sáb"];
const CAT_SUGESTOES = ["Cartão de crédito","Mercado","Comer fora","Transporte","Saúde","Lazer","Compras","Viagem","Casa","Educação","Presentes","Outros"];

const RENDAS_INICIAIS = [{ id: "r1", nome: "", dia: 5, valor: "" }];
const FIXOS_INICIAIS = [{ id: "f1", nome: "", dia: 10, valor: "" }];
const VARIAVEIS_INICIAIS = [{ id: "v1", nome: "", dia: 10, valor: "", categoria: "" }];
const PARCELAS_INICIAIS = [];

const PADRAO = {
  ano: new Date().getFullYear(),
  rendas: RENDAS_INICIAIS,
  fixos: FIXOS_INICIAIS,
  contasVariaveis: VARIAVEIS_INICIAIS,
  parcelas: PARCELAS_INICIAIS,
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
const normalizarDias = (dias = {}) => {
  const saida = {};
  Object.entries(dias).forEach(([k, reg]) => {
    if (!reg) return;
    if (Array.isArray(reg.lancamentos)) { saida[k] = reg; return; }
    const lista = [];
    if (num(reg.entrada) > 0) lista.push({ id: `${k}-e`, tipo: 'entrada', valor: reg.entrada, categoria: '' });
    if (num(reg.valor) > 0) lista.push({ id: `${k}-s`, tipo: 'saida', valor: reg.valor, categoria: reg.categoria || '' });
    if (lista.length) saida[k] = { lancamentos: lista };
  });
  return saida;
};

// Mês absoluto: ano*12 + mês. É o que permite o saldo atravessar dezembro
// e as parcelas continuarem no ano seguinte.
const absMes = (ano, mes) => ano * 12 + mes;
const anoDe = (abs) => Math.floor(abs / 12);
const mesDe = (abs) => ((abs % 12) + 12) % 12;
const rotuloAbs = (abs) => `${MESES[mesDe(abs)].toLowerCase()} de ${anoDe(abs)}`;

// Converte dados antigos (mês 0–11 sem ano) para o índice absoluto.
const migrarParaAbsoluto = (dados) => {
  const ano = dados.ano || new Date().getFullYear();
  const ehAntigo = (k) => Number(k) >= 0 && Number(k) < 12;

  const converterLista = (lista = []) => lista.map((item) => {
    const valores = {};
    Object.entries(item.valores || {}).forEach(([k, v]) => {
      valores[ehAntigo(k) ? absMes(ano, Number(k)) : Number(k)] = v;
    });
    return { ...item, valores };
  });

  const parcelas = (dados.parcelas || []).map((p) => ({
    ...p,
    mesInicio: p.mesInicio != null && ehAntigo(p.mesInicio)
      ? absMes(ano, Number(p.mesInicio))
      : Number(p.mesInicio ?? absMes(ano, 0)),
  }));

  return {
    ...dados,
    rendas: converterLista(dados.rendas),
    fixos: converterLista(dados.fixos),
    contasVariaveis: converterLista(dados.contasVariaveis),
    parcelas,
  };
};

// Valor de um item no mês pedido. Herda do mês preenchido mais recente antes dele.
const valorNoMes = (item, abs) => {
  const porMes = item.valores || {};
  const chaves = Object.keys(porMes).map(Number).filter((k) => k <= abs).sort((a, b) => b - a);
  for (const k of chaves) {
    const v = porMes[k];
    if (v !== undefined && v !== null) return v;
  }
  return item.valor ?? '';
};

const origemDoValor = (item, abs) => {
  const porMes = item.valores || {};
  if (porMes[abs] !== undefined && porMes[abs] !== null) return { proprio: true, de: abs };
  const anteriores = Object.keys(porMes).map(Number).filter((k) => k < abs).sort((a, b) => b - a);
  for (const k of anteriores) {
    if (porMes[k] !== undefined && porMes[k] !== null) return { proprio: false, de: k };
  }
  return { proprio: false, de: null };
};

// Uma parcela vale do mês da compra até completar a quantidade contratada.
const parcelaAtiva = (p, abs) => {
  const ini = Number(p.mesInicio ?? 0);
  const qtd = Number(p.quantidade || 0);
  return qtd > 0 && abs >= ini && abs < ini + qtd;
};
const numeroDaParcela = (p, abs) => abs - Number(p.mesInicio ?? 0) + 1;
const parcelasDoMes = (parcelas = [], abs) => parcelas.filter((p) => parcelaAtiva(p, abs) && num(p.valor) > 0);

const diasNoMes = (ano, mes) => new Date(ano, mes + 1, 0).getDate();
const chaveDia = (ano, mes, dia) => `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

const ABAS = [
  { id: 'hoje', rotulo: 'Hoje', icone: '◈' },
  { id: 'calendario', rotulo: 'Calendário', icone: '▤' },
  { id: 'contas', rotulo: 'Contas', icone: '☰' },
];

export default function ControleDiario({ familyCode, supabase, onSair }) {
  const hoje = new Date();
  const [d, setD] = useState(PADRAO);
  const [aba, setAba] = useState('hoje');
  const [mes, setMes] = useState(hoje.getMonth());
  const [anoVisto, setAnoVisto] = useState(hoje.getFullYear());
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState("");
  const [ehMobile, setEhMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 760 : false);
  const [secoes, setSecoes] = useState({ contas: true, ranking: true, fechamento: false });
  const [listaMeses, setListaMeses] = useState(false);
  const alternar = (chave) => setSecoes((p) => ({ ...p, [chave]: !p[chave] }));
  const syncRef = useRef(null);
  const trilhaRef = useRef(null);
  const mesAtivoRef = useRef(null);

  useEffect(() => {
    const aoRedimensionar = () => setEhMobile(window.innerWidth < 760);
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);

  useEffect(() => {
    if (!mesAtivoRef.current || !trilhaRef.current) return;
    const trilha = trilhaRef.current;
    const botao = mesAtivoRef.current;
    const alvo = botao.offsetLeft - (trilha.clientWidth / 2) + (botao.clientWidth / 2);
    trilha.scrollTo({ left: Math.max(0, alvo), behavior: 'smooth' });
  }, [mes, anoVisto, carregando, ehMobile, aba]);

  useEffect(() => { setListaMeses(false); }, [mes, anoVisto, aba]);

  useEffect(() => {
    const carregar = async () => {
      try {
        const { data, error } = await supabase.from('families').select('data').eq('code', familyCode).single();
        if (error) throw error;
        if (data && data.data && Object.keys(data.data).length > 0) {
          const vindo = data.data;
          setD(migrarParaAbsoluto({ ...PADRAO, ...vindo, dias: normalizarDias(vindo.dias) }));
        }
      } catch (err) {
        console.error('Erro ao carregar:', err);
        setAviso('Erro ao carregar dados do servidor');
      } finally {
        setCarregando(false);
      }
    };
    carregar();
  }, [familyCode]);

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

  useEffect(() => {
    const canal = supabase
      .channel(`family-${familyCode}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'families', filter: `code=eq.${familyCode}` },
        (payload) => {
          if (payload.new && payload.new.data) {
            const vindo = payload.new.data;
            setD(migrarParaAbsoluto({ ...PADRAO, ...vindo, dias: normalizarDias(vindo.dias) }));
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [familyCode]);

  const hojeChave = chaveDia(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  // Primeiro mês com algo preenchido. O controle começa sozinho ali.
  const mesInicialAbs = useMemo(() => {
    let menor = null;
    const considerar = (m) => { if (m !== null && (menor === null || m < menor)) menor = m; };
    ['rendas', 'fixos', 'contasVariaveis'].forEach((chave) => {
      (d[chave] || []).forEach((item) => {
        Object.entries(item.valores || {}).forEach(([m, v]) => { if (num(v) > 0) considerar(Number(m)); });
      });
    });
    (d.parcelas || []).forEach((p) => {
      if (num(p.valor) > 0 && Number(p.quantidade) > 0) considerar(Number(p.mesInicio));
    });
    Object.entries(d.dias || {}).forEach(([k, reg]) => {
      if (!(reg?.lancamentos || []).some((l) => num(l.valor) > 0)) return;
      const [ano, mesTexto] = k.split('-');
      considerar(absMes(Number(ano), Number(mesTexto) - 1));
    });
    if (menor !== null) return menor;
    return absMes(hoje.getFullYear(), hoje.getMonth());
  }, [d]);

  const mesFinalAbs = useMemo(() => {
    let maior = absMes(hoje.getFullYear() + 1, 11);
    const considerar = (m) => { if (m > maior) maior = m; };
    (d.parcelas || []).forEach((p) => {
      const qtd = Number(p.quantidade || 0);
      if (qtd > 0 && num(p.valor) > 0) considerar(Number(p.mesInicio) + qtd - 1);
    });
    Object.keys(d.dias || {}).forEach((k) => {
      const [ano, mesTexto] = k.split('-');
      considerar(absMes(Number(ano), Number(mesTexto) - 1));
    });
    ['rendas', 'fixos', 'contasVariaveis'].forEach((chave) => {
      (d[chave] || []).forEach((item) => {
        Object.keys(item.valores || {}).forEach((k) => considerar(Number(k)));
      });
    });
    return Math.min(maior, mesInicialAbs + 12 * 5 - 1);
  }, [d, mesInicialAbs]);

  const anosDisponiveis = useMemo(() => {
    const lista = [];
    for (let a = anoDe(mesInicialAbs); a <= anoDe(mesFinalAbs); a++) lista.push(a);
    return lista;
  }, [mesInicialAbs, mesFinalAbs]);

  const temAlgumDado = useMemo(() => {
    const temItem = ['rendas', 'fixos', 'contasVariaveis'].some((chave) =>
      (d[chave] || []).some((item) =>
        num(item.valor) > 0 || Object.values(item.valores || {}).some((v) => num(v) > 0)));
    if (temItem) return true;
    if ((d.parcelas || []).some((p) => num(p.valor) > 0)) return true;
    return Object.values(d.dias || {}).some((reg) =>
      (reg?.lancamentos || []).some((l) => num(l.valor) > 0));
  }, [d]);

  const calc = useMemo(() => {
    const saldos = {};
    const porMes = {};
    let saldo = 0;

    for (let abs = mesInicialAbs; abs <= mesFinalAbs; abs++) {
      const ano = anoDe(abs);
      const m = mesDe(abs);
      const total = diasNoMes(ano, m);

      const abertura = saldo;
      const ganhosTotal = d.rendas.reduce((acc, x) => acc + num(valorNoMes(x, abs)), 0);
      const fixosTotal = d.fixos.reduce((acc, x) => acc + num(valorNoMes(x, abs)), 0);
      const ativasNoMes = parcelasDoMes(d.parcelas, abs);
      const parcelasTotal = ativasNoMes.reduce((acc, x) => acc + num(x.valor), 0);
      const baseDia = total > 0 ? (ganhosTotal - fixosTotal - parcelasTotal) / total : 0;

      let variaveis = 0;
      let entradasAvulsasMes = 0;
      const cats = {};
      const gastoPorDia = {};

      for (let dia = 1; dia <= total; dia++) {
        const k = chaveDia(ano, m, dia);
        const reg = d.dias[k] || {};
        const lancs = Array.isArray(reg.lancamentos) ? reg.lancamentos : [];
        let avulso = 0;
        let entradaAvulsa = 0;
        lancs.forEach((l) => {
          const v = num(l.valor);
          if (v <= 0) return;
          if (l.tipo === 'entrada') entradaAvulsa += v; else avulso += v;
        });

        const ent = d.rendas.reduce((acc, x) => (Number(x.dia) === dia ? acc + num(valorNoMes(x, abs)) : acc), 0);
        const fix = d.fixos.reduce((acc, x) => (Number(x.dia) === dia ? acc + num(valorNoMes(x, abs)) : acc), 0);
        const par = ativasNoMes.reduce((acc, x) => (Number(x.dia) === dia ? acc + num(x.valor) : acc), 0);

        let varPlanejada = 0;
        d.contasVariaveis.forEach((x) => {
          if (Number(x.dia) === dia) {
            const val = num(valorNoMes(x, abs));
            varPlanejada += val;
            if (val > 0) {
              const c = (x.categoria && x.categoria.trim()) || (x.nome && x.nome.trim()) || 'Sem categoria';
              cats[c] = (cats[c] || 0) + val;
            }
          }
        });

        saldo = saldo + ent + entradaAvulsa - fix - par - varPlanejada - avulso;
        saldos[k] = saldo;

        lancs.forEach((l) => {
          const v = num(l.valor);
          if (v <= 0 || l.tipo === 'entrada') return;
          const c = (l.categoria && l.categoria.trim()) || 'Sem categoria';
          cats[c] = (cats[c] || 0) + v;
        });

        gastoPorDia[dia] = varPlanejada + avulso;
        variaveis += varPlanejada + avulso;
        entradasAvulsasMes += entradaAvulsa;
      }

      porMes[abs] = {
        abertura,
        ganhos: ganhosTotal + entradasAvulsasMes,
        fixos: fixosTotal,
        parcelas: parcelasTotal,
        baseDia,
        variaveis,
        gastoPorDia,
        sobra: ganhosTotal + entradasAvulsasMes - fixosTotal - parcelasTotal - variaveis,
        fim: saldo,
        cats,
        dias: total,
        variaveisPlanejadas: d.contasVariaveis.reduce((acc, x) => acc + num(valorNoMes(x, abs)), 0),
      };
    }
    return { saldos, porMes };
  }, [d, mesInicialAbs, mesFinalAbs]);

  const absVisto = absMes(anoVisto, mes);
  const antesDoInicio = absVisto < mesInicialAbs;
  const anoAtual = hoje.getFullYear();
  const outroAno = anoVisto !== anoAtual;
  const ehMesCorrente = anoVisto === anoAtual && mes === hoje.getMonth();

  const T = outroAno
    ? { paper: C.azulPaper, card: C.azulCard, rule: C.azulRule, forte: C.azul, medio: C.azulMedio, pale: C.azulPale, baseBg: C.azulBg, cabecalho: '#DCE7F1' }
    : { paper: C.paper, card: C.card, rule: C.rule, forte: C.deep, medio: C.mid, pale: C.pale, baseBg: '#E7F0E9', cabecalho: '#E7EAE2' };

  const mesVazio = {
    abertura: 0, ganhos: 0, fixos: 0, parcelas: 0, baseDia: 0, variaveis: 0, gastoPorDia: {},
    sobra: 0, fim: 0, cats: {}, dias: diasNoMes(anoVisto, mes), variaveisPlanejadas: 0,
  };
  const r = calc.porMes[absVisto] || mesVazio;
  const totalDias = r.dias;

  // "Posso gastar hoje": o que sobrou dividido pelos dias que ainda faltam.
  // Diferente da média fixa do mês, este número reage ao que já foi gasto.
  const diasRestantes = ehMesCorrente ? totalDias - hoje.getDate() + 1 : totalDias;
  const podeHoje = diasRestantes > 0 ? r.sobra / diasRestantes : 0;
  const gastoDeHoje = ehMesCorrente ? (r.gastoPorDia?.[hoje.getDate()] || 0) : 0;
  const sobrouHoje = podeHoje - gastoDeHoje;
  const mediaGasta = totalDias > 0 ? r.variaveis / totalDias : 0;
  const noRitmo = mediaGasta <= r.baseDia;

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

  const setValorDoMes = (lista, id, valor) =>
    setD((p) => ({
      ...p,
      [lista]: p[lista].map((i) => (i.id === id ? { ...i, valores: { ...(i.valores || {}), [absVisto]: valor } } : i)),
    }));

  const voltarAHerdar = (lista, id) =>
    setD((p) => ({
      ...p,
      [lista]: p[lista].map((i) => {
        if (i.id !== id) return i;
        const valores = { ...(i.valores || {}) };
        delete valores[absVisto];
        return { ...i, valores };
      }),
    }));

  const listaDoDia = (p, k) => (Array.isArray(p.dias[k]?.lancamentos) ? p.dias[k].lancamentos : []);

  const addLancamento = (dia, tipo = 'saida') => {
    const k = chaveDia(anoVisto, mes, dia);
    setD((p) => ({
      ...p,
      dias: { ...p.dias, [k]: { lancamentos: [...listaDoDia(p, k), { id: `l${Date.now()}${Math.random().toString(36).slice(2, 6)}`, tipo, valor: '', categoria: '' }] } },
    }));
  };

  const setLancamento = (dia, id, campo, valor) => {
    const k = chaveDia(anoVisto, mes, dia);
    setD((p) => ({
      ...p,
      dias: { ...p.dias, [k]: { lancamentos: listaDoDia(p, k).map((l) => (l.id === id ? { ...l, [campo]: valor } : l)) } },
    }));
  };

  const delLancamento = (dia, id) => {
    const k = chaveDia(anoVisto, mes, dia);
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
        ...(lista === 'parcelas' ? { quantidade: 12, mesInicio: absVisto } : {}),
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

  const irParaHoje = () => {
    setAnoVisto(hoje.getFullYear());
    setMes(hoje.getMonth());
  };

  const catsOrdenadas = Object.entries(r.cats).sort((a, b) => b[1] - a[1]);
  const maxCat = catsOrdenadas.length ? catsOrdenadas[0][1] : 1;
  const totalCats = catsOrdenadas.reduce((s, [, v]) => s + v, 0);
  const maxMes = Math.max(1, ...Array.from({ length: totalDias }, (_, i) => Math.abs(calc.saldos[chaveDia(anoVisto, mes, i + 1)] || 0)));

  const faixa = (v) => {
    if (v < 0) return { bg: C.rosePale, fg: C.rose, barra: C.rose };
    if (v >= maxMes * 0.5) return { bg: T.forte, fg: '#FFFFFF', barra: '#FFFFFF' };
    return { bg: T.pale, fg: T.forte, barra: T.medio };
  };

  const linhasDoMes = Array.from({ length: totalDias }, (_, i) => {
    const dia = i + 1;
    const k = chaveDia(anoVisto, mes, dia);
    const reg = d.dias[k] || {};
    const sem = new Date(anoVisto, mes, dia).getDay();
    const lancs = Array.isArray(reg.lancamentos) ? reg.lancamentos : [];
    return {
      dia, k, reg, lancs,
      saldo: calc.saldos[k] || 0,
      sem,
      fds: sem === 0 || sem === 6,
      ehHoje: k === hojeChave,
      ents: antesDoInicio ? [] : d.rendas.filter((x) => Number(x.dia) === dia && num(valorNoMes(x, absVisto)) > 0),
      fixs: antesDoInicio ? [] : d.fixos.filter((x) => Number(x.dia) === dia && num(valorNoMes(x, absVisto)) > 0),
      vars: antesDoInicio ? [] : d.contasVariaveis.filter((x) => Number(x.dia) === dia && num(valorNoMes(x, absVisto)) > 0),
      pars: antesDoInicio ? [] : parcelasDoMes(d.parcelas, absVisto).filter((x) => Number(x.dia) === dia),
    };
  });

  const etiqueta = (texto, bg, fg) => (
    <span style={{
      display: 'inline-block', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10.5px',
      padding: '3px 7px', borderRadius: '6px', background: bg, color: fg, whiteSpace: 'nowrap',
    }}>
      {texto}
    </span>
  );

  if (carregando) {
    return (
      <div style={{ background: C.paper, color: C.soft, minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui' }}>
        Carregando seu controle…
      </div>
    );
  }

  const Caixa = ({ lab, val, cor }) => (
    <div style={{ border: `1px solid ${T.rule}`, background: T.card, borderRadius: '11px', padding: '12px 13px' }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: C.soft }}>
        {lab}
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums', fontSize: '16px', fontWeight: 600, marginTop: '5px', color: cor }}>
        {val}
      </div>
    </div>
  );

  return (
    <div style={{
      background: T.paper, color: C.ink, minHeight: '100vh',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: ehMobile ? '14px 12px 92px' : '20px 16px 56px',
      WebkitFontSmoothing: 'antialiased',
      transition: 'background .25s ease',
    }}>
      <style>{`
        * { box-sizing: border-box; }
        input, select, button { font-family: inherit; }
      `}</style>

      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>

        {/* ───── cabeçalho ───── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <button
              onClick={() => setAba('hoje')}
              aria-label="Ir para a tela Hoje"
              style={{
                border: 0, background: 'transparent', padding: 0, cursor: 'pointer',
                fontFamily: "'Bricolage Grotesque', system-ui", fontWeight: 800,
                fontSize: '20px', letterSpacing: '-0.03em', color: C.ink,
              }}
            >
              Vistta
            </button>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10.5px', letterSpacing: '0.14em', textTransform: 'uppercase', color: C.soft }}>
              {familyCode}
            </span>
          </div>
          <button onClick={onSair} style={{
            border: `1px solid ${T.rule}`, background: 'transparent', color: C.soft,
            borderRadius: '8px', padding: '6px 11px', fontSize: '12px', cursor: 'pointer',
          }}>
            Sair
          </button>
        </div>

        {/* abas no desktop ficam no topo */}
        {!ehMobile && (
          <div style={{ display: 'flex', gap: '4px', marginBottom: '18px', borderBottom: `1px solid ${T.rule}` }}>
            {ABAS.map((a) => {
              const ativa = aba === a.id;
              return (
                <button key={a.id} onClick={() => setAba(a.id)} style={{
                  border: 0, background: 'transparent', cursor: 'pointer',
                  padding: '10px 16px', fontSize: '14px',
                  fontWeight: ativa ? 600 : 400,
                  color: ativa ? T.forte : C.soft,
                  borderBottom: `2px solid ${ativa ? T.forte : 'transparent'}`,
                  marginBottom: '-1px',
                }}>
                  {a.rotulo}
                </button>
              );
            })}
          </div>
        )}

        {/* ───── ano e mês, compartilhados por todas as abas ───── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {anosDisponiveis.map((a) => {
            const ativo = a === anoVisto;
            const ehAtual = a === anoAtual;
            const corAtiva = ehAtual ? C.ink : C.azul;
            return (
              <button key={a} onClick={() => setAnoVisto(a)} aria-pressed={ativo} style={{
                border: `1px solid ${ativo ? corAtiva : T.rule}`,
                background: ativo ? corAtiva : 'transparent',
                color: ativo ? '#fff' : ehAtual ? C.ink : C.azulMedio,
                borderRadius: '20px', padding: '6px 14px', cursor: 'pointer',
                fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                fontSize: '12.5px', fontWeight: 600, letterSpacing: '0.04em',
              }}>
                {a}
              </button>
            );
          })}
          {!ehMesCorrente && (
            <button onClick={irParaHoje} style={{
              border: 0, background: 'transparent', color: T.forte, cursor: 'pointer',
              fontSize: '12px', fontWeight: 600, textDecoration: 'underline', padding: '6px 2px',
            }}>
              ir para hoje
            </button>
          )}
        </div>

        {outroAno && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            border: `1px solid ${C.azulPale}`, borderLeft: `4px solid ${C.azul}`,
            background: C.azulBg, borderRadius: '10px', padding: '10px 13px', marginBottom: '14px',
          }}>
            <span aria-hidden="true" style={{ fontSize: '14px', lineHeight: 1, color: C.azul }}>
              {anoVisto > anoAtual ? '↗' : '↩'}
            </span>
            <div style={{ fontSize: '12.5px', color: C.azul, lineHeight: 1.5 }}>
              Você está em <strong>{anoVisto}</strong>. O saldo vem acumulado de {anoVisto - 1} e as contas
              repetem o último valor informado.
            </div>
          </div>
        )}

        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.12em',
              textTransform: 'uppercase', color: outroAno ? C.azulMedio : C.soft,
            }}>
              Meses de {anoVisto}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: C.soft }}>
              arraste
              <span aria-hidden="true" style={{ fontSize: '13px', lineHeight: 1 }}>↔</span>
            </span>
          </div>

          <div style={{ position: 'relative' }}>
            <div ref={trilhaRef} style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '6px', paddingRight: '26px' }}>
              {MESES.map((m, i) => {
                const abs = absMes(anoVisto, i);
                const info = calc.porMes[abs];
                const v = info ? info.fim : 0;
                const on = i === mes;
                const desativado = abs < mesInicialAbs;
                const corAtiva = outroAno ? C.azul : C.ink;
                return (
                  <button key={m} ref={on ? mesAtivoRef : null} onClick={() => setMes(i)} style={{
                    flex: '1 0 auto', minWidth: '66px',
                    border: `1px solid ${on ? corAtiva : T.rule}`,
                    background: on ? corAtiva : 'transparent',
                    borderRadius: '9px', padding: '8px 6px', cursor: 'pointer', textAlign: 'left',
                    opacity: desativado && !on ? 0.45 : 1,
                  }}>
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: on ? 'rgba(255,255,255,.7)' : outroAno ? C.azulMedio : C.soft,
                    }}>
                      {ABREV[i]}
                    </div>
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                      fontSize: '13px', fontWeight: 600, marginTop: '3px',
                      color: on ? (v < 0 ? '#F0A9A3' : outroAno ? '#A8CBE8' : '#8FD9BE') : v < 0 ? C.rose : T.forte,
                    }}>
                      {curto(v)}
                    </div>
                  </button>
                );
              })}
            </div>
            <div aria-hidden="true" style={{
              position: 'absolute', top: 0, right: 0, bottom: '6px', width: '34px',
              background: `linear-gradient(to right, rgba(255,255,255,0), ${T.paper})`,
              pointerEvents: 'none',
            }} />
          </div>
        </div>

        {aviso && (
          <div style={{
            border: `1px solid ${C.rosePale}`, background: C.rosePale, color: C.rose,
            borderRadius: '10px', padding: '10px 13px', fontSize: '13px', marginBottom: '14px',
          }}>
            {aviso}
          </div>
        )}

        {/* ═══════════ ABA: HOJE ═══════════ */}
        {aba === 'hoje' && (
          <>
            {!temAlgumDado ? (
              <div style={{
                border: `1px dashed ${T.rule}`, background: T.card, borderRadius: '14px',
                padding: '28px 20px', textAlign: 'center',
              }}>
                <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>
                  Vamos começar
                </div>
                <p style={{ fontSize: '13px', color: C.soft, lineHeight: 1.6, maxWidth: '38ch', margin: '0 auto 16px' }}>
                  Cadastre seus ganhos e contas na aba Contas. A partir do primeiro valor, esta tela passa
                  a mostrar quanto você pode gastar por dia.
                </p>
                <button onClick={() => setAba('contas')} style={{
                  background: C.ink, color: '#fff', border: 0, borderRadius: '10px',
                  padding: '11px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                }}>
                  Cadastrar contas
                </button>
              </div>
            ) : (
              <>
                {/* o número principal */}
                <div style={{
                  border: `1px solid ${T.pale}`, background: T.baseBg, borderRadius: '14px',
                  padding: ehMobile ? '22px 18px' : '28px 24px', textAlign: 'center', marginBottom: '12px',
                }}>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: '10.5px', letterSpacing: '0.14em',
                    textTransform: 'uppercase', color: C.soft, marginBottom: '10px',
                  }}>
                    {ehMesCorrente ? 'Posso gastar hoje' : `Média por dia em ${MESES[mes].toLowerCase()}`}
                  </div>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600, fontSize: 'clamp(34px, 11vw, 56px)', lineHeight: 1, letterSpacing: '-0.02em',
                    color: (ehMesCorrente ? sobrouHoje : r.baseDia) < 0 ? C.rose : T.forte,
                  }}>
                    {brl(ehMesCorrente ? sobrouHoje : r.baseDia)}
                  </div>

                  {ehMesCorrente && (
                    <div style={{ fontSize: '12.5px', color: C.soft, marginTop: '12px', lineHeight: 1.6 }}>
                      {gastoDeHoje > 0 ? (
                        <>Você já gastou <strong style={{ color: C.rose }}>{brl(gastoDeHoje)}</strong> hoje,
                        de um limite de {brl(podeHoje)}.</>
                      ) : (
                        <>Sobram <strong>{brl(r.sobra)}</strong> para os {diasRestantes}{' '}
                        {diasRestantes === 1 ? 'dia restante' : 'dias restantes'} do mês.</>
                      )}
                    </div>
                  )}
                  {!ehMesCorrente && (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: C.soft, marginTop: '10px' }}>
                      ({brl(r.ganhos)} − {brl(r.fixos)} de fixas
                      {r.parcelas > 0 ? ` − ${brl(r.parcelas)} de parcelas` : ''}) ÷ {totalDias} dias
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: ehMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '10px', marginBottom: '18px' }}>
                  <Caixa lab={`Fim de ${ABREV[mes]}`} val={brl(r.fim)} cor={r.fim < 0 ? C.rose : T.forte} />
                  <Caixa lab="Sobra do mês" val={brl(r.sobra)} cor={r.sobra < 0 ? C.rose : T.forte} />
                  <Caixa lab="Já gasto no mês" val={brl(r.variaveis)} cor={C.vinho} />
                  <Caixa lab="Comprometido" val={brl(r.fixos + r.parcelas)} cor={C.steel} />
                </div>

                <div style={{ display: 'grid', gap: '8px', marginBottom: '18px' }}>
                  {ehMesCorrente && (
                    <button onClick={() => setAba('calendario')} style={{
                      width: '100%', border: `1px solid ${T.rule}`, background: T.card,
                      borderRadius: '12px', padding: '13px 16px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: '10px', textAlign: 'left',
                    }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: C.ink }}>
                        Lançar um gasto de hoje
                      </span>
                      <span aria-hidden="true" style={{ color: C.soft, fontSize: '14px' }}>→</span>
                    </button>
                  )}

                  <button onClick={() => setAba('contas')} style={{
                    width: '100%', border: `1px solid ${T.rule}`, background: T.card,
                    borderRadius: '12px', padding: '13px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '10px', textAlign: 'left',
                  }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: C.ink }}>
                        Ver contas
                      </span>
                      <span style={{ display: 'block', fontSize: '11.5px', color: C.soft, marginTop: '2px' }}>
                        Ganhos, fixas, variáveis e parcelas de {MESES[mes].toLowerCase()}
                      </span>
                    </span>
                    <span aria-hidden="true" style={{ color: C.soft, fontSize: '14px', flex: 'none' }}>→</span>
                  </button>
                </div>

                {/* ranking */}
                <div style={{
                  border: `1px solid ${T.rule}`, background: T.card, borderRadius: '14px',
                  padding: ehMobile ? '14px' : '16px 18px', marginBottom: '18px',
                }}>
                  <CabecalhoSecao
                    titulo={`Para onde foi em ${MESES[mes].toLowerCase()}`}
                    subtitulo="Ranking por categoria — contas variáveis e gastos avulsos somados."
                    aberta={secoes.ranking}
                    onToggle={() => alternar('ranking')}
                    cor={C.vinho}
                  />
                  <div style={{ height: '12px' }} />
                  {!secoes.ranking ? null : catsOrdenadas.length === 0 ? (
                    <p style={{ fontSize: '12px', color: C.soft, lineHeight: 1.6 }}>
                      Nada lançado ainda. O primeiro gasto com categoria aparece aqui.
                    </p>
                  ) : (
                    catsOrdenadas.map(([c, v], idx) => (
                      <div key={c} style={{
                        display: 'grid', gridTemplateColumns: '22px 1fr auto', gap: '10px',
                        alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #E4E8E0',
                      }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 700, color: idx === 0 ? C.vinho : C.soft }}>
                          {idx + 1}º
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: idx === 0 ? 600 : 400 }}>{c}</div>
                          <div style={{
                            height: '6px', borderRadius: '3px', background: C.vinho, marginTop: '5px',
                            width: `${Math.max(4, (v / maxCat) * 100)}%`, opacity: idx === 0 ? 1 : 0.75,
                          }} />
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums', fontSize: '13px', fontWeight: 600 }}>
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

                {/* fechamento de cada mês */}
                <div style={{
                  border: `1px solid ${T.rule}`, background: T.card, borderRadius: '14px',
                  padding: ehMobile ? '14px' : '16px 18px',
                }}>
                  <CabecalhoSecao
                    titulo={`Fechamento de cada mês de ${anoVisto}`}
                    subtitulo="Saldo no último dia."
                    aberta={secoes.fechamento}
                    onToggle={() => alternar('fechamento')}
                    cor={T.forte}
                  />
                  {secoes.fechamento && <div style={{ height: '12px' }} />}
                  {secoes.fechamento && MESES.map((m, i) => {
                    const absI = absMes(anoVisto, i);
                    const x = calc.porMes[absI] || { fim: 0 };
                    const doAno = MESES.map((_, j) => calc.porMes[absMes(anoVisto, j)]?.fim || 0);
                    const maxAno = Math.max(1, ...doAno.map((y) => Math.abs(y)));
                    return (
                      <div key={m} onClick={() => setMes(i)} style={{
                        display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'center',
                        padding: '7px 0', borderBottom: '1px solid #E4E8E0', cursor: 'pointer',
                        opacity: absI < mesInicialAbs ? 0.5 : 1,
                      }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: i === mes ? 600 : 400 }}>{m}</div>
                          <div style={{
                            height: '5px', borderRadius: '3px',
                            background: x.fim < 0 ? C.rose : T.medio, marginTop: '5px',
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
              </>
            )}
          </>
        )}

        {/* ═══════════ ABA: CALENDÁRIO ═══════════ */}
        {aba === 'calendario' && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setListaMeses(!listaMeses)}
                  aria-expanded={listaMeses}
                  aria-label="Escolher outro mês"
                  style={{
                    border: 0, background: 'transparent', padding: 0, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '9px', textAlign: 'left',
                  }}
                >
                  <span style={{
                    fontFamily: "'Bricolage Grotesque', system-ui",
                    fontSize: 'clamp(20px, 4.4vw, 28px)', fontWeight: 800, color: C.ink,
                  }}>
                    {MESES[mes]}{outroAno ? ` de ${anoVisto}` : ''}
                  </span>
                  <span aria-hidden="true" style={{
                    color: T.forte, fontSize: '11px', lineHeight: 1,
                    transform: listaMeses ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform .2s ease',
                  }}>
                    ▼
                  </span>
                </button>
                <p style={{ fontSize: '12px', color: C.soft, margin: '4px 0 0' }}>
                  Adicione quantos lançamentos quiser em cada dia. O resto entra sozinho.
                </p>

                {listaMeses && (
                  <>
                    <div
                      onClick={() => setListaMeses(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 30 }}
                    />
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 31,
                      background: T.card, border: `1px solid ${T.rule}`, borderRadius: '12px',
                      boxShadow: '0 10px 30px rgba(18,33,28,.16)',
                      padding: '6px', minWidth: '210px', maxHeight: '60vh', overflowY: 'auto',
                    }}>
                      {MESES.map((m, i) => {
                        const absI = absMes(anoVisto, i);
                        const info = calc.porMes[absI];
                        const v = info ? info.fim : 0;
                        const ativo = i === mes;
                        const desativado = absI < mesInicialAbs;
                        return (
                          <button
                            key={m}
                            onClick={() => { setMes(i); setListaMeses(false); }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              gap: '12px', width: '100%', border: 0, cursor: 'pointer',
                              background: ativo ? T.pale : 'transparent',
                              borderRadius: '8px', padding: '9px 11px', textAlign: 'left',
                              opacity: desativado ? 0.5 : 1,
                            }}
                          >
                            <span style={{ fontSize: '13.5px', fontWeight: ativo ? 600 : 400, color: C.ink }}>
                              {m}
                            </span>
                            <span style={{
                              fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                              fontSize: '12px', fontWeight: 600, color: v < 0 ? C.rose : T.forte,
                            }}>
                              {curto(v)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div style={{
                fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                fontSize: '13px', fontWeight: 600, color: r.fim < 0 ? C.rose : T.forte,
              }}>
                fecha em {brl(r.fim)}
              </div>
            </div>

            {ehMobile ? (
              <div style={{ display: 'grid', gap: '8px', marginBottom: '18px' }}>
                {linhasDoMes.map((L) => {
                  const cor = faixa(L.saldo);
                  const temAuto = L.ents.length || L.fixs.length || L.vars.length || L.pars.length;
                  return (
                    <div key={L.dia} style={{
                      display: 'flex', alignItems: 'stretch', gap: '12px',
                      border: `1px solid ${L.ehHoje ? C.amber : T.rule}`,
                      background: T.card, borderRadius: '11px', padding: '12px 13px',
                    }}>
                      <div style={{
                        flex: 'none', width: '42px', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'flex-start',
                        borderRight: `1px solid ${T.rule}`, paddingRight: '10px',
                      }}>
                        <div style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                          fontSize: '20px', fontWeight: 600, lineHeight: 1, letterSpacing: '-0.01em',
                          color: L.ehHoje ? C.amber : L.fds ? C.soft : C.ink,
                        }}>
                          {String(L.dia).padStart(2, '0')}
                        </div>
                        <div style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: '9.5px',
                          textTransform: 'uppercase', letterSpacing: '0.1em',
                          color: L.ehHoje ? C.amber : C.soft, marginTop: '4px',
                        }}>
                          {L.ehHoje ? 'hoje' : DIAS_SEM[L.sem]}
                        </div>
                      </div>

                      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: temAuto ? '8px' : '6px' }}>
                          <span style={{
                            fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                            fontSize: '14px', fontWeight: 700, background: cor.bg, color: cor.fg,
                            padding: '4px 9px', borderRadius: '7px', whiteSpace: 'nowrap',
                          }}>
                            {brl(L.saldo)}
                          </span>
                        </div>

                        {temAuto > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                            {L.ents.map((x) => <React.Fragment key={x.id}>{etiqueta(`+ ${x.nome || 'entrada'} ${curto(num(valorNoMes(x, absVisto)))}`, T.pale, T.forte)}</React.Fragment>)}
                            {L.fixs.map((x) => <React.Fragment key={x.id}>{etiqueta(`− ${x.nome || 'conta'} ${curto(num(valorNoMes(x, absVisto)))}`, '#E6E9E2', C.soft)}</React.Fragment>)}
                            {L.vars.map((x) => <React.Fragment key={x.id}>{etiqueta(`− ${x.nome || 'variável'} ${curto(num(valorNoMes(x, absVisto)))}`, '#F3E6CC', C.amber)}</React.Fragment>)}
                            {L.pars.map((x) => <React.Fragment key={x.id}>{etiqueta(`− ${x.nome || 'parcela'} ${numeroDaParcela(x, absVisto)}/${x.quantidade} ${curto(num(x.valor))}`, '#F0E3DA', C.clay)}</React.Fragment>)}
                          </div>
                        )}

                        <Lancamentos
                          tema={T}
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
                border: `1px solid ${T.rule}`, borderRadius: '14px', overflow: 'hidden',
                background: T.card, marginBottom: '18px',
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
                            padding: '11px 10px', background: T.cabecalho, borderBottom: `1px solid ${T.rule}`,
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
                              padding: '10px', borderBottom: '1px solid #E2E6DE', textAlign: 'left',
                              verticalAlign: 'top', whiteSpace: 'nowrap',
                            }}>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: L.ehHoje ? C.amber : L.fds ? C.soft : C.ink }}>
                                {String(L.dia).padStart(2, '0')}
                              </span>
                              <span style={{ fontSize: '10px', color: C.soft, marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {DIAS_SEM[L.sem]}
                              </span>
                            </td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #E2E6DE', textAlign: 'left', verticalAlign: 'top' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {L.ents.map((x) => <React.Fragment key={x.id}>{etiqueta(`+ ${x.nome || 'entrada'} ${curto(num(valorNoMes(x, absVisto)))}`, T.pale, T.forte)}</React.Fragment>)}
                                {L.fixs.map((x) => <React.Fragment key={x.id}>{etiqueta(`− ${x.nome || 'conta'} ${curto(num(valorNoMes(x, absVisto)))}`, '#E6E9E2', C.soft)}</React.Fragment>)}
                                {L.vars.map((x) => <React.Fragment key={x.id}>{etiqueta(`− ${x.nome || 'variável'} ${curto(num(valorNoMes(x, absVisto)))}`, '#F3E6CC', C.amber)}</React.Fragment>)}
                                {L.pars.map((x) => <React.Fragment key={x.id}>{etiqueta(`− ${x.nome || 'parcela'} ${numeroDaParcela(x, absVisto)}/${x.quantidade} ${curto(num(x.valor))}`, '#F0E3DA', C.clay)}</React.Fragment>)}
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid #E2E6DE', verticalAlign: 'top' }}>
                              <Lancamentos
                                tema={T}
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

            <p style={{ fontSize: '12px', color: C.soft, lineHeight: 1.6 }}>
              Fundo escuro é folga, claro é aperto, rosa é dia no vermelho. A marca âmbar indica hoje.
            </p>
          </>
        )}

        {/* ═══════════ ABA: CONTAS ═══════════ */}
        {aba === 'contas' && (
          <div style={{
            border: `1px solid ${T.rule}`, background: T.card, borderRadius: '14px',
            padding: ehMobile ? '14px' : '16px 18px',
          }}>
            <CabecalhoSecao
              titulo="Ganhos, contas e parcelas"
              subtitulo={<>Os valores são de <strong>{MESES[mes].toLowerCase()}{outroAno ? ` de ${anoVisto}` : ''}</strong>. Se você não mexer num mês, ele repete o valor do mês anterior — então só edite quando a conta mudar.</>}
              aberta={secoes.contas}
              onToggle={() => alternar('contas')}
              cor={T.forte}
            />

            {secoes.contas && (
              <>
                <Bloco cor={C.deep} fundo="#DCEEE4" titulo="Entra">
                  <TabelaItens
                    itens={d.rendas}
                    exemploNome="ex: Salário"
                    mes={absVisto}
                    onNome={(id, v) => setPadrao('rendas', id, 'nome', v)}
                    onDia={(id, v) => setPadrao('rendas', id, 'dia', v)}
                    onValor={(id, v) => setValorDoMes('rendas', id, v)}
                    onHerdar={(id) => voltarAHerdar('rendas', id)}
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
                    mes={absVisto}
                    onNome={(id, v) => setPadrao('fixos', id, 'nome', v)}
                    onDia={(id, v) => setPadrao('fixos', id, 'dia', v)}
                    onValor={(id, v) => setValorDoMes('fixos', id, v)}
                    onHerdar={(id) => voltarAHerdar('fixos', id)}
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
                    mes={absVisto}
                    onNome={(id, v) => setPadrao('contasVariaveis', id, 'nome', v)}
                    onDia={(id, v) => setPadrao('contasVariaveis', id, 'dia', v)}
                    onValor={(id, v) => setValorDoMes('contasVariaveis', id, v)}
                    onHerdar={(id) => voltarAHerdar('contasVariaveis', id)}
                    onCategoria={(id, v) => setPadrao('contasVariaveis', id, 'categoria', v)}
                    onDel={(id) => delLinha('contasVariaveis', id)}
                    onReordenar={(de, para) => reordenar('contasVariaveis', de, para)}
                  />
                  <BotaoAdd onClick={() => addLinha('contasVariaveis')}>+ Outra conta variável</BotaoAdd>
                  <Total label="Total de contas variáveis" valor={brl(r.variaveisPlanejadas ?? 0)} cor={C.amber} />
                </Bloco>

                <Bloco cor={C.clay} fundo="#F0E3DA" titulo="Compras parceladas">
                  <p style={{ fontSize: '12px', color: C.soft, marginTop: '-4px', marginBottom: '12px', lineHeight: 1.6 }}>
                    Informe o valor de <strong>uma</strong> parcela e quantas são. O app conta sozinho e
                    para na última — some da base diária enquanto durar.
                  </p>
                  <TabelaItens
                    itens={d.parcelas || []}
                    exemploNome="ex: Geladeira"
                    comParcelas
                    mes={absVisto}
                    ano={anoVisto}
                    onNome={(id, v) => setPadrao('parcelas', id, 'nome', v)}
                    onDia={(id, v) => setPadrao('parcelas', id, 'dia', v)}
                    onValor={(id, v) => setPadrao('parcelas', id, 'valor', v)}
                    onQuantidade={(id, v) => setPadrao('parcelas', id, 'quantidade', v)}
                    onMesInicio={(id, v) => setPadrao('parcelas', id, 'mesInicio', v)}
                    onDel={(id) => delLinha('parcelas', id)}
                    onReordenar={(de, para) => reordenar('parcelas', de, para)}
                  />
                  <BotaoAdd onClick={() => addLinha('parcelas')}>+ Outra compra parcelada</BotaoAdd>
                  <Total label={`Parcelas em ${MESES[mes].toLowerCase()}`} valor={brl(r.parcelas ?? 0)} cor={C.clay} />
                </Bloco>
              </>
            )}
          </div>
        )}

        <datalist id="cd-categorias">
          {categoriasUsadas.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>

      {/* ───── abas fixas no rodapé, no celular ───── */}
      {ehMobile && (
        <nav style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20,
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          background: T.card, borderTop: `1px solid ${T.rule}`,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {ABAS.map((a) => {
            const ativa = aba === a.id;
            return (
              <button key={a.id} onClick={() => setAba(a.id)} aria-current={ativa} style={{
                border: 0, background: 'transparent', cursor: 'pointer',
                padding: '11px 4px 13px', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '3px',
                color: ativa ? T.forte : C.soft,
              }}>
                <span aria-hidden="true" style={{ fontSize: '15px', lineHeight: 1, opacity: ativa ? 1 : 0.6 }}>
                  {a.icone}
                </span>
                <span style={{ fontSize: '11px', fontWeight: ativa ? 600 : 400 }}>{a.rotulo}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

function CabecalhoSecao({ titulo, subtitulo, aberta, onToggle, cor }) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={aberta}
      style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: '12px', width: '100%', border: 0, background: 'transparent',
        padding: 0, cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block',
          fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700,
          fontSize: '16px', letterSpacing: '-0.01em', color: C.ink,
        }}>
          {titulo}
        </span>
        {subtitulo && (
          <span style={{ display: 'block', fontSize: '12px', color: C.soft, marginTop: '3px', lineHeight: 1.5 }}>
            {subtitulo}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        style={{
          flex: 'none', color: cor || C.soft, fontSize: '11px', lineHeight: 1,
          marginTop: '5px',
          transform: aberta ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform .2s ease',
        }}
      >
        ▼
      </span>
    </button>
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

function TabelaItens({ itens, exemploNome, comCategoria, comParcelas, categorias = [], mes = 0, ano, onNome, onDia, onValor, onCategoria, onQuantidade, onMesInicio, onDel, onReordenar, onHerdar }) {
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
                <div style={{
                  display: 'flex', alignItems: 'center', flex: '1 1 auto', minWidth: 0,
                  border: `1px solid ${(comParcelas || origem.proprio) ? 'rgba(18,33,28,.28)' : 'rgba(18,33,28,.16)'}`,
                  background: '#fff', borderRadius: '8px', overflow: 'hidden',
                }}>
                  <span aria-hidden="true" style={{
                    flex: 'none', paddingLeft: '9px',
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: C.soft,
                  }}>
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    aria-label={comParcelas ? 'Valor da parcela' : 'Valor'}
                    value={comParcelas ? item.valor : valorNoMes(item, mes)}
                    onChange={(e) => onValor(item.id, e.target.value)}
                    style={{
                      flex: '1 1 auto', minWidth: 0, border: 0, background: 'transparent',
                      padding: '8px 9px 8px 6px', fontFamily: "'IBM Plex Mono', monospace",
                      fontVariantNumeric: 'tabular-nums', fontSize: '13px',
                      color: (comParcelas || origem.proprio) ? C.ink : C.soft,
                      textAlign: 'right', outline: 'none',
                    }}
                  />
                </div>
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

              {!comParcelas && (origem.proprio || origem.de !== null) && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
                  marginTop: '6px', fontSize: '10.5px', color: C.soft,
                }}>
                  {origem.proprio ? (
                    <>
                      <span style={{ color: C.deep }}>valor deste mês</span>
                      {origem.de > 0 && (
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
                    <span>repetindo o valor de {rotuloAbs(origem.de)}</span>
                  )}
                </div>
              )}

              {comParcelas && (() => {
                const qtd = Number(item.quantidade || 0);
                const ini = Number(item.mesInicio ?? 0);
                const fimAbs = ini + qtd - 1;
                const numAtual = mes - ini + 1;
                const ativa = qtd > 0 && numAtual >= 1 && numAtual <= qtd;
                const anoIni = anoDe(ini);
                // opções de mês cobrindo do ano anterior ao ano seguinte
                const opcoes = [];
                for (let a = (ano ?? anoIni) - 1; a <= (ano ?? anoIni) + 2; a++) {
                  for (let mm = 0; mm < 12; mm++) opcoes.push(absMes(a, mm));
                }
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: '9.5px',
                        letterSpacing: '0.08em', textTransform: 'uppercase', color: C.soft, flex: 'none',
                      }}>
                        Parcelas
                      </span>
                      <select
                        value={item.quantidade || 12}
                        onChange={(e) => onQuantidade?.(item.id, Number(e.target.value))}
                        aria-label="Quantidade de parcelas"
                        style={{
                          border: '1px solid rgba(18,33,28,.16)', background: '#fff', borderRadius: '8px',
                          padding: '8px 6px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px',
                          color: C.ink, flex: 'none',
                        }}
                      >
                        {Array.from({ length: 47 }, (_, n) => n + 2).map((n) => (
                          <option key={n} value={n}>{n}x</option>
                        ))}
                      </select>

                      <span style={{ fontSize: '11px', color: C.soft, flex: 'none' }}>a partir de</span>
                      <select
                        value={ini}
                        onChange={(e) => onMesInicio?.(item.id, Number(e.target.value))}
                        aria-label="Mês da primeira parcela"
                        style={{
                          border: '1px solid rgba(18,33,28,.16)', background: '#fff', borderRadius: '8px',
                          padding: '8px 6px', fontFamily: 'Inter, sans-serif', fontSize: '12px',
                          color: C.ink, flex: '1 1 auto', minWidth: 0,
                        }}
                      >
                        {opcoes.map((abs) => (
                          <option key={abs} value={abs}>{MESES[mesDe(abs)]} {anoDe(abs)}</option>
                        ))}
                      </select>
                    </div>

                    {num(item.valor) > 0 && qtd > 0 && (
                      <div style={{ fontSize: '10.5px', color: C.soft, marginTop: '6px', lineHeight: 1.6 }}>
                        {qtd}x de {brl(num(item.valor))} = <strong style={{ color: C.clay }}>{brl(num(item.valor) * qtd)}</strong>
                        {' · '}
                        {ativa
                          ? `${numAtual}ª parcela`
                          : (mes < ini ? `começa em ${rotuloAbs(ini)}` : 'já quitada')}
                        {` · termina em ${rotuloAbs(fimAbs)}`}
                      </div>
                    )}
                  </>
                );
              })()}

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
function BotoesAdicionar({ onAdd, primeiro, corEntrada = C.deep }) {
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
        style={{ ...base, color: corEntrada }}
        title="Adicionar uma entrada"
      >
        <span style={{ fontSize: '13px', lineHeight: 1, fontWeight: 700 }}>+</span>
        entrada
      </button>
    </div>
  );
}

function Lancamentos({ lancs, onCampo, onDel, onAdd, tema }) {
  const T = tema || { forte: C.deep, pale: C.pale };
  if (!lancs.length) {
    return <BotoesAdicionar onAdd={onAdd} corEntrada={T.forte} primeiro />;
  }

  return (
    <div style={{ display: 'grid', gap: '6px' }}>
      {lancs.map((l) => {
        const ehEntrada = l.tipo === 'entrada';
        const cor = ehEntrada ? T.forte : C.rose;
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
                  background: ehEntrada ? T.pale : 'transparent',
                  color: ehEntrada ? T.forte : 'rgba(99,115,108,.55)',
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '14px', fontWeight: 700, lineHeight: 1,
                }}
              >
                +
              </button>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', flex: '0 1 104px', minWidth: 0,
              border: `1px solid ${C.rule}`, background: '#fff', borderRadius: '7px', overflow: 'hidden',
            }}>
              <span aria-hidden="true" style={{
                flex: 'none', paddingLeft: '8px',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '11.5px', color: C.soft,
              }}>
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                aria-label="Valor"
                value={l.valor}
                onChange={(e) => onCampo(l.id, 'valor', e.target.value)}
                style={{
                  flex: '1 1 auto', minWidth: 0, border: 0, background: 'transparent',
                  padding: '7px 8px 7px 5px', fontFamily: "'IBM Plex Mono', monospace",
                  fontVariantNumeric: 'tabular-nums', fontSize: '13px',
                  color: num(l.valor) > 0 ? cor : C.ink,
                  fontWeight: num(l.valor) > 0 ? 600 : 400,
                  textAlign: 'right', outline: 'none',
                }}
              />
            </div>

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

      <BotoesAdicionar onAdd={onAdd} corEntrada={T.forte} />
    </div>
  );
}
