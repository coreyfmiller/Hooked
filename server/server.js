const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8081;
const wss = new WebSocketServer({ port: PORT });

const players = new Map();
let nextId = 1;

console.log(`Hooked multiplayer server running on port ${PORT}`);

wss.on('connection', (ws) => {
    const playerId = `player_${nextId++}`;
    const playerState = {
        id: playerId,
        x: 0,
        y: 0,
        angle: 0,
        speed: 0,
        boatSprite: 'woodenboat.png',
        fishingState: 'driving',
        bobberX: 0,
        bobberY: 0,
        bobberVisible: false,
        name: `Angler ${players.size + 1}`
    };
    
    players.set(playerId, { ws, state: playerState });
    
    // Send init to new player
    ws.send(JSON.stringify({
        type: 'init',
        id: playerId,
        players: Object.fromEntries(
            [...players].map(([id, p]) => [id, p.state])
        )
    }));
    
    // Notify others
    broadcast(JSON.stringify({
        type: 'player_joined',
        player: playerState
    }), playerId);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'update') {
                const player = players.get(playerId);
                if (player) {
                    player.state.x = data.x;
                    player.state.y = data.y;
                    player.state.angle = data.angle;
                    player.state.speed = data.speed;
                    player.state.boatSprite = data.boatSprite;
                    player.state.fishingState = data.fishingState;
                    player.state.bobberX = data.bobberX;
                    player.state.bobberY = data.bobberY;
                    player.state.bobberVisible = data.bobberVisible;
                }
                
                broadcast(JSON.stringify({
                    type: 'player_update',
                    id: playerId,
                    ...data
                }), playerId);
            }
        } catch (e) {
            // Ignore bad messages
        }
    });
    
    ws.on('close', () => {
        players.delete(playerId);
        broadcast(JSON.stringify({
            type: 'player_left',
            id: playerId
        }));
        console.log(`${playerId} disconnected. ${players.size} players online.`);
    });
    
    console.log(`${playerId} connected. ${players.size} players online.`);
});

function broadcast(message, excludeId) {
    for (const [id, player] of players) {
        if (id !== excludeId && player.ws.readyState === 1) {
            player.ws.send(message);
        }
    }
}
