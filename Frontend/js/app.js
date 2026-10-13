
/* =========================================================
   PaperMind — Research Intelligence Agent
   Full corrected frontend JavaScript
   ========================================================= */

(() => {
  "use strict";

  const API_BASE = "http://127.0.0.1:8000";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const state = {
    papers: [],
    questions: 0,
    insights: 0
  };

  let userId = getOrCreateUserId();
  let toastTimer;

  /* =========================================================
     1. USER SESSION
     ========================================================= */

  function getOrCreateUserId() {
    try {
      let id = sessionStorage.getItem("papermind_user_id");

      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem("papermind_user_id", id);
      }

      return id;
    } catch {
      return crypto.randomUUID();
    }
  }

  /* =========================================================
     2. MARKDOWN RENDERING — MAIN FIX
     ========================================================= */

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function renderMarkdown(markdown) {
    const source = String(markdown ?? "");

    // Safe fallback if the external libraries have not loaded.
    if (!window.marked || !window.DOMPurify) {
      return escapeHtml(source).replace(/\n/g, "<br>");
    }

    // Convert Markdown into HTML.
    const html = window.marked.parse(source, {
      gfm: true,
      breaks: false
    });

    // Sanitize the generated HTML before inserting it into the page.
    return window.DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true }
    });
  }

  /* =========================================================
     3. SAVE AND RESTORE SESSION DATA
     ========================================================= */

  function loadSavedState() {
    try {
      const papers = sessionStorage.getItem("papermind_papers");
      const questions = sessionStorage.getItem("papermind_questions");
      const insights = sessionStorage.getItem("papermind_insights");

      if (papers) {
        const parsed = JSON.parse(papers);

        if (Array.isArray(parsed)) {
          state.papers = parsed;
        }
      }

      state.questions = Number(questions || 0);
      state.insights = Number(insights || 0);
    } catch (error) {
      console.warn("Could not restore saved state:", error);
    }
  }

  function save() {
    try {
      sessionStorage.setItem(
        "papermind_papers",
        JSON.stringify(state.papers)
      );

      sessionStorage.setItem(
        "papermind_questions",
        String(state.questions)
      );

      sessionStorage.setItem(
        "papermind_insights",
        String(state.insights)
      );
    } catch (error) {
      console.warn("Could not save session data:", error);
    }
  }

  function clearHistory() {
    state.papers = [];
    state.questions = 0;
    state.insights = 0;

    try {
      sessionStorage.removeItem("papermind_papers");
      sessionStorage.removeItem("papermind_questions");
      sessionStorage.removeItem("papermind_insights");
    } catch (error) {
      console.warn("Could not clear session data:", error);
    }
  }

  /* =========================================================
     4. UTILITIES
     ========================================================= */

  function formatBytes(bytes = 0) {
    const size = Number(bytes) || 0;

    if (size <= 0) return "0 MB";

    const mb = size / (1024 * 1024);

    return mb < 1
      ? `${Math.max(1, Math.round(size / 1024))} KB`
      : `${mb.toFixed(1)} MB`;
  }

  function showToast(title, message) {
    const toast = $("#toast");

    if (!toast) return;

    const titleElement = toast.querySelector("strong");
    const messageElement = toast.querySelector("small");

    if (titleElement) titleElement.textContent = title;
    if (messageElement) messageElement.textContent = message;

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  /* =========================================================
     5. DASHBOARD AND PAPER LIBRARY
     ========================================================= */

  function render() {
    const paperStat = $("#paperStat");
    const navPaperCount = $("#navPaperCount");
    const questionStat = $("#questionStat");
    const insightStat = $("#insightStat");
    const pageStat = $("#pageStat");
    const storageText = $("#storageText");
    const storageProgress = $("#storageProgress");

    if (paperStat) {
      paperStat.textContent = state.papers.length;
    }

    if (navPaperCount) {
      navPaperCount.textContent = state.papers.length;
    }

    if (questionStat) {
      questionStat.textContent = state.questions;
    }

    if (insightStat) {
      insightStat.textContent = state.insights;
    }

    const pages = state.papers.reduce(
      (sum, paper) => sum + (Number(paper.pages) || 0),
      0
    );

    const bytes = state.papers.reduce(
      (sum, paper) => sum + (Number(paper.size) || 0),
      0
    );

    if (pageStat) {
      pageStat.textContent = pages;
    }

    if (storageText) {
      storageText.textContent = formatBytes(bytes);
    }

    if (storageProgress) {
      const percentage = Math.min(
        100,
        (bytes / (100 * 1024 * 1024)) * 100
      );

      storageProgress.style.width = `${percentage}%`;
    }

    renderRecentPapers();
    renderPaperGrid();
  }

  function renderRecentPapers() {
    const recent = $("#recentPapers");

    if (!recent) return;

    if (!state.papers.length) {
      recent.innerHTML =
        '<div class="empty-mini">No papers uploaded yet.</div>';

      return;
    }

    recent.innerHTML = state.papers
      .slice(-5)
      .reverse()
      .map((paper) => `
        <div class="recent-item">
          <span>▱</span>
          <span class="name">${escapeHtml(paper.name)}</span>
        </div>
      `)
      .join("");
  }

  function renderPaperGrid() {
    const grid = $("#paperGrid");

    if (!grid) return;

    if (!state.papers.length) {
      grid.innerHTML = `
        <div class="paper-placeholder">
          <div class="placeholder-icon">▱</div>
          <strong>Your papers will appear here</strong>
          <span>Upload a PDF to build your research library.</span>
        </div>
      `;

      return;
    }

    grid.innerHTML = state.papers.map((paper, index) => `
      <div class="paper-card">
        <button
          class="remove"
          type="button"
          data-remove="${index}"
          title="Remove paper"
          aria-label="Remove ${escapeHtml(paper.name)}"
        >×</button>

        <div class="pdf-badge">PDF</div>

        <strong title="${escapeHtml(paper.name)}">
          ${escapeHtml(paper.name)}
        </strong>

        <small>
          ${Number(paper.pages) || "—"} pages ·
          ${formatBytes(paper.size)}
        </small>
      </div>
    `).join("");

    grid.querySelectorAll("[data-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.remove);

        if (!Number.isInteger(index) || !state.papers[index]) {
          return;
        }

        state.papers.splice(index, 1);

        save();
        render();

        showToast(
          "Paper removed",
          "Your research library was updated."
        );
      });
    });
  }

  /* =========================================================
     6. CHAT MESSAGE RENDERING
     ========================================================= */

  function addUserMessage(text) {
    const body = $("#chatBody");

    if (!body) return;

    body.querySelector(".source-empty")?.remove();

    const message = document.createElement("div");
    message.className = "chat-message user";

    const avatar = document.createElement("div");
    avatar.className = "mini-avatar";
    avatar.textContent = "RA";

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    // User messages are always plain text.
    bubble.textContent = text;

    message.append(avatar, bubble);
    body.appendChild(message);

    body.scrollTop = body.scrollHeight;
  }

  function showThinkingIndicator() {
    const body = $("#chatBody");

    if (!body) return;

    hideThinkingIndicator();

    const wrapper = document.createElement("div");
    wrapper.className = "ai-thinking";
    wrapper.id = "aiThinking";

    wrapper.innerHTML = `
      <div class="mini-avatar">✦</div>

      <div class="thinking-bubble">
        <span class="thinking-text">
          Research Assistant is thinking
        </span>

        <div class="thinking-dots" aria-label="Loading">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;

    body.appendChild(wrapper);
    body.scrollTop = body.scrollHeight;
  }

  function hideThinkingIndicator() {
    $("#aiThinking")?.remove();
  }

  function addAgentMessage(markdownText) {
    const body = $("#chatBody");

    if (!body) return;

    const message = document.createElement("div");
    message.className = "chat-message";

    const avatar = document.createElement("div");
    avatar.className = "mini-avatar";
    avatar.textContent = "✦";

    const bubble = document.createElement("div");
    bubble.className = "bubble markdown-body";

    // IMPORTANT:
    // Convert Markdown to HTML, then sanitize before rendering.
    bubble.innerHTML = renderMarkdown(markdownText);

    message.append(avatar, bubble);
    body.appendChild(message);

    body.scrollTop = body.scrollHeight;
  }

  function setChatBusy(busy) {
    const submitButton = $("#chatForm button[type='submit']");
    const input = $("#chatInput");

    if (submitButton) submitButton.disabled = busy;
    if (input) input.disabled = busy;
  }

  /* =========================================================
     7. SEND QUESTIONS TO FASTAPI
     ========================================================= */

  async function sendPrompt(text) {
    const prompt = String(text ?? "").trim();

    if (!prompt) return;

    const input = $("#chatInput");

    if (input) {
      input.value = "";
      input.style.height = "auto";
    }

    addUserMessage(prompt);

    state.questions += 1;

    save();
    render();

    showThinkingIndicator();
    setChatBusy(true);

    try {
      const response = await fetch(`${API_BASE}/ask`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },

        body: JSON.stringify({
          input: prompt,
          user_id: userId
        })
      });

      if (!response.ok) {
        let detail = "";

        try {
          const errorData = await response.json();

          detail =
            errorData.detail ||
            errorData.error ||
            errorData.message ||
            "";
        } catch {
          // The error response may not be JSON.
        }

        throw new Error(
          detail || `Request failed: ${response.status}`
        );
      }

      const result = await response.json();

      console.log("FastAPI response:", result);

      hideThinkingIndicator();

      // Support the response field used by your existing backend,
      // plus common alternatives.
      const answer =
        typeof result.response === "string"
          ? result.response
          : typeof result.answer === "string"
            ? result.answer
            : typeof result.output === "string"
              ? result.output
              : null;

      if (answer === null) {
        throw new Error(
          "The server response did not contain a valid response, answer, or output field."
        );
      }

      // Markdown now renders as formatted HTML.
      addAgentMessage(answer);

      if (
        /summar|methodolog|research gap|limitation|extract results|explain paper/i
          .test(prompt)
      ) {
        state.insights += 1;

        save();
        render();
      }
    } catch (error) {
      console.error("Question error:", error);

      hideThinkingIndicator();

      addAgentMessage(
        `**Sorry, I couldn't connect to the research assistant.**\n\n` +
        `${error.message}\n\n` +
        `Check that your FastAPI server is running at ` +
        `\`${API_BASE}\` and that the \`/ask\` endpoint is available.`
      );
    } finally {
      hideThinkingIndicator();
      setChatBusy(false);
      input?.focus();
    }
  }

  /* =========================================================
     8. CHAT FORM AND SUGGESTED PROMPTS
     ========================================================= */

  $("#chatForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const input = $("#chatInput");

    if (!input) return;

    sendPrompt(input.value);
  });

  $("#chatInput")?.addEventListener("input", (event) => {
    const input = event.target;

    input.style.height = "auto";

    input.style.height =
      `${Math.min(input.scrollHeight, 120)}px`;
  });

  $("#chatInput")?.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      event.preventDefault();
      $("#chatForm")?.requestSubmit();
    }
  });

  $$("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      const prompt = button.dataset.prompt || "";
      const input = $("#chatInput");

      if (button.classList.contains("action-card")) {
        sendPrompt(prompt);
      } else if (input) {
        input.value = prompt;
        input.focus();
      }
    });
  });

  /* =========================================================
     9. PDF UPLOAD
     ========================================================= */

  async function processFiles(fileList) {
    const files = Array.from(fileList || []);

    const pdfs = files.filter((file) =>
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    );

    if (!pdfs.length) {
      showToast(
        "PDF files only",
        "Please select a PDF research paper."
      );

      return;
    }

    const newPapers = pdfs.filter((file) =>
      !state.papers.some(
        (paper) =>
          paper.name === file.name &&
          paper.size === file.size
      )
    );

    if (!newPapers.length) {
      showToast(
        "Already uploaded",
        "These papers are already in your library."
      );

      if ($("#fileInput")) {
        $("#fileInput").value = "";
      }

      return;
    }

    const formData = new FormData();

    newPapers.forEach((file) => {
      formData.append("files", file);
    });

    formData.append("user_id", userId);

    const browseButton = $("#browseBtn");

    if (browseButton) {
      browseButton.disabled = true;
    }

    showToast(
      "Uploading...",
      `Sending ${newPapers.length} paper(s) to FastAPI.`
    );

    try {
      const response = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        let detail = "";

        try {
          const errorData = await response.json();

          detail =
            errorData.detail ||
            errorData.error ||
            errorData.message ||
            "";
        } catch {
          // Ignore non-JSON error responses.
        }

        throw new Error(
          detail || `Upload failed: ${response.status}`
        );
      }

      let result = {};

      try {
        result = await response.json();
      } catch {
        // A successful endpoint may return an empty response.
      }

      const serverPapers = Array.isArray(result.papers)
        ? result.papers
        : Array.isArray(result.files)
          ? result.files
          : [];

      // Add files locally only after the server confirms success.
      newPapers.forEach((file, index) => {
        const serverPaper = serverPapers[index] || {};

        state.papers.push({
          id:
            serverPaper.id ||
            serverPaper.paper_id ||
            null,

          name:
            serverPaper.filename ||
            serverPaper.name ||
            file.name,

          size: file.size,

          pages: Number(
            serverPaper.pages ||
            serverPaper.page_count ||
            0
          ),

          uploadedAt: Date.now()
        });
      });

      state.insights += newPapers.length;

      save();
      render();

      showToast(
        "Upload successful",
        `${newPapers.length} paper(s) added to your library.`
      );
    } catch (error) {
      console.error("Upload error:", error);

      showToast("Upload failed", error.message);
    } finally {
      if ($("#fileInput")) {
        $("#fileInput").value = "";
      }

      if (browseButton) {
        browseButton.disabled = false;
      }
    }
  }

  $("#browseBtn")?.addEventListener("click", (event) => {
    event.stopPropagation();
    $("#fileInput")?.click();
  });

  $("#uploadSmall")?.addEventListener("click", () => {
    $("#fileInput")?.click();
  });

  $("#uploadZone")?.addEventListener("click", (event) => {
    if (!event.target.closest("button")) {
      $("#fileInput")?.click();
    }
  });

  $("#fileInput")?.addEventListener("change", (event) => {
    processFiles(event.target.files);
  });

  const uploadZone = $("#uploadZone");

  ["dragenter", "dragover"].forEach((type) => {
    uploadZone?.addEventListener(type, (event) => {
      event.preventDefault();

      uploadZone.classList.add("dragging");
      uploadZone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((type) => {
    uploadZone?.addEventListener(type, (event) => {
      event.preventDefault();

      uploadZone.classList.remove("dragging", "drag-over");
    });
  });

  uploadZone?.addEventListener("drop", (event) => {
    processFiles(event.dataTransfer?.files);
  });

  /* =========================================================
     10. START A NEW CONVERSATION
     ========================================================= */

  async function startNewConversation() {
    const button = $("#newChatBtn");

    if (button) button.disabled = true;

    try {
      const url = new URL(
        `${API_BASE}/delete_user_data`
      );

      url.searchParams.set("user_id", userId);

      const response = await fetch(url.toString(), {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error(
          `Request failed: ${response.status}`
        );
      }
    } catch (error) {
      console.warn(
        "Could not clear server-side conversation:",
        error
      );

      showToast(
        "Backend notice",
        "Starting a new local conversation; server-side data may remain."
      );
    } finally {
      if (button) button.disabled = false;
    }

    // Start a fresh session regardless of the delete endpoint result.
    userId = crypto.randomUUID();

    try {
      sessionStorage.setItem("papermind_user_id", userId);
    } catch {
      // Continue if session storage is unavailable.
    }

    clearHistory();
    save();
    render();

    const chatBody = $("#chatBody");

    if (chatBody) {
      chatBody.innerHTML = `
        <div class="welcome-message">
          <div class="ai-avatar">✦</div>

          <div>
            <span class="message-tag">PAPER MIND AI</span>

            <h3>New research conversation</h3>

            <p>
              Ask a question about your papers, or choose an
              analysis action to begin.
            </p>
          </div>
        </div>
      `;
    }

    const input = $("#chatInput");

    if (input) {
      input.value = "";
      input.style.height = "auto";
    }

    $("#chat")?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  $("#newChatBtn")?.addEventListener("click", () => {
    closeMobileSidebar();
    startNewConversation();
  });

  /* =========================================================
     11. MOBILE SIDEBAR
     ========================================================= */

  function closeMobileSidebar() {
    $("#sidebar")?.classList.remove("open");
    $("#sidebarBackdrop")?.classList.remove("visible");
  }

  function openMobileSidebar() {
    $("#sidebar")?.classList.add("open");
    $("#sidebarBackdrop")?.classList.add("visible");
  }

  $("#mobileMenu")?.addEventListener("click", (event) => {
    event.stopPropagation();

    const sidebar = $("#sidebar");

    if (sidebar?.classList.contains("open")) {
      closeMobileSidebar();
    } else {
      openMobileSidebar();
    }
  });

  $("#sidebarBackdrop")?.addEventListener(
    "click",
    closeMobileSidebar
  );

  $$(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= 760) {
        closeMobileSidebar();
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (window.innerWidth > 760) return;

    const sidebar = $("#sidebar");
    const menuButton = $("#mobileMenu");
    const backdrop = $("#sidebarBackdrop");
    const mainContent = $(".main-content");

    if (
      sidebar?.classList.contains("open") &&
      !sidebar.contains(event.target) &&
      !menuButton?.contains(event.target) &&
      !backdrop?.contains(event.target) &&
      mainContent?.contains(event.target)
    ) {
      closeMobileSidebar();
    }
  });

  /* =========================================================
     12. KEYBOARD SHORTCUT
     ========================================================= */

  document.addEventListener("keydown", (event) => {
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "k"
    ) {
      event.preventDefault();
      $("#newChatBtn")?.click();
    }
  });

  /* =========================================================
     13. BACKEND CLEANUP
     ========================================================= */

  window.addEventListener("pagehide", () => {
    try {
      const data = new URLSearchParams();

      data.append("user_id", userId);

      navigator.sendBeacon(
        `${API_BASE}/cleanup`,
        data
      );
    } catch (error) {
      console.warn("Cleanup request failed:", error);
    }
  });

  /* =========================================================
     14. INITIALIZE APPLICATION
     ========================================================= */

  loadSavedState();
  render();

})();
