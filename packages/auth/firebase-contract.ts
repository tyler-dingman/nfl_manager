/** Public configuration only. Never include Admin/service-account credentials. */
export interface FirebaseClientConfiguration {
  projectId: string;
  apiKey: string;
  authDomain: string;
  appId: string;
}
export interface FirebaseAuthConfiguration {
  mode: 'firebase' | 'legacy';
  firebase: FirebaseClientConfiguration | null;
}
