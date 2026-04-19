from datetime import datetime, timezone
from typing import Optional

import phonenumbers
import phonenumbers.carrier
import phonenumbers.geocoder
import phonenumbers.timezone as pn_timezone
from fastapi import APIRouter, HTTPException, Request
from phonenumbers import NumberParseException, PhoneNumberFormat, PhoneNumberType

from models.schemas import (
    DISCLAIMER,
    PhoneFormatRequest,
    PhoneLookupRequest,
    RiskLevel,
    ToolResponse,
)
from utils.rate_limit import limiter
from utils.sanitize import sanitize_phone

router = APIRouter(prefix="/phone", tags=["Phone"])

NUMBER_TYPE_MAP: dict[PhoneNumberType, str] = {
    PhoneNumberType.MOBILE: "MOBILE",
    PhoneNumberType.FIXED_LINE: "FIXED_LINE",
    PhoneNumberType.FIXED_LINE_OR_MOBILE: "FIXED_LINE_OR_MOBILE",
    PhoneNumberType.TOLL_FREE: "TOLL_FREE",
    PhoneNumberType.PREMIUM_RATE: "PREMIUM_RATE",
    PhoneNumberType.SHARED_COST: "SHARED_COST",
    PhoneNumberType.VOIP: "VOIP",
    PhoneNumberType.PERSONAL_NUMBER: "PERSONAL_NUMBER",
    PhoneNumberType.PAGER: "PAGER",
    PhoneNumberType.UAN: "UAN",
    PhoneNumberType.VOICEMAIL: "VOICEMAIL",
    PhoneNumberType.UNKNOWN: "UNKNOWN",
}


def _parse_phone(phone: str, country_code: str):
    """Parse phone number and raise HTTPException on failure."""
    try:
        number = phonenumbers.parse(phone, country_code.upper() or "US")
    except NumberParseException as exc:
        raise HTTPException(status_code=422, detail=f"Invalid phone number: {exc}")
    return number


@router.post("/lookup", response_model=ToolResponse)
@limiter.limit("20/minute")
async def phone_lookup(request: Request, body: PhoneLookupRequest) -> ToolResponse:
    phone = sanitize_phone(body.phone)
    region = body.country_code.upper() if body.country_code else "US"
    number = _parse_phone(phone, region)

    is_valid = phonenumbers.is_valid_number(number)
    is_possible = phonenumbers.is_possible_number(number)

    number_type = NUMBER_TYPE_MAP.get(phonenumbers.number_type(number), "UNKNOWN")
    carrier_name = phonenumbers.carrier.name_for_number(number, "en") or None
    geo_desc = phonenumbers.geocoder.description_for_number(number, "en") or None
    timezones = list(pn_timezone.time_zones_for_number(number))

    e164 = phonenumbers.format_number(number, PhoneNumberFormat.E164) if is_valid else None
    intl = phonenumbers.format_number(number, PhoneNumberFormat.INTERNATIONAL) if is_valid else None
    natl = phonenumbers.format_number(number, PhoneNumberFormat.NATIONAL) if is_valid else None

    return ToolResponse(
        tool="phone_lookup",
        input=phone,
        result={
            "input": phone,
            "country_code_hint": region,
            "is_valid": is_valid,
            "is_possible": is_possible,
            "country_code": number.country_code,
            "national_number": str(number.national_number),
            "international_format": intl,
            "national_format": natl,
            "e164_format": e164,
            "number_type": number_type,
            "carrier": carrier_name,
            "geocoder_description": geo_desc,
            "timezones": timezones,
        },
        risk_level=RiskLevel.low,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )


@router.post("/format", response_model=ToolResponse)
@limiter.limit("30/minute")
async def phone_format(request: Request, body: PhoneFormatRequest) -> ToolResponse:
    phone = sanitize_phone(body.phone)
    region = body.country_code.upper() if body.country_code else "US"
    number = _parse_phone(phone, region)

    is_valid = phonenumbers.is_valid_number(number)

    formats: dict[str, str | None] = {
        "e164": None,
        "international": None,
        "national": None,
        "rfc3966": None,
    }

    if is_valid:
        formats["e164"] = phonenumbers.format_number(number, PhoneNumberFormat.E164)
        formats["international"] = phonenumbers.format_number(
            number, PhoneNumberFormat.INTERNATIONAL
        )
        formats["national"] = phonenumbers.format_number(number, PhoneNumberFormat.NATIONAL)
        formats["rfc3966"] = phonenumbers.format_number(number, PhoneNumberFormat.RFC3966)

    # Country name from region code
    region_code = phonenumbers.region_code_for_number(number)
    country_name: str | None = None
    if region_code:
        try:
            import pycountry  # type: ignore
            c = pycountry.countries.get(alpha_2=region_code)
            country_name = c.name if c else region_code
        except ImportError:
            country_name = region_code

    return ToolResponse(
        tool="phone_format",
        input=phone,
        result={
            "input": phone,
            "is_valid": is_valid,
            "country_code": number.country_code,
            "region_code": region_code,
            "country_name": country_name,
            "formats": formats,
        },
        risk_level=RiskLevel.low,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )
