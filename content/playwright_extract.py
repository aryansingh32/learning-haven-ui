import sys
import os
import json
import re
import asyncio
from playwright.async_api import async_playwright
from yt_dlp import YoutubeDL

def sanitize_filename(name):
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    return name.strip()

async def get_transcript_playwright(page, video_id):
    url = f"https://www.youtube.com/watch?v={video_id}"
    print(f"Navigating to {url}")
    try:
        await page.goto(url, wait_until="commit", timeout=60000)
        # Wait a bit for the body to populate
        await page.wait_for_timeout(3000)
    except Exception as e:
        print(f"Navigation warning (might still work): {e}")
    
    # Accept cookies if the popup appears (especially in EU)
    try:
        consent_button = page.locator('button[aria-label="Accept all"]')
        if await consent_button.is_visible(timeout=2000):
            await consent_button.click()
    except Exception:
        pass
    
    # We will try a robust approach: Youtube renders the initial player response in a script tag!
    # By extracting ytInitialPlayerResponse, we can bypass UI completely and grab the timedtext URL directly, just like the API does, but using Playwright to bypass 429.
    
    try:
        # Evaluate JavaScript in the page to get the ytInitialPlayerResponse object directly!
        player_response = await page.evaluate("() => { return window.ytInitialPlayerResponse; }")
        
        if player_response and 'captions' in player_response:
            caption_tracks = player_response['captions']['playerCaptionsTracklistRenderer']['captionTracks']
            
            # Find the english track, or auto-generated one if English is not available
            selected_track = None
            for track in caption_tracks:
                if 'en' in track['languageCode']:
                    selected_track = track
                    break
            if not selected_track:
                selected_track = caption_tracks[0] # Fallback to first available
                
            timedtext_url = selected_track['baseUrl']
            
            # Now we use page.evaluate to fetch this URL directly from the browser context!
            # Since the browser is authenticated and passed checks, the fetch will succeed.
            # We append &fmt=json3 to get it in JSON format
            fetch_url = timedtext_url + "&fmt=json3"
            
            transcript_json = await page.evaluate(f'''async () => {{
                const res = await fetch("{fetch_url}");
                const text = await res.text();
                try {{
                    return JSON.parse(text);
                }} catch (e) {{
                    return {{"error": "Not JSON", "text": text.substring(0, 200)}};
                }}
            }}''')
            
            if 'error' in transcript_json:
                print(f"Fetch failed or returned non-JSON. Output snippet: {transcript_json['text']}")
                return None
            
            # Parse the json3 format
            texts = []
            if 'events' in transcript_json:
                for event in transcript_json['events']:
                    if 'segs' in event:
                        for seg in event['segs']:
                            if 'utf8' in seg:
                                texts.append(seg['utf8'])
                                
            if texts:
                cleaned = " ".join([t.replace('\\n', ' ').strip() for t in texts])
                cleaned = re.sub(r'\\s+', ' ', cleaned).strip()
                return cleaned
                
        print("No captions found in ytInitialPlayerResponse.")
        
    except Exception as e:
        print(f"Failed to extract via ytInitialPlayerResponse: {e}")
        
    return None

async def main():
    urls = sys.argv[1:]
    if not urls:
        print("Usage: python playwright_extract.py <playlist_or_video_url>")
        sys.exit(1)
        
    # Get videos using yt-dlp
    ydl_opts = {'extract_flat': True, 'quiet': True}
    videos = []
    print(f"Extracting playlist/video info for {len(urls)} URL(s)...")
    with YoutubeDL(ydl_opts) as ydl:
        for url in urls:
            try:
                info = ydl.extract_info(url, download=False)
                if 'entries' in info:
                    for entry in info['entries']:
                        if entry:
                            videos.append({'id': entry['id'], 'title': entry.get('title', entry['id'])})
                else:
                    videos.append({'id': info['id'], 'title': info.get('title', info['id'])})
            except Exception as e:
                print(f"yt-dlp error for {url}: {e}")
                
    if not videos:
        print("No videos found.")
        return
        
    print(f"Found {len(videos)} videos. Starting Playwright extractor...")

    script_dir = os.path.dirname(os.path.abspath(__file__))

    async with async_playwright() as p:
        # Launch headless browser
        browser = await p.chromium.launch(headless=False)
        # Using a standard user agent to avoid bot detection
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        for idx, video in enumerate(videos, 1):
            title = video['title']
            print(f"\n[{idx}/{len(videos)}] Processing '{title}'...")
            
            text = await get_transcript_playwright(page, video['id'])
            if text:
                filename = os.path.join(script_dir, sanitize_filename(title) + ".txt")
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(text)
                print(f"Successfully saved transcript to '{filename}'.")
            else:
                print(f"Failed to extract transcript for '{title}'. (It might not have subtitles)")
                
            # Wait a few seconds between requests to avoid rate limits
            await asyncio.sleep(2)
            
        await browser.close()
        print("\nFinished processing all videos.")

if __name__ == "__main__":
    asyncio.run(main())
