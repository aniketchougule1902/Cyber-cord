import io
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from PIL import ExifTags, Image

from models.schemas import DISCLAIMER, RiskLevel, ToolResponse
from utils.rate_limit import limiter

router = APIRouter(prefix="/metadata", tags=["Metadata"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

# GPS IFD tag number
GPS_IFD_TAG = 0x8825


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
    """Extract EXIF data from a Pillow Image object."""
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
                def _dms_to_dd(dms_list, ref: str) -> float:
                    d = dms_list[0]
                    m = dms_list[1]
                    s = dms_list[2]
                    dd = d + m / 60.0 + s / 3600.0
                    if ref in ("S", "W"):
                        dd = -dd
                    return round(dd, 7)

                gps_latitude = _dms_to_dd(lat_dms, str(lat_ref))
                gps_longitude = _dms_to_dd(lon_dms, str(lon_ref))

            if alt_val is not None:
                gps_altitude = round(float(alt_val) * (-1 if alt_ref == 1 else 1), 2)
        except Exception:
            pass

    def _safe_ratio(val):
        if val is None:
            return None
        if isinstance(val, list) and len(val) == 2 and val[1] != 0:
            return round(val[0] / val[1], 6)
        if isinstance(val, (int, float)):
            return val
        return None

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
