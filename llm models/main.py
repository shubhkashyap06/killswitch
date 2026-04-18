# main.py

from dotenv import load_dotenv
import pathlib
load_dotenv(pathlib.Path(__file__).parent / '.env')

from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
from agent import analyze_with_agent
from monitor import analyze_post_withdrawal
import uvicorn

app = FastAPI(title="Killswitch-Node AI Layer")

class RecentTransaction(BaseModel):
    timestamp: int
    amount_eth: float
    type: str

class WithdrawalRequest(BaseModel):
    transaction_id: str
    timestamp: int
    wallet_address: str
    withdrawal_amount_eth: float
    withdrawal_amount_bps: int
    vault_total_liquidity_eth: float
    wallet_registered: bool
    registered_withdrawal_wallet: str
    funding_source: str
    funding_source_is_known_exchange: bool
    funding_depth: int
    ip_address: str
    gas_price_gwei: float
    baseline_gas_price_gwei: float
    recent_transactions: List[RecentTransaction]
    wallet_age_days: int
    previous_interactions_with_vault: int
    flagged_address: bool

class PostWithdrawalData(BaseModel):
    wallet_address: str
    completed_withdrawal_eth: float
    vault_remaining_liquidity_eth: float
    timestamp: int
    recent_transactions: List[RecentTransaction]

@app.post("/analyze")
async def analyze(request: WithdrawalRequest):
    result = analyze_with_agent(request.dict())
    
    # Clean structured response
    return {
        "decision": result["decision"],
        "delay_seconds": result["delay_seconds"],
        "risk_score": result["risk_score"],
        "method": result["method"],
        "reasons": result.get("reasons", {}),
        "node_breakdown": [
            {
                "node_id": r.get("node_id"),
                "risk_score": r.get("risk_score"),
                "confidence": r.get("confidence"),
                "severity": r.get("severity"),
                "threat_detected": r.get("threat_detected"),
                "abstain": r.get("abstain"),
                "reason": r.get("reason")
            }
            for r in (result.get("node_reports") or [])
        ],
        "reeval_performed": result.get("reeval_performed", False)
    }

@app.post("/monitor")
async def monitor(request: PostWithdrawalData):
    result = analyze_post_withdrawal(request.dict())
    
    return {
        "wallet": result["wallet"],
        "status": result["status"],
        "alerts": result["alerts"],
        "total_withdrawn_eth": result["total_withdrawn_eth"],
        "withdrawal_count": result["withdrawal_count"],
        "cumulative_last_hour_eth": result["cumulative_last_hour_eth"]
    }

@app.get("/health")
async def health():
    return {"status": "online", "nodes": 4, "engine": "langgraph"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)