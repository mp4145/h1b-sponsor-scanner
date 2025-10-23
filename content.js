// ---- Default phrases (you can edit in Options) ----
const DEFAULT_NEGATIVE = [
  "no visa sponsorship",
  "visa sponsorship not available",
  "cannot sponsor",
  "not able to sponsor",
  "not available for sponsorship",
  "unable to sponsor",
  "sponsorship not provided",
  "sponsorship is not available",
  "no sponsorship available",
  "must be authorized to work without sponsorship",
  "without current or future sponsorship",
  "not offering visa sponsorship",
  "does not offer visa sponsorship",
  "doesn't offer visa sponsorship",
  "no h-1b",
  "no h1b",
  "no h 1 b",
  "c2c not allowed" // often correlates with no sponsorship
];

const DEFAULT_POSITIVE = [
  "visa sponsorship available",
  "we sponsor visas",
  "will sponsor",
  "can sponsor",
  "h-1b sponsorship available",
  "h1b sponsorship available",
  "employer will sponsor",
  "eligible for visa sponsorship",
  "sponsorship provided",
  "we can provide sponsorship"
];

// Domain-specific selectors to focus scanning where JDs often live (faster & cleaner)
const KNOWN_SELECTORS = [
  // LinkedIn
  'div.show-more-less-html__markup',
  'div.description__text',
  // Indeed
  '#jobDescriptionText',
  // Greenhouse
  '.content, .job, .opening, .application, .main',
  // Lever
  '.posting, .section.page',
  // Workday & others
  '[data-automation-id="jobPostingDescription"], article, main, section'
];

let phrases = { negative: [], positive: [] };
let lastVerdict = "unknown";
let debounceTimer = null;

function debounce(fn, delay = 300) {
  return (...args) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn(...args), delay);
  };
}

function normalize(s) {
  return (s || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getVisibleText(root) {
  // Gather visible text from a container
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // Skip hidden text
      if (!node.parentElement) return NodeFilter.FILTER_REJECT;
      const style = getComputedStyle(node.parentElement);
      if (style && (style.visibility === "hidden" || style.display === "none")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let text = "";
  let n;
  while ((n = walker.nextNode())) {
    text += " " + n.nodeValue;
  }
  return normalize(text);
}

function scanContainers() {
  const targets = new Set();

  for (const sel of KNOWN_SELECTORS) {
    document.querySelectorAll(sel).forEach((el) => targets.add(el));
  }

  // Fallback: if nothing matched, scan the whole page body (can be heavier)
  if (targets.size === 0 && document.body) targets.add(document.body);

  let verdict = "unknown";
  let hitPhrase = null;
  let hitElement = null;

  // Try negative first (one negative hit should trump positives)
  for (const el of targets) {
    const txt = getVisibleText(el);

    for (const p of phrases.negative) {
      if (txt.includes(p)) {
        verdict = "no";
        hitPhrase = p;
        hitElement = el;
        break;
      }
    }
    if (verdict === "no") break;
  }

  // If no negative, look for positive
  if (verdict === "unknown") {
    for (const el of targets) {
      const txt = getVisibleText(el);
      for (const p of phrases.positive) {
        if (txt.includes(p)) {
          verdict = "yes";
          hitPhrase = p;
          hitElement = el;
          break;
        }
      }
      if (verdict === "yes") break;
    }
  }

  paintUI(verdict, hitPhrase, hitElement);
}

function paintUI(verdict, phrase, el) {
  // Always create or update the banner (even if verdict didn't change)
  let banner = document.getElementById("h1b-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "h1b-banner";
    document.documentElement.appendChild(banner);
  }

  // Reset content and set state
  banner.setAttribute("data-state", verdict);
  banner.textContent = verdict === "no" ? "WON’T SPONSOR"
                   : verdict === "yes" ? "SPONSORSHIP LIKELY"
                   : "UNKNOWN";
  if (phrase) {
    const sub = document.createElement("small");
    sub.textContent = `Matched phrase: “${phrase}”`;
    banner.appendChild(sub);
  }

  // Remove any previous outlines and add a new one if we matched an element
  document.querySelectorAll(".h1b-outline").forEach(n => n.classList.remove("h1b-outline"));
  if (el && el !== document.body) {
    el.classList.add("h1b-outline");
    const heading = el.querySelector("h1, h2, h3, [data-automation-id='jobPostingHeader']");
    if (heading) {
      const chip = document.createElement("span");
      chip.className = "h1b-chip";
      chip.textContent = verdict === "no" ? "WON’T SPONSOR"
                       : verdict === "yes" ? "SPONSORSHIP LIKELY"
                       : "UNKNOWN";
      heading.appendChild(chip);
    }
  }

  // Always set the badge; update lastVerdict afterward
  setBadge(verdict);
  lastVerdict = verdict;
}

function setBadge(verdict) {
  if (!chrome.runtime?.id) return; // not available in some iframes
  const text = verdict === "no" ? "NO" : verdict === "yes" ? "YES" : "?";
  const color = verdict === "no" ? "#c0352b" : verdict === "yes" ? "#1f7a3f" : "#596677";
  try {
    chrome.runtime.sendMessage({ type: "SET_BADGE", text, color });
  } catch (_) {
    // Ignore if message port not available (MV3 content scripts can still message action)
  }
}

// Listen for badge requests from content (set via background is ideal, but MV3 action is accessible)
chrome.runtime.onMessage?.addListener((msg, _sender, _sendResponse) => {
  if (msg?.type === "TRIGGER_SCAN_NOW") {
    debouncedScan();
  }
});

// Mutation observer for dynamic pages
const debouncedScan = debounce(scanContainers, 300);
const mo = new MutationObserver(() => debouncedScan());
mo.observe(document.documentElement || document.body, {
  childList: true,
  subtree: true,
  characterData: true
});

// Initial load: get phrases from storage (or defaults), then scan
chrome.storage.sync.get(["negativePhrases", "positivePhrases"], (res) => {
  phrases.negative = (res.negativePhrases || DEFAULT_NEGATIVE).map(normalize);
  phrases.positive = (res.positivePhrases || DEFAULT_POSITIVE).map(normalize);
  debouncedScan();
});

// Also rescan on visibility change (tab switch)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") debouncedScan();
});
