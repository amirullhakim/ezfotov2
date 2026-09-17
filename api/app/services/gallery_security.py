import hashlib
import hmac
import secrets


SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1


def hash_gallery_password(
    password: str,
) -> str:
    """
    Hash a gallery password using Python's
    built-in scrypt implementation.
    """

    salt = secrets.token_bytes(16)

    password_hash = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=64,
    )

    return (
        f"scrypt$"
        f"{SCRYPT_N}$"
        f"{SCRYPT_R}$"
        f"{SCRYPT_P}$"
        f"{salt.hex()}$"
        f"{password_hash.hex()}"
    )


def verify_gallery_password(
    password: str,
    stored_hash: str,
) -> bool:
    """
    Verify a raw password against a stored
    scrypt gallery password hash.
    """

    try:
        (
            algorithm,
            n_value,
            r_value,
            p_value,
            salt_hex,
            expected_hash_hex,
        ) = stored_hash.split("$")

        if algorithm != "scrypt":
            return False

        salt = bytes.fromhex(
            salt_hex
        )

        expected_hash = bytes.fromhex(
            expected_hash_hex
        )

        actual_hash = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=int(n_value),
            r=int(r_value),
            p=int(p_value),
            dklen=len(expected_hash),
        )

        return hmac.compare_digest(
            actual_hash,
            expected_hash,
        )

    except (
        ValueError,
        TypeError,
    ):
        return False


def generate_private_gallery_token() -> str:
    """
    Generate the secret portion of a PRIVATE
    gallery share link.

    The raw value is returned to the photographer.
    Only its hash is stored in PostgreSQL.
    """

    return secrets.token_urlsafe(32)


def hash_private_gallery_token(
    token: str,
) -> str:
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def verify_private_gallery_token(
    token: str,
    stored_hash: str,
) -> bool:
    candidate_hash = (
        hash_private_gallery_token(
            token
        )
    )

    return hmac.compare_digest(
        candidate_hash,
        stored_hash,
    )