const state = {
  papers: [],
  questions: 0,
  insights: 0
};

let userId = crypto.randomUUID();

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function clearHistory() {
  state.papers = [];
  state.questions = 0;
  state.insights = 0;
  sessionStorage.removeItem("papermind_papers");
  sessionStorage.removeItem("papermind_questions");
  sessionStorage.removeItem("papermind_insights");
}

function save() {
  sessionStorage.setItem("papermind_papers", JSON.stringify(state.papers));
  sessionStorage.setItem("papermind_questions", state.questions);
  sessionStorage.setItem("papermind_insights", state.insights);
}

function formatBytes(bytes) {
  if (!bytes) return "0 MB";
  const mb = bytes / 1024 / 1024;
  return mb < 1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`;
}

function render() {
  $("#paperStat").textContent = state.papers.length;
  $("#navPaperCount").textContent = state.papers.length;
  $("#questionStat").textContent = state.questions;
  $("#insightStat").textContent = state.insights;

  const pages = state.papers.reduce((sum, p) => sum + (p.pages || 0), 0);
  $("#pageStat").textContent = pages;
  const bytes = state.papers.reduce((sum, p) => sum + p.size, 0);
  $("#storageText").textContent = formatBytes(bytes);
  $("#storageProgress").style.width = `${Math.min(100, bytes / (100 * 1024 * 1024) * 100)}%`;

  const recent = $("#recentPapers");
  recent.innerHTML = state.papers.length
    ? state.papers.slice(-5).reverse().map(p => `
      <div class="recent-item"><span>▱</span><span class="name">${escapeHtml(p.name)}</span></div>
    `).join("")
    : `<div class="empty-mini">No papers uploaded yet.</div>`;

  const grid = $("#paperGrid");
  grid.innerHTML = state.papers.length
    ? state.papers.map((p, i) => `
      <div class="paper-card">
        <button class="remove" data-remove="${i}" title="Remove">×</button>
        <div class="pdf-badge">PDF</div>
        <strong title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</strong>
        <small>${p.pages || "—"} pages · ${formatBytes(p.size)}</small>
      </div>
    `).join("")
    : `<div class="paper-placeholder"><div class="placeholder-icon">▱</div><strong>Your papers will appear here</strong><span>Upload a PDF to build your research library.</span></div>`;

  $$("[data-remove]").forEach(btn => btn.addEventListener("click", () => {
    state.papers.splice(Number(btn.dataset.remove), 1);
    save(); render(); showToast("Paper removed", "Your research library was updated.");
  }));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
}

function showToast(title, message) {
  const toast = $("#toast");
  toast.querySelector("strong").textContent = title;
  toast.querySelector("small").textContent = message;
  toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function addUserMessage(text) {
  const body = $("#chatBody");
  const empty = body.querySelector(".source-empty");
  if (empty) empty.remove();
  body.insertAdjacentHTML("beforeend", `
    <div class="chat-message user">
      <div class="mini-avatar">RA</div>
      <div class="bubble">${escapeHtml(text)}</div>
    </div>
  `);
  body.scrollTop = body.scrollHeight;
}
function showThinkingIndicator() {
  const body = $("#chatBody");

  // Remove existing indicator if there is one
  $("#aiThinking")?.remove();

  body.insertAdjacentHTML("beforeend", `
    <div class="ai-thinking" id="aiThinking">
      <div class="mini-avatar">✦</div>

      <div class="thinking-bubble">
        <span class="thinking-text">Research Assistant is thinking</span>

        <div class="thinking-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  `);

  body.scrollTop = body.scrollHeight;
}
function hideThinkingIndicator() {
  const thinking = $("#aiThinking");

  if (thinking) {
    thinking.remove();
  }
}


function addAgentMessage(text) {//-------------------------------------------
  const body = $("#chatBody");
  body.insertAdjacentHTML("beforeend", `
    <div class="chat-message">
      <div class="mini-avatar">✦</div>
      <div class="bubble">${text}</div>
    </div>
  `);
  body.scrollTop = body.scrollHeight;
}



async function sendPrompt(text) {
  if (!text.trim()) return;

  addUserMessage(text.trim());

  state.questions++;
  save();
  render();

  // Show AI thinking indicator
  showThinkingIndicator();

  try {
    const response = await fetch("http://16.192.149.225:8000/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: text.trim(),
        user_id: userId
      })
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const result = await response.json();

    console.log("FastAPI response:", result);
    // Remove thinking indicator
    hideThinkingIndicator();

    addAgentMessage(result.response);

  } catch (error) {
    console.error("Question error:", error);
    // Remove thinking indicator
    hideThinkingIndicator();

    addAgentMessage(
      "Sorry, I couldn't connect to the server."
    );
  }
}


$("#chatForm").addEventListener("submit", e => {
  e.preventDefault();
  const input = $("#chatInput");
  sendPrompt(input.value);
  input.value = "";
  input.style.height = "auto";
});

$("#chatInput").addEventListener("input", e => {
  e.target.style.height = "auto";
  e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
});

$$("[data-prompt]").forEach(btn => {
  btn.addEventListener("click", () => {
    const prompt = btn.dataset.prompt;
    $("#chatInput").value = prompt;
    $("#chatInput").focus();
    if (btn.classList.contains("action-card")) {
      sendPrompt(prompt);
      $("#chatInput").value = "";
    }
  });
});

async function processFiles(files) {
  const pdfs = [...files].filter(
    f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
  );

  if (!pdfs.length) {
    showToast("PDF files only", "Please select a PDF research paper.");
    return;
  }

  const newPapers = pdfs.filter(file =>
    !state.papers.some(p => p.name === file.name && p.size === file.size)
  );

  if (newPapers.length) {
    newPapers.forEach(file => {
      state.papers.push({
        name: file.name,
        size: file.size,
        pages: 0,
        uploadedAt: Date.now()
      });
    });

    state.insights += newPapers.length;
    save();
    render();
  }

  const formData = new FormData();
  pdfs.forEach(file => formData.append("files", file));
  formData.append("user_id", userId);

  try {
    showToast("Uploading...", `Sending ${pdfs.length} paper(s) to FastAPI`);

    const response = await fetch("http://16.192.149.225:8000/upload", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const result = await response.json();
    console.log("FastAPI response:", result);

    showToast("Upload successful", `${pdfs.length} paper(s) added to your library`);
  } catch (error) {
    console.error("Upload error:", error);
    showToast("Upload failed", "The file was added locally, but the backend is not responding.");
  } finally {
    $("#fileInput").value = "";
  }
}

$("#browseBtn").addEventListener("click", () => $("#fileInput").click());
$("#uploadSmall").addEventListener("click", () => $("#fileInput").click());
$("#uploadZone").addEventListener("click", e => {
  if (!e.target.closest("button")) $("#fileInput").click();
});
$("#fileInput").addEventListener("change", e => processFiles(e.target.files));

["dragenter", "dragover"].forEach(type => $("#uploadZone").addEventListener(type, e => {
  e.preventDefault(); $("#uploadZone").classList.add("dragging");
}));
["dragleave", "drop"].forEach(type => $("#uploadZone").addEventListener(type, e => {
  e.preventDefault(); $("#uploadZone").classList.remove("dragging");
}));
$("#uploadZone").addEventListener("drop", e => processFiles(e.dataTransfer.files));

async function startNewConversation() {
  try {
    const response = await fetch(`http://16.192.149.225:8000/delete_user_data?user_id=${userId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    // Generate a new user ID after deleting the old user's data
    userId = crypto.randomUUID();
  } 
  catch (error) {
    console.error("Clear history endpoint error:", error);
    showToast("Backend not reachable", "Started a new local conversation only.");
  }

  clearHistory();
  render();

  $("#chatBody").innerHTML = `
    <div class="welcome-message">
      <div class="ai-avatar">✦</div>
      <div><span class="message-tag">PAPER MIND AI</span><h3>New research conversation</h3><p>Ask a question about your papers, or choose an analysis action to begin.</p></div>
    </div>
  `;
  $("#chatInput").value = "";
  $("#chat").scrollIntoView({ behavior: "smooth", block: "center" });
}



$("#newChatBtn").addEventListener("click", startNewConversation);

$("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault(); $("#newChatBtn").click();
  }
});

window.addEventListener("pagehide", () => {
  const data = new URLSearchParams();
  data.append("user_id", userId);

  navigator.sendBeacon(
    "http://16.192.149.225:8000/cleanup",
    data
  );
});

render();
