import asyncio
import os
import socket
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request

from models.schemas import (
    DISCLAIMER,
    IpGeolocateRequest,
    IpReputationRequest,
    PortScanRequest,
    RiskLevel,
    ToolResponse,
)
from utils.rate_limit import limiter
from utils.sanitize import sanitize_ip

router = APIRouter(prefix="/ip", tags=["IP"])

ABUSEIPDB_KEY = os.getenv("ABUSEIPDB_API_KEY", "")

# Top 100 common ports
TOP_100_PORTS = [
    21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 993, 995,
    1723, 3306, 3389, 5900, 8080, 8443, 8888, 8008, 8081, 8082, 8083, 8084,
    8085, 8086, 8087, 8088, 8090, 8100, 8200, 8300, 8400, 8500, 8600,
    9000, 9001, 9002, 9090, 9091, 9200, 9300, 9443, 10000,
    20, 69, 79, 109, 161, 162, 194, 389, 427, 464, 465, 500, 512, 513,
    514, 515, 520, 543, 544, 548, 554, 587, 593, 631, 636, 646, 873, 990,
    1025, 1026, 1027, 1028, 1029, 1080, 1194, 1433, 1521, 1900, 2049,
    2082, 2083, 2095, 2096, 2181, 2222, 2375, 2376, 2483, 2484,
    3000, 3001, 3128, 3268, 3269, 4000, 4444, 5000, 5001, 5432, 5672,
]

SERVICE_MAP: dict[int, str] = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
    80: "HTTP", 110: "POP3", 111: "RPCBind", 135: "MSRPC", 139: "NetBIOS",
    143: "IMAP", 443: "HTTPS", 445: "SMB", 465: "SMTPS", 587: "SMTP",
    993: "IMAPS", 995: "POP3S", 1433: "MSSQL", 1521: "Oracle", 1723: "PPTP",
    2049: "NFS", 2082: "cPanel", 2083: "cPanel SSL", 2181: "Zookeeper",
    2375: "Docker", 2376: "Docker TLS", 3000: "Dev/Grafana", 3001: "Dev",
    3128: "Proxy", 3306: "MySQL", 3389: "RDP", 4000: "Dev", 4444: "Metasploit",
    5000: "Flask/Dev", 5432: "PostgreSQL", 5672: "RabbitMQ", 5900: "VNC",
    6379: "Redis", 8080: "HTTP Alt", 8443: "HTTPS Alt", 8888: "Jupyter",
    9000: "PHP-FPM", 9090: "Prometheus", 9200: "Elasticsearch", 9300: "Elasticsearch",
    10000: "Webmin", 27017: "MongoDB",
}


@router.post("/geolocate", response_model=ToolResponse)
@limiter.limit("30/minute")
async def geolocate(request: Request, body: IpGeolocateRequest) -> ToolResponse:
    try:
        ip = sanitize_ip(body.ip)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    fields = (
        "status,message,continent,country,countryCode,region,regionName,"
        "city,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting"
    )
    url = f"http://ip-api.com/json/{ip}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params={"fields": fields})
            resp.raise_for_status()
            data = resp.json()
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Geolocation service error: {exc}")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Geolocation service error: {exc}")

    if data.get("status") == "fail":
        raise HTTPException(status_code=422, detail=data.get("message", "Geolocation failed"))

    risk = RiskLevel.high if data.get("proxy") or data.get("hosting") else RiskLevel.low

    return ToolResponse(
        tool="ip_geolocate",
        input=ip,
        result={
            "ip": ip,
            "continent": data.get("continent"),
            "country": data.get("country"),
            "country_code": data.get("countryCode"),
            "region": data.get("region"),
            "region_name": data.get("regionName"),
            "city": data.get("city"),
            "zip": data.get("zip"),
            "lat": data.get("lat"),
            "lon": data.get("lon"),
            "timezone": data.get("timezone"),
            "isp": data.get("isp"),
            "org": data.get("org"),
            "as": data.get("as"),
            "as_name": data.get("asname"),
            "reverse_dns": data.get("reverse"),
            "is_mobile": data.get("mobile"),
            "is_proxy": data.get("proxy"),
            "is_hosting": data.get("hosting"),
        },
        risk_level=risk,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )


@router.post("/reputation", response_model=ToolResponse)
@limiter.limit("20/minute")
async def reputation(request: Request, body: IpReputationRequest) -> ToolResponse:
    try:
        ip = sanitize_ip(body.ip)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if not ABUSEIPDB_KEY:
        raise HTTPException(
            status_code=503,
            detail="AbuseIPDB API key not configured. Set ABUSEIPDB_API_KEY in environment.",
        )

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.abuseipdb.com/api/v2/check",
                headers={"Key": ABUSEIPDB_KEY, "Accept": "application/json"},
                params={"ipAddress": ip, "maxAgeInDays": "90", "verbose": ""},
            )
            resp.raise_for_status()
            data = resp.json().get("data", {})
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"AbuseIPDB service error: {exc}")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"AbuseIPDB error: {exc}")

    score: int = data.get("abuseConfidenceScore", 0)
    if score >= 80:
        risk = RiskLevel.critical
    elif score >= 50:
        risk = RiskLevel.high
    elif score >= 20:
        risk = RiskLevel.medium
    else:
        risk = RiskLevel.low

    return ToolResponse(
        tool="ip_reputation",
        input=ip,
        result={
            "ip": ip,
            "abuse_confidence_score": score,
            "total_reports": data.get("totalReports"),
            "last_reported_at": data.get("lastReportedAt"),
            "is_public": data.get("isPublic"),
            "ip_version": data.get("ipVersion"),
            "is_whitelisted": data.get("isWhitelisted"),
            "country_code": data.get("countryCode"),
            "usage_type": data.get("usageType"),
            "isp": data.get("isp"),
            "domain": data.get("domain"),
            "num_distinct_users": data.get("numDistinctUsers"),
        },
        risk_level=risk,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )


@router.post("/port-scan", response_model=ToolResponse)
@limiter.limit("5/minute")
async def port_scan(request: Request, body: PortScanRequest) -> ToolResponse:
    try:
        ip = sanitize_ip(body.ip)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    ports_to_scan = body.ports if body.ports else TOP_100_PORTS
    # Cap at 200 ports for safety
    ports_to_scan = ports_to_scan[:200]

    open_ports: list[dict] = []
    semaphore = asyncio.Semaphore(50)

    async def _probe(port: int) -> None:
        async with semaphore:
            try:
                conn = asyncio.open_connection(ip, port)
                reader, writer = await asyncio.wait_for(conn, timeout=1.0)
                writer.close()
                try:
                    await writer.wait_closed()
                except Exception:
                    pass
                service = SERVICE_MAP.get(port, "unknown")
                open_ports.append({"port": port, "state": "open", "service": service})
            except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
                pass

    await asyncio.gather(*[_probe(p) for p in ports_to_scan])
    open_ports.sort(key=lambda x: x["port"])

    if len(open_ports) > 10:
        risk = RiskLevel.high
    elif open_ports:
        risk = RiskLevel.medium
    else:
        risk = RiskLevel.low

    return ToolResponse(
        tool="port_scan",
        input=ip,
        result={
            "ip": ip,
            "ports_scanned": len(ports_to_scan),
            "open_port_count": len(open_ports),
            "open_ports": open_ports,
        },
        risk_level=risk,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )
