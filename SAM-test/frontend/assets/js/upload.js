// ===== CONTROLE DO PROCESSO DE UPLOAD =====

class UploadController {
  constructor() {
    this.currentStep = 1;
    this.formData = {};
    this.selectedFile = null;

    this.elements = {
      steps: document.querySelectorAll(".form-step"),
      progressSteps: document.querySelectorAll(".progress-steps .step"),
      procedureForm: document.getElementById("procedureForm"),
      uploadArea: document.getElementById("uploadArea"),
      fileInput: document.getElementById("fileInput"),
      filePreview: document.getElementById("filePreview"),
      processingOverlay: document.getElementById("processingOverlay"),
      processButton: document.getElementById("processButton"),
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.setupDragAndDrop();
    this.loadSavedData();
    console.log("UploadController inicializado");
  }

  bindEvents() {
    // Navegação entre steps
    this.elements.procedureForm?.addEventListener("submit", (e) => e.preventDefault());

    // Upload de arquivo
    this.elements.fileInput?.addEventListener("change", (e) => this.handleFileSelect(e));

    // Botão de processamento
    this.elements.processButton?.addEventListener("click", () => this.processReimbursement());
  }

  setupDragAndDrop() {
    const uploadArea = this.elements.uploadArea;
    if (!uploadArea) return;

    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      uploadArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.remove("drag-over");
      });
    });

    uploadArea.addEventListener("drop", (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFiles(files[0]);
      }
    });
  }

  // Navegação entre steps
  nextStep() {
    if (this.currentStep === 1 && !this.validateStep1()) {
      return;
    }

    this.currentStep++;
    this.updateProgress();
    this.showStep(this.currentStep);
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateProgress();
      this.showStep(this.currentStep);
    }
  }

  showStep(stepNumber) {
    // Ocultar todos os steps
    this.elements.steps.forEach((step) => {
      step.classList.remove("active");
    });

    // Mostrar step atual
    const currentStep = document.getElementById(`step${stepNumber}`);
    if (currentStep) {
      currentStep.classList.add("active");
    }

    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  updateProgress() {
    this.elements.progressSteps.forEach((step, index) => {
      const stepNumber = index + 1;
      if (stepNumber <= this.currentStep) {
        step.classList.add("active");
      } else {
        step.classList.remove("active");
      }
    });
  }

  // Validação do Step 1
  validateStep1() {
    const requiredFields = [
      "patientName",
      "patientCPF",
      "patientEmail",
      "patientPhone",
      "planTier",
      "procedureDate",
      "procedureValue",
      "procedureDescription",
      "clinicName",
    ];

    let isValid = true;

    requiredFields.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (!field || !field.value.trim()) {
        this.showFieldError(fieldId, "Este campo é obrigatório");
        isValid = false;
      } else {
        this.clearFieldError(fieldId);
      }
    });

    // Validação específica do CPF
    const cpfField = document.getElementById("patientCPF");
    if (cpfField && cpfField.value.trim()) {
      const cpf = cpfField.value.replace(/\D/g, "");
      if (!IAmigosUtils.isValidCPF(cpf)) {
        this.showFieldError("patientCPF", "CPF inválido");
        isValid = false;
      }
    }

    // Validação específica do e-mail
    const emailField = document.getElementById("patientEmail");
    if (emailField && emailField.value.trim() && !IAmigosUtils.isValidEmail(emailField.value)) {
      this.showFieldError("patientEmail", "E-mail inválido");
      isValid = false;
    }

    if (isValid) {
      this.saveFormData();
    }

    return isValid;
  }

  showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    field.classList.add("error");

    // Remover mensagem de erro existente
    const existingError = field.parentNode.querySelector(".form-error");
    if (existingError) {
      existingError.remove();
    }

    // Adicionar nova mensagem de erro
    const errorElement = document.createElement("div");
    errorElement.className = "form-error";
    errorElement.textContent = message;
    field.parentNode.appendChild(errorElement);
  }

  clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    field.classList.remove("error");

    const existingError = field.parentNode.querySelector(".form-error");
    if (existingError) {
      existingError.remove();
    }
  }

  // Manipulação de arquivos
  handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      this.handleFiles(file);
    }
  }

  async handleFiles(file) {
    // Validar arquivo
    const validation = IAmigosUtils.validateFile(file, {
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ["image/jpeg", "image/png", "application/pdf"],
      allowedExtensions: [".jpg", ".jpeg", ".png", ".pdf"],
    });

    if (!validation.valid) {
      IAmigosUtils.showNotification(validation.errors[0], "error");
      return;
    }

    this.selectedFile = file;
    this.showFilePreview(file);
    this.simulateUploadProgress();
  }

  showFilePreview(file) {
    const fileIcon = this.getFileIcon(file.type);
    const fileSize = this.formatFileSize(file.size);

    document.getElementById("fileIcon").textContent = fileIcon;
    document.getElementById("fileName").textContent = file.name;
    document.getElementById("fileSize").textContent = fileSize;

    this.elements.filePreview.classList.add("active");
  }

  getFileIcon(fileType) {
    if (fileType.startsWith("image/")) return "🖼️";
    if (fileType === "application/pdf") return "📄";
    return "📁";
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  simulateUploadProgress() {
    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("progressText");

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }

      progressFill.style.width = progress + "%";
      progressText.textContent = Math.round(progress) + "%";
    }, 200);
  }

  removeFile() {
    this.selectedFile = null;
    this.elements.filePreview.classList.remove("active");
    this.elements.fileInput.value = "";
  }

  // Processamento do reembolso
  async processReimbursement() {
    if (!this.selectedFile) {
      IAmigosUtils.showNotification("Por favor, selecione um arquivo", "warning");
      return;
    }

    if (!this.validateStep1()) {
      this.prevStep();
      return;
    }

    try {
      this.showProcessingOverlay();
      await this.simulateProcessing();

      // Enviar para Lex
      const message = this.buildReimbursementMessage();
      const response = await window.lexClient.sendMessage(message);

      this.showConfirmation(response);
    } catch (error) {
      this.handleProcessingError(error);
    } finally {
      this.hideProcessingOverlay();
    }
  }

  buildReimbursementMessage() {
    const formData = this.getFormData();
    return (
      `REEMBOLSO: ${formData.patientName} | CPF: ${formData.patientCPF} | ` +
      `Plano: ${formData.planTier} | Valor: R$ ${formData.procedureValue} | ` +
      `Procedimento: ${formData.procedureDescription} | ` +
      `Consultório: ${formData.clinicName} | Arquivo: ${this.selectedFile.name}`
    );
  }

  async simulateProcessing() {
    const steps = document.querySelectorAll(".processing-step");

    for (let i = 0; i < steps.length; i++) {
      await this.delay(1000 + Math.random() * 1000);
      steps[i].classList.add("active");
    }

    await this.delay(1000);
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  showProcessingOverlay() {
    this.elements.processingOverlay.classList.add("active");
  }

  hideProcessingOverlay() {
    this.elements.processingOverlay.classList.remove("active");
  }

  showConfirmation(lexResponse) {
    this.currentStep = 3;
    this.updateProgress();
    this.showStep(3);

    // Preencher dados da confirmação
    this.fillConfirmationData(lexResponse);

    // Limpar formulário para próxima solicitação
    this.clearForm();
  }

  fillConfirmationData(lexResponse) {
    const formData = this.getFormData();
    const requestId = "IAM" + Date.now().toString().slice(-8);

    document.getElementById("confirmationId").textContent = requestId;
    document.getElementById("confirmationDate").textContent = new Date().toLocaleDateString("pt-BR");
    document.getElementById("confirmationValue").textContent = IAmigosUtils.formatCurrency(
      parseFloat(formData.procedureValue)
    );

    // Salvar no histórico
    this.saveToHistory(requestId, formData, lexResponse);
  }

  handleProcessingError(error) {
    console.error("Erro no processamento:", error);
    IAmigosUtils.showNotification(
      "Erro ao processar reembolso. Tente novamente ou entre em contato com o suporte.",
      "error"
    );
  }

  // Gerenciamento de dados do formulário
  saveFormData() {
    this.formData = this.getFormData();
    IAmigosUtils.setStorage("reimbursement_form_data", this.formData);
  }

  getFormData() {
    const fields = [
      "patientName",
      "patientCPF",
      "patientEmail",
      "patientPhone",
      "planTier",
      "procedureDate",
      "procedureValue",
      "procedureDescription",
      "clinicName",
      "clinicCNPJ",
    ];

    const data = {};
    fields.forEach((field) => {
      const element = document.getElementById(field);
      if (element) {
        data[field] = element.value;
      }
    });

    return data;
  }

  loadSavedData() {
    const savedData = IAmigosUtils.getStorage("reimbursement_form_data", {});
    Object.keys(savedData).forEach((field) => {
      const element = document.getElementById(field);
      if (element && savedData[field]) {
        element.value = savedData[field];
      }
    });
  }

  clearForm() {
    this.formData = {};
    this.selectedFile = null;
    IAmigosUtils.removeStorage("reimbursement_form_data");

    // Resetar para step 1 após um delay
    setTimeout(() => {
      this.currentStep = 1;
      this.updateProgress();
      this.showStep(1);
      this.elements.procedureForm?.reset();
      this.removeFile();
    }, 5000);
  }

  // Histórico de solicitações
  saveToHistory(requestId, formData, lexResponse) {
    const history = IAmigosUtils.getStorage("reimbursement_history", []);

    history.unshift({
      id: requestId,
      timestamp: new Date().toISOString(),
      formData: formData,
      fileName: this.selectedFile?.name,
      lexResponse: lexResponse,
      status: "processing",
    });

    // Manter apenas as últimas 10 solicitações
    if (history.length > 10) {
      history.pop();
    }

    IAmigosUtils.setStorage("reimbursement_history", history);
  }
}

// ===== FUNÇÕES GLOBAIS =====

// Navegação entre steps
function nextStep() {
  if (window.uploadController) {
    window.uploadController.nextStep();
  }
}

function prevStep() {
  if (window.uploadController) {
    window.uploadController.prevStep();
  }
}

// Manipulação de arquivos
function removeFile() {
  if (window.uploadController) {
    window.uploadController.removeFile();
  }
}

// Processamento
function processReimbursement() {
  if (window.uploadController) {
    window.uploadController.processReimbursement();
  }
}

// Ações da confirmação
function trackStatus() {
  window.location.href = "status.html";
}

function newReimbursement() {
  if (window.uploadController) {
    window.uploadController.clearForm();
  }
}

function resetForm() {
  if (window.uploadController) {
    window.uploadController.clearForm();
  }
  IAmigosUtils.showNotification("Formulário limpo", "success");
}

// ===== INICIALIZAÇÃO =====
document.addEventListener("DOMContentLoaded", function () {
  // Aguardar o Lex ser inicializado
  const initUpload = () => {
    if (window.lexClient && window.lexClient.isInitialized) {
      window.uploadController = new UploadController();
      console.log("UploadController inicializado com sucesso");
    } else {
      setTimeout(initUpload, 100);
    }
  };

  setTimeout(initUpload, 500);

  // Suporte para debug
  if (window.location.search.includes("debug=true")) {
    window.debugUpload = window.uploadController;
    console.log("UploadController disponível como window.debugUpload");
  }
});
