from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, field_validator


class RiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


DISCLAIMER = (
    "This tool is for authorized security research only. "
    "Unauthorized use is illegal."
)


class ToolResponse(BaseModel):
    tool: str
    input: str
    result: dict[str, Any]
    risk_level: RiskLevel
    disclaimer: str = DISCLAIMER
    timestamp: datetime


# ── Email ──────────────────────────────────────────────────────────────────────

class EmailBreachRequest(BaseModel):
    email: EmailStr


class EmailVerifyRequest(BaseModel):
    email: EmailStr


class EmailHeadersRequest(BaseModel):
    headers: str


# ── Domain ─────────────────────────────────────────────────────────────────────

class DnsLookupRequest(BaseModel):
    domain: str
    record_types: list[str] = ["A", "AAAA", "MX", "TXT", "NS", "CNAME"]

    @field_validator("record_types")
    @classmethod
    def validate_record_types(cls, v: list[str]) -> list[str]:
        allowed = {"A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA", "PTR", "SRV"}
        return [rt.upper() for rt in v if rt.upper() in allowed] or ["A"]


class WhoisRequest(BaseModel):
    domain: str


class SslCertRequest(BaseModel):
    domain: str
    port: int = 443

    @field_validator("port")
    @classmethod
    def validate_port(cls, v: int) -> int:
        if not (1 <= v <= 65535):
            raise ValueError("Port must be between 1 and 65535")
        return v


class SubdomainRequest(BaseModel):
    domain: str


# ── IP ─────────────────────────────────────────────────────────────────────────

class IpGeolocateRequest(BaseModel):
    ip: str


class IpReputationRequest(BaseModel):
    ip: str


class PortScanRequest(BaseModel):
    ip: str
    ports: Optional[list[int]] = None

    @field_validator("ports")
    @classmethod
    def validate_ports(cls, v: Optional[list[int]]) -> Optional[list[int]]:
        if v is None:
            return v
        return [p for p in v if 1 <= p <= 65535]


# ── Username ───────────────────────────────────────────────────────────────────

class UsernameCheckRequest(BaseModel):
    username: str


# ── Phone ──────────────────────────────────────────────────────────────────────

class PhoneLookupRequest(BaseModel):
    phone: str
    country_code: str = "US"


class PhoneFormatRequest(BaseModel):
    phone: str
    country_code: str = "US"


# ── Social ─────────────────────────────────────────────────────────────────────

class GithubOsintRequest(BaseModel):
    username: str


class PasswordStrengthRequest(BaseModel):
    password: str
