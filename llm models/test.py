# test.py

import requests
import json

BASE_URL = "http://localhost:8000"

def print_result(test_name, result):
    print(f"\n{'='*50}")
    print(f"TEST: {test_name}")
    print(f"DECISION: {result['decision']}")
    print(f"RISK SCORE: {result['risk_score']}")
    print(f"METHOD: {result['method']}")
    if result.get('reasons'):
        print(f"REASONS: {result['reasons']}")
    if result.get('node_reports'):
        print(f"\nNode breakdown:")
        for node in result['node_reports']:
            abstain = node.get('abstain', False)
            error = node.get('error', False)
            if error:
                print(f"  {node['node_id']}: ERROR - {node.get('reason')}")
            elif abstain:
                print(f"  {node['node_id']}: ABSTAINED - {node.get('reason')}")
            else:
                print(f"  {node['node_id']}: "
                      f"risk={node.get('risk_score')} "
                      f"confidence={node.get('confidence')} "
                      f"severity={node.get('severity')} "
                      f"| {node.get('reason')}")
    print(f"{'='*50}")


# ============================================================
# COLD STOP TESTS
# These should be caught before AI runs
# ============================================================

def test_cold_stop_large_withdrawal():
    """Above 30% vault - cold stop"""
    data = {
        "transaction_id": "0xcs001",
        "timestamp": 1720000000,
        "wallet_address": "0xWhale",
        "withdrawal_amount_eth": 6.0,
        "withdrawal_amount_bps": 3600,
        "vault_total_liquidity_eth": 16.6,
        "wallet_registered": True,
        "registered_withdrawal_wallet": "0xWhale",
        "funding_source": "0xCoinbase",
        "funding_source_is_known_exchange": True,
        "funding_depth": 2,
        "ip_address": "192.168.1.1",
        "gas_price_gwei": 21,
        "baseline_gas_price_gwei": 20,
        "recent_transactions": [],
        "wallet_age_days": 200,
        "previous_interactions_with_vault": 5,
        "flagged_address": False
    }
    result = requests.post(f"{BASE_URL}/analyze", json=data).json()
    print_result("COLD STOP: Above 30% vault (expect BLOCK cold_stop)", result)


def test_cold_stop_flagged():
    """Flagged address - cold stop"""
    data = {
        "transaction_id": "0xcs002",
        "timestamp": 1720000000,
        "wallet_address": "0xFlagged",
        "withdrawal_amount_eth": 0.1,
        "withdrawal_amount_bps": 60,
        "vault_total_liquidity_eth": 16.6,
        "wallet_registered": True,
        "registered_withdrawal_wallet": "0xFlagged",
        "funding_source": "0xCoinbase",
        "funding_source_is_known_exchange": True,
        "funding_depth": 2,
        "ip_address": "192.168.1.1",
        "gas_price_gwei": 21,
        "baseline_gas_price_gwei": 20,
        "recent_transactions": [],
        "wallet_age_days": 100,
        "previous_interactions_with_vault": 2,
        "flagged_address": True
    }
    result = requests.post(f"{BASE_URL}/analyze", json=data).json()
    print_result("COLD STOP: Flagged address (expect BLOCK cold_stop)", result)


# ============================================================
# AI FUSION TESTS
# These bypass cold stops and reach the AI nodes
# ============================================================

def test_ai_clean_user():
    """
    Perfectly clean user.
    Known exchange, old wallet, small amount, no history of attacks.
    Expect: PROCEED
    """
    data = {
        "transaction_id": "0xai001",
        "timestamp": 1720000000,
        "wallet_address": "0xCleanUser",
        "withdrawal_amount_eth": 0.3,
        "withdrawal_amount_bps": 180,
        "vault_total_liquidity_eth": 16.6,
        "wallet_registered": True,
        "registered_withdrawal_wallet": "0xCleanUser",
        "funding_source": "0xCoinbase",
        "funding_source_is_known_exchange": True,
        "funding_depth": 2,
        "ip_address": "192.168.1.1",
        "gas_price_gwei": 21,
        "baseline_gas_price_gwei": 20,
        "recent_transactions": [],
        "wallet_age_days": 365,
        "previous_interactions_with_vault": 20,
        "flagged_address": False
    }
    result = requests.post(f"{BASE_URL}/analyze", json=data).json()
    print_result("AI TEST: Clean legitimate user (expect PROCEED)", result)


def test_ai_microdrain():
    """
    Micro drain attack pattern.
    3 near-identical withdrawals in 60 seconds.
    Funded from known exchange so bypasses cold stop.
    Expect: BLOCK or DELAY_LONG from AI
    """
    data = {
        "transaction_id": "0xai002",
        "timestamp": 1720000000,
        "wallet_address": "0xMicroDrainer",
        "withdrawal_amount_eth": 0.85,
        "withdrawal_amount_bps": 500,
        "vault_total_liquidity_eth": 16.6,
        "wallet_registered": True,
        "registered_withdrawal_wallet": "0xMicroDrainer",
        "funding_source": "0xBinance",
        "funding_source_is_known_exchange": True,
        "funding_depth": 2,
        "ip_address": "192.168.1.2",
        "gas_price_gwei": 28,
        "baseline_gas_price_gwei": 20,
        "recent_transactions": [
            {"timestamp": 1719999800, "amount_eth": 0.80, "type": "withdrawal"},
            {"timestamp": 1719999700, "amount_eth": 0.82, "type": "withdrawal"},
            {"timestamp": 1719999600, "amount_eth": 0.79, "type": "withdrawal"}
        ],
        "wallet_age_days": 45,
        "previous_interactions_with_vault": 3,
        "flagged_address": False
    }
    result = requests.post(f"{BASE_URL}/analyze", json=data).json()
    print_result("AI TEST: Micro drain pattern (expect BLOCK or DELAY_LONG)", result)


def test_ai_new_wallet():
    """
    New wallet, moderate amount, known exchange funding.
    Not a cold stop because funded from known exchange.
    AI should flag based on wallet age and no history.
    Expect: DELAY_SHORT or DELAY_LONG
    """
    data = {
        "transaction_id": "0xai003",
        "timestamp": 1720000000,
        "wallet_address": "0xNewWallet",
        "withdrawal_amount_eth": 1.5,
        "withdrawal_amount_bps": 900,
        "vault_total_liquidity_eth": 16.6,
        "wallet_registered": True,
        "registered_withdrawal_wallet": "0xNewWallet",
        "funding_source": "0xCoinbase",
        "funding_source_is_known_exchange": True,
        "funding_depth": 2,
        "ip_address": "192.168.1.3",
        "gas_price_gwei": 24,
        "baseline_gas_price_gwei": 20,
        "recent_transactions": [],
        "wallet_age_days": 5,
        "previous_interactions_with_vault": 0,
        "flagged_address": False
    }
    result = requests.post(f"{BASE_URL}/analyze", json=data).json()
    print_result("AI TEST: New wallet no history (expect DELAY)", result)


def test_ai_flash_loan_signature():
    """
    Flash loan attack signature.
    Funds arrived very recently, high gas, large amount relative to history.
    Funded from known exchange so bypasses cold stop.
    Expect: BLOCK
    """
    data = {
        "transaction_id": "0xai004",
        "timestamp": 1720000000,
        "wallet_address": "0xFlashAttacker",
        "withdrawal_amount_eth": 4.5,
        "withdrawal_amount_bps": 2700,
        "vault_total_liquidity_eth": 16.6,
        "wallet_registered": True,
        "registered_withdrawal_wallet": "0xFlashAttacker",
        "funding_source": "0xUniswap",
        "funding_source_is_known_exchange": True,
        "funding_depth": 2,
        "ip_address": "192.168.1.4",
        "gas_price_gwei": 55,
        "baseline_gas_price_gwei": 20,
        "recent_transactions": [
            {"timestamp": 1719999950, "amount_eth": 4.5, "type": "deposit"},
            {"timestamp": 1719999900, "amount_eth": 4.5, "type": "deposit"}
        ],
        "wallet_age_days": 2,
        "previous_interactions_with_vault": 0,
        "flagged_address": False
    }
    result = requests.post(f"{BASE_URL}/analyze", json=data).json()
    print_result("AI TEST: Flash loan signature (expect BLOCK)", result)


def test_ai_borderline():
    """
    Borderline case. Moderately suspicious but not obvious.
    AI should show nuance here.
    Expect: DELAY_SHORT or DELAY_LONG
    """
    data = {
        "transaction_id": "0xai005",
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
    result = requests.post(f"{BASE_URL}/analyze", json=data).json()
    print_result("AI TEST: Borderline case (expect DELAY)", result)


# ============================================================
# POST WITHDRAWAL MONITOR TESTS
# ============================================================

def test_monitor_normal():
    """Single normal withdrawal, no alerts expected"""
    data = {
        "wallet_address": "0xNormalUser",
        "completed_withdrawal_eth": 0.3,
        "vault_remaining_liquidity_eth": 16.3,
        "timestamp": 1720000000,
        "recent_transactions": []
    }
    result = requests.post(f"{BASE_URL}/monitor", json=data).json()
    print(f"\n{'='*50}")
    print(f"MONITOR TEST: Normal single withdrawal (expect NORMAL)")
    print(f"STATUS: {result['status']}")
    print(f"ALERTS: {result['alerts']}")
    print(f"{'='*50}")


def test_monitor_escalating():
    """
    Three increasing withdrawals detected after completion.
    Should flag escalating pattern.
    """
    # First call to build history
    requests.post(f"{BASE_URL}/monitor", json={
        "wallet_address": "0xSlowRug",
        "completed_withdrawal_eth": 0.5,
        "vault_remaining_liquidity_eth": 16.0,
        "timestamp": 1719997000,
        "recent_transactions": []
    })

    requests.post(f"{BASE_URL}/monitor", json={
        "wallet_address": "0xSlowRug",
        "completed_withdrawal_eth": 1.0,
        "vault_remaining_liquidity_eth": 15.0,
        "timestamp": 1719998000,
        "recent_transactions": []
    })

    result = requests.post(f"{BASE_URL}/monitor", json={
        "wallet_address": "0xSlowRug",
        "completed_withdrawal_eth": 2.0,
        "vault_remaining_liquidity_eth": 13.0,
        "timestamp": 1719999000,
        "recent_transactions": []
    }).json()

    print(f"\n{'='*50}")
    print(f"MONITOR TEST: Escalating withdrawals (expect FLAG_FOR_REVIEW)")
    print(f"STATUS: {result['status']}")
    print(f"ALERTS: {result['alerts']}")
    print(f"TOTAL WITHDRAWN: {result['total_withdrawn_eth']} ETH")
    print(f"{'='*50}")


# ============================================================
# RUN ALL TESTS
# ============================================================

if __name__ == "__main__":
    print("Starting Vultra-Node API Tests...")
    print("Make sure main.py is running in another terminal first\n")

    print("\n" + "="*50)
    print("SECTION 1: COLD STOP TESTS")
    print("="*50)
    test_cold_stop_large_withdrawal()
    test_cold_stop_flagged()

    print("\n" + "="*50)
    print("SECTION 2: AI FUSION TESTS")
    print("="*50)
    test_ai_clean_user()
    test_ai_microdrain()
    test_ai_new_wallet()
    test_ai_flash_loan_signature()
    test_ai_borderline()

    print("\n" + "="*50)
    print("SECTION 3: POST WITHDRAWAL MONITOR")
    print("="*50)
    test_monitor_normal()
    test_monitor_escalating()

    print("\n\nAll tests complete.")