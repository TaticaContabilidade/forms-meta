import AppHeader from '../components/AppHeader';
import ToolCard from '../components/ToolCard';

const FERRAMENTAS = [
  {
    variante: 'meta',
    icone: '📊',
    rotulo: 'Dinâmica 1',
    titulo: 'Calculadora de metas',
    descricao:
      'Transforme o faturamento desejado em meta da área, número de contratos e volume de contatos necessários por mês.',
    href: '/calculadora-meta',
  },
  {
    variante: 'disc',
    icone: '🧠',
    rotulo: 'Dinâmica 2',
    titulo: 'Avaliação DISC',
    descricao: '40 questões em 2 partes que revelam seu perfil natural, adaptado e a intensidade de cada traço.',
    href: '/disc',
  },
];

export default function Gestao() {
  return (
    <div className="wrap wide">
      <AppHeader />
      <header>
        <h1>Análise voltadas a gestão pessoal</h1>
      </header>
      <div className="tools-grid">
        {FERRAMENTAS.map((f) => (
          <ToolCard key={f.variante} ferramenta={f} />
        ))}
      </div>
    </div>
  );
}