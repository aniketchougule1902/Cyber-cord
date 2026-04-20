import asyncio
import socket
import ssl
from datetime import datetime, timezone
from typing import Optional

import dns.resolver
import dns.exception
import httpx
import whois
from fastapi import APIRouter, HTTPException, Request

from models.schemas import (
    DISCLAIMER,
    DnsLookupRequest,
    SslCertRequest,
    SubdomainRequest,
    WhoisRequest,
    RiskLevel,
    ToolResponse,
)
from utils.rate_limit import limiter
from utils.sanitize import sanitize_domain

router = APIRouter(prefix="/domain", tags=["Domain"])

SUBDOMAIN_WORDLIST = [
    "www", "mail", "ftp", "admin", "api", "dev", "staging", "test", "vpn",
    "remote", "secure", "blog", "shop", "portal", "cdn", "static", "media",
    "images", "assets", "docs", "support", "help", "status", "monitor",
    "dashboard", "login", "app", "mobile", "beta", "preview", "git",
    "gitlab", "github", "jenkins", "ci", "jira", "confluence", "wiki",
    "kb", "crm", "erp", "mx", "smtp", "pop", "imap", "webmail", "mail2",
    "ns1", "ns2",
]


@router.post("/dns-lookup", response_model=ToolResponse)
@limiter.limit("30/minute")
async def dns_lookup(request: Request, body: DnsLookupRequest) -> ToolResponse:
    try:
        domain = sanitize_domain(body.domain)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    results: dict[str, list[str]] = {}
    loop = asyncio.get_event_loop()

    async def _query(rtype: str) -> tuple[str, list[str]]:
        try:
            answers = await loop.run_in_executor(
                None, lambda: dns.resolver.resolve(domain, rtype)
            )
            records: list[str] = []
            for rdata in answers:
                if rtype == "MX":
                    records.append(f"{rdata.preference} {str(rdata.exchange).rstrip('.')}")
                else:
                    records.append(str(rdata).rstrip("."))
            return rtype, records
        except dns.resolver.NXDOMAIN:
            return rtype, []
        except dns.resolver.NoAnswer:
            return rtype, []
        except dns.exception.DNSException:
            return rtype, []

    tasks = [_query(rt) for rt in body.record_types]
    pairs = await asyncio.gather(*tasks)
    for rtype, records in pairs:
        results[rtype] = records

    return ToolResponse(
        tool="dns_lookup",
        input=domain,
        result={"domain": domain, "records": results},
        risk_level=RiskLevel.low,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )


@router.post("/whois", response_model=ToolResponse)
@limiter.limit("15/minute")
async def whois_lookup(request: Request, body: WhoisRequest) -> ToolResponse:
    try:
        domain = sanitize_domain(body.domain)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    loop = asyncio.get_event_loop()
    try:
        w = await loop.run_in_executor(None, lambda: whois.whois(domain))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"WHOIS lookup failed: {exc}")

    def _serialize(val):
        if isinstance(val, list):
            return [_serialize(v) for v in val]
        if isinstance(val, datetime):
            return val.isoformat()
        return val

    result = {
        "domain": domain,
        "registrar": _serialize(w.registrar),
        "creation_date": _serialize(w.creation_date),
        "expiration_date": _serialize(w.expiration_date),
        "updated_date": _serialize(w.updated_date),
        "name_servers": _serialize(w.name_servers),
        "status": _serialize(w.status),
        "emails": _serialize(w.emails),
        "country": _serialize(w.country),
        "dnssec": _serialize(w.dnssec),
        "org": _serialize(getattr(w, "org", None)),
        "name": _serialize(getattr(w, "name", None)),
    }

    return ToolResponse(
        tool="whois_lookup",
        input=domain,
        result=result,
        risk_level=RiskLevel.low,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )


@router.post("/ssl-cert", response_model=ToolResponse)
@limiter.limit("20/minute")
async def ssl_cert(request: Request, body: SslCertRequest) -> ToolResponse:
    try:
        host = sanitize_domain(body.host)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    port = body.port
    loop = asyncio.get_event_loop()

    def _fetch_cert() -> dict:
        ctx = ssl.create_default_context()
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        conn = ctx.wrap_socket(
            socket.create_connection((host, port), timeout=10),
            server_hostname=host,
        )
        try:
            cert = conn.getpeercert()
        finally:
            conn.close()
        return cert

    def _fetch_cert_no_verify() -> dict:
        ctx = ssl.create_default_context()
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        conn = ctx.wrap_socket(
            socket.create_connection((host, port), timeout=10),
            server_hostname=host,
        )
        try:
            cert = conn.getpeercert()
        finally:
            conn.close()
        return cert

    cert: dict | None = None
    is_self_signed = False
    try:
        cert = await loop.run_in_executor(None, _fetch_cert)
    except ssl.SSLCertVerificationError:
        is_self_signed = True
        try:
            cert = await loop.run_in_executor(None, _fetch_cert_no_verify)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"SSL error: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Connection error: {exc}")

    if not cert:
        raise HTTPException(status_code=502, detail="Could not retrieve certificate.")

    def _parse_dn(dn_tuple) -> dict[str, str]:
        result: dict[str, str] = {}
        if not dn_tuple:
            return result
        for pair in dn_tuple:
            for k, v in pair:
                result[k] = v
        return result

    subject = _parse_dn(cert.get("subject", ()))
    issuer = _parse_dn(cert.get("issuer", ()))

    if subject == issuer:
        is_self_signed = True

    not_before_str = cert.get("notBefore", "")
    not_after_str = cert.get("notAfter", "")

    not_after_dt: datetime | None = None
    try:
        not_after_dt = datetime.strptime(not_after_str, "%b %d %H:%M:%S %Y %Z")
        not_after_dt = not_after_dt.replace(tzinfo=timezone.utc)
    except ValueError:
        pass

    now = datetime.now(timezone.utc)
    days_until_expiry: int | None = None
    is_expired = False
    if not_after_dt:
        delta = (not_after_dt - now).days
        days_until_expiry = delta
        is_expired = delta < 0

    # Subject Alternative Names
    san_list: list[str] = []
    for san_type, san_value in cert.get("subjectAltName", ()):
        san_list.append(f"{san_type}:{san_value}")

    return ToolResponse(
        tool="ssl_cert",
        input=f"{host}:{port}",
        result={
            "host": host,
            "port": port,
            "subject": subject,
            "issuer": issuer,
            "version": cert.get("version"),
            "serial_number": cert.get("serialNumber"),
            "not_before": not_before_str,
            "not_after": not_after_str,
            "san": san_list,
            "signature_algorithm": cert.get("signatureAlgorithm"),
            "days_until_expiry": days_until_expiry,
            "is_expired": is_expired,
            "is_self_signed": is_self_signed,
            "ocsp": list(cert.get("OCSP", [])),
            "ca_issuers": list(cert.get("caIssuers", [])),
        },
        risk_level=RiskLevel.high if is_expired or is_self_signed else RiskLevel.low,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )


@router.post("/subdomains", response_model=ToolResponse)
@limiter.limit("5/minute")
async def subdomain_enum(request: Request, body: SubdomainRequest) -> ToolResponse:
    try:
        domain = sanitize_domain(body.domain)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    found: list[dict] = []

    async def _check(sub: str) -> None:
        fqdn = f"{sub}.{domain}"
        try:
            loop = asyncio.get_event_loop()
            info = await loop.run_in_executor(None, socket.getaddrinfo, fqdn, None)
            ips = list({addr[4][0] for addr in info})
            found.append({"subdomain": fqdn, "ips": ips, "status": "resolved"})
        except socket.gaierror:
            pass

    semaphore = asyncio.Semaphore(20)

    async def _checked(sub: str) -> None:
        async with semaphore:
            await _check(sub)

    await asyncio.gather(*[_checked(s) for s in SUBDOMAIN_WORDLIST])
    found.sort(key=lambda x: x["subdomain"])

    return ToolResponse(
        tool="subdomain_enum",
        input=domain,
        result={
            "domain": domain,
            "found_count": len(found),
            "subdomains": found,
            "wordlist_size": len(SUBDOMAIN_WORDLIST),
        },
        risk_level=RiskLevel.low,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )
