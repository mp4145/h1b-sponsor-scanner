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
  "c2c not allowed"
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

function toLines(arr) { return (arr || []).join("\n"); }
function toArray(text) {
  return (text || "")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);
}

function load() {
  chrome.storage.sync.get(["negativePhrases", "positivePhrases"], (res) => {
    document.getElementById("negative").value =
      toLines(res.negativePhrases?.length ? res.negativePhrases : DEFAULT_NEGATIVE);
    document.getElementById("positive").value =
      toLines(res.positivePhrases?.length ? res.positivePhrases : DEFAULT_POSITIVE);
  });
}

function save() {
  const negativePhrases = toArray(document.getElementById("negative").value);
  const positivePhrases = toArray(document.getElementById("positive").value);

  chrome.storage.sync.set({ negativePhrases, positivePhrases }, () => {
    const saved = document.getElementById("saved");
    saved.style.display = "inline";
    setTimeout(() => (saved.style.display = "none"), 1200);

    // Ask current tab to rescan
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TRIGGER_SCAN_NOW" });
      }
    });
  });
}

document.getElementById("save").addEventListener("click", save);
document.addEventListener("DOMContentLoaded", load);
