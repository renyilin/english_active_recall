# Project Design Document: English Active Recall App

## 1. Executive Summary
A personal, high-efficiency language learning tool focused on **Active Recall** and **Speaking**. The app minimizes the friction of creating flashcards using **AI Smart Input** and maximizes retention using a **Spaced Repetition System (SRS)**.

* **Core Philosophy:** Reduce data entry time -> Increase speaking practice time.
* **Target Platform:** Web Application (Mobile-responsive).
* **Deployment:** Free Tier Cloud Stack (Vercel, Render, Neon/Supabase).

---

## 2. Functional Specifications

### A. User Management
* **Auth System:** Simple Email/Password registration.
* **Security:** JWT (JSON Web Tokens) for session management.
* **Data Isolation:** All data queries must be scoped to the authenticated `user_id`.

### B. "Smart Input" (AI-Powered)
Instead of manual typing, the user inputs a raw phrase or sentence. The system calls an AI API (OpenAI/Gemini) to generate structured learning data.
* **Input:** Raw text (e.g., "call it a day").
* **Output:** Auto-filled fields for Meaning, Context Sentence, Translation, and Type (Phrase/Sentence).
* **User Control:** User reviews and edits the AI output before saving.

### C. Library Management (Table View)
A dashboard to manage the knowledge base.
* **View:** Data Table (Desktop) / List View (Mobile).
* **Search:** Real-time filtering by English text or Chinese meaning.
* **Filters:** By Type (Sentence vs. Phrase), By Status (New/Learning/Mastered).
* **Interactions:** Expand row to see full context; Quick-edit; Delete.

### D. Study Mode (The Flashcard)
The app serves cards based on the SRS schedule.
* **Mode 1: Sentence Mode** (For full sentences)
    * *Front:* Chinese Meaning.
    * *Task:* Speak the full English sentence.
* **Mode 2: Phrase Mode** (For idioms/words)
    * *Front:* Example sentence with a `_______` blank + Chinese Hint.
    * *Task:* Speak the missing phrase to complete the context.
* **Feedback:**
    * Flip card to reveal answer.
    * **Audio Button:** Text-to-Speech playback.
    * **Grading:** User selects [Forgot] / [Hard] / [Easy].

---

## 3. Algorithm & Logic

### Spaced Repetition (Simplified SM-2)
Determines when a card should be reviewed next based on user feedback.

| Rating | Logic | Interval Calc | Next Review |
| :--- | :--- | :--- | :--- |
| **Forgot** (Red) | Reset progress. | `Interval = 0` | < 10 min |
| **Hard** (Yellow) | Small increase. | `Interval = Current * 1.2` | e.g., 1d -> 1.2d |
| **Easy** (Green) | Large increase. | `Interval = Current * 2.5` | e.g., 1d -> 2.5d |

---

## 4. AI System Design

### System Prompt
This prompt ensures the AI returns strict JSON for the app to parse.

**Role:** You are an intelligent data processor for an English learning app.
**Instructions:**
1. Analyze input: Is it a "phrase" or "sentence"?
2. Generate `target_meaning` (Simplified Chinese).
3. Generate `context_sentence`:
   - If Phrase: Create a natural example sentence using it.
   - If Sentence: Use input as-is (correct grammar).
4. Generate `context_translation`: Translate the full example sentence (Simplified Chinese).
5. Generate `cloze_sentence`: Replace target in context with `_______`.
6. Output JSON only.

### JSON Structure
```json
{
  "type": "phrase",
  "target_text": "call it a day",
  "target_meaning": "收工；今天就做到这里",
  "context_sentence": "I'm really tired, let's call it a day.",
  "context_translation": "我很累了，咱们收工吧。",
  "cloze_sentence": "I'm really tired, let's _______."
}
```


## 5. Technical Architecture

### Tech Stack

| Component | Technology | Selection Rationale |
| --- | --- | --- |
| **Frontend** | **React** (Vite) | Fast, rich ecosystem. |
| **UI Library** | **MUI** or **Shadcn/UI** | Pre-built Data Grid and Card components. |
| **Backend** | **Python (FastAPI)** | High performance, native AI integration, auto-docs. |
| **Database** | **PostgreSQL** | Relational data integrity. |
| **ORM** | **SQLModel** | Modern Pythonic interaction with SQL. |
| **AI Providers** | **OpenAI** + **Gemini** | Factory pattern to switch providers. |

---### Database Schema (SQLModel/Python)

``` Python

    import uuid
    from datetime import datetime
    from sqlmodel import SQLModel, Field
    
    class User(SQLModel, table=True):
        id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
        email: str = Field(unique=True, index=True)
        hashed_password: str
    
    class Card(SQLModel, table=True):
        id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
        user_id: uuid.UUID = Field(foreign_key="user.id")
        
        # Content
        type: str                 # "phrase" or "sentence"
        target_text: str          # "call it a day"
        target_meaning: str       # "收工..."
        context_sentence: str     # "Let's call it a day"
        context_translation: str  # "咱们收工吧"
        cloze_sentence: str       # "Let's _______"
        
        # SRS Metadata
        interval: int = Field(default=0)      # Days
        ease_factor: float = Field(default=2.5)
        next_review: datetime = Field(default_factory=datetime.utcnow)
```

## 6. Deployment Plan (Free Tier)

| Component | Service | Tier |
| --- | --- | --- |
| **Database** | **Neon.tech** or **Supabase** | Free Serverless Postgres (500MB+). |
| **Backend** | **Render.com** | Free Web Service (Spins down on idle). |
| **Frontend** | **Vercel** | Free Hobby Tier (Git Integration). |

Export to Sheets

### Development Roadmap

1.  **Phase 1 (Backend Core):** Setup FastAPI, Postgres, and User Auth (JWT).
    
2.  **Phase 2 (AI Integration):** Implement `POST /generate` with the JSON prompt.
    
3.  **Phase 3 (Frontend Library):** React setup, Login screen, and Data Table.
    
4.  **Phase 4 (Study Mode):** Flashcard UI and SRS logic implementation.













