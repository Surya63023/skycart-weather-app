/* ==========================================================================
   SkyCast — app.js
   Orchestrates api.js + ui.js, owns application state, wires up events.
   ========================================================================== */

(() => {
  "use strict";

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  const DEFAULT_LOCATION = { lat: 51.5074, lon: -0.1278, label: "London, GB" }; // fallback if geolocation is denied

  const state = {
    units: localStorage.getItem("skycast:units") || "metric",
    theme: localStorage.getItem("skycast:theme") || "dark",
    location: null, // { lat, lon, label }
    saved: loadSaved(),
    lastPayload: null, // most recent { current, forecast, airQuality }
  };

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem("skycast:saved")) || [];
    } catch {
      return [];
    }
  }
  function persistSaved() {
    localStorage.setItem("skycast:saved", JSON.stringify(state.saved));
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  function init() {
    UI.setTheme(state.theme);
    UI.setUnitButtons(state.units);
    UI.updateClock();
    setInterval(UI.updateClock, 30_000);

    bindEvents();
    locateAndLoad();
  }

  // ------------------------------------------------------------------
  // Core data loading
  // ------------------------------------------------------------------
  async function loadWeatherFor(lat, lon, label) {
    UI.hideError();
    UI.setLoading(true);
    try {
      const payload = await WeatherAPI.fetchAllWeatherData(
        lat,
        lon,
        state.units,
      );
      state.location = {
        lat,
        lon,
        label:
          label || `${payload.current.name}, ${payload.current.sys.country}`,
      };
      state.lastPayload = payload;

      const tzOffset = payload.current.timezone || 0;
      UI.renderCurrent(payload.current, state.units, tzOffset);
      UI.renderAQI(payload.airQuality);
      UI.renderHourly(payload.forecast.list, tzOffset);
      UI.renderDaily(payload.forecast.list, tzOffset);
      UI.renderPrecipBars(payload.forecast.list);
      UI.renderWind(payload.current, state.units);
      UI.renderHumidity(payload.current, state.units);
      UI.renderComfort(payload.current, state.units);
      UI.renderTip(
        payload.current,
        payload.forecast.list,
        payload.airQuality,
        state.units,
      );
      refreshSavedTemps();
      UI.renderSaved(state.saved, locationKey(state.location), state.units);

      UI.el.liveStatus.textContent = `Weather updated for ${state.location.label}.`;
    } catch (err) {
      handleError(err);
    } finally {
      UI.setLoading(false);
    }
  }

  function handleError(err) {
    if (err instanceof WeatherAPI.WeatherAPIError) {
      UI.showError(err.message);
    } else {
      UI.showError(
        "Something went wrong while loading weather data. Please try again.",
      );
      console.error(err);
    }
  }

  // ------------------------------------------------------------------
  // Geolocation
  // ------------------------------------------------------------------
  function locateAndLoad() {
    if (!("geolocation" in navigator)) {
      loadWeatherFor(
        DEFAULT_LOCATION.lat,
        DEFAULT_LOCATION.lon,
        DEFAULT_LOCATION.label,
      );
      return;
    }
    UI.setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => loadWeatherFor(pos.coords.latitude, pos.coords.longitude),
      () => {
        UI.showError(
          "Location access unavailable — showing London by default. Use search to change city.",
        );
        loadWeatherFor(
          DEFAULT_LOCATION.lat,
          DEFAULT_LOCATION.lon,
          DEFAULT_LOCATION.label,
        );
      },
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }

  // ------------------------------------------------------------------
  // Search (debounced geocoding)
  // ------------------------------------------------------------------
  const doSearch = UI.debounce(async (query) => {
    if (!query || query.trim().length < 2) {
      UI.hideSearchResults();
      return;
    }
    try {
      const results = await WeatherAPI.geocodeCity(query.trim());
      UI.renderSearchResults(results, (choice) => {
        UI.hideSearchResults();
        UI.el.searchResults.hidden = true;
        document.getElementById("citySearch").value =
          `${choice.name}, ${choice.country}`;
        loadWeatherFor(
          choice.lat,
          choice.lon,
          `${choice.name}, ${choice.country}`,
        );
      });
    } catch (err) {
      handleError(err);
    }
  }, 350);

  // ------------------------------------------------------------------
  // Saved locations
  // ------------------------------------------------------------------
  function locationKey(loc) {
    return `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`;
  }

  async function refreshSavedTemps() {
    await Promise.all(
      state.saved.map(async (loc) => {
        try {
          const data = await WeatherAPI.getCurrentWeather(
            loc.lat,
            loc.lon,
            state.units,
          );
          loc.temp = data.main.temp;
          loc.icon = UI.iconFor(data.weather[0]?.icon);
        } catch {
          /* leave last known temp if the refresh fails */
        }
      }),
    );
    persistSaved();
  }

  function addSavedLocation(loc) {
    const key = locationKey(loc);
    if (state.saved.some((s) => s.key === key)) return;
    state.saved.push({ key, lat: loc.lat, lon: loc.lon, label: loc.label });
    persistSaved();
    UI.renderSaved(state.saved, key, state.units);
    refreshSavedTemps().then(() =>
      UI.renderSaved(state.saved, key, state.units),
    );
  }

  function removeSavedLocation(key) {
    state.saved = state.saved.filter((s) => s.key !== key);
    persistSaved();
    UI.renderSaved(
      state.saved,
      state.location ? locationKey(state.location) : null,
      state.units,
    );
  }

  // ------------------------------------------------------------------
  // Event wiring
  // ------------------------------------------------------------------
  function bindEvents() {
    // Search input
    const searchInput = document.getElementById("citySearch");
    searchInput.addEventListener("input", (e) => doSearch(e.target.value));
    document.getElementById("searchForm").addEventListener("submit", (e) => {
      e.preventDefault();
      doSearch(searchInput.value);
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search")) UI.hideSearchResults();
    });

    // Geolocation button
    document.getElementById("geoBtn").addEventListener("click", locateAndLoad);

    // Refresh button
    document.getElementById("refreshBtn").addEventListener("click", () => {
      if (state.location)
        loadWeatherFor(
          state.location.lat,
          state.location.lon,
          state.location.label,
        );
      else locateAndLoad();
    });

    // Theme toggle
    document.getElementById("themeBtn").addEventListener("click", () => {
      state.theme = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("skycast:theme", state.theme);
      UI.setTheme(state.theme);
    });

    // Unit toggle
    document
      .getElementById("unitC")
      .addEventListener("click", () => setUnits("metric"));
    document
      .getElementById("unitF")
      .addEventListener("click", () => setUnits("imperial"));

    // Error banner dismiss
    document
      .getElementById("errorDismiss")
      .addEventListener("click", UI.hideError);

    // Saved locations: select / remove
    document.addEventListener("saved:select", (e) => {
      const loc = e.detail;
      loadWeatherFor(loc.lat, loc.lon, loc.label);
    });
    document.addEventListener("saved:remove", (e) =>
      removeSavedLocation(e.detail.key),
    );

    // Add-location form
    document
      .getElementById("addLocationForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = document.getElementById("addLocationInput");
        const query = input.value.trim();
        if (!query) return;
        try {
          const [first] = await WeatherAPI.geocodeCity(query, 1);
          if (!first) {
            UI.showError(`No results for "${query}".`);
            return;
          }
          addSavedLocation({
            lat: first.lat,
            lon: first.lon,
            label: `${first.name}, ${first.country}`,
          });
          input.value = "";
        } catch (err) {
          handleError(err);
        }
      });

    // Mobile sidebar toggle
    document
      .getElementById("mobileMenuBtn")
      .addEventListener("click", () => UI.toggleSidebar());
    document.addEventListener("click", (e) => {
      const sidebar = document.getElementById("sidebar");
      if (
        sidebar.classList.contains("is-open") &&
        !e.target.closest("#sidebar") &&
        !e.target.closest("#mobileMenuBtn")
      ) {
        UI.toggleSidebar(false);
      }
    });

    // Sidebar nav: smooth-scroll to section + active state
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        document
          .querySelectorAll(".nav-link")
          .forEach((l) => l.classList.remove("is-active"));
        link.classList.add("is-active");
        const target = document.getElementById(link.dataset.view);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
        UI.toggleSidebar(false);
      });
    });
  }

  function setUnits(units) {
    if (units === state.units) return;
    state.units = units;
    localStorage.setItem("skycast:units", units);
    UI.setUnitButtons(units);
    if (state.location)
      loadWeatherFor(
        state.location.lat,
        state.location.lon,
        state.location.label,
      );
  }

  // ------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", init);
})();
