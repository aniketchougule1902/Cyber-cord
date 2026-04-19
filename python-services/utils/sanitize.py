import re
import ipaddress


def sanitize_domain(domain: str) -> str:
    """Strip protocol, www prefix, path, lowercase, and validate domain."""
    domain = domain.strip().lower()
    # Remove protocol
    for prefix in ("https://", "http://", "ftp://"):
        if domain.startswith(prefix):
            domain = domain[len(prefix):]
    # Remove path, query, fragment
    domain = domain.split("/")[0].split("?")[0].split("#")[0]
    # Remove port
    if ":" in domain and not domain.startswith("["):
        domain = domain.rsplit(":", 1)[0]
    # Remove www. prefix (optional normalization)
    if domain.startswith("www."):
        domain = domain[4:]
    # Validate: allow labels of a-z, 0-9, hyphens, dots
    if not re.match(r"^[a-z0-9]([a-z0-9\-\.]*[a-z0-9])?$", domain):
        raise ValueError(f"Invalid domain: {domain!r}")
    if len(domain) > 253:
        raise ValueError("Domain name too long")
    return domain


def sanitize_ip(ip: str) -> str:
    """Strip whitespace and validate IPv4/IPv6 address."""
    ip = ip.strip()
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        raise ValueError(f"Invalid IP address: {ip!r}")
    return str(addr)


def sanitize_email(email: str) -> str:
    """Lowercase and strip whitespace from an email address."""
    return email.strip().lower()


def sanitize_username(username: str) -> str:
    """Allow only alphanumeric characters, underscores, and hyphens; max 50 chars."""
    username = username.strip()
    cleaned = re.sub(r"[^a-zA-Z0-9_\-]", "", username)
    if not cleaned:
        raise ValueError("Username contains no valid characters")
    return cleaned[:50]


def sanitize_phone(phone: str) -> str:
    """Keep only digits and the leading + sign."""
    phone = phone.strip()
    # Preserve leading +
    if phone.startswith("+"):
        digits = re.sub(r"[^\d]", "", phone[1:])
        return "+" + digits
    return re.sub(r"[^\d]", "", phone)
