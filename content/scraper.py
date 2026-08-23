import os
import time
import requests
import pandas as pd
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from openpyxl.utils import get_column_letter

def main():
    base_url = 'https://www.w3schools.com'
    # Target tracks with their default URLs
    tracks = {
        'HTML': '/html/default.asp',
        'CSS': '/css/default.asp',
        'JavaScript': '/js/default.asp',
        'SQL': '/sql/default.asp',
        'Python': '/python/default.asp'
    }
    
    # Proper headers to identify the request and prevent blocking
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    }
    
    all_data = []

    for track_name, track_path in tracks.items():
        print(f"Scraping track: {track_name}")
        track_url = urljoin(base_url, track_path)
        
        try:
            response = requests.get(track_url, headers=headers, timeout=10)
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"Error fetching {track_url}: {e}")
            continue
            
        soup = BeautifulSoup(response.text, 'html.parser')
        sidebar = soup.find('div', id='leftmenuinnerinner')
        
        if not sidebar:
            print(f"Sidebar not found for {track_name}. Skipping...")
            continue
            
        # Collect unique sub-URLs from the sidebar
        sub_urls = []
        for link in sidebar.find_all('a', href=True):
            sub_url = urljoin(track_url, link['href'])
            # Only keep URLs that point back to the target domain
            if sub_url not in sub_urls and base_url in sub_url:
                sub_urls.append(sub_url)
        
        print(f"Found {len(sub_urls)} pages for {track_name}")
        
        # Scrape each discovered sub-page
        for idx, sub_url in enumerate(sub_urls, 1):
            print(f"  [{idx}/{len(sub_urls)}] Fetching: {sub_url}")
            try:
                sub_response = requests.get(sub_url, headers=headers, timeout=10)
                sub_response.raise_for_status()
            except requests.RequestException as e:
                print(f"  Error fetching {sub_url}: {e}")
                time.sleep(1) # Polite delay even on failure
                continue
                
            sub_soup = BeautifulSoup(sub_response.text, 'html.parser')
            
            # 1. Extract topic title
            h1_tag = sub_soup.find('h1')
            title = h1_tag.get_text(strip=True) if h1_tag else 'No Title'
            
            main_div = sub_soup.find('div', id='main')
            explanation_text = ""
            code_snippets_text = ""
            
            if main_div:
                # 2. Extract explanation text from <p> tags
                paragraphs = main_div.find_all('p', recursive=False)
                if not paragraphs:
                    # Fallback to searching all <p> if top-level ones are missing
                    paragraphs = main_div.find_all('p')
                    
                explanation_text = "\n\n".join(
                    p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)
                )
                
                # 3. Extract code snippets (prioritizing 'w3-code', falling back to 'w3-example')
                code_blocks = main_div.find_all(class_='w3-code')
                if not code_blocks:
                    code_blocks = main_div.find_all(class_='w3-example')
                    
                snippets = []
                for block in code_blocks:
                    snippet = block.get_text(separator='\n', strip=True)
                    if snippet:
                        snippets.append(snippet)
                        
                code_snippets_text = "\n\n---\n\n".join(snippets)
                
            all_data.append({
                'Language/Track': track_name,
                'Topic Title': title,
                'Source URL': sub_url,
                'Explanation Text': explanation_text,
                'Code Snippets': code_snippets_text
            })
            
            # Polite delay between requests to avoid overwhelming the server
            time.sleep(1)

    if not all_data:
        print("No data was extracted. Exiting.")
        return

    # Create DataFrame and export to Excel
    df = pd.DataFrame(all_data)
    output_path = os.path.join(os.path.dirname(__file__), 'W3Schools_Database.xlsx')
    
    print("\nExporting data to Excel...")
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        for track_name, group_df in df.groupby('Language/Track'):
            # Truncate sheet name to comply with Excel limits (max 31 chars, using 30 here)
            sheet_name = str(track_name)[:30]
            group_df.to_excel(writer, index=False, sheet_name=sheet_name)
            
            # Apply auto-fitting to column widths
            worksheet = writer.sheets[sheet_name]
            for idx, col_name in enumerate(group_df.columns, 1):
                # Calculate max length of data in this column or the header itself
                max_len = max(
                    group_df[col_name].astype(str).map(len).max(),
                    len(str(col_name))
                )
                # Cap the maximum width to avoid absurdly wide columns (e.g., limit to 80 chars visually)
                col_width = min(max_len + 2, 80)
                col_letter = get_column_letter(idx)
                worksheet.column_dimensions[col_letter].width = col_width

    print(f"Scraping completed! Data successfully saved to:\n{output_path}")

if __name__ == "__main__":
    main()
