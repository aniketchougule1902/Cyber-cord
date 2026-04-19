import math
import re
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request

from models.schemas import (
    DISCLAIMER,
    GithubOsintRequest,
    PasswordStrengthRequest,
    RiskLevel,
    ToolResponse,
)
from utils.rate_limit import limiter
from utils.sanitize import sanitize_username

router = APIRouter(prefix="/social", tags=["Social"])

GH_USER_URL = "https://api.github.com/users/{}"
GH_REPOS_URL = "https://api.github.com/users/{}/repos"

GITHUB_HEADERS = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "CyberCord-OSINT/1.0",
}

COMMON_WORDS = {
    "password", "pass", "passwd", "qwerty", "letmein", "welcome", "admin",
    "login", "master", "dragon", "monkey", "shadow", "sunshine", "princess",
    "football", "iloveyou", "trustno1", "baseball", "superman", "batman",
    "abc", "123", "1234", "12345", "123456", "1234567", "12345678",
}

KEYBOARD_WALKS = [
    "qwerty", "qwertyu", "qwertyui", "asdfgh", "asdfghj", "zxcvbn",
    "zxcvbnm", "1234567890", "0987654321",
]


def _detect_patterns(password: str) -> list[str]:
    patterns: list[str] = []
    lower = password.lower()

    # Dictionary words
    for word in COMMON_WORDS:
        if word in lower:
            patterns.append(f"common_word:{word}")

    # Keyboard walks
    for walk in KEYBOARD_WALKS:
        if walk in lower:
            patterns.append(f"keyboard_walk:{walk}")

    # Repeated characters (3+)
    if re.search(r"(.)\1{2,}", password):
        patterns.append("repeated_characters")

    # Sequential numbers
    if re.search(r"(012|123|234|345|456|567|678|789|890)", password):
        patterns.append("sequential_numbers")

    # Sequential letters
    if re.search(r"(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)", lower):
        patterns.append("sequential_letters")

    # All same case
    if password.isalpha():
        if password.islower():
            patterns.append("all_lowercase")
        elif password.isupper():
            patterns.append("all_uppercase")

    return patterns


def _analyze_password(password: str) -> dict:
    length = len(password)
    has_lower = bool(re.search(r"[a-z]", password))
    has_upper = bool(re.search(r"[A-Z]", password))
    has_digits = bool(re.search(r"\d", password))
    has_special = bool(re.search(r"[^a-zA-Z0-9]", password))

    charset_size = 0
    if has_lower:
        charset_size += 26
    if has_upper:
        charset_size += 26
    if has_digits:
        charset_size += 10
    if has_special:
        charset_size += 32

    charset_size = max(charset_size, 1)
    entropy_bits = round(math.log2(charset_size) * length, 2) if length > 0 else 0.0

    patterns = _detect_patterns(password)

    # Score 0-100
    score = 0
    score += min(length * 3, 30)          # up to 30 pts for length
    score += 10 if has_lower else 0
    score += 10 if has_upper else 0
    score += 10 if has_digits else 0
    score += 20 if has_special else 0
    score += min(int(entropy_bits / 3), 20)  # up to 20 pts for entropy
    score -= len(patterns) * 10             # deduct for patterns
    score = max(0, min(100, score))

    if score < 20:
        label = "very_weak"
    elif score < 40:
        label = "weak"
    elif score < 60:
        label = "moderate"
    elif score < 80:
        label = "strong"
    else:
        label = "very_strong"

    # Crack time at 10B guesses/sec
    combinations = charset_size ** length
    crack_seconds = combinations / 10_000_000_000
    if crack_seconds < 1:
        crack_time_str = "instantly"
    elif crack_seconds < 60:
        crack_time_str = f"{int(crack_seconds)} seconds"
    elif crack_seconds < 3600:
        crack_time_str = f"{int(crack_seconds/60)} minutes"
    elif crack_seconds < 86400:
        crack_time_str = f"{int(crack_seconds/3600)} hours"
    elif crack_seconds < 31536000:
        crack_time_str = f"{int(crack_seconds/86400)} days"
    elif crack_seconds < 3153600000:
        crack_time_str = f"{int(crack_seconds/31536000)} years"
    else:
        crack_time_str = "centuries"

    suggestions: list[str] = []
    if length < 12:
        suggestions.append("Use at least 12 characters.")
    if not has_upper:
        suggestions.append("Add uppercase letters (A-Z).")
    if not has_lower:
        suggestions.append("Add lowercase letters (a-z).")
    if not has_digits:
        suggestions.append("Add digits (0-9).")
    if not has_special:
        suggestions.append("Add special characters (!@#$%^&*...).")
    if patterns:
        suggestions.append("Avoid common words, keyboard walks, and repeated characters.")

    return {
        "length": length,
        "has_uppercase": has_upper,
        "has_lowercase": has_lower,
        "has_digits": has_digits,
        "has_special": has_special,
        "charset_size": charset_size,
        "entropy_bits": entropy_bits,
        "strength_score": score,
        "strength_label": label,
        "crack_time_estimate": crack_time_str,
        "crack_time_seconds": crack_seconds,
        "common_patterns_detected": patterns,
        "suggestions": suggestions,
    }


@router.post("/github-osint", response_model=ToolResponse)
@limiter.limit("20/minute")
async def github_osint(request: Request, body: GithubOsintRequest) -> ToolResponse:
    try:
        username = sanitize_username(body.username)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    async with httpx.AsyncClient(timeout=10, headers=GITHUB_HEADERS) as client:
        user_resp = await client.get(GH_USER_URL.format(username))
        if user_resp.status_code == 404:
            raise HTTPException(status_code=404, detail=f"GitHub user '{username}' not found.")
        if user_resp.status_code == 403:
            raise HTTPException(status_code=429, detail="GitHub API rate limit exceeded.")
        if user_resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"GitHub API error: {user_resp.status_code}")

        user = user_resp.json()

        repos_resp = await client.get(
            GH_REPOS_URL.format(username),
            params={"sort": "pushed", "per_page": "10"},
        )
        repos_data = repos_resp.json() if repos_resp.status_code == 200 else []

    # Account age
    created_at_str: str | None = user.get("created_at")
    account_age_days: int | None = None
    if created_at_str:
        try:
            created_dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            account_age_days = (datetime.now(timezone.utc) - created_dt).days
        except ValueError:
            pass

    top_repos = [
        {
            "name": r.get("name"),
            "description": r.get("description"),
            "language": r.get("language"),
            "stars": r.get("stargazers_count"),
            "forks": r.get("forks_count"),
            "last_push": r.get("pushed_at"),
            "url": r.get("html_url"),
            "is_fork": r.get("fork"),
        }
        for r in (repos_data if isinstance(repos_data, list) else [])
    ]

    return ToolResponse(
        tool="github_osint",
        input=username,
        result={
            "login": user.get("login"),
            "name": user.get("name"),
            "bio": user.get("bio"),
            "company": user.get("company"),
            "location": user.get("location"),
            "email": user.get("email"),
            "blog": user.get("blog"),
            "twitter_username": user.get("twitter_username"),
            "created_at": user.get("created_at"),
            "updated_at": user.get("updated_at"),
            "account_age_days": account_age_days,
            "public_repos": user.get("public_repos"),
            "public_gists": user.get("public_gists"),
            "followers": user.get("followers"),
            "following": user.get("following"),
            "avatar_url": user.get("avatar_url"),
            "html_url": user.get("html_url"),
            "site_admin": user.get("site_admin"),
            "hireable": user.get("hireable"),
            "top_repos": top_repos,
        },
        risk_level=RiskLevel.low,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )


@router.post("/password-strength", response_model=ToolResponse)
@limiter.limit("60/minute")
async def password_strength(request: Request, body: PasswordStrengthRequest) -> ToolResponse:
    if not body.password:
        raise HTTPException(status_code=422, detail="Password cannot be empty.")

    analysis = _analyze_password(body.password)

    label = analysis["strength_label"]
    if label in ("very_weak", "weak"):
        risk = RiskLevel.high
    elif label == "moderate":
        risk = RiskLevel.medium
    else:
        risk = RiskLevel.low

    # Do NOT include the password in the response
    return ToolResponse(
        tool="password_strength",
        input="[password hidden]",
        result=analysis,
        risk_level=risk,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )
