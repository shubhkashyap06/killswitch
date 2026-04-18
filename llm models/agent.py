# agent.py

import os
import json
import pathlib
from typing import TypedDict, List, Optional
from dotenv import load_dotenv

load_dotenv(pathlib.Path(__file__).parent / '.env')

from langgraph.graph import StateGraph, END
import concurrent.futures

from cold_stops import check_cold_stops
from fusion import fuse
import nodes.node1_microdrain as node1
import nodes.node2_wallet as node2
import nodes.node3_velocity as node3
import nodes.node4_exploit as node4


class KillswitchState(TypedDict):
    transaction_data: dict
    cold_stop_triggered: bool
    cold_stop_reasons: List[str]
    node_reports: List[dict]
    aggregate_risk: float
    fusion_decision: str
    fusion_reason: str
    needs_reeval: bool
    reeval_count: int
    final_decision: str
    final_risk: float
    final_reasons: dict
    method: str
    delay_seconds: Optional[int]


def cold_stop_node(state: KillswitchState) -> KillswitchState:
    print("[Agent] Running cold stop checks...")
    result = check_cold_stops(state["transaction_data"])
    return {
        **state,
        "cold_stop_triggered": result["cold_stop_triggered"],
        "cold_stop_reasons": result.get("reasons", [])
    }


def specialist_nodes(state: KillswitchState) -> KillswitchState:
    print("[Agent] Running 4 specialist nodes in parallel...")
    transaction_data = state["transaction_data"]

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(node1.analyze, transaction_data): "node1",
            executor.submit(node2.analyze, transaction_data): "node2",
            executor.submit(node3.analyze, transaction_data): "node3",
            executor.submit(node4.analyze, transaction_data): "node4"
        }
        reports = []
        for future in concurrent.futures.as_completed(futures):
            reports.append(future.result())

    for r in reports:
        print(f"  [{r['node_id']}] risk={r.get('risk_score')} "
              f"severity={r.get('severity')} abstain={r.get('abstain')}")

    return {**state, "node_reports": reports}


def fusion_node(state: KillswitchState) -> KillswitchState:
    print("[Agent] Running weighted fusion...")
    result = fuse(state["node_reports"])
    print(f"  Aggregate risk: {result['aggregate_risk']}")
    print(f"  Fusion decision: {result['fusion_decision']}")
    return {
        **state,
        "aggregate_risk": result["aggregate_risk"],
        "fusion_decision": result["fusion_decision"],
        "fusion_reason": result.get("reason", "weighted_fusion"),
        "needs_reeval": False
    }


def borderline_check_node(state: KillswitchState) -> KillswitchState:
    risk = state["aggregate_risk"]
    reeval_count = state.get("reeval_count", 0)
    is_borderline = 0.25 <= risk <= 0.55
    should_reeval = is_borderline and reeval_count < 1

    if should_reeval:
        print(f"[Agent] Borderline risk {risk:.3f} detected. Flagging for re-evaluation.")
    else:
        print(f"[Agent] Risk {risk:.3f} is decisive. No re-evaluation needed.")

    return {**state, "needs_reeval": should_reeval}


def reeval_node(state: KillswitchState) -> KillswitchState:
    print("[Agent] Running re-evaluation pass...")
    transaction_data = state["transaction_data"]
    previous_reports = state["node_reports"]
    current_risk = state["aggregate_risk"]

    previous_context = {
        "previous_aggregate_risk": current_risk,
        "previous_node_signals": {
            r["node_id"]: {
                "risk": r.get("risk_score"),
                "reason": r.get("reason")
            }
            for r in previous_reports if not r.get("abstain")
        },
        "reeval_instruction": (
            f"This is a second-pass analysis. The previous round produced a borderline "
            f"aggregate risk of {current_risk:.2f}. Please reconsider your assessment "
            f"carefully. Be more precise and decisive."
        )
    }

    enriched_data = {**transaction_data, "reeval_context": previous_context}

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(node1.analyze, enriched_data): "node1",
            executor.submit(node2.analyze, enriched_data): "node2",
            executor.submit(node3.analyze, enriched_data): "node3",
            executor.submit(node4.analyze, enriched_data): "node4"
        }
        new_reports = []
        for future in concurrent.futures.as_completed(futures):
            new_reports.append(future.result())

    print("  Re-evaluation results:")
    for r in new_reports:
        print(f"  [{r['node_id']}] risk={r.get('risk_score')} "
              f"severity={r.get('severity')}")

    new_fusion = fuse(new_reports)
    print(f"  New aggregate risk: {new_fusion['aggregate_risk']}")
    print(f"  New decision: {new_fusion['fusion_decision']}")

    return {
        **state,
        "node_reports": new_reports,
        "aggregate_risk": new_fusion["aggregate_risk"],
        "fusion_decision": new_fusion["fusion_decision"],
        "reeval_count": state.get("reeval_count", 0) + 1,
        "needs_reeval": False
    }


def final_decision_node(state: KillswitchState) -> KillswitchState:
    DELAY_MAP = {
        "PROCEED":     0,
        "DELAY_SHORT": 60,
        "DELAY_LONG":  600,
        "BLOCK":       None
    }

    if state.get("cold_stop_triggered"):
        return {
            **state,
            "final_decision": "BLOCK",
            "final_risk": 1.0,
            "final_reasons": {"cold_stop": state["cold_stop_reasons"]},
            "method": "cold_stop",
            "delay_seconds": None
        }

    decision = state["fusion_decision"]
    return {
        **state,
        "final_decision": decision,
        "final_risk": state["aggregate_risk"],
        "final_reasons": {
            r["node_id"]: r.get("reason", "")
            for r in state.get("node_reports", [])
            if not r.get("abstain")
        },
        "method": "langgraph_ai_fusion",
        "delay_seconds": DELAY_MAP.get(decision, 0)
    }


def route_after_cold_stop(state: KillswitchState) -> str:
    if state["cold_stop_triggered"]:
        print("[Agent] Cold stop triggered. Skipping AI.")
        return "final_decision"
    return "specialist_nodes"


def route_after_borderline_check(state: KillswitchState) -> str:
    if state["needs_reeval"]:
        return "reeval"
    return "final_decision"


def build_agent():
    graph = StateGraph(KillswitchState)

    graph.add_node("cold_stop", cold_stop_node)
    graph.add_node("specialist_nodes", specialist_nodes)
    graph.add_node("fusion", fusion_node)
    graph.add_node("borderline_check", borderline_check_node)
    graph.add_node("reeval", reeval_node)
    graph.add_node("final_decision", final_decision_node)

    graph.set_entry_point("cold_stop")

    graph.add_conditional_edges(
        "cold_stop",
        route_after_cold_stop,
        {
            "final_decision": "final_decision",
            "specialist_nodes": "specialist_nodes"
        }
    )

    graph.add_edge("specialist_nodes", "fusion")
    graph.add_edge("fusion", "borderline_check")

    graph.add_conditional_edges(
        "borderline_check",
        route_after_borderline_check,
        {
            "reeval": "reeval",
            "final_decision": "final_decision"
        }
    )

    graph.add_edge("reeval", "fusion")
    graph.add_edge("final_decision", END)

    return graph.compile()


killswitch_agent = build_agent()


def analyze_with_agent(transaction_data: dict) -> dict:
    initial_state = {
        "transaction_data": transaction_data,
        "cold_stop_triggered": False,
        "cold_stop_reasons": [],
        "node_reports": [],
        "aggregate_risk": 0.0,
        "fusion_decision": "MONITOR",
        "fusion_reason": "",
        "needs_reeval": False,
        "reeval_count": 0,
        "final_decision": "",
        "final_risk": 0.0,
        "final_reasons": {},
        "method": "",
        "delay_seconds": 0
    }

    result = killswitch_agent.invoke(initial_state)

    return {
        "decision": result["final_decision"],
        "delay_seconds": result["delay_seconds"],
        "risk_score": result["final_risk"],
        "method": result["method"],
        "reasons": result["final_reasons"],
        "node_reports": result.get("node_reports"),
        "reeval_performed": result.get("reeval_count", 0) > 0
    }