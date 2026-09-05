# 🛡️ PromptShield — A Real-Time Prompt Firewall for LLM Applications

PromptShield is a browser-based **prompt injection firewall** that intercepts user prompts *before* they reach any AI chatbot (ChatGPT, Gemini, Claude, Copilot, and more) and blocks jailbreak, roleplay, encoded, and instruction-override attacks — all without needing access to the AI platform itself.

Unlike built-in AI safety filters, which analyze the model's *output* after the harmful prompt has already been processed, PromptShield works at the **input level**: prompts are intercepted, analyzed through a hybrid 3-layer detection pipeline, and either blocked or forwarded — so the model never even sees the harmful input.

---

## ✨ Key Features

- 🔌 **Platform-independent** — works across ChatGPT, Gemini, Claude, Copilot, Poe, Perplexity, and more via a Chrome extension
- 🧠 **Hybrid 3-layer detection pipeline**: regex pattern matching → RAG-based similarity search → local LLM classification
- 🔡 **Morse-code / encoded-input detection** — decodes and re-checks obfuscated prompts
- 🎭 Detects jailbreaks, DAN-style attacks, roleplay personas, instruction overrides, and educational-framing exploits
- 💬 Standalone **protected web chat interface** with real-time pipeline visualization
- 🔒 **100% local LLM inference** via Ollama — no prompt data ever leaves the user's machine
- 📊 Full audit log of every blocked prompt with reasoning

---

## 🏗️ Architecture

```
User types prompt on ChatGPT/Gemini/Claude/etc.
        │
        ▼
Chrome Extension (content.js) intercepts submission
        │  POST /analyze
        ▼
Flask Backend
        │
        ├─► Pre-processing (Morse decode)
        ├─► Layer 1: Pattern Matching (regex)
        ├─► Layer 2: RAG Similarity Check (Jaccard)
        ├─► Layer 3: LLM Classification (LLaMA 3.2 via Ollama)
        │
        ▼
Decision Engine (priority-based voting)
        │
   ┌────┴────┐
 SAFE      UNSAFE
   │          │
Prompt      Blocked +
proceeds    logged
```

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Python 3, Flask 3.0.3, Flask-CORS |
| Local LLM inference | Ollama + LLaMA 3.2 |
| Detection logic | Python `re` (regex), Jaccard similarity (custom RAG) |
| Browser extension | Chrome Extension Manifest V3 (JavaScript) |
| Web chat UI | HTML, CSS, JavaScript, Fetch API, Server-Sent Events |
| Communication | REST (HTTP POST/GET), SSE for streaming |

---

## 📁 Project Structure

```
promptshield/
├── backend/
│   ├── app.py              # Flask server + detection pipeline
│   ├── requirements.txt
│   └── unsafe_prompts.log  # audit log of blocked prompts
├── extension/
│   ├── manifest.json       # Chrome extension config (Manifest V3)
│   ├── content.js          # intercepts prompts on AI platforms
│   ├── background.js       # service worker / state management
│   ├── popup.html          # extension dashboard UI
│   └── icons/
└── frontend/
    └── index.html          # standalone protected chat interface
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.9+
- [Ollama](https://ollama.com) installed locally
- Google Chrome (v100+)

### 1. Pull the local model
```bash
ollama pull llama3.2
```

### 2. Run the backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```
The server starts on `http://localhost:5001` by default.

### 3. Load the Chrome extension
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder
4. PromptShield now runs automatically on ChatGPT, Gemini, Claude, Copilot, etc.

### 4. (Optional) Use the standalone web chat
Open `frontend/index.html` in browser — it connects to the same backend and gives you a fully protected chat experience with live pipeline visualization.

---

## 🔍 API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/analyze` | POST | Runs a prompt through the full detection pipeline (used by the extension) |
| `/chat` | POST | Classifies + streams an LLM response for safe prompts (used by web UI) |
| `/logs` | GET | Returns recently blocked prompts |
| `/health` | GET | Backend/Ollama status check |

---

## 📊 Results (from testing)

- **100%** detection accuracy on the tested benign/harmful prompt set, **0% false positives**
- Pattern matching layer: ~75% detection rate, 2.5% false positive rate
- RAG similarity layer: ~83% detection rate, 1.5% false positive rate
- LLM classification layer: ~86% detection rate, 1.0% false positive rate
- Combined pipeline outperforms any single layer alone
- Adds ~0.6s latency per prompt vs. no firewall — an acceptable trade-off for the added security

---

## 🚀 Future Enhancements

- Self-improving RAG bank via automatic analysis of the unsafe prompts log
- Mobile browser support (Firefox for Android / dedicated app)

---

## 📄 License

This project was built as part of an academic final-year project. Feel free to fork and build on it — attribution appreciated.
