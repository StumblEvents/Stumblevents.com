const initializedDocuments = new WeakSet();

export function initializeVerification({
  documentRef = document,
  windowRef = window,
  fetchImpl = fetch,
} = {}) {
  // A module is evaluated once in browsers, but this also prevents accidental
  // duplicate initialization from consuming a one-time TokenHash twice.
  if (initializedDocuments.has(documentRef)) return;
  initializedDocuments.add(documentRef);

  const title = documentRef.getElementById("result-title");
  const message = documentRef.getElementById("resultMessage");
  const eyebrow = documentRef.getElementById("statusEyebrow");
  const icon = documentRef.getElementById("statusIcon");
  const openButton = documentRef.getElementById("openStumbl");
  let tokenHash = "";
  let verificationStarted = false;

  const showFailure = (isUnavailable = false) => {
    icon.className = "status-icon failure";
    eyebrow.textContent = isUnavailable ? "Please try again" : "Verification unavailable";
    title.textContent = isUnavailable ? "We couldn’t reach verification" : "We couldn’t verify this email link";
    message.textContent = isUnavailable
      ? "Please check your connection and try again. If it still doesn’t work, request a new verification email from Stumbl."
      : "This link may have expired, already been used, or be invalid. Request a new verification email from Stumbl and try again.";
    openButton.hidden = true;
  };

  const showSuccess = () => {
    icon.className = "status-icon success";
    eyebrow.textContent = "You’re all set";
    title.textContent = "Email verified!";
    message.textContent = "Your email address has been successfully verified. You can now return to Stumbl and continue discovering and creating events.";
    openButton.hidden = false;
  };

  const showLoading = () => {
    icon.className = "status-icon pending";
    eyebrow.textContent = "Just a moment";
    title.textContent = "Verifying your email…";
    message.textContent = "We’re securely confirming your email address.";
    openButton.hidden = true;
  };

  const fragment = new URLSearchParams(windowRef.location.hash.slice(1));
  tokenHash = fragment.get("token_hash") || "";
  const type = fragment.get("type");

  // The fragment does not reach the initial page request. Remove it before the
  // verification request so a one-time TokenHash cannot remain in browser history.
  if (windowRef.location.hash) {
    windowRef.history.replaceState(null, documentRef.title, windowRef.location.pathname);
  }

  if (!tokenHash || (type && type !== "email")) {
    showFailure();
    return;
  }

  const verify = async () => {
    if (verificationStarted || !tokenHash) return;
    verificationStarted = true;
    showLoading();

    // Clear the source variable before awaiting; the serialized request body is
    // sent directly to our same-origin verification endpoint and is never stored.
    const body = JSON.stringify({ token_hash: tokenHash });
    tokenHash = "";

    try {
      const response = await fetchImpl("/api/email-verification-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      const result = await response.json().catch(() => null);
      if (result?.verified === true) showSuccess();
      else showFailure(result?.reason === "unavailable");
    } catch {
      showFailure(true);
    }
  };

  void verify();
}

if (typeof document !== "undefined") initializeVerification();
