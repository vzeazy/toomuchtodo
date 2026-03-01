import { useState, useEffect } from 'react';

export type WeatherCode = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'thunder';

export function getWeatherCondition(wmoCode: number): WeatherCode {
    if (wmoCode === 0) return 'clear';
    if (wmoCode === 1 || wmoCode === 2) return 'partly';
    if (wmoCode === 3) return 'cloudy';
    if (wmoCode === 45 || wmoCode === 48) return 'fog';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(wmoCode)) return 'rain';
    if ([71, 73, 75, 77, 85, 86].includes(wmoCode)) return 'snow';
    if ([95, 96, 99].includes(wmoCode)) return 'thunder';
    return 'clear';
}

export function useWeather() {
    const [weatherData, setWeatherData] = useState<Record<string, WeatherCode>>({});

    useEffect(() => {
        async function fetchWeather() {
            try {
                const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
                if (!geoRes.ok) return;
                const geoData = await geoRes.json();

                const lat = geoData.latitude;
                const lon = geoData.longitude;

                const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code&timezone=auto`);
                if (!weatherRes.ok) return;

                const weatherJson = await weatherRes.json();
                const dates = weatherJson.daily?.time as string[];
                const codes = weatherJson.daily?.weather_code as number[];

                if (dates && codes) {
                    const map: Record<string, WeatherCode> = {};
                    dates.forEach((dateStr, i) => {
                        map[dateStr] = getWeatherCondition(codes[i]);
                    });
                    setWeatherData(map);
                }
            } catch (err) {
                console.error('Failed to fetch weather data silently:', err);
            }
        }

        fetchWeather();
    }, []);

    return weatherData;
}
