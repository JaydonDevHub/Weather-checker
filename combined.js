/* ==========================
   CONFIG
========================== */

const API_KEY = "0eb3c749d8387ee12eeadb622bb450a8";

let currentUnit = "metric";
let currentCity = "Nairobi";
let currentWeatherData = null;
let weatherChart = null;
let aqiChart = null;
let cityMap = null;
let deferredPrompt = null;

/* ==========================
   LANGUAGE SETTINGS
========================== */

const languageSelect = document.getElementById("languageSelect");

if(languageSelect){
    window.addEventListener("load", () => {
        let savedLanguage = localStorage.getItem("language");
        if(!savedLanguage){
            savedLanguage = navigator.language || "en";
            savedLanguage = savedLanguage.split("-")[0];
            localStorage.setItem("language", savedLanguage);
        }
        languageSelect.value = savedLanguage;
        setTimeout(() => {
            changeLanguage(savedLanguage);
        }, 2000);
    });

    languageSelect.addEventListener("change", () => {
        const lang = languageSelect.value;
        localStorage.setItem("language", lang);
        changeLanguage(lang);
    });
}

function changeLanguage(lang){
    let attempts = 0;
    const interval = setInterval(() => {
        const translator = document.querySelector(".goog-te-combo");
        if(translator){
            translator.value = lang;
            translator.dispatchEvent(new Event("change"));
            clearInterval(interval);
        }
        attempts++;
        if(attempts > 20){
            clearInterval(interval);
        }
    }, 500);
}

/* ==========================
   DOM ELEMENTS
========================== */

const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const temperature = document.getElementById("temperature");
const cityName = document.getElementById("cityName");
const description = document.getElementById("description");
const weatherIcon = document.getElementById("weatherIcon");
const humidity = document.getElementById("humidity");
const wind = document.getElementById("wind");
const pressure = document.getElementById("pressure");
const visibility = document.getElementById("visibility");
const feelsLike = document.getElementById("feelsLike");
const sunrise = document.getElementById("sunrise");
const sunset = document.getElementById("sunset");
const wearAdvice = document.getElementById("wearAdvice");
const loader = document.getElementById("loader");
const uvIndex = document.getElementById("uvIndex");
const aqi = document.getElementById("aqi");

/* ==========================
   APP START
========================== */

window.addEventListener("load", () => {
    loadRecentCities();
    loadFavorites();
    getUserLocation();
    setupPWA();
});

/* ==========================
   SEARCH WEATHER
========================== */

if(searchBtn && cityInput){
    searchBtn.addEventListener("click", () => {
        const city = cityInput.value.trim();
        if(city === "") return;
        loadWeather(city);
    });

    cityInput.addEventListener("keypress", e => {
        if(e.key === "Enter"){
            searchBtn.click();
        }
    });
}

/* ==========================
   FETCH WEATHER
========================== */

async function loadWeather(city){
    showLoader();
    try{
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${currentUnit}&appid=${API_KEY}`
        );

        if(!response.ok){
            throw new Error("City not found");
        }

        const data = await response.json();
        currentWeatherData = data;
        currentCity = city;
        updateWeatherUI(data);
        saveRecentCity(city);
        
        // Load additional data
        await loadForecast(city);
        await loadAQI(data.coord.lat, data.coord.lon);
        await loadUVIndex(data.coord.lat, data.coord.lon);
        await loadWeatherAlerts(data.coord.lat, data.coord.lon);
        initMap(data.coord.lat, data.coord.lon, city);
        loadWeatherNews(city);
        
    }
    catch(error){
        alert("City not found. Please try again.");
        console.error(error);
    }
    finally{
        hideLoader();
    }
}

/* ==========================
   UPDATE UI
========================== */

function updateWeatherUI(data){
    if(cityName) cityName.textContent = data.name + ", " + data.sys.country;
    if(temperature) temperature.textContent = Math.round(data.main.temp) + (currentUnit === "metric" ? "°C" : "°F");
    if(description) description.textContent = data.weather[0].description;
    if(weatherIcon) weatherIcon.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`;
    if(humidity) humidity.textContent = data.main.humidity + "%";
    
    // Convert wind speed from m/s to km/h
    let windSpeed = data.wind.speed;
    if(currentUnit === "metric") {
        windSpeed = (windSpeed * 3.6).toFixed(1);
    }
    if(wind) wind.textContent = windSpeed + " km/h";
    
    if(pressure) pressure.textContent = data.main.pressure + " hPa";
    if(visibility) visibility.textContent = (data.visibility / 1000).toFixed(1) + " km";
    if(feelsLike) feelsLike.textContent = "Feels like " + Math.round(data.main.feels_like) + (currentUnit === "metric" ? "°C" : "°F");
    if(sunrise) sunrise.textContent = convertTime(data.sys.sunrise);
    if(sunset) sunset.textContent = convertTime(data.sys.sunset);
    updateWearAdvice(data.main.temp);
    changeBackground(data.weather[0].main);
}

/* ==========================
   WEAR ADVICE
========================== */

function updateWearAdvice(temp){
    let advice = "";
    if(temp < 10){
        advice = "🧥 Very Cold. Wear a heavy jacket.";
    }
    else if(temp < 20){
        advice = "🧥 Light jacket recommended.";
    }
    else if(temp < 28){
        advice = "😊 Comfortable weather.";
    }
    else{
        advice = "☀ Stay hydrated and wear light clothes.";
    }
    if(wearAdvice) wearAdvice.textContent = advice;
}

/* ==========================
   CONVERT UNIX TIME
========================== */

function convertTime(timestamp){
    return new Date(timestamp * 1000).toLocaleTimeString();
}

/* ==========================
   LOADER
========================== */

function showLoader(){
    if(loader) loader.style.display = "flex";
}

function hideLoader(){
    if(loader) loader.style.display = "none";
}

/* ==========================
   GEOLOCATION
========================== */

function getUserLocation(){
    if(navigator.geolocation){
        navigator.geolocation.getCurrentPosition(
            async position => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                try{
                    const response = await fetch(
                        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${currentUnit}&appid=${API_KEY}`
                    );
                    const data = await response.json();
                    currentWeatherData = data;
                    updateWeatherUI(data);
                    await loadForecast(data.name);
                    await loadAQI(lat, lon);
                    await loadUVIndex(lat, lon);
                    initMap(lat, lon, data.name);
                }
                catch(error){
                    console.log(error);
                    loadWeather("Nairobi");
                }
            },
            error => {
                loadWeather("Nairobi");
            }
        );
    }
    else{
        loadWeather("Nairobi");
    }
}

/* ==========================
   UNIT TOGGLE
========================== */

const unitToggle = document.getElementById("unitToggle");
if(unitToggle){
    unitToggle.addEventListener("click", () => {
        currentUnit = currentUnit === "metric" ? "imperial" : "metric";
        loadWeather(currentCity);
    });
}

/* ==========================
   RECENT SEARCHES
========================== */

function saveRecentCity(city){
    let cities = JSON.parse(localStorage.getItem("recentCities")) || [];
    cities = cities.filter(c => c !== city);
    cities.unshift(city);
    cities = cities.slice(0,5);
    localStorage.setItem("recentCities", JSON.stringify(cities));
    loadRecentCities();
}

function loadRecentCities(){
    const container = document.getElementById("recentCities");
    if(!container) return;
    container.innerHTML = "";
    const cities = JSON.parse(localStorage.getItem("recentCities")) || [];
    cities.forEach(city => {
        const btn = document.createElement("div");
        btn.className = "recent-city";
        btn.textContent = city;
        btn.onclick = () => {
            loadWeather(city);
        };
        container.appendChild(btn);
    });
}

/* ==========================
   FAVORITES
========================== */

function addFavorite(){
    let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
    if(!favorites.includes(currentCity)){
        favorites.push(currentCity);
        localStorage.setItem("favorites", JSON.stringify(favorites));
        loadFavorites();
    }
}

function loadFavorites(){
    const container = document.getElementById("favoriteCities");
    if(!container) return;
    container.innerHTML = "";
    const favorites = JSON.parse(localStorage.getItem("favorites")) || [];
    favorites.forEach(city => {
        const div = document.createElement("div");
        div.className = "favorite-city";
        div.innerHTML = `⭐ ${city}`;
        div.onclick = () => {
            loadWeather(city);
        };
        container.appendChild(div);
    });
}

const favoriteBtn = document.getElementById("favoriteBtn");
if(favoriteBtn){
    favoriteBtn.addEventListener("click", addFavorite);
}

/* ==========================
   SHARE WEATHER
========================== */

const shareBtn = document.getElementById("shareBtn");
if(shareBtn){
    shareBtn.addEventListener("click", async () => {
        if(navigator.share && currentWeatherData){
            try{
                await navigator.share({
                    title: "Weather Dashboard",
                    text: `${currentCity}: ${temperature.textContent} - ${description.textContent}`
                });
            }
            catch(err){
                console.log(err);
            }
        }
    });
}

/* ==========================
   WEATHER BACKGROUNDS
========================== */

function changeBackground(weather){
    const bgSource = document.getElementById("bgSource");
    const bgVideo = document.getElementById("bgVideo");
    
    if(!bgSource || !bgVideo) return;
    
    switch(weather.toLowerCase()){
        case "rain":
            bgSource.src = "assets/backgrounds/rain.mp4";
            break;
        case "snow":
            bgSource.src = "assets/backgrounds/snow.mp4";
            break;
        case "clouds":
            bgSource.src = "assets/backgrounds/cloudy.mp4";
            break;
        default:
            bgSource.src = "assets/backgrounds/sunny.mp4";
    }
    bgVideo.load();
}

/* ==========================
   AUTO REFRESH
========================== */

setInterval(() => {
    if(currentCity){
        loadWeather(currentCity);
    }
}, 600000);

/* ==========================
   VOICE SEARCH
========================== */

const voiceBtn = document.getElementById("voiceSearchBtn");
if(voiceBtn && "webkitSpeechRecognition" in window){
    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";
    voiceBtn.addEventListener("click", () => {
        recognition.start();
    });
    recognition.onresult = event => {
        const city = event.results[0][0].transcript;
        if(cityInput) cityInput.value = city;
        loadWeather(city);
    };
}

/* ==========================
   FORECAST MODULE
========================== */

async function loadForecast(city){
    try{
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?q=${city}&units=${currentUnit}&appid=${API_KEY}`
        );
        if(!response.ok){
            throw new Error("Forecast unavailable");
        }
        const data = await response.json();
        renderFiveDayForecast(data);
        renderHourlyForecast(data);
        renderTemperatureChart(data);
        renderStatistics(data);
    }
    catch(error){
        console.error("Forecast Error:", error);
    }
}

function renderFiveDayForecast(data){
    const container = document.getElementById("forecastContainer");
    if(!container) return;
    container.innerHTML = "";
    
    const days = data.list.filter(item => item.dt_txt.includes("12:00:00"));
    days.slice(0,5).forEach(day => {
        const temp = Math.round(day.main.temp);
        const card = document.createElement("div");
        card.className = temp < 20 ? "forecast-card cold" : "forecast-card hot";
        const date = new Date(day.dt_txt);
        card.innerHTML = `
            <h3>${date.toLocaleDateString("en-US", {weekday:"short"})}</h3>
            <img src="https://openweathermap.org/img/wn/${day.weather[0].icon}@2x.png" alt="Weather Icon">
            <p>${day.weather[0].description}</p>
            <h2>${temp}°</h2>
        `;
        container.appendChild(card);
    });
}

function renderHourlyForecast(data){
    const container = document.getElementById("hourlyContainer");
    if(!container) return;
    container.innerHTML = "";
    
    data.list.slice(0,8).forEach(item => {
        const card = document.createElement("div");
        card.className = "hour-card";
        const time = new Date(item.dt_txt).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
        card.innerHTML = `
            <p>${time}</p>
            <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png">
            <h4>${Math.round(item.main.temp)}°</h4>
        `;
        container.appendChild(card);
    });
}

function renderTemperatureChart(data){
    const canvas = document.getElementById("weatherChart");
    if(!canvas || !window.Chart) return;
    
    const labels = data.list.slice(0,8).map(item =>
        new Date(item.dt_txt).toLocaleTimeString([], {hour:"2-digit"})
    );
    const temps = data.list.slice(0,8).map(item => item.main.temp);
    
    if(weatherChart){
        weatherChart.destroy();
    }
    
    weatherChart = new Chart(canvas, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Temperature",
                data: temps,
                fill: true,
                borderWidth: 3,
                tension: 0.4,
                borderColor: "#ff9800",
                backgroundColor: "rgba(255, 152, 0, 0.1)"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: "#333"
                    }
                }
            }
        }
    });
}

function renderStatistics(data){
    const temps = data.list.map(item => item.main.temp);
    const highest = Math.max(...temps);
    const lowest = Math.min(...temps);
    const average = temps.reduce((a,b)=>a+b,0) / temps.length;
    
    setText("highestTemp", `${Math.round(highest)}°`);
    setText("lowestTemp", `${Math.round(lowest)}°`);
    setText("averageTemp", `${Math.round(average)}°`);
    renderRainChance(data);
}

function renderRainChance(data){
    let rainCount = 0;
    data.list.forEach(item => {
        if(item.weather[0].main.toLowerCase().includes("rain")){
            rainCount++;
        }
    });
    const chance = Math.round((rainCount / data.list.length) * 100);
    setText("rainChance", `${chance}%`);
}

function setText(id, value){
    const element = document.getElementById(id);
    if(element){
        element.textContent = value;
    }
}

/* ==========================
   MAP MODULE
========================== */

function initMap(lat, lon, cityName){
    const mapContainer = document.getElementById("map");
    if(!mapContainer || !window.L) return;
    
    if(cityMap){
        cityMap.remove();
    }
    
    cityMap = L.map("map").setView([lat, lon], 12);
    
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(cityMap);
    
    L.marker([lat, lon]).addTo(cityMap)
        .bindPopup(`<b>${cityName}</b><br>Current Weather Location`)
        .openPopup();
}

/* ==========================
   AIR QUALITY MODULE
========================== */

async function loadAQI(lat, lon){
    const aqiElement = document.getElementById("aqi");
    if(!aqiElement) return;
    
    try{
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`
        );
        
        if(!response.ok){
            throw new Error("AQI unavailable");
        }
        
        const data = await response.json();
        const aqiValue = data.list[0].main.aqi;
        const aqiText = getAQIText(aqiValue);
        aqiElement.textContent = aqiText;
        
        renderAQIChart(data.list);
    }
    catch(error){
        console.error("AQI Error:", error);
        if(aqiElement) aqiElement.textContent = "Unavailable";
    }
}

function getAQIText(aqi){
    switch(aqi){
        case 1: return "Good (1)";
        case 2: return "Fair (2)";
        case 3: return "Moderate (3)";
        case 4: return "Poor (4)";
        case 5: return "Very Poor (5)";
        default: return "Unknown";
    }
}

function renderAQIChart(aqiData){
    const canvas = document.getElementById("aqiChart");
    if(!canvas || !aqiData || !window.Chart) return;
    
    const labels = aqiData.slice(0,8).map((item, index) => `Hour ${index + 1}`);
    const aqiValues = aqiData.slice(0,8).map(item => item.main.aqi);
    
    if(aqiChart){
        aqiChart.destroy();
    }
    
    aqiChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Air Quality Index",
                data: aqiValues,
                backgroundColor: "rgba(76, 175, 80, 0.6)",
                borderColor: "#4caf50",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 5,
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            switch(value){
                                case 1: return "Good";
                                case 2: return "Fair";
                                case 3: return "Moderate";
                                case 4: return "Poor";
                                case 5: return "Very Poor";
                                default: return value;
                            }
                        }
                    }
                }
            }
        }
    });
}

/* ==========================
   UV INDEX MODULE
========================== */

async function loadUVIndex(lat, lon){
    const uvElement = document.getElementById("uvIndex");
    if(!uvElement) return;
    
    try{
        const response = await fetch(
            `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=hourly,daily,minutely&appid=${API_KEY}`
        );
        
        if(!response.ok){
            throw new Error("UV data unavailable");
        }
        
        const data = await response.json();
        const uvValue = data.current.uvi;
        const uvText = getUVText(uvValue);
        uvElement.textContent = `${uvValue} (${uvText})`;
    }
    catch(error){
        console.error("UV Index Error:", error);
        if(uvElement) uvElement.textContent = "Unavailable";
    }
}

function getUVText(uv){
    if(uv <= 2) return "Low";
    if(uv <= 5) return "Moderate";
    if(uv <= 7) return "High";
    if(uv <= 10) return "Very High";
    return "Extreme";
}

/* ==========================
   WEATHER ALERTS MODULE
========================== */

async function loadWeatherAlerts(lat, lon){
    const alertsContainer = document.getElementById("alertsContainer");
    if(!alertsContainer) return;
    
    try{
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}`
        );
        
        const data = await response.json();
        
        if(data.alerts && data.alerts.length > 0){
            alertsContainer.innerHTML = "";
            data.alerts.forEach(alert => {
                const alertDiv = document.createElement("div");
                alertDiv.className = "alert-item";
                alertDiv.innerHTML = `
                    <strong>⚠️ ${alert.event}</strong><br>
                    <small>${new Date(alert.start * 1000).toLocaleString()} - ${new Date(alert.end * 1000).toLocaleString()}</small>
                    <p>${alert.description.substring(0, 200)}${alert.description.length > 200 ? '...' : ''}</p>
                `;
                alertsContainer.appendChild(alertDiv);
            });
        } else {
            alertsContainer.innerHTML = "No active weather alerts for this region";
        }
    }
    catch(error){
        console.error("Alerts Error:", error);
        alertsContainer.innerHTML = "Unable to load weather alerts";
    }
}

/* ==========================
   WEATHER NEWS MODULE
========================== */

async function loadWeatherNews(city){
    const newsContainer = document.getElementById("newsContainer");
    if(!newsContainer) return;
    
    try{
        newsContainer.innerHTML = `
            <div class="news-card">
                <h4>Weather Update</h4>
                <p>Current conditions in ${city} are being monitored</p>
            </div>
            <div class="news-card">
                <h4>Climate News</h4>
                <p>Stay updated with local weather patterns</p>
            </div>
            <div class="news-card">
                <h4>Travel Advisory</h4>
                <p>Check weather before planning outdoor activities</p>
            </div>
        `;
    }
    catch(error){
        console.error("News Error:", error);
        if(newsContainer) newsContainer.innerHTML = "Weather news unavailable";
    }
}

/* ==========================
   CITY COMPARISON MODULE
========================== */

const compareBtn = document.getElementById("compareBtn");
if(compareBtn){
    compareBtn.addEventListener("click", async () => {
        const city1 = document.getElementById("compareCity1")?.value.trim();
        const city2 = document.getElementById("compareCity2")?.value.trim();
        
        if(!city1 || !city2){
            alert("Please enter both city names");
            return;
        }
        
        const resultContainer = document.getElementById("comparisonResult");
        if(!resultContainer) return;
        
        resultContainer.innerHTML = "<p>Comparing cities...</p>";
        
        try{
            const [weather1, weather2] = await Promise.all([
                fetchWeatherData(city1),
                fetchWeatherData(city2)
            ]);
            
            if(weather1 && weather2){
                displayComparison(weather1, weather2);
            } else {
                resultContainer.innerHTML = "<p>One or both cities not found</p>";
            }
        }
        catch(error){
            console.error("Comparison Error:", error);
            resultContainer.innerHTML = "<p>Error comparing cities</p>";
        }
    });
}

async function fetchWeatherData(city){
    try{
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${currentUnit}&appid=${API_KEY}`
        );
        if(!response.ok) return null;
        return await response.json();
    }
    catch(error){
        return null;
    }
}

function displayComparison(data1, data2){
    const resultContainer = document.getElementById("comparisonResult");
    if(!resultContainer) return;
    
    const windSpeed1 = (data1.wind.speed * 3.6).toFixed(1);
    const windSpeed2 = (data2.wind.speed * 3.6).toFixed(1);
    
    resultContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 15px;">
                <h3>${data1.name}, ${data1.sys.country}</h3>
                <p>Temperature: ${Math.round(data1.main.temp)}°${currentUnit === "metric" ? "C" : "F"}</p>
                <p>Humidity: ${data1.main.humidity}%</p>
                <p>Wind: ${windSpeed1} km/h</p>
                <p>Condition: ${data1.weather[0].description}</p>
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 15px;">
                <h3>${data2.name}, ${data2.sys.country}</h3>
                <p>Temperature: ${Math.round(data2.main.temp)}°${currentUnit === "metric" ? "C" : "F"}</p>
                <p>Humidity: ${data2.main.humidity}%</p>
                <p>Wind: ${windSpeed2} km/h</p>
                <p>Condition: ${data2.weather[0].description}</p>
            </div>
        </div>
        <div style="margin-top: 15px; padding: 10px; text-align: center;">
            <strong>Difference:</strong> ${Math.abs(Math.round(data1.main.temp - data2.main.temp))}° difference
        </div>
    `;
}

/* ==========================
   PWA INSTALLATION
========================== */

function setupPWA(){
    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        const installBtn = document.getElementById("installBtn");
        if(installBtn){
            installBtn.style.display = "block";
            installBtn.onclick = async () => {
                if(deferredPrompt){
                    deferredPrompt.prompt();
                    const result = await deferredPrompt.userChoice;
                    deferredPrompt = null;
                    installBtn.style.display = "none";
                }
            };
        }
    });
}

/* ==========================
   PDF DOWNLOAD (Simple Version)
========================== */

const downloadPdfBtn = document.getElementById("downloadPdfBtn");
if(downloadPdfBtn){
    downloadPdfBtn.addEventListener("click", () => {
        alert("PDF download feature coming soon! You can take a screenshot for now.");
    });
}

/* ==========================
   DARK MODE TOGGLE
========================== */

const darkModeBtn = document.getElementById("darkModeBtn");
if(darkModeBtn){
    darkModeBtn.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        const isDark = document.body.classList.contains("dark-mode");
        localStorage.setItem("darkMode", isDark);
        const icon = document.querySelector("#darkModeBtn i");
        if(icon){
            icon.className = isDark ? "fas fa-sun" : "fas fa-moon";
        }
    });
}

// Load dark mode preference
if(localStorage.getItem("darkMode") === "true"){
    document.body.classList.add("dark-mode");
    const icon = document.querySelector("#darkModeBtn i");
    if(icon) icon.className = "fas fa-sun";
}

/* ==========================
   EXPOSE FUNCTIONS GLOBALLY
========================== */
window.loadWeather = loadWeather;
window.addFavorite = addFavorite;
