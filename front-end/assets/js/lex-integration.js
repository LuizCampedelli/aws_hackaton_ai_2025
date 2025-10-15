// ===== INTEGRAÇÃO COM AMAZON LEX =====

class LexChatbot {
  constructor(config = {}) {
    this.config = {
      botName: config.botName || "IAmigosBot",
      botAlias: config.botAlias || "Prod",
      userId: config.userId || this.generateUserId(),
      region: config.region || "us-east-1",
      ...config,
    };

    this.sessionAttributes = {};
    this.isInitialized = false;
    this.pendingMessages = [];

    this.init();
  }

  init() {
    if (typeof AWS === "undefined") {
      console.error("AWS SDK não carregado");
      this.loadAWSSDK().then(() => this.initializeLex());
    } else {
      this.initializeLex();
    }
  }

  loadAWSSDK() {
    return new Promise((resolve, reject) => {
      if (typeof AWS !== "undefined") {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://sdk.amazonaws.com/js/aws-sdk-2.1234.0.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  initializeLex() {
    try {
      // Configurar AWS Lex Runtime
      this.lexRuntime = new AWS.LexRuntime({
        region: this.config.region,
        // As credenciais serão fornecidas via Cognito Identity Pool ou IAM Role
        // Para desenvolvimento, pode usar credenciais temporárias
      });

      this.isInitialized = true;
      console.log("Lex inicializado com sucesso");

      // Processar mensagens pendentes
      this.processPendingMessages();
    } catch (error) {
      console.error("Erro ao inicializar Lex:", error);
      this.handleInitError(error);
    }
  }

  generateUserId() {
    // Gerar ID único para o usuário
    let userId = IAmigosUtils.getStorage("user_id");
    if (!userId) {
      userId = "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      IAmigosUtils.setStorage("user_id", userId);
    }
    return userId;
  }

  async sendMessage(message, options = {}) {
    // Se não estiver inicializado, adicionar à fila
    if (!this.isInitialized) {
      return new Promise((resolve, reject) => {
        this.pendingMessages.push({ message, options, resolve, reject });
      });
    }

    try {
      const params = {
        botName: this.config.botName,
        botAlias: this.config.botAlias,
        userId: this.config.userId,
        inputText: message,
        sessionAttributes: this.sessionAttributes,
      };

      console.log("Enviando mensagem para Lex:", {
        message: IAmigosUtils.maskSensitiveText(message),
        sessionAttributes: this.sessionAttributes,
      });

      const response = await this.lexRuntime.postText(params).promise();

      // Atualizar session attributes
      if (response.sessionAttributes) {
        this.sessionAttributes = { ...this.sessionAttributes, ...response.sessionAttributes };
        IAmigosUtils.setStorage("session_attributes", this.sessionAttributes);
      }

      console.log("Resposta do Lex:", {
        message: IAmigosUtils.maskSensitiveText(response.message),
        dialogState: response.dialogState,
        intentName: response.intentName,
      });

      return this.formatLexResponse(response);
    } catch (error) {
      console.error("Erro ao enviar mensagem para Lex:", error);
      throw this.handleLexError(error);
    }
  }

  processPendingMessages() {
    while (this.pendingMessages.length > 0) {
      const { message, options, resolve, reject } = this.pendingMessages.shift();
      this.sendMessage(message, options).then(resolve).catch(reject);
    }
  }

  formatLexResponse(response) {
    const formattedResponse = {
      message: response.message,
      dialogState: response.dialogState,
      intentName: response.intentName,
      slots: response.slots || {},
      sessionAttributes: response.sessionAttributes || {},
      timestamp: new Date().toISOString(),
    };

    // Adicionar metadados baseados no estado do diálogo
    switch (response.dialogState) {
      case "ElicitIntent":
        formattedResponse.type = "elicit_intent";
        formattedResponse.requiresUserInput = true;
        break;

      case "ElicitSlot":
        formattedResponse.type = "elicit_slot";
        formattedResponse.requiresUserInput = true;
        formattedResponse.slotToElicit = response.slotToElicit;
        break;

      case "ConfirmIntent":
        formattedResponse.type = "confirm_intent";
        formattedResponse.requiresUserInput = true;
        break;

      case "Fulfilled":
        formattedResponse.type = "fulfilled";
        formattedResponse.requiresUserInput = false;
        formattedResponse.isComplete = true;
        break;

      case "Failed":
        formattedResponse.type = "failed";
        formattedResponse.requiresUserInput = false;
        formattedResponse.isComplete = true;
        break;

      default:
        formattedResponse.type = "unknown";
        formattedResponse.requiresUserInput = true;
    }

    return formattedResponse;
  }

  handleLexError(error) {
    const errorInfo = {
      originalError: error,
      userMessage: "Desculpe, estou com problemas técnicos. Tente novamente em alguns instantes.",
      shouldRetry: false,
    };

    if (error.code === "NetworkError") {
      errorInfo.userMessage = "Problema de conexão. Verifique sua internet e tente novamente.";
      errorInfo.shouldRetry = true;
    } else if (error.code === "TimeoutError") {
      errorInfo.userMessage = "Tempo limite excedido. Tente novamente.";
      errorInfo.shouldRetry = true;
    } else if (error.code === "BadRequestException") {
      errorInfo.userMessage = "Erro na solicitação. Tente reformular sua mensagem.";
    } else if (error.code === "LimitExceededException") {
      errorInfo.userMessage = "Limite de requisições excedido. Tente novamente em alguns minutos.";
      errorInfo.shouldRetry = true;
    }

    console.error("Erro tratado do Lex:", errorInfo);
    return errorInfo;
  }

  handleInitError(error) {
    IAmigosUtils.showNotification(
      "Erro ao conectar com o assistente. Recarregue a página e tente novamente.",
      "error",
      10000
    );
  }

  // Métodos para gerenciamento de sessão
  resetSession() {
    this.sessionAttributes = {};
    IAmigosUtils.removeStorage("session_attributes");
    this.config.userId = this.generateUserId(); // Novo ID para nova sessão
  }

  loadSession() {
    const savedAttributes = IAmigosUtils.getStorage("session_attributes", {});
    this.sessionAttributes = savedAttributes;
    return this.sessionAttributes;
  }

  updateSessionAttributes(attributes) {
    this.sessionAttributes = { ...this.sessionAttributes, ...attributes };
    IAmigosUtils.setStorage("session_attributes", this.sessionAttributes);
  }

  // Métodos para fluxos específicos
  async startPreApprovalFlow(symptoms, planTier = "basic") {
    const message = `Sintomas: ${symptoms}. Plano: ${planTier}. Quero pré-aprovação.`;
    return await this.sendMessage(message);
  }

  async startReimbursementFlow(documentInfo, planTier = "basic") {
    const message = `Reembolso. Documento: ${documentInfo}. Plano: ${planTier}.`;
    return await this.sendMessage(message);
  }

  async searchDentistsFlow(location, specialty = "geral") {
    const message = `Buscar dentistas. Localização: ${location}. Especialidade: ${specialty}.`;
    return await this.sendMessage(message);
  }

  // Utilitários de estado
  isDialogComplete() {
    return (
      this.sessionAttributes.analysisComplete === "true" || this.sessionAttributes.reimbursementComplete === "true"
    );
  }

  getCurrentIntent() {
    return this.sessionAttributes.currentIntent;
  }

  // Métodos para debug
  enableDebug() {
    this.debug = true;
    console.log("Debug mode enabled for LexChatbot");
  }

  getSessionInfo() {
    return {
      userId: this.config.userId,
      sessionAttributes: this.sessionAttributes,
      isInitialized: this.isInitialized,
      pendingMessages: this.pendingMessages.length,
    };
  }
}

// ===== INICIALIZAÇÃO GLOBAL DO LEX =====
document.addEventListener("DOMContentLoaded", function () {
  // Inicializar Lex quando a página carregar
  window.lexClient = new LexChatbot();

  // Carregar sessão salva se existir
  window.lexClient.loadSession();

  // Adicionar ao objeto global para debug
  if (window.location.search.includes("debug=true")) {
    window.lexClient.enableDebug();
    console.log("Lex Client:", window.lexClient.getSessionInfo());
  }
});

// ===== EXPORTAÇÃO =====
window.LexChatbot = LexChatbot;
