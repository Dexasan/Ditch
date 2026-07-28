declare module "node-media-server" {
  export interface NodeMediaSession {
    id: string;
    ip: string;
    streamApp: string;
    streamName: string;
    streamPath: string;
    streamQuery: Record<string, string>;
    close: () => void;
  }

  interface NodeMediaServerConfig {
    bind: string;
    rtmp: { port: number };
    auth: { publish: boolean; play: boolean; secret: string };
  }

  class NodeMediaServer {
    constructor(config: NodeMediaServerConfig);
    on(eventName: "prePublish" | "postPublish" | "donePublish", listener: (session: NodeMediaSession) => void): void;
    run(): void;
  }

  export default NodeMediaServer;
}