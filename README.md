# 🚀 BigQuery Release Pulse

A premium, real-time release notes dashboard and Twitter/X sharing integration built with **Python Flask** and plain vanilla **HTML5, CSS3, and JavaScript**. 

Stay updated with the latest features, changes, deprecations, and announcements from Google Cloud BigQuery, and instantly draft and post updates to your X account.

---

## ✨ Features

*   **📰 Smart Atom Feed Aggregator**: Dynamically fetches the official Google Cloud BigQuery release notes feed and parses combined entries into itemized, individual update cards.
*   **🏷️ Categorization & Styling**: Categorizes updates with color-coded status badges (`Feature`, `Change`, `Announcement`, `Breaking`, `Issue`) using custom CSS gradients.
*   **⚡ Instant Search & Client-side Filters**: Instant, reactive searching by keyword or filtering by category tabs.
*   **⏳ Intelligent In-Memory Cache**: Caches feed data for **1 hour** to keep loads instant, with a circular sync button to force-refresh directly from Google's servers.
*   **🐦 Interactive Tweet Composer**: 
    *   Generates pre-formatted drafts complete with headline emojis, categories, dates, and documentation URLs.
    *   Removes HTML tags and sanitizes text for clean posting.
    *   **Auto-truncation Safeguard**: Ensures the final post respects X's **280-character limit** by truncating descriptions while leaving links and hashtags fully intact.
    *   **Circular Progress Ring**: Shows characters remaining with a colored progress ring (blue ➡️ warning yellow ➡️ error red).
    *   Includes a **Copy Text** button and a **Post on X** shortcut to redirect straight to the official X composer.
*   **📱 Responsive & Fluid UI**: Tailored dark-mode theme utilizing the *Plus Jakarta Sans* font, featuring glassmorphism, responsive grid layout, and toast notification alerts.

---

## 📁 Project Structure

```
bg-releases-notes/
│
├── app.py                 # Flask server, Atom feed fetcher, and API endpoint
├── requirements.txt       # Python package dependencies (Flask)
├── .gitignore             # Standard git exclusions (pycache, envs, IDEs)
├── README.md              # Project documentation (this file)
│
├── templates/
│   └── index.html         # Main dashboard layout and modal containers
│
└── static/
    ├── css/
    │   └── style.css      # Custom HSL-based design system and animations
    └── js/
        └── main.js        # Feed renderer, client search, and composer logic
```

---

## 🛠️ Local Installation & Run Guide

### Prerequisites
*   Python 3.8 or higher installed on your system.
*   Git command line tool.

### 1. Clone the repository
```bash
git clone https://github.com/saipraneethpb1/saipraneeth-15may-2026-event-talks-app.git
cd bg-releases-notes
```

### 2. Set up Virtual Environment (Optional but Recommended)
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Application
```bash
python app.py
```

### 5. Access the Web UI
Open your web browser and navigate to:
🌐 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🔌 API Documentation

### Get Release Notes
*   **URL**: `/api/notes`
*   **Method**: `GET`
*   **Query Parameters**: 
    *   `refresh` (optional): Set to `true` to force bypass cache and fetch directly from Google Cloud.
*   **Response Format**: `JSON`
*   **Example Response**:
    ```json
    {
      "source": "network",
      "last_updated": 1781561000.123,
      "data": [
        {
          "id": "entry-0",
          "date": "June 15, 2026",
          "updated": "2026-06-15T00:00:00-07:00",
          "link": "https://docs.cloud.google.com/bigquery/docs/release-notes#June_15_2026",
          "updates": [
            {
              "type": "Feature",
              "description": "<p>Use Gemini Cloud Assist to analyze SQL...</p>"
            }
          ]
        }
      ]
    }
    ```

---

## 📄 License
This project is open-source and available under the [MIT License](https://opensource.org/licenses/MIT).
