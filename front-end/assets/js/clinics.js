// ===== CONTROLE DA PÁGINA DE CLÍNICAS =====

class ClinicsController {
  constructor() {
    this.currentView = "grid";
    this.filters = {
      location: "",
      plan: "",
      specialty: "",
      minRating: 0,
    };

    this.clinicsData = [];
    this.filteredClinics = [];

    this.elements = {
      loadingState: document.getElementById("loadingState"),
      clinicsResults: document.getElementById("clinicsResults"),
      noResults: document.getElementById("noResults"),
      resultsCount: document.getElementById("resultsCount"),
      resultsDescription: document.getElementById("resultsDescription"),
      mapSection: document.getElementById("mapSection"),
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadClinicsData();
    console.log("ClinicsController inicializado");
  }

  bindEvents() {
    // Filtros
    document.getElementById("locationFilter")?.addEventListener(
      "input",
      IAmigosUtils.debounce(() => this.updateFilters(), 500)
    );
    document.getElementById("planFilter")?.addEventListener("change", () => this.updateFilters());
    document.getElementById("specialtyFilter")?.addEventListener("change", () => this.updateFilters());

    // Filtros de avaliação
    document.querySelectorAll(".rating-option").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".rating-option").forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        this.filters.minRating = parseFloat(e.target.dataset.rating);
        this.updateFilters();
      });
    });
  }

  async loadClinicsData() {
    try {
      this.showLoading(true);

      // Dados mockados para demonstração
      this.clinicsData = await this.getMockClinicsData();
      this.filteredClinics = [...this.clinicsData];

      this.renderClinics();
      this.updateResultsInfo();
    } catch (error) {
      this.handleLoadError(error);
    } finally {
      this.showLoading(false);
    }
  }

  getMockClinicsData() {
    // Dados fictícios para demonstração
    return [
      {
        id: 1,
        name: "Sorriso Perfeito Odontologia",
        address: "Rua das Flores, 123 - Jardim Paulista, São Paulo - SP, 01415-001",
        phone: "(11) 3333-4444",
        rating: 4.8,
        specialties: ["geral", "ortodontia", "implante"],
        plans: ["basic", "premium", "vip"],
        distance: "0.8 km",
        openingHours: "Seg-Sex: 8h-19h | Sáb: 8h-14h",
        about: "Clínica especializada em ortodontia e implantes dentários com mais de 15 anos de experiência.",
      },
      {
        id: 2,
        name: "Dental Care Center",
        address: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP, 01310-100",
        phone: "(11) 2222-3333",
        rating: 4.5,
        specialties: ["geral", "endodontia", "periodontia"],
        plans: ["basic", "premium"],
        distance: "1.2 km",
        openingHours: "Seg-Sex: 7h-20h | Sáb: 8h-12h",
        about: "Centro odontológico completo com atendimento emergencial e especialidades diversas.",
      },
      {
        id: 3,
        name: "Clínica Dental Sorriso Saudável",
        address: "Rua Augusta, 500 - Consolação, São Paulo - SP, 01305-000",
        phone: "(11) 4444-5555",
        rating: 4.9,
        specialties: ["geral", "ortodontia", "estetica"],
        plans: ["premium", "vip"],
        distance: "1.5 km",
        openingHours: "Seg-Sex: 9h-18h",
        about: "Clínica premium focada em estética dental e ortodontia invisível.",
      },
      {
        id: 4,
        name: "Odonto Excellence",
        address: "Alameda Santos, 200 - Cerqueira César, São Paulo - SP, 01418-000",
        phone: "(11) 5555-6666",
        rating: 4.7,
        specialties: ["geral", "implante", "cirurgia"],
        plans: ["basic", "vip"],
        distance: "2.1 km",
        openingHours: "Seg-Sex: 8h-19h | Sáb: 8h-13h",
        about: "Especialistas em implantes dentários e cirurgias bucomaxilofaciais.",
      },
      {
        id: 5,
        name: "Dental Sorriso & Cia",
        address: "Rua Haddock Lobo, 300 - Cerqueira César, São Paulo - SP, 01414-000",
        phone: "(11) 6666-7777",
        rating: 4.4,
        specialties: ["geral", "preventiva"],
        plans: ["basic"],
        distance: "2.5 km",
        openingHours: "Seg-Sex: 8h-18h",
        about: "Clínica familiar com foco em odontologia preventiva e tratamentos básicos.",
      },
    ];
  }

  updateFilters() {
    this.filters.location = document.getElementById("locationFilter")?.value || "";
    this.filters.plan = document.getElementById("planFilter")?.value || "";
    this.filters.specialty = document.getElementById("specialtyFilter")?.value || "";

    this.applyFilters();
  }

  applyFilters() {
    this.filteredClinics = this.clinicsData.filter((clinic) => {
      // Filtro por plano
      if (this.filters.plan && !clinic.plans.includes(this.filters.plan)) {
        return false;
      }

      // Filtro por especialidade
      if (this.filters.specialty && !clinic.specialties.includes(this.filters.specialty)) {
        return false;
      }

      // Filtro por avaliação
      if (this.filters.minRating > 0 && clinic.rating < this.filters.minRating) {
        return false;
      }

      return true;
    });

    this.renderClinics();
    this.updateResultsInfo();
  }

  renderClinics() {
    const container = this.elements.clinicsResults;
    if (!container) return;

    // Limpar resultados anteriores
    container.innerHTML = "";

    // Mostrar/ocultar estado sem resultados
    if (this.filteredClinics.length === 0) {
      this.elements.noResults.style.display = "block";
      return;
    } else {
      this.elements.noResults.style.display = "none";
    }

    // Criar container apropriado para a view
    const resultsContainer = document.createElement("div");
    resultsContainer.className = this.currentView === "grid" ? "clinics-grid" : "clinics-list";

    // Adicionar clínicas
    this.filteredClinics.forEach((clinic) => {
      const clinicElement = this.createClinicCard(clinic);
      resultsContainer.appendChild(clinicElement);
    });

    container.appendChild(resultsContainer);
  }

  createClinicCard(clinic) {
    const card = document.createElement("div");
    card.className = `clinic-card ${this.currentView}-view`;
    card.innerHTML = this.getClinicCardHTML(clinic);

    card.addEventListener("click", () => this.showClinicDetails(clinic));

    return card;
  }

  getClinicCardHTML(clinic) {
    const specialtiesHTML = clinic.specialties
      .map((spec) => `<span class="specialty-tag">${this.getSpecialtyName(spec)}</span>`)
      .join("");

    const plansHTML = clinic.plans.map((plan) => `<span class="plan-badge">${plan.toUpperCase()}</span>`).join("");

    if (this.currentView === "grid") {
      return `
                <div class="clinic-image">🦷</div>
                <div class="clinic-content">
                    <div class="clinic-header">
                        <div>
                            <div class="clinic-name">${clinic.name}</div>
                        </div>
                        <div class="clinic-rating">
                            ⭐ ${clinic.rating}
                        </div>
                    </div>
                    
                    <div class="clinic-specialties">
                        ${specialtiesHTML}
                    </div>
                    
                    <div class="clinic-info">
                        <div class="clinic-info-item">
                            <span class="icon">📍</span>
                            <span>${clinic.distance}</span>
                        </div>
                        <div class="clinic-info-item">
                            <span class="icon">📞</span>
                            <span>${clinic.phone}</span>
                        </div>
                        <div class="clinic-info-item">
                            <span class="icon">🕒</span>
                            <span>${clinic.openingHours.split(" | ")[0]}</span>
                        </div>
                    </div>
                    
                    <div class="clinic-plans">
                        ${plansHTML}
                    </div>
                    
                    <div class="clinic-actions">
                        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); scheduleAppointment(${
                          clinic.id
                        })">
                            📅 Agendar
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); viewOnMap(${
                          clinic.id
                        })">
                            🗺️ Ver Mapa
                        </button>
                    </div>
                </div>
            `;
    } else {
      return `
                <div class="clinic-image">🦷</div>
                <div class="clinic-content">
                    <div class="clinic-header">
                        <div>
                            <div class="clinic-name">${clinic.name}</div>
                            <div class="clinic-info-item">
                                <span class="icon">📍</span>
                                <span>${clinic.address}</span>
                            </div>
                        </div>
                        <div class="clinic-rating">
                            ⭐ ${clinic.rating}
                        </div>
                    </div>
                    
                    <div class="clinic-specialties">
                        ${specialtiesHTML}
                    </div>
                    
                    <div class="clinic-info">
                        <div class="clinic-info-item">
                            <span class="icon">📞</span>
                            <span>${clinic.phone}</span>
                        </div>
                        <div class="clinic-info-item">
                            <span class="icon">🕒</span>
                            <span>${clinic.openingHours}</span>
                        </div>
                        <div class="clinic-info-item">
                            <span class="icon">🚶</span>
                            <span>${clinic.distance}</span>
                        </div>
                    </div>
                    
                    <div class="clinic-plans">
                        ${plansHTML}
                    </div>
                    
                    <div class="clinic-actions">
                        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); scheduleAppointment(${clinic.id})">
                            📅 Agendar
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); viewOnMap(${clinic.id})">
                            🗺️ Mapa
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); callClinic('${clinic.phone}')">
                            📞 Ligar
                        </button>
                    </div>
                </div>
            `;
    }
  }

  getSpecialtyName(specialty) {
    const specialties = {
      geral: "Clínico Geral",
      ortodontia: "Ortodontia",
      implante: "Implante",
      endodontia: "Endodontia",
      periodontia: "Periodontia",
      estetica: "Estética",
      cirurgia: "Cirurgia",
      preventiva: "Preventiva",
    };
    return specialties[specialty] || specialty;
  }

  updateResultsInfo() {
    if (!this.elements.resultsCount || !this.elements.resultsDescription) return;

    const count = this.filteredClinics.length;
    const total = this.clinicsData.length;

    this.elements.resultsCount.textContent = `${count} dentista${count !== 1 ? "s" : ""} encontrado${
      count !== 1 ? "s" : ""
    }`;

    if (this.filters.location) {
      this.elements.resultsDescription.textContent = `Próximos de ${this.filters.location}`;
    } else if (this.filters.plan || this.filters.specialty) {
      this.elements.resultsDescription.textContent = `Filtrado${
        count !== 1 ? "s" : ""
      } por ${this.getActiveFiltersDescription()}`;
    } else {
      this.elements.resultsDescription.textContent = `${total} dentista${total !== 1 ? "s" : ""} disponível${
        total !== 1 ? "is" : "l"
      } na base`;
    }
  }

  getActiveFiltersDescription() {
    const activeFilters = [];

    if (this.filters.plan) {
      activeFilters.push(`plano ${this.filters.plan}`);
    }

    if (this.filters.specialty) {
      activeFilters.push(this.getSpecialtyName(this.filters.specialty));
    }

    if (this.filters.minRating > 0) {
      activeFilters.push(`avaliação ${this.filters.minRating}+`);
    }

    return activeFilters.join(" e ");
  }

  showClinicDetails(clinic) {
    const modal = document.getElementById("clinicModal");
    const modalName = document.getElementById("modalClinicName");
    const modalDetails = document.getElementById("modalClinicDetails");

    if (!modal || !modalName || !modalDetails) return;

    modalName.textContent = clinic.name;
    modalDetails.innerHTML = this.getClinicDetailsHTML(clinic);

    modal.classList.add("active");
  }

  getClinicDetailsHTML(clinic) {
    const specialtiesHTML = clinic.specialties
      .map((spec) => `<span class="specialty-tag">${this.getSpecialtyName(spec)}</span>`)
      .join("");

    const plansHTML = clinic.plans.map((plan) => `<span class="plan-badge">${plan.toUpperCase()}</span>`).join("");

    return `
            <div class="clinic-details">
                <div class="detail-section">
                    <h4>📋 Informações</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Endereço:</label>
                            <span>${clinic.address}</span>
                        </div>
                        <div class="detail-item">
                            <label>Telefone:</label>
                            <span>${clinic.phone}</span>
                        </div>
                        <div class="detail-item">
                            <label>Horário de Funcionamento:</label>
                            <span>${clinic.openingHours}</span>
                        </div>
                        <div class="detail-item">
                            <label>Avaliação:</label>
                            <span class="clinic-rating">⭐ ${clinic.rating}/5.0</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>🎯 Especialidades</h4>
                    <div class="specialties-list">
                        ${specialtiesHTML}
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>💳 Planos Aceitos</h4>
                    <div class="plans-list">
                        ${plansHTML}
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>ℹ️ Sobre a Clínica</h4>
                    <p>${clinic.about}</p>
                </div>
                
                <div class="detail-actions">
                    <button class="btn btn-primary" onclick="scheduleAppointment(${clinic.id})">
                        📅 Agendar Consulta
                    </button>
                    <button class="btn btn-secondary" onclick="callClinic('${clinic.phone}')">
                        📞 Ligar para Clínica
                    </button>
                    <button class="btn btn-outline" onclick="viewOnMap(${clinic.id})">
                        🗺️ Ver no Mapa
                    </button>
                </div>
            </div>
        `;
  }

  changeView(view) {
    this.currentView = view;

    // Atualizar botões de view
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });

    this.renderClinics();
  }

  showLoading(show) {
    if (this.elements.loadingState) {
      this.elements.loadingState.classList.toggle("active", show);
    }
  }

  handleLoadError(error) {
    console.error("Erro ao carregar clínicas:", error);
    IAmigosUtils.showNotification("Erro ao carregar lista de dentistas", "error");
  }
}

// ===== FUNÇÕES GLOBAIS =====

function searchClinics() {
  if (window.clinicsController) {
    window.clinicsController.updateFilters();
  }
}

function resetFilters() {
  document.getElementById("locationFilter").value = "";
  document.getElementById("planFilter").value = "";
  document.getElementById("specialtyFilter").value = "";

  document.querySelectorAll(".rating-option").forEach((btn, index) => {
    btn.classList.toggle("active", index === 0);
  });

  if (window.clinicsController) {
    window.clinicsController.filters.minRating = 0;
    window.clinicsController.updateFilters();
  }
}

function changeView(view) {
  if (window.clinicsController) {
    window.clinicsController.changeView(view);
  }
}

function closeModal() {
  const modal = document.getElementById("clinicModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

function scheduleAppointment(clinicId) {
  IAmigosUtils.showNotification("Redirecionando para agendamento...", "info");
  // Em uma implementação real, isso iria para uma página de agendamento
  setTimeout(() => {
    window.location.href = `chatbot.html?action=schedule&clinic=${clinicId}`;
  }, 1000);
}

function viewOnMap(clinicId) {
  IAmigosUtils.showNotification("Abrindo mapa...", "info");
  // Em uma implementação real, isso integraria com Google Maps
  openGoogleMaps();
}

function callClinic(phoneNumber) {
  if (confirm(`Deseja ligar para ${phoneNumber}?`)) {
    window.location.href = `tel:${phoneNumber}`;
  }
}

function openGoogleMaps() {
  IAmigosUtils.showNotification("Integração com Google Maps em desenvolvimento", "info");
  // window.open('https://maps.google.com', '_blank');
}

// ===== INICIALIZAÇÃO =====
document.addEventListener("DOMContentLoaded", function () {
  window.clinicsController = new ClinicsController();

  // Fechar modal ao clicar fora
  document.getElementById("clinicModal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("clinicModal")) {
      closeModal();
    }
  });

  // Suporte para debug
  if (window.location.search.includes("debug=true")) {
    window.debugClinics = window.clinicsController;
    console.log("ClinicsController disponível como window.debugClinics");
  }
});
