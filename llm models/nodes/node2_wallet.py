# nodes/node2_wallet.py
from nodes.base_node import call_groq
from nodes.prompts import NODE2_PROMPT

def analyze(transaction_data):
    return call_groq(
        NODE2_PROMPT,
        transaction_data,
        node_id="node2_wallet",
        model="qwen/qwen3-32b"
    )