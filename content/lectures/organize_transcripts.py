import os
import shutil
import yt_dlp
import re

PLAYLIST_URL = "https://www.youtube.com/playlist?list=PLu0W_9lII9agq5TrH9XLIKQvv0iaF2X3w"
SOURCE_DIR = "transcripts_tactiq"

def sanitize_filename(name):
    # Remove characters not allowed in filenames
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    return name.strip()

def get_playlist_info(url):
    print(f"Fetching playlist info: {url}")
    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        return info

def main():
    info = get_playlist_info(PLAYLIST_URL)
    playlist_title = sanitize_filename(info.get('title', 'YouTube Playlist'))
    
    # Create the playlist folder
    dest_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), playlist_title)
    os.makedirs(dest_dir, exist_ok=True)
    print(f"Created playlist folder: {dest_dir}")
    
    # Get all downloaded files in transcripts_tactiq
    source_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), SOURCE_DIR)
    
    if not os.path.exists(source_path):
        print(f"Source directory {source_path} does not exist.")
        return
        
    downloaded_files = os.listdir(source_path)
    print(f"Found {len(downloaded_files)} transcripts to organize.")
    
    # Match playlist entries to downloaded files
    for idx, entry in enumerate(info.get('entries', []), 1):
        video_id = entry.get('id')
        title = entry.get('title', f"Video_{idx}")
        
        # Look for a file containing the video ID
        matched_file = None
        for f in downloaded_files:
            if video_id in f:
                matched_file = f
                break
                
        if matched_file:
            # Construct new file name: videoname_serial number.txt
            # Let's clean the title
            clean_title = sanitize_filename(title)
            new_filename = f"{clean_title}_{idx}.txt"
            
            old_filepath = os.path.join(source_path, matched_file)
            new_filepath = os.path.join(dest_dir, new_filename)
            
            shutil.copy2(old_filepath, new_filepath)
            print(f"[{idx}] Copied -> {new_filename}")
        else:
            print(f"[{idx}] Missing transcript for: {title} (ID: {video_id})")
            
    print("\nOrganization complete!")

if __name__ == '__main__':
    main()
