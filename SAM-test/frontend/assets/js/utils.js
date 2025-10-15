// ===== UTILITÁRIOS GLOBAIS =====

class IAmigosUtils {
  // ----- MANIPULAÇÃO DO DOM -----
  static $(selector) {
    return document.querySelector(selector);
  }

  static $$(selector) {
    return document.querySelectorAll(selector);
  }

  static createElement(tag, classes = "", content = "") {
    const element = document.createElement(tag);
    if (classes) element.className = classes;
    if (content) element.innerHTML = content;
    return element;
  }

  // ----- MANIPULAÇÃO DE STRINGS -----
  static formatCPF(cpf) {
    if (!cpf) return "";
    cpf = cpf.replace(/\D/g, "");
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  static formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  static formatDate(dateString) {
    return new Date(dateString).toLocaleDateString("pt-BR");
  }

  static maskSensitiveText(text, visibleChars = 4) {
    if (!text || text.length <= visibleChars * 2) return text;
    const first = text.substring(0, visibleChars);
    const last = text.substring(text.length - visibleChars);
    return `${first}***${last}`;
  }

  // ----- VALIDAÇÕES -----
  static isValidCPF(cpf) {
    cpf = cpf.replace(/\D/g, "");

    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false;

    // Validação de dígitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(10))) return false;

    return true;
  }

  static isValidCEP(cep) {
    cep = cep.replace(/\D/g, "");
    return cep.length === 8;
  }

  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // ----- MANIPULAÇÃO DE ARQUIVOS -----
  static validateFile(file, options = {}) {
    const {
      maxSize = 5 * 1024 * 1024, // 5MB default
      allowedTypes = ["image/jpeg", "image/png", "application/pdf"],
      allowedExtensions = [".jpg", ".jpeg", ".png", ".pdf"],
    } = options;

    const errors = [];

    // Tamanho
    if (file.size > maxSize) {
      errors.push(`Arquivo muito grande. Máximo: ${maxSize / 1024 / 1024}MB`);
    }

    // Tipo MIME
    if (!allowedTypes.includes(file.type)) {
      errors.push("Tipo de arquivo não permitido");
    }

    // Extensão
    const fileExtension = "." + file.name.split(".").pop().toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      errors.push("Extensão de arquivo não permitida");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ----- LOCAL STORAGE -----
  static setStorage(key, value) {
    try {
      localStorage.setItem(`iamigos_${key}`, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Erro ao salvar no localStorage:", error);
      return false;
    }
  }

  static getStorage(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(`iamigos_${key}`);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error("Erro ao ler do localStorage:", error);
      return defaultValue;
    }
  }

  static removeStorage(key) {
    try {
      localStorage.removeItem(`iamigos_${key}`);
      return true;
    } catch (error) {
      console.error("Erro ao remover do localStorage:", error);
      return false;
    }
  }

  // ----- NOTIFICAÇÕES -----
  static showNotification(message, type = "info", duration = 5000) {
    // Remove notificação existente
    this.hideNotification();

    const notification = this.createElement("div", `alert alert-${type} fade-in`);
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Auto-remove após duração
    if (duration > 0) {
      setTimeout(() => this.hideNotification(notification), duration);
    }

    return notification;
  }

  static hideNotification(notification = null) {
    if (notification) {
      notification.remove();
    } else {
      const existing = this.$('.alert[style*="position: fixed"]');
      if (existing) existing.remove();
    }
  }

  // ----- FORMATAÇÃO DE MENSAGENS -----
  static formatMessage(text) {
    if (!text) return "";

    return text
      .replace(/\n/g, "<br>")
      .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
      .replace(/_(.*?)_/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code>$1</code>");
  }

  // ----- MÁSCARAS DE INPUT -----
  static applyInputMask(input, maskType) {
    const handleInput = (e) => {
      let value = e.target.value.replace(/\D/g, "");

      switch (maskType) {
        case "cpf":
          if (value.length <= 11) {
            value = value
              .replace(/(\d{3})(\d)/, "$1.$2")
              .replace(/(\d{3})(\d)/, "$1.$2")
              .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
          }
          break;

        case "cep":
          if (value.length <= 8) {
            value = value.replace(/(\d{5})(\d)/, "$1-$2");
          }
          break;

        case "phone":
          if (value.length <= 11) {
            value = value.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
          }
          break;
      }

      e.target.value = value;
    };

    input.addEventListener("input", handleInput);
  }

  // ----- DEBOUNCE -----
  static debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func(...args);
    };
  }

  // ----- DETECÇÃO DE DISPOSITIVO -----
  static isMobile() {
    return window.innerWidth <= 768;
  }

  static isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }
}

// ===== INICIALIZAÇÃO GLOBAL =====
document.addEventListener("DOMContentLoaded", function () {
  // Aplicar máscaras automáticas
  const cpfInputs = IAmigosUtils.$$('input[data-mask="cpf"]');
  cpfInputs.forEach((input) => IAmigosUtils.applyInputMask(input, "cpf"));

  const cepInputs = IAmigosUtils.$$('input[data-mask="cep"]');
  cepInputs.forEach((input) => IAmigosUtils.applyInputMask(input, "cep"));

  // Prevenir envio de formulários com Enter em inputs únicos
  const singleInputForms = IAmigosUtils.$$("form input:only-of-type");
  singleInputForms.forEach((input) => {
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
      }
    });
  });

  // Adicionar loading state aos botões de submit
  const submitButtons = IAmigosUtils.$$('button[type="submit"]');
  submitButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const form = this.closest("form");
      if (form && form.checkValidity()) {
        this.classList.add("btn-loading");
      }
    });
  });
});

// ===== EXPORTAÇÃO PARA USO GLOBAL =====
window.IAmigosUtils = IAmigosUtils;
