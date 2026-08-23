import os
import json
import pandas as pd
import re

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '_', text)
    return text.strip('_')

def main():
    excel_path = os.path.join(os.path.dirname(__file__), 'W3Schools_Database.xlsx')
    out_dir = os.path.join(os.path.dirname(__file__), 'w3schools_chapters_merged')
    os.makedirs(out_dir, exist_ok=True)
    
    xl = pd.ExcelFile(excel_path)
    CHUNK_SIZE = 5 # Group every 5 topics into 1 chapter
    
    for sheet_name in xl.sheet_names:
        print(f"Processing sheet {sheet_name} with merging...")
        df = pd.read_excel(excel_path, sheet_name=sheet_name)
        df = df.fillna('')
        
        # Convert df to list of dicts for easier chunking
        rows = df.to_dict('records')
        
        chapter_idx = 1
        for i in range(0, len(rows), CHUNK_SIZE):
            chunk = rows[i:i+CHUNK_SIZE]
            lang = str(chunk[0].get('Language/Track', sheet_name))
            
            # Combine topics for the title
            first_topic = str(chunk[0].get('Topic Title', f"Topic {i}"))
            last_topic = str(chunk[-1].get('Topic Title', f"Topic {i+len(chunk)}"))
            
            if len(chunk) > 1:
                chapter_title = f"{first_topic} to {last_topic}"
            else:
                chapter_title = first_topic
                
            combined_docs = ""
            for idx, row in enumerate(chunk):
                topic = str(row.get('Topic Title', ''))
                explanation = str(row.get('Explanation Text', ''))
                code_snippets = str(row.get('Code Snippets', ''))
                
                combined_docs += f"## {topic}\n\n{explanation}\n\n"
                if code_snippets:
                    combined_docs += f"### Code Examples\n\n```\n{code_snippets}\n```\n\n"
                    
            combined_docs += "---\n"
            
            chapter_slug = f"{slugify(lang)}_ch_{chapter_idx:03d}_{slugify(first_topic)}"
            file_name = f"{chapter_slug}.json"
            
            yt_url = f"https://www.youtube.com/results?search_query={lang}+{first_topic.replace(' ', '+')}"
            
            # Use the first topic for generating generic prompts to keep it simple
            main_topic = first_topic
            
            chapter_data = {
                "roadmap_slug": slugify(lang),
                "chapter_number": chapter_idx,
                "title": chapter_title,
                "topic_tag": slugify(main_topic),
                "difficulty": "BEGINNER",
                "est_minutes": 60,  # Increased est_minutes because it's merged
                "story_hook": f"Welcome to this comprehensive chapter covering {chapter_title}. Mastering these concepts is crucial in {lang}.",
                "steps": [
                    {
                        "step_number": 1,
                        "type": "story_hook",
                        "title": "Story Hook",
                        "content": {
                            "story": f"Welcome to this comprehensive chapter covering {chapter_title}. Mastering these concepts is crucial in {lang}."
                        }
                    },
                    {
                        "step_number": 2,
                        "type": "video",
                        "title": "Curated YouTube",
                        "content": {
                            "youtube_url": yt_url,
                            "title": f"Understanding {main_topic} and more in {lang}",
                            "channel": "YouTube Search",
                            "duration_min": 20,
                            "focus_note": f"Watch this video to understand the core concepts introduced in {chapter_title}."
                        }
                    },
                    {
                        "step_number": 3,
                        "type": "doc",
                        "title": "Learning Doc",
                        "content": {
                            "doc_md": combined_docs
                        }
                    },
                    {
                        "step_number": 4,
                        "type": "practice",
                        "title": "Practice Problems",
                        "content": {
                            "practice_problems": [
                                {
                                    "id": f"p1_{chapter_idx}",
                                    "prompt": f"Try implementing the concepts from {main_topic} in {lang}.",
                                    "input_type": "text"
                                },
                                {
                                    "id": f"p2_{chapter_idx}",
                                    "prompt": f"Write another program using {last_topic}.",
                                    "input_type": "text"
                                }
                            ]
                        }
                    },
                    {
                        "step_number": 5,
                        "type": "quiz",
                        "title": "Mini Quiz",
                        "content": {
                            "quiz_questions": [
                                {
                                    "question": f"What is one of the primary uses of {main_topic} in {lang}?",
                                    "options": [
                                        "To handle application logic and structure",
                                        "To format data for display",
                                        "To store temporary values"
                                    ],
                                    "correctAnswer": "To handle application logic and structure",
                                    "explanation": f"Understanding the core purpose of {main_topic} is vital."
                                }
                            ]
                        }
                    },
                    {
                        "step_number": 6,
                        "type": "task",
                        "title": "The Task",
                        "content": {
                            "task_prompt": f"Write a comprehensive program in {lang} that incorporates {chapter_title}."
                        }
                    },
                    {
                        "step_number": 7,
                        "type": "micro_revision",
                        "title": "Micro-Revision",
                        "content": {
                            "connection_map": f"Previous Chapter -> {chapter_title}",
                            "recall_questions": [
                                f"What did you learn about {main_topic}?"
                            ],
                            "identity_affirmation": "You just leveled up your skills significantly by completing a major section.",
                            "completion_celebration": {
                                "message": "Section Master Unlocked!",
                                "linkedin_card_text": f"Mastered {chapter_title} in {lang}!"
                            },
                            "streak_reminder": "Keep the streak alive!",
                            "reward_chest": {
                                "type": "random",
                                "rewards": [
                                    "+50 XP",
                                    "Section Badge"
                                ]
                            }
                        }
                    }
                ]
            }
            
            out_file = os.path.join(out_dir, file_name)
            with open(out_file, 'w', encoding='utf-8') as f:
                json.dump(chapter_data, f, indent=2)
                
            chapter_idx += 1
                
    print(f"Merged chapters successfully generated in {out_dir}")

if __name__ == '__main__':
    main()
