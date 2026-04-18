# nodes/node1_microdrain.py
from nodes.base_node import call_groq
from nodes.prompts import NODE1_PROMPT

def analyze(transaction_data):
    return call_groq(
        NODE1_PROMPT,
        transaction_data,
        node_id="node1_microdrain",
        model="llama-3.3-70b-versatile"
    )