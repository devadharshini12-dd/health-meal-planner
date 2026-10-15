
const $ = id => document.getElementById(id);
const today = () => new Date().toLocaleDateString("en-CA");
const read = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

let currentUser = null;
let toastTimer;

function showMessage(id, message, type = "error") {
  const el = $(id);
  el.textContent = message;
  el.className = "message " + type;
}

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2600);
}

function showAuth(mode) {
  $("authPage").hidden = false;
  $("appPage").hidden = true;
  $("registerForm").hidden = mode !== "register";
  $("loginForm").hidden = mode !== "login";
  $("registerMessage").textContent = "";
  $("loginMessage").textContent = "";
}

$("showLogin").addEventListener("click", () => showAuth("login"));
$("showRegister").addEventListener("click", () => showAuth("register"));

document.querySelectorAll(".eye").forEach(button => {
  button.addEventListener("click", () => {
    const input = $(button.dataset.target);
    input.type = input.type === "password" ? "text" : "password";
    button.textContent = input.type === "password" ? "Show" : "Hide";
  });
});

// Demo registration: localStorage is not secure authentication.
$("register").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("regName").value.trim();
  const email = $("regEmail").value.trim().toLowerCase();
  const password = $("regPassword").value;
  const confirm = $("confirmPassword").value;

  if (password.length < 6) {
    return showMessage("registerMessage", "Password must contain at least 6 characters.");
  }
  if (password !== confirm) {
    return showMessage("registerMessage", "Passwords do not match.");
  }

  const users = read("wn_users", []);
  if (users.some(user => user.email === email)) {
    return showMessage("registerMessage", "This email is already registered. Please log in.");
  }

  users.push({ name, email, password });
  write("wn_users", users);
  $("register").reset();

  showAuth("login");
  $("loginEmail").value = email;
  showMessage("loginMessage", "Account created! Please log in.", "success");
});

$("login").addEventListener("submit", event => {
  event.preventDefault();

  const email = $("loginEmail").value.trim().toLowerCase();
  const password = $("loginPassword").value;
  const users = read("wn_users", []);

  const user = users.find(item => item.email === email && item.password === password);
  if (!user) {
    return showMessage("loginMessage", "Incorrect email or password. Please try again.");
  }

  currentUser = user;
  sessionStorage.setItem("wn_session", user.email);
  $("login").reset();
  openApp();
});

function openApp() {
  $("authPage").hidden = true;
  $("appPage").hidden = false;
  $("userName").textContent = currentUser.name.split(" ")[0];
  $("welcomeTitle").textContent = `Welcome back, ${currentUser.name.split(" ")[0]}!`;
  $("todayDate").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric"
  });
  $("mealDate").value = today();
  showPage("dashboard");
  loadHealth();
  loadMeals();
}

function userKey(suffix) {
  return `wn_${currentUser.email}_${suffix}`;
}

function showPage(page) {
  ["dashboard", "health", "meals"].forEach(name => {
    $(`${name}Page`).hidden = name !== page;
  });

  document.querySelectorAll(".nav-item[data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  $("pageTitle").textContent = {
    dashboard: "Overview",
    health: "Health Monitor",
    meals: "Meal Planner"
  }[page];
}

document.querySelectorAll(".nav-item[data-page]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

document.querySelectorAll("[data-goto]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.goto));
});

$("logout").addEventListener("click", () => {
  sessionStorage.removeItem("wn_session");
  currentUser = null;
  showAuth("login");
  toast("You have logged out.");
});

$("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("wn_theme", document.body.classList.contains("dark") ? "dark" : "light");
});

if (localStorage.getItem("wn_theme") === "dark") {
  document.body.classList.add("dark");
}

function getHealth() {
  return read(userKey("health"), {});
}

function loadHealth() {
  const history = getHealth();
  const record = history[today()];
  $("statWeight").textContent = record ? record.weight : "—";
  $("statWater").textContent = record ? record.water : 0;
  $("statSleep").textContent = record ? record.sleep : "—";
  $("statMood").textContent = record ? record.mood.split(" ")[0] : "—";

  $("water").value = record ? record.water : 0;
  $("waterProgress").style.width = Math.min((record?.water || 0) / 8 * 100, 100) + "%";
  $("waterText").textContent = `${record?.water || 0} / 8 glasses`;
  $("waterPercent").textContent = Math.round(Math.min((record?.water || 0) / 8 * 100, 100)) + "%";

  $("historyBody").innerHTML = "";
  Object.entries(history).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7).forEach(([date, item]) => {
    const row = document.createElement("tr");
    [date, `${item.weight} kg`, `${item.water} glasses`, `${item.sleep} h`, item.mood].forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    $("historyBody").appendChild(row);
  });

  if (!Object.keys(history).length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No check-ins yet. Add your first health entry!";
    row.appendChild(cell);
    $("historyBody").appendChild(row);
  }
}

$("healthForm").addEventListener("submit", event => {
  event.preventDefault();
  const record = {
    weight: Number($("weight").value),
    water: Number($("water").value),
    sleep: Number($("sleep").value),
    mood: $("mood").value,
    notes: $("notes").value.trim()
  };

  if (record.weight <= 0 || record.water < 0 || record.sleep < 0 || record.sleep > 24) {
    return showMessage("healthMessage", "Please check your health values.");
  }

  const history = getHealth();
  history[today()] = record;
  write(userKey("health"), history);
  loadHealth();
  showMessage("healthMessage", "Your daily check-in has been saved.", "success");
  toast("Health record saved!");
});

$("addWater").addEventListener("click", () => {
  const history = getHealth();
  const record = history[today()] || {
    weight: 0, water: 0, sleep: 0, mood: "Not recorded", notes: ""
  };
  record.water = Math.min(Number(record.water || 0) + 1, 50);
  history[today()] = record;
  write(userKey("health"), history);
  loadHealth();
  toast("Water intake updated!");
});

function getMeals() {
  return read(userKey("meals"), {});
}

function loadMeals() {
  const plans = getMeals();
  const plan = plans[$("mealDate").value || today()] || {};
  ["breakfast", "lunch", "snacks", "dinner"].forEach(meal => {
    $(meal).value = plan[meal] || "";
  });

  $("mealSummary").innerHTML = "";
  const current = plans[today()] || {};
  ["breakfast", "lunch", "snacks", "dinner"].forEach(meal => {
    const line = document.createElement("p");
    const label = document.createElement("b");
    label.textContent = meal[0].toUpperCase() + meal.slice(1) + ": ";
    const value = document.createElement("span");
    value.textContent = current[meal] || "Not planned yet";
    line.append(label, value);
    $("mealSummary").appendChild(line);
  });
}

$("mealDate").addEventListener("change", loadMeals);

$("saveMeals").addEventListener("click", () => {
  const plans = getMeals();
  const date = $("mealDate").value || today();

  plans[date] = {};
  ["breakfast", "lunch", "snacks", "dinner"].forEach(meal => {
    plans[date][meal] = $(meal).value.trim();
  });

  write(userKey("meals"), plans);
  loadMeals();
  showMessage("mealMessage", "Meal plan saved successfully.", "success");
  toast("Your meal plan is saved!");
});

$("suggestMeals").addEventListener("click", () => {
  const ideas = {
    breakfast: "Oats with banana, or idli with sambar",
    lunch: "Rice or whole grains with dal and vegetables",
    snacks: "Seasonal fruit, yoghurt, or a small handful of nuts",
    dinner: "Chapati with vegetable curry and a protein source"
  };

  Object.entries(ideas).forEach(([meal, idea]) => {
    if (!$(meal).value.trim()) $(meal).value = idea;
  });
  toast("Suggestions added! Adjust them to your preferences.");
});

$("exportData").addEventListener("click", () => {
  const history = getHealth();
  const rows = [["Date", "Weight (kg)", "Water (glasses)", "Sleep (hours)", "Mood", "Notes"]];

  Object.entries(history).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, record]) => {
    rows.push([date, record.weight, record.water, record.sleep, record.mood, record.notes || ""]);
  });

  const csv = rows.map(row => row.map(value =>
    `"${String(value ?? "").replace(/"/g, '""')}"`
  ).join(",")).join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "wellnest-health-history.csv";
  link.click();
  URL.revokeObjectURL(url);
});

function restoreSession() {
  const email = sessionStorage.getItem("wn_session");
  if (!email) return showAuth(read("wn_users", []).length ? "login" : "register");

  currentUser = read("wn_users", []).find(user => user.email === email) || null;
  if (currentUser) openApp();
  else showAuth("login");
}

restoreSession();
