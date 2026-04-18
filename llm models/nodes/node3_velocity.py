# nodes/node3_velocity.py
from nodes.base_node import call_groq
from nodes.prompts import NODE3_PROMPT

def analyze(transaction_data):
    return call_groq(
        NODE3_PROMPT,
        transaction_data,
        node_id="node3_velocity",
        model="meta-llama/llama-4-scout-17b-16e-instruct"
    )