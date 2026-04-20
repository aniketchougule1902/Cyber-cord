import base64
import io
import ipaddress
import socket
import urllib.parse
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from PIL import ExifTags, Image

from models.schemas import DISCLAIMER, MetadataUrlRequest, RiskLevel, ToolResponse
from utils.rate_limit import limiter

router = APIRouter(prefix="/metadata", tags=["Metadata"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

# GPS IFD tag number
GPS_IFD_TAG = 0x8825


def _dms_to_dd(dms_list: list, ref: str) -> float:
    """Convert GPS DMS (degrees/minutes/seconds) list + hemisphere ref to decimal degrees."""
    d, m, s = dms_list[0], dms_list[1], dms_list[2]
    dd = d + m / 60.0 + s / 3600.0
    if ref in ("S", "W"):
        dd = -dd
    return round(dd, 7)


def _safe_ratio(val: Any) -> float | None:
    """Convert a ratio-like value to a float, returning None if not possible."""
    if val is None:
        return None
    if isinstance(val, list) and len(val) == 2 and val[1] != 0:
        return round(val[0] / val[1], 6)
    if isinstance(val, (int, float)):
        return val
    return None


def _validate_url_for_ssrf(url: str) -> None:
    """Raise HTTPException 422 if *url* resolves to a private / loopback address."""
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid URL: {exc}")

    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=422, detail="Only http and https URLs are supported.")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=422, detail="URL has no resolvable hostname.")

    try:
        # getaddrinfo resolves both IPv4 and IPv6, preventing bypass via IPv6 literals
        addr_infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise HTTPException(status_code=422, detail=f"Cannot resolve hostname '{hostname}': {exc}")

    for addr_info in addr_infos:
        ip_str = addr_info[4][0]
        try:
            addr = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
            raise HTTPException(
                status_code=422,
                detail="URL resolves to a private or internal network address.",
            )


def _convert_to_degrees(value) -> float:
    """Convert GPS DMS tuple from EXIF to decimal degrees."""
    def _ratio(r):
        if hasattr(r, "numerator"):
            return r.numerator / r.denominator if r.denominator else 0.0
        if isinstance(r, tuple) and len(r) == 2:
            return r[0] / r[1] if r[1] else 0.0
        return float(r)

    d = _ratio(value[0])
    m = _ratio(value[1])
    s = _ratio(value[2])
    return d + (m / 60.0) + (s / 3600.0)


def _extract_exif(image: Image.Image) -> dict[str, Any]:
    """Extract EXIF data from a Pillow Image object using the public API."""
    raw_exif: dict | None = None
    try:
        # Public API (Pillow >= 6.0): returns an Exif object that behaves like a dict
        exif_obj = image.getexif()
        if exif_obj:
            raw_exif = dict(exif_obj)
    except (AttributeError, Exception):
        pass

    # Fallback to private _getexif() for older Pillow builds
    if raw_exif is None:
        try:
            raw_exif = image._getexif()  # type: ignore[attr-defined]
        except (AttributeError, Exception):
            raw_exif = None

    if not raw_exif:
        return {}

    tag_name_map = {v: k for k, v in ExifTags.TAGS.items()}
    gps_tag_map = {v: k for k, v in ExifTags.GPSTAGS.items()}

    meta: dict[str, Any] = {}
    gps_info: dict[str, Any] = {}

    for tag_id, value in raw_exif.items():
        tag = ExifTags.TAGS.get(tag_id, str(tag_id))

        if tag_id == GPS_IFD_TAG and isinstance(value, dict):
            for gps_tag_id, gps_val in value.items():
                gps_tag = ExifTags.GPSTAGS.get(gps_tag_id, str(gps_tag_id))
                # Serialize tuples/fractions to plain types
                if isinstance(gps_val, tuple):
                    gps_info[gps_tag] = [
                        (v.numerator / v.denominator if hasattr(v, "numerator") and v.denominator else str(v))
                        for v in gps_val
                    ]
                elif hasattr(gps_val, "numerator"):
                    gps_info[gps_tag] = (
                        gps_val.numerator / gps_val.denominator
                        if gps_val.denominator
                        else 0.0
                    )
                else:
                    gps_info[gps_tag] = str(gps_val) if not isinstance(gps_val, (int, float, str, bool)) else gps_val
            continue

        # Serialize value
        if isinstance(value, bytes):
            try:
                meta[tag] = value.decode("utf-8", errors="replace")
            except Exception:
                meta[tag] = value.hex()
        elif isinstance(value, tuple):
            meta[tag] = [
                (v.numerator / v.denominator if hasattr(v, "numerator") and v.denominator else str(v))
                for v in value
            ]
        elif hasattr(value, "numerator"):
            meta[tag] = value.numerator / value.denominator if value.denominator else 0.0
        elif not isinstance(value, (int, float, str, bool, type(None))):
            meta[tag] = str(value)
        else:
            meta[tag] = value

    return {"exif": meta, "gps_raw": gps_info}


@router.post("/extract", response_model=ToolResponse)
@limiter.limit("10/minute")
async def extract_metadata(
    request: Request, file: UploadFile = File(...)
) -> ToolResponse:
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Only images are accepted.",
        )

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB).")

    try:
        image = Image.open(io.BytesIO(data))
        image.verify()
        image = Image.open(io.BytesIO(data))
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Cannot open image: {exc}")

    raw = _extract_exif(image)
    exif = raw.get("exif", {})
    gps_raw = raw.get("gps_raw", {})

    gps_latitude: float | None = None
    gps_longitude: float | None = None
    gps_altitude: float | None = None

    if gps_raw:
        try:
            lat_dms = gps_raw.get("GPSLatitude")
            lat_ref = gps_raw.get("GPSLatitudeRef", "N")
            lon_dms = gps_raw.get("GPSLongitude")
            lon_ref = gps_raw.get("GPSLongitudeRef", "E")
            alt_val = gps_raw.get("GPSAltitude")
            alt_ref = gps_raw.get("GPSAltitudeRef", 0)

            if lat_dms and lon_dms:
                gps_latitude = _dms_to_dd(lat_dms, str(lat_ref))
                gps_longitude = _dms_to_dd(lon_dms, str(lon_ref))

            if alt_val is not None:
                gps_altitude = round(float(alt_val) * (-1 if alt_ref == 1 else 1), 2)
        except Exception:
            pass

    result: dict[str, Any] = {
        "filename": file.filename,
        "content_type": content_type,
        "file_size_bytes": len(data),
        "image_width": image.width,
        "image_height": image.height,
        "image_format": image.format,
        "image_mode": image.mode,
        "make": exif.get("Make"),
        "model": exif.get("Model"),
        "software": exif.get("Software"),
        "datetime": exif.get("DateTime") or exif.get("DateTimeOriginal"),
        "gps_latitude": gps_latitude,
        "gps_longitude": gps_longitude,
        "gps_altitude": gps_altitude,
        "gps_found": gps_latitude is not None and gps_longitude is not None,
        "color_space": exif.get("ColorSpace"),
        "flash": exif.get("Flash"),
        "focal_length": _safe_ratio(exif.get("FocalLength")),
        "exposure_time": _safe_ratio(exif.get("ExposureTime")),
        "f_number": _safe_ratio(exif.get("FNumber")),
        "iso": exif.get("ISOSpeedRatings") or exif.get("ISO"),
        "orientation": exif.get("Orientation"),
        "artist": exif.get("Artist"),
        "copyright": exif.get("Copyright"),
        "gps_raw": gps_raw if gps_raw else None,
        "warnings": [],
    }

    if result["gps_found"]:
        result["warnings"].append(
            "⚠️ GPS coordinates found in image metadata. "
            "This reveals the exact location where the photo was taken. "
            "Remove EXIF data before sharing images publicly."
        )
        risk = RiskLevel.high
    else:
        risk = RiskLevel.medium

    return ToolResponse(
        tool="metadata_extract",
        input=file.filename or "uploaded_image",
        result=result,
        risk_level=risk,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )


def _build_metadata_result(image: Image.Image, source_name: str) -> tuple[dict[str, Any], "RiskLevel"]:
    """Shared helper: extract EXIF from a Pillow image and return (result, risk)."""
    raw = _extract_exif(image)
    exif = raw.get("exif", {})
    gps_raw = raw.get("gps_raw", {})

    gps_latitude: float | None = None
    gps_longitude: float | None = None
    gps_altitude: float | None = None

    if gps_raw:
        try:
            lat_dms = gps_raw.get("GPSLatitude")
            lat_ref = gps_raw.get("GPSLatitudeRef", "N")
            lon_dms = gps_raw.get("GPSLongitude")
            lon_ref = gps_raw.get("GPSLongitudeRef", "E")
            alt_val = gps_raw.get("GPSAltitude")
            alt_ref = gps_raw.get("GPSAltitudeRef", 0)

            if lat_dms and lon_dms:
                gps_latitude = _dms_to_dd(lat_dms, str(lat_ref))
                gps_longitude = _dms_to_dd(lon_dms, str(lon_ref))

            if alt_val is not None:
                gps_altitude = round(float(alt_val) * (-1 if alt_ref == 1 else 1), 2)
        except Exception:
            pass

    result: dict[str, Any] = {
        "source": source_name,
        "content_type": image.format or "unknown",
        "image_width": image.width,
        "image_height": image.height,
        "image_format": image.format,
        "image_mode": image.mode,
        "make": exif.get("Make"),
        "model": exif.get("Model"),
        "software": exif.get("Software"),
        "datetime": exif.get("DateTime") or exif.get("DateTimeOriginal"),
        "gps_latitude": gps_latitude,
        "gps_longitude": gps_longitude,
        "gps_altitude": gps_altitude,
        "gps_found": gps_latitude is not None and gps_longitude is not None,
        "color_space": exif.get("ColorSpace"),
        "flash": exif.get("Flash"),
        "focal_length": _safe_ratio(exif.get("FocalLength")),
        "exposure_time": _safe_ratio(exif.get("ExposureTime")),
        "f_number": _safe_ratio(exif.get("FNumber")),
        "iso": exif.get("ISOSpeedRatings") or exif.get("ISO"),
        "orientation": exif.get("Orientation"),
        "artist": exif.get("Artist"),
        "copyright": exif.get("Copyright"),
        "gps_raw": gps_raw if gps_raw else None,
        "warnings": [],
    }

    if result["gps_found"]:
        result["warnings"].append(
            "⚠️ GPS coordinates found in image metadata. "
            "This reveals the exact location where the photo was taken. "
            "Remove EXIF data before sharing images publicly."
        )
        risk = RiskLevel.high
    else:
        risk = RiskLevel.medium

    return result, risk


@router.post("/extract-url", response_model=ToolResponse)
@limiter.limit("10/minute")
async def extract_metadata_url(
    request: Request, body: MetadataUrlRequest
) -> ToolResponse:
    """Extract image metadata from a URL or a base64-encoded file."""
    if not body.url and not body.file_base64:
        raise HTTPException(
            status_code=422,
            detail="Provide either 'url' or 'file_base64'.",
        )

    data: bytes | None = None
    source_name: str = "uploaded_image"

    if body.url:
        url = body.url.strip()
        source_name = url.split("?")[0].split("/")[-1] or url
        _validate_url_for_ssrf(url)
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.content
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {exc}")
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=502, detail=f"URL returned error: {exc}")
    elif body.file_base64:
        try:
            data = base64.b64decode(body.file_base64)
        except Exception:
            raise HTTPException(status_code=422, detail="Invalid base64 data.")

    if not data:
        raise HTTPException(status_code=422, detail="No image data received.")

    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB).")

    try:
        image = Image.open(io.BytesIO(data))
        image.verify()
        image = Image.open(io.BytesIO(data))
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Cannot open image: {exc}")

    result, risk = _build_metadata_result(image, source_name)
    result["file_size_bytes"] = len(data)

    return ToolResponse(
        tool="metadata_extract",
        input=source_name,
        result=result,
        risk_level=risk,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )
