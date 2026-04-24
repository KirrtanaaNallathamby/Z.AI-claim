import uuid
from fastapi import APIRouter, HTTPException
from supabase_auth.errors import AuthApiError
from utils.supabase_db import supabase
from models.user import UserRegister, UserLogin, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

DEFAULT_POLICY_TYPE = "comprehensive"
DEFAULT_NCD = 30
DEFAULT_ANNUAL_PREMIUM = 1200.0


@router.post("/register", response_model=UserResponse)
def register(user: UserRegister):
    """Register a new user. Creates an auth account, a profile, and a default policy."""
    try:
        auth_response = supabase.auth.sign_up({
            "email": user.email,
            "password": user.password,
        })
        auth_user = auth_response.user
        if not auth_user:
            raise HTTPException(status_code=400, detail="Registration failed.")

        user_id = auth_user.id

        supabase.table("profiles").insert({
            "id": user_id,
            "full_name": user.full_name,
            "role": user.role,
        }).execute()

        if user.role == "customer":
            supabase.table("policies").insert({
                "user_id": user_id,
                "policy_number": f"POL-{uuid.uuid4().hex[:8].upper()}",
                "policy_type": DEFAULT_POLICY_TYPE,
                "ncd_percentage": DEFAULT_NCD,
                "annual_premium": DEFAULT_ANNUAL_PREMIUM,
                "is_active": True,
            }).execute()

        return UserResponse(
            id=user_id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
        )

    except AuthApiError as e:
        raise HTTPException(status_code=400, detail=str(e.message))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration error: {str(e)}")


@router.post("/login")
def login(user: UserLogin):
    """Log in an existing user. Returns the Supabase session tokens."""
    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password,
        })
        session = auth_response.session
        user_data = auth_response.user
        if not session or not user_data:
            raise HTTPException(status_code=401, detail="Invalid credentials.")

        profile = supabase.table("profiles").select("*").eq("id", user_data.id).execute()

        return {
            "access_token": session.access_token,
            "refresh_token": session.refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user_data.id,
                "email": user_data.email,
                "role": profile.data[0]["role"] if profile.data else "customer",
                "full_name": profile.data[0]["full_name"] if profile.data else "",
            },
        }

    except AuthApiError as e:
        raise HTTPException(status_code=401, detail=str(e.message))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login error: {str(e)}")
