import asyncio
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request

from models.schemas import (
    DISCLAIMER,
    UsernameCheckRequest,
    RiskLevel,
    ToolResponse,
)
from utils.rate_limit import limiter
from utils.sanitize import sanitize_username

router = APIRouter(prefix="/username", tags=["Username"])

PLATFORMS: list[dict] = [
    {"name": "GitHub", "url": "https://github.com/{}", "method": "GET"},
    {"name": "Twitter/X", "url": "https://x.com/{}", "method": "GET"},
    {"name": "Instagram", "url": "https://www.instagram.com/{}/", "method": "GET"},
    {"name": "Reddit", "url": "https://www.reddit.com/user/{}", "method": "GET"},
    {"name": "LinkedIn", "url": "https://www.linkedin.com/in/{}", "method": "GET"},
    {"name": "YouTube", "url": "https://www.youtube.com/@{}", "method": "GET"},
    {"name": "TikTok", "url": "https://www.tiktok.com/@{}", "method": "GET"},
    {"name": "Twitch", "url": "https://www.twitch.tv/{}", "method": "GET"},
    {"name": "Pinterest", "url": "https://www.pinterest.com/{}/", "method": "GET"},
    {"name": "Tumblr", "url": "https://www.tumblr.com/{}", "method": "GET"},
    {"name": "Medium", "url": "https://medium.com/@{}", "method": "GET"},
    {"name": "Dev.to", "url": "https://dev.to/{}", "method": "GET"},
    {"name": "Hacker News", "url": "https://news.ycombinator.com/user?id={}", "method": "GET"},
    {"name": "ProductHunt", "url": "https://www.producthunt.com/@{}", "method": "GET"},
    {"name": "Keybase", "url": "https://keybase.io/{}", "method": "GET"},
    {"name": "Snapchat", "url": "https://www.snapchat.com/add/{}", "method": "GET"},
    {"name": "Steam", "url": "https://steamcommunity.com/id/{}", "method": "GET"},
    {"name": "Roblox", "url": "https://www.roblox.com/user.aspx?username={}", "method": "GET"},
    {"name": "Spotify", "url": "https://open.spotify.com/user/{}", "method": "GET"},
    {"name": "SoundCloud", "url": "https://soundcloud.com/{}", "method": "GET"},
    {"name": "Bandcamp", "url": "https://{}.bandcamp.com", "method": "GET"},
    {"name": "Behance", "url": "https://www.behance.net/{}", "method": "GET"},
    {"name": "Dribbble", "url": "https://dribbble.com/{}", "method": "GET"},
    {"name": "Fiverr", "url": "https://www.fiverr.com/{}", "method": "GET"},
    {"name": "Upwork", "url": "https://www.upwork.com/freelancers/~{}", "method": "GET"},
    {"name": "Gitlab", "url": "https://gitlab.com/{}", "method": "GET"},
    {"name": "Bitbucket", "url": "https://bitbucket.org/{}", "method": "GET"},
    {"name": "Codepen", "url": "https://codepen.io/{}", "method": "GET"},
    {"name": "Replit", "url": "https://replit.com/@{}", "method": "GET"},
    {"name": "HuggingFace", "url": "https://huggingface.co/{}", "method": "GET"},
    {"name": "Patreon", "url": "https://www.patreon.com/{}", "method": "GET"},
]

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# Platforms that return 200 even for missing profiles need content-based detection
FALSE_POSITIVE_MARKERS: dict[str, str] = {
    "Bandcamp": "Sorry, that something wasn't found",
    "Hacker News": "No such user.",
    "Steam": "The specified profile could not be found",
}


@router.post("/check", response_model=ToolResponse)
@limiter.limit("10/minute")
async def username_check(request: Request, body: UsernameCheckRequest) -> ToolResponse:
    try:
        username = sanitize_username(body.username)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    results: list[dict] = []
    semaphore = asyncio.Semaphore(10)

    async def _check(platform: dict) -> None:
        async with semaphore:
            profile_url = platform["url"].format(username)
            found = False
            status_code: int | None = None
            try:
                async with httpx.AsyncClient(
                    timeout=8,
                    follow_redirects=True,
                    headers=BROWSER_HEADERS,
                ) as client:
                    resp = await client.get(profile_url)
                    status_code = resp.status_code
                    if resp.status_code == 200:
                        marker = FALSE_POSITIVE_MARKERS.get(platform["name"])
                        if marker:
                            found = marker not in resp.text
                        else:
                            found = True
                    elif resp.status_code == 404:
                        found = False
                    else:
                        found = False
            except (httpx.RequestError, httpx.HTTPStatusError):
                pass

            results.append(
                {
                    "platform": platform["name"],
                    "url": platform["url"],
                    "profile_url": profile_url,
                    "found": found,
                    "http_status": status_code,
                }
            )

    await asyncio.gather(*[_check(p) for p in PLATFORMS])
    results.sort(key=lambda x: x["platform"])

    found_count = sum(1 for r in results if r["found"])

    return ToolResponse(
        tool="username_check",
        input=username,
        result={
            "username": username,
            "platforms_checked": len(PLATFORMS),
            "found_count": found_count,
            "platforms": results,
        },
        risk_level=RiskLevel.low,
        disclaimer=DISCLAIMER,
        timestamp=datetime.now(timezone.utc),
    )
