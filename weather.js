const WEATHER_REFRESH_MS = 5 * 60 * 1000;

const seoulDistricts = [
  { name: "종로구", lat: 37.5735, lon: 126.9788 },
  { name: "중구", lat: 37.5636, lon: 126.9976 },
  { name: "용산구", lat: 37.5326, lon: 126.9900 },
  { name: "성동구", lat: 37.5634, lon: 127.0369 },
  { name: "광진구", lat: 37.5384, lon: 127.0823 },
  { name: "동대문구", lat: 37.5744, lon: 127.0396 },
  { name: "중랑구", lat: 37.6063, lon: 127.0925 },
  { name: "성북구", lat: 37.5894, lon: 127.0167 },
  { name: "강북구", lat: 37.6396, lon: 127.0257 },
  { name: "도봉구", lat: 37.6688, lon: 127.0471 },
  { name: "노원구", lat: 37.6542, lon: 127.0568 },
  { name: "은평구", lat: 37.6176, lon: 126.9227 },
  { name: "서대문구", lat: 37.5791, lon: 126.9368 },
  { name: "마포구", lat: 37.5663, lon: 126.9016 },
  { name: "양천구", lat: 37.5169, lon: 126.8664 },
  { name: "강서구", lat: 37.5509, lon: 126.8495 },
  { name: "구로구", lat: 37.4955, lon: 126.8877 },
  { name: "금천구", lat: 37.4569, lon: 126.8955 },
  { name: "영등포구", lat: 37.5264, lon: 126.8962 },
  { name: "동작구", lat: 37.5124, lon: 126.9393 },
  { name: "관악구", lat: 37.4784, lon: 126.9516 },
  { name: "서초구", lat: 37.4836, lon: 127.0327 },
  { name: "강남구", lat: 37.5172, lon: 127.0473 },
  { name: "송파구", lat: 37.5145, lon: 127.1059 },
  { name: "강동구", lat: 37.5301, lon: 127.1238 }
];

const weatherStatus = document.getElementById("weatherStatus");
const refreshWeatherBtn = document.getElementById("refreshWeatherBtn");
const resetMapBtn = document.getElementById("resetMapBtn");
const weatherTableBody = document.getElementById("weatherTableBody");
const openStreetSeoulMap = document.getElementById("openStreetSeoulMap");
const weatherDetail = document.getElementById("weatherDetail");
const weatherAvgTemp = document.getElementById("weatherAvgTemp");
const weatherAvgPm10 = document.getElementById("weatherAvgPm10");
const weatherAvgPm25 = document.getElementById("weatherAvgPm25");

let weatherRows = [];
let selectedWeatherName = "";
let weatherTimer = null;
let tileZoom = 11;
let mapCenter = { lat: 37.5665, lon: 126.9780 };

function weatherDescription(code) {
  const table = {
    0: "맑음",
    1: "대체로 맑음",
    2: "부분 흐림",
    3: "흐림",
    45: "안개",
    48: "서리 안개",
    51: "약한 이슬비",
    53: "이슬비",
    55: "강한 이슬비",
    61: "약한 비",
    63: "비",
    65: "강한 비",
    71: "약한 눈",
    73: "눈",
    75: "강한 눈",
    80: "약한 소나기",
    81: "소나기",
    82: "강한 소나기",
    95: "뇌우"
  };
  return table[code] || "날씨 정보";
}

function pm10Grade(value) {
  if (value == null || Number.isNaN(value)) return "정보 없음";
  if (value <= 30) return "좋음";
  if (value <= 80) return "보통";
  if (value <= 150) return "나쁨";
  return "매우 나쁨";
}

function pm25Grade(value) {
  if (value == null || Number.isNaN(value)) return "정보 없음";
  if (value <= 15) return "좋음";
  if (value <= 35) return "보통";
  if (value <= 75) return "나쁨";
  return "매우 나쁨";
}

function gradeColor(pm25) {
  const grade = pm25Grade(pm25);
  if (grade === "좋음") return "#8bcf88";
  if (grade === "보통") return "#f7cf62";
  if (grade === "나쁨") return "#f2a35e";
  if (grade === "매우 나쁨") return "#df7770";
  return "#c9b56c";
}

function latestHourlyValue(hourly, key) {
  if (!hourly || !hourly.time || !hourly[key]) return { value: null, time: "" };

  const now = Date.now();
  let bestIndex = 0;
  let bestDiff = Infinity;

  hourly.time.forEach((timeText, index) => {
    const ts = new Date(timeText).getTime();
    const diff = Math.abs(now - ts);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });

  return {
    value: hourly[key][bestIndex],
    time: hourly.time[bestIndex] || ""
  };
}

function lonToTileX(lon, zoom) {
  return ((lon + 180) / 360) * Math.pow(2, zoom);
}

function latToTileY(lat, zoom) {
  const latRad = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom);
}

function projectPoint(lat, lon, zoom, center, width, height) {
  const tileSize = 256;
  const centerX = lonToTileX(center.lon, zoom) * tileSize;
  const centerY = latToTileY(center.lat, zoom) * tileSize;
  const pointX = lonToTileX(lon, zoom) * tileSize;
  const pointY = latToTileY(lat, zoom) * tileSize;

  return {
    x: width / 2 + (pointX - centerX),
    y: height / 2 + (pointY - centerY)
  };
}

function renderOpenStreetMap() {
  const width = openStreetSeoulMap.clientWidth || 720;
  const height = openStreetSeoulMap.clientHeight || 520;
  const tileSize = 256;

  openStreetSeoulMap.innerHTML = "";

  const mapLayer = document.createElement("div");
  mapLayer.style.position = "absolute";
  mapLayer.style.inset = "0";
  mapLayer.style.overflow = "hidden";

  const markerLayer = document.createElement("div");
  markerLayer.style.position = "absolute";
  markerLayer.style.inset = "0";
  markerLayer.style.pointerEvents = "none";

  const attribution = document.createElement("div");
  attribution.style.position = "absolute";
  attribution.style.right = "8px";
  attribution.style.bottom = "6px";
  attribution.style.background = "rgba(255,255,255,0.86)";
  attribution.style.borderRadius = "8px";
  attribution.style.padding = "3px 7px";
  attribution.style.fontSize = "11px";
  attribution.innerHTML = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

  const centerTileX = lonToTileX(mapCenter.lon, tileZoom);
  const centerTileY = latToTileY(mapCenter.lat, tileZoom);
  const centerPixelX = centerTileX * tileSize;
  const centerPixelY = centerTileY * tileSize;

  const startX = Math.floor((centerPixelX - width / 2) / tileSize);
  const endX = Math.floor((centerPixelX + width / 2) / tileSize);
  const startY = Math.floor((centerPixelY - height / 2) / tileSize);
  const endY = Math.floor((centerPixelY + height / 2) / tileSize);
  const maxTile = Math.pow(2, tileZoom);

  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      if (y < 0 || y >= maxTile) continue;

      const wrappedX = ((x % maxTile) + maxTile) % maxTile;
      const img = document.createElement("img");
      img.src = `https://tile.openstreetmap.org/${tileZoom}/${wrappedX}/${y}.png`;
      img.alt = "";
      img.draggable = false;
      img.style.position = "absolute";
      img.style.left = `${x * tileSize - (centerPixelX - width / 2)}px`;
      img.style.top = `${y * tileSize - (centerPixelY - height / 2)}px`;
      img.style.width = `${tileSize}px`;
      img.style.height = `${tileSize}px`;
      img.style.userSelect = "none";
      img.onerror = () => {
        weatherStatus.textContent = "OpenStreetMap 타일을 불러오지 못했습니다. 인터넷 연결 또는 타일 서버 접근을 확인하세요.";
      };
      mapLayer.appendChild(img);
    }
  }

  weatherRows.forEach(row => {
    const point = projectPoint(row.lat, row.lon, tileZoom, mapCenter, width, height);
    const marker = document.createElement("button");
    marker.type = "button";
    marker.title = `${row.name} ${formatNumber(row.temperature, "℃")} ${row.weather}`;
    marker.style.position = "absolute";
    marker.style.left = `${point.x - 23}px`;
    marker.style.top = `${point.y - 23}px`;
    marker.style.width = "46px";
    marker.style.height = "46px";
    marker.style.borderRadius = "50%";
    marker.style.border = selectedWeatherName === row.name ? "4px solid #4b3b18" : "3px solid #ffffff";
    marker.style.background = gradeColor(row.pm25);
    marker.style.boxShadow = "0 6px 18px rgba(0,0,0,0.28)";
    marker.style.color = "#4b3b18";
    marker.style.fontWeight = "900";
    marker.style.fontSize = "12px";
    marker.style.cursor = "pointer";
    marker.style.pointerEvents = "auto";
    marker.textContent = typeof row.temperature === "number" ? `${Math.round(row.temperature)}°` : "-";
    marker.addEventListener("click", () => selectWeatherDistrict(row.name, true));

    const label = document.createElement("div");
    label.textContent = row.name;
    label.style.position = "absolute";
    label.style.left = `${point.x - 36}px`;
    label.style.top = `${point.y + 24}px`;
    label.style.width = "72px";
    label.style.textAlign = "center";
    label.style.fontSize = "12px";
    label.style.fontWeight = "900";
    label.style.color = "#4b3b18";
    label.style.textShadow = "0 1px 0 #fff, 1px 0 0 #fff, -1px 0 0 #fff, 0 -1px 0 #fff";
    label.style.pointerEvents = "none";

    markerLayer.appendChild(marker);
    markerLayer.appendChild(label);
  });

  openStreetSeoulMap.appendChild(mapLayer);
  openStreetSeoulMap.appendChild(markerLayer);
  openStreetSeoulMap.appendChild(attribution);
}

async function fetchSeoulWeather() {
  weatherStatus.textContent = "Open-Meteo에서 서울 날씨와 미세먼지를 불러오는 중입니다.";

  const latitudes = seoulDistricts.map(item => item.lat.toFixed(4)).join(",");
  const longitudes = seoulDistricts.map(item => item.lon.toFixed(4)).join(",");

  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitudes}&longitude=${longitudes}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` +
    `&timezone=Asia%2FSeoul&forecast_days=1`;

  const airUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitudes}&longitude=${longitudes}` +
    `&hourly=pm10,pm2_5&timezone=Asia%2FSeoul&forecast_days=1`;

  try {
    const [weatherResponse, airResponse] = await Promise.all([
      fetch(weatherUrl),
      fetch(airUrl)
    ]);

    if (!weatherResponse.ok || !airResponse.ok) {
      throw new Error("Open-Meteo response error");
    }

    const weatherJson = await weatherResponse.json();
    const airJson = await airResponse.json();

    const weatherArray = Array.isArray(weatherJson) ? weatherJson : [weatherJson];
    const airArray = Array.isArray(airJson) ? airJson : [airJson];

    weatherRows = seoulDistricts.map((district, index) => {
      const current = weatherArray[index]?.current || {};
      const air = airArray[index]?.hourly || {};
      const pm10 = latestHourlyValue(air, "pm10");
      const pm25 = latestHourlyValue(air, "pm2_5");

      return {
        ...district,
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        weatherCode: current.weather_code,
        weather: weatherDescription(current.weather_code),
        weatherTime: current.time || "",
        pm10: pm10.value,
        pm25: pm25.value,
        airTime: pm25.time || pm10.time || ""
      };
    });

    renderWeatherDashboard();

    const nowText = new Date().toLocaleString("ko-KR", { hour12: false });
    weatherStatus.textContent = `마지막 갱신: ${nowText} · 5분마다 자동 갱신`;
  } catch (error) {
    weatherStatus.textContent = "날씨 데이터를 불러오지 못했습니다. 인터넷 연결 또는 Open-Meteo API 응답을 확인하세요.";

    // Map should still be visible even if API fails.
    if (!weatherRows.length) {
      weatherRows = seoulDistricts.map(district => ({
        ...district,
        temperature: null,
        humidity: null,
        windSpeed: null,
        weatherCode: null,
        weather: "정보 없음",
        weatherTime: "",
        pm10: null,
        pm25: null,
        airTime: ""
      }));
      renderWeatherDashboard();
    }
  }
}

function renderWeatherDashboard() {
  renderOpenStreetMap();
  renderWeatherTable();
  renderWeatherStats();

  if (selectedWeatherName) {
    const selected = weatherRows.find(row => row.name === selectedWeatherName);
    if (selected) renderWeatherDetail(selected);
  }
}

function renderWeatherStats() {
  const validTemp = weatherRows.map(row => row.temperature).filter(value => typeof value === "number");
  const validPm10 = weatherRows.map(row => row.pm10).filter(value => typeof value === "number");
  const validPm25 = weatherRows.map(row => row.pm25).filter(value => typeof value === "number");

  weatherAvgTemp.textContent = validTemp.length ? `${average(validTemp).toFixed(1)}℃` : "-";
  weatherAvgPm10.textContent = validPm10.length ? `${average(validPm10).toFixed(0)}` : "-";
  weatherAvgPm25.textContent = validPm25.length ? `${average(validPm25).toFixed(0)}` : "-";
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function renderWeatherTable() {
  weatherTableBody.innerHTML = "";

  weatherRows.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="date-cell">${row.name}</td>
      <td>${formatNumber(row.temperature, "℃")}</td>
      <td>${row.weather}</td>
      <td>${formatNumber(row.pm10, "㎍/㎥")}</td>
      <td>${formatNumber(row.pm25, "㎍/㎥")}</td>
      <td>${pm25Grade(row.pm25)}</td>
      <td>${formatDataTime(row.airTime || row.weatherTime)}</td>
    `;
    tr.querySelector(".date-cell").addEventListener("click", () => selectWeatherDistrict(row.name, true));
    weatherTableBody.appendChild(tr);
  });
}

function selectWeatherDistrict(name, moveMap = true) {
  selectedWeatherName = name;
  const row = weatherRows.find(item => item.name === name);
  if (!row) return;

  renderWeatherDetail(row);

  if (moveMap) {
    mapCenter = { lat: row.lat, lon: row.lon };
    tileZoom = 12;
  }

  renderOpenStreetMap();
}

function resetMap() {
  mapCenter = { lat: 37.5665, lon: 126.9780 };
  tileZoom = 11;
  renderOpenStreetMap();
}

function renderWeatherDetail(row) {
  weatherDetail.className = "";
  weatherDetail.style.background = "#fffbea";
  weatherDetail.style.border = "1px solid #ead174";
  weatherDetail.style.borderRadius = "18px";
  weatherDetail.style.padding = "18px";
  weatherDetail.innerHTML = `
    <strong style="font-size: 20px;">${row.name}</strong>
    <div class="hint">날씨 기준: ${formatDataTime(row.weatherTime)} · 대기질 기준: ${formatDataTime(row.airTime)}</div>
    <div style="display: grid; gap: 8px; margin-top: 12px;">
      <div>기온: <strong>${formatNumber(row.temperature, "℃")}</strong></div>
      <div>날씨: <strong>${row.weather}</strong></div>
      <div>습도: <strong>${formatNumber(row.humidity, "%")}</strong></div>
      <div>바람: <strong>${formatNumber(row.windSpeed, "km/h")}</strong></div>
      <div>PM10: <strong>${formatNumber(row.pm10, "㎍/㎥")} · ${pm10Grade(row.pm10)}</strong></div>
      <div>PM2.5: <strong>${formatNumber(row.pm25, "㎍/㎥")} · ${pm25Grade(row.pm25)}</strong></div>
    </div>
  `;
}

function formatNumber(value, unit) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${Number(value).toFixed(unit === "℃" ? 1 : 0)}${unit}`;
}

function formatDataTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

refreshWeatherBtn.addEventListener("click", fetchSeoulWeather);
resetMapBtn.addEventListener("click", resetMap);
window.addEventListener("resize", renderOpenStreetMap);

weatherRows = seoulDistricts.map(district => ({
  ...district,
  temperature: null,
  humidity: null,
  windSpeed: null,
  weatherCode: null,
  weather: "정보 없음",
  weatherTime: "",
  pm10: null,
  pm25: null,
  airTime: ""
}));

renderWeatherDashboard();
fetchSeoulWeather();
weatherTimer = setInterval(fetchSeoulWeather, WEATHER_REFRESH_MS);
