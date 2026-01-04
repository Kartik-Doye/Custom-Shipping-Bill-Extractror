# Solar Customs AI (Local Edition)

A secure, offline tool for extracting financial data from Shipping Bills using local AI.

## Prerequisites

1. **Install Python 3.10+**
2. **Install Poppler** (Required for PDF processing)
   - **Windows**: Download form http://blog.alivate.com.au/poppler-windows/ and add `bin/` to PATH.
   - **Mac**: `brew install poppler`
   - **Linux**: `sudo apt-get install poppler-utils`
3. **Install Ollama**: [https://ollama.com](https://ollama.com)

## Setup

1. **Pull the AI Model**:
   Open your terminal and run:
   ```bash
   ollama run llama3.2-vision
   ```
   (Wait for the 7.8GB download to finish)

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

## Running the App

1. Start Ollama (if not running):
   ```bash
   ollama serve
   ```

2. Run the App:
   ```bash
   streamlit run app.py
   ```

The application will open in your browser at `http://localhost:8501`.
