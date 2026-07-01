import { describe, it, expect } from "vitest";

vi.stubEnv("VITE_FIREBASE_API_KEY", "test-api-key");
vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "test.firebaseapp.com");
vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "test-project");
vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "test-project.appspot.com");
vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "123456789");
vi.stubEnv("VITE_FIREBASE_APP_ID", "1:123456789:web:abcdef");

describe("firebase client", () => {
  it("exports initialized auth, db, and storage instances", async () => {
    const { auth, db, storage } = await import("./client");
    expect(auth).toBeDefined();
    expect(db).toBeDefined();
    expect(storage).toBeDefined();
  });
});
