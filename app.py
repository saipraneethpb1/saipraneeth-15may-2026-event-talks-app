import os
import urllib.request
import xml.etree.ElementTree as ET
import time
from html.parser import HTMLParser
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Cache structure to avoid fetching the feed on every page load
cache = {
    'data': None,
    'last_updated': 0,
    'expiry': 3600  # Cache expiry in seconds (1 hour)
}

class FeedContentParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.updates = []
        self.current_type = None
        self.current_content = []
        self.in_h3 = False
        
    def handle_starttag(self, tag, attrs):
        if tag == 'h3':
            self.in_h3 = True
            self._flush_current()
            self.current_type = ""
        else:
            if self.current_type is None:
                self.current_type = "General"
            
            # Format opening tag, correcting any relative links
            attr_parts = []
            for k, v in attrs:
                if k == 'href' and v.startswith('/'):
                    # Convert relative Google Cloud docs links to absolute URLs
                    v = "https://cloud.google.com" + v
                attr_parts.append(f'{k}="{v}"')
            attr_str = " " + " ".join(attr_parts) if attr_parts else ""
            self.current_content.append(f"<{tag}{attr_str}>")

    def handle_endtag(self, tag):
        if tag == 'h3':
            self.in_h3 = False
            self.current_type = self.current_type.strip()
        else:
            if self.current_type is None:
                self.current_type = "General"
            self.current_content.append(f"</{tag}>")

    def handle_data(self, data):
        if self.in_h3:
            self.current_type += data
        else:
            if self.current_type is None:
                self.current_type = "General"
            self.current_content.append(data)
            
    def _flush_current(self):
        if self.current_type and self.current_content:
            content_str = "".join(self.current_content).strip()
            if content_str:
                self.updates.append({
                    'type': self.current_type,
                    'description': content_str
                })
        self.current_content = []
        
    def close(self):
        super().close()
        self._flush_current()

def fetch_and_parse_feed():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    
    # Configure request headers to mimic a browser/client request
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    )
    
    with urllib.request.urlopen(req, timeout=15) as response:
        xml_data = response.read()
        
    root = ET.fromstring(xml_data)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    for idx, entry in enumerate(root.findall('atom:entry', ns)):
        title = entry.find('atom:title', ns).text
        updated = entry.find('atom:updated', ns).text
        
        link_elem = entry.find('atom:link[@rel="alternate"]', ns)
        link = link_elem.get('href') if link_elem is not None else "https://cloud.google.com/bigquery/docs/release-notes"
        
        content_elem = entry.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ""
        
        # Parse content HTML into separate updates
        parser = FeedContentParser()
        parser.feed(content_html)
        parser.close()
        
        # If no updates were parsed, use a fallback
        updates = parser.updates
        if not updates and content_html.strip():
            updates = [{
                'type': 'General',
                'description': content_html.strip()
            }]
            
        entries.append({
            'id': f"entry-{idx}",
            'date': title,
            'updated': updated,
            'link': link,
            'updates': updates
        })
        
    return entries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def get_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    # Check if cache is still valid
    if not force_refresh and cache['data'] is not None and (current_time - cache['last_updated'] < cache['expiry']):
        return jsonify({
            'source': 'cache',
            'last_updated': cache['last_updated'],
            'data': cache['data']
        })
        
    try:
        data = fetch_and_parse_feed()
        cache['data'] = data
        cache['last_updated'] = current_time
        return jsonify({
            'source': 'network',
            'last_updated': current_time,
            'data': data
        })
    except Exception as e:
        # Fallback to cache if request fails, otherwise return error
        if cache['data'] is not None:
            return jsonify({
                'source': 'cache_fallback',
                'error': str(e),
                'last_updated': cache['last_updated'],
                'data': cache['data']
            })
        return jsonify({
            'error': f"Failed to fetch feed: {str(e)}"
        }), 500

if __name__ == '__main__':
    # Use environment variables if available
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
