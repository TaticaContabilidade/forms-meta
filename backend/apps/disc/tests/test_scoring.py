from apps.disc.scoring import (
    BLOCOS_A,
    calc_adaptado,
    calc_intensidade,
    calc_natural,
    resolver_perfil_dominante,
)


class TestCalcNaturalAdaptado:
    def test_bloco_so_conta_se_mais_e_menos_definidos_e_diferentes(self):
        # bloco 0: words = [D, I, S, C]
        respostas_a = {'0': {'mais': 0, 'menos': 1}}
        assert calc_natural(respostas_a) == {'D': 0, 'I': 1, 'S': 0, 'C': 0}
        assert calc_adaptado(respostas_a) == {'D': 1, 'I': 0, 'S': 0, 'C': 0}

    def test_ignora_bloco_com_mais_igual_menos(self):
        respostas_a = {'0': {'mais': 2, 'menos': 2}}
        assert calc_natural(respostas_a) == {'D': 0, 'I': 0, 'S': 0, 'C': 0}
        assert calc_adaptado(respostas_a) == {'D': 0, 'I': 0, 'S': 0, 'C': 0}

    def test_ignora_bloco_incompleto(self):
        respostas_a = {'0': {'mais': 1}, '1': {'menos': 2}}
        assert calc_natural(respostas_a) == {'D': 0, 'I': 0, 'S': 0, 'C': 0}
        assert calc_adaptado(respostas_a) == {'D': 0, 'I': 0, 'S': 0, 'C': 0}

    def test_ignora_indice_fora_de_alcance(self):
        respostas_a = {'0': {'mais': 9, 'menos': 1}}
        assert calc_adaptado(respostas_a) == {'D': 0, 'I': 0, 'S': 0, 'C': 0}
        assert calc_natural(respostas_a) == {'D': 0, 'I': 1, 'S': 0, 'C': 0}

    def test_aceita_indice_como_string_numerica(self):
        respostas_a = {'0': {'mais': '0', 'menos': '3'}}
        assert calc_natural(respostas_a) == {'D': 0, 'I': 0, 'S': 0, 'C': 1}
        assert calc_adaptado(respostas_a) == {'D': 1, 'I': 0, 'S': 0, 'C': 0}

    def test_percorre_todos_os_28_blocos_mesmo_traco(self):
        # todo bloco: mais=0 (D), menos=1 (I) -- mesma ordem D,I,S,C em todos
        respostas_a = {str(i): {'mais': 0, 'menos': 1} for i in range(len(BLOCOS_A))}
        assert calc_natural(respostas_a) == {'D': 0, 'I': 28, 'S': 0, 'C': 0}
        assert calc_adaptado(respostas_a) == {'D': 28, 'I': 0, 'S': 0, 'C': 0}

    def test_dict_vazio_ou_none_nao_quebra(self):
        assert calc_natural({}) == {'D': 0, 'I': 0, 'S': 0, 'C': 0}
        assert calc_natural(None) == {'D': 0, 'I': 0, 'S': 0, 'C': 0}
        assert calc_adaptado(None) == {'D': 0, 'I': 0, 'S': 0, 'C': 0}


class TestCalcIntensidade:
    def test_media_por_traco_arredondada_2_casas(self):
        respostas_c = {'0': 5, '1': 4, '2': 4}  # os 3 primeiros sao D
        resultado = calc_intensidade(respostas_c)
        assert resultado['D'] == 4.33
        assert resultado['I'] == 0
        assert resultado['S'] == 0
        assert resultado['C'] == 0

    def test_traco_sem_resposta_valida_fica_zero(self):
        assert calc_intensidade({}) == {'D': 0, 'I': 0, 'S': 0, 'C': 0}

    def test_ignora_valor_nao_numerico(self):
        respostas_c = {'0': 'abc', '1': 5}
        resultado = calc_intensidade(respostas_c)
        assert resultado['D'] == 5


class TestResolverPerfilDominante:
    def test_gap_maior_ou_igual_ao_limiar_da_traco_unico(self):
        perfil = resolver_perfil_dominante({'D': 10, 'I': 5, 'S': 0, 'C': 0})
        assert perfil['traits'] == ['D']
        assert perfil['empatado'] is False
        assert perfil['gap'] == 5

    def test_gap_menor_que_limiar_da_perfil_combinado(self):
        perfil = resolver_perfil_dominante({'D': 10, 'I': 9, 'S': 0, 'C': 0})
        assert perfil['traits'] == ['D', 'I']
        assert perfil['empatado'] is True
        assert perfil['gap'] == 1

    def test_empate_exato_tambem_e_combinado(self):
        perfil = resolver_perfil_dominante({'D': 5, 'I': 5, 'S': 0, 'C': 0})
        assert perfil['traits'] == ['D', 'I']
        assert perfil['gap'] == 0

    def test_todos_zerados_e_deterministico(self):
        perfil = resolver_perfil_dominante({'D': 0, 'I': 0, 'S': 0, 'C': 0})
        assert perfil['traits'] == ['D', 'I']
