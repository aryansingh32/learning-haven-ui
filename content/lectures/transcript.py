import os
import sys
import subprocess
import json
from urllib.parse import urlparse, parse_qs
import requests

def install_dependencies():
    """Install required packages if they are not present."""
    try:
        import yt_dlp
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        print("Installing required dependencies (yt-dlp, youtube-transcript-api)...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "yt-dlp", "youtube-transcript-api"])
        import yt_dlp
        from youtube_transcript_api import YouTubeTranscriptApi
        
    return yt_dlp, YouTubeTranscriptApi

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

def get_video_id(url):
    """Extract the video ID from a YouTube URL."""
    parsed = urlparse(url)
    if parsed.hostname == 'youtu.be':
        return parsed.path[1:]
    if parsed.hostname in ('www.youtube.com', 'youtube.com'):
        if parsed.path == '/watch':
            qs = parse_qs(parsed.query)
            return qs.get('v', [None])[0]
    return None

def fetch_and_save_transcript(title, video_url, video_id, out_dir, ytt_api):
    """Fetch the transcript and save it to a text file."""
    safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).rstrip()
    filename = f"{safe_title}_{video_id}.txt".replace(' ', '_')
    filepath = os.path.join(out_dir, filename)
    
    try:
        transcript_list = None
        for attempt in range(3):
            try:
                import time
                transcript_list = ytt_api.list(video_id).find_transcript(['en', 'en-US', 'en-GB', 'en-IN', 'hi', 'es']).fetch()
                break
            except Exception as e:
                if attempt == 2:
                    raise e
                time.sleep(2)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f"Video URL: {video_url}\n")
            f.write(f"Video Title: {title}\n")
            f.write("-" * 50 + "\n\n")
            
            for entry in transcript_list:
                # Format time as HH:MM:SS
                start_time = entry.start
                hours = int(start_time // 3600)
                minutes = int((start_time % 3600) // 60)
                seconds = int(start_time % 60)
                
                if hours > 0:
                    time_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
                else:
                    time_str = f"{minutes:02d}:{seconds:02d}"
                    
                text = entry.text.replace('\n', ' ')
                f.write(f"[{time_str}] {text}\n")
                
        print(f"[SUCCESS] Saved transcript: {filename}")
        
    except Exception as e:
        print(f"[ERROR] Could not fetch transcript for '{title}' ({video_url}): {e}")

def main():
    yt_dlp, YouTubeTranscriptApi = install_dependencies()
    
    playlist_url = input("Enter the YouTube Playlist URL: ").strip()
    if not playlist_url:
        print("No URL provided. Exiting.")
        return
        
    session = requests.Session()
    session.proxies.update({
        "http": "http://deexcpkf:6ugilo2e58p6@p.webshare.io:80",
        "https": "http://deexcpkf:6ugilo2e58p6@p.webshare.io:80"
    })
    ytt_api = YouTubeTranscriptApi(http_client=session)
        
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'transcripts')
    os.makedirs(out_dir, exist_ok=True)
    print(f"Transcripts will be saved to: {out_dir}\n")
    
    videos = get_playlist_videos(playlist_url, yt_dlp)
    print(f"Found {len(videos)} videos in the playlist.\n")
    
    for idx, (title, url) in enumerate(videos, 1):
        # yt-dlp might return a direct video ID or a full url depending on the extraction
        if not url.startswith('http'):
            # It's likely a video ID
            video_url = f"https://www.youtube.com/watch?v={url}"
            video_id = url
        else:
            video_url = url
            video_id = get_video_id(url)
            
        print(f"Processing ({idx}/{len(videos)}): {title}")
        
        if not video_id:
            print(f"[WARNING] Could not parse video ID for {video_url}")
            continue
            
        fetch_and_save_transcript(title, video_url, video_id, out_dir, ytt_api)
        import time
        time.sleep(5)
        
    print("\nAll done!")

if __name__ == "__main__":
    main()