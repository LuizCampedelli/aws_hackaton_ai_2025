// ===== CONTROLE DA PÁGINA DE STATUS =====

class StatusController {
  constructor() {
    this.requests = [];
    this.filteredRequests = [];
    this.currentFilters = {
      search: "",
      status: "",
      type: "",
    };

    this.elements = {
      totalRequests: document.getElementById("totalRequests"),
      pendingRequests: document.getElementById("pendingRequests"),
      approvedRequests: document.getElementById("approvedRequests"),
      totalAmount: document.getElementById("totalAmount"),
      requestsList: document.getElementById("requestsList"),
      noRequests: document.getElementById("noRequests"),
      requestDetails: document.getElementById("requestDetails"),
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadRequests();
    console.log("StatusController inicializado");
  }

  bindEvents() {
    // Busca em tempo real
    document.getElementById("searchInput")?.addEventListener(
      "input",
      IAmigosUtils.debounce(() => this.handleSearch(), 500)
    );
  }

  loadRequests() {
    // Carregar do localStorage
    const preApprovalHistory = IAmigosUtils.getStorage("chat_history", []);
    const reimbursementHistory = IAmigosUtils.getStorage("reimbursement_history", []);

    this.requests = [
      ...this.formatPreApprovalRequests(preApprovalHistory),
      ...this.formatReimbursementRequests(reimbursementHistory),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    this.applyFilters();
    this.updateSummary();
    this.renderRequests();
  }

  formatPreApprovalRequests(history) {
    return history.map((item, index) => ({
      id: `PRE${Date.now()}${index}`,
      type: "pre_approval",
      timestamp: item.timestamp,
      description: `Pré-aprovação: ${item.user.substring(0, 50)}...`,
      status: this.getPreApprovalStatus(item),
      value: 0,
      details: item,
    }));
  }

  formatReimbursementRequests(history) {
    return history.map((item) => ({
      id: item.id,
      type: "reimbursement",
      timestamp: item.timestamp,
      description: `Reembolso: ${item.formData.procedureDescription}`,
      status: item.status || "processing",
      value: parseFloat(item.formData.procedureValue || 0),
      details: item,
    }));
  }

  getPreApprovalStatus(item) {
    const attributes = item.sessionAttributes || {};
    if (attributes.analysisComplete === "true") {
      return attributes.approvalStatus === "approved" ? "approved" : "rejected";
    }
    return "processing";
  }

  handleSearch() {
    this.currentFilters.search = document.getElementById("searchInput")?.value || "";
    this.applyFilters();
  }

  filterRequests() {
    this.currentFilters.status = document.getElementById("statusFilter")?.value || "";
    this.currentFilters.type = document.getElementById("typeFilter")?.value || "";
    this.applyFilters();
  }

  applyFilters() {
    this.filteredRequests = this.requests.filter((request) => {
      // Filtro de busca
      if (this.currentFilters.search) {
        const searchTerm = this.currentFilters.search.toLowerCase();
        const matchesId = request.id.toLowerCase().includes(searchTerm);
        const matchesDescription = request.description.toLowerCase().includes(searchTerm);
        if (!matchesId && !matchesDescription) return false;
      }

      // Filtro de status
      if (this.currentFilters.status && request.status !== this.currentFilters.status) {
        return false;
      }

      // Filtro de tipo
      if (this.currentFilters.type && request.type !== this.currentFilters.type) {
        return false;
      }

      return true;
    });

    this.renderRequests();
  }

  renderRequests() {
    const container = this.elements.requestsList;
    if (!container) return;

    // Limpar container
    container.innerHTML = "";

    // Mostrar/ocultar estado sem resultados
    if (this.filteredRequests.length === 0) {
      this.elements.noRequests.style.display = "block";
      return;
    } else {
      this.elements.noRequests.style.display = "none";
    }

    // Adicionar solicitações
    this.filteredRequests.forEach((request) => {
      const requestElement = this.createRequestElement(request);
      container.appendChild(requestElement);
    });
  }

  createRequestElement(request) {
    const element = document.createElement("div");
    element.className = "request-item";
    element.innerHTML = this.getRequestHTML(request);

    element.addEventListener("click", () => this.showRequestDetails(request));

    return element;
  }

  getRequestHTML(request) {
    const formattedDate = IAmigosUtils.formatDate(request.timestamp);
    const formattedValue = request.value > 0 ? IAmigosUtils.formatCurrency(request.value) : "-";

    return `
            <div class="request-header">
                <div class="request-id">${request.id}</div>
                <div class="request-date">${formattedDate}</div>
            </div>
            
            <div class="request-type ${request.type}">
                ${request.type === "pre_approval" ? "Pré-Aprovação" : "Reembolso"}
            </div>
            
            <div class="request-description">
                ${request.description}
            </div>
            
            <div class="request-footer">
                <div class="request-value">${formattedValue}</div>
                <div class="request-status status-${request.status}">
                    ${this.getStatusText(request.status)}
                </div>
            </div>
        `;
  }

  getStatusText(status) {
    const statusMap = {
      processing: "Em processamento",
      approved: "Aprovado",
      rejected: "Rejeitado",
      completed: "Concluído",
    };
    return statusMap[status] || status;
  }

  showRequestDetails(request) {
    // Remover active de todos os items
    document.querySelectorAll(".request-item").forEach((item) => {
      item.classList.remove("active");
    });

    // Adicionar active ao item clicado
    event.currentTarget.classList.add("active");

    // Mostrar detalhes
    this.renderRequestDetails(request);
  }

  renderRequestDetails(request) {
    const container = this.elements.requestDetails;
    if (!container) return;

    container.innerHTML = this.getRequestDetailsHTML(request);
  }

  getRequestDetailsHTML(request) {
    const formattedDate = IAmigosUtils.formatDate(request.timestamp);
    const formattedTime = new Date(request.timestamp).toLocaleTimeString("pt-BR");

    return `
            <div class="details-content">
                <div class="details-section">
                    <h4>📋 Informações da Solicitação</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">ID:</span>
                            <span class="detail-value">${request.id}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Data:</span>
                            <span class="detail-value">${formattedDate}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Hora:</span>
                            <span class="detail-value">${formattedTime}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Tipo:</span>
                            <span class="detail-value">
                                <span class="request-type ${request.type}">
                                    ${request.type === "pre_approval" ? "Pré-Aprovação" : "Reembolso"}
                                </span>
                            </span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Status:</span>
                            <span class="detail-value">
                                <span class="request-status status-${request.status}">
                                    ${this.getStatusText(request.status)}
                                </span>
                            </span>
                        </div>
                        ${
                          request.value > 0
                            ? `
                        <div class="detail-item">
                            <span class="detail-label">Valor:</span>
                            <span class="detail-value">${IAmigosUtils.formatCurrency(request.value)}</span>
                        </div>
                        `
                            : ""
                        }
                    </div>
                </div>
                
                <div class="details-section">
                    <h4>📝 Detalhes</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Descrição:</span>
                            <span class="detail-value">${request.description}</span>
                        </div>
                        ${this.getAdditionalDetails(request)}
                    </div>
                </div>
                
                <div class="detail-actions">
                    ${
                      request.type === "pre_approval"
                        ? `
                    <button class="btn btn-primary" onclick="newPreApproval()">
                        🦷 Nova Pré-Aprovação
                    </button>
                    `
                        : `
                    <button class="btn btn-primary" onclick="newReimbursement()">
                        📄 Novo Reembolso
                    </button>
                    `
                    }
                    <button class="btn btn-secondary" onclick="contactSupport()">
                        💬 Falar com Suporte
                    </button>
                </div>
            </div>
        `;
  }

  getAdditionalDetails(request) {
    if (request.type === "pre_approval" && request.details.sessionAttributes) {
      const attrs = request.details.sessionAttributes;
      return `
                <div class="detail-item">
                    <span class="detail-label">Condição:</span>
                    <span class="detail-value">${attrs.possibleConditions || "Não identificada"}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Urgência:</span>
                    <span class="detail-value">${attrs.urgencyLevel || "Não avaliada"}</span>
                </div>
            `;
    } else if (request.type === "reimbursement") {
      return `
                <div class="detail-item">
                    <span class="detail-label">Paciente:</span>
                    <span class="detail-value">${request.details.formData.patientName}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Consultório:</span>
                    <span class="detail-value">${request.details.formData.clinicName}</span>
                </div>
            `;
    }
    return "";
  }

  updateSummary() {
    if (!this.elements.totalRequests) return;

    const total = this.requests.length;
    const pending = this.requests.filter((r) => r.status === "processing").length;
    const approved = this.requests.filter((r) => r.status === "approved").length;
    const totalAmount = this.requests.reduce((sum, r) => sum + r.value, 0);

    this.elements.totalRequests.textContent = total;
    this.elements.pendingRequests.textContent = pending;
    this.elements.approvedRequests.textContent = approved;
    this.elements.totalAmount.textContent = IAmigosUtils.formatCurrency(totalAmount);
  }
}

// ===== FUNÇÕES GLOBAIS =====

function searchRequests() {
  if (window.statusController) {
    window.statusController.handleSearch();
  }
}

function filterRequests() {
  if (window.statusController) {
    window.statusController.filterRequests();
  }
}

function clearFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("statusFilter").value = "";
  document.getElementById("typeFilter").value = "";

  if (window.statusController) {
    window.statusController.currentFilters = { search: "", status: "", type: "" };
    window.statusController.applyFilters();
  }
}

function newPreApproval() {
  window.location.href = "chatbot.html";
}

function newReimbursement() {
  window.location.href = "upload.html";
}

function contactSupport() {
  IAmigosUtils.showNotification("Redirecionando para suporte...", "info");
  // Em implementação real, abriria chat ou formulário de contato
  setTimeout(() => {
    window.location.href = "mailto:suporte@iamigos.com";
  }, 1000);
}

// ===== INICIALIZAÇÃO =====
document.addEventListener("DOMContentLoaded", function () {
  window.statusController = new StatusController();

  // Suporte para debug
  if (window.location.search.includes("debug=true")) {
    window.debugStatus = window.statusController;
    console.log("StatusController disponível como window.debugStatus");
  }
});
