const KIT_FORM_ENDPOINT = "https://app.kit.com/forms/9638140/subscriptions";

export async function subscribeToKit(email: string): Promise<boolean> {
  try {
    const res = await fetch(KIT_FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ email_address: email }).toString(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
