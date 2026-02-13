document.addEventListener("DOMContentLoaded", function () {
  // DOM Elements
  const taskInput = document.getElementById("taskInput");
  const addTaskBtn = document.getElementById("addTaskBtn");
  const taskList = document.getElementById("taskList");
  const filterBtns = document.querySelectorAll(".filter-btn");
  const clearCompletedBtn = document.getElementById("clearCompleted");
  const taskCount = document.getElementById("taskCount");
  const currentDate = document.getElementById("currentDate");
  const emptyState = document.querySelector(".empty-state");
  const notification = document.getElementById("notification");
  const notificationText = document.getElementById("notificationText");
  const themeToggle = document.getElementById("themeToggle");
  const languageSelector = document.getElementById("languageSelector");

  // State
  let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
  let currentFilter = "all";
  let translations = {}; // To store the loaded language file

  // Initialize
  initializeApp();

  // Event Listeners
  addTaskBtn.addEventListener("click", addTask);
  taskInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") addTask();
  });

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      filterBtns.forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      currentFilter = this.dataset.filter;
      renderTasks();
      updateTaskCount(); // Update count on filter change
    });
  });

  clearCompletedBtn.addEventListener("click", clearCompletedTasks);
  themeToggle.addEventListener("click", toggleTheme);
  languageSelector.addEventListener("change", (e) => {
    const selectedLang = e.target.value;
    localStorage.setItem("language", selectedLang);
    loadTranslations(selectedLang);
    updateDate(selectedLang);
  });

  // Check for saved theme preference
  if (localStorage.getItem("darkMode") === "enabled") {
    document.body.classList.add("dark-mode");
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  }

  // --- I18N Functions ---
  async function loadTranslations(lang) {
    try {
      const response = await fetch(`./languages/${lang}.json`);
      if (!response.ok) {
        throw new Error(`Cannot load translation file: ${lang}.json`);
      }
      translations = await response.json();
      applyTranslations();
      renderTasks(); // Re-render tasks to apply potential language changes in empty state
      updateTaskCount();
    } catch (error) {
      console.error(error);
      // Fallback to English if the selected language fails to load
      if (lang !== "en") {
        loadTranslations("en");
      }
    }
  }

  function applyTranslations() {
    document.querySelectorAll("[data-i18n-key]").forEach((element) => {
      const key = element.getAttribute("data-i18n-key");
      if (translations[key]) {
        if (element.hasAttribute("placeholder")) {
          element.setAttribute("placeholder", translations[key]);
        } else {
          element.textContent = translations[key];
        }
      }
    });
  }

  // --- Core Functions ---
  function initializeApp() {
    const savedLang = localStorage.getItem("language") || "en";
    languageSelector.value = savedLang;
    loadTranslations(savedLang);
    updateDate(savedLang);
  }

  function updateDate(lang) {
    const locale = lang === 'th' ? 'th-TH' : 'en-US';
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    const today = new Date();
    currentDate.textContent = today.toLocaleDateString(locale, options);
  }

  function addTask() {
    const text = taskInput.value.trim();
    if (text === "") {
      showNotification(translations.notificationEnterTask, "warning");
      return;
    }

    const newTask = {
      id: Date.now(),
      text: text,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    tasks.unshift(newTask);
    saveTasks();
    renderTasks();
    taskInput.value = "";
    updateTaskCount();
    showNotification(translations.notificationTaskAdded, "success");
    animateAddTask(newTask.id);
  }

  function renderTasks() {
    taskList.innerHTML = "";
    let filteredTasks = getFilteredTasks();

    if (filteredTasks.length === 0) {
      showEmptyState();
      return;
    }

    filteredTasks.forEach((task) => {
      const taskElement = document.createElement("div");
      taskElement.className = `task ${task.completed ? "completed" : ""}`;
      taskElement.dataset.id = task.id;

      taskElement.innerHTML = `
          <div class="task-check">
              <i class="fas fa-check"></i>
          </div>
          <div class="task-text">${task.text}</div>
          <div class="task-actions">
              <button class="task-btn edit"><i class="fas fa-edit"></i></button>
              <button class="task-btn delete"><i class="fas fa-trash"></i></button>
          </div>
      `;

      taskList.appendChild(taskElement);

      taskElement
        .querySelector(".task-check")
        .addEventListener("click", () => toggleTaskComplete(task.id));
      taskElement
        .querySelector(".edit")
        .addEventListener("click", () => editTask(task.id));
      taskElement
        .querySelector(".delete")
        .addEventListener("click", () => deleteTask(task.id));
    });
  }
  
  function getFilteredTasks() {
    switch (currentFilter) {
      case "active":
        return tasks.filter((task) => !task.completed);
      case "completed":
        return tasks.filter((task) => task.completed);
      default:
        return [...tasks];
    }
  }

  function toggleTaskComplete(id) {
    const taskIndex = tasks.findIndex((task) => task.id == id);
    if (taskIndex === -1) return;

    tasks[taskIndex].completed = !tasks[taskIndex].completed;
    saveTasks();
    renderTasks();
    updateTaskCount();

    if (tasks[taskIndex].completed) {
      showNotification(translations.notificationTaskCompleted, "success");
      createConfetti();
    }
  }

  function editTask(id) {
    const task = tasks.find((task) => task.id == id);
    if (!task) return;

    const taskElement = document.querySelector(`.task[data-id="${id}"]`);
    const taskTextElement = taskElement.querySelector(".task-text");
    const currentText = task.text;
    const input = document.createElement("input");
    input.type = "text";
    input.value = currentText;
    input.className = "edit-input";
    input.style.cssText = `flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; outline: none;`;

    taskTextElement.innerHTML = "";
    taskTextElement.appendChild(input);
    input.focus();

    function saveEdit() {
      const newText = input.value.trim();
      if (newText === "") {
        deleteTask(id);
        return;
      }
      task.text = newText;
      saveTasks();
      renderTasks();
      showNotification(translations.notificationTaskUpdated, "info");
    }

    input.addEventListener("blur", saveEdit);
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") saveEdit();
    });
  }

  function deleteTask(id) {
    tasks = tasks.filter((task) => task.id != id);
    saveTasks();
    renderTasks();
    updateTaskCount();
    showNotification(translations.notificationTaskDeleted, "danger");
  }

  function clearCompletedTasks() {
    if (!tasks.some((task) => task.completed)) {
      showNotification(translations.notificationNoCompleted, "warning");
      return;
    }
    tasks = tasks.filter((task) => !task.completed);
    saveTasks();
    renderTasks();
    updateTaskCount();
    showNotification(translations.notificationCleared, "info");
  }

  function addSampleTasks() {
    const sampleTasks = [
      { id: Date.now(), text: "Complete project presentation", completed: false },
      { id: Date.now() + 1, text: "Buy groceries", completed: false },
    ];
    tasks = [...sampleTasks, ...tasks];
    saveTasks();
    renderTasks();
    updateTaskCount();
    showNotification(translations.notificationTaskAdded, "success"); // You might want a specific translation for this
  }

  function showEmptyState() {
    const filteredTasks = getFilteredTasks();
    if (filteredTasks.length > 0) return;

    let message = "";
    let buttonVisible = false;

    if (tasks.length === 0) {
      message = `${translations.emptyStateNoTasks}<br>${translations.emptyStateHelper}`;
      buttonVisible = true;
    } else if (currentFilter === "active") {
      message = "No active tasks<br>You've completed everything!"; // Can add to JSON
    } else if (currentFilter === "completed") {
      message = "No completed tasks yet<br>Keep going!"; // Can add to JSON
    }
    
    emptyState.innerHTML = `
        <i class="fas fa-tasks"></i>
        <p>${message.split("<br>")[0]}</p>
        <p>${message.split("<br>")[1]}</p>
        ${
          buttonVisible
            ? `<button id="addSampleTaskBtn">${translations.addSampleTask}</button>`
            : ""
        }
    `;
    taskList.innerHTML = "";
    taskList.appendChild(emptyState);

    const sampleBtn = document.getElementById("addSampleTaskBtn");
    if (sampleBtn) {
      sampleBtn.addEventListener("click", addSampleTasks);
    }
  }

  function updateTaskCount() {
    if (!translations.taskCountAll) return; // Wait for translations to load
    const activeTasks = tasks.filter((task) => !task.completed).length;
    const totalTasks = tasks.length;

    if (currentFilter === "all") {
      taskCount.textContent = translations.taskCountAll
        .replace("{active}", activeTasks)
        .replace("{total}", totalTasks);
    } else if (currentFilter === "active") {
      taskCount.textContent = translations.taskCountActive.replace("{count}", activeTasks);
    } else {
      const completedTasks = tasks.filter((task) => task.completed).length;
      taskCount.textContent = translations.taskCountCompleted.replace("{count}", completedTasks);
    }
  }

  function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }

  function showNotification(message, type) {
    notificationText.textContent = message;
    notification.className = "notification";
    notification.style.backgroundColor = `var(--${type})`;
    notification.classList.add("show");
    setTimeout(() => {
      notification.classList.remove("show");
    }, 3000);
  }

  function animateAddTask(id) {
    const taskElement = document.querySelector(`.task[data-id="${id}"]`);
    if (taskElement) {
      taskElement.style.transform = "scale(0.9)";
      taskElement.style.opacity = "0";
      setTimeout(() => {
        taskElement.style.transition = "all 0.3s ease";
        taskElement.style.transform = "scale(1)";
        taskElement.style.opacity = "1";
      }, 10);
    }
  }

  function createConfetti() {
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement("div");
      confetti.className = "confetti";
      const size = Math.random() * 10 + 5;
      const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
      const left = Math.random() * 100;
      const animationDuration = Math.random() * 3 + 2;
      confetti.style.cssText = `width: ${size}px; height: ${size}px; background-color: ${color}; left: ${left}%; animation-duration: ${animationDuration}s;`;
      document.body.appendChild(confetti);
      setTimeout(() => confetti.remove(), animationDuration * 1000);
    }
  }

  function toggleTheme() {
    document.body.classList.toggle("dark-mode");
    if (document.body.classList.contains("dark-mode")) {
      localStorage.setItem("darkMode", "enabled");
      themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
      localStorage.setItem("darkMode", "disabled");
      themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
  }
});