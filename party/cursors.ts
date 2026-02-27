import type { Party, Connection, Server, ConnectionContext } from "partykit/server";

type CursorInfo = {
  country: string;
};

export default class CursorsServer implements Server {
  readonly room: Party;
  cursors: Map<string, CursorInfo> = new Map();

  constructor(room: Party) {
    this.room = room;
  }

  onConnect(conn: Connection, ctx: ConnectionContext) {
    const country =
      (ctx.request as unknown as { cf?: { country?: string } }).cf?.country ||
      "UN";
    this.cursors.set(conn.id, { country });
  }

  onMessage(message: string, sender: Connection) {
    const info = this.cursors.get(sender.id);
    if (!info) return;

    try {
      const { x, y } = JSON.parse(message);
      const broadcast = JSON.stringify({
        type: "update",
        id: sender.id,
        x,
        y,
        country: info.country,
      });

      const connections = [...this.room.getConnections()];
      for (const conn of connections) {
        if (conn.id !== sender.id) {
          conn.send(broadcast);
        }
      }
    } catch {
      // ignore malformed messages
    }
  }

  onClose(conn: Connection) {
    this.cursors.delete(conn.id);
    const msg = JSON.stringify({ type: "remove", id: conn.id });
    const connections = [...this.room.getConnections()];
    for (const c of connections) {
      c.send(msg);
    }
  }
}
