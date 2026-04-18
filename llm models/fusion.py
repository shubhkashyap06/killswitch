# fusion.py

def fuse(node_reports):
    """
    Weighted Specialist Fusion Engine
    Stable hackathon version with deterministic exploit guard.
    """

    DOMAIN_WEIGHTS = {
        "node1_microdrain": 0.30,
        "node2_wallet":     0.25,
        "node3_velocity":   0.25,
        "node4_exploit":    0.20
    }

    SEVERITY_MULTIPLIERS = {
        "LOW": 0.5,
        "MEDIUM": 1.0,
        "MODERATE": 1.0,  # LLM sometimes returns MODERATE
        "HIGH": 1.3,
        "CRITICAL": 1.6
    }

    active = [
        r for r in node_reports
        if not r.get("abstain", True) and not r.get("error", False)
    ]

    abstained = [
        r for r in node_reports
        if r.get("abstain", True) or r.get("error", False)
    ]

    print("\n--- FUSION ENGINE ---")
    print(f"Active nodes: {len(active)}")
    print(f"Abstained nodes: {len(abstained)}")

    if len(active) == 0:
        return {
            "aggregate_risk": 0.50,
            "fusion_decision": "DELAY_SHORT",
            "critical_override": False,
            "high_override": False,
            "threat_count": 0,
            "node_reasons": {},
            "node_scores": {},
            "node_weights": {}
        }

    threat_count = len([r for r in active if r.get("threat_detected")])

    # ===============================
    # ✅ CRITICAL OVERRIDE
    # ===============================
    critical_nodes = [
        r for r in active
        if r.get("severity") == "CRITICAL"
        and r.get("confidence", 0) >= 0.75
    ]

    if critical_nodes:
        triggered_by = critical_nodes[0]["node_id"]
        print(f"CRITICAL OVERRIDE triggered by {triggered_by}")
        return {
            "aggregate_risk": 0.95,
            "fusion_decision": "BLOCK",
            "critical_override": True,
            "high_override": False,
            "threat_count": threat_count,
            "node_reasons": {r["node_id"]: r.get("reason") for r in active},
            "node_scores": {r["node_id"]: r.get("risk_score") for r in active},
            "node_weights": DOMAIN_WEIGHTS
        }

    # ===============================
    # ✅ HIGH SPECIALIST OVERRIDE
    # ===============================
    high_nodes = [
        r for r in active
        if r.get("severity") in ["HIGH", "CRITICAL"]
        and r.get("risk_score", 0) >= 0.85
        and r.get("confidence", 0) >= 0.70
    ]

    if high_nodes:
        triggered_by = high_nodes[0]["node_id"]
        print(f"HIGH SPECIALIST OVERRIDE triggered by {triggered_by}")
        return {
            "aggregate_risk": 0.80,
            "fusion_decision": "BLOCK",
            "critical_override": False,
            "high_override": True,
            "threat_count": threat_count,
            "node_reasons": {r["node_id"]: r.get("reason") for r in active},
            "node_scores": {r["node_id"]: r.get("risk_score") for r in active},
            "node_weights": DOMAIN_WEIGHTS
        }

    # ===============================
    # ✅ WEIGHTED CALCULATION
    # ===============================
    weighted_sum = 0
    weight_total = 0

    for report in active:
        node_id = report["node_id"]
        domain_weight = DOMAIN_WEIGHTS.get(node_id, 0.25)
        risk = report.get("risk_score", 0)
        confidence = report.get("confidence", 0)
        severity = report.get("severity", "LOW")
        severity_mult = SEVERITY_MULTIPLIERS.get(severity, 1.0)

        contribution = domain_weight * risk * confidence * severity_mult
        contribution = min(contribution, domain_weight)

        weighted_sum += contribution
        weight_total += domain_weight

    aggregate_risk = weighted_sum / weight_total if weight_total else 0
    aggregate_risk = min(aggregate_risk, 1.0)

    print(f"Aggregate risk: {aggregate_risk:.4f}")
    print(f"Threat count: {threat_count}")

    # ===============================
    # ✅ FINAL DECISION TIERS
    # ===============================
    if aggregate_risk >= 0.65 or threat_count >= 3:
        decision = "BLOCK"
    elif aggregate_risk >= 0.45 or threat_count >= 2:
        decision = "DELAY_LONG"
    elif aggregate_risk >= 0.25 or threat_count >= 1:
        decision = "DELAY_SHORT"
    else:
        decision = "PROCEED"

    print(f"Decision: {decision}")
    print("--- END FUSION ---\n")

    return {
        "aggregate_risk": round(aggregate_risk, 4),
        "fusion_decision": decision,
        "critical_override": False,
        "high_override": False,
        "threat_count": threat_count,
        "node_reasons": {r["node_id"]: r.get("reason") for r in active},
        "node_scores": {r["node_id"]: r.get("risk_score") for r in active},
        "node_weights": DOMAIN_WEIGHTS
    }