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
// Paleta pastel do gráfico de categorias — tons suaves que convivem bem
// com o verde/azul da interface sem competir com os números.
const PASTEL = [
  '#9CC5A1', '#F2CC8F', '#E8A6A6', '#A3C4DC', '#C3B1D9',
  '#F0B892', '#8FCFC3', '#D9CBA3', '#B7B7D8', '#E9BFD3',
  '#AFC9A8', '#DDC0A0',
];

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
  pagos: {},
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
    pagos: dados.pagos || {},
    dias: dados.dias || {},
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

export default function ControleDiario({ familyId, supabase, onSair }) {
  const hoje = new Date();
  const [d, setD] = useState(PADRAO);
  const [aba, setAba] = useState('hoje');
  const [mes, setMes] = useState(hoje.getMonth());
  const [anoVisto, setAnoVisto] = useState(hoje.getFullYear());
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState("");
  const [ehMobile, setEhMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 760 : false);
  const [secoes, setSecoes] = useState({ ranking: true, fechamento: false });
  const [listaMeses, setListaMeses] = useState(false);
  const [mostrarFamilia, setMostrarFamilia] = useState(false);
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const [editandoNome, setEditandoNome] = useState(false);
  const [menuLembrete, setMenuLembrete] = useState(null);
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);
  const [nome, setNome] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage?.getItem('vistta:nome') || '';
  });

  const salvarNome = (novo) => {
    const limpo = (novo || '').trim();
    setNome(limpo);
    try { window.localStorage?.setItem('vistta:nome', limpo); } catch {}
  };

  // Se ainda não há nome escolhido, usa a parte inicial do e-mail como palpite.
  const [emailUsuario, setEmailUsuario] = useState('');
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setEmailUsuario(data?.session?.user?.email || '');
    })();
  }, []);

  const primeiroNome = useMemo(() => {
    if (nome) return nome;
    if (!emailUsuario) return '';
    const bruto = emailUsuario.split('@')[0].split(/[._-]/)[0];
    return bruto ? bruto.charAt(0).toUpperCase() + bruto.slice(1) : '';
  }, [nome, emailUsuario]);
  const [mostrarValores, setMostrarValores] = useState(() => {
    if (typeof window === 'undefined') return true;
    const salvo = window.localStorage?.getItem('vistta:mostrarValores');
    return salvo === null ? true : salvo === '1';
  });

  const alternarValores = () => {
    setMostrarValores((prev) => {
      const novo = !prev;
      try { window.localStorage?.setItem('vistta:mostrarValores', novo ? '1' : '0'); } catch {}
      return novo;
    });
  };

  // Máscara de privacidade: quando o olho está fechado, todo valor em R$
  // exibido na tela vira bolinhas — os números continuam calculados
  // normalmente por trás, só a exibição muda.
  const V = (n) => (mostrarValores ? brl(n) : 'R$ ••••');
  const Vc = (n) => (mostrarValores ? curto(n) : '••');
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
    // nem todo navegador aceita scrollTo com opções; se falhar, cai no simples
    try {
      if (typeof trilha.scrollTo === 'function') {
        trilha.scrollTo({ left: Math.max(0, alvo), behavior: 'smooth' });
      } else {
        trilha.scrollLeft = Math.max(0, alvo);
      }
    } catch {
      trilha.scrollLeft = Math.max(0, alvo);
    }
  }, [mes, anoVisto, carregando, ehMobile, aba]);

  useEffect(() => { setListaMeses(false); }, [mes, anoVisto, aba]);

  useEffect(() => {
    const carregar = async () => {
      try {
        const { data, error } = await supabase.from('families').select('data').eq('id', familyId).single();
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
  }, [familyId]);

  useEffect(() => {
    if (carregando) return;
    if (syncRef.current) clearTimeout(syncRef.current);
    syncRef.current = setTimeout(async () => {
      try {
        await supabase.from('families').update({ data: d }).eq('id', familyId);
      } catch (err) {
        console.error('Erro ao sincronizar:', err);
        setAviso('Erro ao salvar no servidor');
      }
    }, 1000);
    return () => clearTimeout(syncRef.current);
  }, [d]);

  useEffect(() => {
    const canal = supabase
      .channel(`family-${familyId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'families', filter: `id=eq.${familyId}` },
        (payload) => {
          if (payload.new && payload.new.data) {
            const vindo = payload.new.data;
            setD(migrarParaAbsoluto({ ...PADRAO, ...vindo, dias: normalizarDias(vindo.dias) }));
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [familyId]);

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
      const ganhosTotal = (d.rendas || []).reduce((acc, x) => acc + num(valorNoMes(x, abs)), 0);
      const fixosTotal = (d.fixos || []).reduce((acc, x) => acc + num(valorNoMes(x, abs)), 0);
      const ativasNoMes = parcelasDoMes(d.parcelas || [], abs);
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

        const ent = (d.rendas || []).reduce((acc, x) => (Number(x.dia) === dia ? acc + num(valorNoMes(x, abs)) : acc), 0);
        const fix = (d.fixos || []).reduce((acc, x) => (Number(x.dia) === dia ? acc + num(valorNoMes(x, abs)) : acc), 0);
        const par = ativasNoMes.reduce((acc, x) => (Number(x.dia) === dia ? acc + num(x.valor) : acc), 0);

        let varPlanejada = 0;
        (d.contasVariaveis || []).forEach((x) => {
          if (Number(x.dia) === dia) {
            const val = num(valorNoMes(x, abs));
            varPlanejada += val;
            if (val > 0) {
              const c = (x.categoria && x.categoria.trim()) || (x.nome && x.nome.trim()) || 'Sem categoria';
              cats[c] = (cats[c] || 0) + val;
            }
          }
        });

        // contas fixas e parcelas também são saída, então entram no ranking
        (d.fixos || []).forEach((x) => {
          if (Number(x.dia) === dia) {
            const val = num(valorNoMes(x, abs));
            if (val > 0) {
              const c = (x.nome && x.nome.trim()) || 'Conta fixa';
              cats[c] = (cats[c] || 0) + val;
            }
          }
        });
        ativasNoMes.forEach((x) => {
          if (Number(x.dia) === dia) {
            const val = num(x.valor);
            if (val > 0) {
              const c = (x.nome && x.nome.trim()) || 'Parcela';
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
        variaveisPlanejadas: (d.contasVariaveis || []).reduce((acc, x) => acc + num(valorNoMes(x, abs)), 0),
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
  // Saldo acumulado até hoje — o equivalente ao "saldo em conta" de um banco.
  const saldoAtual = ehMesCorrente ? (calc.saldos[hojeChave] ?? r.fim) : r.fim;

  // Lembretes: contas que vencem em até 3 dias, vencem hoje, ou já passaram
  // sem ninguém marcar como paga. Só no mês corrente — em outro mês não faz
  // sentido cobrar pagamento.
  const lembretes = useMemo(() => {
    if (!ehMesCorrente) return [];
    const diaHoje = hoje.getDate();
    const lista = [];

    const considerar = (item, valor, tipo) => {
      if (valor <= 0) return;
      const chave = `${absVisto}:${item.id}`;
      if (d.pagos?.[chave]) return;
      const dia = Number(item.dia);
      const faltam = dia - diaHoje;
      if (faltam > 3) return;
      lista.push({
        chave, nome: item.nome || 'Conta', valor, dia, faltam, tipo,
        atrasada: faltam < 0,
        ehHoje: faltam === 0,
      });
    };

    (d.fixos || []).forEach((f) => considerar(f, num(valorNoMes(f, absVisto)), 'fixa'));
    parcelasDoMes(d.parcelas || [], absVisto).forEach((x) => considerar(x, num(x.valor), 'parcela'));
    (d.contasVariaveis || []).forEach((x) => considerar(x, num(valorNoMes(x, absVisto)), 'variavel'));

    return lista.sort((a, b) => a.dia - b.dia);
  }, [d, absVisto, ehMesCorrente]);

  const marcarPaga = (chave) =>
    setD((p) => ({ ...p, pagos: { ...(p.pagos || {}), [chave]: true } }));
  const sobrouHoje = podeHoje - gastoDeHoje;
  const mediaGasta = totalDias > 0 ? r.variaveis / totalDias : 0;
  const noRitmo = mediaGasta <= r.baseDia;

  const categoriasUsadas = useMemo(() => {
    const usadas = new Set();
    (d.contasVariaveis || []).forEach((v) => { if (v.categoria && v.categoria.trim()) usadas.add(v.categoria.trim()); });
    Object.values(d.dias || {}).forEach((reg) => {
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
      ents: antesDoInicio ? [] : (d.rendas || []).filter((x) => Number(x.dia) === dia && num(valorNoMes(x, absVisto)) > 0),
      fixs: antesDoInicio ? [] : (d.fixos || []).filter((x) => Number(x.dia) === dia && num(valorNoMes(x, absVisto)) > 0),
      vars: antesDoInicio ? [] : (d.contasVariaveis || []).filter((x) => Number(x.dia) === dia && num(valorNoMes(x, absVisto)) > 0),
      pars: antesDoInicio ? [] : parcelasDoMes(d.parcelas || [], absVisto).filter((x) => Number(x.dia) === dia),
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

  // Ícone circular contornado, no padrão dos apps de banco
  // Navegação de tempo (ano + trilha de meses). Fica em posições diferentes
  // conforme a aba: no Hoje vem depois dos atalhos; nas outras, no topo.
  const NavegacaoTempo = () => (
    <>
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

      <div style={{ marginBottom: '22px' }}>
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
                    {Vc(v)}
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
    </>
  );

  const IconeFaixa = ({ onClick, rotulo, children }) => (
    <button
      onClick={onClick}
      aria-label={rotulo}
      style={{
        width: '36px', height: '36px', flex: 'none',
        borderRadius: '50%', border: '1px solid rgba(255,255,255,.35)',
        background: 'transparent', color: '#fff', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );

  return (
    <div style={{
      background: T.paper, color: C.ink, minHeight: '100dvh',
      fontFamily: 'Inter, system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased',
      transition: 'background .25s ease',
    }}>
      <style>{`
        html, body { overflow-x: hidden; width: 100%; overscroll-behavior-x: none; margin: 0; }
        * { box-sizing: border-box; }
        input, select, button { font-family: inherit; }
      `}</style>

      {/* ═════════ FAIXA SUPERIOR ═════════
          Separa identidade e informação principal do conteúdo editável,
          que é o que dá hierarquia visual aos apps de banco. */}
      <div style={{
        background: T.forte,
        color: '#fff',
        padding: ehMobile ? '16px 16px 32px' : '20px 24px 36px',
        borderRadius: '0 0 24px 24px',
        transition: 'background .25s ease',
      }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          }}>
            <button
              onClick={() => setAba('hoje')}
              aria-label="Ir para a tela Hoje"
              style={{
                border: 0, background: 'transparent', padding: 0, cursor: 'pointer',
                fontFamily: "'Bricolage Grotesque', system-ui", fontWeight: 800,
                fontSize: '21px', letterSpacing: '-0.03em', color: '#fff',
              }}
            >
              Vistta
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <IconeFaixa onClick={alternarValores} rotulo={mostrarValores ? 'Ocultar valores' : 'Mostrar valores'}>
                {mostrarValores ? (
                  <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                )}
              </IconeFaixa>

              <IconeFaixa onClick={() => setMostrarMenu(true)} rotulo="Abrir menu">
                <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </IconeFaixa>
            </div>
          </div>

          {/* conteúdo da faixa muda conforme a aba */}
          {aba === 'hoje' && (
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={() => setEditandoNome(true)}
                aria-label="Alterar seu nome"
                style={{
                  border: 0, background: 'transparent', padding: 0, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#fff',
                  textAlign: 'left',
                }}
              >
                <span style={{
                  fontFamily: "'Bricolage Grotesque', system-ui",
                  fontSize: 'clamp(22px, 5.5vw, 28px)', fontWeight: 800, letterSpacing: '-0.02em',
                }}>
                  Olá{primeiroNome ? `, ${primeiroNome}` : ''}
                </span>
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>

              {lembretes.length > 0 && (
                <div style={{
                  display: 'flex', gap: '10px', overflowX: 'auto',
                  marginTop: '18px', paddingBottom: '4px',
                }}>
                  {lembretes.map((L) => (
                    <CardLembrete
                      key={L.chave}
                      lembrete={L}
                      valorFormatado={V(L.valor)}
                      menuAberto={menuLembrete === L.chave}
                      onAbrirMenu={() => setMenuLembrete(menuLembrete === L.chave ? null : L.chave)}
                      onMarcarPaga={() => { marcarPaga(L.chave); setMenuLembrete(null); }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {aba === 'calendario' && (
            <div style={{ marginTop: '22px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setListaMeses(!listaMeses)}
                  aria-expanded={listaMeses}
                  aria-label="Escolher outro mês"
                  style={{
                    border: 0, background: 'transparent', padding: 0, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '9px', color: '#fff',
                  }}
                >
                  <span style={{ fontFamily: "'Bricolage Grotesque', system-ui", fontSize: 'clamp(24px, 6vw, 32px)', fontWeight: 800 }}>
                    {MESES[mes]}{outroAno ? ` de ${anoVisto}` : ''}
                  </span>
                  <span aria-hidden="true" style={{
                    fontSize: '11px', lineHeight: 1,
                    transform: listaMeses ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform .2s ease',
                  }}>
                    ▼
                  </span>
                </button>

                {listaMeses && (
                  <>
                    <div onClick={() => setListaMeses(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 31,
                      background: '#fff', border: `1px solid ${T.rule}`, borderRadius: '12px',
                      boxShadow: '0 12px 32px rgba(18,33,28,.22)',
                      padding: '6px', minWidth: '215px', maxHeight: '58vh', overflowY: 'auto',
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
                            <span style={{ fontSize: '13.5px', fontWeight: ativo ? 600 : 400, color: C.ink }}>{m}</span>
                            <span style={{
                              fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                              fontSize: '12px', fontWeight: 600, color: v < 0 ? C.rose : T.forte,
                            }}>
                              {Vc(v)}
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
                fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,.9)',
              }}>
                fecha em {V(r.fim)}
              </div>
            </div>
          )}

          {aba === 'contas' && (
            <div style={{ marginTop: '22px' }}>
              <div style={{ fontFamily: "'Bricolage Grotesque', system-ui", fontSize: 'clamp(24px, 6vw, 32px)', fontWeight: 800 }}>
                Contas
              </div>
              <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,.75)', marginTop: '8px' }}>
                Valores de {MESES[mes].toLowerCase()}{outroAno ? ` de ${anoVisto}` : ''} · comprometido {V(r.fixos + r.parcelas)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═════════ CONTEÚDO ═════════ */}
      <div style={{ padding: ehMobile ? '18px 12px 24px' : '22px 16px 40px' }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
        {mostrarFamilia && (
          <PainelFamilia supabase={supabase} onFechar={() => setMostrarFamilia(false)} tema={T} />
        )}

        {mostrarMenu && (
          <PainelMenu
            tema={T}
            abaAtual={aba}
            onIrPara={(a) => { setAba(a); setMostrarMenu(false); }}
            onAbrirFamilia={() => { setMostrarMenu(false); setMostrarFamilia(true); }}
            onSair={onSair}
            onFechar={() => setMostrarMenu(false)}
          />
        )}

        {mostrarExplicacao && (
          <ExplicacaoLimite
            ehMesCorrente={ehMesCorrente}
            ganhos={r.ganhos}
            fixos={r.fixos}
            parcelas={r.parcelas}
            variaveis={r.variaveis}
            sobra={r.sobra}
            diasRestantes={diasRestantes}
            totalDias={totalDias}
            podeHoje={podeHoje}
            baseDia={r.baseDia}
            gastoDeHoje={gastoDeHoje}
            sobrouHoje={sobrouHoje}
            formatar={V}
            mes={MESES[mes].toLowerCase()}
            tema={T}
            onFechar={() => setMostrarExplicacao(false)}
          />
        )}

        {editandoNome && (
          <EditarNome
            valorInicial={nome || primeiroNome}
            onSalvar={salvarNome}
            onFechar={() => setEditandoNome(false)}
            tema={T}
          />
        )}

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
                {/* ── saldo: o estado atual, primeira informação da tela ── */}
                <button
                  onClick={() => setAba('calendario')}
                  style={{
                    width: '100%', textAlign: 'left', border: 0, background: 'transparent',
                    padding: 0, cursor: 'pointer', marginBottom: '22px',
                  }}
                >
                  <span style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                  }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: C.ink }}>
                      {ehMesCorrente ? 'Saldo hoje' : `Saldo no fim de ${MESES[mes].toLowerCase()}`}
                    </span>
                    <span aria-hidden="true" style={{ color: C.soft, fontSize: '15px' }}>›</span>
                  </span>
                  <span style={{
                    display: 'block',
                    fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                    fontSize: 'clamp(26px, 7vw, 34px)', fontWeight: 600, letterSpacing: '-0.02em',
                    color: saldoAtual < 0 ? C.rose : C.ink, marginTop: '6px', lineHeight: 1.1,
                  }}>
                    {V(saldoAtual)}
                  </span>
                </button>

                {/* ── atalhos, no padrão dos apps de banco ── */}
                <div style={{
                  display: 'flex', gap: '10px', overflowX: 'auto',
                  paddingBottom: '6px', marginBottom: '22px',
                }}>
                  {[
                    { id: 'lancar', rotulo: 'Lançar', onClick: () => setAba('calendario'), icone: (
                      <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>
                    ) },
                    { id: 'cal', rotulo: 'Calendário', onClick: () => setAba('calendario'), icone: (
                      <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>
                    ) },
                    { id: 'contas', rotulo: 'Contas', onClick: () => setAba('contas'), icone: (
                      <><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="14" y2="18" /></>
                    ) },
                    { id: 'membros', rotulo: 'Membros', onClick: () => setMostrarFamilia(true), icone: (
                      <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>
                    ) },
                  ].map((atalho) => (
                    <button
                      key={atalho.id}
                      onClick={atalho.onClick}
                      style={{
                        flex: 'none', border: 0, background: 'transparent', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px',
                        width: '74px', padding: 0,
                      }}
                    >
                      <span style={{
                        width: '58px', height: '58px', borderRadius: '50%',
                        background: T.card, border: `1px solid ${T.rule}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: T.forte,
                      }}>
                        <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                          {atalho.icone}
                        </svg>
                      </span>
                      <span style={{ fontSize: '11.5px', color: C.ink, textAlign: 'center', lineHeight: 1.3 }}>
                        {atalho.rotulo}
                      </span>
                    </button>
                  ))}
                </div>

                <NavegacaoTempo />

                {/* ── quanto dá para gastar: conclusão, não abertura ── */}
                <div style={{
                  border: `1px solid ${T.pale}`, background: T.baseBg, borderRadius: '14px',
                  padding: '16px 18px', marginBottom: '18px',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    gap: '10px', flexWrap: 'wrap',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: C.ink }}>
                        {ehMesCorrente ? 'Posso gastar hoje' : `Média por dia em ${MESES[mes].toLowerCase()}`}
                      </span>
                      <button
                        onClick={() => setMostrarExplicacao(true)}
                        aria-label="Como este valor é calculado"
                        style={{
                          border: 0, background: 'transparent', padding: 0, cursor: 'pointer',
                          color: C.soft, display: 'flex', alignItems: 'center', lineHeight: 0,
                        }}
                      >
                        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 16v-4" />
                          <path d="M12 8h.01" />
                        </svg>
                      </button>
                    </span>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                      fontSize: '22px', fontWeight: 600,
                      color: (ehMesCorrente ? sobrouHoje : r.baseDia) < 0 ? C.rose : T.forte,
                    }}>
                      {V(ehMesCorrente ? sobrouHoje : r.baseDia)}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: C.soft, marginTop: '8px', lineHeight: 1.55 }}>
                    {ehMesCorrente ? (
                      gastoDeHoje > 0
                        ? <>Você já gastou {V(gastoDeHoje)} hoje, de um limite de {V(podeHoje)}.</>
                        : <>Sobram {V(r.sobra)} para os {diasRestantes} {diasRestantes === 1 ? 'dia restante' : 'dias restantes'} do mês.</>
                    ) : (
                      <>({V(r.ganhos)} − {V(r.fixos)} de fixas
                      {r.parcelas > 0 ? ` − ${V(r.parcelas)} de parcelas` : ''}) ÷ {totalDias} dias</>
                    )}
                  </div>
                </div>

                {/* ── como o mês se divide: entrou, saiu previsto, saiu a mais ── */}
                <div style={{
                  border: `1px solid ${T.rule}`, background: T.card, borderRadius: '14px',
                  padding: ehMobile ? '15px' : '17px 19px', marginBottom: '18px',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    gap: '10px', marginBottom: '14px', flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: C.ink }}>
                      Resumo de {MESES[mes].toLowerCase()}
                    </span>
                    <span style={{ fontSize: '11.5px', color: C.soft }}>
                      abertura {V(r.abertura)}
                    </span>
                  </div>

                  <BarrasDoMes
                    entrou={r.ganhos}
                    previsto={r.fixos + r.parcelas + (r.variaveisPlanejadas ?? 0)}
                    aMais={Math.max(0, r.variaveis - (r.variaveisPlanejadas ?? 0))}
                    formatar={V}
                    tema={T}
                  />

                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    gap: '10px', marginTop: '15px', paddingTop: '13px',
                    borderTop: `1px solid ${T.rule}`,
                  }}>
                    <span style={{ fontSize: '12.5px', color: C.soft }}>
                      Sobra do mês
                    </span>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                      fontSize: '15px', fontWeight: 600, color: r.sobra < 0 ? C.rose : T.forte,
                    }}>
                      {V(r.sobra)}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    gap: '10px', marginTop: '7px',
                  }}>
                    <span style={{ fontSize: '12.5px', color: C.soft }}>
                      Saldo no fim de {ABREV[mes]}
                    </span>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                      fontSize: '15px', fontWeight: 600, color: r.fim < 0 ? C.rose : C.ink,
                    }}>
                      {V(r.fim)}
                    </span>
                  </div>
                </div>

                {/* ranking */}
                <div style={{
                  border: `1px solid ${T.rule}`, background: T.card, borderRadius: '14px',
                  padding: ehMobile ? '14px' : '16px 18px', marginBottom: '18px',
                }}>
                  <CabecalhoSecao
                    titulo={`Principais gastos de ${MESES[mes].toLowerCase()}`}
                    subtitulo="Todas as saídas do mês: fixas, parcelas, variáveis e avulsos."
                    aberta={secoes.ranking}
                    onToggle={() => alternar('ranking')}
                    cor={T.forte}
                  />
                  <div style={{ height: '12px' }} />
                  {!secoes.ranking ? null : catsOrdenadas.length === 0 ? (
                    <p style={{ fontSize: '12px', color: C.soft, lineHeight: 1.6 }}>
                      Nada lançado ainda. O primeiro gasto com categoria aparece aqui.
                    </p>
                  ) : (
                    <div style={{
                      display: 'flex', gap: '18px', alignItems: 'center',
                      flexDirection: ehMobile ? 'column' : 'row',
                    }}>
                      <Pizza dados={catsOrdenadas} total={totalCats} mostrarValores={mostrarValores} />

                      <div style={{ flex: '1 1 auto', minWidth: 0, width: '100%' }}>
                        {catsOrdenadas.map(([c, v], idx) => (
                          <div key={c} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: '10px', padding: '7px 0',
                            borderBottom: idx === catsOrdenadas.length - 1 ? 0 : '1px solid #E4E8E0',
                          }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                              <span aria-hidden="true" style={{
                                width: '11px', height: '11px', borderRadius: '3px', flex: 'none',
                                background: PASTEL[idx % PASTEL.length],
                              }} />
                              <span style={{
                                fontSize: '13px', color: C.ink,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {c}
                              </span>
                            </span>
                            <span style={{ textAlign: 'right', flex: 'none' }}>
                              <span style={{
                                display: 'block',
                                fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
                                fontSize: '13px', fontWeight: 600, color: C.ink,
                              }}>
                                {V(v)}
                              </span>
                              <span style={{ display: 'block', fontSize: '10.5px', color: C.soft }}>
                                {totalCats > 0 ? Math.round((v / totalCats) * 100) : 0}%
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </>
            )}
          </>
        )}

        {/* ═══════════ ABA: CALENDÁRIO ═══════════ */}
        {aba === 'calendario' && (
          <>
            <NavegacaoTempo />

            <p style={{ fontSize: '12px', color: C.soft, margin: '0 0 14px', lineHeight: 1.5 }}>
              Adicione quantos lançamentos quiser em cada dia. O resto entra sozinho.
            </p>

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
                            {V(L.saldo)}
                          </span>
                        </div>

                        {temAuto > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                            {L.ents.map((x) => <React.Fragment key={x.id}>{etiqueta(`+ ${x.nome || 'entrada'} ${Vc(num(valorNoMes(x, absVisto)))}`, T.pale, T.forte)}</React.Fragment>)}
                            {L.fixs.map((x) => <React.Fragment key={x.id}>{etiqueta(`− ${x.nome || 'conta'} ${Vc(num(valorNoMes(x, absVisto)))}`, '#E6E9E2', C.soft)}</React.Fragment>)}
                            {L.vars.map((x) => <React.Fragment key={x.id}>{etiqueta(`− ${x.nome || 'variável'} ${Vc(num(valorNoMes(x, absVisto)))}`, '#F3E6CC', C.amber)}</React.Fragment>)}
                            {L.pars.map((x) => <React.Fragment key={x.id}>{etiqueta(`− ${x.nome || 'parcela'} ${numeroDaParcela(x, absVisto)}/${x.quantidade} ${Vc(num(x.valor))}`, '#F0E3DA', C.clay)}</React.Fragment>)}
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
                                {L.ents.map((x) => <React.Fragment key={x.id}>{etiqueta(`+ ${x.nome || 'entrada'} ${Vc(num(valorNoMes(x, absVisto)))}`, T.pale, T.forte)}</React.Fragment>)}
                                {L.fixs.map((x) => <React.Fragment key={x.id}>{etiqueta(`− ${x.nome || 'conta'} ${Vc(num(valorNoMes(x, absVisto)))}`, '#E6E9E2', C.soft)}</React.Fragment>)}
                                {L.vars.map((x) => <React.Fragment key={x.id}>{etiqueta(`− ${x.nome || 'variável'} ${Vc(num(valorNoMes(x, absVisto)))}`, '#F3E6CC', C.amber)}</React.Fragment>)}
                                {L.pars.map((x) => <React.Fragment key={x.id}>{etiqueta(`− ${x.nome || 'parcela'} ${numeroDaParcela(x, absVisto)}/${x.quantidade} ${Vc(num(x.valor))}`, '#F0E3DA', C.clay)}</React.Fragment>)}
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
                              {V(L.saldo)}
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
          <div>
            <NavegacaoTempo />

            <p style={{ fontSize: '12px', color: C.soft, margin: '0 0 4px', lineHeight: 1.55 }}>
              Se você não mexer num mês, ele repete o valor do mês anterior — então só edite quando a
              conta mudar.
            </p>

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
                  <Total label="Total que entra" valor={V(r.ganhos)} cor={C.deep} />
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
                  <Total label="Total de contas fixas" valor={V(r.fixos)} cor={C.steel} />
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
                  <Total label="Total de contas variáveis" valor={V(r.variaveisPlanejadas ?? 0)} cor={C.amber} />
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
                  <Total label={`Parcelas em ${MESES[mes].toLowerCase()}`} valor={V(r.parcelas ?? 0)} cor={C.clay} />
                </Bloco>
            </>
          </div>
        )}

        <datalist id="cd-categorias">
          {categoriasUsadas.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>
      </div>

      {/* ───── menu flutuante no rodapé, no celular ─────
          Pílula compacta (estilo Nubank), não a largura toda da tela.
          "sticky" faz ela acompanhar a rolagem sem o pulo que "fixed"
          causa no Safari do iPhone quando a barra de endereço esconde. ───── */}
      {ehMobile && (
        <div style={{
          position: 'sticky', bottom: 0, zIndex: 20,
          display: 'flex', justifyContent: 'center',
          paddingTop: '10px',
          paddingBottom: `calc(14px + env(safe-area-inset-bottom))`,
          pointerEvents: 'none',
        }}>
          <nav style={{
            pointerEvents: 'auto',
            display: 'flex', gap: '2px',
            background: T.card, border: `1px solid ${T.rule}`,
            borderRadius: '999px', padding: '5px',
            boxShadow: '0 10px 28px rgba(18,33,28,.18)',
          }}>
            {ABAS.map((a) => {
              const ativa = aba === a.id;
              return (
                <button key={a.id} onClick={() => setAba(a.id)} aria-current={ativa} style={{
                  border: 0, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: ativa ? '9px 15px' : '9px 13px',
                  borderRadius: '999px',
                  background: ativa ? T.forte : 'transparent',
                  color: ativa ? '#fff' : C.soft,
                  fontSize: '12.5px', fontWeight: ativa ? 600 : 500,
                  transition: 'background .18s ease, color .18s ease, padding .18s ease',
                  whiteSpace: 'nowrap',
                }}>
                  <span aria-hidden="true" style={{ fontSize: '14px', lineHeight: 1 }}>{a.icone}</span>
                  {ativa && <span>{a.rotulo}</span>}
                </button>
              );
            })}
          </nav>
        </div>
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
                        {qtd}x de {V(num(item.valor))} = <strong style={{ color: C.clay }}>{V(num(item.valor) * qtd)}</strong>
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

// Painel de família: lista quem está dentro e permite convidar/remover.
// Aparece como uma janela sobre a tela, aberta pelo botão "Família" no topo.
function PainelFamilia({ supabase, onFechar, tema }) {
  const T = tema || { forte: C.deep, pale: C.pale, card: C.card, rule: C.rule };
  const [membros, setMembros] = useState(null);
  const [meuId, setMeuId] = useState(null);
  const [convite, setConvite] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      const { data: sessaoData } = await supabase.auth.getSession();
      setMeuId(sessaoData?.session?.user?.id || null);

      const { data, error } = await supabase.rpc('list_family_members');
      if (error) { setErro('Não foi possível carregar os membros.'); return; }
      setMembros(data || []);
    })();
  }, []);

  const souDono = membros?.find((m) => m.user_id === meuId)?.role === 'owner';

  const gerarConvite = async () => {
    setGerando(true); setErro('');
    try {
      const { data, error } = await supabase.rpc('create_invite');
      if (error) throw error;
      setConvite(data);
    } catch (err) {
      setErro(err.message || 'Não foi possível gerar o convite.');
    } finally {
      setGerando(false);
    }
  };

  const removerMembro = async (userId) => {
    try {
      const { error } = await supabase.rpc('remove_member', { p_user_id: userId });
      if (error) throw error;
      setMembros((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      setErro(err.message || 'Não foi possível remover.');
    }
  };

  const copiarConvite = () => {
    if (convite) navigator.clipboard?.writeText(convite);
  };

  return (
    <>
      <div onClick={onFechar} style={{ position: 'fixed', inset: 0, background: 'rgba(18,33,28,.35)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 41, width: 'min(420px, 92vw)', maxHeight: '82vh', overflowY: 'auto',
        background: '#fff', borderRadius: '16px', padding: '22px',
        boxShadow: '0 20px 50px rgba(18,33,28,.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: '18px', margin: 0 }}>
            Membros da família
          </h2>
          <button onClick={onFechar} aria-label="Fechar" style={{
            border: 0, background: 'transparent', fontSize: '20px', color: C.soft, cursor: 'pointer', lineHeight: 1,
          }}>
            ×
          </button>
        </div>
        <p style={{ fontSize: '12.5px', color: C.soft, marginBottom: '18px' }}>
          Quem está dentro vê e edita os mesmos dados, em tempo real.
        </p>

        {membros === null ? (
          <p style={{ fontSize: '13px', color: C.soft }}>Carregando...</p>
        ) : (
          <div style={{ display: 'grid', gap: '8px', marginBottom: '20px' }}>
            {membros.map((m) => (
              <div key={m.user_id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                border: `1px solid ${T.rule}`, borderRadius: '10px', padding: '10px 12px',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.email}{m.user_id === meuId ? ' (você)' : ''}
                  </div>
                  <div style={{ fontSize: '11px', color: C.soft, marginTop: '2px' }}>
                    {m.role === 'owner' ? 'Dono' : 'Membro'}
                  </div>
                </div>
                {souDono && m.role !== 'owner' && (
                  <button onClick={() => removerMembro(m.user_id)} style={{
                    border: `1px solid ${C.rosePale}`, background: 'transparent', color: C.rose,
                    borderRadius: '8px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', flex: 'none',
                  }}>
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {souDono ? (
          <div style={{ borderTop: `1px solid ${T.rule}`, paddingTop: '16px' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: C.ink, marginBottom: '4px' }}>
              Convidar alguém
            </div>
            <p style={{ fontSize: '12px', color: C.soft, marginBottom: '12px', lineHeight: 1.5 }}>
              Gere um código, envie para a pessoa (WhatsApp, por exemplo). Vale por 24 horas e só
              funciona uma vez.
            </p>

            {!convite ? (
              <button onClick={gerarConvite} disabled={gerando} style={{
                width: '100%', background: T.forte, color: '#fff', border: 0, borderRadius: '9px',
                padding: '11px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
              }}>
                {gerando ? 'Gerando...' : 'Gerar código de convite'}
              </button>
            ) : (
              <div style={{
                border: `1px dashed ${T.rule}`, borderRadius: '10px', padding: '14px', textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '24px', fontWeight: 700,
                  letterSpacing: '0.12em', color: T.forte, marginBottom: '10px',
                }}>
                  {convite}
                </div>
                <button onClick={copiarConvite} style={{
                  border: `1px solid ${T.rule}`, background: 'transparent', color: C.ink,
                  borderRadius: '8px', padding: '8px 14px', fontSize: '12.5px', cursor: 'pointer',
                }}>
                  Copiar código
                </button>
                <p style={{ fontSize: '11px', color: C.soft, marginTop: '10px' }}>
                  Válido por 24 horas, uso único.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '12px', color: C.soft, borderTop: `1px solid ${T.rule}`, paddingTop: '14px' }}>
            Só o dono da família pode convidar ou remover pessoas.
          </p>
        )}

        {erro && (
          <div style={{
            border: `1px solid ${C.rosePale}`, background: C.rosePale, color: C.rose,
            borderRadius: '10px', padding: '10px 13px', fontSize: '12.5px', marginTop: '14px',
          }}>
            {erro}
          </div>
        )}
      </div>
    </>
  );
}

// Menu principal: as três seções do app (cada uma com seta, como um menu de
// navegação de verdade), depois Membros da família e Sair.
function PainelMenu({ tema, abaAtual, onIrPara, onAbrirFamilia, onSair, onFechar }) {
  const T = tema || { forte: C.deep, rule: C.rule };

  const Linha = ({ onClick, icone, texto, destaque, cor }) => (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '10px', border: 0, background: destaque ? T.pale : 'transparent',
      borderRadius: '10px', padding: '13px 14px', cursor: 'pointer', textAlign: 'left',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
        <span aria-hidden="true" style={{ color: cor || (destaque ? T.forte : C.soft), display: 'flex' }}>
          {icone}
        </span>
        <span style={{ fontSize: '14px', fontWeight: destaque ? 600 : 500, color: cor || C.ink }}>
          {texto}
        </span>
      </span>
      <span aria-hidden="true" style={{ color: C.soft, fontSize: '13px' }}>›</span>
    </button>
  );

  const iconeHoje = (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
  const iconeCalendario = (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
  const iconeContas = (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="14" y2="18" />
    </svg>
  );
  const iconeMembros = (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
  const iconeSair = (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );

  return (
    <>
      <div onClick={onFechar} style={{ position: 'fixed', inset: 0, background: 'rgba(18,33,28,.35)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 41, width: 'min(340px, 90vw)', background: '#fff', borderRadius: '16px',
        padding: '10px', boxShadow: '0 20px 50px rgba(18,33,28,.25)',
      }}>
        <Linha onClick={() => onIrPara('hoje')} icone={iconeHoje} texto="Hoje" destaque={abaAtual === 'hoje'} />
        <Linha onClick={() => onIrPara('calendario')} icone={iconeCalendario} texto="Calendário" destaque={abaAtual === 'calendario'} />
        <Linha onClick={() => onIrPara('contas')} icone={iconeContas} texto="Contas" destaque={abaAtual === 'contas'} />

        <div style={{ height: '1px', background: T.rule, margin: '6px 8px' }} />

        <Linha onClick={onAbrirFamilia} icone={iconeMembros} texto="Membros da família" />
        <Linha onClick={onSair} icone={iconeSair} texto="Sair" cor={C.rose} />
      </div>
    </>
  );
}

// Gráfico de rosca das categorias, em tons pastéis.
// Desenhado com traço em círculo: cada fatia é um arco controlado por
// stroke-dasharray, o que evita cálculo de caminhos e fica nítido em qualquer tela.
function Pizza({ dados, total, mostrarValores }) {
  const R = 52;
  const CIRC = 2 * Math.PI * R;
  let acumulado = 0;

  if (!total) return null;

  return (
    <div style={{ flex: 'none', position: 'relative', width: '148px', height: '148px' }}>
      <svg width="148" height="148" viewBox="0 0 148 148" role="img" aria-label="Gastos por categoria">
        <g transform="rotate(-90 74 74)">
          {dados.map(([nome, valor], idx) => {
            const fracao = valor / total;
            const traco = fracao * CIRC;
            const deslocamento = -acumulado * CIRC;
            acumulado += fracao;
            return (
              <circle
                key={nome}
                cx="74" cy="74" r={R}
                fill="none"
                stroke={PASTEL[idx % PASTEL.length]}
                strokeWidth="22"
                strokeDasharray={`${traco} ${CIRC - traco}`}
                strokeDashoffset={deslocamento}
              >
                <title>{`${nome}: ${Math.round(fracao * 100)}%`}</title>
              </circle>
            );
          })}
        </g>
      </svg>

      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '9.5px',
          letterSpacing: '0.12em', textTransform: 'uppercase', color: C.soft,
        }}>
          Total
        </span>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
          fontSize: '14px', fontWeight: 600, color: C.ink, marginTop: '2px',
        }}>
          {mostrarValores ? curto(total) : '••'}
        </span>
      </div>
    </div>
  );
}

// Caixa simples para a pessoa escolher como quer ser chamada.
function EditarNome({ valorInicial, onSalvar, onFechar, tema }) {
  const T = tema || { forte: C.deep, rule: C.rule };
  const [texto, setTexto] = useState(valorInicial || '');

  const confirmar = (e) => {
    e.preventDefault();
    onSalvar(texto);
    onFechar();
  };

  return (
    <>
      <div onClick={onFechar} style={{ position: 'fixed', inset: 0, background: 'rgba(18,33,28,.35)', zIndex: 40 }} />
      <form onSubmit={confirmar} style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 41, width: 'min(340px, 90vw)', background: '#fff', borderRadius: '16px',
        padding: '22px', boxShadow: '0 20px 50px rgba(18,33,28,.25)',
      }}>
        <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: '17px', margin: '0 0 4px' }}>
          Como quer ser chamado?
        </h2>
        <p style={{ fontSize: '12.5px', color: C.soft, margin: '0 0 14px' }}>
          Aparece na saudação, só neste aparelho.
        </p>
        <input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Seu nome"
          maxLength={24}
          style={{
            width: '100%', border: `1px solid ${T.rule}`, borderRadius: '10px',
            padding: '11px 13px', fontSize: '15px', fontFamily: 'Inter, sans-serif',
            color: C.ink, marginBottom: '14px',
          }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" style={{
            flex: 1, background: T.forte, color: '#fff', border: 0, borderRadius: '10px',
            padding: '11px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}>
            Salvar
          </button>
          <button type="button" onClick={onFechar} style={{
            border: `1px solid ${T.rule}`, background: 'transparent', color: C.soft,
            borderRadius: '10px', padding: '11px 16px', fontSize: '14px', cursor: 'pointer',
          }}>
            Cancelar
          </button>
        </div>
      </form>
    </>
  );
}

// Card de lembrete de conta, no padrão dos apps de banco: some quando a
// pessoa marca como paga pelos três pontinhos. Vencida fica em bordô.
function CardLembrete({ lembrete, valorFormatado, menuAberto, onAbrirMenu, onMarcarPaga }) {
  const { nome, dia, faltam, atrasada, ehHoje } = lembrete;

  const quando = atrasada
    ? (faltam === -1 ? 'venceu ontem' : `venceu há ${Math.abs(faltam)} dias`)
    : ehHoje
      ? 'vence hoje'
      : faltam === 1 ? 'vence amanhã' : `vence em ${faltam} dias`;

  const fundo = atrasada ? C.vinho : '#fff';
  const corTexto = atrasada ? '#fff' : C.ink;
  const corSuave = atrasada ? 'rgba(255,255,255,.78)' : C.soft;

  return (
    <div style={{
      flex: 'none', width: '205px', position: 'relative',
      background: fundo, borderRadius: '13px', padding: '13px 14px',
      boxShadow: atrasada ? '0 6px 18px rgba(122,46,62,.3)' : '0 4px 14px rgba(18,33,28,.12)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '9.5px',
          letterSpacing: '0.1em', textTransform: 'uppercase', color: corSuave,
        }}>
          {atrasada ? 'Conta vencida' : 'Lembrete de conta'}
        </span>

        <button
          onClick={onAbrirMenu}
          aria-label="Opções do lembrete"
          style={{
            border: 0, background: 'transparent', color: corSuave, cursor: 'pointer',
            padding: 0, lineHeight: 1, fontSize: '15px', flex: 'none', marginTop: '-2px',
          }}
        >
          ⋮
        </button>
      </div>

      <div style={{
        fontSize: '13.5px', fontWeight: 600, color: corTexto, marginTop: '7px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {nome}
      </div>

      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: '8px', marginTop: '4px',
      }}>
        <span style={{ fontSize: '11.5px', color: corSuave }}>
          dia {dia} · {quando}
        </span>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
          fontSize: '13px', fontWeight: 600, color: corTexto,
        }}>
          {valorFormatado}
        </span>
      </div>

      {menuAberto && (
        <>
          <div onClick={onAbrirMenu} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
          <div style={{
            position: 'absolute', top: '34px', right: '10px', zIndex: 31,
            background: '#fff', borderRadius: '10px', padding: '4px',
            boxShadow: '0 10px 26px rgba(18,33,28,.24)', minWidth: '164px',
          }}>
            <button
              onClick={onMarcarPaga}
              style={{
                width: '100%', border: 0, background: 'transparent', cursor: 'pointer',
                borderRadius: '7px', padding: '10px 12px', textAlign: 'left',
                fontSize: '13px', color: C.ink, display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.deep} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Marcar como paga
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Barras deitadas do mês: quanto entrou, quanto era previsto sair e quanto
// saiu além do previsto. Escala compartilhada, para as barras serem
// comparáveis entre si de bater o olho.
function BarrasDoMes({ entrou, previsto, aMais, formatar, tema }) {
  const T = tema || { forte: C.deep, rule: C.rule };
  const maximo = Math.max(entrou, previsto + aMais, 1);

  const linhas = [
    { rotulo: 'Entrou', valor: entrou, cor: T.forte, ajuda: 'salários e entradas avulsas' },
    { rotulo: 'Saiu previsto', valor: previsto, cor: C.steel, ajuda: 'fixas, parcelas e variáveis planejadas' },
    { rotulo: 'Saiu a mais', valor: aMais, cor: C.vinho, ajuda: 'gastos avulsos lançados no calendário' },
  ];

  return (
    <div style={{ display: 'grid', gap: '13px' }}>
      {linhas.map((l) => (
        <div key={l.rotulo}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: '10px', marginBottom: '5px',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
              <span aria-hidden="true" style={{
                width: '9px', height: '9px', borderRadius: '2.5px', background: l.cor, flex: 'none',
              }} />
              <span style={{ fontSize: '12.5px', color: C.ink }}>{l.rotulo}</span>
            </span>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
              fontSize: '13px', fontWeight: 600, color: C.ink, flex: 'none',
            }}>
              {formatar(l.valor)}
            </span>
          </div>

          <div style={{ height: '9px', borderRadius: '5px', background: 'rgba(18,33,28,.07)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '5px', background: l.cor,
              width: `${Math.max(l.valor > 0 ? 3 : 0, (l.valor / maximo) * 100)}%`,
              transition: 'width .3s ease',
            }} />
          </div>

          <div style={{ fontSize: '10.5px', color: C.soft, marginTop: '4px' }}>
            {l.ajuda}
          </div>
        </div>
      ))}
    </div>
  );
}

// Explica de onde vem o "posso gastar hoje", passo a passo, com os números
// reais do mês — para o valor não parecer arbitrário.
function ExplicacaoLimite({
  ehMesCorrente, ganhos, fixos, parcelas, variaveis, sobra,
  diasRestantes, totalDias, podeHoje, baseDia, gastoDeHoje, sobrouHoje,
  formatar, mes, tema, onFechar,
}) {
  const T = tema || { forte: C.deep, rule: C.rule };

  const Linha = ({ rotulo, valor, sinal, forte }) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      gap: '10px', padding: '7px 0',
      borderTop: forte ? `1px solid ${T.rule}` : 0,
      marginTop: forte ? '4px' : 0,
    }}>
      <span style={{ fontSize: '13px', color: forte ? C.ink : C.soft, fontWeight: forte ? 600 : 400 }}>
        {sinal && <span style={{ marginRight: '5px', color: C.soft }}>{sinal}</span>}
        {rotulo}
      </span>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: 'tabular-nums',
        fontSize: '13px', fontWeight: 600, color: C.ink, flex: 'none',
      }}>
        {valor}
      </span>
    </div>
  );

  return (
    <>
      <div onClick={onFechar} style={{ position: 'fixed', inset: 0, background: 'rgba(18,33,28,.35)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 41, width: 'min(400px, 92vw)', maxHeight: '82vh', overflowY: 'auto',
        background: '#fff', borderRadius: '16px', padding: '22px',
        boxShadow: '0 20px 50px rgba(18,33,28,.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: '17px', margin: 0 }}>
            De onde vem esse valor
          </h2>
          <button onClick={onFechar} aria-label="Fechar" style={{
            border: 0, background: 'transparent', fontSize: '20px', color: C.soft, cursor: 'pointer', lineHeight: 1,
          }}>
            ×
          </button>
        </div>

        {ehMesCorrente ? (
          <>
            <p style={{ fontSize: '12.5px', color: C.soft, margin: '0 0 14px', lineHeight: 1.6 }}>
              É o que ainda sobra do mês dividido pelos dias que faltam. Por isso ele muda todo dia:
              se você gasta menos, ele sobe; se gasta mais, ele cai.
            </p>

            <Linha rotulo="Tudo que entra no mês" valor={formatar(ganhos)} />
            <Linha rotulo="Contas fixas" valor={formatar(fixos)} sinal="−" />
            {parcelas > 0 && <Linha rotulo="Parcelas" valor={formatar(parcelas)} sinal="−" />}
            <Linha rotulo="Já gasto no mês" valor={formatar(variaveis)} sinal="−" />
            <Linha rotulo="Sobra do mês" valor={formatar(sobra)} forte />

            <div style={{
              background: T.baseBg || '#E7F0E9', borderRadius: '10px',
              padding: '13px 14px', marginTop: '14px',
            }}>
              <div style={{ fontSize: '12.5px', color: C.ink, lineHeight: 1.6 }}>
                {formatar(sobra)} ÷ {diasRestantes} {diasRestantes === 1 ? 'dia restante' : 'dias restantes'} ={' '}
                <strong>{formatar(podeHoje)}</strong> por dia
              </div>
              {gastoDeHoje > 0 && (
                <div style={{ fontSize: '12.5px', color: C.ink, lineHeight: 1.6, marginTop: '6px' }}>
                  Você já gastou {formatar(gastoDeHoje)} hoje, então ainda restam{' '}
                  <strong>{formatar(sobrouHoje)}</strong>.
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: '12.5px', color: C.soft, margin: '0 0 14px', lineHeight: 1.6 }}>
              Como {mes} não é o mês atual, aqui mostramos a média do mês inteiro — não faria sentido
              falar em "hoje".
            </p>

            <Linha rotulo="Tudo que entra no mês" valor={formatar(ganhos)} />
            <Linha rotulo="Contas fixas" valor={formatar(fixos)} sinal="−" />
            {parcelas > 0 && <Linha rotulo="Parcelas" valor={formatar(parcelas)} sinal="−" />}

            <div style={{
              background: T.baseBg || '#E7F0E9', borderRadius: '10px',
              padding: '13px 14px', marginTop: '14px',
              fontSize: '12.5px', color: C.ink, lineHeight: 1.6,
            }}>
              Dividido por {totalDias} dias = <strong>{formatar(baseDia)}</strong> por dia
            </div>
          </>
        )}

        <p style={{ fontSize: '11.5px', color: C.soft, marginTop: '14px', lineHeight: 1.55 }}>
          As contas variáveis planejadas já entram como gasto mesmo antes do dia chegar, então o número
          é conservador de propósito.
        </p>
      </div>
    </>
  );
}
