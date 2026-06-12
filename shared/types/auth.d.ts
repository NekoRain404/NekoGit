declare module '#auth-utils' {
  /** User. */
  interface User {
    login: string;
    name: string;
    avatar_url: string;
  }

  /** User Session. */
  interface UserSession {
    logged_in_at: Date;
    auth_provider: 'github' | 'pat' | 'personal';
  }

  /** Secure Session Data. */
  interface SecureSessionData {
    access_token: string;
  }
}

export {};
