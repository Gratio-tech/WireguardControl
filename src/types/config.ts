export interface FrontendConfigFile {
  defaultInterface: string;
  frontServerPort: number;
  allowedOrigins: string[];
  frontendPasskey: string;
  dns: string[] | string;
  clientEncryptionPass: string;
  runtimeRotationMinutes?: number;
}

export interface InterfaceDetails {
  ip: string;
  cidr: number;
  port: number;
  pubkey: string;
  peers: string[];
}

export interface ServerMemoryConfig {
  allowedOrigins: string[];
  frontServerPort: number;
  frontendPasskey: string;
  dns: string[];
  runtimeRotationMinutes: number;
  clientEncryptionPass: string;
  wgIsWorking: boolean;
  configIsOk: boolean;
  endpoint: string;
  defaultInterface: string;
  interfaces: Record<string, InterfaceDetails>;
}

export interface PeerRecord {
  name: string;
  active: boolean;
  ip: string;
  presharedKey?: string;
  secretKey?: string;
  iface?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PeerStorage = Record<string, PeerRecord>;
