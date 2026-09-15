from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Profile


def main():
    email = input(
        "Email to promote to EZFOTOO Super Admin: "
    ).strip().lower()

    db = SessionLocal()

    try:
        profile = db.scalar(
            select(Profile).where(
                func_lower(Profile.email)
                == email
            )
        )

        if not profile:
            print()
            print("Profile not found.")
            print(
                "Make sure this user has already "
                "completed EZFOTOO onboarding."
            )
            return

        profile.is_platform_admin = True

        db.commit()

        print()
        print(
            f"{profile.email} is now an "
            "EZFOTOO Super Admin."
        )

    finally:
        db.close()


def func_lower(column):
    from sqlalchemy import func

    return func.lower(column)


if __name__ == "__main__":
    main()