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
const CAT_VAR = ["Cartão de crédito","Mercado","Comer fora","Transporte","Saúde","Lazer","Compras","Viagem","Outros"];

const FIXOS_INICIAIS = [
  { id: "f1", nome: "Dízimo", dia: 5, valor: "" },
  { id: "f2", nome: "Condomínio + Aluguel", dia: 10, valor: "" },
  { id: "f3", nome: "Energia", dia: 15, valor: "" },
  { id: "f4", nome: "Gás", dia: 15, valor: "" },
  { id: "f5", nome: "Internet", dia: 20, valor: "" },
  { id: "f6", nome: "Gatos", dia: 10, valor: "" },
  { id: "f7", nome: "Formatura Nalin", dia: 10, valor: "" },
];

const RENDAS_INICIAIS = [
  { id: "r1", nome: "Meu salário", dia: 5, valor: "" },
  { id: "r2", nome: "Salário da esposa", dia: 5, valor: "" },
];

const VARIAVEIS_INICIAIS = [
  { id: "v1", nome: "Cartão de crédito", dia: 10, valor: "" },
  { id: "v2", nome: "Viagem", dia: 15, valor: "" },
];

const SERIES = [
  { key: "ganhos", cor: C.deep, label: "Ganhos" },
  { key: "fixos", cor: C.steel, label: "Contas fixas" },
  { key: "variaveis", cor: C.amber, label: "Variáveis" },
];

const PADRAO = {
  ano: new Date().getFullYear(),
  mesInicial: new Date().getMonth(),
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

const diasNoMes = (ano, mes) => new Date(ano, mes + 1, 0).getDate();
const chaveDia = (ano, mes, dia) => `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

export default function ControleDiario({ familyCode, supabase, onSair }) {
  const [d, setD] = useState(PADRAO);
  const [mes, setMes] = useState(new Date().getMonth());
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState("");
  const [abrirPainel, setAbrirPainel] = useState(true);
  const [serieVisivel, setSerieVisivel] = useState({ ganhos: true, fixos: true, variaveis: true });
  const syncRef = useRef(null);

  // Carregar dados do Supabase na primeira vez
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
          setD({ ...PADRAO, ...data.data });
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

  // Sincronizar quando dados mudam
  useEffect(() => {
    if (carregando) return;

    // Debounce: só salva após 1 segundo sem mudanças
    if (syncRef.current) clearTimeout(syncRef.current);

    syncRef.current = setTimeout(async () => {
      try {
        await supabase
          .from('families')
          .update({ data: d })
          .eq('code', familyCode);
      } catch (err) {
        console.error('Erro ao sincronizar:', err);
        setAviso('Erro ao salvar no servidor');
      }
    }, 1000);

    return () => clearTimeout(syncRef.current);
  }, [d]);

  // Subscrevê em tempo real
  useEffect(() => {
    const channel = supabase
      .channel(`family-${familyCode}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'families', filter: `code=eq.${familyCode}` },
        (payload) => {
          if (payload.new && payload.new.data) {
            setD(payload.new.data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyCode]);

  const hoje = new Date();
  const hojeChave = chaveDia(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const mesInicial = d.mesInicial ?? hoje.getMonth();

  const calc = useMemo(() => {
    const saldos = {};
    const mesesInfo = [];
    let saldo = 0;

    const ganhosTotal = d.rendas.reduce((s, r) => s + num(r.valor), 0);
    const fixosTotal = d.fixos.reduce((s, f) => s + num(f.valor), 0);
    const variaveisTotalTipico = d.contasVariaveis.reduce((s, v) => s + num(v.valor), 0);

    for (let m = 0; m < 12; m++) {
      const antes = m < mesInicial;
      const total = diasNoMes(d.ano, m);

      if (antes) {
        for (let dia = 1; dia <= total; dia++) {
          saldos[chaveDia(d.ano, m, dia)] = 0;
        }
        mesesInfo.push({ abertura: 0, ganhos: 0, fixos: 0, baseDia: 0, variaveis: 0, sobra: 0, fim: 0, cats: {}, dias: total });
        continue;
      }

      const abertura = saldo;
      const baseDia = total > 0 ? (ganhosTotal - fixosTotal) / total : 0;
      let variaveis = 0;
      const cats = {};

      for (let dia = 1; dia <= total; dia++) {
        const k = chaveDia(d.ano, m, dia);
        const reg = d.dias[k] || {};
        const avulso = num(reg.valor);

        const ent = d.rendas.reduce((s, r) => (Number(r.dia) === dia ? s + num(r.valor) : s), 0);
        const fix = d.fixos.reduce((s, f) => (Number(f.dia) === dia ? s + num(f.valor) : s), 0);

        let varPlanejada = 0;
        d.contasVariaveis.forEach((x) => {
          if (Number(x.dia) === dia) {
            const val = num(x.valor);
            varPlanejada += val;
            if (val > 0) {
              const c = x.nome || "Variável";
              cats[c] = (cats[c] || 0) + val;
            }
          }
        });

        saldo = saldo + ent - fix - varPlanejada - avulso;
        saldos[k] = saldo;

        if (avulso > 0) {
          const c = reg.categoria || "Cartão de crédito";
          cats[c] = (cats[c] || 0) + avulso;
        }
        variaveis += varPlanejada + avulso;
      }

      mesesInfo.push({
        abertura, ganhos: ganhosTotal, fixos: fixosTotal, baseDia, variaveis,
        sobra: ganhosTotal - fixosTotal - variaveis,
        fim: saldo, cats, dias: total,
      });
    }
    return { saldos, mesesInfo, variaveisTotalTipico };
  }, [d]);

  const r = calc.mesesInfo[mes];
  const totalDias = r.dias;
  const mediaGasta = totalDias > 0 ? r.variaveis / totalDias : 0;
  const noRitmo = mediaGasta <= r.baseDia;
  const antesDoInicio = mes < mesInicial;

  const setPadrao = (lista, id, campo, valor) =>
    setD((p) => ({ ...p, [lista]: p[lista].map((i) => (i.id === id ? { ...i, [campo]: valor } : i)) }));

  const setDia = (dia, campo, valor) => {
    const k = chaveDia(d.ano, mes, dia);
    setD((p) => ({ ...p, dias: { ...p.dias, [k]: { ...(p.dias[k] || {}), [campo]: valor } } }));
  };

  const addLinha = (lista) =>
    setD((p) => ({ ...p, [lista]: [...p[lista], { id: `${lista}${Date.now()}`, nome: "", dia: 10, valor: "" }] }));
  const delLinha = (lista, id) => setD((p) => ({ ...p, [lista]: p[lista].filter((i) => i.id !== id) }));

  const catsOrdenadas = Object.entries(r.cats).sort((a, b) => b[1] - a[1]);
  const maxCat = catsOrdenadas.length ? catsOrdenadas[0][1] : 1;
  const maxMes = Math.max(1, ...Array.from({ length: totalDias }, (_, i) => Math.abs(calc.saldos[chaveDia(d.ano, mes, i + 1)] || 0)));

  const faixa = (v) => {
    if (v < 0) return { bg: C.rosePale, fg: C.rose, barra: C.rose };
    if (v >= maxMes * 0.5) return { bg: C.deep, fg: "#EEF0EA", barra: "#EEF0EA" };
    return { bg: C.pale, fg: C.deep, barra: C.mid };
  };

  if (carregando) {
    return (
      <div style={{
        background: C.paper,
        color: C.soft,
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'system-ui',
      }}>
        Carregando seu controle…
      </div>
    );
  }

  return (
    <div style={{
      background: C.paper,
      color: C.ink,
      minHeight: '100vh',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '20px 16px 56px',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <style>{`
        * { box-sizing: border-box; }
        input, select, button { font-family: inherit; }
      `}</style>

      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '11px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: C.soft,
          }}>
            Controle diário · {d.ano} · Código: <strong>{familyCode}</strong>
          </div>
          <button
            onClick={onSair}
            style={{
              border: `1px solid ${C.rule}`,
              background: 'transparent',
              color: C.ink,
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => e.target.style.background = '#E4E8DF'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
          >
            Sair
          </button>
        </div>

        <h1 style={{
          fontFamily: "'Bricolage Grotesque', system-ui",
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 0.92,
          margin: '6px 0 18px',
          fontSize: 'clamp(30px, 7vw, 52px)'
        }}>
          Quanto dá<br />para gastar hoje
        </h1>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          marginTop: '14px',
          marginBottom: '16px'
        }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: C.soft,
          }}>
            Começar a valer em
          </span>
          <select
            value={d.mesInicial}
            onChange={(e) => {
              const v = Number(e.target.value);
              setD((p) => ({ ...p, mesInicial: v }));
              setMes(v);
            }}
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontWeight: 700,
              fontSize: '14px',
              color: C.ink,
              background: C.card,
              border: `1px solid ${C.rule}`,
              borderRadius: '8px',
              padding: '7px 12px',
              cursor: 'pointer',
            }}
          >
            {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <span style={{
            fontSize: '12px',
            color: C.soft,
          }}>
            tudo antes disso fica zerado
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          border: `1px solid ${C.rule}`,
          background: C.card,
          borderRadius: '14px',
          padding: '20px',
          margin: '18px 0',
        }}>
          <div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '10px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: C.soft,
              marginBottom: '6px'
            }}>
              Saldo no fim de {MESES[mes].toLowerCase()}
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
              fontSize: 'clamp(24px, 5vw, 36px)',
              lineHeight: 1,
              color: r.fim < 0 ? C.rose : C.deep,
            }}>
              {brl(r.fim)}
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end'
          }}>
            <div style={{
              fontSize: '12px',
              color: C.soft,
              textAlign: 'right',
              lineHeight: 1.6,
            }}>
              {antesDoInicio
                ? `Este mês fica zerado — o controle começa em ${MESES[mesInicial].toLowerCase()}.`
                : "Sincroniza em tempo real com o celular da sua esposa."}
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '4px',
          overflowX: 'auto',
          marginBottom: '16px',
          paddingBottom: '6px'
        }}>
          {MESES.map((m, i) => {
            const v = calc.mesesInfo[i].fim;
            const on = i === mes;
            const desativado = i < mesInicial;
            return (
              <button
                key={m}
                onClick={() => setMes(i)}
                style={{
                  flex: '1 0 auto',
                  minWidth: '64px',
                  border: `1px solid ${C.rule}`,
                  background: on ? C.ink : 'transparent',
                  borderColor: on ? C.ink : C.rule,
                  borderRadius: '9px',
                  padding: '8px 6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                  opacity: desativado && !on ? 0.45 : 1,
                }}
                onMouseEnter={(e) => { if (!on && !desativado) e.target.style.background = '#E4E8DF'; }}
                onMouseLeave={(e) => { if (!on) e.target.style.background = 'transparent'; }}
              >
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '11px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: on ? '#AFC0B7' : C.soft,
                }}>
                  {ABREV[i]}
                </div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginTop: '3px',
                  color: on ? (v < 0 ? '#F0A9A3' : '#8FD9BE') : v < 0 ? C.rose : C.deep,
                }}>
                  {curto(v)}
                </div>
              </button>
            );
          })}
        </div>

        {aviso && (
          <div style={{
            border: `1px solid ${C.rosePale}`,
            background: C.rosePale,
            color: C.rose,
            borderRadius: '10px',
            padding: '10px 13px',
            fontSize: '13px',
            margin: '14px 0'
          }}>
            {aviso}
          </div>
        )}

        <div style={{
          border: `1px solid ${C.pale}`,
          background: '#E7F0E9',
          borderRadius: '12px',
          padding: '16px 18px',
          marginBottom: '18px',
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '10px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: C.soft,
          }}>
            Base por dia em {MESES[mes].toLowerCase()}
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontVariantNumeric: 'tabular-nums',
            fontSize: 'clamp(24px, 5vw, 32px)',
            fontWeight: 600,
            lineHeight: 1,
            marginTop: '6px',
            color: r.baseDia < 0 ? C.rose : C.deep,
          }}>
            {brl(r.baseDia)}
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 400, color: C.soft, marginLeft: 12 }}>
              · {brl(r.baseDia * 7)} por semana
            </span>
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '11.5px',
            color: C.soft,
            marginTop: '10px',
            lineHeight: 1.7,
          }}>
            ({brl(r.ganhos)} de ganhos − {brl(r.fixos)} de contas fixas) ÷ {totalDias} dias
          </div>
          <p style={{
            fontSize: '12px',
            color: C.soft,
            marginTop: '10px',
            lineHeight: 1.6,
          }}>
            {antesDoInicio ? (
              `Mês anterior ao início do controle — sem lançamentos aqui.`
            ) : r.variaveis > 0 ? (
              <>
                Você já gastou <strong style={{ color: noRitmo ? C.deep : C.rose }}>{brl(mediaGasta)} por dia</strong> em
                média este mês — {noRitmo ? "dentro da base." : "acima da base."}
              </>
            ) : (
              "Lance os gastos variados na tabela e este número ganha um comparativo do quanto você está gastando de verdade."
            )}
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
          margin: '18px 0',
        }}>
          {[
            { lab: "Vem do mês anterior", val: brl(r.abertura), cor: r.abertura < 0 ? C.rose : C.ink },
            { lab: "Ganhos", val: brl(r.ganhos), cor: C.deep },
            { lab: "Contas fixas", val: brl(r.fixos), cor: C.steel },
            { lab: "Variáveis", val: brl(r.variaveis), cor: C.amber },
            { lab: "Sobra do mês", val: brl(r.sobra), cor: r.sobra < 0 ? C.rose : C.deep },
          ].map((box, i) => (
            <div key={i} style={{
              border: `1px solid ${C.rule}`,
              background: C.card,
              borderRadius: '11px',
              padding: '12px 13px',
            }}>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: C.soft,
              }}>
                {box.lab}
              </div>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontVariantNumeric: 'tabular-nums',
                fontSize: '17px',
                fontWeight: 600,
                marginTop: '5px',
                color: box.cor,
              }}>
                {box.val}
              </div>
            </div>
          ))}
        </div>

        {/* Painel de ganhos, fixos e variáveis */}
        <div style={{
          border: `1px solid ${C.rule}`,
          background: C.card,
          borderRadius: '14px',
          padding: '16px 18px',
          marginBottom: '18px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '16px'
          }}>
            <div>
              <h2 style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 700,
                fontSize: '16px',
                letterSpacing: '-0.01em',
                margin: '0 0 3px',
              }}>
                Ganhos, contas fixas e variáveis
              </h2>
              <p style={{
                fontSize: '12px',
                color: C.soft,
                margin: '3px 0 0',
              }}>
                Escreva o nome, o dia e o valor. Vale a partir de {ABREV[mesInicial]} e aparece sozinho na tabela.
              </p>
            </div>
            <button
              onClick={() => setAbrirPainel(!abrirPainel)}
              style={{
                border: `1px solid ${C.rule}`,
                background: 'transparent',
                color: C.ink,
                borderRadius: '9px',
                padding: '9px 14px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => e.target.style.background = '#E4E8DF'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              {abrirPainel ? 'Fechar' : 'Abrir'}
            </button>
          </div>

          {abrirPainel && (
            <>
              <div style={{
                borderRadius: '12px',
                padding: '14px 16px 16px',
                marginTop: '16px',
                background: '#DCEEE4',
                borderTop: `4px solid ${C.deep}`,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontSize: '14.5px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  marginBottom: '12px',
                  color: C.deep,
                }}>
                  <span style={{
                    width: '11px',
                    height: '11px',
                    borderRadius: '50%',
                    background: C.deep,
                    boxShadow: `0 0 0 3px rgba(255,255,255,.5)`,
                  }} />
                  Entra
                </div>
                <TabelaItens
                  itens={d.rendas}
                  onNome={(id, v) => setPadrao('rendas', id, 'nome', v)}
                  onDia={(id, v) => setPadrao('rendas', id, 'dia', v)}
                  onValor={(id, v) => setPadrao('rendas', id, 'valor', v)}
                  onDel={(id) => delLinha('rendas', id)}
                />
                <button
                  onClick={() => addLinha('rendas')}
                  style={{
                    border: `1px solid rgba(18,33,28,.18)`,
                    background: 'rgba(255,255,255,.55)',
                    color: C.ink,
                    borderRadius: '9px',
                    padding: '9px 14px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    marginTop: '10px',
                  }}
                >
                  + Outra entrada
                </button>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: `1px solid rgba(18,33,28,.14)`,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: '14px',
                  fontWeight: 600,
                }}>
                  <span>Total que entra</span>
                  <span style={{ color: C.deep }}>{brl(calc.mesesInfo[mesInicial]?.ganhos ?? 0)}</span>
                </div>
              </div>

              <div style={{
                borderRadius: '12px',
                padding: '14px 16px 16px',
                marginTop: '16px',
                background: '#E1E7EF',
                borderTop: `4px solid ${C.steel}`,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontSize: '14.5px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  marginBottom: '12px',
                  color: C.steel,
                }}>
                  <span style={{
                    width: '11px',
                    height: '11px',
                    borderRadius: '50%',
                    background: C.steel,
                    boxShadow: `0 0 0 3px rgba(255,255,255,.5)`,
                  }} />
                  Sai todo mês (contas fixas)
                </div>
                <TabelaItens
                  itens={d.fixos}
                  onNome={(id, v) => setPadrao('fixos', id, 'nome', v)}
                  onDia={(id, v) => setPadrao('fixos', id, 'dia', v)}
                  onValor={(id, v) => setPadrao('fixos', id, 'valor', v)}
                  onDel={(id) => delLinha('fixos', id)}
                />
                <button
                  onClick={() => addLinha('fixos')}
                  style={{
                    border: `1px solid rgba(18,33,28,.18)`,
                    background: 'rgba(255,255,255,.55)',
                    color: C.ink,
                    borderRadius: '9px',
                    padding: '9px 14px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    marginTop: '10px',
                  }}
                >
                  + Outra conta fixa
                </button>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: `1px solid rgba(18,33,28,.14)`,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: '14px',
                  fontWeight: 600,
                }}>
                  <span>Total de contas fixas</span>
                  <span style={{ color: C.steel }}>{brl(calc.mesesInfo[mesInicial]?.fixos ?? 0)}</span>
                </div>
              </div>

              <div style={{
                borderRadius: '12px',
                padding: '14px 16px 16px',
                marginTop: '16px',
                background: '#F3E6CC',
                borderTop: `4px solid ${C.amber}`,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontSize: '14.5px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  marginBottom: '12px',
                  color: C.amber,
                }}>
                  <span style={{
                    width: '11px',
                    height: '11px',
                    borderRadius: '50%',
                    background: C.amber,
                    boxShadow: `0 0 0 3px rgba(255,255,255,.5)`,
                  }} />
                  Contas variáveis
                </div>
                <p style={{
                  fontSize: '12px',
                  color: C.soft,
                  marginTop: '-4px',
                  marginBottom: '10px',
                  lineHeight: 1.6,
                }}>
                  Cartão de crédito, viagem — coisas que voltam todo mês, mas o valor muda.
                </p>
                <TabelaItens
                  itens={d.contasVariaveis}
                  onNome={(id, v) => setPadrao('contasVariaveis', id, 'nome', v)}
                  onDia={(id, v) => setPadrao('contasVariaveis', id, 'dia', v)}
                  onValor={(id, v) => setPadrao('contasVariaveis', id, 'valor', v)}
                  onDel={(id) => delLinha('contasVariaveis', id)}
                />
                <button
                  onClick={() => addLinha('contasVariaveis')}
                  style={{
                    border: `1px solid rgba(18,33,28,.18)`,
                    background: 'rgba(255,255,255,.55)',
                    color: C.ink,
                    borderRadius: '9px',
                    padding: '9px 14px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    marginTop: '10px',
                  }}
                >
                  + Outra conta variável
                </button>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: `1px solid rgba(18,33,28,.14)`,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: '14px',
                  fontWeight: 600,
                }}>
                  <span>Total de contas variáveis</span>
                  <span style={{ color: C.amber }}>{brl(calc.variaveisTotalTipico)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tabela diária */}
        <h2 style={{
          fontFamily: "'Bricolage Grotesque', system-ui",
          fontSize: 'clamp(22px, 4.4vw, 30px)',
          fontWeight: 800,
          marginBottom: '4px',
        }}>
          {MESES[mes]}
        </h2>
        <p style={{
          fontSize: '12px',
          color: C.soft,
          marginBottom: '12px',
        }}>
          Só a coluna de gasto avulso é sua — o resto entra sozinho.
        </p>

        <div style={{
          border: `1px solid ${C.rule}`,
          borderRadius: '14px',
          overflow: 'hidden',
          background: C.card,
          marginBottom: '18px',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: '600px',
            }}>
              <thead>
                <tr>
                  <th style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: C.soft,
                    fontWeight: 500,
                    textAlign: 'left',
                    padding: '11px 10px',
                    background: '#E7EAE2',
                    borderBottom: `1px solid ${C.rule}`,
                  }}>
                    Dia
                  </th>
                  <th style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: C.soft,
                    fontWeight: 500,
                    textAlign: 'left',
                    padding: '11px 10px',
                    background: '#E7EAE2',
                    borderBottom: `1px solid ${C.rule}`,
                  }}>
                    Lançamentos automáticos
                  </th>
                  <th style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: C.soft,
                    fontWeight: 500,
                    textAlign: 'right',
                    padding: '11px 10px',
                    background: '#E7EAE2',
                    borderBottom: `1px solid ${C.rule}`,
                  }}>
                    Gasto avulso
                  </th>
                  <th style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: C.soft,
                    fontWeight: 500,
                    textAlign: 'right',
                    padding: '11px 10px',
                    background: '#E7EAE2',
                    borderBottom: `1px solid ${C.rule}`,
                  }}>
                    Categoria
                  </th>
                  <th style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: C.soft,
                    fontWeight: 500,
                    textAlign: 'right',
                    padding: '11px 10px',
                    background: '#E7EAE2',
                    borderBottom: `1px solid ${C.rule}`,
                  }}>
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: totalDias }, (_, i) => {
                  const dia = i + 1;
                  const k = chaveDia(d.ano, mes, dia);
                  const reg = d.dias[k] || {};
                  const saldo = calc.saldos[k] || 0;
                  const cor = faixa(saldo);
                  const sem = new Date(d.ano, mes, dia).getDay();
                  const fds = sem === 0 || sem === 6;
                  const ents = antesDoInicio ? [] : d.rendas.filter((x) => Number(x.dia) === dia && num(x.valor) > 0);
                  const fixs = antesDoInicio ? [] : d.fixos.filter((x) => Number(x.dia) === dia && num(x.valor) > 0);
                  const vars = antesDoInicio ? [] : d.contasVariaveis.filter((x) => Number(x.dia) === dia && num(x.valor) > 0);

                  return (
                    <tr
                      key={dia}
                      style={{
                        background: fds ? 'rgba(18,33,28,0.02)' : 'transparent',
                        boxShadow: k === hojeChave ? `inset 3px 0 0 ${C.amber}` : 'none',
                      }}
                    >
                      <td style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontVariantNumeric: 'tabular-nums',
                        padding: '12px 10px',
                        borderBottom: `1px solid #E2E6DE`,
                        textAlign: 'left',
                      }}>
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>
                          {String(dia).padStart(2, '0')}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          color: C.soft,
                          marginLeft: '5px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}>
                          {DIAS_SEM[sem]}
                        </span>
                      </td>
                      <td style={{
                        padding: '12px 10px',
                        borderBottom: `1px solid #E2E6DE`,
                        textAlign: 'left',
                      }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {ents.map((x) => (
                            <span key={x.id} style={{
                              display: 'inline-block',
                              fontFamily: "'IBM Plex Mono', monospace",
                              fontSize: '10.5px',
                              padding: '3px 7px',
                              borderRadius: '6px',
                              background: C.pale,
                              color: C.deep,
                              whiteSpace: 'nowrap',
                            }}>
                              + {x.nome || 'entrada'} {curto(num(x.valor))}
                            </span>
                          ))}
                          {fixs.map((x) => (
                            <span key={x.id} style={{
                              display: 'inline-block',
                              fontFamily: "'IBM Plex Mono', monospace",
                              fontSize: '10.5px',
                              padding: '3px 7px',
                              borderRadius: '6px',
                              background: '#E6E9E2',
                              color: C.soft,
                              whiteSpace: 'nowrap',
                            }}>
                              − {x.nome || 'conta'} {curto(num(x.valor))}
                            </span>
                          ))}
                          {vars.map((x) => (
                            <span key={x.id} style={{
                              display: 'inline-block',
                              fontFamily: "'IBM Plex Mono', monospace",
                              fontSize: '10.5px',
                              padding: '3px 7px',
                              borderRadius: '6px',
                              background: '#F3E6CC',
                              color: C.amber,
                              whiteSpace: 'nowrap',
                            }}>
                              − {x.nome || 'variável'} {curto(num(x.valor))}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{
                        padding: '12px 6px',
                        borderBottom: `1px solid #E2E6DE`,
                        textAlign: 'right',
                      }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="—"
                          value={reg.valor ?? ""}
                          onChange={(e) => setDia(dia, "valor", e.target.value)}
                          style={{
                            width: '100%',
                            border: 0,
                            background: 'transparent',
                            textAlign: 'right',
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: '14px',
                            color: num(reg.valor) > 0 ? C.rose : C.ink,
                            fontWeight: num(reg.valor) > 0 ? 600 : 400,
                            padding: '9px 8px',
                            borderRadius: '7px',
                          }}
                          onFocus={(e) => e.target.style.background = '#fff'}
                          onBlur={(e) => e.target.style.background = 'transparent'}
                        />
                      </td>
                      <td style={{
                        padding: '12px 6px',
                        borderBottom: `1px solid #E2E6DE`,
                        textAlign: 'right',
                      }}>
                        {num(reg.valor) > 0 ? (
                          <select
                            value={reg.categoria || "Cartão de crédito"}
                            onChange={(e) => setDia(dia, "categoria", e.target.value)}
                            style={{
                              width: '100%',
                              border: `1px dashed ${C.rule}`,
                              background: 'transparent',
                              borderRadius: '7px',
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '11px',
                              color: C.soft,
                              padding: '5px 6px',
                            }}
                          >
                            {CAT_VAR.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : null}
                      </td>
                      <td style={{
                        textAlign: 'right',
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: '14px',
                        fontWeight: 600,
                        padding: '0 14px 0 10px',
                        borderBottom: `1px solid #E2E6DE`,
                        background: cor.bg,
                        color: cor.fg,
                        position: 'relative',
                        whiteSpace: 'nowrap',
                      }}>
                        <span style={{
                          position: 'absolute',
                          left: 0,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          height: '20px',
                          width: '3px',
                          borderRadius: '2px',
                          background: cor.barra,
                          opacity: 0.65,
                        }} />
                        {brl(saldo)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{
          fontSize: '12px',
          color: C.soft,
          marginTop: '14px',
          lineHeight: 1.6,
        }}>
          Verde escuro é folga, verde claro é aperto, rosa é dia no vermelho. A barra âmbar marca hoje.
        </p>

        {/* Painéis de resumo */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '18px',
          marginTop: '18px',
        }}>
          <div style={{
            border: `1px solid ${C.rule}`,
            background: C.card,
            borderRadius: '14px',
            padding: '16px 18px',
          }}>
            <h2 style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontWeight: 700,
              fontSize: '16px',
              letterSpacing: '-0.01em',
              margin: '0 0 3px',
            }}>
              Para onde foi em {MESES[mes].toLowerCase()}
            </h2>
            <p style={{
              fontSize: '12px',
              color: C.soft,
              margin: '0 0 14px',
            }}>
              Variáveis planejadas e gastos avulsos.
            </p>
            {catsOrdenadas.length === 0 ? (
              <p style={{
                fontSize: '12px',
                color: C.soft,
                marginTop: '8px',
                lineHeight: 1.6,
              }}>
                Nada lançado ainda. O primeiro gasto que você registrar aparece aqui.
              </p>
            ) : (
              catsOrdenadas.map(([c, v]) => (
                <div key={c} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '10px',
                  alignItems: 'center',
                  padding: '7px 0',
                  borderBottom: `1px solid #E4E8E0`,
                }}>
                  <div>
                    <div style={{ fontSize: '13px' }}>{c}</div>
                    <div style={{
                      height: '5px',
                      borderRadius: '3px',
                      background: C.mid,
                      marginTop: '5px',
                      width: `${Math.max(4, (v / maxCat) * 100)}%`,
                      opacity: 0.55,
                    }} />
                  </div>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}>
                    {brl(v)}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{
            border: `1px solid ${C.rule}`,
            background: C.card,
            borderRadius: '14px',
            padding: '16px 18px',
          }}>
            <h2 style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontWeight: 700,
              fontSize: '16px',
              letterSpacing: '-0.01em',
              margin: '0 0 3px',
            }}>
              Fechamento de cada mês
            </h2>
            <p style={{
              fontSize: '12px',
              color: C.soft,
              margin: '0 0 14px',
            }}>
              Saldo no último dia.
            </p>
            {MESES.map((m, i) => {
              const x = calc.mesesInfo[i];
              const maxAno = Math.max(1, ...calc.mesesInfo.map((y) => Math.abs(y.fim)));
              return (
                <div
                  key={m}
                  onClick={() => setMes(i)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '10px',
                    alignItems: 'center',
                    padding: '7px 0',
                    borderBottom: `1px solid #E4E8E0`,
                    cursor: 'pointer',
                    opacity: i < mesInicial ? 0.5 : 1,
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: i === mes ? 600 : 400 }}>{m}</div>
                    <div style={{
                      height: '5px',
                      borderRadius: '3px',
                      background: x.fim < 0 ? C.rose : C.mid,
                      marginTop: '5px',
                      width: `${Math.max(3, (Math.abs(x.fim) / maxAno) * 100)}%`,
                    }} />
                  </div>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: x.fim < 0 ? C.rose : C.ink,
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

function TabelaItens({ itens, onNome, onDia, onValor, onDel }) {
  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 74px 120px 32px',
        gap: '8px',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '9.5px',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--soft)',
        paddingBottom: '6px',
        borderBottom: `1px solid rgba(18,33,28,.14)`,
        marginBottom: '8px',
      }}>
        <span>Nome</span>
        <span style={{ textAlign: 'right' }}>Dia</span>
        <span style={{ textAlign: 'right' }}>Valor</span>
        <span />
      </div>
      {itens.map((item) => (
        <div key={item.id} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 74px 120px 32px',
          gap: '8px',
          alignItems: 'center',
          padding: '7px 0',
          borderBottom: `1px solid rgba(18,33,28,.08)`,
        }}>
          <input
            type="text"
            value={item.nome}
            onChange={(e) => onNome(item.id, e.target.value)}
            placeholder="Nome"
            style={{
              border: 0,
              background: 'transparent',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13.5px',
              color: 'var(--ink)',
              padding: '6px 2px',
              borderRadius: '6px',
              width: '100%',
            }}
            onFocus={(e) => e.target.style.background = 'rgba(255,255,255,.6)'}
            onBlur={(e) => e.target.style.background = 'transparent'}
          />
          <select
            value={item.dia}
            onChange={(e) => onDia(item.id, e.target.value)}
            style={{
              border: `1px solid rgba(18,33,28,.16)`,
              background: '#fff',
              borderRadius: '8px',
              padding: '8px 4px',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '12px',
              color: 'var(--soft)',
              width: '100%',
            }}
          >
            {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={item.valor}
            onChange={(e) => onValor(item.id, e.target.value)}
            style={{
              border: `1px solid rgba(18,33,28,.16)`,
              background: '#fff',
              borderRadius: '8px',
              padding: '8px 9px',
              fontFamily: "'IBM Plex Mono', monospace",
              fontVariantNumeric: 'tabular-nums',
              fontSize: '13px',
              color: 'var(--ink)',
              textAlign: 'right',
              width: '100%',
            }}
          />
          <button
            onClick={() => onDel(item.id)}
            style={{
              border: `1px solid rgba(18,33,28,.16)`,
              background: 'transparent',
              borderRadius: '8px',
              height: '32px',
              cursor: 'pointer',
              color: 'var(--soft)',
              fontSize: '15px',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'var(--rosePale)';
              e.target.style.color = 'var(--rose)';
              e.target.style.borderColor = 'var(--rosePale)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.color = 'var(--soft)';
              e.target.style.borderColor = 'rgba(18,33,28,.16)';
            }}
          >
            ×
          </button>
        </div>
      ))}
    </>
  );
}
