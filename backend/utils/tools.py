import io
import httpx
from pypdf import PdfReader
from utils.supabase_db import supabase

DEFAULT_ANNUAL_PREMIUM = 1200.0


def extract_pdf_text(pdf_url: str) -> str:
    """Download a PDF from a URL and extract its full text content."""
    try:
        response = httpx.get(pdf_url, timeout=60.0, verify=False)
        response.raise_for_status()
        reader = PdfReader(io.BytesIO(response.content))
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text
        return text.strip() if text.strip() else "No text could be extracted from this PDF."
    except Exception as e:
        return f"Error extracting PDF text: {str(e)}"


def get_policy_details(user_id: str) -> dict:
    """Fetch the user's insurance policy from Supabase to check coverage."""
    try:
        result = supabase.table("policies").select("*").eq("user_id", user_id).execute()
        if result.data:
            return result.data[0]
        return {"error": "No policy found for this user."}
    except Exception as e:
        return {"error": f"Database error: {str(e)}"}


def validate_fraud(user_id: str, accident_description: str, police_report_text: str) -> dict:
    """Compare the user's accident description against the police report text and
    check past claim history to detect potential fraud."""
    mismatches = []

    story_lower = accident_description.lower()
    report_lower = police_report_text.lower()

    date_keywords = _extract_date_keywords(report_lower)
    location_keywords = _extract_location_keywords(report_lower)

    for dk in date_keywords:
        if dk and dk not in story_lower:
            mismatches.append(f"Date reference '{dk}' in police report not mentioned in user's story.")

    for lk in location_keywords:
        if lk and lk not in story_lower:
            mismatches.append(f"Location reference '{lk}' in police report not mentioned in user's story.")

    try:
        history = supabase.table("claim_history").select("*").eq("user_id", user_id).execute()
        past_claims = history.data or []
        claim_count = len(past_claims)
        flagged_count = sum(1 for c in past_claims if c.get("status") == "flagged")
        rejected_count = sum(1 for c in past_claims if c.get("status") == "rejected")
    except Exception:
        past_claims = []
        claim_count = 0
        flagged_count = 0
        rejected_count = 0

    fraud_risk = "low"
    risk_factors = []

    if mismatches:
        fraud_risk = "high"
        risk_factors.append(f"Story-report mismatch: {'; '.join(mismatches)}")

    if flagged_count >= 2:
        fraud_risk = "high"
        risk_factors.append(f"User has {flagged_count} previously flagged claims.")
    elif flagged_count >= 1:
        if fraud_risk != "high":
            fraud_risk = "medium"
        risk_factors.append(f"User has {flagged_count} previously flagged claim(s).")

    if rejected_count >= 3:
        if fraud_risk == "low":
            fraud_risk = "medium"
        risk_factors.append(f"User has {rejected_count} previously rejected claims.")

    if claim_count >= 5:
        if fraud_risk == "low":
            fraud_risk = "medium"
        risk_factors.append(f"High claim frequency: {claim_count} past claims.")

    return {
        "fraud_risk": fraud_risk,
        "mismatches": mismatches,
        "risk_factors": risk_factors,
        "past_claim_count": claim_count,
        "past_flagged_count": flagged_count,
        "past_rejected_count": rejected_count,
    }


def calculate_ncd_impact(current_ncd_percentage: int, claim_amount: float, annual_premium: float = DEFAULT_ANNUAL_PREMIUM) -> dict:
    """Calculate the financial impact of a claim on the user's No Claim Discount."""
    ncd_step_back = 20
    new_ncd = max(0, current_ncd_percentage - ncd_step_back)

    current_discount_amount = annual_premium * (current_ncd_percentage / 100)
    new_discount_amount = annual_premium * (new_ncd / 100)
    annual_premium_increase = current_discount_amount - new_discount_amount
    three_year_cost = annual_premium_increase * 3

    net_benefit = claim_amount - three_year_cost

    recommendation = "claim"
    if net_benefit < 0:
        recommendation = "do_not_claim"
    elif net_benefit < claim_amount * 0.3:
        recommendation = "marginal"

    return {
        "current_ncd_percentage": current_ncd_percentage,
        "new_ncd_percentage": new_ncd,
        "ncd_lost_percentage": ncd_step_back,
        "annual_premium_increase": round(annual_premium_increase, 2),
        "three_year_ncd_cost": round(three_year_cost, 2),
        "claim_amount": claim_amount,
        "net_benefit": round(net_benefit, 2),
        "recommendation": recommendation,
    }


def _extract_date_keywords(text: str) -> list[str]:
    """Simple extraction of date-like tokens from text for comparison."""
    import re
    months = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december",
    ]
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    keywords = []
    for m in months:
        if m in text:
            keywords.append(m)
    for d in days:
        if d in text:
            keywords.append(d)
    year_matches = re.findall(r'\b(20[0-9]{2})\b', text)
    keywords.extend(year_matches)
    return keywords


def _extract_location_keywords(text: str) -> list[str]:
    """Simple extraction of location indicators from text."""
    import re
    patterns = [
        r'\b\w+\s+(?:road|street|avenue|blvd|boulevard|highway|hwylane|drive|dr)\b',
    ]
    keywords = []
    for p in patterns:
        matches = re.findall(p, text)
        keywords.extend(matches)
    return keywords
