/* ==========================================================================
   SkyCast — ui.js
   All DOM reads/writes live here. Pure rendering + small UI helpers.
   Exposes a single global object: `UI`.
   ========================================================================== */

const UI = (() => {
  // ------------------------------------------------------------------
  // Element cache
  // ------------------------------------------------------------------
  const el = {
    locationText: document.getElementById("locationText"),
    currentDate: document.getElementById("currentDate"),
    aqiChip: document.getElementById("aqiChip"),
    aqiValueChip: document.getElementById("aqiValueChip"),
    aqiWordChip: document.getElementById("aqiWordChip"),
    currentTemp: document.getElementById("currentTemp"),
    currentDesc: document.getElementById("currentDesc"),
    feelsLike: document.getElementById("feelsLike"),
    currentIcon: document.getElementById("currentIcon"),
    heroCard: document.getElementById("currentWeather"),
    statWind: document.getElementById("statWind"),
    statHumidity: document.getElementById("statHumidity"),
    statPressure: document.getElementById("statPressure"),
    statVisibility: document.getElementById("statVisibility"),
    statUV: document.getElementById("statUV"),
    hourlyList: document.getElementById("hourlyList"),
    dailyList: document.getElementById("dailyList"),
    sunrise: document.getElementById("sunrise"),
    sunset: document.getElementById("sunset"),
    sunDot: document.getElementById("sunDot"),
    dayLength: document.getElementById("dayLength"),
    aqiBig: document.getElementById("aqiBig"),
    aqiWord: document.getElementById("aqiWord"),
    aqiDesc: document.getElementById("aqiDesc"),
    aqiComponents: document.getElementById("aqiComponents"),
    compPm25: document.getElementById("compPm25"),
    compPm10: document.getElementById("compPm10"),
    compO3: document.getElementById("compO3"),
    compNo2: document.getElementById("compNo2"),
    precipNow: document.getElementById("precipNow"),
    precipBars: document.getElementById("precipBars"),
    savedList: document.getElementById("savedList"),
    errorBanner: document.getElementById("errorBanner"),
    errorText: document.getElementById("errorText"),
    liveStatus: document.getElementById("liveStatus"),
    searchResults: document.getElementById("searchResults"),
    searchStatus: document.getElementById("searchStatus"),
    unitLabelMain: document.getElementById("unitLabelMain"),
    clock: document.getElementById("clock"),
    clockDate: document.getElementById("clockDate"),
    windNeedle: document.getElementById("windNeedle"),
    windSpeedFull: document.getElementById("windSpeedFull"),
    windDirection: document.getElementById("windDirection"),
    windGust: document.getElementById("windGust"),
    humidityRing: document.getElementById("humidityRing"),
    humidityRingValue: document.getElementById("humidityRingValue"),
    dewPoint: document.getElementById("dewPoint"),
    humidityComfort: document.getElementById("humidityComfort"),
    comfortRing: document.getElementById("comfortRing"),
    comfortScore: document.getElementById("comfortScore"),
    tipText: document.getElementById("tipText"),
    themeBtn: document.getElementById("themeBtn"),
    themeLabel: document.getElementById("themeLabel"),
  };

  // ------------------------------------------------------------------
  // Templates
  // ------------------------------------------------------------------
  const hourlyTpl = document.getElementById("hourlyItemTemplate");
  const dailyTpl = document.getElementById("dailyItemTemplate");
  const savedTpl = document.getElementById("savedItemTemplate");

  // ------------------------------------------------------------------
  // Formatting / mapping helpers
  // ------------------------------------------------------------------

  /** Map OpenWeatherMap icon codes to Font Awesome classes */
  const ICON_MAP = {
    "01d": "fa-solid fa-sun",
    "01n": "fa-solid fa-moon",
    "02d": "fa-solid fa-cloud-sun",
    "02n": "fa-solid fa-cloud-moon",
    "03d": "fa-solid fa-cloud",
    "03n": "fa-solid fa-cloud",
    "04d": "fa-solid fa-cloud",
    "04n": "fa-solid fa-cloud",
    "09d": "fa-solid fa-cloud-showers-heavy",
    "09n": "fa-solid fa-cloud-showers-heavy",
    "10d": "fa-solid fa-cloud-sun-rain",
    "10n": "fa-solid fa-cloud-rain",
    "11d": "fa-solid fa-bolt",
    "11n": "fa-solid fa-bolt",
    "13d": "fa-solid fa-snowflake",
    "13n": "fa-solid fa-snowflake",
    "50d": "fa-solid fa-smog",
    "50n": "fa-solid fa-smog",
  };
  const iconClassFor = (code) => ICON_MAP[code] || "fa-solid fa-cloud-sun";
  const iconFor = (code) => iconClassFor(code); // kept for app.js compatibility (used as a CSS class, not emoji)

  const degreeSymbol = (units) => (units === "imperial" ? "F" : "C");

  const fmtTemp = (t) => (t === null || t === undefined ? "--" : Math.round(t));

  const fmtWind = (speed, units) =>
    units === "imperial"
      ? `${Math.round(speed)} mph`
      : `${Math.round(speed)} km/h`;

  const fmtTime = (unixSeconds, tzOffsetSeconds = 0) => {
    const d = new Date((unixSeconds + tzOffsetSeconds) * 1000);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    });
  };
  const fmtHour = (unixSeconds, tzOffsetSeconds = 0) => {
    const d = new Date((unixSeconds + tzOffsetSeconds) * 1000);
    return d.toLocaleTimeString("en-US", { hour: "numeric", timeZone: "UTC" });
  };
  const fmtWeekday = (unixSeconds, tzOffsetSeconds = 0) => {
    const d = new Date((unixSeconds + tzOffsetSeconds) * 1000);
    return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  };
  const fmtMonthDay = (unixSeconds, tzOffsetSeconds = 0) => {
    const d = new Date((unixSeconds + tzOffsetSeconds) * 1000);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  };

  /** 16-point compass direction from a degree bearing */
  const COMPASS_POINTS = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const degToCompass = (deg) => COMPASS_POINTS[Math.round(deg / 22.5) % 16];

  /** Convert a displayed temperature back to Celsius for internal heuristics */
  const toCelsius = (t, units) =>
    units === "imperial" ? ((t - 32) * 5) / 9 : t;
  const toKmh = (speed, units) =>
    units === "imperial" ? speed * 1.60934 : speed;

  /** Magnus formula approximation of dew point (input/output in Celsius) */
  function dewPointC(tempC, humidityPct) {
    const b = 17.62,
      c = 243.12;
    const gamma = (b * tempC) / (c + tempC) + Math.log(humidityPct / 100);
    return (c * gamma) / (b - gamma);
  }

  /** Heuristic 0-100 comfort estimate from temp/humidity/wind — NOT an official metric */
  function estimateComfort(tempC, humidityPct, windKmh) {
    const tempPenalty = Math.abs(tempC - 22) * 3;
    const humidityPenalty = Math.abs(humidityPct - 45) * 0.5;
    const windPenalty = windKmh > 30 ? (windKmh - 30) * 0.5 : 0;
    const score = 100 - tempPenalty - humidityPenalty - windPenalty;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /** OpenWeatherMap air_pollution `main.aqi` is on a 1-5 scale */
  const AQI_LEVELS = {
    1: { word: "Good", color: "var(--good)" },
    2: { word: "Fair", color: "var(--good)" },
    3: { word: "Moderate", color: "var(--warn)" },
    4: { word: "Poor", color: "var(--bad)" },
    5: { word: "Very Poor", color: "var(--bad)" },
  };

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------

  function setLoading(isLoading) {
    document
      .getElementById("dashboard")
      .classList.toggle("is-loading", isLoading);
    if (isLoading) el.liveStatus.textContent = "Loading weather data…";
  }

  function showError(message) {
    el.errorText.textContent = message;
    el.errorBanner.hidden = false;
    el.liveStatus.textContent = message;
  }

  function hideError() {
    el.errorBanner.hidden = true;
  }

  function renderCurrent(current, units, tzOffsetSeconds) {
    const name = `${current.name}${current.sys?.country ? ", " + current.sys.country : ""}`;
    el.locationText.textContent = name;
    el.currentDate.textContent = new Date().toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    el.currentTemp.textContent = fmtTemp(current.main.temp);
    el.unitLabelMain.textContent = degreeSymbol(units);
    el.currentDesc.textContent = current.weather[0]?.description
      ? current.weather[0].description.replace(/\b\w/g, (c) => c.toUpperCase())
      : "—";
    el.feelsLike.textContent = `${fmtTemp(current.main.feels_like)}°${degreeSymbol(units)}`;
    el.currentIcon.innerHTML = `<i class="${iconClassFor(current.weather[0]?.icon)}"></i>`;
    el.heroCard.dataset.condition = current.weather[0]?.main || "default";

    el.statWind.textContent = fmtWind(current.wind.speed, units);
    el.statHumidity.textContent = `${current.main.humidity}%`;
    el.statPressure.textContent = `${current.main.pressure} hPa`;
    el.statVisibility.textContent = current.visibility
      ? `${(current.visibility / 1000).toFixed(1)} km`
      : "--";
    el.statUV.textContent = "N/A"; // UV Index requires OpenWeatherMap's paid One Call API

    // Sunrise / sunset
    el.sunrise.textContent = fmtTime(current.sys.sunrise, tzOffsetSeconds);
    el.sunset.textContent = fmtTime(current.sys.sunset, tzOffsetSeconds);
    const dayMs = (current.sys.sunset - current.sys.sunrise) * 1000;
    const h = Math.floor(dayMs / 3600000);
    const m = Math.round((dayMs % 3600000) / 60000);
    el.dayLength.textContent = `${h}h ${m}m`;

    const now = Date.now() / 1000;
    const progress = Math.min(
      1,
      Math.max(
        0,
        (now - current.sys.sunrise) /
          (current.sys.sunset - current.sys.sunrise),
      ),
    );
    el.sunDot.style.left = `${progress * 100}%`;
    el.sunDot.innerHTML =
      now < current.sys.sunrise || now > current.sys.sunset
        ? '<i class="fa-solid fa-moon"></i>'
        : '<i class="fa-solid fa-sun"></i>';

    const rainVol = current.rain?.["1h"] || 0;
    el.precipNow.textContent =
      rainVol > 0 ? `${Math.min(100, Math.round(rainVol * 20))}%` : "0%";
  }

  function renderAQI(airQuality) {
    if (!airQuality || !airQuality.list?.length) {
      el.aqiChip.hidden = true;
      el.aqiBig.textContent = "--";
      el.aqiWord.textContent = "Unavailable";
      el.aqiDesc.textContent =
        "Air quality data is temporarily unavailable for this location.";
      el.aqiComponents.hidden = true;
      return;
    }
    el.aqiChip.hidden = false;
    const entry = airQuality.list[0];
    const aqi = entry.main.aqi;
    const level = AQI_LEVELS[aqi] || {
      word: "Unknown",
      color: "var(--text-muted)",
    };

    el.aqiValueChip.textContent = aqi;
    el.aqiWordChip.textContent = level.word;
    el.aqiChip.style.color = level.color;
    el.aqiChip.style.borderColor = level.color;

    el.aqiBig.textContent = aqi;
    el.aqiBig.style.color = level.color;
    el.aqiWord.textContent = level.word;
    el.aqiWord.style.color = level.color;
    el.aqiDesc.textContent =
      aqi <= 2
        ? "Air quality is satisfactory and poses little or no risk."
        : aqi === 3
          ? "Air quality is acceptable; sensitive groups should take care with prolonged exposure."
          : "Air quality may affect health with prolonged exposure — consider limiting outdoor activity.";

    if (entry.components) {
      el.aqiComponents.hidden = false;
      el.compPm25.textContent = `${entry.components.pm2_5.toFixed(1)} μg/m³`;
      el.compPm10.textContent = `${entry.components.pm10.toFixed(1)} μg/m³`;
      el.compO3.textContent = `${entry.components.o3.toFixed(1)} μg/m³`;
      el.compNo2.textContent = `${entry.components.no2.toFixed(1)} μg/m³`;
    } else {
      el.aqiComponents.hidden = true;
    }
  }

  function renderHourly(forecastList, tzOffsetSeconds) {
    el.hourlyList.innerHTML = "";
    const items = forecastList.slice(0, 8); // next 24h in 3h steps
    items.forEach((item, i) => {
      const node = hourlyTpl.content.cloneNode(true);
      const wrap = node.querySelector(".hour-item");
      if (i === 0) wrap.classList.add("is-now");
      wrap.querySelector(".hour-label").textContent =
        i === 0 ? "Now" : fmtHour(item.dt, tzOffsetSeconds);
      wrap.querySelector(".hour-icon").innerHTML =
        `<i class="${iconClassFor(item.weather[0]?.icon)}"></i>`;
      wrap.querySelector(".hour-temp").textContent =
        `${fmtTemp(item.main.temp)}°`;
      const pop = Math.round((item.pop || 0) * 100);
      wrap.querySelector(".hour-precip").innerHTML =
        `<i class="fa-solid fa-droplet"></i> ${pop}%`;
      el.hourlyList.appendChild(node);
    });
  }

  function renderDaily(forecastList, tzOffsetSeconds) {
    const byDay = new Map();
    forecastList.forEach((item) => {
      const localDate = new Date((item.dt + tzOffsetSeconds) * 1000);
      const key = localDate.toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(item);
    });

    el.dailyList.innerHTML = "";
    const days = Array.from(byDay.entries()).slice(0, 7);
    const allTemps = forecastList.map((i) => i.main.temp);
    const weekMin = Math.min(...allTemps);
    const weekMax = Math.max(...allTemps);

    days.forEach(([, entries], index) => {
      const temps = entries.map((e) => e.main.temp);
      const low = Math.min(...temps);
      const high = Math.max(...temps);
      const midday = entries.reduce((best, e) => {
        const hour = new Date((e.dt + tzOffsetSeconds) * 1000).getUTCHours();
        const bestHour = new Date(
          (best.dt + tzOffsetSeconds) * 1000,
        ).getUTCHours();
        return Math.abs(hour - 12) < Math.abs(bestHour - 12) ? e : best;
      }, entries[0]);
      const maxPop = Math.max(...entries.map((e) => e.pop || 0));

      const node = dailyTpl.content.cloneNode(true);
      node.querySelector(".day-of-week").textContent =
        index === 0 ? "Today" : fmtWeekday(midday.dt, tzOffsetSeconds);
      node.querySelector(".day-date").textContent = fmtMonthDay(
        midday.dt,
        tzOffsetSeconds,
      );
      node.querySelector(".day-icon").innerHTML =
        `<i class="${iconClassFor(midday.weather[0]?.icon)}"></i>`;
      node.querySelector(".day-low").textContent = `${fmtTemp(low)}°`;
      node.querySelector(".day-high").textContent = `${fmtTemp(high)}°`;
      node.querySelector(".day-rain").innerHTML =
        `<i class="fa-solid fa-droplet"></i> ${Math.round(maxPop * 100)}%`;

      const fill = node.querySelector(".day-bar-fill");
      const leftPct = ((low - weekMin) / (weekMax - weekMin || 1)) * 100;
      const widthPct = ((high - low) / (weekMax - weekMin || 1)) * 100;
      fill.style.marginLeft = `${Math.max(0, leftPct)}%`;
      fill.style.width = `${Math.max(6, widthPct)}%`;

      el.dailyList.appendChild(node);
    });
  }

  function renderPrecipBars(forecastList) {
    el.precipBars.innerHTML = "";
    forecastList.slice(0, 5).forEach((item) => {
      const pop = Math.round((item.pop || 0) * 100);
      const bar = document.createElement("div");
      bar.className = "precip-bar";
      bar.style.height = `${Math.max(4, pop)}%`;
      bar.title = `${pop}% chance of rain`;
      el.precipBars.appendChild(bar);
    });
  }

  /** Wind compass card — speed, direction, gust */
  function renderWind(current, units) {
    const deg = current.wind.deg ?? 0;
    el.windNeedle.style.setProperty("--deg", `${deg}deg`);
    el.windSpeedFull.textContent = fmtWind(current.wind.speed, units);
    el.windDirection.textContent = `${degToCompass(deg)} (${Math.round(deg)}°)`;
    el.windGust.textContent = current.wind.gust
      ? fmtWind(current.wind.gust, units)
      : "--";
  }

  /** Humidity ring + dew point */
  function renderHumidity(current, units) {
    const humidity = current.main.humidity;
    el.humidityRing.style.setProperty("--pct", humidity);
    el.humidityRingValue.textContent = `${humidity}%`;

    const tempC = toCelsius(current.main.temp, units);
    const dewC = dewPointC(tempC, humidity);
    const dewDisplay = units === "imperial" ? (dewC * 9) / 5 + 32 : dewC;
    el.dewPoint.textContent = `${Math.round(dewDisplay)}°${degreeSymbol(units)}`;

    el.humidityComfort.textContent =
      humidity < 30
        ? "Dry"
        : humidity < 60
          ? "Comfortable"
          : humidity < 80
            ? "Humid"
            : "Very Humid";
  }

  /** Estimated comfort index ring */
  function renderComfort(current, units) {
    const tempC = toCelsius(current.main.temp, units);
    const windKmh = toKmh(current.wind.speed, units);
    const score = estimateComfort(tempC, current.main.humidity, windKmh);
    el.comfortRing.style.setProperty("--pct", score);
    el.comfortScore.textContent = score;
  }

  /** Data-driven "Today's Tip" card in the sidebar — no fabricated content */
  function renderTip(current, forecastList, airQuality, units) {
    const tempC = toCelsius(current.main.temp, units);
    const windKmh = toKmh(current.wind.speed, units);
    const nextPop = Math.max(
      0,
      ...(forecastList || []).slice(0, 4).map((f) => f.pop || 0),
    );
    const aqi = airQuality?.list?.[0]?.main?.aqi;

    let tip;
    if (aqi >= 4) {
      tip =
        "Air quality is poor right now — consider limiting prolonged outdoor activity.";
    } else if (nextPop >= 0.5) {
      tip =
        "Rain is likely in the next few hours — grab an umbrella before heading out.";
    } else if (windKmh >= 30) {
      tip =
        "It's windy out there — secure loose items and take care on bikes or with umbrellas.";
    } else if (current.main.humidity >= 80) {
      tip =
        "Humidity is high today — stay hydrated and dress in breathable fabrics.";
    } else if (tempC >= 33) {
      tip =
        "It's hot out there — drink plenty of water and avoid peak sun hours.";
    } else if (tempC <= 5) {
      tip = "It's cold out there — layer up before you head outside.";
    } else {
      tip = `Conditions look pleasant — ${current.weather[0]?.description || "good weather"} with comfortable temperatures.`;
    }
    el.tipText.textContent = tip;
  }

  function renderSaved(locations, activeKey, units) {
    el.savedList.innerHTML = "";
    if (!locations.length) {
      const empty = document.createElement("li");
      empty.className = "muted";
      empty.style.padding = "8px 4px";
      empty.textContent = "No saved locations yet.";
      el.savedList.appendChild(empty);
      return;
    }
    locations.forEach((loc) => {
      const node = savedTpl.content.cloneNode(true);
      const row = node.querySelector(".saved-row");
      if (loc.key === activeKey) row.style.background = "var(--glass-strong)";
      node.querySelector(".saved-name").textContent = loc.label;
      node.querySelector(".saved-icon").innerHTML =
        `<i class="${loc.icon || "fa-solid fa-cloud-sun"}"></i>`;
      node.querySelector(".saved-temp").textContent =
        loc.temp !== undefined && loc.temp !== null
          ? `${fmtTemp(loc.temp)}°${degreeSymbol(units)}`
          : "--";
      node.querySelector(".saved-select").addEventListener("click", () => {
        document.dispatchEvent(
          new CustomEvent("saved:select", { detail: loc }),
        );
      });
      node.querySelector(".saved-remove").addEventListener("click", () => {
        document.dispatchEvent(
          new CustomEvent("saved:remove", { detail: loc }),
        );
      });
      el.savedList.appendChild(node);
    });
  }

  function renderSearchResults(results, onSelect) {
    el.searchResults.innerHTML = "";
    if (!results.length) {
      el.searchResults.hidden = true;
      return;
    }
    results.forEach((r) => {
      const li = document.createElement("li");
      const parts = [r.name, r.state, r.country].filter(Boolean);
      li.textContent = parts.join(", ");
      li.addEventListener("click", () => onSelect(r));
      el.searchResults.appendChild(li);
    });
    el.searchResults.hidden = false;
    el.searchStatus.textContent = `${results.length} results found`;
  }

  function hideSearchResults() {
    el.searchResults.hidden = true;
  }

  function updateClock() {
    const now = new Date();
    el.clock.textContent = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    el.clockDate.textContent = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  function setUnitButtons(units) {
    document
      .getElementById("unitC")
      .classList.toggle("is-active", units === "metric");
    document
      .getElementById("unitC")
      .setAttribute("aria-pressed", units === "metric");
    document
      .getElementById("unitF")
      .classList.toggle("is-active", units === "imperial");
    document
      .getElementById("unitF")
      .setAttribute("aria-pressed", units === "imperial");
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    el.themeBtn.querySelector("i").className =
      theme === "dark" ? "fa-solid fa-moon" : "fa-solid fa-sun";
    el.themeLabel.textContent = theme === "dark" ? "Dark theme" : "Light theme";
  }

  function toggleSidebar(forceOpen) {
    const sidebar = document.getElementById("sidebar");
    const isOpen = forceOpen ?? !sidebar.classList.contains("is-open");
    sidebar.classList.toggle("is-open", isOpen);
    document
      .getElementById("mobileMenuBtn")
      .setAttribute("aria-expanded", String(isOpen));
  }

  // ------------------------------------------------------------------
  function debounce(fn, delay = 350) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  return {
    el,
    iconFor,
    setLoading,
    showError,
    hideError,
    renderCurrent,
    renderAQI,
    renderHourly,
    renderDaily,
    renderPrecipBars,
    renderWind,
    renderHumidity,
    renderComfort,
    renderTip,
    renderSaved,
    renderSearchResults,
    hideSearchResults,
    updateClock,
    setUnitButtons,
    setTheme,
    toggleSidebar,
    debounce,
  };
})();
