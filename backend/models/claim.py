from pydantic import BaseModel
from typing import Optional


class ClaimSubmit(BaseModel):
    user_id: str
    accident_description: str
    police_report_url: str
    image_url: str


class ClaimResponse(BaseModel):
    claim_id: Optional[str] = None
    user_id: str
    customer_name: Optional[str] = None
    accident_description: str
    police_report_url: Optional[str] = None
    image_url: Optional[str] = None
    estimated_amount: Optional[float] = None
    status: str
    ai_decision_log: Optional[str] = None
    reasoning: Optional[str] = None
    interrogation_questions: Optional[list[str]] = None


class ClaimDecision(BaseModel):
    decision: str
    estimated_amount: float
    ai_decision_log: str
    reasoning: str
    interrogation_questions: list[str] = []


class InterrogationRequest(BaseModel):
    claim_id: str
    answers: str


class AdminActionRequest(BaseModel):
    claim_id: str
    action: str  # "approve" or "reject"


class AdminStats(BaseModel):
    total_claims: int
    approved: int
    rejected: int
    flagged: int
    flagged_for_interrogation: int
    pending: int
