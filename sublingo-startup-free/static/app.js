const form = document.getElementById("uploadForm");
const subtitleInput = document.getElementById("subtitle");
const videoInput = document.getElementById("videoFile");
const dropZone = document.getElementById("dropZone");
const fileName = document.getElementById("fileName");
const output = document.getElementById("output");
const statusBox = document.getElementById("status");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const downloadBtn = document.getElementById("downloadBtn");
const blocksContainer = document.getElementById("blocksContainer");
const searchInput = document.getElementById("searchInput");
const videoPreview = document.getElementById("videoPreview");
const videoPlaceholder = document.getElementById("videoPlaceholder");

let latestTranslatedText = "";

function setProgress(value, label) {
  progressFill.style.width = value + "%";
  progressText.textContent = label || value + "%";
}

function setStatus(message) {
  statusBox.textContent = message;
}

function showSelectedFile(file) {
  if (!file) return;
  fileName.textContent = file.name;
  fileName.classList.remove("hidden");
}

dropZone.addEventListener("click", () => subtitleInput.click());

["dragenter", "dragover"].forEach(evt => {
  dropZone.addEventListener(evt, e => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach(evt => {
  dropZone.addEventListener(evt, e => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
  });
});

dropZone.addEventListener("drop", e => {
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const dt = new DataTransfer();
  dt.items.add(file);
  subtitleInput.files = dt.files;
  showSelectedFile(file);
  setStatus("Ready: " + file.name);
});

subtitleInput.addEventListener("change", () => {
  const file = subtitleInput.files[0];
  showSelectedFile(file);
  if (file) setStatus("Ready: " + file.name);
});

videoInput.addEventListener("change", () => {
  const file = videoInput.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  videoPreview.src = url;
  videoPreview.classList.remove("hidden");
  videoPlaceholder.classList.add("hidden");
});

function parseSubtitleBlocks(text) {
  return text.trim().split(/\n\s*\n/).map(block => {
    const lines = block.split("\n");
    return {
      id: lines[0] || "",
      time: lines[1] || "",
      text: lines.slice(2).join(" ")
    };
  }).filter(item => item.time && item.text);
}

function renderBlocks(filter = "") {
  const q = filter.toLowerCase();
  const blocks = parseSubtitleBlocks(latestTranslatedText || "");
  blocksContainer.innerHTML = "";

  const filtered = blocks.filter(item =>
    !q ||
    item.text.toLowerCase().includes(q) ||
    item.time.toLowerCase().includes(q) ||
    item.id.toLowerCase().includes(q)
  );

  if (!filtered.length) {
    blocksContainer.innerHTML = '<div class="block-card"><div class="block-text">No subtitle blocks to show yet.</div></div>';
    return;
  }

  filtered.forEach(item => {
    const el = document.createElement("div");
    el.className = "block-card";
    el.innerHTML = `
      <div class="block-head">
        <span class="block-id">#${item.id}</span>
        <span class="block-time">${item.time}</span>
      </div>
      <div class="block-text">${item.text}</div>
    `;
    blocksContainer.appendChild(el);
  });
}

searchInput.addEventListener("input", e => {
  renderBlocks(e.target.value);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!subtitleInput.files[0]) {
    setStatus("Please choose a subtitle file first.");
    return;
  }

  setStatus("Uploading subtitle file...");
  setProgress(10, "Starting");

  const formData = new FormData(form);

  try {
    const progressSteps = [
      [28, "Reading file"],
      [52, "Translating text"],
      [78, "Preparing preview"]
    ];

    progressSteps.forEach(([value, label], index) => {
      setTimeout(() => setProgress(value, label), 350 * (index + 1));
    });

    const response = await fetch("/translate", {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Translation failed");
    }

    latestTranslatedText = data.translated_text || "";
    output.value = latestTranslatedText;
    renderBlocks(searchInput.value);
    setStatus(data.message || "Translation successful");
    setProgress(100, "Done");

    if (data.download_url) {
      downloadBtn.href = data.download_url;
      downloadBtn.classList.remove("hidden");
    }
  } catch (error) {
    setStatus(error.message || "Something went wrong");
    setProgress(0, "Failed");
  }
});

renderBlocks();
