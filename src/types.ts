export interface Commit {
  id: string;
  author: string;
  message: string;
  timestamp: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  analysis?: string;
  files?: string[];
  repository: string;
  predictedBugs?: string[];
  recommendations?: string[];
  impactedModules?: string[];
}

export interface FileRisk {
  filePath: string;
  riskScore: number;
  lastModified?: string;
  bugCount?: number;
  repository: string;
}

export interface Repository {
  id: string;
  name: string;
  owner: string;
  status: 'active' | 'paused' | 'archived';
  lastAnalysis: string;
  avgRisk: number;
  commitCount: number;
}

export interface TeamMember {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: 'admin' | 'viewer' | 'editor';
  lastActive: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user';
}
