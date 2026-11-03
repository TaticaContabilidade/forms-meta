import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../auth/AuthContext';
import client from '../api/client';

const FERRAMENTAS = [
  {
    chave: 'metas',
    rota: 'metas',
    titulo: 'Calculadora de metas',
    resumo: (r) => `Meta mensal: ${formatarMoeda(r.meta_mensal)}`,
  },
  {
    chave: 'disc',
    rota: 'disc',
    titulo: 'Avaliação DISC',
    resumo: (r) => r.arquetipo,
  },
  // Meu Porquê é legado — não existe mais pra quem usa a plataforma, não
  // aparece em nenhuma UI nova (rota /meu-porque continua respondendo,
  // só não é linkada/listada em lugar nenhum).
];

function formatarMoeda(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ListaResultados({ titulo, itens, mostrarNome, rota, baixando, onBaixar, vazio }) {
  return (
    <div>
      <h3>{titulo}</h3>
      {itens.length === 0 ? (
        <p className="footer-note">{vazio}</p>
      ) : (
        <ul className="item-list">
          {itens.map((r) => {
            const chave = `${rota}-${r.id}`;
            return (
              <li key={r.id}>
                <span>
                  {mostrarNome && <strong>{r.nome_participante}</strong>}
                  {mostrarNome && ' · '}
                  {r.criado_em}
                  {r.resumo ? ` · ${r.resumo}` : ''}
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={baixando === chave}
                  onClick={() => onBaixar(rota, r.id)}
                >
                  {baixando === chave ? 'Gerando PDF…' : 'Baixar PDF'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Perfil() {
  const { usuario } = useAuth();
  const ehGerente = usuario.papel === 'GERENTE';

  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [baixando, setBaixando] = useState(null);

  useEffect(() => {
    let cancelado = false;
    Promise.all(FERRAMENTAS.map((f) => client.get(`/api/${f.rota}/respostas/`)))
      .then((resps) => {
        if (cancelado) return;
        const novo = {};
        FERRAMENTAS.forEach((f, i) => {
          novo[f.chave] = resps[i].data;
        });
        setDados(novo);
      })
      .catch(() => {
        if (!cancelado) setErro('Não foi possível carregar seus resultados agora.');
      });
    return () => {
      cancelado = true;
    };
  }, []);

  function itensDe(ferramenta, equipe) {
    const lista = dados?.[ferramenta.chave] || [];
    const filtrada = ehGerente ? lista.filter((r) => (r.usuario_id !== usuario.id) === equipe) : lista;
    return filtrada.map((r) => ({ ...r, resumo: ferramenta.resumo(r) }));
  }

  async function baixarPdf(rota, id) {
    const chave = `${rota}-${id}`;
    setBaixando(chave);
    setErro('');
    try {
      const resp = await client.get(`/api/${rota}/respostas/${id}/pdf/`, { responseType: 'blob' });
      const disposition = resp.headers['content-disposition'] || '';
      const match = /filename\*=UTF-8''([^;]+)/.exec(disposition) || /filename="([^"]+)"/.exec(disposition);
      const filename = match ? decodeURIComponent(match[1]) : 'resultado.pdf';

      const url = URL.createObjectURL(resp.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErro('Não foi possível gerar o PDF agora. Tente de novo.');
    } finally {
      setBaixando(null);
    }
  }

  return (
    <div className="wrap wide">
      <AppHeader />

      <header className="hero">
        <p className="eyebrow">Perfil</p>
        <h1>{usuario.nome}</h1>
        <p className="hero-sub">
          {usuario.empresa.nome} · {usuario.setor.nome} · {ehGerente ? 'Gerente' : 'Colaborador'}
        </p>
      </header>

      {erro && (
        <p className="callout state-alert" role="alert">
          {erro}
        </p>
      )}

      {!dados ? (
        <p className="footer-note">Carregando seus resultados…</p>
      ) : (
        <>
          <section>
            <h2>Meus resultados</h2>
            {FERRAMENTAS.map((f) => (
              <ListaResultados
                key={f.chave}
                titulo={f.titulo}
                itens={itensDe(f, false)}
                mostrarNome={false}
                rota={f.rota}
                baixando={baixando}
                onBaixar={baixarPdf}
                vazio="Você ainda não tem resultado aqui."
              />
            ))}
          </section>

          {ehGerente && (
            <section>
              <h2>Resultados da equipe · {usuario.setor.nome}</h2>
              {FERRAMENTAS.map((f) => (
                <ListaResultados
                  key={f.chave}
                  titulo={f.titulo}
                  itens={itensDe(f, true)}
                  mostrarNome
                  rota={f.rota}
                  baixando={baixando}
                  onBaixar={baixarPdf}
                  vazio="Ninguém do seu setor preencheu ainda."
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
