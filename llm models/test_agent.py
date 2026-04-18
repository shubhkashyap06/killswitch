import sys
sys.path.insert(0, 'C:/CodeBlooded/vultra-node')

from agent import analyze_with_agent
import json

# Test case that should trigger re-evaluation (borderline)
test_data = {
    "transaction_id": "0xborder001",
    "timestamp": 1720000000,
    "wallet_address": "0xBorderline",
    "withdrawal_amount_eth": 1.2,
    "withdrawal_amount_bps": 720,
    "vault_total_liquidity_eth": 16.6,
    "wallet_registered": True,
    "registered_withdrawal_wallet": "0xBorderline",
    "funding_source": "0xKraken",
    "funding_source_is_known_exchange": True,
    "funding_depth": 3,
    "ip_address": "192.168.1.5",
    "gas_price_gwei": 33,
    "baseline_gas_price_gwei": 20,
    "recent_transactions": [
        {"timestamp": 1719999000, "amount_eth": 0.5, "type": "withdrawal"}
    ],
    "wallet_age_days": 25,
    "previous_interactions_with_vault": 2,
    "flagged_address": False
}

print("Testing LangGraph Agent...")
print("This should show the decision graph executing step by step...\n")

result = analyze_with_agent(test_data)

print("\n" + "="*50)
print("FINAL RESULT:")
print(f"Decision: {result['decision']}")
print(f"Risk Score: {result['risk_score']}")
print(f"Method: {result['method']}")
print(f"Re-evaluation performed: {result.get('reeval_performed', False)}")
print("="*50)