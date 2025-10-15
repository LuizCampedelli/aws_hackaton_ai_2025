// ===== CONTROLE DO CHATBOT =====

class ChatbotController {
  constructor() {
    this.elements = {
      messagesContainer: document.getElementById("chatMessages"),
      userInput: document.getElementById("userInput"),
      sendButton: document.getElementById("sendButton"),
      chatLoading: document.getElementById("chatLoading"),
      analysisResults: document.getElementById("analysisResults"),
      charCount: document.getElementById("charCount"),
      chatStatus: document.getElementById("chatStatus"),
    };

    this.state = {
      isProcessing: false,
      currentSession: null,
      messageHistory: [],
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadMessageHistory();
    this.updateCharCount();

    // Focar no input automaticamente
    this.elements.userInput.focus();

    console.log("ChatbotController inicializado");
  }

  bindEvents() {
    // Envio de mensagem
    this.elements.sendButton.addEventListener("click", () => this.sendMessage());

    // Enter para enviar (Shift+Enter para nova linha)
    this.elements.userInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Contador de caracteres
    this.elements.userInput.addEventListener("input", () => this.updateCharCount());

    // Quick actions
    this.bindQuickActions();
  }

  bindQuickActions() {
    // As quick actions já estão vinculadas via onclick no HTML
  }

  async sendMessage() {
    const message = this.elements.userInput.value.trim();

    if (!message) {
      IAmigosUtils.showNotification("Por favor, digite uma mensagem", "warning");
      return;
    }

    if (this.state.isProcessing) {
      IAmigosUtils.showNotification("Aguarde a resposta anterior", "warning");
      return;
    }

    try {
      this.setProcessingState(true);
      this.addMessageToChat(message, "user");
      this.clearInput();

      const response = await window.lexClient.sendMessage(message);
      this.addMessageToChat(response.message, "bot");

      // Verificar se a análise foi completada
      if (this.isAnalysisComplete(response)) {
        this.showAnalysisResults(response);
      }

      this.saveMessageToHistory(message, response);
    } catch (error) {
      this.handleSendError(error);
    } finally {
      this.setProcessingState(false);
    }
  }

  addMessageToChat(content, sender) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}-message`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = sender === "bot" ? "🤖" : "👤";
    avatar.setAttribute("aria-label", sender === "bot" ? "Assistente" : "Você");

    const messageContent = document.createElement("div");
    messageContent.className = "message-content";
    messageContent.innerHTML = IAmigosUtils.formatMessage(content);

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    this.elements.messagesContainer.appendChild(messageDiv);

    // Scroll para a última mensagem
    this.scrollToBottom();

    // Animar entrada da mensagem
    messageDiv.style.animation = "messageSlideIn 0.3s ease-out";
  }

  setProcessingState(processing) {
    this.state.isProcessing = processing;

    const btnText = this.elements.sendButton.querySelector(".btn-text");
    const btnLoading = this.elements.sendButton.querySelector(".btn-loading");

    if (processing) {
      btnText.style.display = "none";
      btnLoading.style.display = "inline";
      this.elements.chatLoading.classList.add("active");
      this.elements.userInput.disabled = true;
      this.elements.sendButton.disabled = true;
      this.updateStatus("connecting", "Analisando...");
    } else {
      btnText.style.display = "inline";
      btnLoading.style.display = "none";
      this.elements.chatLoading.classList.remove("active");
      this.elements.userInput.disabled = false;
      this.elements.sendButton.disabled = false;
      this.updateStatus("online", "Conectado");
      this.elements.userInput.focus();
    }
  }

  updateCharCount() {
    const count = this.elements.userInput.value.length;
    const maxLength = 500;

    this.elements.charCount.textContent = `${count}/${maxLength}`;

    // Atualizar classes baseado na contagem
    this.elements.charCount.className = "char-count";

    if (count > maxLength * 0.8) {
      this.elements.charCount.classList.add("warning");
    }

    if (count > maxLength) {
      this.elements.charCount.classList.add("error");
    }
  }

  clearInput() {
    this.elements.userInput.value = "";
    this.updateCharCount();
  }

  scrollToBottom() {
    this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
  }

  isAnalysisComplete(response) {
    return (
      response.sessionAttributes &&
      (response.sessionAttributes.analysisComplete === "true" ||
        response.sessionAttributes.preApprovalComplete === "true")
    );
  }

  showAnalysisResults(response) {
    const attributes = response.sessionAttributes;

    // Atualizar elementos dos resultados
    this.updateResultElement("resultCondition", attributes.possibleConditions || "Avaliação necessária");

    this.updateResultElement("resultUrgency", attributes.urgencyLevel || "media", "urgency-badge", {
      "data-urgency": (attributes.urgencyLevel || "media").toLowerCase(),
    });

    this.updateResultElement(
      "resultApproval",
      attributes.approvalStatus === "approved" ? "Aprovada" : "Avaliação Necessária",
      "approval-badge",
      { class: `approval-badge ${attributes.approvalStatus || "pending"}` }
    );

    this.updateResultElement(
      "resultClinics",
      attributes.clinicsFound ? `${attributes.clinicsFound} consultórios próximos` : "3 consultórios próximos"
    );

    // Mostrar seção de resultados
    this.elements.analysisResults.classList.add("active");

    // Scroll para resultados
    setTimeout(() => {
      this.elements.analysisResults.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 500);
  }

  updateResultElement(elementId, text, className = "", attributes = {}) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = text;
      if (className) element.className = className;

      // Aplicar atributos adicionais
      Object.keys(attributes).forEach((attr) => {
        element.setAttribute(attr, attributes[attr]);
      });
    }
  }

  hideResults() {
    this.elements.analysisResults.classList.remove("active");
  }

  handleSendError(error) {
    console.error("Erro ao enviar mensagem:", error);

    let userMessage = "Desculpe, ocorreu um erro. Tente novamente.";

    if (error.userMessage) {
      userMessage = error.userMessage;
    }

    this.addMessageToChat(userMessage, "bot");

    if (error.shouldRetry) {
      IAmigosUtils.showNotification("Problema de conexão. Tentando reconectar...", "warning");
    } else {
      IAmigosUtils.showNotification(userMessage, "error");
    }
  }

  updateStatus(status, text) {
    const statusIndicator = this.elements.chatStatus.querySelector(".status-indicator");
    const statusText = this.elements.chatStatus.querySelector(".status-text");

    statusIndicator.className = "status-indicator " + status;
    statusText.textContent = text;
  }

  // Histórico de mensagens
  saveMessageToHistory(userMessage, botResponse) {
    this.state.messageHistory.push({
      timestamp: new Date().toISOString(),
      user: userMessage,
      bot: botResponse.message,
      sessionAttributes: botResponse.sessionAttributes,
    });

    // Manter apenas as últimas 50 mensagens
    if (this.state.messageHistory.length > 50) {
      this.state.messageHistory.shift();
    }

    IAmigosUtils.setStorage("chat_history", this.state.messageHistory);
  }

  loadMessageHistory() {
    this.state.messageHistory = IAmigosUtils.getStorage("chat_history", []);
  }

  clearHistory() {
    this.state.messageHistory = [];
    IAmigosUtils.removeStorage("chat_history");
  }
}

// ===== FUNÇÕES GLOBAIS =====

// Inserir exemplo rápido
function insertExample(text) {
  const input = document.getElementById("userInput");
  input.value = text;
  input.focus();

  // Atualizar contador
  if (window.chatbotController) {
    window.chatbotController.updateCharCount();
  }
}

// Reiniciar chat
function resetChat() {
  if (confirm("Tem certeza que deseja iniciar uma nova conversa? O histórico atual será perdido.")) {
    window.lexClient.resetSession();

    const messagesContainer = document.getElementById("chatMessages");
    const analysisResults = document.getElementById("analysisResults");

    // Manter apenas a mensagem de boas-vindas
    const welcomeMessage = messagesContainer.querySelector(".welcome-message");
    messagesContainer.innerHTML = "";
    messagesContainer.appendChild(welcomeMessage);

    // Ocultar resultados
    analysisResults.classList.remove("active");

    // Limpar histórico
    if (window.chatbotController) {
      window.chatbotController.clearHistory();
    }

    IAmigosUtils.showNotification("Nova conversa iniciada", "success");
  }
}

// Visualizar dentistas
function viewClinics() {
  window.location.href = "clinics.html";
}

// Nova análise
function startNewAnalysis() {
  resetChat();
}

// Ocultar resultados
function hideResults() {
  const analysisResults = document.getElementById("analysisResults");
  analysisResults.classList.remove("active");
}

// ===== INICIALIZAÇÃO =====
document.addEventListener("DOMContentLoaded", function () {
  // Aguardar o Lex ser inicializado
  const initChatbot = () => {
    if (window.lexClient && window.lexClient.isInitialized) {
      window.chatbotController = new ChatbotController();
      console.log("ChatbotController inicializado com sucesso");
    } else {
      setTimeout(initChatbot, 100);
    }
  };

  // Iniciar após um breve delay para garantir que o Lex está pronto
  setTimeout(initChatbot, 500);

  // Adicionar suporte para debug
  if (window.location.search.includes("debug=true")) {
    window.debugChatbot = window.chatbotController;
    console.log("ChatbotController disponível como window.debugChatbot");
  }
});
