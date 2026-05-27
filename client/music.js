// SafeSpace AI — Calming Sounds (YouTube popup)
// To swap a track, replace its `id` with any YouTube video ID.

const TRACKS = [
    { label: '🌧️ Rain',        id: 'nMfPqeZjc2c' },
    { label: '🤍 White Noise', id: '1ZYbU82GVz4' },
    { label: '💤 Sleep',       id: 'lFcSrYw-ARY' },
];

let currentTrackIndex = 0;
let playerReady = false;

function buildYouTubeUrl(id) {
    return `https://www.youtube.com/embed/${id}?loop=1&playlist=${id}&controls=1&rel=0&autoplay=1&modestbranding=1`;
}

function renderIframe(container, id) {
    const existing = container.querySelector('iframe');
    const newSrc   = buildYouTubeUrl(id);
    if (existing) {
        existing.src = newSrc;
    } else {
        const iframe = document.createElement('iframe');
        iframe.src = newSrc;
        iframe.setAttribute('width', '100%');
        iframe.setAttribute('height', '100%');
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
        iframe.setAttribute('allowfullscreen', '');
        container.appendChild(iframe);
    }
}

function buildTrackBar(shell, container) {
    // Only build once
    if (shell.querySelector('.sounds-track-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'sounds-track-bar';
    TRACKS.forEach(function (track, i) {
        const btn = document.createElement('button');
        btn.className = 'sounds-track-btn' + (i === currentTrackIndex ? ' active' : '');
        btn.textContent = track.label;
        btn.addEventListener('click', function () {
            currentTrackIndex = i;
            bar.querySelectorAll('.sounds-track-btn').forEach(b => b.classList.toggle('active', b === btn));
            renderIframe(container, track.id);
        });
        bar.appendChild(btn);
    });
    shell.insertBefore(bar, shell.querySelector('.sounds-float-header').nextSibling);
}

// Legacy shim
window.toggleSoundCloudWidget = function () {};

document.addEventListener('DOMContentLoaded', function () {
    const bunnyBtn    = document.getElementById('soundsBunnyBtn');
    const shell       = document.getElementById('soundsPlayerShell');
    const container   = document.getElementById('soundcloud-container');
    const floatHeader = document.getElementById('soundsFloatHeader');
    const collapseBtn = document.getElementById('soundsCollapseBtn');
    const dockBtn     = document.getElementById('soundsDockBtn');

    if (!shell || !container || !bunnyBtn) return;

    function openPlayer() {
        // Clear any stale inline position from a previous drag so the CSS
        // class always positions it freshly at bottom-right.
        shell.style.cssText = '';
        shell.classList.add('open');
        shell.classList.remove('collapsed');
        collapseBtn.textContent = '▾';
        bunnyBtn.classList.add('active');
        // Build track bar + load first track on first open
        buildTrackBar(shell, container);
        if (!playerReady) {
            renderIframe(container, TRACKS[currentTrackIndex].id);
            playerReady = true;
        }
    }

    function closePlayer() {
        shell.classList.remove('open', 'collapsed');
        bunnyBtn.classList.remove('active');
        shell.style.cssText = '';
    }

    // Bunny opens the popup
    bunnyBtn.addEventListener('click', openPlayer);

    // Close / dock back
    dockBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closePlayer();
    });

    // Collapse
    collapseBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        shell.classList.toggle('collapsed');
        collapseBtn.textContent = shell.classList.contains('collapsed') ? '▸' : '▾';
    });

    floatHeader.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        shell.classList.toggle('collapsed');
        collapseBtn.textContent = shell.classList.contains('collapsed') ? '▸' : '▾';
    });
});
