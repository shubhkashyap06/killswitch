# monitor.py

wallet_history = {}

def analyze_post_withdrawal(data):
    """
    Called after every successful withdrawal.
    Tracks patterns over time per wallet.
    """

    wallet = data["wallet_address"]

    if wallet not in wallet_history:
        wallet_history[wallet] = []

    wallet_history[wallet].append({
        "timestamp": data["timestamp"],
        "amount_eth": data["completed_withdrawal_eth"],
        "vault_remaining": data["vault_remaining_liquidity_eth"]
    })

    history = wallet_history[wallet]
    alerts = []

    # Check 1: Cumulative drain in last hour
    one_hour_ago = data["timestamp"] - 3600
    recent = [h for h in history if h["timestamp"] > one_hour_ago]
    cumulative_hour = sum(h["amount_eth"] for h in recent)

    if cumulative_hour > data["vault_remaining_liquidity_eth"] * 0.20:
        alerts.append({
            "type": "cumulative_hourly_drain",
            "detail": f"Wallet withdrew {cumulative_hour:.2f} ETH in the last hour",
            "severity": "HIGH"
        })

    # Check 2: Escalating withdrawal amounts
    if len(history) >= 3:
        last_three = [h["amount_eth"] for h in history[-3:]]
        if last_three[0] < last_three[1] < last_three[2]:
            alerts.append({
                "type": "escalating_withdrawal_pattern",
                "detail": f"Three consecutive increasing withdrawals: {last_three}",
                "severity": "MEDIUM"
            })

    # Check 3: High cumulative drain percentage
    total_withdrawn = sum(h["amount_eth"] for h in history)
    original_vault = data["vault_remaining_liquidity_eth"] + total_withdrawn
    drain_pct = (total_withdrawn / original_vault) * 100 if original_vault > 0 else 0

    if drain_pct > 40:
        alerts.append({
            "type": "high_cumulative_vault_drain",
            "detail": f"Wallet has withdrawn {drain_pct:.1f}% of vault total",
            "severity": "HIGH"
        })

    # Status
    if any(a["severity"] == "HIGH" for a in alerts):
        status = "FLAG_FOR_REVIEW"
    elif any(a["severity"] == "MEDIUM" for a in alerts):
        status = "WATCH"
    else:
        status = "NORMAL"

    return {
        "wallet": wallet,
        "status": status,
        "alerts": alerts,
        "total_withdrawn_eth": total_withdrawn,
        "withdrawal_count": len(history),
        "cumulative_last_hour_eth": cumulative_hour
    }