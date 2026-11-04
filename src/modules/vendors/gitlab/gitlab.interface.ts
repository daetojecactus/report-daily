export type GitLabQuery = Record<string, string | number | boolean>;

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  state: string;
  avatar_url: string;
  web_url: string;
}
