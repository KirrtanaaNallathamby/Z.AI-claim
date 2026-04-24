import json
from datetime import date
from fastapi import APIRouter, HTTPException
from utils.supabase_db import supabase
from utils.ai_agents import run_agent, run_interrogation
from models.claim import ClaimSubmit, ClaimResponse, InterrogationRequest, AdminActionRequest, AdminStats

router = APIRouter(prefix="/claims", tags=["Claims"])


def _get_customer_name(customer_id: str) -> str:
    try:
        profile = supabase.table("profiles").select("full_name").eq("id", customer_id).execute()
        return profile.data[0]["full_name"] if profile.data else "Unknown"
    except Exception:
        return "Unknown"


def _map_claim_row(c: dict) -> ClaimResponse:
    return ClaimResponse(
        claim_id=c["id"],
        user_id=c["customer_id"],
        customer_name=_get_customer_name(c["customer_id"]),
        accident_description=c.get("accident_description", ""),
        police_report_url=c.get("police_report_url"),
        image_url=c.get("image_url"),
        estimated_amount=float(c["estimated_amount"]) if c.get("estimated_amount") else None,
        status=c.get("status", "pending"),
        ai_decision_log=c.get("ai_decision_log"),
        reasoning=c.get("reasoning"),
        interrogation_questions=json.loads(c["interrogation_questions"]) if c.get("interrogation_questions") else None,
    )


@router.post("/submit-claim", response_model=ClaimResponse)
def submit_claim(claim: ClaimSubmit):
    try:
        profile = supabase.table("profiles").select("*").eq("id", claim.user_id).execute()
        if not profile.data:
            raise HTTPException(status_code=404, detail="User profile not found.")

        insert_result = supabase.table("claims").insert({
            "customer_id": claim.user_id,
            "accident_description": claim.accident_description,
            "police_report_url": claim.police_report_url,
            "image_url": claim.image_url,
            "status": "pending",
        }).execute()

        if not insert_result.data:
            raise HTTPException(status_code=500, detail="Failed to create claim record.")

        claim_record = insert_result.data[0]
        claim_id = claim_record["id"]

        ai_result = run_agent(
            user_id=claim.user_id,
            accident_description=claim.accident_description,
            police_report_url=claim.police_report_url,
            image_url=claim.image_url,
        )

        if ai_result["decision"] == "flagged" and ai_result.get("interrogation_questions"):
            status = "flagged_for_interrogation"
        else:
            status = ai_result["decision"]

        agent_messages = ai_result.pop("_agent_messages", [])

        supabase.table("claims").update({
            "status": status,
            "estimated_amount": ai_result["estimated_amount"],
            "ai_decision_log": ai_result["ai_decision_log"],
            "reasoning": ai_result.get("reasoning", ""),
            "interrogation_questions": json.dumps(ai_result.get("interrogation_questions", [])),
        }).eq("id", claim_id).execute()

        if status == "flagged_for_interrogation":
            supabase.table("claim_history").insert({
                "user_id": claim.user_id,
                "incident_type": f"__agent_context__:{claim_id}",
                "amount_paid": 0,
                "incident_date": date.today().isoformat(),
            }).execute()

        return ClaimResponse(
            claim_id=claim_id,
            user_id=claim.user_id,
            customer_name=profile.data[0].get("full_name", ""),
            accident_description=claim.accident_description,
            police_report_url=claim.police_report_url,
            image_url=claim.image_url,
            estimated_amount=ai_result["estimated_amount"],
            status=status,
            ai_decision_log=ai_result["ai_decision_log"],
            reasoning=ai_result.get("reasoning"),
            interrogation_questions=ai_result.get("interrogation_questions") if status == "flagged_for_interrogation" else None,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Claim submission error: {str(e)}")


@router.post("/interrogate", response_model=ClaimResponse)
def interrogate_claim(request: InterrogationRequest):
    try:
        claim_result = supabase.table("claims").select("*").eq("id", request.claim_id).execute()
        if not claim_result.data:
            raise HTTPException(status_code=404, detail="Claim not found.")

        claim = claim_result.data[0]
        if claim["status"] != "flagged_for_interrogation":
            raise HTTPException(status_code=400, detail="This claim is not awaiting interrogation.")

        ai_result = run_agent(
            user_id=claim["customer_id"],
            accident_description=claim["accident_description"],
            police_report_url=claim.get("police_report_url", ""),
            image_url=claim.get("image_url", ""),
        )

        agent_messages = ai_result.pop("_agent_messages", [])
        final_result = run_interrogation(agent_messages, request.answers)

        supabase.table("claims").update({
            "status": final_result["decision"],
            "estimated_amount": final_result["estimated_amount"],
            "ai_decision_log": claim.get("ai_decision_log", "") + "\n\n--- INTERROGATION ---\n" + final_result["ai_decision_log"],
            "reasoning": final_result.get("reasoning", ""),
            "interrogation_questions": None,
        }).eq("id", request.claim_id).execute()

        supabase.table("claim_history").insert({
            "user_id": claim["customer_id"],
            "incident_type": claim["accident_description"][:100],
            "amount_paid": final_result["estimated_amount"] if final_result["decision"] == "approved" else 0,
            "incident_date": date.today().isoformat(),
        }).execute()

        return ClaimResponse(
            claim_id=claim["id"],
            user_id=claim["customer_id"],
            customer_name=_get_customer_name(claim["customer_id"]),
            accident_description=claim["accident_description"],
            police_report_url=claim.get("police_report_url"),
            image_url=claim.get("image_url"),
            estimated_amount=final_result["estimated_amount"],
            status=final_result["decision"],
            ai_decision_log=claim.get("ai_decision_log", "") + "\n\n--- INTERROGATION ---\n" + final_result["ai_decision_log"],
            reasoning=final_result.get("reasoning"),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interrogation error: {str(e)}")


# ---- ADMIN ENDPOINTS ----

@router.get("/admin/stats", response_model=AdminStats)
def get_admin_stats():
    try:
        result = supabase.table("claims").select("status").execute()
        counts = {}
        for c in result.data:
            s = c.get("status", "pending")
            counts[s] = counts.get(s, 0) + 1
        return AdminStats(
            total_claims=len(result.data),
            approved=counts.get("approved", 0),
            rejected=counts.get("rejected", 0),
            flagged=counts.get("flagged", 0),
            flagged_for_interrogation=counts.get("flagged_for_interrogation", 0),
            pending=counts.get("pending", 0),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/approved", response_model=list[ClaimResponse])
def get_approved_claims():
    try:
        result = supabase.table("claims").select("*").eq("status", "approved").execute()
        return [_map_claim_row(c) for c in result.data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/flagged", response_model=list[ClaimResponse])
def get_flagged_claims():
    try:
        result = supabase.table("claims").select("*").in_("status", ["flagged", "flagged_for_interrogation"]).execute()
        return [_map_claim_row(c) for c in result.data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/all", response_model=list[ClaimResponse])
def get_all_claims():
    try:
        result = supabase.table("claims").select("*").order("created_at", desc=True).execute()
        return [_map_claim_row(c) for c in result.data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/action", response_model=ClaimResponse)
def admin_action(request: AdminActionRequest):
    """Admin can approve or reject any claim (overriding AI decision)."""
    try:
        claim_result = supabase.table("claims").select("*").eq("id", request.claim_id).execute()
        if not claim_result.data:
            raise HTTPException(status_code=404, detail="Claim not found.")

        claim = claim_result.data[0]

        if request.action == "approve":
            new_status = "approved"
        elif request.action == "reject":
            new_status = "rejected"
        else:
            raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'.")

        existing_log = claim.get("ai_decision_log", "")
        admin_note = f"\n\n--- ADMIN OVERRIDE ---\nAdmin changed status from {claim['status']} to {new_status}."

        supabase.table("claims").update({
            "status": new_status,
            "ai_decision_log": existing_log + admin_note,
        }).eq("id", request.claim_id).execute()

        claim["status"] = new_status
        claim["ai_decision_log"] = existing_log + admin_note

        return _map_claim_row(claim)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{claim_id}", response_model=ClaimResponse)
def get_claim(claim_id: str):
    try:
        result = supabase.table("claims").select("*").eq("id", claim_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Claim not found.")
        return _map_claim_row(result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}", response_model=list[ClaimResponse])
def get_user_claims(user_id: str):
    try:
        result = supabase.table("claims").select("*").eq("customer_id", user_id).execute()
        return [_map_claim_row(c) for c in result.data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
