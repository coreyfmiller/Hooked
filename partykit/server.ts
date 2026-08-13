import type * as Party from "partykit/server";

// Store connected players
type PlayerState = {
  id: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  boatSprite: string;
  fishingState: string; // 'driving' | 'casting' | 'waiting' | 'fighting' | 'caught'
  bobberX: number;
  bobberY: number;
  bobberVisible: boolean;
  name: string;
};

export default class HookedServer implements Party.Server {
  players: Map<string, PlayerState> = new Map();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    // Assign player a color/name
    const playerState: PlayerState = {
      id: conn.id,
      x: 0,
      y: 0,
      angle: 0,
      speed: 0,
      boatSprite: "woodenboat.png",
      fishingState: "driving",
      bobberX: 0,
      bobberY: 0,
      bobberVisible: false,
      name: `Angler ${this.players.size + 1}`,
    };
    this.players.set(conn.id, playerState);

    // Send the new player their ID and all current players
    conn.send(
      JSON.stringify({
        type: "init",
        id: conn.id,
        players: Object.fromEntries(this.players),
      })
    );

    // Notify others about the new player
    this.room.broadcast(
      JSON.stringify({
        type: "player_joined",
        player: playerState,
      }),
      [conn.id]
    );
  }

  onMessage(message: string, sender: Party.Connection) {
    const data = JSON.parse(message);

    if (data.type === "update") {
      // Update player state
      const player = this.players.get(sender.id);
      if (player) {
        player.x = data.x;
        player.y = data.y;
        player.angle = data.angle;
        player.speed = data.speed;
        player.boatSprite = data.boatSprite;
        player.fishingState = data.fishingState;
        player.bobberX = data.bobberX;
        player.bobberY = data.bobberY;
        player.bobberVisible = data.bobberVisible;
      }

      // Broadcast to all other players
      this.room.broadcast(
        JSON.stringify({
          type: "player_update",
          id: sender.id,
          ...data,
        }),
        [sender.id]
      );
    }
  }

  onClose(conn: Party.Connection) {
    this.players.delete(conn.id);
    this.room.broadcast(
      JSON.stringify({
        type: "player_left",
        id: conn.id,
      })
    );
  }
}

HookedServer satisfies Party.Worker;
