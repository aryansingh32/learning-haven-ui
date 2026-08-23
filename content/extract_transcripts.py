import sys
import subprocess
import json
import re
import os
import html
from yt_dlp import YoutubeDL

def sanitize_filename(name):
    """Remove characters not allowed in filenames."""
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    return name.strip()

def extract_all_text(data):
    """Recursively extract all 'text' fields from a JSON structure."""
    texts = []
    if isinstance(data, dict):
        if 'text' in data:
            texts.append(str(data['text']))
        for v in data.values():
            texts.extend(extract_all_text(v))
    elif isinstance(data, list):
        for item in data:
            texts.extend(extract_all_text(item))
    return texts

def get_videos_from_urls(urls):
    """Use yt-dlp to extract video IDs and titles from URLs (single videos or playlists)."""
    videos = []
    ydl_opts = {
        'extract_flat': True,  # Don't download videos, just extract info
        'quiet': True,
    }
    with YoutubeDL(ydl_opts) as ydl:
        for url in urls:
            try:
                print(f"Extracting video information for: {url}")
                info = ydl.extract_info(url, download=False)
                if 'entries' in info:
                    # It's a playlist
                    for entry in info['entries']:
                        if entry:
                            videos.append({
                                'id': entry['id'],
                                'title': entry.get('title', entry['id'])
                            })
                else:
                    # It's a single video
                    videos.append({
                        'id': info['id'],
                        'title': info.get('title', info['id'])
                    })
            except Exception as e:
                print(f"Error extracting info for {url}: {e}")
    return videos

def extract_transcripts(urls, proxy_user, proxy_pass):
    videos = get_videos_from_urls(urls)
    if not videos:
        print("No videos found to process.")
        return

    # Assuming the venv is in the same directory as this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    cli_path = os.path.join(script_dir, "venv", "bin", "youtube_transcript_api")
    
    # Fallback if not running in venv
    if not os.path.exists(cli_path):
        cli_path = "youtube_transcript_api"

    for video in videos:
        video_id = video['id']
        title = video['title']
        print(f"\nProcessing '{title}' (ID: {video_id})...")

        cmd = [
            cli_path,
            video_id,
            "--webshare-proxy-username", proxy_user,
            "--webshare-proxy-password", proxy_pass,
            "--format", "json"
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"Failed to extract transcript for '{title}'.")
                if result.stderr:
                    print(f"Error: {result.stderr.strip()}")
                continue
            
            output = result.stdout
            if not output.strip():
                print(f"No output returned for '{title}'.")
                continue
                
            try:
                transcript_data = json.loads(output)
            except json.JSONDecodeError:
                print(f"Failed to parse JSON for '{title}'. Output was:\n{output[:200]}...")
                continue
            
            # Clean data: Extract text and join
            raw_texts = extract_all_text(transcript_data)
            cleaned_text = " ".join([t.replace('\n', ' ') for t in raw_texts])
            cleaned_text = html.unescape(cleaned_text)
            cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
            
            if not cleaned_text.strip():
                print(f"No valid transcript text found for '{title}'.")
                continue
            
            filename = os.path.join(script_dir, sanitize_filename(title) + ".txt")
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(cleaned_text)
                
            print(f"Successfully saved transcript to '{filename}'.")

        except Exception as e:
            print(f"Error processing '{title}': {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_transcripts.py <url_or_playlist> [url2] ...")
        sys.exit(1)
        
    urls = sys.argv[1:]
    
    # Proxy credentials provided by the user
    proxy_user = "deexcpkf"
    proxy_pass = "6ugilo2e58p6"
    
    print(f"Starting transcript extraction for {len(urls)} input URL(s)...")
    extract_transcripts(urls, proxy_user, proxy_pass)
