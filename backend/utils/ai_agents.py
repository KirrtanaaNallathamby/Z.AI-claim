import os
import json
import httpx
from dotenv import load_dotenv
from utils.tools import extract_pdf_text, get_policy_details, validate_fraud, calculate_ncd_impact

load_dotenv()

Z_AI_API_KEY: str = os.getenv("Z_AI_API_KEY", "")
Z_AI_BASE_URL: str = "https://api.ilmu.ai/v1"

SYSTEM_PROMPT = """
You are a senior Insurance Claims Adjuster. You are thorough,
skeptical of fraud, but fair to customers.
You must use the provided tools to verify every claim.

IMPORTANT RULES:
1. Your reasoning must be a concise, human-readable summary.
   Do NOT repeat or include raw tool output, extracted PDF text, or JSON data in your reasoning.
   Summarize what you found and why you made your decision in plain language.
2. When flagging a claim, your reasoning should state there is a discrepancy between
   the report and the description WITHOUT revealing what the report actually says.
   For example: say "The accident description does not match the police report details"
   NOT "The police report says the accident was on Main St but you said Elm St".
3. Your interrogation questions must be open-ended and must NOT hint at or reveal
   what the police report states. Ask general questions like:
   - "Can you describe the exact location where the accident occurred?"
   - "What time of day did the accident happen?"
   - "Can you provide more details about how the collision occurred?"
   Do NOT ask questions like "The report says X, can you confirm?" or "Did the accident happen at [specific detail from report]?"
"""

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "extract_pdf_text",
            "description": "Download and extract the full text from a police report PDF given its URL.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pdf_url": {
                        "type": "string",
                        "description": "The public URL of the PDF police report.",
                    }
                },
                "required": ["pdf_url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_policy_details",
            "description": "Fetch the user's insurance policy details from the database to check what is covered.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The UUID of the user/policyholder.",
                    }
                },
                "required": ["user_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "validate_fraud",
            "description": "Compare the user's accident story against the police report and check claim history for fraud indicators.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The UUID of the user/policyholder.",
                    },
                    "accident_description": {
                        "type": "string",
                        "description": "The user's description of the accident.",
                    },
                    "police_report_text": {
                        "type": "string",
                        "description": "The extracted text from the police report PDF.",
                    },
                },
                "required": ["user_id", "accident_description", "police_report_text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_ncd_impact",
            "description": "Calculate the financial impact of making a claim on the user's No Claim Discount (NCD). Helps decide if claiming is economically worthwhile.",
            "parameters": {
                "type": "object",
                "properties": {
                    "current_ncd_percentage": {
                        "type": "integer",
                        "description": "The user's current NCD percentage.",
                    },
                    "claim_amount": {
                        "type": "number",
                        "description": "The estimated claim amount in currency units.",
                    },
                    "annual_premium": {
                        "type": "number",
                        "description": "The user's annual insurance premium from their policy.",
                    },
                },
                "required": ["current_ncd_percentage", "claim_amount", "annual_premium"],
            },
        },
    },
]

TOOL_FUNCTIONS = {
    "extract_pdf_text": extract_pdf_text,
    "get_policy_details": get_policy_details,
    "validate_fraud": validate_fraud,
    "calculate_ncd_impact": calculate_ncd_impact,
}


def _summarize_result(result) -> str:
    """Create a short summary of a tool result instead of dumping the full output."""
    raw = json.dumps(result, default=str)
    if len(raw) <= 150:
        return raw
    if isinstance(result, dict):
        if "error" in result:
            return f"Error: {result['error']}"
        if "fraud_risk" in result:
            return f"fraud_risk={result['fraud_risk']}, mismatches={len(result.get('mismatches', []))}, risk_factors={len(result.get('risk_factors', []))}, past_claims={result.get('past_claim_count', 0)}"
        if "recommendation" in result and "net_benefit" in result:
            return f"ncd={result['current_ncd_percentage']}%→{result['new_ncd_percentage']}%, 3yr_cost=${result['three_year_ncd_cost']}, net_benefit=${result['net_benefit']}, recommendation={result['recommendation']}"
        if "policy_type" in result:
            return f"policy_type={result.get('policy_type')}, ncd={result.get('ncd_percentage')}%, annual_premium={result.get('annual_premium')}, active={result.get('is_active')}"
    # For PDF text and other long results
    return f"[{len(raw)} chars] {raw[:80]}..."


def _call_z_ai(messages: list[dict]) -> dict:
    """Make a single call to the Z.AI GLM chat completions endpoint."""
    headers = {
        "Authorization": f"Bearer {Z_AI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "ilmu-glm-5.1",
        "messages": messages,
        "tools": TOOL_DEFINITIONS,
        "tool_choice": "auto",
    }
    response = httpx.post(
        f"{Z_AI_BASE_URL}/chat/completions",
        headers=headers,
        json=payload,
        timeout=120.0,
        verify=False,
    )
    response.raise_for_status()
    return response.json()


def run_agent(user_id: str, accident_description: str, police_report_url: str, image_url: str) -> dict:
    """Run the AI Adjuster agent — Phase 1: initial analysis.

    Returns:
    - approved/rejected → final decision with reasoning
    - flagged → returns interrogation_questions for the user
    """
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"A new insurance claim has been submitted:\n"
                f"- User ID: {user_id}\n"
                f"- Accident Description: {accident_description}\n"
                f"- Police Report URL: {police_report_url}\n"
                f"- Accident Image URL: {image_url}\n\n"
                f"Process:\n"
                f"1. Call extract_pdf_text with the police report URL.\n"
                f"2. Call get_policy_details with the user ID.\n"
                f"3. Call validate_fraud with the user ID, accident description, and extracted police report text.\n"
                f"4. ESTIMATE the claim amount based on damage severity, parts affected, and typical repair costs.\n"
                f"5. Call calculate_ncd_impact with the policy's NCD percentage, your estimated amount, and annual_premium.\n"
                f"6. Make your decision.\n\n"
                f"Decision rules:\n"
                f"- If fraud_risk is 'high', FLAG the claim.\n"
                f"- If the claim is valid and low-value, APPROVE.\n"
                f"- If the NCD impact makes it marginal, REJECT with explanation.\n"
                f"- If the policy doesn't cover this, REJECT.\n\n"
                f"Respond with ONLY a JSON object:\n"
                f'If approved/rejected: {{"decision": "approved"|"rejected", "estimated_amount": <number>, "reasoning": "concise summary"}}\n'
                f'If flagged: {{"decision": "flagged", "estimated_amount": <number>, "reasoning": "why you suspect fraud", "interrogation_questions": ["question 1", "question 2", "question 3"]}}'
            ),
        },
    ]

    max_iterations = 10
    decision_log = []
    agent_messages = list(messages)  # keep full context for interrogation phase

    for _ in range(max_iterations):
        response = _call_z_ai(messages)
        choice = response["choices"][0]
        message = choice["message"]
        messages.append(message)
        agent_messages.append(message)

        if message.get("tool_calls"):
            for tool_call in message["tool_calls"]:
                function_name = tool_call["function"]["name"]
                function_args = json.loads(tool_call["function"]["arguments"])

                decision_log.append(f"[Tool Call] {function_name}({json.dumps(function_args)})")

                if function_name in TOOL_FUNCTIONS:
                    result = TOOL_FUNCTIONS[function_name](**function_args)
                else:
                    result = {"error": f"Unknown function: {function_name}"}

                decision_log.append(f"[Tool Result] {function_name}: {_summarize_result(result)}")

                msg = {
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "content": json.dumps(result, default=str),
                }
                messages.append(msg)
                agent_messages.append(msg)
        else:
            content = message.get("content", "")
            decision_log.append(f"[Decision] {content[:200]}")

            parsed = _parse_initial_decision(content)
            parsed["ai_decision_log"] = "\n".join(decision_log)
            parsed["_agent_messages"] = agent_messages  # pass context for interrogation
            return parsed

    return {
        "decision": "flagged",
        "estimated_amount": 0,
        "reasoning": "AI agent did not reach a decision within iteration limit.",
        "interrogation_questions": ["Please describe the accident in more detail.", "Can you provide additional evidence?"],
        "ai_decision_log": "\n".join(decision_log) + "\n[Iteration limit reached]",
        "_agent_messages": agent_messages,
    }


def run_interrogation(agent_messages: list[dict], user_answers: str) -> dict:
    """Phase 2: Interrogation. The user has answered the AI's questions.
    AI makes a FINAL decision based on the answers."""

    messages = list(agent_messages)
    messages.append({
        "role": "user",
        "content": (
            f"The claimant has responded to your questions. Here are their answers:\n\n"
            f"{user_answers}\n\n"
            f"Based on these answers and all previous evidence, make your FINAL decision.\n"
            f"Respond with ONLY a JSON object:\n"
            f'{{"decision": "approved"|"rejected"|"flagged", "estimated_amount": <number>, "reasoning": "concise summary of final decision"}}\n\n'
            f"If the answers satisfactorily resolve your concerns, APPROVE the claim.\n"
            f"If the answers are inconsistent or suspicious, maintain FLAGGED status for admin review.\n"
            f"If the claim is valid but not economically worthwhile, REJECT."
        ),
    })

    max_iterations = 5
    decision_log = []

    for _ in range(max_iterations):
        response = _call_z_ai(messages)
        choice = response["choices"][0]
        message = choice["message"]
        messages.append(message)

        if message.get("tool_calls"):
            for tool_call in message["tool_calls"]:
                function_name = tool_call["function"]["name"]
                function_args = json.loads(tool_call["function"]["arguments"])

                decision_log.append(f"[Tool Call] {function_name}({json.dumps(function_args)})")

                if function_name in TOOL_FUNCTIONS:
                    result = TOOL_FUNCTIONS[function_name](**function_args)
                else:
                    result = {"error": f"Unknown function: {function_name}"}

                decision_log.append(f"[Tool Result] {function_name}: {_summarize_result(result)}")

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "content": json.dumps(result, default=str),
                })
        else:
            content = message.get("content", "")
            decision_log.append(f"[Final Decision] {content[:200]}")

            decision, estimated_amount, reasoning = _parse_final_decision(content)
            return {
                "decision": decision,
                "estimated_amount": estimated_amount,
                "reasoning": reasoning,
                "ai_decision_log": "\n".join(decision_log),
            }

    return {
        "decision": "flagged",
        "estimated_amount": 0,
        "reasoning": "AI did not reach a final decision after interrogation.",
        "ai_decision_log": "\n".join(decision_log) + "\n[Iteration limit reached]",
    }


def _parse_initial_decision(content: str) -> dict:
    """Parse the initial decision from Phase 1. May include interrogation_questions."""
    try:
        start = content.find("{")
        end = content.rfind("}") + 1
        if start != -1 and end > start:
            parsed = json.loads(content[start:end])
            decision = parsed.get("decision", "flagged").lower()
            estimated_amount = float(parsed.get("estimated_amount", 0))
            reasoning = parsed.get("reasoning", content)
            interrogation_questions = parsed.get("interrogation_questions", [])
            if decision not in ("approved", "rejected", "flagged"):
                decision = "flagged"
            return {
                "decision": decision,
                "estimated_amount": estimated_amount,
                "reasoning": reasoning,
                "interrogation_questions": interrogation_questions,
            }
    except (json.JSONDecodeError, KeyError, ValueError):
        pass

    content_lower = content.lower()
    if "approved" in content_lower:
        return {"decision": "approved", "estimated_amount": 0, "reasoning": content, "interrogation_questions": []}
    elif "rejected" in content_lower:
        return {"decision": "rejected", "estimated_amount": 0, "reasoning": content, "interrogation_questions": []}
    else:
        return {"decision": "flagged", "estimated_amount": 0, "reasoning": content, "interrogation_questions": ["Please describe the accident in more detail."]}


def _parse_final_decision(content: str) -> tuple[str, float, str]:
    """Parse the final decision from Phase 2 (interrogation)."""
    try:
        start = content.find("{")
        end = content.rfind("}") + 1
        if start != -1 and end > start:
            parsed = json.loads(content[start:end])
            decision = parsed.get("decision", "flagged").lower()
            estimated_amount = float(parsed.get("estimated_amount", 0))
            reasoning = parsed.get("reasoning", content)
            if decision not in ("approved", "rejected", "flagged"):
                decision = "flagged"
            return decision, estimated_amount, reasoning
    except (json.JSONDecodeError, KeyError, ValueError):
        pass

    content_lower = content.lower()
    if "approved" in content_lower:
        return "approved", 0, content
    elif "rejected" in content_lower:
        return "rejected", 0, content
    else:
        return "flagged", 0, content
