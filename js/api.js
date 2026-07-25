/* ==========================================================================
   SkyCast — api.js
   All network access lives here. Nothing in this file touches the DOM.
   Exposes a single global object: `WeatherAPI`.
   ========================================================================== */

const WeatherAPI = (() => {
  // ------------------------------------------------------------------
  // CONFIGURATION
  // ------------------------------------------------------------------
  // 1. Sign up for a free key at https://openweathermap.org/api (One Call
  //    is not required — this app uses the free Current Weather,
  //    5-day/3-hour Forecast, Air Pollution and Geocoding endpoints).
  // 2. Paste the key below. New keys can take up to ~2 hours to activate.
  const CONFIG = {
    API_KEY: "f08c84fa238f51e37c2add12823fdbaf", // <-- put your key here
    BASE_URL: "https://api.openweathermap.org/data/2.5",
    GEO_URL: "https://api.openweathermap.org/geo/1.0",
    CACHE_TTL_MS: 10 * 60 * 1000, // 10 minutes — keeps calls within free tier limits
  };

  // ------------------------------------------------------------------
  // Custom error type so ui.js/app.js can branch on `.type`
  // ------------------------------------------------------------------
  class WeatherAPIError extends Error {
    constructor(message, type = "unknown") {
      super(message);
      this.name = "WeatherAPIError";
      this.type = type; // 'config' | 'network' | 'not_found' | 'rate_limit' | 'server' | 'unknown'
    }
  }

  // ------------------------------------------------------------------
  // Lightweight sessionStorage cache to avoid refetching the same
  // coordinates/units within CACHE_TTL_MS (keeps free-tier usage low).
  // ------------------------------------------------------------------
  const cache = {
    get(key) {
      try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const { value, expires } = JSON.parse(raw);
        if (Date.now() > expires) {
          sessionStorage.removeItem(key);
          return null;
        }
        return value;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({ value, expires: Date.now() + CONFIG.CACHE_TTL_MS }),
        );
      } catch {
        /* storage full or unavailable — fail silently, caching is a bonus */
      }
    },
  };

  // ------------------------------------------------------------------
  // Core fetch wrapper with unified error handling
  // ------------------------------------------------------------------
  async function request(url, { useCache = true } = {}) {
    if (!CONFIG.API_KEY || CONFIG.API_KEY === "YOUR_OPENWEATHERMAP_API_KEY") {
      throw new WeatherAPIError(
        "No API key configured. Add your free OpenWeatherMap key in js/api.js.",
        "config",
      );
    }

    if (useCache) {
      const cached = cache.get(url);
      if (cached) return cached;
    }

    let response;
    try {
      response = await fetch(url);
    } catch (err) {
      throw new WeatherAPIError(
        "Network error — check your internet connection and try again.",
        "network",
      );
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new WeatherAPIError(
          "Invalid API key. Double-check the key in js/api.js.",
          "config",
        );
      }
      if (response.status === 404) {
        throw new WeatherAPIError("Location not found.", "not_found");
      }
      if (response.status === 429) {
        throw new WeatherAPIError(
          "Too many requests — please wait a moment and try again.",
          "rate_limit",
        );
      }
      throw new WeatherAPIError(
        `Weather service error (status ${response.status}).`,
        "server",
      );
    }

    const data = await response.json();
    if (useCache) cache.set(url, data);
    return data;
  }

  // ------------------------------------------------------------------
  // PUBLIC METHODS
  // ------------------------------------------------------------------

  /** Search cities by name -> [{ name, state, country, lat, lon }] */
  async function geocodeCity(query, limit = 5) {
    const url = `${CONFIG.GEO_URL}/direct?q=${encodeURIComponent(
      query,
    )}&limit=${limit}&appid=${CONFIG.API_KEY}`;
    const results = await request(url);
    return results.map((r) => ({
      name: r.name,
      state: r.state || "",
      country: r.country,
      lat: r.lat,
      lon: r.lon,
    }));
  }

  /** Turn coordinates into a human readable place name */
  async function reverseGeocode(lat, lon) {
    const url = `${CONFIG.GEO_URL}/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${CONFIG.API_KEY}`;
    const results = await request(url);
    if (!results.length) return { name: "Unknown location", country: "" };
    return { name: results[0].name, country: results[0].country };
  }

  /** Current conditions for a coordinate pair */
  async function getCurrentWeather(lat, lon, units = "metric") {
    const url = `${CONFIG.BASE_URL}/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${CONFIG.API_KEY}`;
    return request(url);
  }

  /** 5 day / 3 hour forecast — used to derive both hourly and daily views */
  async function getForecast(lat, lon, units = "metric") {
    const url = `${CONFIG.BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${CONFIG.API_KEY}`;
    return request(url);
  }

  /** Air Quality Index (OpenWeatherMap's 1-5 scale) */
  async function getAirPollution(lat, lon) {
    const url = `${CONFIG.BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}`;
    return request(url);
  }

  /** Convenience: fetch everything the dashboard needs in parallel */
  async function fetchAllWeatherData(lat, lon, units = "metric") {
    const [current, forecast, airQuality] = await Promise.all([
      getCurrentWeather(lat, lon, units),
      getForecast(lat, lon, units),
      getAirPollution(lat, lon).catch(() => null), // AQI is a nice-to-have, don't fail the dashboard for it
    ]);
    return { current, forecast, airQuality };
  }

  return {
    CONFIG,
    WeatherAPIError,
    geocodeCity,
    reverseGeocode,
    getCurrentWeather,
    getForecast,
    getAirPollution,
    fetchAllWeatherData,
  };
})();
