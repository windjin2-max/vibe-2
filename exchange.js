const EXCHANGE_STORAGE_KEY = "pastelTodoCalendar.exchangeApiKey.v1";
const EXCHANGE_CACHE_KEY = "pastelTodoCalendar.exchangeCache.v1";
const EXCHANGE_PROXY_STORAGE_KEY = "pastelTodoCalendar.exchangeProxyUrl.v1";
const EXCHANGE_API_URL = "https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON";
const EXCHANGE_DEFAULT_PROXY_URL = "https://api.allorigins.win/raw?url=";
const EXCHANGE_CODES = ["USD", "JPY", "CNH", "EUR"];
const EXCHANGE_LABELS = {
  KRW: "KRW 원화",
  USD: "USD 달러",
  JPY: "JPY 엔화",
  CNH: "CNH 위안화",
  EUR: "EUR 유로"
};

const exchangeApiKey = document.getElementById("exchangeApiKey");
const saveExchangeKeyBtn = document.getElementById("saveExchangeKeyBtn");
const clearExchangeKeyBtn = document.getElementById("clearExchangeKeyBtn");
const exchangeProxyUrl = document.getElementById("exchangeProxyUrl");
const saveExchangeProxyBtn = document.getElementById("saveExchangeProxyBtn");
const resetExchangeProxyBtn = document.getElementById("resetExchangeProxyBtn");
const exchangeAmount = document.getElementById("exchangeAmount");
const exchangeFromCurrency = document.getElementById("exchangeFromCurrency");
const exchangeToCurrency = document.getElementById("exchangeToCurrency");
const exchangeDateA = document.getElementById("exchangeDateA");
const exchangeDateB = document.getElementById("exchangeDateB");
const calculateExchangeBtn = document.getElementById("calculateExchangeBtn");
const swapExchangeBtn = document.getElementById("swapExchangeBtn");
const exchangeStatus = document.getElementById("exchangeStatus");
const exchangeResultA = document.getElementById("exchangeResultA");
const exchangeResultB = document.getElementById("exchangeResultB");
const exchangeDiffResult = document.getElementById("exchangeDiffResult");
const exchangeTableBody = document.getElementById("exchangeTableBody");

let exchangeCache = loadExchangeCache();

function loadExchangeCache() {
  try {
    return JSON.parse(localStorage.getItem(EXCHANGE_CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveExchangeCache() {
  localStorage.setItem(EXCHANGE_CACHE_KEY, JSON.stringify(exchangeCache));
}

function initExchangeCalculator() {
  const savedKey = localStorage.getItem(EXCHANGE_STORAGE_KEY) || "";
  const savedProxyUrl = localStorage.getItem(EXCHANGE_PROXY_STORAGE_KEY) || EXCHANGE_DEFAULT_PROXY_URL;
  exchangeApiKey.value = savedKey;
  if (exchangeProxyUrl) exchangeProxyUrl.value = savedProxyUrl;
  exchangeDateA.value = offsetDateKey(-1);
  exchangeDateB.value = todayExchangeKey();
  renderEmptyExchangeTable();
}

function todayExchangeKey() {
  const now = new Date();
  return formatDateInput(now);
}

function offsetDateKey(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return formatDateInput(date);
}

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toApiDate(dateKey) {
  return String(dateKey || "").replace(/-/g, "");
}

function fromApiDate(apiDate) {
  const text = String(apiDate || "");
  if (!/^\d{8}$/.test(text)) return apiDate || "-";
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

function previousDateKey(dateKey, daysBack) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() - daysBack);
  return formatDateInput(date);
}

function parseRate(value) {
  const numeric = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeCurrencyUnit(unit) {
  const text = String(unit || "").toUpperCase();
  if (text.includes("USD")) return "USD";
  if (text.includes("JPY")) return "JPY";
  if (text.includes("CNH") || text.includes("CNY")) return "CNH";
  if (text.includes("EUR")) return "EUR";
  return text;
}

function normalizeRatePerOne(unit, rawRate) {
  if (rawRate == null) return null;
  const text = String(unit || "").toUpperCase();
  if (text.includes("JPY(100)")) return rawRate / 100;
  return rawRate;
}

function buildRates(rows, requestedDate, actualDate) {
  const rates = {
    KRW: 1,
    requestedDate,
    actualDate,
    raw: rows
  };

  rows.forEach(row => {
    const code = normalizeCurrencyUnit(row.cur_unit);
    if (!EXCHANGE_CODES.includes(code)) return;
    const rawRate = parseRate(row.deal_bas_r);
    rates[code] = normalizeRatePerOne(row.cur_unit, rawRate);
  });

  return rates;
}

function buildExchangeUrl(apiKey, apiDate) {
  return `${EXCHANGE_API_URL}?authkey=${encodeURIComponent(apiKey)}&searchdate=${apiDate}&data=AP01`;
}

function getProxyUrl() {
  const value = exchangeProxyUrl?.value?.trim() || EXCHANGE_DEFAULT_PROXY_URL;
  return value.endsWith("=") || value.endsWith("/") ? value : `${value}${value.includes("?") ? "&url=" : "?url="}`;
}

async function fetchJsonDirect(url) {
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error(`한국수출입은행 API 응답 오류 (${response.status})`);
  return response.json();
}

async function fetchJsonViaProxy(url) {
  const proxyUrl = getProxyUrl();
  const response = await fetch(`${proxyUrl}${encodeURIComponent(url)}`, { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error(`CORS 프록시 응답 오류 (${response.status})`);
  return response.json();
}

async function fetchExchangeJson(url) {
  try {
    return await fetchJsonDirect(url);
  } catch (directError) {
    console.warn("직접 호출 실패, CORS 프록시로 재시도합니다.", directError);
    exchangeStatus.textContent = "브라우저 직접 호출이 차단되어 CORS 프록시로 다시 불러오는 중입니다.";
    try {
      return await fetchJsonViaProxy(url);
    } catch (proxyError) {
      throw new Error(
        "환율 API 호출에 실패했습니다. GitHub Pages 같은 정적 사이트에서는 한국수출입은행 API가 CORS로 차단될 수 있으므로, CORS 프록시 URL을 확인하거나 서버리스 프록시를 사용하세요."
      );
    }
  }
}

async function fetchExchangeByDate(apiKey, dateKey) {
  const apiDate = toApiDate(dateKey);
  if (exchangeCache[apiDate]) return exchangeCache[apiDate];

  const url = buildExchangeUrl(apiKey, apiDate);
  const json = await fetchExchangeJson(url);
  if (!Array.isArray(json)) {
    throw new Error("API 응답 형식이 올바르지 않습니다.");
  }

  const resultCode = json[0]?.result == null ? 1 : Number(json[0].result);
  if (resultCode && resultCode !== 1) {
    const messages = {
      2: "DATA 코드 오류입니다.",
      3: "인증코드가 유효하지 않습니다.",
      4: "일일 제한 횟수를 초과했습니다."
    };
    throw new Error(messages[resultCode] || `API 오류 코드: ${resultCode}`);
  }

  if (!json.length) {
    return null;
  }

  const rates = buildRates(json, dateKey, dateKey);
  exchangeCache[apiDate] = rates;
  saveExchangeCache();
  return rates;
}

async function fetchExchangeWithFallback(apiKey, dateKey) {
  for (let i = 0; i <= 10; i += 1) {
    const candidateDate = previousDateKey(dateKey, i);
    const rates = await fetchExchangeByDate(apiKey, candidateDate);
    if (rates && hasRequiredExchangeRates(rates)) {
      rates.requestedDate = dateKey;
      rates.actualDate = candidateDate;
      return rates;
    }
  }
  throw new Error(`${dateKey} 기준 환율 데이터가 없습니다. 주말/공휴일이면 이전 영업일 데이터도 찾지 못했습니다.`);
}

function hasRequiredExchangeRates(rates) {
  return EXCHANGE_CODES.every(code => typeof rates[code] === "number");
}

function convertCurrency(amount, fromCurrency, toCurrency, rates) {
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (typeof fromRate !== "number" || typeof toRate !== "number") {
    throw new Error("선택한 통화의 환율을 찾을 수 없습니다.");
  }
  const amountInKrw = amount * fromRate;
  return amountInKrw / toRate;
}

function formatMoney(value, currency) {
  if (!Number.isFinite(value)) return "-";
  const fractionDigits = currency === "KRW" ? 0 : 2;
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: fractionDigits, minimumFractionDigits: fractionDigits })} ${currency}`;
}

function formatRate(value, currency) {
  if (typeof value !== "number") return "-";
  const display = currency === "JPY" ? value.toFixed(2) : value.toFixed(2);
  return `${display}원`;
}

function renderEmptyExchangeTable() {
  exchangeTableBody.innerHTML = `
    <tr>
      <td colspan="7"><span class="hint">환율 계산을 실행하면 날짜별 환율 비교표가 표시됩니다.</span></td>
    </tr>
  `;
}

function renderExchangeResults(rateA, rateB, resultA, resultB) {
  const amount = Number(exchangeAmount.value || 0);
  const fromCurrency = exchangeFromCurrency.value;
  const toCurrency = exchangeToCurrency.value;
  const diff = resultB - resultA;
  const diffPercent = resultA ? (diff / resultA) * 100 : 0;

  exchangeResultA.textContent = formatMoney(resultA, toCurrency);
  exchangeResultB.textContent = formatMoney(resultB, toCurrency);
  exchangeDiffResult.textContent = `${diff >= 0 ? "+" : ""}${formatMoney(diff, toCurrency)} (${diffPercent >= 0 ? "+" : ""}${diffPercent.toFixed(2)}%)`;

  const rows = [
    { rates: rateA, result: resultA },
    { rates: rateB, result: resultB }
  ];

  exchangeTableBody.innerHTML = "";
  rows.forEach(item => {
    const tr = document.createElement("tr");
    const fallbackText = item.rates.requestedDate === item.rates.actualDate
      ? item.rates.actualDate
      : `${item.rates.actualDate} (이전 영업일)`;

    tr.innerHTML = `
      <td>${item.rates.requestedDate}</td>
      <td>${fallbackText}</td>
      <td>${formatRate(item.rates.USD, "USD")}</td>
      <td>${formatRate(item.rates.JPY, "JPY")}</td>
      <td>${formatRate(item.rates.CNH, "CNH")}</td>
      <td>${formatRate(item.rates.EUR, "EUR")}</td>
      <td><strong>${formatMoney(amount, fromCurrency)} → ${formatMoney(item.result, toCurrency)}</strong></td>
    `;
    exchangeTableBody.appendChild(tr);
  });
}

async function calculateExchange() {
  const apiKey = exchangeApiKey.value.trim();
  const amount = Number(exchangeAmount.value);
  const fromCurrency = exchangeFromCurrency.value;
  const toCurrency = exchangeToCurrency.value;
  const dateA = exchangeDateA.value;
  const dateB = exchangeDateB.value;

  if (!apiKey) {
    exchangeStatus.textContent = "한국수출입은행 API KEY를 입력하세요.";
    return;
  }
  if (!dateA || !dateB) {
    exchangeStatus.textContent = "비교할 날짜 2개를 선택하세요.";
    return;
  }
  if (!Number.isFinite(amount) || amount < 0) {
    exchangeStatus.textContent = "계산할 금액을 올바르게 입력하세요.";
    return;
  }

  calculateExchangeBtn.disabled = true;
  exchangeStatus.textContent = "한국수출입은행 환율 데이터를 불러오는 중입니다.";

  try {
    const [rateA, rateB] = await Promise.all([
      fetchExchangeWithFallback(apiKey, dateA),
      fetchExchangeWithFallback(apiKey, dateB)
    ]);

    const resultA = convertCurrency(amount, fromCurrency, toCurrency, rateA);
    const resultB = convertCurrency(amount, fromCurrency, toCurrency, rateB);
    renderExchangeResults(rateA, rateB, resultA, resultB);

    const fallbackNotice = [rateA, rateB].some(rate => rate.requestedDate !== rate.actualDate)
      ? " 선택 날짜가 휴일인 경우 이전 영업일 환율을 사용했습니다."
      : "";
    exchangeStatus.textContent = `계산 완료: ${EXCHANGE_LABELS[fromCurrency]} → ${EXCHANGE_LABELS[toCurrency]}.${fallbackNotice}`;
  } catch (error) {
    exchangeStatus.textContent = error.message || "환율 계산 중 오류가 발생했습니다.";
  } finally {
    calculateExchangeBtn.disabled = false;
  }
}

saveExchangeKeyBtn.addEventListener("click", () => {
  const key = exchangeApiKey.value.trim();
  if (!key) {
    exchangeStatus.textContent = "저장할 API KEY를 입력하세요.";
    return;
  }
  localStorage.setItem(EXCHANGE_STORAGE_KEY, key);
  exchangeStatus.textContent = "API KEY를 이 브라우저에 저장했습니다.";
});

clearExchangeKeyBtn.addEventListener("click", () => {
  localStorage.removeItem(EXCHANGE_STORAGE_KEY);
  exchangeApiKey.value = "";
  exchangeStatus.textContent = "저장된 API KEY를 삭제했습니다.";
});


if (saveExchangeProxyBtn) {
  saveExchangeProxyBtn.addEventListener("click", () => {
    const proxyUrl = exchangeProxyUrl.value.trim() || EXCHANGE_DEFAULT_PROXY_URL;
    localStorage.setItem(EXCHANGE_PROXY_STORAGE_KEY, proxyUrl);
    exchangeProxyUrl.value = proxyUrl;
    exchangeStatus.textContent = "CORS 프록시 URL을 저장했습니다.";
  });
}

if (resetExchangeProxyBtn) {
  resetExchangeProxyBtn.addEventListener("click", () => {
    localStorage.setItem(EXCHANGE_PROXY_STORAGE_KEY, EXCHANGE_DEFAULT_PROXY_URL);
    exchangeProxyUrl.value = EXCHANGE_DEFAULT_PROXY_URL;
    exchangeStatus.textContent = "기본 CORS 프록시 URL로 되돌렸습니다.";
  });
}

calculateExchangeBtn.addEventListener("click", calculateExchange);

swapExchangeBtn.addEventListener("click", () => {
  const fromValue = exchangeFromCurrency.value;
  exchangeFromCurrency.value = exchangeToCurrency.value;
  exchangeToCurrency.value = fromValue;
});

[exchangeAmount, exchangeApiKey].forEach(input => {
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") calculateExchange();
  });
});

initExchangeCalculator();
