// SafeSpace AI Dashboard JavaScript

document.addEventListener('DOMContentLoaded', function() {
    mountGhibliFixedScene();
    mountGhibliBackgrounds();
    buildCinematicLotus();
    buildTitleLotus();
    // Initialize dashboard
    initializeDashboard();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load user data
    loadUserData();
});

// Soft, translucent lotus emblem that sits behind the SafeSpace AI title.
// Static (no animation) so it doesn't compete with the breathing lotus.
function buildTitleLotus() {
    const svg = document.getElementById('titleLotus');
    if (!svg) return;

    // Slightly stylised petal — softer curves, smaller than the breathing lotus.
    const PETAL = 'M -8,0 C -14,-22 -15,-50 -11,-72 C -7,-86 -3,-94 0,-96 C 3,-94 7,-86 11,-72 C 15,-50 14,-22 8,0 Q 0,4 -8,0 Z';

    function ring(count, offsetDeg, scale, fill, opacity) {
        let out = '';
        for (let i = 0; i < count; i++) {
            const angle = offsetDeg + (360 / count) * i;
            out += `
                <g transform="translate(100,100) rotate(${angle}) scale(${scale})">
                    <path d="${PETAL}" fill="${fill}" opacity="${opacity}"/>
                </g>`;
        }
        return out;
    }

    svg.innerHTML = `
        <defs>
            <radialGradient id="tlBloom" cx="50%" cy="55%" r="55%">
                <stop offset="0%"   stop-color="#fff0d2" stop-opacity="0.85"/>
                <stop offset="45%"  stop-color="#ffc8c4" stop-opacity="0.45"/>
                <stop offset="80%"  stop-color="#d8a8d4" stop-opacity="0.18"/>
                <stop offset="100%" stop-color="#c898c8" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="tlPetalFront" x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%"   stop-color="#dd8aa6"/>
                <stop offset="40%"  stop-color="#f9b6bc"/>
                <stop offset="75%"  stop-color="#ffd6c2"/>
                <stop offset="100%" stop-color="#fff1d6"/>
            </linearGradient>
            <linearGradient id="tlPetalMid" x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%"   stop-color="#c478a0"/>
                <stop offset="45%"  stop-color="#ecb0b6"/>
                <stop offset="100%" stop-color="#ffe2c0"/>
            </linearGradient>
            <linearGradient id="tlPetalBack" x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%"   stop-color="#9a78aa"/>
                <stop offset="50%"  stop-color="#d4b0c4"/>
                <stop offset="100%" stop-color="#fadfd2"/>
            </linearGradient>
            <radialGradient id="tlCore" cx="50%" cy="42%" r="62%">
                <stop offset="0%"   stop-color="#fff8d0"/>
                <stop offset="55%"  stop-color="#ffd286"/>
                <stop offset="100%" stop-color="#c98a3a"/>
            </radialGradient>
            <filter id="tlSoft" x="-15%" y="-15%" width="130%" height="130%">
                <feGaussianBlur stdDeviation="0.6"/>
            </filter>
        </defs>

        <!-- Soft glow halo behind the lotus -->
        <circle cx="100" cy="100" r="92" fill="url(#tlBloom)"/>

        <g filter="url(#tlSoft)">
            <!-- Back petals: lavender, widest -->
            ${ring(9,  0,    1.0,  'url(#tlPetalBack)',  0.85)}
            <!-- Mid petals: warm rose-peach, offset between back petals -->
            ${ring(7,  25.7, 0.82, 'url(#tlPetalMid)',   0.9)}
            <!-- Front petals: soft pink, smallest -->
            ${ring(5,  0,    0.62, 'url(#tlPetalFront)', 0.95)}
        </g>

        <!-- Tiny golden seed pod -->
        <circle cx="100" cy="100" r="11" fill="url(#tlCore)" opacity="0.9"/>
        <circle cx="97"  cy="97"  r="4"  fill="#fff6d6" opacity="0.6"/>
    `;
}

function buildCinematicLotus() {
    const svg = document.getElementById('lotusSvg');
    if (!svg) return;

    // --- Petal silhouette --------------------------------------------------
    // Elegant almond shape: slim base, swells in the middle, tapers to a
    // soft point. Base at y=0, tip at y=-98. Gently asymmetrical curves so
    // it reads as hand-painted rather than mechanical.
    const PETAL  = 'M -7,0 C -13,-22 -15,-52 -11,-74 C -7,-88 -3,-95 0,-98 C 3,-95 7,-88 11,-74 C 15,-52 13,-22 7,0 Q 0,4 -7,0 Z';

    // Broad inner light that runs from mid-petal toward the tip (watercolor sheen).
    const STREAK = 'M -3,-22 C -4,-50 -2,-76 0,-90 C 2,-76 4,-50 3,-22 Q 0,-18 -3,-22 Z';

    // Soft dark shadow sitting at the petal base — simulates the cast shadow
    // where the petal tucks under the next ring. This is what really sells the depth.
    const BASESHADOW = 'M -7,-2 C -6,-14 -3,-20 0,-20 C 3,-20 6,-14 7,-2 Q 0,3 -7,-2 Z';

    // Very soft white rim at the very tip (painterly watercolor highlight).
    const TIPLIGHT   = 'M -2,-82 C -1.5,-90 -0.5,-96 0,-98 C 0.5,-96 1.5,-90 2,-82 Q 0,-80 -2,-82 Z';

    // Thin vein running up from the base (pigment line).
    const VEIN   = 'M 0,-6 C -1,-28 1,-56 0,-80';

    // ringPhase offsets when a whole ring begins its open-close cycle
    // (outer petals lead; inner petals trail — like a real bloom).
    function ring(count, offsetDeg, scale, translateY, opts, ringPhase, className) {
        const { fill, highlightOp, veinOp, shadowOp, tipOp, edgeStroke } = opts;
        let out = `<g class="${className}" filter="url(#lotusWatercolor)">`;
        for (let i = 0; i < count; i++) {
            const angle = offsetDeg + (360 / count) * i;
            const jitter = ((i * 37) % 5) * 0.01;        // tiny size jitter for organic feel
            const s = (scale + jitter).toFixed(3);
            // within a ring, petals stagger slightly so the bloom isn't mechanical
            const microStagger = ((i * 0.05) % 0.25);
            const delay = (ringPhase + microStagger).toFixed(2);
            out += `
                <g transform="translate(100,${100 + translateY}) rotate(${angle}) scale(${s})">
                    <g class="petal" style="animation-delay: ${delay}s;">
                        <path d="${PETAL}" fill="${fill}" stroke="${edgeStroke}" stroke-width="0.55" stroke-linejoin="round"/>
                        <path d="${BASESHADOW}" fill="url(#petalBaseShadow)" opacity="${shadowOp}"/>
                        <path d="${VEIN}"   stroke="rgba(140,50,70,0.22)" stroke-width="0.4" fill="none" opacity="${veinOp}"/>
                        <path d="${STREAK}" fill="url(#petalHighlight)" opacity="${highlightOp}"/>
                        <path d="${TIPLIGHT}" fill="url(#petalTipLight)" opacity="${tipOp}"/>
                    </g>
                </g>`;
        }
        out += `</g>`;
        return out;
    }

    const defs = `
        <defs>
            <!-- Front petals: deeper rose at base, soft peach-cream toward tip -->
            <linearGradient id="petalFront" x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%"   stop-color="#c85a7c"/>
                <stop offset="18%"  stop-color="#e28299"/>
                <stop offset="42%"  stop-color="#f8b2b6"/>
                <stop offset="68%"  stop-color="#ffd2c0"/>
                <stop offset="88%"  stop-color="#ffe8c8"/>
                <stop offset="100%" stop-color="#fff6e2"/>
            </linearGradient>
            <!-- Mid petals: rose → peach → gold wash -->
            <linearGradient id="petalMid" x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%"   stop-color="#a84b72"/>
                <stop offset="22%"  stop-color="#d27a94"/>
                <stop offset="50%"  stop-color="#f0a9aa"/>
                <stop offset="75%"  stop-color="#fbcfa0"/>
                <stop offset="95%"  stop-color="#ffe6bd"/>
                <stop offset="100%" stop-color="#fff0cc"/>
            </linearGradient>
            <!-- Back petals: lavender → dusty rose → warm blush -->
            <linearGradient id="petalBack" x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%"   stop-color="#6d4c86"/>
                <stop offset="25%"  stop-color="#9a74a2"/>
                <stop offset="55%"  stop-color="#c999b6"/>
                <stop offset="85%"  stop-color="#ebc2c8"/>
                <stop offset="100%" stop-color="#f8dcd6"/>
            </linearGradient>

            <!-- Broad watercolor sheen down the length of the petal -->
            <linearGradient id="petalHighlight" x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%"   stop-color="#ffffff" stop-opacity="0"/>
                <stop offset="40%"  stop-color="#ffffff" stop-opacity="0.35"/>
                <stop offset="78%"  stop-color="#fff4d6" stop-opacity="0.6"/>
                <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
            </linearGradient>

            <!-- Soft cream rim at the very tip — the "lit edge" -->
            <radialGradient id="petalTipLight" cx="50%" cy="100%" r="80%">
                <stop offset="0%"   stop-color="#fffaeb" stop-opacity="0.9"/>
                <stop offset="70%"  stop-color="#fff0cc" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
            </radialGradient>

            <!-- Dark wash at the petal base (depth between layers) -->
            <radialGradient id="petalBaseShadow" cx="50%" cy="0%" r="100%">
                <stop offset="0%"   stop-color="#6a2840" stop-opacity="0.55"/>
                <stop offset="55%"  stop-color="#a94868" stop-opacity="0.15"/>
                <stop offset="100%" stop-color="#a94868" stop-opacity="0"/>
            </radialGradient>

            <!-- Domed golden seed pod -->
            <radialGradient id="lotusCore" cx="50%" cy="32%" r="70%">
                <stop offset="0%"   stop-color="#fff8c8"/>
                <stop offset="28%"  stop-color="#ffe38a"/>
                <stop offset="62%"  stop-color="#e8aa4a"/>
                <stop offset="88%"  stop-color="#a86820"/>
                <stop offset="100%" stop-color="#5c3410"/>
            </radialGradient>

            <!-- Tiny specular highlight on the seed pod -->
            <radialGradient id="lotusCoreHighlight" cx="42%" cy="28%" r="45%">
                <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.9"/>
                <stop offset="55%"  stop-color="#fff6c4" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#fff6c4" stop-opacity="0"/>
            </radialGradient>

            <!-- Outer pink bloom -->
            <radialGradient id="lotusHaloOuter" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stop-color="#ffd4e0" stop-opacity="0.65"/>
                <stop offset="40%"  stop-color="#f5b6c2" stop-opacity="0.3"/>
                <stop offset="75%"  stop-color="#d9a8c8" stop-opacity="0.1"/>
                <stop offset="100%" stop-color="#c998c8" stop-opacity="0"/>
            </radialGradient>

            <!-- Inner gold halo around the seed pod -->
            <radialGradient id="lotusHaloGold" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stop-color="#fff3c6" stop-opacity="0.9"/>
                <stop offset="55%"  stop-color="#ffd8a2" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#ffb890" stop-opacity="0"/>
            </radialGradient>

            <!-- Soft watercolor edge on every petal -->
            <filter id="lotusWatercolor" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="0.55"/>
            </filter>
        </defs>
    `;

    // Ring style presets
    const backOpts = {
        fill:         'url(#petalBack)',
        highlightOp:  0.5,
        veinOp:       0.55,
        shadowOp:     0.9,
        tipOp:        0.55,
        edgeStroke:   'rgba(125,70,105,0.24)'
    };
    const midOpts  = {
        fill:         'url(#petalMid)',
        highlightOp:  0.7,
        veinOp:       0.4,
        shadowOp:     0.75,
        tipOp:        0.7,
        edgeStroke:   'rgba(160,66,86,0.22)'
    };
    const frontOpts = {
        fill:         'url(#petalFront)',
        highlightOp:  0.9,
        veinOp:       0.3,
        shadowOp:     0.55,
        tipOp:        0.85,
        edgeStroke:   'rgba(180,80,110,0.18)'
    };

    svg.innerHTML = `
        ${defs}

        <!-- Ambient bloom rings (behind everything) -->
        <circle class="lotus-halo-ring outer" cx="100" cy="100" r="96" fill="url(#lotusHaloOuter)"/>
        <circle class="lotus-halo-ring inner" cx="100" cy="100" r="56" fill="url(#lotusHaloGold)"/>

        <!-- Layered petal rings: back → mid → front.
             9 outer + 7 mid + 5 front gives the classic layered lotus fullness
             without the silhouette reading as a gear. -->
        ${ring(9,   0, 1.02, -3, backOpts,  0.0,  'lotus-back')}
        ${ring(7,  25.7, 0.88, 1, midOpts,   0.28, 'lotus-mid')}
        ${ring(5,   0, 0.72,  5, frontOpts, 0.55, 'lotus-front')}

        <!-- Warm golden pool around the seed pod -->
        <circle class="lotus-core-glow" cx="100" cy="100" r="24" fill="url(#lotusHaloGold)" opacity="0.8"/>

        <!-- Domed seed pod with subtle rim shadow -->
        <g class="lotus-core">
            <ellipse cx="100" cy="102" rx="14" ry="12.5" fill="url(#lotusCore)" stroke="rgba(80,38,12,0.35)" stroke-width="0.6"/>
            <!-- Specular highlight giving it a 3D dome feel -->
            <ellipse cx="97" cy="97" rx="8" ry="6" fill="url(#lotusCoreHighlight)"/>
            <!-- Tiny bottom shadow crescent -->
            <path d="M 87,106 Q 100,114 113,106 Q 100,111 87,106 Z" fill="rgba(70,30,10,0.22)"/>
        </g>

        <!-- Stamen: a ring of golden-brown anthers on top of the pod -->
        <g class="lotus-stamen">
            <circle cx="100"    cy="90"  r="1.7" fill="#8a5820"/>
            <circle cx="107"    cy="92"  r="1.5" fill="#8a5820"/>
            <circle cx="93"     cy="92"  r="1.5" fill="#8a5820"/>
            <circle cx="104"    cy="98"  r="1.3" fill="#8a5820"/>
            <circle cx="96"     cy="98"  r="1.3" fill="#8a5820"/>
            <circle cx="100"    cy="104" r="1.4" fill="#8a5820"/>
            <circle cx="110"    cy="100" r="1.2" fill="#8a5820"/>
            <circle cx="90"     cy="100" r="1.2" fill="#8a5820"/>
            <!-- Cream pollen highlights -->
            <circle cx="100"    cy="92"  r="0.9" fill="#fff4c4" opacity="0.9"/>
            <circle cx="105.5"  cy="94"  r="0.8" fill="#fff4c4" opacity="0.85"/>
            <circle cx="94.5"   cy="94"  r="0.8" fill="#fff4c4" opacity="0.85"/>
            <circle cx="102"    cy="99.5" r="0.7" fill="#fff4c4" opacity="0.8"/>
            <circle cx="98"     cy="99.5" r="0.7" fill="#fff4c4" opacity="0.8"/>
        </g>
    `;
}

function mountGhibliFixedScene() {
    if (document.querySelector('.ghibli-scene-fixed')) return;
    const scene = document.createElement('div');
    scene.className = 'ghibli-scene-fixed';
    scene.setAttribute('aria-hidden', 'true');

    // Tiny seeded RNG so layout is stable across reloads but feels organic.
    let _seed = 1337;
    const rand  = () => { _seed = (_seed * 9301 + 49297) % 233280; return _seed / 233280; };
    const rng   = (a, b) => a + (b - a) * rand();
    const rngI  = (a, b) => Math.floor(rng(a, b + 1));

    // ---- Dust motes: warm pastel colours, randomised across the sky ----
    const moteColors = ['gold', 'peach', 'pink', 'lavender'];
    let motes = '';
    for (let i = 0; i < 32; i++) {
        const c = moteColors[i % moteColors.length];
        const top = rng(8, 88).toFixed(1);
        const left = rng(2, 98).toFixed(1);
        const size = rng(3, 7).toFixed(1);
        const dur = rng(22, 42).toFixed(1);
        const delay = (-rng(0, 30)).toFixed(1);
        const op = rng(0.4, 0.85).toFixed(2);
        motes += `<span class="gsf-mote gsf-mote-${c}" style="top:${top}%;left:${left}%;width:${size}px;height:${size}px;opacity:${op};animation-duration:${dur}s;animation-delay:${delay}s;"></span>`;
    }

    // ---- Drifting flower petals: cross the screen on the breeze ----
    const petalColors = ['pink', 'peach', 'lavender', 'rose'];
    let petals = '';
    for (let i = 0; i < 14; i++) {
        const c = petalColors[i % petalColors.length];
        const top = rng(5, 65).toFixed(1);            // start somewhere above mid screen
        const dur = rng(32, 60).toFixed(1);           // slow drift
        const delay = (-rng(0, 60)).toFixed(1);
        const scale = rng(0.6, 1.2).toFixed(2);
        const op = rng(0.55, 0.85).toFixed(2);
        const dir = i % 2 === 0 ? 'gsf-petal-drift-a' : 'gsf-petal-drift-b';
        // Scale is exposed as a CSS variable so the drift keyframes can
        // compose it with translate+rotate without the inline transform
        // being clobbered by the animation.
        petals += `
            <svg class="gsf-petal gsf-petal-${c} ${dir}" viewBox="0 0 24 32" aria-hidden="true"
                 style="top:${top}%;animation-duration:${dur}s;animation-delay:${delay}s;opacity:${op};--gsf-petal-scale:${scale};">
                <path d="M12,2 C 18,8 22,18 12,30 C 2,18 6,8 12,2 Z"/>
            </svg>`;
    }

    // ---- Fireflies: tiny glowing orbs near the lower edge that pulse softly ----
    let fireflies = '';
    for (let i = 0; i < 14; i++) {
        const left = rng(2, 98).toFixed(1);
        const bottom = rng(4, 28).toFixed(1);
        const dur = rng(4.5, 9).toFixed(1);          // pulse cycle
        const driftDur = rng(14, 28).toFixed(1);     // drift cycle
        const delay = (-rng(0, 8)).toFixed(1);
        const size = rng(3, 6).toFixed(1);
        fireflies += `
            <span class="gsf-firefly" style="left:${left}%;bottom:${bottom}%;width:${size}px;height:${size}px;animation-duration:${dur}s,${driftDur}s;animation-delay:${delay}s,${delay}s;"></span>`;
    }

    scene.innerHTML = `
        <div class="gsf-sky"></div>
        <div class="gsf-skyglow"></div>
        <div class="gsf-rays"></div>
        <div class="gsf-sun"></div>
        <div class="gsf-glow"></div>

        <!-- Distant lavender mountains (deepest layer of cinematic depth) -->
        <svg class="gsf-mountains gsf-mountains-far" viewBox="0 0 1440 360" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,260 L80,200 L160,235 L240,170 L340,225 L440,150 L540,210 L640,175 L740,220 L860,155 L980,200 L1100,170 L1200,215 L1320,180 L1440,225 L1440,360 L0,360 Z"/>
        </svg>
        <svg class="gsf-mountains gsf-mountains-near" viewBox="0 0 1440 360" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,290 L120,230 L220,270 L340,210 L460,260 L580,200 L700,255 L820,215 L940,260 L1060,210 L1180,255 L1300,225 L1440,265 L1440,360 L0,360 Z"/>
        </svg>

        <div class="gsf-cloud-layer">
            <div class="gsf-cloud gsf-cloud-1"></div>
            <div class="gsf-cloud gsf-cloud-2"></div>
            <div class="gsf-cloud gsf-cloud-3"></div>
            <div class="gsf-cloud gsf-cloud-4"></div>
            <div class="gsf-cloud gsf-cloud-5"></div>
            <div class="gsf-cloud gsf-cloud-6"></div>
            <div class="gsf-cloud gsf-cloud-7"></div>
            <div class="gsf-cloud gsf-cloud-8"></div>
            <div class="gsf-cirrus gsf-cirrus-1"></div>
            <div class="gsf-cirrus gsf-cirrus-2"></div>
            <div class="gsf-cirrus gsf-cirrus-3"></div>
        </div>

        <!-- Foreground wisps (closest, softest cloud layer drifting fastest) -->
        <div class="gsf-wisp-layer">
            <div class="gsf-wisp gsf-wisp-1"></div>
            <div class="gsf-wisp gsf-wisp-2"></div>
            <div class="gsf-wisp gsf-wisp-3"></div>
            <div class="gsf-wisp gsf-wisp-4"></div>
        </div>

        <svg class="gsf-hill gsf-hill-far" viewBox="0 0 1440 420" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,260 C160,200 320,180 520,210 C720,240 880,180 1080,200 C1240,215 1360,240 1440,230 L1440,420 L0,420 Z"></path>
        </svg>
        <svg class="gsf-hill gsf-hill-mid" viewBox="0 0 1440 420" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,300 C200,250 380,290 580,300 C780,310 940,260 1140,280 C1280,295 1380,310 1440,300 L1440,420 L0,420 Z"></path>
        </svg>
        <svg class="gsf-hill gsf-hill-near" viewBox="0 0 1440 420" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,340 C200,310 360,360 580,355 C780,350 960,310 1180,340 C1320,358 1400,370 1440,360 L1440,420 L0,420 Z"></path>
        </svg>
        <svg class="gsf-trees" viewBox="0 0 1440 200" preserveAspectRatio="none" aria-hidden="true">
            <g fill="#3a3242">
                <path d="M120,200 L120,140 C120,128 128,118 134,118 C140,118 148,128 148,140 L148,200 Z"/>
                <path d="M134,118 L120,140 L148,140 Z"/>
                <path d="M134,108 L122,134 L146,134 Z"/>
                <path d="M260,200 L260,150 C260,140 266,132 272,132 C278,132 284,140 284,150 L284,200 Z"/>
                <path d="M272,132 L260,150 L284,150 Z"/>
                <path d="M1100,200 L1100,138 C1100,126 1108,116 1114,116 C1120,116 1128,126 1128,138 L1128,200 Z"/>
                <path d="M1114,116 L1100,138 L1128,138 Z"/>
                <path d="M1114,106 L1102,132 L1126,132 Z"/>
                <path d="M1280,200 L1280,154 C1280,144 1286,136 1292,136 C1298,136 1304,144 1304,154 L1304,200 Z"/>
                <path d="M1292,136 L1280,154 L1304,154 Z"/>
            </g>
        </svg>

        <!-- Drifting flower petals: cross the screen on the breeze -->
        <div class="gsf-petal-layer">${petals}</div>

        <!-- Magical floating dust motes -->
        <div class="gsf-particles">${motes}</div>

        <!-- Soft fireflies near the lower edge -->
        <div class="gsf-firefly-layer">${fireflies}</div>

        <div class="gsf-vignette"></div>
        <div class="gsf-grain"></div>
    `;
    document.body.insertBefore(scene, document.body.firstChild);

    // Atmospheric haze near the horizon (between hills and meadow)
    const haze = document.createElement('div');
    haze.className = 'gsf-haze';
    scene.appendChild(haze);

    // Midground meadow — shorter, denser, parallax shifts slowly
    const midMeadow = buildGhibliMeadow({
        variant: 'mid',
        clusters: 48,
        shoots: 0,
        bladeHeight: [50, 90],
        bladeWidth: [1.6, 2.6],
        flowerChance: 0.55,
        flowerHeightRange: [55, 95],
        bladeFill: 'mid',
        opacityRange: [0.55, 0.78]
    });
    scene.appendChild(midMeadow);

    // Foreground swaying meadow with tall shoots
    const fgMeadow = buildGhibliMeadow({
        variant: 'fg',
        clusters: 36,
        shoots: 14,
        bladeHeight: [110, 220],
        bladeWidth: [2.4, 3.8],
        flowerChance: 0.5,
        flowerHeightRange: [130, 200],
        bladeFill: 'fg',
        opacityRange: [0.78, 0.96]
    });
    scene.appendChild(fgMeadow);

    // Subtle foreground nature details: tiny mushrooms, clover sprigs, leaf clusters.
    // Hand-placed so they read as deliberate compositional accents.
    const details = document.createElement('div');
    details.className = 'gsf-nature-details';
    details.setAttribute('aria-hidden', 'true');

    // Reusable inline SVGs
    const mushroom = `
        <svg viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="20" cy="20" rx="17" ry="12" fill="#c75a6b"/>
            <ellipse cx="20" cy="18" rx="17" ry="10" fill="#e07585"/>
            <circle cx="14" cy="14" r="2.4" fill="#fff5e8" opacity="0.85"/>
            <circle cx="24" cy="11" r="1.8" fill="#fff5e8" opacity="0.85"/>
            <circle cx="28" cy="18" r="1.5" fill="#fff5e8" opacity="0.8"/>
            <ellipse cx="20" cy="38" rx="6" ry="12" fill="#fff2dc"/>
            <ellipse cx="20" cy="38" rx="3.5" ry="11" fill="#f5e1c1" opacity="0.6"/>
        </svg>`;
    const clover = `
        <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <g fill="#5e8b4a">
                <ellipse cx="20" cy="14" rx="6" ry="8"/>
                <ellipse cx="13" cy="22" rx="6" ry="8" transform="rotate(-50 13 22)"/>
                <ellipse cx="27" cy="22" rx="6" ry="8" transform="rotate(50 27 22)"/>
            </g>
            <g fill="#7daa5e" opacity="0.85">
                <ellipse cx="20" cy="13" rx="3" ry="5"/>
                <ellipse cx="14" cy="21" rx="3" ry="4" transform="rotate(-50 14 21)"/>
                <ellipse cx="26" cy="21" rx="3" ry="4" transform="rotate(50 26 21)"/>
            </g>
            <path d="M20,22 Q20,32 22,40" stroke="#4a7240" stroke-width="1.6" fill="none"/>
        </svg>`;
    const leafCluster = `
        <svg viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">
            <g fill="#5a7e48">
                <path d="M5,28 Q15,8 28,18 Q18,30 5,28 Z"/>
                <path d="M22,28 Q33,10 46,20 Q35,30 22,28 Z" opacity="0.9"/>
                <path d="M40,28 Q52,14 60,24 Q52,30 40,28 Z" opacity="0.85"/>
            </g>
            <g fill="#86a766" opacity="0.7">
                <path d="M9,25 Q17,14 25,20"/>
                <path d="M26,25 Q34,15 42,21"/>
            </g>
        </svg>`;

    // Each entry: [type, leftPercent, bottomPx, scale, rotateDeg, opacity]
    const placements = [
        ['mushroom',   4,    18, 1.0, -6, 0.92],
        ['mushroom',   6.5,  10, 0.7,  4, 0.85],
        ['clover',    10,    14, 0.9,  0, 0.85],
        ['leafCluster',14,    8, 0.95, 0, 0.85],
        ['mushroom',  22,    16, 0.85, 8, 0.88],
        ['clover',    28,    10, 0.7, -4, 0.8],
        ['leafCluster',38,    6, 1.0,  0, 0.82],
        ['clover',    46,    14, 0.85, 6, 0.82],
        ['mushroom',  62,    12, 0.8, -3, 0.86],
        ['leafCluster',70,    8, 0.9,  0, 0.85],
        ['clover',    78,    16, 0.95,-2, 0.85],
        ['mushroom',  86,    18, 1.0,  5, 0.9],
        ['mushroom',  90,    10, 0.6, -8, 0.8],
        ['leafCluster',96,    6, 0.9,  0, 0.82]
    ];
    const svgs = { mushroom, clover, leafCluster };
    placements.forEach((p, idx) => {
        const [type, leftPct, bottomPx, scale, rotate, opacity] = p;
        const wrap = document.createElement('div');
        wrap.className = `gsf-detail gsf-detail-${type} gsf-detail-${idx + 1}`;
        // Scale and base rotation are exposed as CSS vars so the sway
        // keyframe can compose its small extra rotation on top.
        wrap.style.cssText =
            `left: ${leftPct}%;` +
            `bottom: ${bottomPx}px;` +
            `--gsf-detail-scale: ${scale};` +
            `--gsf-detail-rotate: ${rotate}deg;` +
            `opacity: ${opacity};` +
            `animation-delay: ${(idx * 0.4).toFixed(2)}s;`;
        wrap.innerHTML = svgs[type];
        details.appendChild(wrap);
    });

    scene.appendChild(details);
}

function buildGhibliMeadow(opts = {}) {
    const NS = 'http://www.w3.org/2000/svg';
    const W = 1440;
    const H = 280;
    const groundY = H;
    const svg = document.createElementNS(NS, 'svg');
    const variant = opts.variant || 'fg';
    svg.setAttribute('class', `gsf-meadow gsf-meadow-${variant}`);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');

    const fillIds = variant === 'mid' ? {
        wash: 'gsfGroundWashMid',
        blade: 'gsfBladeMid',
        bladeWarm: 'gsfBladeMidWarm',
        glow: 'gsfFlowerGlowMid'
    } : {
        wash: 'gsfGroundWash',
        blade: 'gsfBlade',
        bladeWarm: 'gsfBladeWarm',
        glow: 'gsfFlowerGlow'
    };

    if (variant === 'mid') {
        svg.innerHTML = `
            <defs>
                <linearGradient id="${fillIds.wash}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stop-color="#a08c8a" stop-opacity="0.0"/>
                    <stop offset="30%" stop-color="#7a8a72" stop-opacity="0.45"/>
                    <stop offset="70%" stop-color="#576b54" stop-opacity="0.78"/>
                    <stop offset="100%" stop-color="#3e5240" stop-opacity="0.92"/>
                </linearGradient>
                <linearGradient id="${fillIds.blade}" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%"  stop-color="#506c4f"/>
                    <stop offset="60%" stop-color="#82a072"/>
                    <stop offset="100%" stop-color="#bccf91"/>
                </linearGradient>
                <linearGradient id="${fillIds.bladeWarm}" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%"  stop-color="#5b6a44"/>
                    <stop offset="60%" stop-color="#94a268"/>
                    <stop offset="100%" stop-color="#e3cb88"/>
                </linearGradient>
                <radialGradient id="${fillIds.glow}" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"  stop-color="#fff0c8" stop-opacity="0.55"/>
                    <stop offset="100%" stop-color="#fff0c8" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <path d="M0,${H * 0.45} Q220,${H * 0.30} 480,${H * 0.40} T960,${H * 0.36} T1440,${H * 0.42} L1440,${H} L0,${H} Z"
                  fill="url(#${fillIds.wash})"/>
        `;
    } else {
        svg.innerHTML = `
            <defs>
                <linearGradient id="${fillIds.wash}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stop-color="#728861" stop-opacity="0.0"/>
                    <stop offset="22%" stop-color="#5e7551" stop-opacity="0.55"/>
                    <stop offset="55%" stop-color="#445e3f" stop-opacity="0.85"/>
                    <stop offset="100%" stop-color="#2c4030" stop-opacity="0.96"/>
                </linearGradient>
                <linearGradient id="${fillIds.blade}" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%"  stop-color="#3b5a3b"/>
                    <stop offset="60%" stop-color="#6e9264"/>
                    <stop offset="100%" stop-color="#9fc285"/>
                </linearGradient>
                <linearGradient id="${fillIds.bladeWarm}" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%"  stop-color="#4a5a3a"/>
                    <stop offset="60%" stop-color="#7d9a5a"/>
                    <stop offset="100%" stop-color="#d8c47a"/>
                </linearGradient>
                <radialGradient id="${fillIds.glow}" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"  stop-color="#fff5d8" stop-opacity="0.7"/>
                    <stop offset="100%" stop-color="#fff5d8" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <path d="M0,${H * 0.35} Q220,${H * 0.20} 480,${H * 0.30} T960,${H * 0.28} T1440,${H * 0.32} L1440,${H} L0,${H} Z"
                  fill="url(#${fillIds.wash})"/>
        `;
    }

    // Seeded RNG so layout is stable across reloads
    let seed = variant === 'mid' ? 23 : 7;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

    const flowerColors = [
        '#ffd0dd', // pastel pink
        '#ffb8cf', // warm pink
        '#e6c8ff', // lavender
        '#c9b3f5', // gentle purple
        '#fff4b8', // soft gold
        '#ffe48c', // warm yellow
        '#ffffff', // white
        '#ffcfb0'  // muted peach
    ];

    const numClusters = opts.clusters || 36;
    const [bhMin, bhMax] = opts.bladeHeight || [110, 220];
    const [bwMin, bwMax] = opts.bladeWidth || [2.4, 3.8];
    const [opMin, opMax] = opts.opacityRange || [0.78, 0.96];
    const [fhMin, fhMax] = opts.flowerHeightRange || [130, 200];
    const flowerChance = opts.flowerChance ?? 0.5;

    for (let i = 0; i < numClusters; i++) {
        const baseX = (W / numClusters) * (i + 0.5) + (rand() - 0.5) * 22;
        const swayClass = `gsf-sway-${(i % 4) + 1}`;
        const cluster = document.createElementNS(NS, 'g');
        cluster.setAttribute('class', `gsf-blade ${swayClass}`);
        cluster.style.transformOrigin = `${baseX}px ${groundY}px`;
        cluster.style.animationDelay = `-${(rand() * 9).toFixed(2)}s`;

        const numBlades = 3 + Math.floor(rand() * 4);
        for (let j = 0; j < numBlades; j++) {
            const offset = (j - numBlades / 2) * (5 + rand() * 4);
            const bx = baseX + offset;
            const height = bhMin + rand() * (bhMax - bhMin);
            const lean = (rand() - 0.5) * 18;
            const tipX = bx + lean;
            const midX = bx + lean * 0.4;
            const width = bwMin + rand() * (bwMax - bwMin);
            const blade = document.createElementNS(NS, 'path');
            blade.setAttribute('d',
                `M${bx - width},${groundY} ` +
                `Q${midX - 1},${groundY - height * 0.55} ${tipX},${groundY - height} ` +
                `Q${midX + 1},${groundY - height * 0.55} ${bx + width},${groundY} Z`
            );
            blade.setAttribute('fill', rand() > 0.3 ? `url(#${fillIds.blade})` : `url(#${fillIds.bladeWarm})`);
            blade.setAttribute('opacity', (opMin + rand() * (opMax - opMin)).toFixed(2));
            cluster.appendChild(blade);
        }

        if (rand() < flowerChance) {
            const flowerHeight = fhMin + rand() * (fhMax - fhMin);
            const fx = baseX + (rand() - 0.5) * 12;
            const fy = groundY - flowerHeight;
            const color = flowerColors[Math.floor(rand() * flowerColors.length)];

            const stem = document.createElementNS(NS, 'path');
            stem.setAttribute('d', `M${baseX},${groundY} Q${(baseX + fx) / 2},${groundY - flowerHeight * 0.5} ${fx},${fy + 4}`);
            stem.setAttribute('stroke', variant === 'mid' ? '#6d8a55' : '#5a7846');
            stem.setAttribute('stroke-width', variant === 'mid' ? '1.1' : '1.6');
            stem.setAttribute('fill', 'none');
            stem.setAttribute('opacity', variant === 'mid' ? '0.7' : '0.85');
            cluster.appendChild(stem);

            const halo = document.createElementNS(NS, 'circle');
            halo.setAttribute('cx', fx);
            halo.setAttribute('cy', fy);
            halo.setAttribute('r', variant === 'mid' ? 9 : 14);
            halo.setAttribute('fill', `url(#${fillIds.glow})`);
            cluster.appendChild(halo);

            const petalR = (variant === 'mid' ? 2.6 : 4.5) + rand() * 1.4;
            const petalRing = variant === 'mid' ? 3.2 : 5;
            for (let p = 0; p < 5; p++) {
                const angle = (p / 5) * Math.PI * 2 - Math.PI / 2;
                const petal = document.createElementNS(NS, 'circle');
                petal.setAttribute('cx', (fx + Math.cos(angle) * petalRing).toFixed(2));
                petal.setAttribute('cy', (fy + Math.sin(angle) * petalRing).toFixed(2));
                petal.setAttribute('r', petalR.toFixed(2));
                petal.setAttribute('fill', color);
                petal.setAttribute('opacity', variant === 'mid' ? '0.85' : '0.95');
                cluster.appendChild(petal);
            }
            const center = document.createElementNS(NS, 'circle');
            center.setAttribute('cx', fx);
            center.setAttribute('cy', fy);
            center.setAttribute('r', variant === 'mid' ? 1.4 : 2.4);
            center.setAttribute('fill', '#ffd870');
            cluster.appendChild(center);
        }

        svg.appendChild(cluster);
    }

    // Optional foreground tall shoots that overlap subtly
    const numShoots = opts.shoots || 0;
    for (let i = 0; i < numShoots; i++) {
        const baseX = (W / numShoots) * (i + 0.5) + (rand() - 0.5) * 40;
        const cluster = document.createElementNS(NS, 'g');
        cluster.setAttribute('class', `gsf-blade gsf-blade-front gsf-sway-${(i % 4) + 1}`);
        cluster.style.transformOrigin = `${baseX}px ${groundY}px`;
        cluster.style.animationDelay = `-${(rand() * 12).toFixed(2)}s`;

        const numBlades = 2 + Math.floor(rand() * 3);
        for (let j = 0; j < numBlades; j++) {
            const offset = (j - numBlades / 2) * 6;
            const bx = baseX + offset;
            const height = 180 + rand() * 90;
            const lean = (rand() - 0.5) * 22;
            const tipX = bx + lean;
            const midX = bx + lean * 0.4;
            const width = 3 + rand() * 1.6;
            const blade = document.createElementNS(NS, 'path');
            blade.setAttribute('d',
                `M${bx - width},${groundY} ` +
                `Q${midX - 1},${groundY - height * 0.55} ${tipX},${groundY - height} ` +
                `Q${midX + 1},${groundY - height * 0.55} ${bx + width},${groundY} Z`
            );
            blade.setAttribute('fill', '#2f4a32');
            blade.setAttribute('opacity', (0.55 + rand() * 0.2).toFixed(2));
            cluster.appendChild(blade);
        }
        svg.appendChild(cluster);
    }

    return svg;
}

function GhibliBackground() {
    return `
        <div class="ghibli-background" aria-hidden="true">
            <div class="ghibli-bg-layer ghibli-gradient-base"></div>
            <svg class="ghibli-bg-layer ghibli-hill hill-far" viewBox="0 0 1440 320" preserveAspectRatio="none">
                <path fill="#A89BC4" fill-opacity="0.45" d="M0,160L80,170C160,180,320,200,480,210C640,220,800,220,960,200C1120,180,1280,140,1360,120L1440,100L1440,320L0,320Z"></path>
            </svg>
            <svg class="ghibli-bg-layer ghibli-hill hill-mid" viewBox="0 0 1440 320" preserveAspectRatio="none">
                <path fill="#C3B4D9" fill-opacity="0.55" d="M0,200L120,210C240,220,480,240,720,230C960,220,1200,180,1320,160L1440,140L1440,320L0,320Z"></path>
            </svg>
            <svg class="ghibli-bg-layer ghibli-hill hill-near" viewBox="0 0 1440 320" preserveAspectRatio="none">
                <path fill="#8E9F7F" fill-opacity="0.65" d="M0,260L100,250C200,240,400,230,600,240C800,250,1000,280,1200,270L1440,260L1440,320L0,320Z"></path>
            </svg>
            <div class="ghibli-bg-layer ghibli-cloud cloud-a"></div>
            <div class="ghibli-bg-layer ghibli-cloud cloud-b"></div>
            <div class="ghibli-bg-layer ghibli-cloud cloud-c"></div>
            <div class="ghibli-bg-layer ghibli-dust">
                <span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="ghibli-bg-layer ghibli-grain"></div>
            <div class="ghibli-bg-layer ghibli-bloom"></div>
        </div>
    `;
}

function mountGhibliBackgrounds() {
    const slots = document.querySelectorAll('.ghibli-bg-slot[data-ghibli-scope]');
    slots.forEach((slot) => {
        slot.innerHTML = GhibliBackground();
    });
}

function initializeDashboard() {
    console.log('SafeSpace AI Dashboard initialized');
    
    // Add smooth animations
    animateCards();
    
    // Set current time
    updateTime();
}

function setupEventListeners() {
    // Mood slider (5-emoji snap)
    setupMoodSlider();

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

const MOODS = [
    { idx: 0, key: 'overwhelmed', emoji: '😞' },
    { idx: 1, key: 'anxious',     emoji: '🙁' },
    { idx: 2, key: 'okay',        emoji: '😐' },
    { idx: 3, key: 'good',        emoji: '🙂' },
    { idx: 4, key: 'great',       emoji: '😄' }
];

const MOOD_AFFIRMATIONS = {
    overwhelmed: [
        "You're allowed to rest. The world can wait.",
        "One breath at a time — that is enough.",
        "You don't have to carry it all alone."
    ],
    anxious: [
        "You are safe in this moment.",
        "This feeling will pass like weather in the sky.",
        "You are braver than your worries whisper."
    ],
    okay: [
        "Ordinary days hold quiet magic.",
        "You are doing beautifully, just as you are.",
        "Gentle moments are the ones that grow into memories."
    ],
    good: [
        "Your calm is a gift to everyone around you.",
        "Today holds small kindnesses waiting for you.",
        "Keep nurturing what feels right."
    ],
    great: [
        "Your joy is a sunrise — share it freely.",
        "You are glowing, and the world is warmer for it.",
        "Savour this lightness; it is yours."
    ]
};

let activeMoodIdx = 2;

function setupMoodSlider() {
    const range = document.getElementById('moodRange');
    const emojiRow = document.getElementById('moodEmojiRow');
    const trackFill = document.getElementById('moodTrackFill');
    if (!range || !emojiRow) return;

    const emojis = emojiRow.querySelectorAll('.mood-emoji');

    emojis.forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.idx, 10);
            range.value = String(idx);
            applyMood(idx);
        });
    });

    range.addEventListener('input', () => applyMood(parseInt(range.value, 10)));

    // Initial state (respect saved mood if present)
    let startIdx = 2;
    try {
        const saved = JSON.parse(localStorage.getItem('currentMood') || 'null');
        if (saved && typeof saved.idx === 'number') startIdx = saved.idx;
        else if (saved && saved.mood) {
            const m = MOODS.find(x => x.key === saved.mood);
            if (m) startIdx = m.idx;
        }
    } catch (_) { /* ignore */ }

    range.value = String(startIdx);
    applyMood(startIdx, { skipFeedback: true });

    function applyMood(idx, options = {}) {
        if (Number.isNaN(idx)) return;
        activeMoodIdx = idx;
        const mood = MOODS[idx];

        emojis.forEach(el => {
            const elIdx = parseInt(el.dataset.idx, 10);
            el.classList.toggle('active', elIdx === idx);
        });

        if (trackFill) {
            const pct = (idx / 4) * 100;
            trackFill.style.width = pct + '%';
        }

        updateAffirmations(mood.key);

        localStorage.setItem('currentMood', JSON.stringify({
            mood: mood.key,
            idx: mood.idx,
            emoji: mood.emoji,
            timestamp: new Date().toISOString()
        }));

        if (!options.skipFeedback) {
            showMoodFeedback(mood.key);
        }
    }
}

function updateAffirmations(moodKey) {
    const list = document.getElementById('affirmationList');
    if (!list) return;
    const items = MOOD_AFFIRMATIONS[moodKey] || MOOD_AFFIRMATIONS.okay;

    list.classList.add('is-fading');
    setTimeout(() => {
        list.innerHTML = items
            .map((text, i) => `<div class="affirmation-item" style="animation-delay:${i * 90}ms">${text}</div>`)
            .join('');
        list.classList.remove('is-fading');
    }, 220);
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
    // The slider restores its saved mood on setupMoodSlider(); nothing else to do here.
    setTimeout(() => {
        console.log('User data loaded');
    }, 500);
}

