const STORAGE_KEY = "regionManagerApp.v1";
const CLOUD_TABLE = "region_app_state";
const CLOUD_CONFIG = window.REGION_APP_SUPABASE || {};
const hasCloudConfig = Boolean(
  window.supabase &&
    CLOUD_CONFIG.url &&
    CLOUD_CONFIG.anonKey &&
    !CLOUD_CONFIG.url.includes("YOUR_") &&
    !CLOUD_CONFIG.anonKey.includes("YOUR_"),
);
const supabaseClient = hasCloudConfig
  ? window.supabase.createClient(CLOUD_CONFIG.url, CLOUD_CONFIG.anonKey)
  : null;

const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const seedState = {
  members: [
    {
      id: crypto.randomUUID(),
      name: "김지역",
      role: "지역장",
      zone: "전체",
      dueDate: addDays(5),
      note: "월간 취합 담당",
    },
    {
      id: crypto.randomUUID(),
      name: "박구역",
      role: "구역장",
      zone: "1구역",
      dueDate: addDays(2),
      note: "신규 구역원 확인",
    },
    {
      id: crypto.randomUUID(),
      name: "이구역원",
      role: "구역원",
      zone: "1구역",
      dueDate: addDays(1),
      note: "보고 전날 연락",
    },
  ],
  messages: [
    {
      id: crypto.randomUUID(),
      title: "이번 주 전달사항",
      type: "전달",
      zone: "전체",
      body: "이번 주 보고는 토요일 저녁까지 구역장이 취합합니다.",
      createdAt: new Date().toISOString(),
    },
  ],
  reports: [
    {
      id: crypto.randomUUID(),
      memberId: "",
      memberName: "박구역",
      zone: "1구역",
      date: todayIso(),
      status: "완료",
      body: "1구역 보고 완료. 확인 필요 1건은 다음 방문 때 재확인 예정.",
      createdAt: new Date().toISOString(),
    },
  ],
};

let state = loadState();
let currentUser = null;
let syncTimer = null;
let isSavingCloud = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const formatDate = (iso) =>
  new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(
    new Date(`${iso}T00:00:00`),
  );

const daysUntil = (iso) => {
  const start = new Date(`${todayIso()}T00:00:00`);
  const end = new Date(`${iso}T00:00:00`);
  return Math.round((end - start) / 86400000);
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(seedState);
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return structuredClone(seedState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeState(value) {
  return {
    members: Array.isArray(value?.members) ? value.members : [],
    messages: Array.isArray(value?.messages) ? value.messages : [],
    reports: Array.isArray(value?.reports) ? value.reports : [],
  };
}

function persistState() {
  saveState();
  queueCloudSave();
}

function emptyNode(title, body) {
  const template = $("#emptyTemplate").content.cloneNode(true);
  template.querySelector("strong").textContent = title;
  template.querySelector("p").textContent = body;
  return template;
}

function roleChip(role) {
  if (role === "지역장" || role === "구역장") return "chip lead";
  return "chip";
}

function statusChip(status) {
  if (status === "확인 필요") return "chip warning";
  if (status === "미보고") return "chip danger";
  return "chip";
}

function render(options = {}) {
  renderDashboard();
  renderPeople();
  renderMessages();
  renderReports();
  renderReportSelect();
  if (options.persist !== false) persistState();
}

function renderDashboard() {
  $("#memberCount").textContent = state.members.length;

  const month = todayIso().slice(0, 7);
  $("#monthlyReportCount").textContent = state.reports.filter((report) =>
    report.date.startsWith(month),
  ).length;

  const dueMembers = [...state.members].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  $("#nextDueDate").textContent = dueMembers[0] ? formatDate(dueMembers[0].dueDate) : "-";

  const reminders = state.members
    .map((member) => ({ ...member, left: daysUntil(member.dueDate) }))
    .filter((member) => member.left <= 3)
    .sort((a, b) => a.left - b.left)
    .slice(0, 5);
  const reminderList = $("#reminderList");
  reminderList.innerHTML = "";
  if (!reminders.length) {
    reminderList.append(emptyNode("예정 알림이 없습니다", "3일 안에 마감되는 보고가 없습니다."));
  } else {
    reminders.forEach((member) => {
      const card = document.createElement("article");
      card.className = "reminder-card";
      const label =
        member.left < 0 ? `${Math.abs(member.left)}일 지남` : member.left === 0 ? "오늘" : `${member.left}일 전`;
      card.innerHTML = `<strong>${member.name} · ${member.zone}</strong><p>${formatDate(member.dueDate)} 보고 예정 · ${label}</p>`;
      reminderList.append(card);
    });
  }

  const recent = [...state.messages]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  renderMessageCards($("#recentMessages"), recent, false);

  const zoneCounts = state.reports.reduce((acc, report) => {
    const zone = report.zone || "미지정";
    acc[zone] = (acc[zone] || 0) + 1;
    return acc;
  }, {});
  const max = Math.max(1, ...Object.values(zoneCounts));
  const bars = $("#analyticsBars");
  bars.innerHTML = "";
  Object.entries(zoneCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([zone, count]) => {
      const item = document.createElement("div");
      item.className = "bar-item";
      item.innerHTML = `<span>${zone}</span><div class="bar-track"><div class="bar-fill" style="width:${(count / max) * 100}%"></div></div><strong>${count}</strong>`;
      bars.append(item);
    });
  if (!Object.keys(zoneCounts).length) {
    bars.append(emptyNode("통계가 없습니다", "보고를 저장하면 구역별 집계가 표시됩니다."));
  }
}

function renderPeople() {
  const query = $("#peopleSearch").value.trim().toLowerCase();
  const list = $("#peopleList");
  list.innerHTML = "";
  const members = state.members.filter((member) =>
    [member.name, member.role, member.zone, member.note].join(" ").toLowerCase().includes(query),
  );

  if (!members.length) {
    list.append(emptyNode("구역원이 없습니다", "조직 편성에서 구역원을 추가하세요."));
    return;
  }

  members.forEach((member) => {
    const card = document.createElement("article");
    card.className = "person-card";
    card.innerHTML = `
      <div class="row">
        <h3>${member.name}</h3>
        <button class="delete-button" type="button" aria-label="${member.name} 삭제" data-delete-member="${member.id}">×</button>
      </div>
      <div class="chip-row">
        <span class="${roleChip(member.role)}">${member.role}</span>
        <span class="chip">${member.zone}</span>
        <span class="${daysUntil(member.dueDate) <= 1 ? "chip danger" : "chip"}">${formatDate(member.dueDate)}</span>
      </div>
      ${member.note ? `<p class="card-body">${escapeHtml(member.note)}</p>` : ""}
    `;
    list.append(card);
  });
}

function renderMessages() {
  const query = $("#messageSearch").value.trim().toLowerCase();
  const type = $("#messageTypeFilter").value;
  const messages = state.messages
    .filter((message) => !type || message.type === type)
    .filter((message) =>
      [message.title, message.type, message.zone, message.body].join(" ").toLowerCase().includes(query),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  renderMessageCards($("#messageList"), messages, true);
}

function renderMessageCards(container, messages, showDelete) {
  container.innerHTML = "";
  if (!messages.length) {
    container.append(emptyNode("저장된 내용이 없습니다", "Signal 내용을 붙여넣어 보관하세요."));
    return;
  }
  messages.forEach((message) => {
    const card = document.createElement("article");
    card.className = "message-card";
    const date = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(
      new Date(message.createdAt),
    );
    card.innerHTML = `
      <div class="row">
        <h3>${escapeHtml(message.title)}</h3>
        ${showDelete ? `<button class="delete-button" type="button" aria-label="내용 삭제" data-delete-message="${message.id}">×</button>` : ""}
      </div>
      <div class="chip-row">
        <span class="chip lead">${message.type}</span>
        <span class="chip">${escapeHtml(message.zone || "전체")}</span>
        <span class="chip">${date}</span>
      </div>
      <p class="card-body">${escapeHtml(message.body)}</p>
    `;
    container.append(card);
  });
}

function renderReportSelect() {
  const select = $("#reportMemberSelect");
  const current = select.value;
  select.innerHTML = "";
  state.members.forEach((member) => {
    const option = document.createElement("option");
    option.value = member.id;
    option.textContent = `${member.name} · ${member.zone}`;
    select.append(option);
  });
  if (current) select.value = current;
}

function renderReports() {
  const query = $("#reportSearch").value.trim().toLowerCase();
  const status = $("#reportStatusFilter").value;
  const list = $("#reportList");
  list.innerHTML = "";
  const reports = state.reports
    .filter((report) => !status || report.status === status)
    .filter((report) =>
      [report.memberName, report.zone, report.status, report.body, report.date]
        .join(" ")
        .toLowerCase()
        .includes(query),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!reports.length) {
    list.append(emptyNode("보고 내역이 없습니다", "보고를 저장하면 나중에 조회할 수 있습니다."));
    return;
  }

  reports.forEach((report) => {
    const card = document.createElement("article");
    card.className = "report-card";
    card.innerHTML = `
      <div class="row">
        <h3>${escapeHtml(report.memberName)}</h3>
        <button class="delete-button" type="button" aria-label="보고 삭제" data-delete-report="${report.id}">×</button>
      </div>
      <div class="chip-row">
        <span class="${statusChip(report.status)}">${report.status}</span>
        <span class="chip">${escapeHtml(report.zone)}</span>
        <span class="chip">${formatDate(report.date)}</span>
      </div>
      <p class="card-body">${escapeHtml(report.body)}</p>
    `;
    list.append(card);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openTab(tabName) {
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  $$(".view").forEach((view) => view.classList.remove("active"));
  $(`#${tabName}View`).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function makeCalendar() {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Region Manager//Reports//KO",
  ];
  state.members.forEach((member) => {
    const date = member.dueDate.replaceAll("-", "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${member.id}@region-manager`,
      `DTSTAMP:${todayIso().replaceAll("-", "")}T000000Z`,
      `DTSTART;VALUE=DATE:${date}`,
      `SUMMARY:${member.name} 보고 예정`,
      `DESCRIPTION:${member.zone} ${member.role} 보고 확인`,
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${member.name} 보고일 전 알림`,
      "END:VALARM",
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  download("region-report-reminders.ics", lines.join("\r\n"), "text/calendar;charset=utf-8");
}

function setSyncStatus(message, tone = "") {
  const status = $("#syncStatus");
  if (!status) return;
  status.textContent = message;
  status.className = `sync-status ${tone}`.trim();
}

function setAuthUi() {
  const authForm = $("#authForm");
  const signedInActions = $("#signedInActions");
  const email = $("#signedInEmail");

  if (!hasCloudConfig) {
    authForm.hidden = false;
    signedInActions.hidden = true;
    setSyncStatus("Supabase 설정 전입니다. supabase-config.js에 URL과 anon key를 넣으세요.", "warning");
    return;
  }

  authForm.hidden = Boolean(currentUser);
  signedInActions.hidden = !currentUser;
  email.textContent = currentUser ? `${currentUser.email} 계정으로 동기화 중` : "";

  if (currentUser) {
    setSyncStatus("로그인됨. 이 계정으로 아이폰과 노트북 데이터가 동기화됩니다.", "good");
  } else {
    setSyncStatus("로그인하면 같은 계정의 기기끼리 데이터가 공유됩니다.", "warning");
  }
}

function queueCloudSave() {
  if (!supabaseClient || !currentUser || isSavingCloud) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(saveCloudState, 700);
}

async function saveCloudState() {
  if (!supabaseClient || !currentUser) return;
  isSavingCloud = true;
  setSyncStatus("클라우드에 저장 중", "warning");
  const { error } = await supabaseClient.from(CLOUD_TABLE).upsert({
    user_id: currentUser.id,
    payload: state,
    updated_at: new Date().toISOString(),
  });
  isSavingCloud = false;

  if (error) {
    setSyncStatus(`동기화 실패: ${error.message}`, "danger");
    return;
  }
  setSyncStatus("클라우드 저장 완료", "good");
}

async function loadCloudState() {
  if (!supabaseClient || !currentUser) return;
  setSyncStatus("클라우드 데이터 불러오는 중", "warning");
  const { data, error } = await supabaseClient
    .from(CLOUD_TABLE)
    .select("payload")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    setSyncStatus(`불러오기 실패: ${error.message}`, "danger");
    return;
  }

  if (data?.payload) {
    state = normalizeState(data.payload);
    saveState();
    render({ persist: false });
    setSyncStatus("클라우드 데이터 불러오기 완료", "good");
    return;
  }

  await saveCloudState();
}

async function signInWithPassword(email, password) {
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) setSyncStatus(`로그인 실패: ${error.message}`, "danger");
}

async function signUpWithPassword(email, password) {
  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    setSyncStatus(`가입 실패: ${error.message}`, "danger");
    return;
  }
  setSyncStatus("가입 요청 완료. 이메일 확인이 필요할 수 있습니다.", "good");
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    setSyncStatus(`로그아웃 실패: ${error.message}`, "danger");
    return;
  }
  currentUser = null;
  setAuthUi();
}

async function initCloudSync() {
  setAuthUi();
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    setSyncStatus(`세션 확인 실패: ${error.message}`, "danger");
    return;
  }

  currentUser = data.session?.user || null;
  setAuthUi();
  if (currentUser) await loadCloudState();

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    setAuthUi();
    if (currentUser) await loadCloudState();
  });
}

function bindEvents() {
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => openTab(tab.dataset.tab)));
  $$("[data-open-tab]").forEach((button) =>
    button.addEventListener("click", () => openTab(button.dataset.openTab)),
  );

  $("#memberForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    state.members.push({ id: crypto.randomUUID(), ...data });
    event.currentTarget.reset();
    render();
  });

  $("#messageForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    state.messages.push({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      zone: data.zone || "전체",
      ...data,
    });
    event.currentTarget.reset();
    render();
  });

  $("#reportForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const member = state.members.find((item) => item.id === data.memberId);
    state.reports.push({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      memberName: member?.name || "미지정",
      zone: member?.zone || "미지정",
      ...data,
    });
    event.currentTarget.reset();
    event.currentTarget.date.value = todayIso();
    render();
  });

  ["peopleSearch", "messageSearch", "messageTypeFilter", "reportSearch", "reportStatusFilter"].forEach((id) => {
    $(`#${id}`).addEventListener("input", render);
  });

  document.addEventListener("click", (event) => {
    const memberId = event.target.dataset.deleteMember;
    const messageId = event.target.dataset.deleteMessage;
    const reportId = event.target.dataset.deleteReport;
    if (memberId) state.members = state.members.filter((member) => member.id !== memberId);
    if (messageId) state.messages = state.messages.filter((message) => message.id !== messageId);
    if (reportId) state.reports = state.reports.filter((report) => report.id !== reportId);
    if (memberId || messageId || reportId) render();
  });

  $("#exportData").addEventListener("click", () => {
    download(`region-manager-${todayIso()}.json`, JSON.stringify(state, null, 2), "application/json");
  });

  $("#makeCalendar").addEventListener("click", makeCalendar);

  $("#authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabaseClient) {
      setSyncStatus("Supabase 설정이 아직 없습니다.", "warning");
      return;
    }
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await signInWithPassword(data.email, data.password);
  });

  $("#signUpButton").addEventListener("click", async () => {
    if (!supabaseClient) {
      setSyncStatus("Supabase 설정이 아직 없습니다.", "warning");
      return;
    }
    const data = Object.fromEntries(new FormData($("#authForm")));
    if (!data.email || !data.password) {
      setSyncStatus("이메일과 비밀번호를 입력하세요.", "warning");
      return;
    }
    await signUpWithPassword(data.email, data.password);
  });

  $("#signOutButton").addEventListener("click", signOut);
  $("#syncNow").addEventListener("click", async () => {
    if (!supabaseClient) {
      setSyncStatus("Supabase 설정이 아직 없습니다.", "warning");
      return;
    }
    if (!currentUser) {
      setSyncStatus("먼저 로그인하세요.", "warning");
      return;
    }
    await loadCloudState();
  });

  $("#uploadLocalData").addEventListener("click", async () => {
    if (!currentUser) {
      setSyncStatus("먼저 로그인하세요.", "warning");
      return;
    }
    await saveCloudState();
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

$("#memberForm").dueDate.value = addDays(7);
$("#reportForm").date.value = todayIso();
bindEvents();
render();
initCloudSync();
