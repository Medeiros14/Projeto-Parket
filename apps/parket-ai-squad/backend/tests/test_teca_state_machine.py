"""Testes puros da máquina de estados da Teca V2 (sem Redis/Supabase/LLM).

Roda com pytest OU standalone: PYTHONPATH=. python3 tests/test_teca_state_machine.py
"""
import importlib
import sys
import types
from pathlib import Path

# Importa state_machine sem passar pelo __init__ do pacote (que puxa
# structlog/httpx, indisponíveis fora do container).
_dir = Path(__file__).resolve().parents[1] / "app" / "core" / "teca_v2"
_pkg = types.ModuleType("_teca_sm")
_pkg.__path__ = [str(_dir)]
sys.modules.setdefault("_teca_sm", _pkg)
_sm = importlib.import_module("_teca_sm.state_machine")

ETAPAS = _sm.ETAPAS
TRANSITIONS = _sm.TRANSITIONS
descrever_funil_para_prompt = _sm.descrever_funil_para_prompt
transicao_implicita = _sm.transicao_implicita
validar_transicao = _sm.validar_transicao

PHONE_SP = "5511939213329"
PHONE_GO = "5562999990000"

CTX_VAZIO = {"phone": PHONE_SP, "state": {}, "details": {}, "tool_results": []}


def ctx(phone=PHONE_SP, state=None, details=None, tool_results=None):
    return {"phone": phone, "state": state or {}, "details": details or {},
            "tool_results": tool_results or []}


def test_matriz_transitions_consistente():
    assert set(TRANSITIONS) == ETAPAS
    for de, paras in TRANSITIONS.items():
        assert paras <= ETAPAS, f"{de} aponta pra etapa inexistente: {paras - ETAPAS}"
    assert TRANSITIONS["escalado_humano"] == set()


def test_mesma_etapa_e_noop_valido():
    r = validar_transicao("inicio", "inicio", CTX_VAZIO)
    assert r["ok"] is True and r["motivo"] == "sem_mudanca"


def test_etapa_desconhecida_rejeitada():
    r = validar_transicao("inicio", "fechando_venda", CTX_VAZIO)
    assert r["ok"] is False and r["motivo"] == "etapa_desconhecida"


def test_etapa_atual_corrompida_vira_inicio():
    r = validar_transicao("etapa_zumbi", "descobrindo_cidade", CTX_VAZIO)
    assert r["ok"] is True


def test_pulo_ilegal_inicio_para_escolhendo_horario():
    r = validar_transicao("inicio", "escolhendo_horario",
                          ctx(state={"cidade": "São Paulo", "area_m2": 100}))
    assert r["ok"] is False and r["motivo"] == "transicao_invalida"
    assert "descobrindo_cidade" in r["mensagem_pro_cortex"]


def test_escalado_humano_nunca_via_marcar_etapa():
    for atual in ("inicio", "escolhendo_horario", "duvida_produto"):
        r = validar_transicao(atual, "escalado_humano", CTX_VAZIO)
        assert r["ok"] is False and r["motivo"] == "use_pausar_teca"


def test_escalado_humano_e_terminal():
    for nova in ETAPAS - {"escalado_humano"}:
        r = validar_transicao("escalado_humano", nova, ctx(state={"cidade": "SP", "area_m2": 90}))
        assert r["ok"] is False, f"escalado_humano → {nova} deveria ser rejeitada"


def test_agendado_sem_tool_rejeitado():
    r = validar_transicao("escolhendo_horario", "agendado",
                          ctx(state={"cidade": "São Paulo", "area_m2": 120}))
    assert r["ok"] is False and r["motivo"] == "agendamento_nao_criado"


def test_agendado_com_criar_agendamento_ok():
    tr = [{"name": "criar_agendamento", "result": {"id": "abc-123"}}]
    r = validar_transicao("escolhendo_horario", "agendado",
                          ctx(state={"cidade": "São Paulo", "area_m2": 120}, tool_results=tr))
    assert r["ok"] is True


def test_agendado_com_criar_agendamento_skip_rejeitado():
    tr = [{"name": "criar_agendamento",
           "result": {"ok": False, "skip_motivo": "metragem_baixa"}}]
    r = validar_transicao("escolhendo_horario", "agendado",
                          ctx(state={"cidade": "São Paulo", "area_m2": 120}, tool_results=tr))
    assert r["ok"] is False and r["motivo"] == "agendamento_nao_criado"


def test_gate_cidade_faltando():
    r = validar_transicao("descobrindo_cidade", "oferecendo_meet", CTX_VAZIO)
    assert r["ok"] is False and r["motivo"] == "dados_faltantes"
    assert r["dados_faltantes"] == ["cidade"]


def test_gate_showroom_sp_por_ddd():
    r = validar_transicao("descobrindo_cidade", "oferecendo_showroom",
                          ctx(phone=PHONE_SP, state={"cidade": "Campinas"}))
    assert r["ok"] is True


def test_gate_showroom_fora_sp_rejeitado():
    r = validar_transicao("descobrindo_cidade", "oferecendo_showroom",
                          ctx(phone=PHONE_GO, state={"cidade": "Goiânia", "estado": "GO"}))
    assert r["ok"] is False and r["motivo"] == "regiao_fora_sp"
    assert "oferecendo_meet" in r["mensagem_pro_cortex"]


def test_gate_showroom_ddd_sp_mas_estado_explicito_fora():
    # Lead com chip de SP morando em Goiás: localização explícita vence o DDD
    r = validar_transicao("descobrindo_cidade", "oferecendo_showroom",
                          ctx(phone=PHONE_SP, state={"cidade": "Goiânia", "estado": "GO"}))
    assert r["ok"] is False and r["motivo"] == "regiao_fora_sp"


def test_gate_meet_fora_sp_ok():
    r = validar_transicao("descobrindo_cidade", "oferecendo_meet",
                          ctx(phone=PHONE_GO, state={"cidade": "Goiânia"}))
    assert r["ok"] is True


def test_gate_horario_metragem_faltando():
    r = validar_transicao("oferecendo_showroom", "escolhendo_horario",
                          ctx(state={"cidade": "São Paulo"}))
    assert r["ok"] is False and r["dados_faltantes"] == ["area_m2"]


def test_gate_horario_metragem_49_rejeitada():
    r = validar_transicao("oferecendo_showroom", "escolhendo_horario",
                          ctx(state={"cidade": "São Paulo", "area_m2": 49}))
    assert r["ok"] is False and r["motivo"] == "metragem_baixa"


def test_gate_horario_metragem_50_ok():
    r = validar_transicao("oferecendo_showroom", "escolhendo_horario",
                          ctx(state={"cidade": "São Paulo", "area_m2": 50}))
    assert r["ok"] is True


def test_gate_horario_metragem_string_com_unidade():
    r = validar_transicao("oferecendo_meet", "escolhendo_horario",
                          ctx(phone=PHONE_GO, state={"cidade": "Goiânia", "area_m2": "120 m²"}))
    assert r["ok"] is True


def test_gate_horario_metragem_do_details():
    r = validar_transicao("oferecendo_showroom", "escolhendo_horario",
                          ctx(state={"cidade": "São Paulo"},
                              details={"metragem_estimada": "80"}))
    assert r["ok"] is True


def test_remarcacao_agendado_volta_escolhendo_horario():
    r = validar_transicao("agendado", "escolhendo_horario",
                          ctx(state={"cidade": "São Paulo", "area_m2": 100}))
    assert r["ok"] is True


def test_desinteressado_reentra_no_funil():
    r = validar_transicao("desinteressado_acompanhar", "descobrindo_cidade", CTX_VAZIO)
    assert r["ok"] is True


def test_duvida_produto_lateral():
    assert validar_transicao("escolhendo_horario", "duvida_produto", CTX_VAZIO)["ok"] is True
    r = validar_transicao("duvida_produto", "escolhendo_horario",
                          ctx(state={"cidade": "São Paulo", "area_m2": 75}))
    assert r["ok"] is True


def test_implicita_criar_agendamento():
    assert transicao_implicita("criar_agendamento", {"id": "x"}) == "agendado"
    assert transicao_implicita("atualizar_agendamento", {"ok": True}) == "agendado"
    assert transicao_implicita("criar_agendamento",
                               {"ok": False, "skip_motivo": "metragem_baixa"}) is None
    assert transicao_implicita("criar_agendamento", None) is None


def test_implicita_pausar():
    assert transicao_implicita("pausar_teca_sinalizar_sdr", {"paused": True}) == "escalado_humano"
    assert transicao_implicita("pausar_teca_sinalizar_sdr", {"error": "x"}) is None


def test_implicita_outras_tools():
    assert transicao_implicita("marcar_etapa", {"etapa": "agendado"}) is None
    assert transicao_implicita("atualizar_dados_lead", {"updated": True}) is None


def test_descrever_funil_cobre_etapas_e_gates():
    txt = descrever_funil_para_prompt()
    for etapa in ETAPAS:
        assert etapa in txt, f"{etapa} ausente do bloco de funil"
    assert "50m²" in txt and "ok=false" in txt


if __name__ == "__main__":
    fns = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    falhas = 0
    for name, fn in fns:
        try:
            fn()
            print(f"PASS {name}")
        except AssertionError as e:
            falhas += 1
            print(f"FAIL {name}: {e}")
    print(f"\n{len(fns) - falhas}/{len(fns)} passaram")
    sys.exit(1 if falhas else 0)
