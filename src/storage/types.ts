/** The signed-in account, kept so the app reopens logged in (also offline). */
export interface SavedSession {
  userId: string;
  token: string;
  mfaEnabled: boolean;
  mfaRequired: boolean;
}
