import os
import google.generativeai as genai

# Try to use API key from env, or print error
api_key = os.environ.get('GEMINI_API_KEY')
if not api_key:
    print("No GEMINI_API_KEY")
    exit(0)

genai.configure(api_key=api_key)

try:
    model = genai.GenerativeModel('gemini-1.5-flash')
    sample_file = genai.upload_file('/home/unknown/.gemini/antigravity/brain/27656a8e-5224-453a-8e7d-a3d9aa5447e1/media__1785854164327.png')
    response = model.generate_content([
        "Describe the UI layout in this image in extreme detail. Include colors, layout structure, text, font sizes, icons, padding, borders, and how sections are arranged.",
        sample_file
    ])
    print(response.text)
except Exception as e:
    print(f"Error: {e}")
