"""Hand-written verbal ability questions (originals). Needs human review for taste, as with all drafts.
(topic, difficulty, body, correct, [3 wrong], explanation)
"""
V = [
    # ── Synonyms ──
    ('Synonyms', 'easy', 'Choose the word closest in meaning to ABUNDANT.', 'Plentiful', ['Scarce', 'Tiny', 'Costly'], 'Abundant means existing in large quantities, which is what plentiful means.'),
    ('Synonyms', 'easy', 'Choose the word closest in meaning to CANDID.', 'Frank', ['Secretive', 'Shy', 'Polite'], 'A candid person speaks honestly and openly: frank.'),
    ('Synonyms', 'medium', 'Choose the word closest in meaning to METICULOUS.', 'Careful', ['Careless', 'Hurried', 'Generous'], 'Meticulous means showing great attention to detail: careful.'),
    ('Synonyms', 'medium', 'Choose the word closest in meaning to PRUDENT.', 'Wise', ['Reckless', 'Proud', 'Angry'], 'A prudent person acts with care and good judgement: wise.'),
    ('Synonyms', 'medium', 'Choose the word closest in meaning to OBSOLETE.', 'Outdated', ['Modern', 'Fragile', 'Essential'], 'Obsolete means no longer in use because something newer exists: outdated.'),
    ('Synonyms', 'hard', 'Choose the word closest in meaning to EPHEMERAL.', 'Short-lived', ['Eternal', 'Heavy', 'Hidden'], 'Ephemeral things last only a very short time.'),
    ('Synonyms', 'hard', 'Choose the word closest in meaning to LUCID.', 'Clear', ['Confusing', 'Dark', 'Silent'], 'Lucid means easy to understand or clearly expressed.'),
    ('Synonyms', 'medium', 'Choose the word closest in meaning to DILIGENT.', 'Hardworking', ['Lazy', 'Clumsy', 'Talkative'], 'A diligent person works with steady effort.'),
    # ── Antonyms ──
    ('Antonyms', 'easy', 'Choose the word opposite in meaning to EXPAND.', 'Shrink', ['Grow', 'Spread', 'Stretch'], 'To expand is to get bigger; to shrink is to get smaller.'),
    ('Antonyms', 'easy', 'Choose the word opposite in meaning to GENUINE.', 'Fake', ['Real', 'Honest', 'Original'], 'Genuine means real; fake is its opposite.'),
    ('Antonyms', 'medium', 'Choose the word opposite in meaning to VICTORY.', 'Defeat', ['Triumph', 'Success', 'Conquest'], 'Victory means winning; defeat means losing.'),
    ('Antonyms', 'medium', 'Choose the word opposite in meaning to TRANSPARENT.', 'Opaque', ['Clear', 'Thin', 'Bright'], 'Transparent lets light through; opaque does not.'),
    ('Antonyms', 'hard', 'Choose the word opposite in meaning to FRUGAL.', 'Extravagant', ['Thrifty', 'Economical', 'Careful'], 'Frugal means careful with money; extravagant means spending lavishly.'),
    ('Antonyms', 'hard', 'Choose the word opposite in meaning to BENEVOLENT.', 'Malicious', ['Kind', 'Generous', 'Caring'], 'Benevolent means well-meaning and kind; malicious means intending harm.'),
    # ── Grammar / error spotting ──
    ('Grammar', 'easy', 'Choose the correct sentence.', 'She has been living here since 2019.', ['She is living here since 2019.', 'She live here since 2019.', 'She has lived here from 2019.'], 'Since a starting point takes the present perfect (has been living / has lived).'),
    ('Grammar', 'easy', 'Fill in the blank: Neither of the two answers ___ correct.', 'is', ['are', 'were', 'be'], '"Neither" takes a singular verb.'),
    ('Grammar', 'easy', 'Fill in the blank: He is the ___ student in the class.', 'tallest', ['taller', 'most tall', 'more tall'], 'Superlative of a short adjective: tall -> tallest.'),
    ('Grammar', 'medium', 'Fill in the blank: If I ___ you, I would accept the offer.', 'were', ['am', 'was', 'be'], 'The unreal conditional uses "were" for all persons.'),
    ('Grammar', 'medium', 'Choose the correct sentence.', 'The committee has announced its decision.', ['The committee have announced their decision.', 'The committee have announced its decision.', 'The committees has announced its decision.'], 'A committee acting as one body takes a singular verb and "its".'),
    ('Grammar', 'medium', 'Fill in the blank: She is good ___ mathematics.', 'at', ['in', 'on', 'for'], 'The fixed pattern is "good at" a subject.'),
    ('Grammar', 'medium', 'Fill in the blank: The teacher, along with her students, ___ going to the museum.', 'is', ['are', 'were', 'have been'], 'The subject is "teacher"; "along with her students" does not make it plural.'),
    ('Grammar', 'medium', 'Choose the correct sentence.', 'I have no idea who left this bag here.', ['I have no idea whom left this bag here.', 'I have not no idea who left this bag here.', 'I haven\'t no idea who left this bag here.'], '"Who" is the subject of "left"; double negatives are incorrect.'),
    ('Grammar', 'hard', 'Fill in the blank: By the time we reached the station, the train ___.', 'had left', ['has left', 'left', 'was leaving'], 'An earlier past action before another past action uses the past perfect.'),
    ('Grammar', 'hard', 'Fill in the blank: Hardly had he entered the room ___ the lights went out.', 'when', ['than', 'then', 'as soon'], '"Hardly ... when" is the correct pair ("no sooner ... than" is the other).'),
    ('Grammar', 'hard', 'Choose the sentence with correct usage.', 'Each of the players was given a medal.', ['Each of the players were given a medal.', 'Each of the player was given a medal.', 'Each of the players have been given a medal.'], '"Each" is singular, so it takes "was"; "of the players" stays plural.'),
    ('Grammar', 'medium', 'Fill in the blank: I look forward to ___ you next week.', 'seeing', ['see', 'saw', 'have seen'], '"Look forward to" is followed by a gerund (-ing form).'),
    ('Grammar', 'easy', 'Fill in the blank: There ___ many books on the shelf.', 'are', ['is', 'was', 'has'], '"Books" is plural, so "there are".'),
    ('Grammar', 'medium', 'Fill in the blank: She suggested that he ___ a doctor.', 'see', ['sees', 'saw', 'seeing'], 'After "suggested that" the base form (subjunctive) is used.'),
    # ── One-word substitutes ──
    ('One-word Substitution', 'medium', 'One word for: a person who speaks many languages.', 'Polyglot', ['Linguist', 'Orator', 'Translator'], 'A polyglot knows and speaks several languages.'),
    ('One-word Substitution', 'medium', 'One word for: a government by the people.', 'Democracy', ['Monarchy', 'Autocracy', 'Aristocracy'], 'Democracy means rule by the people.'),
    ('One-word Substitution', 'medium', 'One word for: a person who does not believe in God.', 'Atheist', ['Agnostic', 'Optimist', 'Cynic'], 'An atheist does not believe that God exists.'),
    ('One-word Substitution', 'hard', 'One word for: a place where birds are kept.', 'Aviary', ['Apiary', 'Nursery', 'Kennel'], 'An aviary houses birds; an apiary houses bees.'),
    ('One-word Substitution', 'hard', 'One word for: a medicine that prevents or cures poison.', 'Antidote', ['Vaccine', 'Tonic', 'Stimulant'], 'An antidote counteracts a poison.'),
    ('One-word Substitution', 'medium', 'One word for: the study of the origin and history of words.', 'Etymology', ['Entomology', 'Ecology', 'Ethics'], 'Etymology studies word origins; entomology is the study of insects.'),
    # ── Idioms ──
    ('Idioms', 'easy', 'What does the idiom "a piece of cake" mean?', 'Very easy', ['Very sweet', 'Very expensive', 'Very small'], 'It describes something that takes little effort.'),
    ('Idioms', 'medium', 'What does "to burn the midnight oil" mean?', 'To work late into the night', ['To waste fuel', 'To start a fire', 'To wake up early'], 'It means to stay up working or studying late.'),
    ('Idioms', 'medium', 'What does "to break the ice" mean?', 'To start a conversation in an awkward situation', ['To break something cold', 'To end a friendship', 'To win a game'], 'It means to ease tension and begin friendly conversation.'),
    ('Idioms', 'medium', 'What does "once in a blue moon" mean?', 'Very rarely', ['Every month', 'At night', 'Very often'], 'It describes something that happens very seldom.'),
    ('Idioms', 'hard', 'What does "the ball is in your court" mean?', 'It is your turn to act or decide', ['You are playing tennis', 'You are being blamed', 'You have won'], 'It means the next move is up to you.'),
    ('Idioms', 'hard', 'What does "to let the cat out of the bag" mean?', 'To reveal a secret by mistake', ['To adopt a pet', 'To lose something', 'To cause trouble on purpose'], 'It means accidentally giving away a secret.'),
    # ── Sentence completion / reading logic ──
    ('Sentence Completion', 'medium', 'Choose the best word: The new policy was so ___ that nobody could understand how to apply it.', 'ambiguous', ['transparent', 'concise', 'popular'], 'The result (nobody understood it) points to something unclear: ambiguous.'),
    ('Sentence Completion', 'medium', 'Choose the best word: Despite the heavy rain, the match went ahead, showing the organisers\' ___.', 'determination', ['laziness', 'confusion', 'generosity'], '"Despite" signals a contrast: carrying on shows determination.'),
    ('Sentence Completion', 'hard', 'Choose the best word: Her ___ remarks hurt the team, although she never meant to offend anyone.', 'thoughtless', ['thoughtful', 'brilliant', 'rehearsed'], '"Although she never meant to offend" shows the harm came from carelessness: thoughtless.'),
    ('Sentence Completion', 'easy', 'Choose the best word: The shop was closed, ___ we went home.', 'so', ['but', 'because', 'although'], 'The second clause is a result of the first, joined by "so".'),
    ('Spelling', 'easy', 'Choose the correctly spelt word.', 'Necessary', ['Neccessary', 'Necessery', 'Necesary'], 'The correct spelling has one c and two s: necessary.'),
    ('Spelling', 'medium', 'Choose the correctly spelt word.', 'Accommodation', ['Accomodation', 'Acommodation', 'Accommodetion'], 'Accommodation has double c and double m.'),
    ('Spelling', 'medium', 'Choose the correctly spelt word.', 'Occurrence', ['Occurence', 'Ocurrence', 'Occurrance'], 'Occurrence has double c and double r.'),
    ('Spelling', 'hard', 'Choose the correctly spelt word.', 'Conscientious', ['Consciencious', 'Conscientous', 'Concientious'], 'It is built from "conscience": conscientious.'),
]
