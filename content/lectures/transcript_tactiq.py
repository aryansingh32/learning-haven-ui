import os
import sys
import subprocess
from urllib.parse import urlparse, parse_qs

def install_dependencies():
    """Install required packages if they are not present."""
    try:
        import yt_dlp
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Installing required dependencies (yt-dlp, playwright)...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "yt-dlp", "playwright"])
        print("Installing Playwright browsers...")
        subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
        import yt_dlp
        from playwright.sync_api import sync_playwright
        
    return yt_dlp, sync_playwright

def get_playlist_videos(playlist_url, yt_dlp):
    """Extract all video URLs from a playlist using yt-dlp."""
    print(f"Fetching videos from playlist: {playlist_url}")
    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(playlist_url, download=False)
        
        if 'entries' not in info:
            print("Could not find any videos. Please check the playlist URL.")
            return []
            
        videos = []
        for entry in info['entries']:
            if entry.get('url'):
                video_url = entry['url']
                title = entry.get('title', 'Unknown Title')
                videos.append((title, video_url))
                
        return videos

def fetch_and_save_transcript_tactiq(title, video_url, video_id, out_dir, page):
    """Fetch the transcript from Tactiq and save it to a text file."""
    safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).rstrip()
    filename = f"{safe_title}_{video_id}.txt".replace(' ', '_')
    filepath = os.path.join(out_dir, filename)
    
    tactiq_url = f"https://tactiq.io/tools/run/youtube_transcript?yt={video_url}"
    print(f"  -> Navigating to Tactiq for {title}...")
    
    try:
        page.goto(tactiq_url, wait_until="domcontentloaded", timeout=30000)
        
        # Wait for the transcript container to appear and populate
        page.wait_for_selector('#transcript', timeout=30000)
        
        # Sometimes it takes a moment for the transcript text to actually render inside the div
        for _ in range(60):
            try:
                if len(page.locator('#transcript').inner_text()) > 50:
                    break
            except Exception:
                pass
            page.wait_for_timeout(1000)
        
        transcript_text = page.locator('#transcript').inner_text()
        
        if not transcript_text or "Sorry, we couldn't" in transcript_text:
            print(f"[ERROR] Tactiq could not generate transcript for '{title}'.")
            return
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f"Video URL: {video_url}\n")
            f.write(f"Video Title: {title}\n")
            f.write("-" * 50 + "\n\n")
            f.write(transcript_text)
                
        print(f"[SUCCESS] Saved transcript: {filename}")
        
    except Exception as e:
        print(f"[ERROR] Could not fetch transcript from Tactiq for '{title}': {e}")

def main():
    yt_dlp, sync_playwright_func = install_dependencies()
    
    playlist_url = input("Enter the YouTube Playlist URL: ").strip()
    if not playlist_url:
        print("No URL provided. Exiting.")
        return
        
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'transcripts_tactiq')
    os.makedirs(out_dir, exist_ok=True)
    print(f"Transcripts will be saved to: {out_dir}\n")
    
    videos = get_playlist_videos(playlist_url, yt_dlp)
    print(f"Found {len(videos)} videos in the playlist.\n")
    
    print("Launching browser for Tactiq extraction...")
    with sync_playwright_func() as p:
        # Launching browser (headed mode sometimes helps bypass Cloudflare slightly better, but let's try headless)
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        
        for idx, (title, url) in enumerate(videos, 1):
            if not url.startswith('http'):
                video_url = f"https://www.youtube.com/watch?v={url}"
                video_id = url
            else:
                video_url = url
                video_id = url.split("v=")[-1].split("&")[0] if "v=" in url else url.split("/")[-1]
                
            print(f"\nProcessing ({idx}/{len(videos)}): {title}")
            
            fetch_and_save_transcript_tactiq(title, video_url, video_id, out_dir, page)
            
        browser.close()
        
    print("\nAll done!")

if __name__ == "__main__":
    main()
