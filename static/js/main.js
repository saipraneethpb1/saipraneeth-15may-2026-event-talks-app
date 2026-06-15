/**
 * BigQuery Release Pulse - Main JavaScript Controller
 * Handles feed fetching, client-side searching/filtering, UI state transitions,
 * and the interactive Tweet composer.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // STATE MANAGEMENT
    // ==========================================================================
    let updatesState = {
        entries: [],          // Raw entries from API
        activeFilter: 'all',  // Current type filter
        searchQuery: '',      // Current search string
        lastUpdated: null     // Last time feed was fetched
    };
    
    let activeTweetData = {
        date: '',
        type: '',
        link: '',
        rawContent: '',
        formattedText: ''
    };

    // ==========================================================================
    // DOM CACHING
    // ==========================================================================
    // Header & Actions
    const btnRefresh = document.getElementById('btn-refresh');
    const iconSync = btnRefresh.querySelector('.icon-sync');
    const cacheStatusText = document.getElementById('cache-status-text');
    
    // Toolbar & Controls
    const searchInput = document.getElementById('search-input');
    const filterTabsContainer = document.getElementById('filter-tabs-container');
    const resultStats = document.getElementById('result-stats');
    
    // Feed States
    const feedLoading = document.getElementById('feed-loading');
    const feedError = document.getElementById('feed-error');
    const feedEmpty = document.getElementById('feed-empty');
    const feedContent = document.getElementById('feed-content');
    const btnRetry = document.getElementById('btn-retry');
    const btnClearFilters = document.getElementById('btn-clear-filters');
    
    // Modal Elements
    const tweetModal = document.getElementById('tweet-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const previewBadge = document.getElementById('preview-badge');
    const previewDate = document.getElementById('preview-date');
    const previewRawContent = document.getElementById('preview-raw-content');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const btnCopyTweet = document.getElementById('btn-copy-tweet');
    const btnSendTweet = document.getElementById('btn-send-tweet');
    const charCountText = document.getElementById('char-count-text');
    const progressRingCircle = document.getElementById('progress-ring-circle');
    
    // Toast
    const toastContainer = document.getElementById('toast-container');

    // ==========================================================================
    // UTILITY FUNCTIONS
    // ==========================================================================
    
    // Toast Notification System
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconSvg = '';
        if (type === 'success') {
            iconSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
        } else {
            iconSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        }
        
        toast.innerHTML = `${iconSvg}<span>${message}</span>`;
        toastContainer.appendChild(toast);
        
        // Fade out and remove
        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.addEventListener('transitionend', () => {
                toast.remove();
            });
        }, 3000);
    }

    // Convert HTML to Plain Text (removes tags, unescapes entities)
    function htmlToPlainText(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        // Clean up formatting
        let text = tempDiv.textContent || tempDiv.innerText || "";
        // Replace multiple spaces/newlines with single space
        return text.replace(/\s+/g, ' ').trim();
    }

    // Format Relative Time (e.g. "5 minutes ago")
    function formatRelativeTime(timestamp) {
        if (!timestamp) return 'Never';
        const diff = Math.floor(Date.now() / 1000 - timestamp);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return new Date(timestamp * 1000).toLocaleDateString();
    }

    // ==========================================================================
    // API ACTIONS
    // ==========================================================================
    async function fetchReleaseNotes(forceRefresh = false) {
        // Update UI states to loading
        feedLoading.classList.remove('hidden');
        feedContent.classList.add('hidden');
        feedError.classList.add('hidden');
        feedEmpty.classList.add('hidden');
        iconSync.classList.add('spinning');
        btnRefresh.disabled = true;
        
        const url = `/api/notes${forceRefresh ? '?refresh=true' : ''}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Server returned code ${response.status}`);
            
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            
            updatesState.entries = result.data || [];
            updatesState.lastUpdated = result.last_updated;
            
            // Update cache status string
            updateCacheStatusDisplay(result.source);
            
            // Render the items
            renderFeed();
            showToast(forceRefresh ? "Feed refreshed from source!" : "Updates loaded successfully.");
        } catch (error) {
            console.error("Fetch Error:", error);
            feedError.classList.remove('hidden');
            feedLoading.classList.add('hidden');
            document.getElementById('error-message').textContent = error.message;
            showToast("Failed to fetch release notes.", "error");
        } finally {
            iconSync.classList.remove('spinning');
            btnRefresh.disabled = false;
        }
    }

    function updateCacheStatusDisplay(source) {
        let sourceLabel = "Cached";
        if (source === 'network') {
            sourceLabel = "Live";
        } else if (source === 'cache_fallback') {
            sourceLabel = "Offline (Cache)";
        }
        
        const timeStr = new Date(updatesState.lastUpdated * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        cacheStatusText.textContent = `${sourceLabel} (Updated ${timeStr})`;
    }

    // ==========================================================================
    // RENDER FUNCTIONS
    // ==========================================================================
    function renderFeed() {
        feedContent.innerHTML = '';
        let totalRendered = 0;
        
        // Filter and Search logic
        updatesState.entries.forEach(entry => {
            // Check if any sub-update in this entry matches filters
            const matchingUpdates = entry.updates.filter(update => {
                // Category Filter Check
                let typeMatches = false;
                if (updatesState.activeFilter === 'all') {
                    typeMatches = true;
                } else if (updatesState.activeFilter === 'Breaking') {
                    // Group 'Breaking' and 'Issue' together under Breaking tab
                    typeMatches = (update.type === 'Breaking' || update.type === 'Issue');
                } else {
                    typeMatches = (update.type === updatesState.activeFilter);
                }
                
                // Search Query Check
                let searchMatches = true;
                if (updatesState.searchQuery.trim() !== '') {
                    const query = updatesState.searchQuery.toLowerCase();
                    const plainContent = htmlToPlainText(update.description).toLowerCase();
                    const titleText = entry.date.toLowerCase();
                    const typeText = update.type.toLowerCase();
                    
                    searchMatches = plainContent.includes(query) || 
                                    titleText.includes(query) || 
                                    typeText.includes(query);
                }
                
                return typeMatches && searchMatches;
            });
            
            if (matchingUpdates.length > 0) {
                // We have matching updates, let's create the timeline node
                const entryElement = document.createElement('article');
                entryElement.className = 'timeline-entry';
                entryElement.setAttribute('data-entry-id', entry.id);
                
                // Create Timeline dot and Header
                entryElement.innerHTML = `
                    <div class="timeline-node"></div>
                    <div class="timeline-date-header">
                        <span class="date-text">${entry.date}</span>
                        <a href="${entry.link}" target="_blank" rel="noopener noreferrer" class="date-link" title="View official release notes for this day">
                            <svg class="icon icon-external" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </a>
                    </div>
                    <div class="entry-updates-list"></div>
                `;
                
                const listContainer = entryElement.querySelector('.entry-updates-list');
                
                // Append each sub-update as a card
                matchingUpdates.forEach((update, idx) => {
                    totalRendered++;
                    const card = document.createElement('div');
                    card.className = 'update-card';
                    card.setAttribute('data-type', update.type);
                    
                    // Format badge classes
                    let badgeClass = 'badge-general';
                    const uType = update.type.toLowerCase();
                    if (uType.includes('feature')) badgeClass = 'badge-feature';
                    else if (uType.includes('change')) badgeClass = 'badge-change';
                    else if (uType.includes('announcement')) badgeClass = 'badge-announcement';
                    else if (uType.includes('breaking') || uType.includes('issue')) badgeClass = 'badge-breaking';
                    
                    card.innerHTML = `
                        <div class="card-header">
                            <span class="badge ${badgeClass}">${update.type}</span>
                            <div class="tweet-action-container">
                                <button class="btn-tweet-action" aria-label="Tweet this specific update">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                    </svg>
                                    <span>Tweet Update</span>
                                </button>
                            </div>
                        </div>
                        <div class="card-content">
                            ${update.description}
                        </div>
                    `;
                    
                    // Wire up Tweet action
                    card.querySelector('.btn-tweet-action').addEventListener('click', () => {
                        openTweetComposer(entry.date, update.type, entry.link, update.description);
                    });
                    
                    listContainer.appendChild(card);
                });
                
                feedContent.appendChild(entryElement);
            }
        });
        
        // Hide loading
        feedLoading.classList.add('hidden');
        
        // Display statistics
        resultStats.textContent = `Showing ${totalRendered} update${totalRendered !== 1 ? 's' : ''}`;
        
        // Display appropriate states
        if (totalRendered === 0) {
            feedEmpty.classList.remove('hidden');
            feedContent.classList.add('hidden');
        } else {
            feedEmpty.classList.add('hidden');
            feedContent.classList.remove('hidden');
        }
    }

    // ==========================================================================
    // SEARCH & FILTER HANDLERS
    // ==========================================================================
    
    // Filter tabs toggle
    filterTabsContainer.addEventListener('click', (e) => {
        const target = e.target.closest('.tab-btn');
        if (!target) return;
        
        // Remove active class from all tabs
        filterTabsContainer.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });
        
        // Set active to clicked tab
        target.classList.add('active');
        target.setAttribute('aria-selected', 'true');
        
        updatesState.activeFilter = target.getAttribute('data-type');
        renderFeed();
    });
    
    // Search input (immediate filtering client-side)
    searchInput.addEventListener('input', (e) => {
        updatesState.searchQuery = e.target.value;
        renderFeed();
    });
    
    // Clear filters action
    btnClearFilters.addEventListener('click', () => {
        clearFilters();
    });
    
    function clearFilters() {
        searchInput.value = '';
        updatesState.searchQuery = '';
        
        // Reset tabs
        filterTabsContainer.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.getAttribute('data-type') === 'all') {
                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-selected', 'false');
            }
        });
        
        updatesState.activeFilter = 'all';
        renderFeed();
    }

    // ==========================================================================
    // TWEET COMPOSER & MODAL LOGIC
    // ==========================================================================
    
    function openTweetComposer(date, type, link, htmlContent) {
        // Keep tracking state
        activeTweetData.date = date;
        activeTweetData.type = type;
        activeTweetData.link = link;
        activeTweetData.rawContent = htmlContent;
        
        // Setup Modal visual info
        previewDate.textContent = date;
        previewBadge.textContent = type;
        
        // Style preview badge appropriately
        previewBadge.className = 'badge';
        const uType = type.toLowerCase();
        if (uType.includes('feature')) previewBadge.classList.add('badge-feature');
        else if (uType.includes('change')) previewBadge.classList.add('badge-change');
        else if (uType.includes('announcement')) previewBadge.classList.add('badge-announcement');
        else if (uType.includes('breaking') || uType.includes('issue')) previewBadge.classList.add('badge-breaking');
        
        previewRawContent.innerHTML = htmlContent;
        
        // Generate Twitter Draft
        const formattedTweet = generateDefaultTweetText(date, type, link, htmlContent);
        tweetTextarea.value = formattedTweet;
        
        // Trigger character count & SVG ring update
        updateCharCount();
        
        // Open modal
        tweetModal.classList.remove('hidden');
        tweetModal.setAttribute('aria-hidden', 'false');
        
        // Prevent body scroll behind modal
        document.body.style.overflow = 'hidden';
        
        // Focus the composer
        tweetTextarea.focus();
    }
    
    function closeTweetComposer() {
        tweetModal.classList.add('hidden');
        tweetModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }
    
    function generateDefaultTweetText(date, type, link, htmlContent) {
        const plainText = htmlToPlainText(htmlContent);
        
        // Emojis for type
        let emoji = '📢';
        const uType = type.toLowerCase();
        if (uType.includes('feature')) emoji = '🚀';
        else if (uType.includes('change')) emoji = '🔄';
        else if (uType.includes('announcement')) emoji = '✨';
        else if (uType.includes('breaking') || uType.includes('issue')) emoji = '⚠️';
        
        // Compose Header and Footer parts
        const header = `${emoji} BigQuery ${type} (${date}):\n\n`;
        const footer = `\n\nRead more: ${link}\n#BigQuery #GoogleCloud`;
        
        // Calculate max description length to fit X's 280-char limit
        const baseLength = header.length + footer.length;
        const availableLength = 280 - baseLength;
        
        let displayDesc = plainText;
        if (plainText.length > availableLength) {
            // Need to truncate description
            displayDesc = plainText.substring(0, availableLength - 3) + '...';
        }
        
        return `${header}${displayDesc}${footer}`;
    }
    
    function updateCharCount() {
        const text = tweetTextarea.value;
        const charCount = text.length;
        const limit = 280;
        const remaining = limit - charCount;
        
        // Update character count label text
        charCountText.textContent = remaining;
        
        // Manage circular progress ring
        const radius = 14;
        const circumference = 2 * Math.PI * radius; // Approx 87.96
        
        progressRingCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        
        if (remaining >= 0) {
            const percent = (charCount / limit) * 100;
            const offset = circumference - (percent / 100) * circumference;
            progressRingCircle.style.strokeDashoffset = offset;
            
            // Adjust coloring
            if (remaining <= 20) {
                progressRingCircle.style.stroke = '#eab308'; // Warning Yellow
                charCountText.className = 'char-count-text warn';
            } else {
                progressRingCircle.style.stroke = '#1d9bf0'; // Twitter Blue
                charCountText.className = 'char-count-text';
            }
        } else {
            // Exceeded limit
            progressRingCircle.style.strokeDashoffset = 0;
            progressRingCircle.style.stroke = '#ef4444'; // Error Red
            charCountText.className = 'char-count-text error';
        }
    }
    
    // Copy Tweet action
    btnCopyTweet.addEventListener('click', async () => {
        const text = tweetTextarea.value;
        try {
            await navigator.clipboard.writeText(text);
            showToast("Tweet copied to clipboard!");
            
            // Visual feedback on copy button
            const originalHTML = btnCopyTweet.innerHTML;
            btnCopyTweet.innerHTML = `
                <svg class="icon icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Copied!</span>
            `;
            btnCopyTweet.disabled = true;
            
            setTimeout(() => {
                btnCopyTweet.innerHTML = originalHTML;
                btnCopyTweet.disabled = false;
            }, 2000);
        } catch (err) {
            console.error("Clipboard copy failed:", err);
            showToast("Failed to copy to clipboard.", "error");
        }
    });
    
    // Send Tweet (Open X Intent)
    btnSendTweet.addEventListener('click', () => {
        const text = tweetTextarea.value;
        if (text.length > 280) {
            showToast("Tweet exceeds 280 character limit!", "error");
            return;
        }
        
        const intentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(intentUrl, '_blank', 'noopener,noreferrer');
        showToast("Opening X Web Composer...");
        closeTweetComposer();
    });
    
    // Character counter hook
    tweetTextarea.addEventListener('input', updateCharCount);
    
    // Modal closing events
    btnCloseModal.addEventListener('click', closeTweetComposer);
    
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeTweetComposer();
        }
    });
    
    // Key bindings (Esc to close modal)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !tweetModal.classList.contains('hidden')) {
            closeTweetComposer();
        }
    });

    // ==========================================================================
    // INITIALIZATION & RELOADING
    // ==========================================================================
    
    // Pull refresh click handler
    btnRefresh.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });
    
    // Retry fetch click handler
    btnRetry.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });
    
    // Initial fetch on mount
    fetchReleaseNotes(false);
});
