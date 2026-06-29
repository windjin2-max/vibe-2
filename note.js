const NOTE_STORAGE_KEY = "pastelTodoCalendar.classNotes.v1";

const noteDate = document.getElementById("noteDate");
const noteClass = document.getElementById("noteClass");
const noteTitle = document.getElementById("noteTitle");
const noteContent = document.getElementById("noteContent");
const saveNoteBtn = document.getElementById("saveNoteBtn");
const clearNoteBtn = document.getElementById("clearNoteBtn");
const noteList = document.getElementById("noteList");
const noteStatus = document.getElementById("noteStatus");

let classNotes = loadClassNotes();
let editingNoteId = "";

function loadClassNotes() {
  try {
    return JSON.parse(localStorage.getItem(NOTE_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveClassNotes() {
  localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(classNotes));
}

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function createNoteId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clearNoteForm() {
  editingNoteId = "";
  noteDate.value = todayKey();
  noteClass.value = "";
  noteTitle.value = "";
  noteContent.value = "";
  noteStatus.textContent = "새 필기를 작성할 수 있습니다.";
}

function renderClassNotes() {
  noteList.innerHTML = "";

  if (!classNotes.length) {
    noteList.innerHTML = `<div class="empty">아직 저장된 수업 필기가 없습니다.</div>`;
    return;
  }

  const sortedNotes = [...classNotes].sort((a, b) => {
    if (a.date === b.date) return b.updatedAt.localeCompare(a.updatedAt);
    return b.date.localeCompare(a.date);
  });

  sortedNotes.forEach(note => {
    const item = document.createElement("div");
    item.className = "todo-item";
    item.style.gridTemplateColumns = "1fr auto";
    item.innerHTML = `
      <div>
        <div class="todo-text"><strong></strong></div>
        <div class="hint"></div>
      </div>
      <button class="delete-btn" type="button">삭제</button>
    `;

    item.querySelector("strong").textContent = note.title || "제목 없음";
    item.querySelector(".hint").textContent = `${note.date} · ${note.className || "수업명 없음"}`;

    item.querySelector(".todo-text").addEventListener("click", () => openNote(note.id));
    item.querySelector(".hint").addEventListener("click", () => openNote(note.id));
    item.querySelector("button").addEventListener("click", () => deleteNote(note.id));

    noteList.appendChild(item);
  });
}

function openNote(id) {
  const note = classNotes.find(item => item.id === id);
  if (!note) return;

  editingNoteId = note.id;
  noteDate.value = note.date;
  noteClass.value = note.className;
  noteTitle.value = note.title;
  noteContent.value = note.content;
  noteStatus.textContent = "기존 필기를 불러왔습니다. 수정 후 저장할 수 있습니다.";
}

function saveNote() {
  const date = noteDate.value || todayKey();
  const className = noteClass.value.trim();
  const title = noteTitle.value.trim();
  const content = noteContent.value.trim();

  if (!className && !title && !content) {
    noteStatus.textContent = "저장할 필기 내용을 입력하세요.";
    return;
  }

  const now = new Date().toISOString();

  if (editingNoteId) {
    const note = classNotes.find(item => item.id === editingNoteId);
    if (note) {
      note.date = date;
      note.className = className;
      note.title = title || "제목 없음";
      note.content = content;
      note.updatedAt = now;
    }
    noteStatus.textContent = "필기를 수정했습니다.";
  } else {
    classNotes.push({
      id: createNoteId(),
      date,
      className,
      title: title || "제목 없음",
      content,
      createdAt: now,
      updatedAt: now
    });
    noteStatus.textContent = "새 필기를 저장했습니다.";
  }

  saveClassNotes();
  renderClassNotes();
  clearNoteForm();
}

function deleteNote(id) {
  const target = classNotes.find(note => note.id === id);
  if (!target) return;

  const ok = confirm(`"${target.title || "제목 없음"}" 필기를 삭제할까요?`);
  if (!ok) return;

  classNotes = classNotes.filter(note => note.id !== id);
  saveClassNotes();

  if (editingNoteId === id) clearNoteForm();
  renderClassNotes();
  noteStatus.textContent = "필기를 삭제했습니다.";
}

saveNoteBtn.addEventListener("click", saveNote);
clearNoteBtn.addEventListener("click", clearNoteForm);

[noteClass, noteTitle, noteContent].forEach(input => {
  input.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      saveNote();
    }
  });
});

clearNoteForm();
renderClassNotes();
