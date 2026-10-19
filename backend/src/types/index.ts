import type { RowDataPacket } from 'mysql2';

export interface AuthUser {
  userId: string;
  email: string;
}

export interface ProjectRow extends RowDataPacket {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface RequirementRow extends RowDataPacket {
  id: string;
  project_id: string;
  screen_id: string;
  screen_name: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

export type QuestionStatus = 'open' | 'answered' | 'dismissed';

export interface QuestionRow extends RowDataPacket {
  id: string;
  project_id: string;
  screen_name: string | null;
  question: string;
  reason: string | null;
  category: string;
  options: string | null;
  answer: string | null;
  status: QuestionStatus;
  created_at: Date;
  answered_at: Date | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      project?: ProjectRow;
    }
  }
}
