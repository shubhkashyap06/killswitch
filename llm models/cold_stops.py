# cold_stops.py

def check_cold_stops(data):
    """
    Hard rules that bypass AI entirely.
    If any trigger, decision is BLOCK immediately.
    """
    
    reasons = []
    
    # Rule 1: Withdrawal above 30% of vault
    if data["withdrawal_amount_bps"] > 3000:
        reasons.append("withdrawal_exceeds_30_percent_vault")
    
    # Rule 2: Wallet mismatch
    if data["wallet_address"] != data["registered_withdrawal_wallet"]:
        reasons.append("wallet_mismatch_not_registered_destination")
    
    # Rule 3: Known flagged address
    if data["flagged_address"]:
        reasons.append("wallet_is_flagged_address")
    
    # Rule 4: Brand new wallet under 24 hours old
    if data["wallet_age_days"] < 1:
        reasons.append("wallet_age_under_24_hours")
    
    # Rule 5: Gas price more than 3x baseline
    if data["gas_price_gwei"] > data["baseline_gas_price_gwei"] * 3:
        reasons.append("gas_price_anomaly_3x_baseline")
    
    # Rule 6: Shallow unknown funding source
    if data["funding_depth"] <= 1 and not data["funding_source_is_known_exchange"]:
        reasons.append("shallow_unknown_funding_source")
    
    if reasons:
        return {
            "cold_stop_triggered": True,
            "decision": "BLOCK",
            "reasons": reasons
        }
    
    return {"cold_stop_triggered": False}