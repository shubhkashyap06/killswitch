# decision.py

from cold_stops import check_cold_stops
from fusion import fuse
import nodes.node1_microdrain as node1
import nodes.node2_wallet as node2
import nodes.node3_velocity as node3
import nodes.node4_exploit as node4
import concurrent.futures

DELAY_MAP = {
    "PROCEED":      0,
    "DELAY_SHORT":  60,
    "DELAY_LONG":   600,
    "BLOCK":        None
}

def analyze_withdrawal(transaction_data):
    
    # STEP 1: Cold stops first
    cold_stop_result = check_cold_stops(transaction_data)
    
    if cold_stop_result["cold_stop_triggered"]:
        return {
            "decision": "BLOCK",
            "delay_seconds": None,
            "risk_score": 1.0,
            "method": "cold_stop",
            "reasons": cold_stop_result["reasons"],
            "node_reports": None,
            "fusion_result": None
        }
    
    # STEP 2: Run all 4 nodes in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(node1.analyze, transaction_data): "node1",
            executor.submit(node2.analyze, transaction_data): "node2",
            executor.submit(node3.analyze, transaction_data): "node3",
            executor.submit(node4.analyze, transaction_data): "node4"
        }
        
        node_reports = []
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            node_reports.append(result)
    
    # STEP 3: Weighted fusion
    fusion_result = fuse(node_reports)
    
    # STEP 4: Final decision
    final_decision = fusion_result["fusion_decision"]
    delay_seconds = DELAY_MAP.get(final_decision, 0)
    
    return {
        "decision": final_decision,
        "delay_seconds": delay_seconds,
        "risk_score": fusion_result["aggregate_risk"],
        "method": "ai_fusion",
        "critical_override": fusion_result["critical_override"],
        "node_reports": node_reports,
        "fusion_result": fusion_result,
        "reasons": fusion_result.get("node_reasons", {})
    }