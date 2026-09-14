from fastapi import APIRouter, Depends

from app.core.auth import get_current_user


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.get("/me")
def get_me(
    current_user: dict = Depends(get_current_user),
):
    return {
        "id": current_user.get("id"),
        "email": current_user.get("email"),
        "user_metadata": current_user.get("user_metadata", {}),
    }