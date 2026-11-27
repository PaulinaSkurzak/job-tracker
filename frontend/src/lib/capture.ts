/**
 * "Save to Job Tracker" bookmarklet.
 *
 * Flow: on a job posting, the bookmarklet opens /capture in a small window and, once that window says it is
 * ready, sends it the page's URL, title and text with postMessage. The capture page pre-fills the new
 * application form; nothing is saved until you click Add.
 *
 * Why not save straight from the job site? A script running on another site can't send your Job Tracker
 * session cookie or CSRF token (that protection is the point), so it hands the data to a Job Tracker window.
 */

export const MAX_TEXT = 20_000; // job descriptions are a few thousand characters; this cuts off whole-page noise
export const READY = "job-tracker:ready";
export const CAPTURE = "job-tracker:capture";

export type Capture = { url: string; title: string; text: string };

/**
 * The bookmarklet's JavaScript. It sends the data only to `origin` (postMessage's targetOrigin), so if
 * the window has been navigated somewhere else, the browser refuses to deliver it.
 *
 * Each click opens a new window ("_blank"). An earlier version reused one named window, and a reused window
 * keeps its *first* opener: the second posting's window asked the first job page and got the old posting.
 */
export function bookmarkletCode(origin: string): string {
  const source = `(() => {
    const data = {
      type: "${CAPTURE}",
      url: location.href,
      title: document.title,
      text: (String(getSelection()) || document.body.innerText).slice(0, ${MAX_TEXT}),
    };
    const popup = window.open("${origin}/capture", "_blank", "popup,width=760,height=900");
    if (!popup) { alert("Allow pop-ups for this site to save the posting to Job Tracker."); return; }
    const onMessage = (event) => {
      if (event.source === popup && event.origin === "${origin}" && event.data === "${READY}") {
        popup.postMessage(data, "${origin}");
        removeEventListener("message", onMessage);
      }
    };
    addEventListener("message", onMessage);
  })()`;
  // Collapse whitespace so it fits on one line in a bookmark. (So no // comments inside the source above:
  // on one line, a // comment would swallow all the code after it.) The listener removes itself to answer once.
  return `javascript:${encodeURIComponent(source.replace(/\s+/g, " "))}`;
}

/**
 * Validate a message claiming to be a capture. Any site can postMessage this window, so treat the data as
 * untrusted: right shape, strings only, length-limited, and only http(s) URLs. (React escapes it when
 * rendering, and the user reviews it before saving.)
 */
export function parseCapture(data: unknown): Capture | null {
  if (typeof data !== "object" || data === null) return null;
  const { type, url, title, text } = data as Record<string, unknown>;
  if (type !== CAPTURE || typeof url !== "string" || typeof title !== "string" || typeof text !== "string") return null;
  let safeUrl = "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") safeUrl = parsed.href;
  } catch {
    // not a URL: leave it blank
  }
  return { url: safeUrl.slice(0, 2000), title: title.slice(0, 300), text: text.slice(0, MAX_TEXT).trim() };
}

/**
 * Guess the role from a page title such as "Data Science Co-op - Northwind Bio | LinkedIn": the part before
 * the first separator. Titles vary too much to guess the company reliably, so that field is left for you.
 */
export function roleFromTitle(title: string): string {
  const first = title.split(/\s+[|–—-]\s+|\s+at\s+/)[0]?.trim() ?? "";
  return first.slice(0, 200);
}
