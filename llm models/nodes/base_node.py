# nodes/base_node.py

import os
import json
import pathlib
from dotenv import load_dotenv

env_path = pathlib.Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

from groq import Groq

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

def call_groq(system_prompt, transaction_data, node_id, model):
    user_message = (
        "Analyze this withdrawal request.\n"
        "You MUST respond with a single JSON object only.\n"
        "The JSON must have exactly these keys: "
        "risk_score, confidence, severity, threat_detected, abstain, reason\n\n"
        f"Transaction Data:\n{json.dumps(transaction_data, indent=2)}"
    )

    try:
        response = groq_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.1,
            max_tokens=512,
        )

        raw = response.choices[0].message.content.strip()

        # Extract JSON from response even if model adds extra text
        json_start = raw.find("{")
        json_end = raw.rfind("}") + 1
        
        if json_start == -1 or json_end <= json_start:
            return _abstain(node_id, model, f"no json found in: {raw[:100]}")
        
        json_str = raw[json_start:json_end]
        result = json.loads(json_str)
        result["node_id"] = node_id
        result["model_used"] = model
        result["error"] = False
        return result

    except Exception as e:
        return _abstain(node_id, model, str(e))


def _abstain(node_id, model, error_msg):
    return {
        "node_id": node_id,
        "model_used": model,
        "risk_score": 0.0,
        "confidence": 0.0,
        "severity": "LOW",
        "threat_detected": False,
        "abstain": True,
        "reason": f"node_error: {error_msg}",
        "error": True
    }