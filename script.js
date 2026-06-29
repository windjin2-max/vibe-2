const canvas = document.getElementById("calendarCanvas");
    const ctx = canvas.getContext("2d");
    const monthTitle = document.getElementById("monthTitle");
    const selectedDateEl = document.getElementById("selectedDate");
    const todoForm = document.getElementById("todoForm");
    const todoInput = document.getElementById("todoInput");
    const todoList = document.getElementById("todoList");
    const weekBtn = document.getElementById("weekBtn");
    const monthBtn = document.getElementById("monthBtn");
    const calendarTabBtn = document.getElementById("calendarTabBtn");
    const tableTabBtn = document.getElementById("tableTabBtn");
    const calendarPanel = document.getElementById("calendarPanel");
    const tablePanel = document.getElementById("tablePanel");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const periodTableBody = document.getElementById("periodTableBody");
    const tableRangeLabel = document.getElementById("tableRangeLabel");
    const exportStart = document.getElementById("exportStart");
    const exportEnd = document.getElementById("exportEnd");
    const downloadExcelBtn = document.getElementById("downloadExcelBtn");
    const excelUpload = document.getElementById("excelUpload");
    const excelStatus = document.getElementById("excelStatus");

    const totalCount = document.getElementById("totalCount");
    const doneCount = document.getElementById("doneCount");
    const leftCount = document.getElementById("leftCount");

    const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
    const STORAGE_KEY = "pastelTodoCalendar.todos.v2";

    let viewMode = "month";
    let displayMode = "calendar";
    let currentDate = new Date();
    let selectedDate = stripTime(new Date());
    let todos = loadTodos();
    let hitBoxes = [];

    function stripTime(date) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    function dateKey(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    function parseDateKey(key) {
      const [y, m, d] = key.split("-").map(Number);
      return new Date(y, m - 1, d);
    }

    function formatKoreanDate(date) {
      return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${DAY_NAMES[date.getDay()]})`;
    }

    function loadTodos() {
      try {
        const v2 = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (v2) return v2;
        const v1 = JSON.parse(localStorage.getItem("pastelTodoCalendar.todos.v1"));
        return v1 || {};
      } catch {
        return {};
      }
    }

    function saveTodos() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    }

    function getTodos(date) {
      return todos[dateKey(date)] || [];
    }

    function addTodo(text) {
      const key = dateKey(selectedDate);
      todos[key] = todos[key] || [];
      todos[key].push({ id: crypto.randomUUID(), text, done: false });
      saveTodos();
      renderAll();
    }

    function toggleTodo(id) {
      const list = getTodos(selectedDate);
      const item = list.find(todo => todo.id === id);
      if (item) item.done = !item.done;
      saveTodos();
      renderAll();
    }

    function deleteTodo(id) {
      const key = dateKey(selectedDate);
      todos[key] = getTodos(selectedDate).filter(todo => todo.id !== id);
      if (!todos[key].length) delete todos[key];
      saveTodos();
      renderAll();
    }

    function getVisibleDates() {
      const base = stripTime(currentDate);

      if (viewMode === "week") {
        const start = new Date(base);
        start.setDate(base.getDate() - base.getDay());
        return Array.from({ length: 7 }, (_, i) => {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          return d;
        });
      }

      const first = new Date(base.getFullYear(), base.getMonth(), 1);
      const start = new Date(first);
      start.setDate(first.getDate() - first.getDay());

      return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      });
    }

    function getDateRange(startKey, endKey) {
      const start = parseDateKey(startKey);
      const end = parseDateKey(endKey);
      const dates = [];
      const d = new Date(start);
      while (d <= end) {
        dates.push(new Date(d));
        d.setDate(d.getDate() + 1);
      }
      return dates;
    }

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function renderCalendar() {
      if (displayMode !== "calendar") return;
      resizeCanvas();
      hitBoxes = [];

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);

      const dates = getVisibleDates();
      const rows = viewMode === "week" ? 1 : 6;
      const cols = 7;
      const pad = 18;
      const headerH = 38;
      const gap = 8;
      const cellW = (width - pad * 2 - gap * (cols - 1)) / cols;
      const cellH = (height - pad * 2 - headerH - gap * (rows - 1)) / rows;

      ctx.font = "700 14px Pretendard, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      DAY_NAMES.forEach((day, i) => {
        ctx.fillStyle = i === 0 ? "#be7a43" : "#7b682e";
        ctx.fillText(day, pad + cellW * i + gap * i + cellW / 2, pad + 16);
      });

      dates.forEach((date, i) => {
        const row = Math.floor(i / 7);
        const col = i % 7;
        const x = pad + col * (cellW + gap);
        const y = pad + headerH + row * (cellH + gap);
        const key = dateKey(date);
        const list = todos[key] || [];
        const done = list.filter(t => t.done).length;
        const isSelected = key === dateKey(selectedDate);
        const isToday = key === dateKey(new Date());
        const isOtherMonth = viewMode === "month" && date.getMonth() !== currentDate.getMonth();

        ctx.fillStyle = isSelected ? "#f7cf62" : "#fffdf2";
        roundRect(x, y, cellW, cellH, 18);
        ctx.fill();

        ctx.strokeStyle = isSelected ? "#d6a92e" : "#edd98b";
        ctx.lineWidth = isSelected ? 3 : 1;
        ctx.stroke();

        if (isToday) {
          ctx.fillStyle = "#fff2a3";
          roundRect(x + cellW - 44, y + 10, 34, 22, 11);
          ctx.fill();
          ctx.fillStyle = "#8e690d";
          ctx.font = "700 11px Pretendard, sans-serif";
          ctx.fillText("오늘", x + cellW - 27, y + 21);
        }

        ctx.textAlign = "left";
        ctx.fillStyle = isOtherMonth ? "#c5b984" : "#4b3b18";
        ctx.font = "900 22px Pretendard, sans-serif";
        ctx.fillText(String(date.getDate()), x + 16, y + 26);

        if (list.length) {
          ctx.font = "700 12px Pretendard, sans-serif";
          const preview = list.slice(0, viewMode === "week" ? 4 : 2);
          preview.forEach((todo, idx) => {
            const ty = y + 58 + idx * 22;
            ctx.fillStyle = todo.done ? "#b9a96c" : "#7f681f";
            ctx.fillText("• " + trimText(todo.text, cellW - 26), x + 14, ty);

            if (todo.done) {
              ctx.strokeStyle = "#b9a96c";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(x + 24, ty + 1);
              ctx.lineTo(x + cellW - 16, ty + 1);
              ctx.stroke();
            }
          });

          if (list.length > preview.length) {
            ctx.fillStyle = "#a67d12";
            ctx.font = "700 11px Pretendard, sans-serif";
            ctx.fillText(`+${list.length - preview.length}개 더`, x + 16, y + cellH - 16);
          }

          ctx.textAlign = "center";
          ctx.fillStyle = "#e2ae28";
          ctx.beginPath();
          ctx.arc(x + cellW - 18, y + cellH - 18, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "800 12px Pretendard, sans-serif";
          ctx.fillText(`${done}/${list.length}`, x + cellW - 18, y + cellH - 18);
        }

        hitBoxes.push({ x, y, w: cellW, h: cellH, date });
      });

      ctx.textAlign = "center";
    }

    function trimText(text, maxWidth) {
      let out = text;
      ctx.font = "700 12px Pretendard, sans-serif";
      while (ctx.measureText(out).width > maxWidth && out.length > 3) {
        out = out.slice(0, -2);
      }
      return out.length < text.length ? out + "…" : out;
    }

    function renderPeriodTable() {
      const dates = getVisibleDates();
      periodTableBody.innerHTML = "";
      tableRangeLabel.textContent = `${dateKey(dates[0])} ~ ${dateKey(dates[dates.length - 1])}`;

      dates.forEach(date => {
        const list = getTodos(date);
        const done = list.filter(t => t.done).length;
        const tr = document.createElement("tr");

        const todoHtml = list.length
          ? list.map(todo => `<span class="todo-chip ${todo.done ? "done" : ""}">${todo.done ? "완료" : "진행"} · ${escapeHtml(todo.text)}</span>`).join("")
          : "<span class='hint'>등록된 Todo 없음</span>";

        tr.innerHTML = `
          <td class="date-cell">${formatKoreanDate(date)}</td>
          <td>${list.length}</td>
          <td>${done}</td>
          <td>${list.length - done}</td>
          <td>${todoHtml}</td>
        `;
        tr.querySelector(".date-cell").addEventListener("click", () => {
          selectedDate = stripTime(date);
          currentDate = new Date(date);
          renderAll();
        });
        periodTableBody.appendChild(tr);
      });
    }

    function escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    function renderTodos() {
      selectedDateEl.textContent = formatKoreanDate(selectedDate);
      const list = getTodos(selectedDate);

      todoList.innerHTML = "";
      if (!list.length) {
        todoList.innerHTML = `<div class="empty">이 날짜에는 아직 Todo가 없습니다.</div>`;
      } else {
        list.forEach(todo => {
          const item = document.createElement("div");
          item.className = `todo-item ${todo.done ? "done" : ""}`;
          item.innerHTML = `
            <input type="checkbox" ${todo.done ? "checked" : ""} aria-label="완료 체크" />
            <div class="todo-text"></div>
            <button class="delete-btn" type="button">삭제</button>
          `;
          item.querySelector(".todo-text").textContent = todo.text;
          item.querySelector("input").addEventListener("change", () => toggleTodo(todo.id));
          item.querySelector("button").addEventListener("click", () => deleteTodo(todo.id));
          todoList.appendChild(item);
        });
      }

      totalCount.textContent = list.length;
      doneCount.textContent = list.filter(t => t.done).length;
      leftCount.textContent = list.filter(t => !t.done).length;
    }

    function renderTitle() {
      if (viewMode === "month") {
        monthTitle.textContent = `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`;
      } else {
        const week = getVisibleDates();
        monthTitle.textContent = `${formatKoreanDate(week[0])} ~ ${formatKoreanDate(week[6])}`;
      }
    }

    function syncExportDateInputs() {
      const visible = getVisibleDates();
      exportStart.value = dateKey(visible[0]);
      exportEnd.value = dateKey(visible[visible.length - 1]);
    }

    function renderAll() {
      renderTitle();
      renderCalendar();
      renderPeriodTable();
      renderTodos();
    }

    function setDisplayMode(mode) {
      displayMode = mode;
      calendarPanel.classList.toggle("panel-hidden", mode !== "calendar");
      tablePanel.classList.toggle("panel-hidden", mode !== "table");
      calendarTabBtn.classList.toggle("active", mode === "calendar");
      calendarTabBtn.classList.toggle("secondary", mode !== "calendar");
      tableTabBtn.classList.toggle("active", mode === "table");
      tableTabBtn.classList.toggle("secondary", mode !== "table");
      renderAll();
    }

    function exportExcel() {
      if (!window.XLSX) {
        excelStatus.textContent = "엑셀 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하세요.";
        return;
      }

      const startKey = exportStart.value;
      const endKey = exportEnd.value;
      if (!startKey || !endKey || startKey > endKey) {
        excelStatus.textContent = "시작일과 종료일을 올바르게 지정하세요.";
        return;
      }

      const rows = [];
      getDateRange(startKey, endKey).forEach(date => {
        const key = dateKey(date);
        const list = todos[key] || [];
        if (!list.length) {
          rows.push({ 날짜: key, 할일: "", 완료여부: "" });
        } else {
          list.forEach(todo => {
            rows.push({
              날짜: key,
              할일: todo.text,
              완료여부: todo.done ? "완료" : "미완료"
            });
          });
        }
      });

      const ws = XLSX.utils.json_to_sheet(rows, { header: ["날짜", "할일", "완료여부"] });
      ws["!cols"] = [{ wch: 14 }, { wch: 42 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Todo");
      XLSX.writeFile(wb, `todo_${startKey}_to_${endKey}.xlsx`);
      excelStatus.textContent = `${startKey} ~ ${endKey} 기간의 Todo를 다운로드했습니다.`;
    }

    function importExcel(file) {
      if (!window.XLSX) {
        excelStatus.textContent = "엑셀 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하세요.";
        return;
      }

      const reader = new FileReader();
      reader.onload = event => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

          const imported = {};
          let count = 0;

          rows.forEach(row => {
            const rawDate = row["날짜"] || row["date"] || row["Date"];
            const text = String(row["할일"] || row["todo"] || row["Todo"] || "").trim();
            const doneValue = String(row["완료여부"] || row["done"] || row["Done"] || "").trim();

            const key = normalizeDate(rawDate);
            if (!key || !text) return;

            imported[key] = imported[key] || [];
            imported[key].push({
              id: crypto.randomUUID(),
              text,
              done: ["완료", "done", "true", "yes", "y", "1"].includes(doneValue.toLowerCase())
            });
            count += 1;
          });

          todos = imported;
          saveTodos();
          excelStatus.textContent = `엑셀 업로드 완료: ${count}개의 Todo로 전체 데이터를 갱신했습니다.`;
          renderAll();
        } catch (error) {
          excelStatus.textContent = "엑셀을 읽는 중 오류가 발생했습니다. 컬럼명은 날짜, 할일, 완료여부를 사용하세요.";
        }
      };
      reader.readAsArrayBuffer(file);
    }

    function normalizeDate(value) {
      if (!value) return "";
      if (value instanceof Date && !Number.isNaN(value.getTime())) return dateKey(value);

      if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (!parsed) return "";
        return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
      }

      const text = String(value).trim().replace(/\./g, "-").replace(/\//g, "-");
      const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (!match) return "";
      return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    }

    canvas.addEventListener("click", event => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hit = hitBoxes.find(box => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h);
      if (hit) {
        selectedDate = stripTime(hit.date);
        currentDate = new Date(selectedDate);
        renderAll();
      }
    });

    todoForm.addEventListener("submit", event => {
      event.preventDefault();
      const text = todoInput.value.trim();
      if (!text) return;
      addTodo(text);
      todoInput.value = "";
      todoInput.focus();
    });

    weekBtn.addEventListener("click", () => {
      viewMode = "week";
      weekBtn.classList.add("active");
      weekBtn.classList.remove("secondary");
      monthBtn.classList.remove("active");
      monthBtn.classList.add("secondary");
      currentDate = new Date(selectedDate);
      syncExportDateInputs();
      renderAll();
    });

    monthBtn.addEventListener("click", () => {
      viewMode = "month";
      monthBtn.classList.add("active");
      monthBtn.classList.remove("secondary");
      weekBtn.classList.remove("active");
      weekBtn.classList.add("secondary");
      currentDate = new Date(selectedDate);
      syncExportDateInputs();
      renderAll();
    });

    calendarTabBtn.addEventListener("click", () => setDisplayMode("calendar"));
    tableTabBtn.addEventListener("click", () => setDisplayMode("table"));

    prevBtn.addEventListener("click", () => {
      if (viewMode === "week") {
        currentDate.setDate(currentDate.getDate() - 7);
        selectedDate = stripTime(currentDate);
      } else {
        currentDate.setMonth(currentDate.getMonth() - 1);
        selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      }
      syncExportDateInputs();
      renderAll();
    });

    nextBtn.addEventListener("click", () => {
      if (viewMode === "week") {
        currentDate.setDate(currentDate.getDate() + 7);
        selectedDate = stripTime(currentDate);
      } else {
        currentDate.setMonth(currentDate.getMonth() + 1);
        selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      }
      syncExportDateInputs();
      renderAll();
    });

    downloadExcelBtn.addEventListener("click", exportExcel);

    excelUpload.addEventListener("change", event => {
      const file = event.target.files[0];
      if (file) importExcel(file);
      event.target.value = "";
    });

    window.addEventListener("resize", renderAll);

    syncExportDateInputs();
    renderAll();