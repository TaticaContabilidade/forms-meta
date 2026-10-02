import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import client from '../api/client';
import {
  ARQUETIPO_MAP,
  BLOCOS_A,
  INTENSIDADE_C,
  TRAIT_LABELS,
  calcAdaptado,
  calcIntensidade,
  calcNatural,
  resolverPerfilDominante,
} from '../discData';

const TRAITS = ['D', 'I', 'S', 'C'];
const TRAIT_COLORS = { D: '#D64545', I: '#C98423', S: '#1E9A66', C: '#3E76D6' };

function fmtDecimal(v) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function fraseIntensidade(trait, valor) {
  const label = TRAIT_LABELS[trait];
  const fmt = fmtDecimal(valor);
  if (valor >= 4) return `Sua intensidade de ${label} é alta (${fmt} de 5) — esse traço aparece com força no seu dia a dia.`;
  if (valor <= 2) return `Sua intensidade de ${label} é baixa (${fmt} de 5) — esse traço aparece de forma mais moderada no seu comportamento.`;
  return `Sua intensidade de ${label} é moderada (${fmt} de 5).`;
}

export default function Disc() {
  const { usuario } = useAuth();
  const progressKey = `disc_progress_${usuario.id}`;
  const [carregado, setCarregado] = useState(false);

  const [tela, setTela] = useState('mais'); // 'mais' | 'menos' | 'intensidade' | 'resultado'
  const [respostasA, setRespostasA] = useState({});
  const [respostasC, setRespostasC] = useState({});
  const [pendentesMais, setPendentesMais] = useState(new Set());
  const [pendentesMenos, setPendentesMenos] = useState(new Set());
  const [mensagemMais, setMensagemMais] = useState(false);
  const [mensagemMenos, setMensagemMenos] = useState(false);
  const [mensagemIntensidade, setMensagemIntensidade] = useState(false);

  const [enviado, setEnviado] = useState(false);
  const [respostaId, setRespostaId] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [pdfBaixando, setPdfBaixando] = useState(false);
  const [status, setStatus] = useState({ texto: '', tipo: null });
  const [confirmandoReset, setConfirmandoReset] = useState(false);

  const blocoRefs = useRef({});

  // Progresso é longo (40 perguntas) -- ao contrário de Meu Porquê/
  // Calculadora, vale a pena persistir entre reloads. Chave com sufixo do
  // usuário pra não misturar progresso de 2 pessoas no mesmo navegador.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(progressKey);
      if (raw) {
        const salvo = JSON.parse(raw);
        if (salvo.respostasA) setRespostasA(salvo.respostasA);
        if (salvo.respostasC) setRespostasC(salvo.respostasC);
        if (salvo.tela && salvo.tela !== 'resultado') setTela(salvo.tela);
      }
    } catch {
      // localStorage indisponível -- segue sem progresso restaurado
    }
    setCarregado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!carregado) return;
    try {
      localStorage.setItem(progressKey, JSON.stringify({ tela, respostasA, respostasC }));
    } catch {
      // localStorage indisponível -- progresso só sobrevive nesta sessão
    }
  }, [progressKey, carregado, tela, respostasA, respostasC]);

  function avaliarBlocoMais(bIdx) {
    return respostasA[bIdx]?.mais !== undefined;
  }
  function avaliarBlocoMenos(bIdx) {
    const r = respostasA[bIdx];
    return !!r && r.menos !== undefined && r.menos !== r.mais;
  }

  function updateBlocoMais(bIdx, wIdx) {
    setRespostasA((ra) => {
      const atual = ra[bIdx] || {};
      const novoMenos = atual.menos === wIdx ? undefined : atual.menos;
      return { ...ra, [bIdx]: { mais: wIdx, menos: novoMenos } };
    });
    setPendentesMais((s) => new Set(s).add(bIdx));
  }

  function updateBlocoMenos(bIdx, wIdx) {
    setRespostasA((ra) => ({ ...ra, [bIdx]: { ...(ra[bIdx] || {}), menos: wIdx } }));
    setPendentesMenos((s) => new Set(s).add(bIdx));
  }

  function updateIntensidade(aIdx, valor) {
    setRespostasC((rc) => ({ ...rc, [aIdx]: valor }));
  }

  function scrollParaBloco(bIdx) {
    blocoRefs.current[bIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function handleContinuarMais() {
    const faltando = [];
    BLOCOS_A.forEach((_, i) => { if (!avaliarBlocoMais(i)) faltando.push(i); });
    if (faltando.length > 0) {
      setPendentesMais(new Set(faltando));
      setMensagemMais(true);
      scrollParaBloco(faltando[0]);
      return;
    }
    setMensagemMais(false);
    setTela('menos');
    window.scrollTo(0, 0);
  }

  function handleVoltarMais() {
    setTela('mais');
    window.scrollTo(0, 0);
  }

  function handleContinuarMenos() {
    const faltando = [];
    BLOCOS_A.forEach((_, i) => { if (!avaliarBlocoMenos(i)) faltando.push(i); });
    if (faltando.length > 0) {
      setPendentesMenos(new Set(faltando));
      setMensagemMenos(true);
      scrollParaBloco(faltando[0]);
      return;
    }
    setMensagemMenos(false);
    setTela('intensidade');
    window.scrollTo(0, 0);
  }

  function handleVoltarIntensidade() {
    setTela('menos');
    window.scrollTo(0, 0);
  }

  function handleVerResultado() {
    const completo = INTENSIDADE_C.every((_, i) => respostasC[i] !== undefined);
    if (!completo) {
      setMensagemIntensidade(true);
      return;
    }
    setMensagemIntensidade(false);
    setTela('resultado');
    window.scrollTo(0, 0);
  }

  const totalBlocos = BLOCOS_A.length;
  const ehMais = tela === 'mais';
  const respondidos = BLOCOS_A.reduce((acc, _, i) => acc + ((ehMais ? avaliarBlocoMais(i) : avaliarBlocoMenos(i)) ? 1 : 0), 0);

  const resultado = useMemo(() => {
    const natural = calcNatural(respostasA);
    const adaptado = calcAdaptado(respostasA);
    const intensidade = calcIntensidade(respostasC);
    const perfil = resolverPerfilDominante(natural);
    const infos = perfil.traits.map((t) => ARQUETIPO_MAP[t]);
    const spread = Math.max(...TRAITS.map((t) => intensidade[t])) - Math.min(...TRAITS.map((t) => intensidade[t]));
    return { natural, adaptado, intensidade, perfil, infos, spread };
  }, [respostasA, respostasC]);

  async function handleEnviar() {
    setEnviando(true);
    setStatus({ texto: '', tipo: null });
    try {
      const resp = await client.post('/api/disc/respostas/', { respostas: { a: respostasA, c: respostasC } });
      setRespostaId(resp.data.id);
      setEnviado(true);
      setStatus({ texto: 'Perfil enviado com sucesso.', tipo: 'ok' });
    } catch {
      setStatus({ texto: 'Não foi possível enviar agora. Tente de novo.', tipo: 'alert' });
    } finally {
      setEnviando(false);
    }
  }

  async function handleBaixarPdf() {
    if (!respostaId) return;
    setPdfBaixando(true);
    try {
      const resp = await client.get(`/api/disc/respostas/${respostaId}/pdf/`, { responseType: 'blob' });
      const disposition = resp.headers['content-disposition'] || '';
      const match = /filename\*=UTF-8''([^;]+)/.exec(disposition) || /filename="([^"]+)"/.exec(disposition);
      const filename = match ? decodeURIComponent(match[1]) : 'perfil disc.pdf';

      const url = URL.createObjectURL(resp.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setPdfBaixando(false);
    }
  }

  function confirmarRefazer() {
    setRespostasA({});
    setRespostasC({});
    setPendentesMais(new Set());
    setPendentesMenos(new Set());
    setMensagemMais(false);
    setMensagemMenos(false);
    setMensagemIntensidade(false);
    setEnviado(false);
    setRespostaId(null);
    setStatus({ texto: '', tipo: null });
    setConfirmandoReset(false);
    setTela('mais');
    try {
      localStorage.removeItem(progressKey);
    } catch {
      // nada a fazer -- sem localStorage não havia progresso salvo mesmo
    }
    window.scrollTo(0, 0);
  }

  function renderChoiceBlock(bIdx, bloco, grupo) {
    const maisIdx = respostasA[bIdx]?.mais;
    const valorAtual = grupo === 'mais' ? respostasA[bIdx]?.mais : respostasA[bIdx]?.menos;
    const respondido = grupo === 'mais' ? avaliarBlocoMais(bIdx) : avaliarBlocoMenos(bIdx);
    const pendente = (grupo === 'mais' ? pendentesMais : pendentesMenos).has(bIdx) && !respondido;

    return (
      <fieldset
        key={bIdx}
        ref={(el) => { blocoRefs.current[bIdx] = el; }}
        className={`choice-block${pendente ? ' pending' : ''}`}
      >
        <legend className="choice-block-header">
          <span className="block-num">Bloco {bIdx + 1}</span>
          <span className="block-instruction">
            {grupo === 'mais' ? 'Marque a frase mais parecida com você' : 'Marque a frase menos parecida, entre as que sobraram'}
          </span>
        </legend>
        <div className="choice-cards">
          {bloco.words.map((w, wIdx) => {
            const indisponivel = grupo === 'menos' && wIdx === maisIdx;
            return (
              <label key={wIdx} className={`choice-card${indisponivel ? ' indisponivel' : ''}`}>
                <input
                  type="radio"
                  name={`bloco-${bIdx}-${grupo}`}
                  checked={valorAtual === wIdx}
                  disabled={indisponivel}
                  onChange={() => (grupo === 'mais' ? updateBlocoMais(bIdx, wIdx) : updateBlocoMenos(bIdx, wIdx))}
                />
                <span className="choice-card-text">{w.text}</span>
                <span className="choice-card-tag">{indisponivel ? 'Já é sua Mais' : ''}</span>
              </label>
            );
          })}
        </div>
        <p className="pending-msg">
          {grupo === 'mais' ? 'Marque a palavra mais parecida antes de continuar.' : 'Marque a palavra menos parecida antes de continuar.'}
        </p>
      </fieldset>
    );
  }

  function renderBars(scores, ref) {
    return TRAITS.map((t) => {
      const valor = scores[t] || 0;
      const pct = ref > 0 ? (valor / ref) * 100 : 0;
      return (
        <div className="bar-row" key={t}>
          <span className="bar-label" style={{ color: TRAIT_COLORS[t] }}>{t} · {TRAIT_LABELS[t]}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%`, background: TRAIT_COLORS[t] }} /></div>
          <span className="bar-value">{Number.isInteger(valor) ? valor : fmtDecimal(valor)}</span>
        </div>
      );
    });
  }

  return (
    <div className="wrap wide">
      <nav>
        <Link to="/ferramentas">← Voltar às ferramentas</Link>
      </nav>

      <header className="hero">
        <p className="eyebrow">Treinamento comercial · Perfil comportamental</p>
        <h1>Avaliação DISC Profunda</h1>
        <p className="hero-sub">
          Perfil natural × adaptado, intensidade de cada traço e o arquétipo comportamental que explica como você
          performa de verdade.
        </p>
      </header>

      {(tela === 'mais' || tela === 'menos') && (
        <>
          <div className="progress-wrap">
            <div className="progress-label">{respondidos} de {totalBlocos} blocos respondidos ({ehMais ? 'Mais' : 'Menos'})</div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${(respondidos / totalBlocos) * 100}%` }} /></div>
          </div>

          <p className="hero-sub" style={{ margin: '0 0 20px' }}>
            Você vai passar pelos mesmos 28 blocos <strong>2 vezes</strong>. Na 1ª rodada, marque em cada bloco só a
            frase <strong>MAIS</strong> parecida com você. Quando terminar as 28, a 2ª rodada pede pra marcar, entre
            as que sobraram, a <strong>MENOS</strong> parecida. Responda como você é — não como gostaria de ser.
          </p>

          {BLOCOS_A.map((bloco, bIdx) => renderChoiceBlock(bIdx, bloco, ehMais ? 'mais' : 'menos'))}

          <div className="nav-actions footer-actions">
            {tela === 'menos' && (
              <button type="button" className="btn-secondary" onClick={handleVoltarMais}>← Voltar pro Mais</button>
            )}
            {(mensagemMais && tela === 'mais') || (mensagemMenos && tela === 'menos') ? (
              <span className="callout state-alert">Responda todos os blocos antes de continuar.</span>
            ) : null}
            <button type="button" className="btn-primary" onClick={tela === 'mais' ? handleContinuarMais : handleContinuarMenos}>
              {tela === 'mais' ? 'Continuar para a 2ª rodada (Menos) →' : 'Continuar para Parte B →'}
            </button>
          </div>
        </>
      )}

      {tela === 'intensidade' && (
        <>
          <p className="hero-sub" style={{ margin: '0 0 20px' }}>
            Para cada afirmação abaixo, dê uma nota de 1 (discordo totalmente) a 5 (concordo totalmente). Vá rápido —
            a primeira impressão é a mais precisa.
          </p>

          {INTENSIDADE_C.map((item, aIdx) => (
            <fieldset key={aIdx} className="intensity-item">
              <legend className="intensity-header">
                <span className={`intensity-tag tag-${item.trait.toLowerCase()}`}>{item.trait}</span>
                <span className="intensity-text">{item.text}</span>
              </legend>
              <div className="intensity-scale">
                {[1, 2, 3, 4, 5].map((v) => (
                  <label key={v}>
                    <input
                      type="radio"
                      name={`intensidade-${aIdx}`}
                      checked={respostasC[aIdx] === v}
                      onChange={() => updateIntensidade(aIdx, v)}
                    />
                    {v}
                  </label>
                ))}
              </div>
              <div className="scale-hint"><span>Discordo totalmente</span><span>Concordo totalmente</span></div>
            </fieldset>
          ))}

          <div className="nav-actions footer-actions">
            <button type="button" className="btn-secondary" onClick={handleVoltarIntensidade}>← Voltar</button>
            {mensagemIntensidade && <span className="callout state-alert">Avalie todas as afirmações antes de finalizar.</span>}
            <button type="button" className="btn-primary" onClick={handleVerResultado}>Ver meu resultado →</button>
          </div>
        </>
      )}

      {tela === 'resultado' && (() => {
        const { natural, adaptado, intensidade, perfil, infos, spread } = resultado;
        const heroDescricao = !perfil.empatado
          ? infos[0].descricao
          : `Empate técnico entre ${perfil.traits[0]} e ${perfil.traits[1]} — diferença de só ${perfil.gap} ponto${perfil.gap === 1 ? '' : 's'} no perfil natural. Considere as duas descrições abaixo, não apenas uma.`;

        return (
          <>
            <div className="result-hero hero">
              <p className="eyebrow">Seu perfil comportamental</p>
              <h2 style={{ margin: '0 0 8px' }}>{!perfil.empatado ? infos[0].nome : infos.map((i) => i.nome).join(' + ')}</h2>
              <p className="hero-sub">{heroDescricao}</p>
            </div>

            <div className="profiles-grid">
              <div className="profile-card">
                <p className="profile-card-title">Perfil natural</p>
                <p className="profile-card-sub">O que exige menos esforço de você — seu estilo em repouso, sem pressão do ambiente.</p>
                {renderBars(natural, 28)}
              </div>
              <div className="profile-card">
                <p className="profile-card-title">Perfil adaptado</p>
                <p className="profile-card-sub">O que você mostra mais quando o ambiente pede um comportamento diferente do natural.</p>
                {renderBars(adaptado, 28)}
              </div>
            </div>

            <div className="profile-card" style={{ marginBottom: 24 }}>
              <p className="profile-card-title">Intensidade por traço</p>
              <p className="profile-card-sub">Força de cada traço, numa escala de 1 a 5.</p>
              {renderBars(intensidade, 5)}
              {spread < 1 && (
                <p className="callout state-alert" style={{ marginTop: 12 }}>
                  Suas quatro intensidades ficaram bem parecidas (diferença de só {fmtDecimal(spread)} ponto entre a
                  maior e a menor). Isso pode ser porque os quatro traços realmente pesam parecido em você, ou porque
                  as respostas da Parte B foram pouco diferenciadas.
                </p>
              )}
            </div>

            <h2>Os quatro perfis DISC</h2>
            <div className="disc-cards">
              {TRAITS.map((t) => {
                const own = perfil.traits.includes(t);
                return (
                  <div key={t} className="disc-card" style={{ borderColor: own ? TRAIT_COLORS[t] : 'var(--border-solid)' }}>
                    {own && <span className="disc-card-tag" style={{ background: TRAIT_COLORS[t] }}>SEU PERFIL</span>}
                    <p className="disc-card-trait" style={{ color: TRAIT_COLORS[t] }}>{t}</p>
                    <p className="disc-card-nome">{ARQUETIPO_MAP[t].nome}</p>
                    <p className="disc-card-resumo">{ARQUETIPO_MAP[t].resumo}</p>
                  </div>
                );
              })}
            </div>

            <h2>Como você performa</h2>
            {perfil.traits.map((t, i) => (
              <p key={t} className="callout state-ok">
                {fraseIntensidade(t, intensidade[t])} {infos[i].performa}
              </p>
            ))}

            <h2>O que pode derrubar sua performance</h2>
            {infos.map((info) => (
              <p key={info.nome} className="callout state-alert">{info.derail}</p>
            ))}

            <div className="footer-actions">
              <button type="button" className="btn-primary" disabled={enviado || enviando} onClick={handleEnviar}>
                {enviando ? 'Enviando…' : enviado ? 'Enviado' : 'Enviar meu perfil'}
              </button>
              <button type="button" className="btn-secondary" disabled={!enviado || pdfBaixando} onClick={handleBaixarPdf}>
                {pdfBaixando ? 'Gerando PDF…' : 'Salvar PDF'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setConfirmandoReset(true)}>Refazer avaliação</button>
            </div>
            {!enviado && <p className="footer-note">Envie seu perfil primeiro para liberar o PDF.</p>}
            {status.texto && (
              <p className={`callout ${status.tipo === 'ok' ? 'state-ok' : 'state-alert'}`} role="status">{status.texto}</p>
            )}

            {confirmandoReset && (
              <div className="confirm-box" role="alertdialog" aria-label="Confirmar reinício">
                <p style={{ margin: '0 0 10px' }}>Isso apaga todas as suas respostas. Continuar?</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn-secondary" onClick={confirmarRefazer}>Sim, refazer</button>
                  <button type="button" className="btn-secondary" onClick={() => setConfirmandoReset(false)}>Cancelar</button>
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
