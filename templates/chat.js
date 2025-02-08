// Get DOM elements
const toggleButton = document.getElementById("toggleSidebar");
const sidebar = document.querySelector(".sidebar");
const mainContent = document.querySelector(".main-content");

// Create overlay element
const overlay = document.createElement("div");
overlay.className = "sidebar-overlay";
document.body.appendChild(overlay);

// Toggle sidebar function
function toggleSidebar() {
  sidebar.classList.toggle("hidden");
  mainContent.classList.toggle("sidebar-open");
  overlay.classList.toggle("active");
}

// Event listeners
toggleButton.addEventListener("click", toggleSidebar);
overlay.addEventListener("click", toggleSidebar);

// Optional: Close sidebar on window resize if screen becomes larger than mobile breakpoint
window.addEventListener("resize", () => {
  if (window.innerWidth > 768) {
    sidebar.classList.remove("hidden");
    mainContent.classList.remove("sidebar-open");
    overlay.classList.remove("active");
  }
});

// Main chat UI class
class ChatUI {
  constructor() {
    this.initializeElements();
    this.initializeState();
    this.bindEvents();
    this.loadChats();
    this.startNewChat();
  }

  initializeElements() {
    // Main containers
    this.chatContainer = document.getElementById("chatContainer");
    this.sidebarContainer = document.getElementById("sidebar");
    this.mainContent = document.getElementById("mainContent");

    // Input and buttons
    this.messageInput = document.getElementById("messageInput");
    this.sendButton = document.getElementById("sendButton");
    this.newChatButton = document.getElementById("newChatButton");
    this.toggleSidebarButton = document.getElementById("toggleSidebar");

    // Chat header elements
    this.chatHeader = document.getElementById("chatHeader");
    this.chatTitle = document.getElementById("chatTitle");
    this.renameButton = document.getElementById("renameChat");
    this.deleteButton = document.getElementById("deleteChat");

    if (!this.chatContainer || !this.messageInput || !this.sendButton) {
      throw new Error("Required DOM elements not found");
    }
  }

  initializeState() {
    this.chats = {};
    this.currentChatId = null;
    this.messageQueue = [];
    this.isProcessing = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // 1 second between messages

    // Message templates
    this.messageTemplates = {
      typing: `
                    <div class="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                `,
      welcome: "👋 Hello! How can I help you today?",
      error: "⚠️ An error occurred. Please try again.",
      networkError:
        "🔌 Connection lost. Please check your internet connection.",
      rateLimited: "⏳ Please wait a moment before sending more messages.",
    };
  }

  bindEvents() {
    // Message sending events
    this.sendButton.addEventListener("click", () => this.handleSendMessage());
    this.messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    // Input validation
    this.messageInput.addEventListener("input", () => {
      this.sendButton.disabled = !this.messageInput.value.trim();
    });

    // Chat management events
    this.newChatButton.addEventListener("click", () => this.startNewChat());
    this.renameButton.addEventListener("click", () => this.renameChatPrompt());
    this.deleteButton.addEventListener("click", () => this.deleteCurrentChat());
    this.toggleSidebarButton.addEventListener("click", () =>
      this.toggleSidebar()
    ); // Call the class method

    // Window resize handler
    window.addEventListener("resize", () => this.handleResize());
  }

  // Chat Management Methods
  startNewChat() {
    const chatId = Date.now().toString();
    const defaultName = `Chat ${Object.keys(this.chats).length + 1}`;

    this.chats[chatId] = {
      name: defaultName,
      messages: [
        {
          type: "ai",
          content: this.messageTemplates.welcome,
        },
      ],
    };

    this.currentChatId = chatId;
    this.saveChats();
    this.updateSidebar();
    this.displayCurrentChat();
  }

  loadChats() {
    const savedChats = localStorage.getItem("chats");
    if (savedChats) {
      this.chats = JSON.parse(savedChats);
      this.updateSidebar();
    }
  }

  saveChats() {
    localStorage.setItem("chats", JSON.stringify(this.chats));
    this.updateSidebar();
  }

  switchChat(chatId) {
    if (this.chats[chatId]) {
      this.currentChatId = chatId;
      this.displayCurrentChat();
      if (window.innerWidth < 768) {
        this.toggleSidebar();
      }
    }
  }
  toggleSidebar() {
    sidebar.classList.toggle("hidden");
    mainContent.classList.toggle("sidebar-open");
    overlay.classList.toggle("active");
  }
  deleteCurrentChat() {
    if (!this.currentChatId) return;

    const confirmDelete = confirm("Are you sure you want to delete this chat?");
    if (confirmDelete) {
      delete this.chats[this.currentChatId];
      this.saveChats();

      // Switch to another chat or create new one
      const remainingChats = Object.keys(this.chats);
      if (remainingChats.length > 0) {
        this.switchChat(remainingChats[0]);
      } else {
        this.startNewChat();
      }
    }
  }
  handleResize() {
    if (window.innerWidth >= 768) {
      this.sidebarContainer.classList.remove("hidden");
      this.mainContent.classList.remove("full-width");
      this.toggleSidebar(); //Close the sidebar on larger screens
    }
  }

  renameChatPrompt() {
    if (!this.currentChatId) return;

    const newName = prompt(
      "Enter new name for this chat:",
      this.chats[this.currentChatId].name
    );
    if (newName && newName.trim()) {
      this.chats[this.currentChatId].name = newName.trim();
      this.saveChats();
      this.updateChatHeader();
    }
  }

  // UI Update Methods
  updateSidebar() {
    const sidebarList = document.getElementById("chatsList");
    sidebarList.innerHTML = "";

    Object.entries(this.chats).forEach(([chatId, chat]) => {
      const chatElement = document.createElement("div");
      chatElement.className = `chat-item ${
        chatId === this.currentChatId ? "active" : ""
      }`;
      chatElement.onclick = () => this.switchChat(chatId);

      chatElement.innerHTML = `
                    <span class="chat-name">${chat.name}-   </span>
                    <span class="chat-message-count">${chat.messages.length} messages</span>
                `;

      sidebarList.appendChild(chatElement);
    });
  }

  displayCurrentChat() {
    if (!this.currentChatId || !this.chats[this.currentChatId]) return;

    this.updateChatHeader();
    this.chatContainer.innerHTML = "";

    this.chats[this.currentChatId].messages.forEach((message) => {
      this.addMessage(message);
    });

    this.scrollToBottom();
  }

  updateChatHeader() {
    const chat = this.chats[this.currentChatId];
    if (chat) {
      this.chatTitle.textContent = chat.name;
    }
  }

  // Message Handling Methods
  async handleSendMessage() {
    const message = this.messageInput.value.trim();
    if (!message) return;

    // Rate limiting check
    const now = Date.now();
    if (now - this.lastRequestTime < this.minRequestInterval) {
      this.showError(this.messageTemplates.rateLimited);
      return;
    }

    // Reset state
    this.lastRequestTime = now;
    this.messageInput.value = "";
    this.sendButton.disabled = true;

    // Add message to queue
    this.messageQueue.push(message);
    if (!this.isProcessing) {
      await this.processMessageQueue();
    }
  }

  async processMessageQueue() {
    if (this.messageQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const message = this.messageQueue.shift();

    try {
      // Add user message
      this.addMessage({
        type: "user",
        content: message,
      });

      // Show typing indicator
      this.showTypingIndicator();

      // Get AI response
      const response = await this.sendToServer(message);
      this.hideTypingIndicator();

      // Add AI response
      this.addMessage({
        type: "ai",
        content: response.response,
      });

      // Save chat
      if (this.currentChatId) {
        this.chats[this.currentChatId].messages.push(
          { type: "user", content: message },
          { type: "ai", content: response.response }
        );
        this.saveChats();
      }
    } catch (error) {
      console.error("Error:", error);
      this.hideTypingIndicator();
      this.showError(error.message || this.messageTemplates.error);
    }

    this.sendButton.disabled = false;
    setTimeout(() => this.processMessageQueue(), 100);
  }

  async sendToServer(message) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch("http://localhost:5000/send_message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(this.messageTemplates.error);
      }

      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Request timed out. Please try again.");
      }
      throw error;
    }
  }

  // UI Helper Methods
  addMessage({ type, content }) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}-message`;

    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";

    if (type === "ai") {
      contentDiv.innerHTML = this.formatMessage(content);
    } else {
      contentDiv.textContent = content;
    }

    messageDiv.appendChild(contentDiv);
    this.chatContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  formatMessage(content) {
    // Handle code blocks
    content = content.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_, language, code) => {
        return `<pre><code class="language-${language}">${this.escapeHtml(
          code.trim()
        )}</code></pre>`;
      }
    );

    // Handle inline code
    content = content.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Handle bold and italic
    content = content
      .replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^\*]+)\*/g, "<em>$1</em>");

    // Handle newlines
    content = content.replace(/\n/g, "<br>");

    return content;
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  showTypingIndicator() {
    const typingDiv = document.createElement("div");
    typingDiv.className = "message ai-message typing-message";
    typingDiv.innerHTML = this.messageTemplates.typing;
    this.chatContainer.appendChild(typingDiv);
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    const typingIndicator = document.querySelector(".typing-message");
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;
    this.chatContainer.appendChild(errorDiv);
    this.scrollToBottom();

    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }

  scrollToBottom() {
    this.chatContainer.scrollTo({
      top: this.chatContainer.scrollHeight,
      behavior: "smooth",
    });
  }

  handleResize() {
    if (window.innerWidth >= 768) {
      this.sidebarContainer.classList.remove("hidden");
      this.mainContent.classList.remove("full-width");
    }
  }
}

// Initialize chat with error handling
document.addEventListener("DOMContentLoaded", () => {
  try {
    window.chatUI = new ChatUI();
  } catch (error) {
    console.error("Failed to initialize chat:", error);
    document.body.innerHTML =
      '<div class="error-message">Failed to load chat interface</div>';
  }
});