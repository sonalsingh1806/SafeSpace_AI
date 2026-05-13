// SafeSpace AI Dashboard JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize dashboard
    initializeDashboard();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load user data
    loadUserData();
});

const MOOD_LEVELS = [
    { value: 0, key: 'happy', label: 'Happy', color: '#7bc8a4' },
    { value: 1, key: 'neutral', label: 'Neutral', color: '#8db1ff' },
    { value: 2, key: 'anxious', label: 'Anxious', color: '#d8a1ff' },
    { value: 3, key: 'uneasy', label: 'Uneasy', color: '#f6b48d' },
    { value: 4, key: 'not_ok', label: 'Not OK', color: '#f28fb3' }
];

function initializeDashboard() {
    console.log('SafeSpace AI Dashboard initialized');
    
    // Add smooth animations
    animateCards();
    
    // Set current time
    updateTime();
}

function setupEventListeners() {
    // Mood intensity slider
    const moodSlider = document.getElementById('moodSlider');
    if (moodSlider) {
        moodSlider.addEventListener('input', function() {
            updateMoodMeter(Number(this.value), true);
        });
    }
    
    // Action buttons
    const actionButtons = document.querySelectorAll('.action-btn');
    actionButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            handleActionClick(this);
        });
    });
    
    // Resource links
    const resourceLinks = document.querySelectorAll('.resource-link');
    resourceLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            handleResourceClick(this);
        });
    });
}

function updateMoodMeter(value, persist = false) {
    const moodSlider = document.getElementById('moodSlider');
    const moodLevelLabel = document.getElementById('moodLevelLabel');
    if (!moodSlider || !moodLevelLabel) {
        return;
    }

    const safeValue = Math.max(0, Math.min(4, value));
    const moodLevel = MOOD_LEVELS[safeValue];
    const percent = (safeValue / 4) * 100;

    moodSlider.value = String(safeValue);
    moodLevelLabel.textContent = moodLevel.label;
    moodLevelLabel.style.background = `${moodLevel.color}33`;
    moodLevelLabel.style.borderColor = `${moodLevel.color}66`;
    moodLevelLabel.style.color = moodLevel.color;
    moodSlider.style.background = `linear-gradient(to right, ${moodLevel.color} 0%, ${moodLevel.color} ${percent}%, rgba(255,255,255,0.35) ${percent}%, rgba(255,255,255,0.35) 100%)`;

    if (persist) {
        localStorage.setItem('currentMood', JSON.stringify({
            mood: moodLevel.key,
            moodValue: safeValue,
            moodLabel: moodLevel.label,
            timestamp: new Date().toISOString()
        }));
        showMoodFeedback(moodLevel.key);
    }
}

function showMoodFeedback(mood) {
    // Create temporary feedback element
    const feedback = document.createElement('div');
    feedback.className = 'mood-feedback';
    feedback.textContent = getMoodMessage(mood);
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--primary-sage);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(feedback);
    
    // Remove after 3 seconds
    setTimeout(() => {
        feedback.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(feedback);
        }, 300);
    }, 3000);
}

function getMoodMessage(mood) {
    const messages = {
        'happy': 'Wonderful! Keep up the positive energy! 🌟',
        'neutral': 'Thanks for checking in. A neutral day is completely okay. 💙',
        'anxious': 'I\'m here to help. Let\'s work through this together. 🤗',
        'uneasy': 'Thanks for sharing this. Let\'s slow down and reset together. 🌿',
        'not_ok': 'I\'m here with you. Let\'s take one small step together right now. 💙'
    };
    return messages[mood] || 'Thank you for sharing how you feel.';
}

function handleActionClick(button) {
    const actionText = button.querySelector('.btn-text').textContent;
    
    // Add click animation
    button.style.transform = 'scale(0.95)';
    setTimeout(() => {
        button.style.transform = '';
    }, 150);
    
    // Handle different actions
    switch(actionText) {
        case 'Music Therapy':
            startCalmingMusic();
            break;
    }
}

function startCalmingMusic() {
    if (typeof window.toggleSoundCloudWidget === 'function') {
        const state = window.toggleSoundCloudWidget();

        if (state === 'opened') {
            showNotification('Opening calming music...', 'info');
        } else {
            showNotification('Closing calming music...', 'info');
        }
    }
}

function handleResourceClick(link) {
    const resourceText = link.querySelector('.resource-text')?.textContent?.trim() ?? '';
    
    if (resourceText === 'Calming Sounds') {
        if (typeof window.toggleSoundCloudWidget === 'function') {
            window.toggleSoundCloudWidget();
        }
        return;
    }
    
    // Add click animation
    link.style.transform = 'translateX(8px)';
    setTimeout(() => {
        link.style.transform = '';
    }, 200);
    
    showNotification(`Opening ${resourceText}...`, 'info');
    
    // In a real app, this would open the resource
    setTimeout(() => {
        showNotification(`${resourceText} loaded 📚`, 'success');
    }, 1000);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    const colors = {
        'info': 'var(--accent-blue)',
        'success': 'var(--accent-green)',
        'warning': 'var(--primary-peach)',
        'error': 'var(--primary-blush)'
    };
    
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        font-weight: 500;
        animation: slideInUp 0.3s ease;
        max-width: 300px;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutDown 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function animateCards() {
    const cards = document.querySelectorAll('.dashboard-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.6s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Update any time displays if they exist
    const timeElements = document.querySelectorAll('.current-time');
    timeElements.forEach(element => {
        element.textContent = timeString;
    });
}

function loadUserData() {
    // Load saved mood if available
    const savedMood = localStorage.getItem('currentMood');
    let moodLoaded = false;

    if (savedMood) {
        try {
            const moodData = JSON.parse(savedMood);
            if (typeof moodData.moodValue === 'number') {
                updateMoodMeter(moodData.moodValue);
                moodLoaded = true;
            } else if (moodData.mood) {
                const fallbackIndex = MOOD_LEVELS.findIndex(level => level.key === moodData.mood);
                if (fallbackIndex >= 0) {
                    updateMoodMeter(fallbackIndex);
                    moodLoaded = true;
                }
            }
        } catch (e) {
            console.log('Error loading saved mood:', e);
        }
    }

    if (!moodLoaded) {
        updateMoodMeter(0);
    }
    
    // Simulate loading user progress data
    setTimeout(() => {
        console.log('User data loaded');
    }, 500);
}

