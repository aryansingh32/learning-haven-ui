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

async def get_transcript_ui(page, video_id):
    url = f"https://www.youtube.com/watch?v={video_id}"
    print(f"Navigating to {url}")
    
    try:
        await page.goto(url, wait_until="commit", timeout=60000)
    except Exception as e:
        print(f"Navigation warning: {e}")
        
    # Wait for the main page to load
    await page.wait_for_timeout(3000)
    
    # Accept cookies if popup appears
    try:
        consent_button = page.locator('button[aria-label="Accept all"]')
        if await consent_button.is_visible(timeout=3000):
            await consent_button.click()
    except Exception:
        pass
        
    try:
        # Find the description expand button
        print("Looking for description expand button...")
        expand_btn = page.locator('tp-yt-paper-button#expand')
        await expand_btn.wait_for(state="visible", timeout=15000)
        await expand_btn.first.click()
        
        await page.wait_for_timeout(2000)
        
        print("Looking for 'Show transcript' button...")
        transcript_btn = page.locator('button[aria-label="Show transcript"]')
        if await transcript_btn.is_visible():
            await transcript_btn.click()
        else:
            # Alternate locator
            transcript_btn = page.locator('ytd-button-renderer:has-text("Show transcript") button')
            if await transcript_btn.is_visible():
                await transcript_btn.click()
            else:
                print("Could not find transcript button in UI.")
                return None
                
        # Wait for the transcript segments to load in the sidebar
        print("Waiting for transcript text to load...")
        await page.wait_for_selector('ytd-transcript-segment-renderer', timeout=15000)
        
        segments = await page.locator('ytd-transcript-segment-renderer yt-formatted-string.ytd-transcript-segment-renderer').all_text_contents()
        
        if segments:
            cleaned = " ".join([s.replace('\\n', ' ').strip() for s in segments])
            cleaned = re.sub(r'\\s+', ' ', cleaned).strip()
            return cleaned
            
    except Exception as e:
        print(f"UI extraction failed: {e}")
        
    return None

async def main():
    urls = sys.argv[1:]
    if not urls:
        print("Usage: python ui_extract.py <playlist_or_video_url>")
        sys.exit(1)
        
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
        
    print(f"Found {len(videos)} videos. Starting Playwright UI extractor...")

    script_dir = os.path.dirname(os.path.abspath(__file__))

    async with async_playwright() as p:
        # Launch visible browser so we avoid headless detection and user can see
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 720},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        for idx, video in enumerate(videos, 1):
            title = video['title']
            print(f"\n[{idx}/{len(videos)}] Processing '{title}'...")
            
            text = await get_transcript_ui(page, video['id'])
            if text:
                filename = os.path.join(script_dir, sanitize_filename(title) + ".txt")
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(text)
                print(f"Successfully saved transcript to '{filename}'.")
            else:
                print(f"Failed to extract transcript for '{title}'.")
                
            await asyncio.sleep(2)
            
        await browser.close()
        print("\nFinished processing all videos.")

if __name__ == "__main__":
    asyncio.run(main())
