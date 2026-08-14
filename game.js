// ============================================
// HOOKED - Top-Down Fishing Game
// ============================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let waterMaskDirty = false;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    waterMaskDirty = true;
}
resize();
window.addEventListener('resize', resize);

// ============================================
// GAME STATE
// ============================================
const State = {
    LOADING: 'loading',
    DRIVING: 'driving',
    CASTING: 'casting',
    WAITING: 'waiting',
    BITE: 'bite',
    FIGHTING: 'fighting',
    CAUGHT: 'caught'
};

let gameState = State.LOADING;
let animToggles = { depth: true, shoreline: true, bubbles: true, mist: true, castSplash: true, hookFlash: true, clouds: true, fishShadow: true, lilyPads: true, timeOfDay: true, grid: false };
let forceNight = false;
let fastCycle = false;

function toggleForceNight(enabled) {
    forceNight = enabled;
    if (enabled) {
        gameHour = 22;
        gameMinute = 0;
    } else {
        gameHour = 8;
        gameMinute = 0;
    }
}

function toggleFastCycle(enabled) {
    fastCycle = enabled;
}
let gold = 0;
let level = 1;
let xp = 0;
let xpToNext = 100;
let fishCaught = 0;
let currentCatch = null;
let inventory = [];

// ============================================
// FISH JOURNAL
// ============================================
let fishJournal = {}; // { fishId: { count, biggestWeight, biggestLength, firstCaught } }

function recordCatch(fish) {
    if (!fishJournal[fish.id]) {
        fishJournal[fish.id] = {
            name: fish.name,
            count: 0,
            biggestWeight: 0,
            biggestLength: 0,
            firstCaught: `${gameHour}:${String(gameMinute).padStart(2,'0')}`
        };
        triggerAchievement(`New Species: ${fish.name}!`);
    }
    const entry = fishJournal[fish.id];
    entry.count++;
    let isRecord = false;
    if (fish.weight > entry.biggestWeight) {
        entry.biggestWeight = fish.weight;
        isRecord = true;
    }
    if (fish.length > entry.biggestLength) {
        entry.biggestLength = fish.length;
    }
    return isRecord;
}

function getJournalCount() {
    return Object.keys(fishJournal).length;
}

// ============================================
// ACHIEVEMENTS
// ============================================
let achievements = [];
let achievementQueue = [];
let achievementDisplay = { active: false, text: '', time: 0 };

const achievementDefs = [
    { id: 'first_catch', name: 'First Catch!', condition: () => fishCaught >= 1 },
    { id: 'catch_5', name: 'Getting the Hang of It', condition: () => fishCaught >= 5 },
    { id: 'catch_25', name: 'Avid Angler', condition: () => fishCaught >= 25 },
    { id: 'catch_50', name: 'Fishing Fanatic', condition: () => fishCaught >= 50 },
    { id: 'catch_100', name: 'Master Angler', condition: () => fishCaught >= 100 },
    { id: 'species_3', name: 'Variety Pack', condition: () => getJournalCount() >= 3 },
    { id: 'species_6', name: 'Collector', condition: () => getJournalCount() >= 6 },
    { id: 'species_all', name: 'Complete Encyclopedia', condition: () => getJournalCount() >= fishTypes.length },
    { id: 'gold_100', name: 'First Hundred', condition: () => gold >= 100 },
    { id: 'gold_500', name: 'Saving Up', condition: () => gold >= 500 },
    { id: 'gold_2000', name: 'High Roller', condition: () => gold >= 2000 },
    { id: 'night_fish', name: 'Night Owl', condition: () => fishJournal['burbot'] || fishJournal['eel'] || fishJournal['sturgeon'] },
    { id: 'all_night', name: 'Creature of the Night', condition: () => fishJournal['burbot'] && fishJournal['eel'] && fishJournal['sturgeon'] },
    { id: 'level_5', name: 'Level 5', condition: () => level >= 5 },
    { id: 'level_10', name: 'Level 10', condition: () => level >= 10 },
    { id: 'full_hold', name: 'Full Hold!', condition: () => inventory.length >= equippedBoat.cargoHold },
    { id: 'big_bass', name: 'Bass Master', condition: () => fishJournal['largemouth_bass'] && fishJournal['largemouth_bass'].biggestWeight >= 4.0 },
    { id: 'musky_caught', name: 'The Big One', condition: () => fishJournal['musky'] && fishJournal['musky'].count >= 1 },
    { id: 'sturgeon_caught', name: 'Ancient Giant', condition: () => fishJournal['sturgeon'] && fishJournal['sturgeon'].count >= 1 }
];

function checkAchievements() {
    for (const def of achievementDefs) {
        if (achievements.includes(def.id)) continue;
        if (def.condition()) {
            achievements.push(def.id);
            triggerAchievement(`🏆 ${def.name}`);
        }
    }
}

function triggerAchievement(text) {
    achievementQueue.push(text);
}

function updateAchievementDisplay() {
    if (achievementDisplay.active) {
        achievementDisplay.time += 1/60;
        if (achievementDisplay.time > 3) {
            achievementDisplay.active = false;
        }
    } else if (achievementQueue.length > 0) {
        achievementDisplay.text = achievementQueue.shift();
        achievementDisplay.active = true;
        achievementDisplay.time = 0;
    }
}

function renderAchievementToast() {
    if (!achievementDisplay.active) return;
    const t = achievementDisplay.time;
    let alpha = 1;
    if (t < 0.3) alpha = t / 0.3;
    else if (t > 2.5) alpha = (3 - t) / 0.5;
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
    const textWidth = ctx.measureText(achievementDisplay.text).width;
    const boxWidth = Math.max(textWidth + 40, 200);
    const boxX = canvas.width / 2 - boxWidth / 2;
    const boxY = 60;
    ctx.fillRect(boxX, boxY, boxWidth, 40);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxWidth, 40);
    ctx.fillStyle = '#ffd700';
    ctx.font = '16px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(achievementDisplay.text, canvas.width / 2, boxY + 26);
    ctx.textAlign = 'left';
    ctx.restore();
}

// ============================================
// TIME OF DAY SYSTEM
// ============================================
// Full cycle = 600 seconds (10 min). Night = ~120 seconds (2 min)
// Hours: 0-24. Night = 21-5 (8 hours of 24 = 1/3 but compressed)
// Real distribution: Day (5-21) = 480s, Night (21-5) = 120s
const TIME_CYCLE_DAY_DURATION = 480; // seconds of real time for daytime (hours 5-21)
const TIME_CYCLE_NIGHT_DURATION = 120; // seconds of real time for night (hours 21-5)
let gameHour = 8; // Start at 8am
let gameMinute = 0;
let timeAccumulator = 0;

function getTimeOfDay() {
    if (gameHour >= 5 && gameHour < 7) return 'dawn';
    if (gameHour >= 7 && gameHour < 11) return 'morning';
    if (gameHour >= 11 && gameHour < 15) return 'midday';
    if (gameHour >= 15 && gameHour < 19) return 'afternoon';
    if (gameHour >= 19 && gameHour < 21) return 'dusk';
    return 'night';
}

function isNight() {
    return gameHour >= 21 || gameHour < 5;
}

function updateGameTime() {
    if (forceNight) return; // Don't advance time when forced
    if (!animToggles.timeOfDay) return; // Don't advance if disabled
    const dt = 1 / 60; // per frame at 60fps
    timeAccumulator += dt;
    
    // How many real seconds per game hour depends on day vs night
    let secsPerHour;
    if (fastCycle) {
        secsPerHour = 15 / 24; // Full 24 hours in 15 seconds
    } else if (isNight()) {
        secsPerHour = TIME_CYCLE_NIGHT_DURATION / 8; // 8 night hours in 120s = 15s per hour
    } else {
        secsPerHour = TIME_CYCLE_DAY_DURATION / 16; // 16 day hours in 480s = 30s per hour
    }
    
    const hoursElapsed = timeAccumulator / secsPerHour;
    if (hoursElapsed >= 1) {
        const fullHours = Math.floor(hoursElapsed);
        gameHour = (gameHour + fullHours) % 24;
        timeAccumulator -= fullHours * secsPerHour;
    }
    
    // Update minute for display
    gameMinute = Math.floor((timeAccumulator / secsPerHour) * 60);
}

function getTimeTint() {
    // Smooth blending between phases using linear interpolation
    const h = gameHour + gameMinute / 60;
    
    // Define key points with their tints (hour, r, g, b, a)
    const keyframes = [
        { h: 4,  r: 10,  g: 15,  b: 40,  a: 0.55 },  // deep night
        { h: 5,  r: 30,  g: 30,  b: 60,  a: 0.40 },  // pre-dawn
        { h: 6,  r: 200, g: 150, b: 80,  a: 0.12 },  // dawn
        { h: 7,  r: 255, g: 220, b: 170, a: 0.06 },  // early morning
        { h: 8,  r: 255, g: 240, b: 200, a: 0.03 },  // morning
        { h: 11, r: 255, g: 255, b: 255, a: 0.02 },  // midday
        { h: 15, r: 255, g: 240, b: 200, a: 0.03 },  // afternoon
        { h: 17, r: 255, g: 200, b: 130, a: 0.06 },  // late afternoon
        { h: 19, r: 220, g: 120, b: 60,  a: 0.12 },  // dusk begins
        { h: 20, r: 150, g: 70,  b: 50,  a: 0.25 },  // deep dusk
        { h: 21, r: 60,  g: 40,  b: 60,  a: 0.40 },  // twilight
        { h: 22, r: 10,  g: 15,  b: 40,  a: 0.55 },  // night
        { h: 28, r: 10,  g: 15,  b: 40,  a: 0.55 }   // night (wrap)
    ];
    
    // Normalize hour for wrap-around
    const nh = h < 4 ? h + 24 : h;
    
    // Find the two keyframes we're between and lerp
    for (let i = 0; i < keyframes.length - 1; i++) {
        const curr = keyframes[i];
        const next = keyframes[i + 1];
        if (nh >= curr.h && nh < next.h) {
            const t = (nh - curr.h) / (next.h - curr.h);
            return {
                r: Math.round(curr.r + (next.r - curr.r) * t),
                g: Math.round(curr.g + (next.g - curr.g) * t),
                b: Math.round(curr.b + (next.b - curr.b) * t),
                a: curr.a + (next.a - curr.a) * t
            };
        }
    }
    return { r: 10, g: 15, b: 40, a: 0.55 };
}

function renderTimeTint() {
    if (!animToggles.timeOfDay && !forceNight) return;
    const tint = getTimeTint();
    if (tint.a > 0) {
        ctx.fillStyle = `rgba(${tint.r}, ${tint.g}, ${tint.b}, ${tint.a})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Boat lantern at night
    if (isNight()) {
        // Headlight cone in front of boat
        const lightDist = 150;
        const lightSpread = 0.5; // radians, cone width
        const frontX = boat.x + Math.sin(boat.angle) * lightDist;
        const frontY = boat.y - Math.cos(boat.angle) * lightDist;
        
        const gradient = ctx.createRadialGradient(boat.x, boat.y, 10, frontX, frontY, lightDist);
        gradient.addColorStop(0, 'rgba(255, 220, 150, 0.2)');
        gradient.addColorStop(0.6, 'rgba(255, 200, 100, 0.08)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(boat.x, boat.y);
        ctx.arc(boat.x, boat.y, lightDist, -boat.angle - Math.PI/2 - lightSpread, -boat.angle - Math.PI/2 + lightSpread);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();
        
        // Soft glow around boat too
        const boatGlow = ctx.createRadialGradient(boat.x, boat.y, 0, boat.x, boat.y, 60);
        boatGlow.addColorStop(0, 'rgba(255, 220, 150, 0.1)');
        boatGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = boatGlow;
        ctx.fillRect(boat.x - 60, boat.y - 60, 120, 120);
        
        // Darken everything outside the lantern radius
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        const darkGradient = ctx.createRadialGradient(boat.x, boat.y, 80, boat.x, boat.y, 250);
        darkGradient.addColorStop(0, 'rgba(0, 0, 20, 0)');
        darkGradient.addColorStop(1, 'rgba(0, 0, 20, 0.3)');
        ctx.fillStyle = darkGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        
        // Make bobber glow at night
        if (bobber.visible) {
            const bobGlow = ctx.createRadialGradient(bobber.x, bobber.y, 0, bobber.x, bobber.y, 20);
            bobGlow.addColorStop(0, 'rgba(255, 100, 50, 0.3)');
            bobGlow.addColorStop(1, 'rgba(255, 100, 50, 0)');
            ctx.fillStyle = bobGlow;
            ctx.fillRect(bobber.x - 20, bobber.y - 20, 40, 40);
        }
        
        // Dock lantern glow (ratio-based)
        const dockX = canvas.width * 0.534;
        const dockY = canvas.height * 0.743;
        const dockGlow = ctx.createRadialGradient(dockX, dockY, 0, dockX, dockY, 80);
        dockGlow.addColorStop(0, 'rgba(255, 180, 80, 0.25)');
        dockGlow.addColorStop(0.5, 'rgba(255, 150, 50, 0.1)');
        dockGlow.addColorStop(1, 'rgba(255, 120, 30, 0)');
        ctx.fillStyle = dockGlow;
        ctx.fillRect(dockX - 80, dockY - 80, 160, 160);
    }
}

// ============================================
// AUDIO SYSTEM
// ============================================
const audio = {
    cast: new Audio('audio/spinopel-fishing-rod-whoosh-411640.mp3'),
    splash: new Audio('audio/freesound_community-splash-6213.mp3'),
    reel: new Audio('audio/audiopapkin-fishing-reel-302355.mp3'),
    snap: new Audio('audio/freesound_community-snap-96332.mp3'),
    coin: new Audio('audio/chieuk-coin-257878.mp3'),
    ambient: new Audio('audio/freesound_community-lakeontariofree-35186.mp3'),
    nightAmbient: new Audio('audio/eryliaa-night-forest-with-frogs-and-crickets-for-sleep-451153.mp3'),
    boat: new Audio('audio/freesound_community-boat-on-river-26388.mp3'),
    crow: new Audio('audio/kave_msri-crow-sfx-318131.mp3'),
    owl: new Audio('audio/lazychillzone-owl-hooting-223549.mp3'),
    frog: new Audio('audio/dragon-studio-frog-croaking-sound-effect-322956.mp3'),
    duck: new Audio('audio/wings_of_freedom-duck-sound-398808.mp3'),
    waterfall: new Audio('audio/freesound_community-waterfall-24060.mp3'),
    bite: new Audio('audio/47313572-notification-alert-269289.mp3'),
    loon: new Audio('audio/dragon-studio-loon-call-335487.mp3'),
    shopOpen: new Audio('audio/open store.mp3'),
    fishCaught: new Audio('audio/universfield-bubble-pop-06-351337.mp3'),
    levelUp: new Audio('audio/universfield-level-up-05-326133.mp3'),
    buy: new Audio('audio/when you buy something.mp3')
};

// Configure audio
audio.ambient.loop = true;
audio.ambient.volume = 0.3;
audio.nightAmbient.loop = true;
audio.nightAmbient.volume = 0;
audio.boat.loop = true;
audio.boat.volume = 0;
audio.reel.loop = true;
audio.reel.volume = 0.4;
audio.cast.volume = 0.5;
audio.splash.volume = 0.4;
audio.snap.volume = 0.5;
audio.coin.volume = 0.4;
audio.crow.volume = 0.3;
audio.owl.volume = 0.3;
audio.frog.volume = 0.4;
audio.duck.volume = 0.35;
audio.waterfall.loop = true;
audio.waterfall.volume = 0;
audio.bite.volume = 0.5;
audio.loon.volume = 0.3;
audio.shopOpen.volume = 0.4;
audio.fishCaught.volume = 0.5;
audio.levelUp.volume = 0.5;
audio.buy.volume = 0.4;

let audioStarted = false;
let reelPlaying = false;
let boatSoundPlaying = false;

function startAudio() {
    if (audioStarted) return;
    audioStarted = true;
    audio.ambient.play().catch(() => {});
    audio.nightAmbient.play().catch(() => {});
    audio.boat.play().catch(() => {});
    audio.waterfall.play().catch(() => {});
}

function playSound(sound) {
    if (!audioStarted) return;
    sound.currentTime = 0;
    sound.play().catch(() => {});
}

function updateAudio() {
    // Start audio on first interaction
    if (!audioStarted) return;
    
    // Crossfade day/night ambient based on time
    if (isNight()) {
        audio.ambient.volume = Math.max(0, audio.ambient.volume - 0.003);
        // Frogs louder near lily pad area
        const lilyX = canvas.width * (485 / 2322);
        const lilyY = canvas.height * (844 / 1155);
        const lilyDx = boat.x - lilyX;
        const lilyDy = boat.y - lilyY;
        const lilyDist = Math.sqrt(lilyDx * lilyDx + lilyDy * lilyDy);
        const nightTargetVol = lilyDist < 300 ? 0.3 + 0.25 * (1 - lilyDist / 300) : 0.3;
        audio.nightAmbient.volume += (nightTargetVol - audio.nightAmbient.volume) * 0.01;
    } else {
        audio.ambient.volume = Math.min(0.3, audio.ambient.volume + 0.003);
        audio.nightAmbient.volume = Math.max(0, audio.nightAmbient.volume - 0.003);
    }
    
    // Boat sound — volume based on speed
    const speedRatio = Math.abs(boat.speed) / equippedBoat.maxSpeed;
    audio.boat.volume = Math.min(0.25, speedRatio * 0.3);
    
    // Waterfall — distance-based volume
    const waterfallX = canvas.width * 0.2705;
    const waterfallY = canvas.height * 0.0900;
    const wfDx = boat.x - waterfallX;
    const wfDy = boat.y - waterfallY;
    const wfDist = Math.sqrt(wfDx * wfDx + wfDy * wfDy);
    const wfMaxDist = 400;
    const wfMinDist = 80;
    if (wfDist <= wfMinDist) {
        audio.waterfall.volume = 0.7;
    } else if (wfDist >= wfMaxDist) {
        audio.waterfall.volume = 0;
    } else {
        audio.waterfall.volume = 0.7 * (1 - (wfDist - wfMinDist) / (wfMaxDist - wfMinDist));
    }
    
    // Reel sound — play during fight when holding mouse
    if (gameState === State.FIGHTING && mouse.down) {
        if (!reelPlaying) {
            audio.reel.currentTime = 0;
            audio.reel.play().catch(() => {});
            reelPlaying = true;
        }
    } else {
        if (reelPlaying) {
            audio.reel.pause();
            reelPlaying = false;
        }
    }
    
    // Crow call — proximity to top-right island where birds circle, every few minutes
    if (!isNight()) {
        const crowX = canvas.width * 0.72;
        const crowY = canvas.height * 0.28;
        const crowDx = boat.x - crowX;
        const crowDy = boat.y - crowY;
        const crowDist = Math.sqrt(crowDx * crowDx + crowDy * crowDy);
        if (crowDist < 350 && Math.random() < 0.002) {
            if (!audio.crow._lastPlayed || Date.now() - audio.crow._lastPlayed > 120000) {
                audio.crow._lastPlayed = Date.now();
                playSound(audio.crow);
            }
        }
    }
    
    // Loon call (every 10 minutes max, daytime only)
    if (!isNight() && Math.random() < 0.0002) {
        if (!audio.loon._lastPlayed || Date.now() - audio.loon._lastPlayed > 600000) {
            audio.loon._lastPlayed = Date.now();
            playSound(audio.loon);
        }
    }
    
    // Owl hoot (once per night)
    if (isNight() && Math.random() < 0.0003) {
        if (!audio.owl._lastPlayed || Date.now() - audio.owl._lastPlayed > 120000) {
            audio.owl._lastPlayed = Date.now();
            playSound(audio.owl);
        }
    }
    
    // Frog croak — near lily pads, cooldown 30-60 seconds
    const frogX = canvas.width * (460 / 2322);
    const frogY = canvas.height * (844 / 1155);
    const frogDx = boat.x - frogX;
    const frogDy = boat.y - frogY;
    const frogDist = Math.sqrt(frogDx * frogDx + frogDy * frogDy);
    if (frogDist < 200 && Math.random() < 0.002) {
        if (!audio.frog._lastPlayed || Date.now() - audio.frog._lastPlayed > 30000) {
            audio.frog._lastPlayed = Date.now();
            playSound(audio.frog);
        }
    }
}

// ============================================
// MULTIPLAYER
// ============================================
const PARTYKIT_HOST = "localhost:8081"; // Local dev — change to production URL after deploy
let socket = null;
let myPlayerId = null;
let otherPlayers = {};
let netSendTimer = 0;

// Other player boat images cache
let otherBoatImages = {};

function connectMultiplayer() {
    try {
        const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
        socket = new WebSocket(`${protocol}://${PARTYKIT_HOST}`);
        
        socket.onopen = () => {
            console.log('Connected to multiplayer');
        };
        
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'init':
                    myPlayerId = data.id;
                    // Load existing players
                    for (const [id, player] of Object.entries(data.players)) {
                        if (id !== myPlayerId) {
                            otherPlayers[id] = player;
                        }
                    }
                    break;
                    
                case 'player_joined':
                    if (data.player.id !== myPlayerId) {
                        otherPlayers[data.player.id] = data.player;
                    }
                    break;
                    
                case 'player_update':
                    if (data.id !== myPlayerId) {
                        if (!otherPlayers[data.id]) otherPlayers[data.id] = {};
                        const p = otherPlayers[data.id];
                        p.x = data.x;
                        p.y = data.y;
                        p.angle = data.angle;
                        p.speed = data.speed;
                        p.boatSprite = data.boatSprite;
                        p.fishingState = data.fishingState;
                        p.bobberX = data.bobberX;
                        p.bobberY = data.bobberY;
                        p.bobberVisible = data.bobberVisible;
                        p.name = data.name;
                    }
                    break;
                    
                case 'player_left':
                    delete otherPlayers[data.id];
                    break;
            }
        };
        
        socket.onclose = () => {
            console.log('Disconnected from multiplayer');
            setTimeout(connectMultiplayer, 3000); // Reconnect
        };
        
        socket.onerror = (err) => {
            console.warn('Multiplayer connection error:', err);
        };
    } catch (e) {
        console.warn('Multiplayer not available:', e);
    }
}

function sendPlayerState() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    
    netSendTimer += 1/60;
    if (netSendTimer < 0.1) return; // Send 10x per second
    netSendTimer = 0;
    
    socket.send(JSON.stringify({
        type: 'update',
        x: boat.x,
        y: boat.y,
        angle: boat.angle,
        speed: boat.speed,
        boatSprite: equippedBoat.sprite,
        fishingState: gameState,
        bobberX: bobber.x,
        bobberY: bobber.y,
        bobberVisible: bobber.visible,
        name: playerName
    }));
}

function getOtherBoatImg(sprite) {
    if (!otherBoatImages[sprite]) {
        otherBoatImages[sprite] = new Image();
        otherBoatImages[sprite].src = sprite;
    }
    return otherBoatImages[sprite];
}

function renderOtherPlayers() {
    for (const [id, p] of Object.entries(otherPlayers)) {
        if (!p.x && !p.y) continue;
        
        // Draw bobber if fishing
        if (p.bobberVisible) {
            ctx.beginPath();
            ctx.arc(p.bobberX, p.bobberY, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#ff5533';
            ctx.fill();
            // Fishing line
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.bobberX, p.bobberY);
            ctx.strokeStyle = 'rgba(50,50,50,0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        // Draw boat
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        
        const img = getOtherBoatImg(p.boatSprite);
        if (img.complete && img.naturalWidth > 0) {
            ctx.globalAlpha = 0.85;
            ctx.drawImage(img, -boat.width, -boat.height, boat.width * 2, boat.height * 2);
            ctx.globalAlpha = 1;
        } else {
            // Fallback
            ctx.beginPath();
            ctx.moveTo(0, -boat.height/2);
            ctx.lineTo(boat.width/2, boat.height/3);
            ctx.lineTo(-boat.width/2, boat.height/3);
            ctx.closePath();
            ctx.fillStyle = '#666';
            ctx.fill();
        }
        ctx.restore();
        
        // Player name
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '10px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.name || 'Angler', p.x, p.y - boat.height - 5);
        ctx.textAlign = 'left';
    }
}

// Connect on load (won't break anything if server isn't running)
setTimeout(connectMultiplayer, 1000);

// ============================================
// BAIT SYSTEM
// ============================================
const baitTypes = [
    { id: 'none', name: 'No Bait', price: 0, biteMultiplier: 1.0, description: 'Free. Standard wait times.' },
    { id: 'worm', name: 'Earthworms (x100)', price: 10, biteMultiplier: 0.75, quantity: 100, description: '25% faster bites. Good all-rounder.' },
    { id: 'minnow', name: 'Live Minnows (x8)', price: 30, biteMultiplier: 0.55, quantity: 8, description: '45% faster. Bass and Trout love these.' },
    { id: 'leech', name: 'Leeches (x6)', price: 50, biteMultiplier: 0.4, quantity: 6, description: '60% faster. Walleye magnet.' },
    { id: 'crayfish', name: 'Crayfish (x4)', price: 80, biteMultiplier: 0.3, quantity: 4, description: '70% faster. Attracts big predators.' },
    { id: 'golden_shiner', name: 'Golden Shiners (x3)', price: 120, biteMultiplier: 0.2, quantity: 3, description: '80% faster. Trophy fish bait.' }
];
let equippedBait = baitTypes[0];
let baitStock = { worm: 0, minnow: 0, leech: 0, crayfish: 0, golden_shiner: 0 };
let baitInventory = { none: Infinity, worm: 0, minnow: 0, leech: 0, crayfish: 0, golden_shiner: 0 };

// ============================================
// GEAR SYSTEM
// ============================================
const gearTiers = {
    rods: [
        { id: 'bamboo_rod', name: 'Bamboo Rod', price: 0, castRange: 80, tier: 1 },
        { id: 'spinning_rod', name: 'Spinning Rod', price: 200, castRange: 140, tier: 2 },
        { id: 'baitcaster', name: 'Baitcaster', price: 500, castRange: 200, tier: 3 },
        { id: 'carbon_fiber', name: 'Carbon Fiber Rod', price: 1200, castRange: 260, tier: 4 }
    ],
    reels: [
        { id: 'basic_reel', name: 'Basic Reel', price: 0, reelSpeed: 0.20, tensionReduction: 0, tier: 1 },
        { id: 'smooth_reel', name: 'Smooth Reel', price: 150, reelSpeed: 0.28, tensionReduction: 0.15, tier: 2 },
        { id: 'pro_reel', name: 'Pro Reel', price: 400, reelSpeed: 0.35, tensionReduction: 0.25, tier: 3 },
        { id: 'tournament_reel', name: 'Tournament Reel', price: 900, reelSpeed: 0.42, tensionReduction: 0.35, tier: 4 }
    ],
    lines: [
        { id: 'mono_6lb', name: '6lb Mono', price: 0, maxTension: 0.85, tier: 1 },
        { id: 'mono_10lb', name: '10lb Mono', price: 50, maxTension: 0.92, tier: 2 },
        { id: 'braid_15lb', name: '15lb Braid', price: 150, maxTension: 0.96, tier: 3 },
        { id: 'braid_20lb', name: '20lb Braid', price: 300, maxTension: 1.0, tier: 4 }
    ]
};

let equippedRod = gearTiers.rods[0];
let equippedReel = gearTiers.reels[0];
let equippedLine = gearTiers.lines[0];

// ============================================
// FISH IMAGES
// ============================================
const fishImageMap = {
    sunfish: 'sunfish.png',
    perch: 'perch.png',
    bluegill: 'bluegill.png',
    largemouth_bass: 'largemouth.png',
    smallmouth_bass: 'smallmouth.png',
    rainbow_trout: 'trout.png',
    brook_trout: 'trout.png',
    walleye: 'walleye.png',
    northern_pike: 'pike.png',
    catfish: 'catfish.png',
    lake_trout: 'trout.png',
    musky: 'musky.png',
    burbot: 'burbot.png',
    eel: 'eel.png',
    sturgeon: 'sturgeon.png'
};

// ============================================
// FISH DATABASE - Lake Fish
// ============================================
const fishTypes = [
    // Tier 1 - Common, shallow water
    { id: 'sunfish', name: 'Sunfish', minWeight: 0.1, maxWeight: 0.5, minLength: 10, maxLength: 20,
      strength: 0.1, xp: 5, price: 8, minTier: 1, depthZone: 'shallow', color: '#daa520' },
    { id: 'perch', name: 'Yellow Perch', minWeight: 0.2, maxWeight: 0.8, minLength: 15, maxLength: 28,
      strength: 0.15, xp: 8, price: 12, minTier: 1, depthZone: 'shallow', color: '#c8a000' },
    { id: 'bluegill', name: 'Bluegill', minWeight: 0.1, maxWeight: 0.6, minLength: 12, maxLength: 22,
      strength: 0.12, xp: 6, price: 10, minTier: 1, depthZone: 'shallow', color: '#4682b4' },

    // Tier 2 - Uncommon, medium water
    { id: 'largemouth_bass', name: 'Largemouth Bass', minWeight: 1.0, maxWeight: 5.0, minLength: 30, maxLength: 55,
      strength: 0.35, xp: 20, price: 35, minTier: 2, depthZone: 'medium', color: '#2e8b57' },
    { id: 'smallmouth_bass', name: 'Smallmouth Bass', minWeight: 0.8, maxWeight: 3.5, minLength: 25, maxLength: 45,
      strength: 0.4, xp: 22, price: 30, minTier: 2, depthZone: 'medium', color: '#6b8e23' },
    { id: 'rainbow_trout', name: 'Rainbow Trout', minWeight: 0.5, maxWeight: 3.0, minLength: 25, maxLength: 50,
      strength: 0.3, xp: 18, price: 28, minTier: 2, depthZone: 'medium', color: '#ff69b4' },
    { id: 'brook_trout', name: 'Brook Trout', minWeight: 0.3, maxWeight: 2.0, minLength: 20, maxLength: 40,
      strength: 0.25, xp: 15, price: 25, minTier: 2, depthZone: 'medium', color: '#8fbc8f' },

    // Tier 3 - Rare, deeper water
    { id: 'walleye', name: 'Walleye', minWeight: 1.5, maxWeight: 6.0, minLength: 35, maxLength: 65,
      strength: 0.45, xp: 35, price: 55, minTier: 3, depthZone: 'deep', color: '#bdb76b' },
    { id: 'northern_pike', name: 'Northern Pike', minWeight: 2.0, maxWeight: 10.0, minLength: 45, maxLength: 90,
      strength: 0.6, xp: 45, price: 70, minTier: 3, depthZone: 'deep', color: '#556b2f' },
    { id: 'catfish', name: 'Channel Catfish', minWeight: 1.5, maxWeight: 8.0, minLength: 35, maxLength: 70,
      strength: 0.5, xp: 30, price: 45, minTier: 3, depthZone: 'deep', color: '#696969' },

    // Tier 4 - Legendary, deepest water only
    { id: 'lake_trout', name: 'Lake Trout', minWeight: 3.0, maxWeight: 15.0, minLength: 50, maxLength: 100,
      strength: 0.7, xp: 60, price: 120, minTier: 4, depthZone: 'deep', color: '#2f4f4f' },
    { id: 'musky', name: 'Muskellunge', minWeight: 5.0, maxWeight: 25.0, minLength: 70, maxLength: 130,
      strength: 0.85, xp: 100, price: 200, minTier: 4, depthZone: 'deep', color: '#3c5a3c' },

    // Night-only - Rare nocturnal fish
    { id: 'eel', name: 'American Eel', minWeight: 0.5, maxWeight: 3.0, minLength: 40, maxLength: 80,
      strength: 0.3, xp: 25, price: 40, minTier: 1, depthZone: 'shallow', color: '#3a3a2a', nightOnly: true },
    { id: 'burbot', name: 'Burbot', minWeight: 2.0, maxWeight: 12.0, minLength: 40, maxLength: 90,
      strength: 0.55, xp: 75, price: 150, minTier: 2, depthZone: 'deep', color: '#4a3728', nightOnly: true },
    { id: 'sturgeon', name: 'Lake Sturgeon', minWeight: 8.0, maxWeight: 40.0, minLength: 80, maxLength: 160,
      strength: 0.9, xp: 120, price: 250, minTier: 3, depthZone: 'deep', color: '#2a2a2a', nightOnly: true }
];

function getDepthAtPosition(worldX, worldY) {
    if (!collisionData) return 'shallow';
    const px = Math.floor((worldX / canvas.width) * collisionData.width);
    const py = Math.floor((worldY / canvas.height) * collisionData.height);
    if (px < 0 || px >= collisionData.width || py < 0 || py >= collisionData.height) return 'shallow';
    const idx = (py * collisionData.width + px) * 4;
    const r = collisionData.data[idx];
    const g = collisionData.data[idx + 1];
    const b = collisionData.data[idx + 2];
    // Red = dock area
    if (r > 180 && g < 100 && b < 100) return 'dock';
    // Dark blue (B~128) = deep water
    if (b > 100 && b < 180 && g < 50) return 'deep';
    // Bright blue (B~252) = shallow water
    if (b > 200 && g < 50) return 'shallow';
    // Anything else blue = medium
    if (b > 50 && g < 50) return 'medium';
    return 'shallow';
}

function isAtDock(worldX, worldY) {
    if (!collisionData) return false;
    // Check a small area around the boat for red pixels
    for (let offsetX = -10; offsetX <= 10; offsetX += 5) {
        for (let offsetY = -10; offsetY <= 10; offsetY += 5) {
            const px = Math.floor(((worldX + offsetX) / canvas.width) * collisionData.width);
            const py = Math.floor(((worldY + offsetY) / canvas.height) * collisionData.height);
            if (px < 0 || px >= collisionData.width || py < 0 || py >= collisionData.height) continue;
            const idx = (py * collisionData.width + px) * 4;
            const r = collisionData.data[idx];
            const g = collisionData.data[idx + 1];
            const b = collisionData.data[idx + 2];
            if (r > 180 && g < 100 && b < 100) return true;
        }
    }
    return false;
}

function rollFish(castX, castY) {
    const depth = getDepthAtPosition(castX, castY);
    const rodTier = equippedRod.tier;
    const reelTier = equippedReel.tier;
    const lineTier = equippedLine.tier;
    
    let available = [];
    
    fishTypes.forEach(f => {
        const fishTier = f.minTier;
        
        // Night-only fish can only be caught at night
        if (f.nightOnly && !isNight()) return;
        
        // Count how many gear pieces meet or exceed the fish's tier
        let piecesAtTier = 0;
        if (rodTier >= fishTier) piecesAtTier++;
        if (reelTier >= fishTier) piecesAtTier++;
        if (lineTier >= fishTier) piecesAtTier++;
        
        // Determine gear weight based on pieces at tier
        let gearWeight;
        if (piecesAtTier === 3) {
            gearWeight = 1.0; // Full access
        } else if (piecesAtTier === 2) {
            gearWeight = 0.4; // Good chance
        } else if (piecesAtTier === 1) {
            gearWeight = 0.1; // Small chance
        } else {
            // No pieces at tier — check if we're only 1 tier below
            const maxGearTier = Math.max(rodTier, reelTier, lineTier);
            if (fishTier - maxGearTier === 1) {
                gearWeight = 0.02; // Tiny lucky chance, 1 tier below
            } else {
                gearWeight = 0; // Too far below, locked out
            }
        }
        
        // Tier 4 (legendaries) — require at least 2 pieces at tier for any chance
        if (fishTier === 4 && piecesAtTier < 2) {
            gearWeight = 0;
        }
        
        if (gearWeight === 0) return;
        
        // Depth zone preference
        let depthWeight = 0;
        if (f.depthZone === depth) {
            depthWeight = 20; // Native zone
        } else if (f.depthZone === 'shallow' && depth === 'medium') {
            depthWeight = 1;
        } else if (f.depthZone === 'medium' && depth === 'deep') {
            depthWeight = 1;
        }
        
        if (depthWeight === 0) return;
        
        const finalWeight = depthWeight * gearWeight;
        if (finalWeight > 0) {
            available.push({ fish: f, weight: finalWeight });
        }
    });
    
    // If nothing available, fallback to lowest tier shallow fish
    if (available.length === 0) {
        const fallback = fishTypes.filter(f => f.depthZone === 'shallow');
        if (fallback.length > 0) {
            available = [{ fish: fallback[0], weight: 1 }];
        } else {
            available = [{ fish: fishTypes[0], weight: 1 }];
        }
    }
    
    // Weighted random selection
    const totalWeight = available.reduce((sum, a) => sum + a.weight, 0);
    let roll = Math.random() * totalWeight;
    
    let selected = available[0].fish;
    for (const entry of available) {
        roll -= entry.weight;
        if (roll <= 0) {
            selected = entry.fish;
            break;
        }
    }
    
    const weight = +(selected.minWeight + Math.random() * (selected.maxWeight - selected.minWeight)).toFixed(2);
    const length = +(selected.minLength + Math.random() * (selected.maxLength - selected.minLength)).toFixed(1);
    const sizeFactor = weight / selected.maxWeight;
    const sellValue = Math.floor(selected.price * (0.7 + sizeFactor * 0.6));
    return { ...selected, weight, length, sellValue };
}

// ============================================
// IMAGES
// ============================================
const mapImg = new Image();
const collisionImg = new Image();
const boatImg = new Image();
const dockImg = new Image();
let collisionData = null;
let dockData = null;
let imagesLoaded = 0;
const totalImages = 4;

mapImg.onload = () => { imagesLoaded++; checkLoaded(); };
collisionImg.onload = () => {
    imagesLoaded++;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = collisionImg.width;
    tempCanvas.height = collisionImg.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(collisionImg, 0, 0);
    collisionData = tempCtx.getImageData(0, 0, collisionImg.width, collisionImg.height);
    checkLoaded();
};
dockImg.onload = () => {
    imagesLoaded++;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = dockImg.width;
    tempCanvas.height = dockImg.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(dockImg, 0, 0);
    dockData = tempCtx.getImageData(0, 0, dockImg.width, dockImg.height);
    checkLoaded();
};
boatImg.onload = () => { imagesLoaded++; checkLoaded(); };
boatImg.onerror = () => { imagesLoaded++; checkLoaded(); }; // Still works without sprite

mapImg.src = 'lake.png';
collisionImg.src = 'lakedepthcollisiondock.png';
boatImg.src = 'woodenboat.png';
dockImg.src = 'lakedock.png';

function checkLoaded() {
    if (imagesLoaded >= totalImages) {
        try {
            buildWaterMask();
        } catch (e) {
            console.warn('Water mask failed, skipping:', e);
        }
        initBirds();
        initClouds();
        initFireflies();
        initLilyPads();
        gameState = State.DRIVING;
        setStatus('WASD to drive. Click water to cast. B for shop. Dock to access shop.');
    }
}

function isNearDock(x, y) {
    if (!dockData) return false;
    const px = Math.floor((x / canvas.width) * dockData.width);
    const py = Math.floor((y / canvas.height) * dockData.height);
    if (px < 0 || px >= dockData.width || py < 0 || py >= dockData.height) return false;
    const idx = (py * dockData.width + px) * 4;
    const r = dockData.data[idx];
    const g = dockData.data[idx + 1];
    // Red zone = dock
    return r > 150 && g < 100;
}

// ============================================
// COLLISION CHECK
// ============================================
function isWater(worldX, worldY) {
    if (!collisionData) return false;
    const px = Math.floor((worldX / canvas.width) * collisionData.width);
    const py = Math.floor((worldY / canvas.height) * collisionData.height);
    if (px < 0 || px >= collisionData.width || py < 0 || py >= collisionData.height) return false;
    const idx = (py * collisionData.width + px) * 4;
    const r = collisionData.data[idx];
    const g = collisionData.data[idx + 1];
    const b = collisionData.data[idx + 2];
    // Green (G>200, B<50) = land — not navigable
    if (g > 200 && b < 50) return false;
    // Red (R>180, G<100, B<100) = dock — not navigable
    if (r > 180 && g < 100 && b < 100) return false;
    return true; // Blue zones (any shade) = water/navigable
}

// ============================================
// BOAT
// ============================================
let boat = {
    x: 0, y: 0,
    angle: 0,
    speed: 0,
    maxSpeed: 2.5,
    acceleration: 0.12,
    friction: 0.96,
    turnSpeed: 0.035,
    width: 20,
    height: 36,
    atDock: false
};

// Boat tiers
const boatTiers = [
    { id: 'rowboat', name: 'Wooden Rowboat', price: 0, cargoHold: 5, maxSpeed: 1.2, sprite: 'woodenboat.png', tier: 1 },
    { id: 'aluminum', name: 'Aluminum Boat', price: 400, cargoHold: 10, maxSpeed: 2.0, sprite: 'aluminumboat.png', tier: 2 },
    { id: 'bass_boat', name: 'Bass Boat', price: 1200, cargoHold: 15, maxSpeed: 2.5, sprite: 'bassboat.png', tier: 3 }
];
let equippedBoat = boatTiers[0];

function findStartPosition() {
    // Start just off the dock in water
    boat.x = canvas.width * 0.53;
    boat.y = canvas.height * 0.68;
    boat.angle = 0;
    boat.atDock = false;
}

// ============================================
// WATER ANIMATION OVERLAY
// ============================================
let waterMaskCanvas = null;
let waterOverlayCanvas = null;
let waterOverlayCtx = null;
let shallowMaskCanvas = null;
let mediumMaskCanvas = null;
let deepMaskCanvas = null;
let shorelineMaskCanvas = null;
let waterTime = 0;

function buildWaterMask() {
    // Create masks at the collision image's native resolution, then scale to canvas
    const cw = collisionData.width;
    const ch = collisionData.height;
    
    // All-water mask
    const tempMask = document.createElement('canvas');
    tempMask.width = cw;
    tempMask.height = ch;
    const tempCtx = tempMask.getContext('2d');
    
    // Per-depth masks at native res
    const tempShallow = document.createElement('canvas');
    tempShallow.width = cw; tempShallow.height = ch;
    const shallowCtx = tempShallow.getContext('2d');
    
    const tempMedium = document.createElement('canvas');
    tempMedium.width = cw; tempMedium.height = ch;
    const mediumCtx = tempMedium.getContext('2d');
    
    const tempDeep = document.createElement('canvas');
    tempDeep.width = cw; tempDeep.height = ch;
    const deepCtx = tempDeep.getContext('2d');
    
    const allData = tempCtx.createImageData(cw, ch);
    const sData = shallowCtx.createImageData(cw, ch);
    const mData = mediumCtx.createImageData(cw, ch);
    const dData = deepCtx.createImageData(cw, ch);
    
    for (let i = 0; i < cw * ch; i++) {
        const srcIdx = i * 4;
        const r = collisionData.data[srcIdx];
        const g = collisionData.data[srcIdx + 1];
        const b = collisionData.data[srcIdx + 2];
        const destIdx = i * 4;
        
        const isLand = (g > 200 && b < 50);
        
        if (!isLand) {
            // All-water mask
            allData.data[destIdx] = 255;
            allData.data[destIdx + 1] = 255;
            allData.data[destIdx + 2] = 255;
            allData.data[destIdx + 3] = 255;
            
            // Determine depth zone
            const isDeep = (b > 100 && b < 180 && g < 50);
            const isShallow = (b > 200 && g < 50);
            const isDock = (r > 180 && g < 100 && b < 100);
            
            if (isShallow) {
                sData.data[destIdx] = 255; sData.data[destIdx+1] = 255;
                sData.data[destIdx+2] = 255; sData.data[destIdx+3] = 255;
            } else if (isDeep) {
                dData.data[destIdx] = 255; dData.data[destIdx+1] = 255;
                dData.data[destIdx+2] = 255; dData.data[destIdx+3] = 255;
            } else if (!isDock) {
                // Medium = anything blue that's not shallow or deep
                mData.data[destIdx] = 255; mData.data[destIdx+1] = 255;
                mData.data[destIdx+2] = 255; mData.data[destIdx+3] = 255;
            }
        }
    }
    
    tempCtx.putImageData(allData, 0, 0);
    shallowCtx.putImageData(sData, 0, 0);
    mediumCtx.putImageData(mData, 0, 0);
    deepCtx.putImageData(dData, 0, 0);
    
    // Build shoreline mask — fast distance field approach
    const tempShoreline = document.createElement('canvas');
    tempShoreline.width = cw; tempShoreline.height = ch;
    const shoreCtx = tempShoreline.getContext('2d');
    const shoreData = shoreCtx.createImageData(cw, ch);
    
    const radius = 18;
    // First pass: mark all land pixels in a simple array
    const isLandArr = new Uint8Array(cw * ch);
    for (let i = 0; i < cw * ch; i++) {
        const g = collisionData.data[i * 4 + 1];
        const b = collisionData.data[i * 4 + 2];
        if (g > 200 && b < 50) isLandArr[i] = 1;
    }
    
    // Distance field using two-pass approximation (Manhattan-ish)
    const dist = new Float32Array(cw * ch).fill(radius + 1);
    // Forward pass
    for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
            const i = y * cw + x;
            if (isLandArr[i]) { dist[i] = 0; continue; }
            if (y > 0) dist[i] = Math.min(dist[i], dist[(y-1)*cw+x] + 1);
            if (x > 0) dist[i] = Math.min(dist[i], dist[y*cw+(x-1)] + 1);
        }
    }
    // Backward pass
    for (let y = ch - 1; y >= 0; y--) {
        for (let x = cw - 1; x >= 0; x--) {
            const i = y * cw + x;
            if (y < ch-1) dist[i] = Math.min(dist[i], dist[(y+1)*cw+x] + 1);
            if (x < cw-1) dist[i] = Math.min(dist[i], dist[y*cw+(x+1)] + 1);
        }
    }
    
    // Build mask with gradient falloff, excluding land and dock
    for (let i = 0; i < cw * ch; i++) {
        if (isLandArr[i]) continue;
        const d = dist[i];
        if (d > 0 && d <= radius) {
            // Exclude dock
            const r = collisionData.data[i * 4];
            const g = collisionData.data[i * 4 + 1];
            const b = collisionData.data[i * 4 + 2];
            if (r > 180 && g < 100 && b < 100) continue;
            
            const alpha = Math.round(255 * (1 - d / radius));
            const destIdx = i * 4;
            shoreData.data[destIdx] = 255;
            shoreData.data[destIdx + 1] = 255;
            shoreData.data[destIdx + 2] = 255;
            shoreData.data[destIdx + 3] = alpha;
        }
    }
    shoreCtx.putImageData(shoreData, 0, 0);
    
    // Scale all masks to canvas size
    waterMaskCanvas = document.createElement('canvas');
    waterMaskCanvas.width = canvas.width; waterMaskCanvas.height = canvas.height;
    waterMaskCanvas.getContext('2d').drawImage(tempMask, 0, 0, canvas.width, canvas.height);
    
    shallowMaskCanvas = document.createElement('canvas');
    shallowMaskCanvas.width = canvas.width; shallowMaskCanvas.height = canvas.height;
    shallowMaskCanvas.getContext('2d').drawImage(tempShallow, 0, 0, canvas.width, canvas.height);
    
    mediumMaskCanvas = document.createElement('canvas');
    mediumMaskCanvas.width = canvas.width; mediumMaskCanvas.height = canvas.height;
    mediumMaskCanvas.getContext('2d').drawImage(tempMedium, 0, 0, canvas.width, canvas.height);
    
    deepMaskCanvas = document.createElement('canvas');
    deepMaskCanvas.width = canvas.width; deepMaskCanvas.height = canvas.height;
    deepMaskCanvas.getContext('2d').drawImage(tempDeep, 0, 0, canvas.width, canvas.height);
    
    shorelineMaskCanvas = document.createElement('canvas');
    shorelineMaskCanvas.width = canvas.width; shorelineMaskCanvas.height = canvas.height;
    shorelineMaskCanvas.getContext('2d').drawImage(tempShoreline, 0, 0, canvas.width, canvas.height);
    
    // Create overlay canvas
    waterOverlayCanvas = document.createElement('canvas');
    waterOverlayCanvas.width = canvas.width;
    waterOverlayCanvas.height = canvas.height;
    waterOverlayCtx = waterOverlayCanvas.getContext('2d');
}

function renderWaterOverlay() {
    if (!waterOverlayCtx || !waterMaskCanvas) return;
    
    waterTime += 1 / 60;
    
    if (!animToggles.depth && !animToggles.shoreline) return;
    const oc = waterOverlayCtx;
    
  if (animToggles.depth) {
    // Shallow: breathing between slight darken and slight lighten
    if (shallowMaskCanvas) {
        const sineVal = Math.sin(waterTime * 0.8);
        const sineVal2 = Math.sin(waterTime * 1.4 + 0.8) * 0.5; // faster secondary pulse
        const combined = sineVal + sineVal2;
        // Darken phase
        if (combined < 0) {
            const darkAlpha = 0.01 + Math.abs(combined) * 0.012;
            oc.clearRect(0, 0, waterOverlayCanvas.width, waterOverlayCanvas.height);
            oc.globalAlpha = 1.0;
            oc.globalCompositeOperation = 'source-over';
            oc.fillStyle = '#0a2040';
            oc.fillRect(0, 0, waterOverlayCanvas.width, waterOverlayCanvas.height);
            oc.globalCompositeOperation = 'destination-in';
            oc.drawImage(shallowMaskCanvas, 0, 0);
            oc.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = darkAlpha;
            ctx.drawImage(waterOverlayCanvas, 0, 0);
        } else {
            // Lighten phase
            const lightAlpha = combined * 0.012;
            oc.clearRect(0, 0, waterOverlayCanvas.width, waterOverlayCanvas.height);
            oc.globalAlpha = 1.0;
            oc.globalCompositeOperation = 'source-over';
            oc.fillStyle = '#ffffff';
            oc.fillRect(0, 0, waterOverlayCanvas.width, waterOverlayCanvas.height);
            oc.globalCompositeOperation = 'destination-in';
            oc.drawImage(shallowMaskCanvas, 0, 0);
            oc.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = lightAlpha;
            ctx.drawImage(waterOverlayCanvas, 0, 0);
        }
    }
    
    // Medium: slower pulse, offset phase
    if (mediumMaskCanvas) {
        const sineVal = Math.sin(waterTime * 0.5 + 1.5);
        const sineVal2 = Math.sin(waterTime * 1.1 + 2.3) * 0.5;
        const combined = sineVal + sineVal2;
        if (combined < 0) {
            const darkAlpha = 0.008 + Math.abs(combined) * 0.01;
            oc.clearRect(0, 0, waterOverlayCanvas.width, waterOverlayCanvas.height);
            oc.globalAlpha = 1.0;
            oc.globalCompositeOperation = 'source-over';
            oc.fillStyle = '#0a1a30';
            oc.fillRect(0, 0, waterOverlayCanvas.width, waterOverlayCanvas.height);
            oc.globalCompositeOperation = 'destination-in';
            oc.drawImage(mediumMaskCanvas, 0, 0);
            oc.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = darkAlpha;
            ctx.drawImage(waterOverlayCanvas, 0, 0);
        } else {
            const lightAlpha = combined * 0.009;
            oc.clearRect(0, 0, waterOverlayCanvas.width, waterOverlayCanvas.height);
            oc.globalAlpha = 1.0;
            oc.globalCompositeOperation = 'source-over';
            oc.fillStyle = '#ffffff';
            oc.fillRect(0, 0, waterOverlayCanvas.width, waterOverlayCanvas.height);
            oc.globalCompositeOperation = 'destination-in';
            oc.drawImage(mediumMaskCanvas, 0, 0);
            oc.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = lightAlpha;
            ctx.drawImage(waterOverlayCanvas, 0, 0);
        }
    }
    
    // Deep: slowest pulse
    if (deepMaskCanvas) {
        const sineVal = Math.sin(waterTime * 0.3 + 3.0);
        const sineVal2 = Math.sin(waterTime * 0.7 + 4.2) * 0.5;
        const combined = sineVal + sineVal2;
        if (combined < 0) {
            const darkAlpha = 0.008 + Math.abs(combined) * 0.01;
            oc.clearRect(0, 0, waterOverlayCanvas.width, waterOverlayCanvas.height);
            oc.globalAlpha = 1.0;
            oc.globalCompositeOperation = 'source-over';
            oc.fillStyle = '#050d1a';
            oc.fillRect(0, 0, waterOverlayCanvas.width, waterOverlayCanvas.height);
            oc.globalCompositeOperation = 'destination-in';
            oc.drawImage(deepMaskCanvas, 0, 0);
            oc.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = darkAlpha;
            ctx.drawImage(waterOverlayCanvas, 0, 0);
        } else {
            const lightAlpha = combined * 0.007;
            oc.clearRect(0, 0, waterOverlayCanvas.width, waterOverlayCanvas.height);
            oc.globalAlpha = 1.0;
            oc.globalCompositeOperation = 'source-over';
            oc.fillStyle = '#ffffff';
            oc.fillRect(0, 0, waterOverlayCanvas.width, waterOverlayCanvas.height);
            oc.globalCompositeOperation = 'destination-in';
            oc.drawImage(deepMaskCanvas, 0, 0);
            oc.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = lightAlpha;
            ctx.drawImage(waterOverlayCanvas, 0, 0);
        }
    }
  } // end depth toggle
    
    // Shoreline shimmer — non-uniform pulse along water-land edge
  if (animToggles.shoreline) {
    if (shorelineMaskCanvas) {
        oc.clearRect(0, 0, waterOverlayCanvas.width, waterOverlayCanvas.height);
        oc.globalAlpha = 1.0;
        oc.globalCompositeOperation = 'source-over';
        
        // Draw several vertical strips with offset timing for non-uniform look
        const strips = 8;
        const stripWidth = waterOverlayCanvas.width / strips;
        for (let i = 0; i < strips; i++) {
            const phaseOffset = i * 0.9;
            const stripAlpha = 0.10 + Math.max(0, Math.sin(waterTime * 1.0 + phaseOffset)) * 0.15;
            oc.globalAlpha = stripAlpha;
            oc.fillStyle = '#ffffff';
            oc.fillRect(i * stripWidth, 0, stripWidth, waterOverlayCanvas.height);
        }
        
        oc.globalAlpha = 1.0;
        oc.globalCompositeOperation = 'destination-in';
        oc.drawImage(shorelineMaskCanvas, 0, 0);
        oc.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.drawImage(waterOverlayCanvas, 0, 0);
    }
  } // end shoreline toggle
    
    ctx.globalAlpha = 1.0;
}

// ============================================
// BOAT WAKE BUBBLES
// ============================================
let bubbles = [];

function spawnBubble() {
    // Spawn from the back of the boat
    const backX = boat.x - Math.sin(boat.angle) * (boat.height / 2);
    const backY = boat.y + Math.cos(boat.angle) * (boat.height / 2);
    bubbles.push({
        x: backX + (Math.random() - 0.5) * 8,
        y: backY + (Math.random() - 0.5) * 8,
        size: 2 + Math.random() * 3,
        alpha: 0.6 + Math.random() * 0.3,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3
    });
}

function updateBubbles() {
    if (!animToggles.bubbles) return;
    // Spawn bubbles based on speed
    if (Math.abs(boat.speed) > 0.3) {
        const spawnRate = Math.min(Math.abs(boat.speed) / equippedBoat.maxSpeed, 1);
        if (Math.random() < spawnRate * 0.6) spawnBubble();
        if (Math.random() < spawnRate * 0.3) spawnBubble();
    }
    // Update existing bubbles
    for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.life += 1 / 60;
        b.alpha = (1 - b.life / b.maxLife) * 0.7;
        b.size += 0.02;
        b.x += (Math.random() - 0.5) * 0.3;
        b.y += (Math.random() - 0.5) * 0.3;
        if (b.life >= b.maxLife) {
            bubbles.splice(i, 1);
        }
    }
}

function renderBubbles() {
    if (!animToggles.bubbles) return;
    for (const b of bubbles) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${b.alpha * 0.5})`;
        ctx.fill();
    }
}

// ============================================
// FIREFLIES (NIGHT ONLY)
// ============================================
let fireflies = [];

function initFireflies() {
    // Spawn fireflies only over land/islands (not water)
    let attempts = 0;
    while (fireflies.length < 15 && attempts < 200) {
        attempts++;
        const x = 50 + Math.random() * (canvas.width - 100);
        const y = 50 + Math.random() * (canvas.height - 100);
        // Only place on land (not water)
        if (!isWater(x, y)) {
            fireflies.push({
                x: x,
                y: y,
                homeX: x,
                homeY: y,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                phase: Math.random() * Math.PI * 2,
                pulseSpeed: 1.5 + Math.random() * 2,
                size: 2 + Math.random() * 1.5
            });
        }
    }
}

function updateFireflies() {
    if (!isNight()) return;
    for (const f of fireflies) {
        f.phase += f.pulseSpeed * (1 / 60);
        f.x += f.vx + Math.sin(f.phase * 0.5) * 0.2;
        f.y += f.vy + Math.cos(f.phase * 0.7) * 0.15;
        
        // Drift direction change
        if (Math.random() < 0.01) {
            f.vx = (Math.random() - 0.5) * 0.4;
            f.vy = (Math.random() - 0.5) * 0.4;
        }
        
        // Pull back toward home (stay near wooded areas)
        const dxHome = f.homeX - f.x;
        const dyHome = f.homeY - f.y;
        const distHome = Math.sqrt(dxHome * dxHome + dyHome * dyHome);
        if (distHome > 40) {
            f.vx += dxHome * 0.002;
            f.vy += dyHome * 0.002;
        }
    }
}

function renderFireflies() {
    if (!isNight()) return;
    for (const f of fireflies) {
        const glow = Math.max(0, Math.sin(f.phase)) * 0.8;
        if (glow < 0.1) continue;
        
        const gradient = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size * 3);
        gradient.addColorStop(0, `rgba(180, 255, 50, ${glow})`);
        gradient.addColorStop(0.4, `rgba(150, 230, 30, ${glow * 0.4})`);
        gradient.addColorStop(1, `rgba(100, 200, 0, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(f.x - f.size * 3, f.y - f.size * 3, f.size * 6, f.size * 6);
        
        // Core dot
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 255, 100, ${glow})`;
        ctx.fill();
    }
}

// ============================================
// WATERFALL MIST
// ============================================
let mistParticles = [];

function updateMist() {
    if (!animToggles.mist) return;
    // Spawn area — waterfall (ratio-based, calculated from 2322x1155 reference)
    const spawnX = canvas.width * 0.2705;
    const spawnY = canvas.height * 0.0900;
    
    // Second spawn point (slightly left and lower)
    const spawnX2 = canvas.width * 0.2665;
    const spawnY2 = canvas.height * 0.0930;
    
    // Spawn a few particles per frame from each point
    if (Math.random() < 0.4) {
        mistParticles.push({
            x: spawnX + (Math.random() - 0.5) * 30,
            y: spawnY + Math.random() * 10,
            vx: (Math.random() - 0.5) * 0.3,
            vy: 0.2 + Math.random() * 0.4,
            size: 3 + Math.random() * 6,
            alpha: 0.15 + Math.random() * 0.15,
            life: 0,
            maxLife: 2.5 + Math.random() * 2.0
        });
    }
    if (Math.random() < 0.4) {
        mistParticles.push({
            x: spawnX2 + (Math.random() - 0.5) * 30,
            y: spawnY2 + Math.random() * 10,
            vx: (Math.random() - 0.5) * 0.3,
            vy: 0.2 + Math.random() * 0.4,
            size: 3 + Math.random() * 6,
            alpha: 0.15 + Math.random() * 0.15,
            life: 0,
            maxLife: 2.5 + Math.random() * 2.0
        });
    }
    
    // Update particles
    for (let i = mistParticles.length - 1; i >= 0; i--) {
        const p = mistParticles[i];
        p.life += 1 / 60;
        p.x += p.vx + Math.sin(p.life * 2 + p.size) * 0.15;
        p.y += p.vy;
        p.size += 0.02;
        p.vy *= 0.995;
        
        // Fade out over lifetime
        const lifeRatio = p.life / p.maxLife;
        p.alpha *= (1 - lifeRatio * 0.02);
        
        if (p.life >= p.maxLife || p.alpha < 0.01) {
            mistParticles.splice(i, 1);
        }
    }
}

function renderMist() {
    if (!animToggles.mist) return;
    for (const p of mistParticles) {
        const lifeRatio = p.life / p.maxLife;
        const fadeAlpha = p.alpha * (1 - lifeRatio);
        
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${fadeAlpha})`);
        gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
    }
}

// ============================================
// AMBIENT RIPPLE RINGS
// ============================================
let ambientRipples = [];
let rippleTimer = 7; // Start near trigger so first one appears quickly

function updateAmbientRipples() {
    rippleTimer += 1/60;
    
    // Spawn a ripple every 5-10 seconds
    if (rippleTimer > 5 + Math.random() * 5) {
        rippleTimer = 0;
        const rx = 150 + Math.random() * (canvas.width - 300);
        const ry = 100 + Math.random() * (canvas.height - 200);
        ambientRipples.push({
            x: rx, y: ry,
            size: 0,
            maxSize: 20 + Math.random() * 20,
            alpha: 0.5,
            speed: 15 + Math.random() * 10
        });
    }
    
    // Update existing ripples
    for (let i = ambientRipples.length - 1; i >= 0; i--) {
        const r = ambientRipples[i];
        r.size += r.speed * (1/60);
        r.alpha = 0.4 * (1 - r.size / r.maxSize);
        if (r.size >= r.maxSize) {
            ambientRipples.splice(i, 1);
        }
    }
}

function renderAmbientRipples() {
    for (const r of ambientRipples) {
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.size, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200, 230, 255, ${r.alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        // Second ring slightly behind
        if (r.size > 5) {
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.size * 0.6, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(200, 230, 255, ${r.alpha * 0.5})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
        }
    }
}

// ============================================
// CAST SPLASH PARTICLES
// ============================================
let splashParticles = [];

function spawnCastSplash(x, y) {
    if (!animToggles.castSplash) return;
    for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 2.5;
        splashParticles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 1.5 + Math.random() * 2,
            alpha: 0.7 + Math.random() * 0.3,
            life: 0,
            maxLife: 0.4 + Math.random() * 0.3
        });
    }
    // Center ripple
    splashParticles.push({
        x: x, y: y, vx: 0, vy: 0,
        size: 3, alpha: 0.5, life: 0, maxLife: 0.6, isRipple: true
    });
}

function updateSplash() {
    for (let i = splashParticles.length - 1; i >= 0; i--) {
        const p = splashParticles[i];
        p.life += 1 / 60;
        if (p.isRipple) {
            p.size += 2;
            p.alpha *= 0.94;
        } else {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.9;
            p.vy *= 0.9;
            p.alpha *= 0.92;
        }
        if (p.life >= p.maxLife || p.alpha < 0.01) {
            splashParticles.splice(i, 1);
        }
    }
}

function renderSplash() {
    for (const p of splashParticles) {
        if (p.isRipple) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${p.alpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200, 230, 255, ${p.alpha})`;
            ctx.fill();
        }
    }
}

// ============================================
// HOOK FLASH ANIMATION
// ============================================
let hookFlash = { active: false, time: 0, x: 0, y: 0 };

function triggerHookFlash(x, y) {
    if (!animToggles.hookFlash) return;
    hookFlash.active = true;
    hookFlash.time = 0;
    hookFlash.x = x;
    hookFlash.y = y;
}

function updateHookFlash() {
    if (!hookFlash.active) return;
    hookFlash.time += 1 / 60;
    if (hookFlash.time > 0.4) hookFlash.active = false;
}

function renderHookFlash() {
    if (!hookFlash.active) return;
    const t = hookFlash.time;
    
    // Quick expanding ring
    const ringSize = t * 80;
    const ringAlpha = Math.max(0, 1 - t * 3);
    ctx.beginPath();
    ctx.arc(hookFlash.x, hookFlash.y, ringSize, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 220, 50, ${ringAlpha})`;
    ctx.lineWidth = 3 - t * 6;
    if (ctx.lineWidth > 0) ctx.stroke();
    
    // Inner flash
    const flashAlpha = Math.max(0, 1 - t * 5);
    if (flashAlpha > 0) {
        const gradient = ctx.createRadialGradient(hookFlash.x, hookFlash.y, 0, hookFlash.x, hookFlash.y, 15);
        gradient.addColorStop(0, `rgba(255, 255, 200, ${flashAlpha})`);
        gradient.addColorStop(1, `rgba(255, 220, 50, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(hookFlash.x - 15, hookFlash.y - 15, 30, 30);
    }
    
    // Screen shake effect via slight canvas offset
    if (t < 0.15) {
        const shake = (0.15 - t) * 20;
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
}

// ============================================
// FISH SHADOW (BOBBER DRAG DURING FIGHT)
// ============================================
let fishDrag = { targetX: 0, targetY: 0, changeTimer: 0, originX: 0, originY: 0 };

function initFishDrag() {
    fishDrag.originX = bobber.x;
    fishDrag.originY = bobber.y;
    fishDrag.targetX = bobber.x;
    fishDrag.targetY = bobber.y;
    fishDrag.changeTimer = 0;
}

function updateFishShadow() {
    if (!animToggles.fishShadow) return;
    if (gameState !== State.FIGHTING) return;
    
    fishDrag.changeTimer += 1 / 60;
    
    // Pick a new target direction every 0.5-1.5 seconds
    if (fishDrag.changeTimer > 0.5 + Math.random() * 1.0) {
        fishDrag.changeTimer = 0;
        const maxDrag = currentCatch ? 15 + currentCatch.strength * 25 : 20;
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * maxDrag;
        const newX = fishDrag.originX + Math.cos(angle) * dist;
        const newY = fishDrag.originY + Math.sin(angle) * dist;
        
        // Only go there if it's water
        if (isWater(newX, newY)) {
            fishDrag.targetX = newX;
            fishDrag.targetY = newY;
        }
    }
    
    // Smoothly move bobber toward target
    bobber.x += (fishDrag.targetX - bobber.x) * 0.04;
    bobber.y += (fishDrag.targetY - bobber.y) * 0.04;
    
    // Add jitter
    bobber.x += (Math.random() - 0.5) * 0.5;
    bobber.y += (Math.random() - 0.5) * 0.5;
}

function renderFishShadow() {
    // No separate render needed — the bobber itself moves
}

// ============================================
// FISH JUMPING
// ============================================
let jumpingFish = [];
let fishJumpTimer = 6; // Start near trigger so first jump happens quickly

function updateFishJumps() {
    if (!animToggles.fishJump) return;
    
    fishJumpTimer += 1 / 60;
    
    // Spawn a jump every 8-15 seconds randomly around the water
    if (fishJumpTimer > 8 + Math.random() * 7) {
        fishJumpTimer = 0;
        // Random water position
        const jx = 200 + Math.random() * (canvas.width - 400);
        const jy = 150 + Math.random() * (canvas.height - 300);
        
        if (isWater(jx, jy) && !isAtDock(jx, jy)) {
            jumpingFish.push({
                x: jx,
                y: jy,
                time: 0,
                duration: 0.8 + Math.random() * 0.4,
                height: 15 + Math.random() * 10,
                size: 5 + Math.random() * 4,
                angle: Math.random() * Math.PI * 2,
                splashed: false
            });
        }
    }
    
    // Update active jumps
    for (let i = jumpingFish.length - 1; i >= 0; i--) {
        const f = jumpingFish[i];
        f.time += 1 / 60;
        
        // Spawn splash when landing
        if (f.time > f.duration * 0.7 && !f.splashed) {
            f.splashed = true;
            // Small landing ripple
            splashParticles.push({
                x: f.x, y: f.y, vx: 0, vy: 0,
                size: 2, alpha: 0.4, life: 0, maxLife: 0.5, isRipple: true
            });
        }
        
        if (f.time >= f.duration) {
            jumpingFish.splice(i, 1);
        }
    }
}

function renderFishJumps() {
    if (!animToggles.fishJump) return;
    
    for (const f of jumpingFish) {
        const progress = f.time / f.duration;
        // Arc: parabola from 0 to 1
        const arcHeight = -4 * f.height * progress * (progress - 1);
        const alpha = progress < 0.1 ? progress * 10 : (progress > 0.8 ? (1 - progress) * 5 : 1);
        
        ctx.save();
        ctx.translate(f.x, f.y - arcHeight);
        ctx.rotate(f.angle + (progress - 0.5) * 1.2); // rotate as it arcs
        
        // Simple fish silhouette
        ctx.globalAlpha = alpha * 0.8;
        ctx.beginPath();
        ctx.ellipse(0, 0, f.size * 1.8, f.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#2a5a3a';
        ctx.fill();
        
        // Tail
        ctx.beginPath();
        ctx.moveTo(-f.size * 1.6, 0);
        ctx.lineTo(-f.size * 2.5, -f.size * 0.6);
        ctx.lineTo(-f.size * 2.5, f.size * 0.6);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
        
        // Entry/exit splash ripple
        if (progress < 0.15) {
            const rippleAlpha = (0.15 - progress) * 4;
            ctx.beginPath();
            ctx.arc(f.x, f.y, 4 + progress * 20, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${rippleAlpha * 0.5})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}

// ============================================
// CLOUD SHADOWS
// ============================================
let cloudShadows = [];
const cloudImgs = [new Image(), new Image(), new Image()];
cloudImgs[0].src = 'cloud.png';
cloudImgs[1].src = 'cloud2.png';
cloudImgs[2].src = 'cloud3.png';

function initClouds() {
    for (let i = 0; i < 5; i++) {
        cloudShadows.push({
            x: -300 - (i * 400) - Math.random() * 300, // Stagger start positions off-screen
            y: -canvas.height * 0.2 + Math.random() * canvas.height * 1.1,
            scale: 0.3 + Math.random() * 0.3,
            speed: 0.15 + Math.random() * 0.15,
            alpha: 0.2 + Math.random() * 0.15,
            imgIndex: Math.floor(Math.random() * 3),
            flipX: Math.random() < 0.5,
            rotation: (Math.random() - 0.5) * 0.3,
            active: true,
            cooldown: 0
        });
    }
}

function updateClouds() {
    if (!animToggles.clouds) return;
    for (const c of cloudShadows) {
        if (!c.active) {
            c.cooldown -= 1/60;
            if (c.cooldown <= 0) {
                c.active = true;
                c.x = -300;
                c.y = -canvas.height * 0.2 + Math.random() * canvas.height * 1.1;
                c.scale = 0.3 + Math.random() * 0.3;
                c.imgIndex = Math.floor(Math.random() * 3);
            }
            continue;
        }
        c.x += c.speed;
        if (c.x > canvas.width + 300) {
            c.x = -300;
            c.y = -canvas.height * 0.2 + Math.random() * canvas.height * 1.1;
            c.scale = 0.3 + Math.random() * 0.3;
            c.imgIndex = Math.floor(Math.random() * 3);
            c.flipX = Math.random() < 0.5;
            c.rotation = (Math.random() - 0.5) * 0.3;
            c.alpha = 0.2 + Math.random() * 0.15;
        }
    }
}

function renderClouds() {
    if (!animToggles.clouds) return;
    for (const c of cloudShadows) {
        if (!c.active) continue;
        const img = cloudImgs[c.imgIndex];
        if (!img.complete || img.naturalWidth === 0) continue;
        const w = img.naturalWidth * c.scale;
        const h = img.naturalHeight * c.scale;
        ctx.save();
        ctx.globalAlpha = c.alpha;
        ctx.translate(c.x + w / 2, c.y + h / 2);
        ctx.rotate(c.rotation);
        if (c.flipX) ctx.scale(-1, 1);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
    }
}

// ============================================
// CATTAILS
// ============================================
let cattails = [];

function initCattails() {
    const centerX = canvas.width * (395 / 2322);
    const centerY = canvas.height * (900 / 1155);
    
    for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 45;
        cattails.push({
            x: centerX + Math.cos(angle) * dist,
            y: centerY + Math.sin(angle) * dist * 0.5, // flatter spread along shore
            height: 14 + Math.random() * 10,
            swayPhase: Math.random() * Math.PI * 2,
            swaySpeed: 0.6 + Math.random() * 0.4,
            swayAmount: 1.5 + Math.random() * 1.5,
            headSize: 2.5 + Math.random() * 1.5,
            headLength: 5 + Math.random() * 3,
            leafCount: Math.floor(1 + Math.random() * 2)
        });
    }
}

function renderCattails() {
    for (const c of cattails) {
        const sway = Math.sin(waterTime * c.swaySpeed + c.swayPhase) * c.swayAmount;
        
        ctx.save();
        ctx.translate(c.x, c.y);
        
        // Stalk
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(sway * 0.5, -c.height * 0.5, sway, -c.height);
        ctx.strokeStyle = 'rgba(60, 90, 40, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Leaves
        for (let l = 0; l < c.leafCount; l++) {
            const leafY = -c.height * (0.3 + l * 0.25);
            const leafSway = sway * (0.3 + l * 0.2);
            const leafDir = l % 2 === 0 ? 1 : -1;
            ctx.beginPath();
            ctx.moveTo(leafSway * 0.5, leafY);
            ctx.quadraticCurveTo(
                leafSway * 0.5 + leafDir * 8, leafY - 4,
                leafSway * 0.5 + leafDir * 12, leafY + 2
            );
            ctx.strokeStyle = 'rgba(50, 80, 35, 0.7)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        // Seed head (brown oval at top)
        const headX = sway;
        const headY = -c.height;
        ctx.beginPath();
        ctx.ellipse(headX, headY - c.headLength / 2, c.headSize * 0.6, c.headLength / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(90, 55, 25, 0.9)';
        ctx.fill();
        
        // Tiny spike at very top
        ctx.beginPath();
        ctx.moveTo(headX, headY - c.headLength);
        ctx.lineTo(headX + sway * 0.1, headY - c.headLength - 3);
        ctx.strokeStyle = 'rgba(70, 90, 40, 0.6)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        
        ctx.restore();
    }
}

// ============================================
// LILY PADS
// ============================================
let lilyPads = [];
const lilyPadImgs = [new Image(), new Image()];
lilyPadImgs[0].src = 'lillypad1.png';
lilyPadImgs[1].src = 'lillypad2.png';

function initLilyPads() {
    const centerX = canvas.width * (485 / 2322);
    const centerY = canvas.height * (844 / 1155);
    
    // Main cluster
    for (let i = 0; i < 14; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 45;
        lilyPads.push({
            x: centerX + Math.cos(angle) * dist,
            y: centerY + Math.sin(angle) * dist,
            size: 6 + Math.random() * 5,
            rotation: Math.random() * Math.PI * 2,
            bobPhase: Math.random() * Math.PI * 2,
            bobSpeed: 0.8 + Math.random() * 0.6,
            hasFlower: Math.random() < 0.3,
            imgIndex: Math.random() < 0.2 ? 1 : 0
        });
    }
    
    // Cluster to the right
    const rightX = canvas.width * (605 / 2322);
    const rightY = canvas.height * (874 / 1155);
    for (let i = 0; i < 11; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 35;
        lilyPads.push({
            x: rightX + Math.cos(angle) * dist,
            y: rightY + Math.sin(angle) * dist,
            size: 5 + Math.random() * 5,
            rotation: Math.random() * Math.PI * 2,
            bobPhase: Math.random() * Math.PI * 2,
            bobSpeed: 0.8 + Math.random() * 0.6,
            hasFlower: Math.random() < 0.25,
            imgIndex: Math.random() < 0.2 ? 1 : 0
        });
    }
    
    // Cluster below
    const belowX = canvas.width * (515 / 2322);
    const belowY = canvas.height * (924 / 1155);
    for (let i = 0; i < 9; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 30;
        lilyPads.push({
            x: belowX + Math.cos(angle) * dist,
            y: belowY + Math.sin(angle) * dist,
            size: 5 + Math.random() * 4,
            rotation: Math.random() * Math.PI * 2,
            bobPhase: Math.random() * Math.PI * 2,
            bobSpeed: 0.8 + Math.random() * 0.6,
            hasFlower: Math.random() < 0.2,
            imgIndex: Math.random() < 0.2 ? 1 : 0
        });
    }
    
    // Cluster at 555, 839
    const extraX = canvas.width * (555 / 2322);
    const extraY = canvas.height * (839 / 1155);
    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 35;
        lilyPads.push({
            x: extraX + Math.cos(angle) * dist,
            y: extraY + Math.sin(angle) * dist,
            size: 5 + Math.random() * 5,
            rotation: Math.random() * Math.PI * 2,
            bobPhase: Math.random() * Math.PI * 2,
            bobSpeed: 0.8 + Math.random() * 0.6,
            hasFlower: Math.random() < 0.2,
            imgIndex: Math.random() < 0.2 ? 1 : 0
        });
    }
}

function renderLilyPads() {
    if (!animToggles.lilyPads) return;
    for (const pad of lilyPads) {
        const bob = Math.sin(waterTime * pad.bobSpeed + pad.bobPhase) * 1.2;
        const img = lilyPadImgs[pad.imgIndex];
        if (!img.complete || img.naturalWidth === 0) continue;
        
        ctx.save();
        ctx.translate(pad.x, pad.y + bob);
        ctx.rotate(pad.rotation);
        ctx.globalAlpha = 0.7;
        const drawSize = pad.size * 2.5;
        ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        ctx.restore();
    }
}

// ============================================
// BIRDS (CROWS) CIRCLING OVER ISLAND
// ============================================
let birds = [];

function initBirds() {
    // Circle over the top-right island area
    const centerX = canvas.width * 0.72;
    const centerY = canvas.height * 0.28;
    
    for (let i = 0; i < 4; i++) {
        birds.push({
            centerX: centerX + (Math.random() - 0.5) * 30,
            centerY: centerY + (Math.random() - 0.5) * 20,
            radius: 25 + Math.random() * 35,
            speed: 0.3 + Math.random() * 0.25,
            angle: Math.random() * Math.PI * 2,
            wingPhase: Math.random() * Math.PI * 2,
            wingSpeed: 3 + Math.random() * 2,
            size: 3 + Math.random() * 2
        });
    }
}

function updateBirds() {
    if (isNight()) return;
    for (const bird of birds) {
        bird.angle += bird.speed * (1/60);
        bird.wingPhase += bird.wingSpeed * (1/60);
    }
}

function renderBirds() {
    for (const bird of birds) {
        const x = bird.centerX + Math.cos(bird.angle) * bird.radius;
        const y = bird.centerY + Math.sin(bird.angle) * bird.radius * 0.5; // elliptical path
        
        // Wing flap — "M" shape that animates
        const wingDip = Math.sin(bird.wingPhase) * 2.5;
        const s = bird.size;
        
        ctx.beginPath();
        ctx.moveTo(x - s * 2, y + wingDip);
        ctx.quadraticCurveTo(x - s * 0.8, y - s * 0.5, x, y);
        ctx.quadraticCurveTo(x + s * 0.8, y - s * 0.5, x + s * 2, y + wingDip);
        ctx.strokeStyle = 'rgba(20, 20, 20, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}

// ============================================
// CAMERA
// ============================================
let camera = { x: 0, y: 0, zoom: 1.5 };

function updateCamera() {
    // No scrolling - map fills screen
    camera.x = 0;
    camera.y = 0;
}

// ============================================
// INPUT
// ============================================
const keys = {};
let mouse = { x: 0, y: 0, clicked: false, down: false };

document.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'b') toggleShop();
    startAudio();
});
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
document.addEventListener('mousedown', e => { mouse.clicked = true; mouse.down = true; startAudio(); });
document.addEventListener('mouseup', e => { mouse.down = false; });
document.addEventListener('wheel', e => { e.preventDefault(); }, { passive: false });

// ============================================
// SHOP
// ============================================
let shopOpen = false;

function toggleShop() {
    if (shopOpen) {
        // Always allow closing
        shopOpen = false;
        document.getElementById('shop-panel').style.display = 'none';
        gameState = State.DRIVING;
        return;
    }
    if (!boat.atDock) {
        setStatus("Must be at the dock to access shop!");
        return;
    }
    if (gameState !== State.DRIVING && gameState !== State.CAUGHT) return;
    shopOpen = true;
    document.getElementById('shop-panel').style.display = 'block';
    playSound(audio.shopOpen);
    renderShop();
}

function renderShop() {
    const panel = document.getElementById('shop-items');
    panel.innerHTML = '';
    
    // Sell fish section
    if (inventory.length > 0) {
        const sellHeader = document.createElement('h3');
        sellHeader.textContent = '🐟 Sell Fish';
        sellHeader.style.color = '#ffd700';
        sellHeader.style.marginBottom = '8px';
        panel.appendChild(sellHeader);
        
        inventory.forEach((fish, index) => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.style.padding = '4px 0';
            div.style.borderBottom = '1px solid #333';
            div.innerHTML = `
                <span style="color:#ccc;">${fish.name} (${fish.weight}kg)</span>
                <button onclick="sellFromInventory(${index})" 
                    style="padding:4px 10px; background:#c49a20; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px;">
                    Sell $${fish.sellValue}</button>
            `;
            panel.appendChild(div);
        });
        
        // Sell all button
        const sellAllDiv = document.createElement('div');
        sellAllDiv.style.marginTop = '8px';
        sellAllDiv.style.textAlign = 'center';
        const totalValue = inventory.reduce((sum, f) => sum + f.sellValue, 0);
        sellAllDiv.innerHTML = `
            <button onclick="sellAllFish()" 
                style="padding:6px 16px; background:#d4aa30; color:white; border:none; border-radius:4px; cursor:pointer; font-size:14px; font-weight:bold;">
                Sell All ($${totalValue})</button>
        `;
        panel.appendChild(sellAllDiv);
        
        const spacer = document.createElement('hr');
        spacer.style.border = '1px solid #333';
        spacer.style.margin = '12px 0';
        panel.appendChild(spacer);
    }
    
    // Boat upgrades section
    const boatHeader = document.createElement('h3');
    boatHeader.textContent = '🚤 Boats';
    boatHeader.style.color = '#4cf';
    boatHeader.style.marginTop = '12px';
    panel.appendChild(boatHeader);

    // Bait section
    const baitHeader = document.createElement('h3');
    baitHeader.textContent = '🪱 Bait';
    baitHeader.style.color = '#4cf';
    baitHeader.style.marginTop = '12px';
    panel.appendChild(baitHeader);
    
    baitTypes.forEach(b => {
        if (b.id === 'none') return; // No bait - always available, skip in shop
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.padding = '4px 0';
        div.style.borderBottom = '1px solid #333';
        
        const owned = baitInventory[b.id] || 0;
        const isEquipped = equippedBait.id === b.id;
        const canAfford = gold >= b.price;
        const reduction = Math.round((1 - b.biteMultiplier) * 100);
        
        let rightSide = '';
        if (owned > 0) {
            rightSide = `<span style="color:#aaa; margin-right:8px;">(${owned})</span>`;
            if (!isEquipped) {
                rightSide += `<button onclick="equipBait('${b.id}')" style="padding:3px 8px; background:#2d8a4e; color:white; border:none; border-radius:4px; cursor:pointer; font-size:11px;">Use</button>`;
            } else {
                rightSide += `<span style="color:#4cf; font-size:11px;">✓ Active</span>`;
            }
        }
        rightSide += ` <button onclick="buyBait('${b.id}')" style="padding:3px 8px; background:${canAfford ? '#c49a20' : '#555'}; color:white; border:none; border-radius:4px; cursor:pointer; font-size:11px;" ${!canAfford ? 'disabled' : ''}>Buy x${b.quantity || 1} ($${b.price})</button>`;
        
        div.innerHTML = `
            <span style="color:#ccc; font-size:12px;">${b.name} (-${reduction}% wait)</span>
            <span>${rightSide}</span>
        `;
        panel.appendChild(div);
    });
    
    const baitSpacer = document.createElement('hr');
    baitSpacer.style.border = '1px solid #333';
    baitSpacer.style.margin = '8px 0';
    panel.appendChild(baitSpacer);
    
    boatTiers.forEach(b => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.padding = '4px 0';
        div.style.borderBottom = '1px solid #333';
        
        const isEquipped = b.id === equippedBoat.id;
        const canAfford = gold >= b.price;
        const owned = b.price === 0 || isEquipped || ownedGear.includes(b.id);
        
        let btnText = isEquipped ? '✓ Current' : (owned ? 'Use' : `Buy $${b.price}`);
        let btnColor = isEquipped ? '#555' : (owned ? '#2d8a4e' : (canAfford ? '#c49a20' : '#555'));
        
        div.innerHTML = `
            <span style="color: ${isEquipped ? '#4cf' : '#ccc'};">${b.name} (Hold: ${b.cargoHold})</span>
            <button onclick="buyOrEquipBoat('${b.id}')" 
                style="padding:4px 10px; background:${btnColor}; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px;"
                ${(!canAfford && !owned) ? 'disabled' : ''}>${btnText}</button>
        `;
        panel.appendChild(div);
    });
    
    // Gear shop section
    const categories = [
        { name: 'Rods', items: gearTiers.rods, equipped: equippedRod },
        { name: 'Reels', items: gearTiers.reels, equipped: equippedReel },
        { name: 'Lines', items: gearTiers.lines, equipped: equippedLine }
    ];
    
    categories.forEach(cat => {
        const header = document.createElement('h3');
        header.textContent = cat.name;
        header.style.color = '#4cf';
        header.style.marginTop = '12px';
        panel.appendChild(header);
        
        cat.items.forEach(item => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.style.padding = '4px 0';
            div.style.borderBottom = '1px solid #333';
            
            const isEquipped = item.id === cat.equipped.id;
            const canAfford = gold >= item.price;
            const owned = item.price === 0 || isEquipped || getOwnedGear().includes(item.id);
            
            let btnText = isEquipped ? '✓ Equipped' : (owned ? 'Equip' : `Buy $${item.price}`);
            let btnColor = isEquipped ? '#555' : (owned ? '#2d8a4e' : (canAfford ? '#c49a20' : '#555'));
            
            div.innerHTML = `
                <span style="color: ${isEquipped ? '#4cf' : '#ccc'};">${item.name} (Tier ${item.tier})</span>
                <button onclick="buyOrEquip('${cat.name.toLowerCase()}', '${item.id}')" 
                    style="padding:4px 10px; background:${btnColor}; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px;"
                    ${(!canAfford && !owned) ? 'disabled' : ''}>${btnText}</button>
            `;
            panel.appendChild(div);
        });
    });
}

let ownedGear = ['bamboo_rod', 'basic_reel', 'mono_6lb'];

function getOwnedGear() { return ownedGear; }

function buyOrEquipBoat(boatId) {
    const b = boatTiers.find(t => t.id === boatId);
    if (!b) return;
    
    if (!ownedGear.includes(boatId)) {
        if (gold < b.price) return;
        gold -= b.price;
        ownedGear.push(boatId);
        playSound(audio.buy);
        updateStatsUI();
        updateBoatRadios();
    }
    
    equippedBoat = b;
    boatImg.src = b.sprite;
    document.getElementById('current-boat-name').textContent = b.name;
    updateBoatRadios();
    renderShop();
}

function selectBoat(boatId) {
    const b = boatTiers.find(t => t.id === boatId);
    if (!b) return;
    equippedBoat = b;
    boatImg.src = b.sprite;
    document.getElementById('current-boat-name').textContent = b.name;
    setStatus(`Switched to ${b.name}!`);
    updateStatsUI();
}

function updateBoatRadios() {
    // Check the current boat's radio
    const radios = document.querySelectorAll('input[name="boat-select"]');
    radios.forEach(r => { r.checked = r.value === equippedBoat.id; });
}

function buyBait(baitId) {
    const b = baitTypes.find(t => t.id === baitId);
    if (!b || gold < b.price) return;
    gold -= b.price;
    baitInventory[baitId] = (baitInventory[baitId] || 0) + (b.quantity || 1);
    playSound(audio.buy);
    updateStatsUI();
    renderShop();
}

function equipBait(baitId) {
    const b = baitTypes.find(t => t.id === baitId);
    if (!b) return;
    if (baitId !== 'none' && (baitInventory[baitId] || 0) <= 0) return;
    equippedBait = b;
    renderShop();
}

function cycleBoat() {
    if (!boat.atDock) {
        setStatus("Must be at dock to switch boats!");
        return;
    }
    const owned = boatTiers.filter(b => b.price === 0 || ownedGear.includes(b.id));
    if (owned.length <= 1) {
        setStatus("You only have one boat!");
        return;
    }
    const currentIdx = owned.findIndex(b => b.id === equippedBoat.id);
    const nextIdx = (currentIdx + 1) % owned.length;
    equippedBoat = owned[nextIdx];
    document.getElementById('current-boat-name').textContent = equippedBoat.name;
    setStatus(`Switched to ${equippedBoat.name}!`);
    updateStatsUI();
}

function buyOrEquip(category, itemId) {
    let items, equipped;
    if (category === 'rods') { items = gearTiers.rods; }
    else if (category === 'reels') { items = gearTiers.reels; }
    else { items = gearTiers.lines; }
    
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    if (!ownedGear.includes(itemId)) {
        if (gold < item.price) return;
        gold -= item.price;
        ownedGear.push(itemId);
        playSound(audio.buy);
        updateStatsUI();
    }
    
    if (category === 'rods') equippedRod = item;
    else if (category === 'reels') equippedReel = item;
    else equippedLine = item;
    
    renderShop();
}

// ============================================
// FISHING MECHANICS
// ============================================
let bobber = { x: 0, y: 0, visible: false, time: 0 };
let biteTimer = 0;
let biteTarget = 0;
let tension = 0;
let progress = 0;
let biteWindowTimer = 0;
let fishEscapeTimer = 0;

function startCast() {
    const targetX = mouse.x;
    const targetY = mouse.y;
    
    if (!isWater(targetX, targetY)) {
        setStatus("Can't cast there — that's land!");
        gameState = State.DRIVING;
        return;
    }
    
    // Check cast range
    const dx = targetX - boat.x;
    const dy = targetY - boat.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxRange = equippedRod.castRange;
    
    let castX, castY;
    if (dist > maxRange) {
        const ratio = maxRange / dist;
        castX = boat.x + dx * ratio;
        castY = boat.y + dy * ratio;
    } else {
        castX = targetX;
        castY = targetY;
    }
    
    if (!isWater(castX, castY)) {
        setStatus("Can't reach water there!");
        gameState = State.DRIVING;
        return;
    }
    
    bobber.x = castX;
    bobber.y = castY;
    bobber.visible = true;
    bobber.time = 0;
    spawnCastSplash(castX, castY);
    playSound(audio.cast);
    setTimeout(() => playSound(audio.splash), 300);
    
    // Bite time based on depth and gear match
    const depth = getDepthAtPosition(castX, castY);
    const gearTier = Math.min(equippedRod.tier, equippedReel.tier, equippedLine.tier);
    
    let baseWait;
    if (depth === 'shallow') baseWait = 3 + Math.random() * 5;
    else if (depth === 'medium') baseWait = 5 + Math.random() * 8;
    else baseWait = 8 + Math.random() * 12;
    
    // Wrong gear penalty
    const zoneMinTier = depth === 'shallow' ? 1 : (depth === 'medium' ? 2 : 3);
    if (gearTier < zoneMinTier) {
        baseWait *= 1.5 + (zoneMinTier - gearTier) * 0.5;
    }
    
    // Bait reduction
    baseWait *= equippedBait.biteMultiplier;
    
    // Use bait (consume one if not unlimited)
    if (equippedBait.id !== 'none') {
        if (baitInventory[equippedBait.id] > 0) {
            baitInventory[equippedBait.id]--;
            if (baitInventory[equippedBait.id] <= 0) {
                equippedBait = baitTypes[0]; // Back to no bait when out
                setStatus('Out of bait! Switched to no bait. Line out...');
            }
        } else {
            equippedBait = baitTypes[0];
        }
    }
    
    biteTimer = 0;
    biteTarget = baseWait;
    
    // Lucky cast — 5% chance for perfect cast
    if (Math.random() < 0.05) {
        biteTarget *= 0.5;
        setStatus('✨ Perfect cast! Fish are interested...');
    } else {
        setStatus('Line out... waiting for a bite...');
    }
    
    gameState = State.WAITING;
}

function triggerBite() {
    gameState = State.BITE;
    biteWindowTimer = 0;
    playSound(audio.bite);
    setStatus('🐟 BITE! Click NOW to hook!');
}

function hookFish() {
    currentCatch = rollFish(bobber.x, bobber.y);
    tension = 0.2;
    progress = 0;
    fishEscapeTimer = 0;
    gameState = State.FIGHTING;
    triggerHookFlash(bobber.x, bobber.y);
    initFishDrag();
    setStatus(`⚡ Hooked a ${currentCatch.name}! Hold click to reel!`);
    document.getElementById('tension-bar').style.display = 'block';
    document.getElementById('progress-bar').style.display = 'block';
}

function landFish() {
    gameState = State.CAUGHT;
    document.getElementById('tension-bar').style.display = 'none';
    document.getElementById('progress-bar').style.display = 'none';
    playSound(audio.fishCaught);
    
    // Set fish image
    const imgSrc = fishImageMap[currentCatch.id] || '';
    const catchImg = document.getElementById('catch-img');
    if (imgSrc) {
        catchImg.src = imgSrc;
        catchImg.style.display = 'block';
    } else {
        catchImg.style.display = 'none';
    }
    
    document.getElementById('catch-name').textContent = currentCatch.name;
    document.getElementById('catch-weight').textContent = `Weight: ${currentCatch.weight} kg`;
    document.getElementById('catch-length').textContent = `Length: ${currentCatch.length} cm`;
    document.getElementById('catch-xp').textContent = `+${currentCatch.xp} XP`;
    document.getElementById('catch-value').textContent = `Value: ${currentCatch.sellValue} gold`;
    document.getElementById('catch-panel').style.display = 'block';
    // Hide sell button on water - can only sell at dock
    document.getElementById('sell-btn').style.display = 'none';
    setStatus('');
}

function lineBroke() {
    gameState = State.DRIVING;
    bobber.visible = false;
    document.getElementById('tension-bar').style.display = 'none';
    document.getElementById('progress-bar').style.display = 'none';
    playSound(audio.snap);
    setStatus('💥 Line snapped! Click to cast again.');
}

// ============================================
// KEEP / SELL
// ============================================
function keepFish() {
    if (inventory.length >= equippedBoat.cargoHold) {
        setStatus(`Hold full! (${inventory.length}/${equippedBoat.cargoHold}) Drive to dock to sell.`);
        document.getElementById('catch-panel').style.display = 'none';
        bobber.visible = false;
        gameState = State.DRIVING;
        checkAchievements();
        return;
    }
    fishCaught++;
    addXP(currentCatch.xp);
    const isRecord = recordCatch(currentCatch);
    if (isRecord && fishJournal[currentCatch.id].count > 1) {
        triggerAchievement(`🎉 New PB: ${currentCatch.name} — ${currentCatch.weight}kg!`);
    }
    inventory.push(currentCatch);
    document.getElementById('catch-panel').style.display = 'none';
    bobber.visible = false;
    gameState = State.DRIVING;
    setStatus(`Kept ${currentCatch.name}! (${inventory.length}/${equippedBoat.cargoHold}) Drive to dock to sell.`);
    updateStatsUI();
    checkAchievements();
}

function sellFromInventory(index) {
    const fish = inventory[index];
    gold += fish.sellValue;
    inventory.splice(index, 1);
    updateStatsUI();
    renderShop();
    gameState = State.DRIVING;
    playSound(audio.coin);
    setStatus(`Sold ${fish.name} for ${fish.sellValue} gold!`);
    checkAchievements();
}

function sellAllFish() {
    const totalValue = inventory.reduce((sum, f) => sum + f.sellValue, 0);
    const count = inventory.length;
    gold += totalValue;
    inventory = [];
    updateStatsUI();
    renderShop();
    playSound(audio.coin);
    setStatus(`Sold ${count} fish for ${totalValue} gold!`);
    checkAchievements();
}

function sellFish() {
    // Legacy - shouldn't be called on water anymore
    keepFish();
}

// ============================================
// FISH JOURNAL UI
// ============================================
let journalOpen = false;

function toggleJournal() {
    journalOpen = !journalOpen;
    const panel = document.getElementById('journal-panel');
    if (journalOpen) {
        panel.style.display = 'block';
        renderJournal();
    } else {
        panel.style.display = 'none';
    }
}

function renderJournal() {
    const content = document.getElementById('journal-content');
    const entries = Object.values(fishJournal);
    
    if (entries.length === 0) {
        content.innerHTML = '<p style="color:#aaa; text-align:center;">No fish caught yet. Get out there!</p>';
        return;
    }
    
    // Stats header
    let html = `<div style="margin-bottom:12px; padding:8px; background:rgba(0,0,0,0.3); border-radius:6px; text-align:center;">
        <span style="color:#4cf;">Species: ${entries.length}/${fishTypes.length}</span> &nbsp;|&nbsp;
        <span style="color:#4cf;">Total Caught: ${fishCaught}</span> &nbsp;|&nbsp;
        <span style="color:#ffd700;">Achievements: ${achievements.length}/${achievementDefs.length}</span>
    </div>`;
    
    // Fish entries
    entries.forEach(entry => {
        const imgSrc = fishImageMap[Object.keys(fishJournal).find(k => fishJournal[k] === entry)] || '';
        html += `<div style="display:flex; align-items:center; padding:8px; margin:4px 0; background:rgba(0,0,0,0.2); border-radius:6px;">
            ${imgSrc ? `<img src="${imgSrc}" style="width:50px; height:30px; object-fit:contain; margin-right:10px;">` : ''}
            <div style="flex:1;">
                <div style="color:#fff; font-weight:bold;">${entry.name}</div>
                <div style="color:#aaa; font-size:11px;">Caught: ${entry.count} | Best: ${entry.biggestWeight}kg / ${entry.biggestLength}cm</div>
            </div>
        </div>`;
    });
    
    content.innerHTML = html;
}

function addXP(amount) {
    xp += amount;
    while (xp >= xpToNext) {
        xp -= xpToNext;
        level++;
        xpToNext = Math.floor(xpToNext * 1.4);
        playSound(audio.levelUp);
        triggerAchievement(`⭐ Level ${level}!`);
    }
    updateStatsUI();
}

function updateStatsUI() {
    document.getElementById('gold').textContent = gold;
    document.getElementById('level').textContent = level;
    document.getElementById('xp').textContent = xp;
    document.getElementById('xp-need').textContent = xpToNext;
    document.getElementById('fish-count').textContent = fishCaught;
    document.getElementById('rod-name').textContent = equippedRod.name;
    document.getElementById('cargo').textContent = `${inventory.length}/${equippedBoat.cargoHold}`;
    
    // Update clock
    const h = gameHour % 12 || 12;
    const ampm = gameHour >= 12 ? 'PM' : 'AM';
    const m = String(gameMinute).padStart(2, '0');
    document.getElementById('game-clock').textContent = `${h}:${m} ${ampm}`;
}

function setStatus(text) {
    document.getElementById('status').textContent = text;
}

// ============================================
// UPDATE
// ============================================
function update() {
    updateGameTime();
    updateAudio();
    sendPlayerState();
    updateBubbles();
    updateBirds();
    updateMist();
    updateSplash();
    updateHookFlash();
    updateClouds();
    updateFishShadow();
    updateFireflies();
    updateAmbientRipples();
    updateAchievementDisplay();
    switch (gameState) {
        case State.DRIVING:
            updateBoat();
            if (mouse.clicked) {
                console.log('Click detected. shopOpen:', shopOpen, 'gameState:', gameState);
                mouse.clicked = false;
                if (!shopOpen) {
                    startCast();
                }
            }
            break;
            
        case State.WAITING:
            biteTimer += 1/60;
            bobber.time += 1/60;
            if (biteTimer >= biteTarget) triggerBite();
            if (mouse.clicked) {
                mouse.clicked = false;
                bobber.visible = false;
                gameState = State.DRIVING;
                setStatus('Reeled in. Click to cast, B for shop.');
            }
            break;
            
        case State.BITE:
            biteWindowTimer += 1/60;
            bobber.time += 1/60;
            if (mouse.clicked) { mouse.clicked = false; hookFish(); }
            if (biteWindowTimer > 2.0) {
                biteTimer = 0;
                biteTarget = 3 + Math.random() * 8;
                gameState = State.WAITING;
                setStatus('Missed! Waiting again...');
            }
            break;
            
        case State.FIGHTING:
            bobber.time += 1/60;
            const strength = currentCatch.strength;
            
            tension += strength * (0.3 + Math.random() * 0.5) * (1/60);
            if (Math.random() < 0.008) tension += strength * 0.12;
            
            if (mouse.down) {
                progress += equippedReel.reelSpeed * (1/60);
                tension += (0.12 - equippedReel.tensionReduction * 0.12) * (1/60);
                fishEscapeTimer = 0;
            } else {
                tension -= 0.5 * (1/60);
                fishEscapeTimer += 1/60;
                // After 5 seconds of not reeling, small chance fish escapes
                if (fishEscapeTimer > 5 && Math.random() < 0.003) {
                    gameState = State.DRIVING;
                    bobber.visible = false;
                    document.getElementById('tension-bar').style.display = 'none';
                    document.getElementById('progress-bar').style.display = 'none';
                    setStatus('🐟 The fish spit the hook! Cast again.');
                    break;
                }
            }
            
            tension = Math.max(0, Math.min(1, tension));
            
            document.getElementById('tension-fill').style.width = (tension * 100) + '%';
            // Smooth gradient color based on tension level
            const tensionFill = document.getElementById('tension-fill');
            const t = tension;
            let r, g;
            if (t < 0.5) {
                // Green to yellow (0 to 0.5)
                r = Math.round(t * 2 * 170);
                g = 170;
            } else {
                // Yellow to red (0.5 to 1.0)
                r = 170;
                g = Math.round((1 - (t - 0.5) * 2) * 170);
            }
            tensionFill.style.background = `rgb(${r}, ${g}, 68)`;
            document.getElementById('progress-fill').style.width = (progress * 100) + '%';
            
            if (tension >= equippedLine.maxTension) lineBroke();
            if (progress >= 1.0) landFish();
            
            mouse.clicked = false;
            break;
            
        case State.CAUGHT:
            mouse.clicked = false;
            break;
    }
}

function updateBoat() {
    if (keys['a'] || keys['arrowleft']) boat.angle -= boat.turnSpeed;
    if (keys['d'] || keys['arrowright']) boat.angle += boat.turnSpeed;
    
    if (keys['w'] || keys['arrowup']) {
        boat.speed = Math.min(boat.speed + boat.acceleration, equippedBoat.maxSpeed);
    } else if (keys['s'] || keys['arrowdown']) {
        boat.speed = Math.max(boat.speed - boat.acceleration, -equippedBoat.maxSpeed * 0.4);
    } else {
        boat.speed *= boat.friction;
    }
    
    const newX = boat.x + Math.sin(boat.angle) * boat.speed;
    const newY = boat.y - Math.cos(boat.angle) * boat.speed;
    
    if (isWater(newX, newY)) {
        boat.x = newX;
        boat.y = newY;
    } else {
        boat.speed *= -0.3;
    }
    
    // Check if at dock
    if (isAtDock(boat.x, boat.y)) {
        if (!boat.atDock) {
            boat.atDock = true;
            document.getElementById('dock-prompt').style.display = 'block';
            setStatus('');
        }
    } else {
        if (boat.atDock) {
            boat.atDock = false;
            document.getElementById('dock-prompt').style.display = 'none';
            if (shopOpen) toggleShop();
            setStatus('WASD to drive. Click to cast.');
        }
    }
    
    updateCamera();
}

// ============================================
// RENDER
// ============================================
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background color for areas outside map
    ctx.fillStyle = '#1a3a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw map - fill entire screen
    ctx.drawImage(mapImg, 0, 0, canvas.width, canvas.height);
    
    // Draw animated water overlay
    if (waterMaskDirty && collisionData) {
        try { buildWaterMask(); } catch(e) { console.warn('Water mask rebuild failed:', e); }
        waterMaskDirty = false;
    }
    if (waterOverlayCanvas) renderWaterOverlay();
    
    // Draw cast range indicator when driving
    if (gameState === State.DRIVING && !shopOpen) {
        ctx.beginPath();
        ctx.arc(boat.x, boat.y, equippedRod.castRange, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    // Draw bobber
    if (bobber.visible) {
        const bx = bobber.x;
        const by = bobber.y;
        
        // Ripple
        const rippleSize = 6 + Math.sin(bobber.time * 3) * 2;
        ctx.beginPath();
        ctx.arc(bx, by, rippleSize, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Bobber
        const bobOffset = gameState === State.BITE ? Math.sin(bobber.time * 14) * 3 : Math.sin(bobber.time * 2) * 1;
        ctx.beginPath();
        ctx.arc(bx, by + bobOffset, 5, 0, Math.PI * 2);
        ctx.fillStyle = gameState === State.BITE ? '#ff2222' : '#ff5533';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx, by + bobOffset - 4, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        // Fishing line
        ctx.beginPath();
        ctx.moveTo(boat.x, boat.y);
        ctx.lineTo(bx, by + bobOffset);
        ctx.strokeStyle = 'rgba(50,50,50,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    
    // Draw mist
    renderMist();
    
    // Draw ambient ripples
    renderAmbientRipples();
    
    // Draw lily pads
    renderLilyPads();
    
    // Draw cloud shadows
    
    // Draw splash particles
    renderSplash();
    
    // Draw hook flash
    renderHookFlash();
    
    // Draw fish shadow during fight
    renderFishShadow();
    
    // Draw bubbles (behind boat)
    renderBubbles();
    
    // Draw other players
    renderOtherPlayers();
    
    // Draw birds
    renderBirds();
    
    // Draw boat
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);
    
    if (boatImg.complete && boatImg.naturalWidth > 0) {
        // Draw sprite
        ctx.drawImage(boatImg, -boat.width, -boat.height, boat.width * 2, boat.height * 2);
    } else {
        // Fallback drawn boat
        ctx.beginPath();
        ctx.moveTo(0, -boat.height/2);
        ctx.lineTo(boat.width/2, boat.height/3);
        ctx.lineTo(boat.width/3, boat.height/2);
        ctx.lineTo(-boat.width/3, boat.height/2);
        ctx.lineTo(-boat.width/2, boat.height/3);
        ctx.closePath();
        ctx.fillStyle = '#8B4513';
        ctx.fill();
        ctx.strokeStyle = '#5C2E0A';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#d4a76a';
        ctx.fillRect(-5, -3, 10, 12);
    }
    
    // Wake effect
    if (Math.abs(boat.speed) > 0.5) {
        ctx.beginPath();
        ctx.moveTo(-1, boat.height/2);
        ctx.lineTo(1, boat.height/2);
        ctx.lineTo(0, boat.height/2 + 2 + Math.abs(boat.speed) * 0.7);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fill();
    }
    
    ctx.restore();
    
    // Draw clouds above everything
    renderClouds();
    
    // Time of day tint
    renderTimeTint();
    
    // Fireflies at night
    renderFireflies();
    
    // Achievement toast
    renderAchievementToast();
    
    // Grid overlay
    if (animToggles.grid) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '10px monospace';
        ctx.lineWidth = 0.5;
        const step = 100;
        for (let x = 0; x < canvas.width; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
            ctx.fillText(x, x + 2, 12);
        }
        for (let y = 0; y < canvas.height; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
            ctx.fillText(y, 2, y + 12);
        }
        // Show mouse position
        ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
        ctx.font = '12px monospace';
        ctx.fillText(`${mouse.x}, ${mouse.y}`, mouse.x + 10, mouse.y - 10);
        ctx.fillText(`Canvas: ${canvas.width} x ${canvas.height}`, canvas.width - 200, 12);
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'yellow';
        ctx.fill();
        ctx.restore();
    }
}

// ============================================
// GAME LOOP
// ============================================
function gameLoop() {
    update();
    render();
    updateStatsUI();
    mouse.clicked = false;
    requestAnimationFrame(gameLoop);
}

let playerName = 'Angler';

function startGame(name) {
    if (name) playerName = name;
    findStartPosition();
    updateCamera();
    updateStatsUI();
    gameLoop();
}

function waitForLoad() {
    if (imagesLoaded >= totalImages) {
        // Don't auto-start — wait for splash screen
        document.getElementById('ui').style.display = 'none';
    } else {
        requestAnimationFrame(waitForLoad);
    }
}
waitForLoad();

// Splash screen handler
document.getElementById('hk-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('hk-name').value.trim() || 'Angler';
    document.getElementById('hooked-splash').classList.add('hk-hidden');
    document.getElementById('ui').style.display = '';
    // Clear any pending click so it doesn't auto-cast
    mouse.clicked = false;
    mouse.down = false;
    setTimeout(() => { mouse.clicked = false; mouse.down = false; }, 100);
    startGame(name);
});
