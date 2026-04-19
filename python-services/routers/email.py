import asyncio
import os
import re
from datetime import datetime, timezone
from email import message_from_string
from typing import Optional

import dns.resolver
import httpx
from fastapi import APIRouter, HTTPException, Request

from models.schemas import (
    DISCLAIMER,
    EmailBreachRequest,
    EmailHeadersRequest,
    EmailVerifyRequest,
    RiskLevel,
    ToolResponse,
)
from utils.rate_limit import limiter
from utils.sanitize import sanitize_email

router = APIRouter(prefix="/email", tags=["Email"])

HIBP_BREACH_URL = "https://haveibeenpwned.com/api/v3/breachedaccount/{email}"
HIBP_API_KEY = os.getenv("HIBP_API_KEY", "")


@router.post("/breach-check", response_model=ToolResponse)
@limiter.limit("20/minute")
async def breach_check(request: Request, body: EmailBreachRequest) -> ToolResponse:
    email = sanitize_email(str(body.email))
    breaches: list[dict] = []
    error_msg: str | None = None

    try:
        headers: dict[str, str] = {
            "hibp-api-key": HIBP_API_KEY,
            "user-agent": "CyberCord-OSINT/1.0",
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                HIBP_BREACH_URL.format(email=email),
                headers=headers,
                params={"truncateResponse": "false"},
            )
            if resp.status_code == 200:
                breaches = resp.json()
            elif resp.status_code == 404:
                breaches = []
            elif resp.status_code == 401:
                error_msg = "HIBP API key missing or invalid."
            elif resp.status_code == 429:
                error_msg = "Rate limited by HIBP. Try again shortly."
            else:
                error_msg = f"HIBP returned status {resp.status_code}."
    except httpx.RequestError as exc:
        error_msg = f"Network error contacting HIBP: {exc}"

    if error_msg:
        raise HTTPException(status_code=502, detail=error_msg)

    breach_count = len(breaches)
    most_recent = None
    breach_names: list[str] = []
    for b in breaches:
        breach_names.append(b.get("Name", "Unknown"))
        bd = b.get("BreachDate")
        if bd:
            try:
                dt = datetime.strptime(bd, "%Y-%m-%d")
                if most_recent is None or dt > most_recent:
                    most_recent = dt
            except ValueError:
                pass

    if breach_count == 0:
        risk = RiskLevel.low
    elif breach_count <= 3:
        risk = RiskLevel.medium
    else:
        risk = RiskLevel.high

    return ToolResponse(
        tool="email_breach_check",
        input=email,
        result={
            "email": email,
            "breach_count": breach_count,
            "breach_names": breach_names,
            "most_recent_breach": most_recent.isoformat() if most_recent else None,
            "breaches": [
                {
                    "name": b.get("Name"),
                    "title": b.get("Title"),
                    "breach_date": b.get("BreachDate"),
                    "pwn_count": b.get("PwnCount"),
                    "data_classes": b.get("DataClasses", []),
                    "description": re.sub(r"<[^>]+>", "", b.get("Description", "")),
                    "is_verified": b.get("IsVerified", False),
                    "is_sensitive": b.get("IsSensitive", False),
                }
                for b in breaches
            ],
        },
        risk_level=risk,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )


@router.post("/verify", response_model=ToolResponse)
@limiter.limit("30/minute")
async def verify_email(request: Request, body: EmailVerifyRequest) -> ToolResponse:
    email = sanitize_email(str(body.email))
    domain = email.split("@", 1)[1] if "@" in email else email

    has_mx = False
    mx_records: list[str] = []
    is_valid_format = "@" in email and "." in email.split("@", 1)[1]
    error_detail: str | None = None

    try:
        loop = asyncio.get_event_loop()
        answers = await loop.run_in_executor(
            None,
            lambda: dns.resolver.resolve(domain, "MX"),
        )
        for rdata in answers:
            mx_records.append(str(rdata.exchange).rstrip("."))
        mx_records.sort()
        has_mx = True
    except dns.resolver.NXDOMAIN:
        error_detail = "Domain does not exist."
    except dns.resolver.NoAnswer:
        error_detail = "No MX records found."
    except dns.exception.DNSException as exc:
        error_detail = str(exc)

    return ToolResponse(
        tool="email_verify",
        input=email,
        result={
            "email": email,
            "domain": domain,
            "is_valid_format": is_valid_format,
            "has_mx": has_mx,
            "mx_records": mx_records,
            "dns_error": error_detail,
        },
        risk_level=RiskLevel.low,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )


@router.post("/analyze-headers", response_model=ToolResponse)
@limiter.limit("30/minute")
async def analyze_headers(request: Request, body: EmailHeadersRequest) -> ToolResponse:
    raw = body.headers.strip()
    msg = message_from_string(raw)

    def _get(key: str) -> str | None:
        val = msg.get(key)
        return val.strip() if val else None

    # Received chain
    received_chain: list[str] = [v.strip() for v in msg.get_all("Received") or []]

    # Extract X-Originating-IP
    x_orig_ip = _get("X-Originating-IP") or _get("X-Originating-ip")

    # SPF / DKIM / DMARC from Authentication-Results
    auth_results_raw = _get("Authentication-Results") or ""
    spf_result: str | None = None
    dmarc_result: str | None = None

    spf_match = re.search(r"spf=(\w+)", auth_results_raw, re.IGNORECASE)
    if spf_match:
        spf_result = spf_match.group(1).lower()

    dmarc_match = re.search(r"dmarc=(\w+)", auth_results_raw, re.IGNORECASE)
    if dmarc_match:
        dmarc_result = dmarc_match.group(1).lower()

    dkim_signature_present = bool(_get("DKIM-Signature"))

    # Authentication failures raise risk
    failures = sum(
        [
            spf_result not in (None, "pass"),
            dmarc_result not in (None, "pass"),
            not dkim_signature_present,
        ]
    )
    risk = RiskLevel.medium if failures >= 2 else RiskLevel.low

    return ToolResponse(
        tool="email_analyze_headers",
        input="[email headers]",
        result={
            "from": _get("From"),
            "to": _get("To"),
            "subject": _get("Subject"),
            "date": _get("Date"),
            "message_id": _get("Message-ID"),
            "reply_to": _get("Reply-To"),
            "x_originating_ip": x_orig_ip,
            "received_chain": received_chain,
            "received_hop_count": len(received_chain),
            "dkim_signature_present": dkim_signature_present,
            "spf_result": spf_result,
            "dmarc_result": dmarc_result,
            "authentication_results_raw": auth_results_raw or None,
            "authentication_failures": failures,
        },
        risk_level=risk,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )
