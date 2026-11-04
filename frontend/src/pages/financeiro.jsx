import { LottieLight } from 'lottie-react';
import AppHeader from '../components/AppHeader';

export default function Financeiro() {
  return (
    <div className="wrap wide">
      <AppHeader />
      <header>
        <h1>Financeiro</h1>
      </header>
      <div className="em-breve">
        {/* LottieLight (não Lottie) — sem motor de expressões, que depende
            de eval() internamente; a engrenagem não usa expressão nenhuma,
            então a versão leve renderiza igual e sem esse risco/peso. */}
        {/* src="/engrenagem.json" — arquivo em public/, a própria lib busca */}
        <LottieLight src="/engrenagem.json" className="em-breve-icone" autoplay loop />
        <p>Essa ferramenta ainda está em construção. Em breve estará disponível.</p>
      </div>
    </div>
  );
}
