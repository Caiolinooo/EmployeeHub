'use client';

import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { FiInfo } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import GoogleCalendarIntegration from '@/components/Calendar/GoogleCalendarIntegration';

// Define the structure for a holiday
interface Holiday {
  date: string; // Format: YYYY-MM-DD
  name: string;
  type: string; // Changed to string to accommodate different sources
  description?: string;
}

// Define Macaé holidays (adjust year as needed, or make dynamic)
const MACAE_HOLIDAYS: Omit<Holiday, 'date'>[] = [
  { name: 'São Jorge', type: 'MUNICIPAL', description: 'Feriado Municipal de Macaé' },
  { name: 'São João Batista', type: 'MUNICIPAL', description: 'Feriado Municipal de Macaé' },
  { name: 'Aniversário de Macaé', type: 'MUNICIPAL', description: 'Feriado Municipal de Macaé' },
  { name: 'Consciência Negra', type: 'MUNICIPAL', description: 'Feriado Municipal/Estadual (RJ)' }, // Assuming Municipal/State
];

// Define UK holidays
const UK_HOLIDAYS: Omit<Holiday, 'date'>[] = [
  { name: 'New Year\'s Day', type: 'UK', description: 'UK Bank Holiday' },
  { name: 'Good Friday', type: 'UK', description: 'UK Bank Holiday' },
  { name: 'Easter Monday', type: 'UK', description: 'UK Bank Holiday' },
  { name: 'Early May Bank Holiday', type: 'UK', description: 'UK Bank Holiday' },
  { name: 'Spring Bank Holiday', type: 'UK', description: 'UK Bank Holiday' },
  { name: 'Summer Bank Holiday', type: 'UK', description: 'UK Bank Holiday' },
  { name: 'Christmas Day', type: 'UK', description: 'UK Bank Holiday' },
  { name: 'Boxing Day', type: 'UK', description: 'UK Bank Holiday' },
];

// Helper function to get Macaé holiday date for a given year
const getMacaeHolidayDate = (holidayName: string, year: number): string | null => {
  switch (holidayName) {
    case 'São Jorge': return `${year}-04-23`;
    case 'São João Batista': return `${year}-06-24`;
    case 'Aniversário de Macaé': return `${year}-07-29`;
    case 'Consciência Negra': return `${year}-11-20`;
    default: return null;
  }
};

// Helper function to get UK holiday date for a given year
const getUKHolidayDate = (holidayName: string, year: number): string | null => {
  // These are approximate dates - in reality UK bank holidays can vary
  switch (holidayName) {
    case 'New Year\'s Day': return `${year}-01-01`;
    case 'Good Friday': {
      // Approximate - would need proper Easter calculation
      return year === 2024 ? '2024-03-29' :
             year === 2025 ? '2025-04-18' :
             `${year}-04-10`; // Fallback approximate
    }
    case 'Easter Monday': {
      return year === 2024 ? '2024-04-01' :
             year === 2025 ? '2025-04-21' :
             `${year}-04-13`; // Fallback approximate
    }
    case 'Early May Bank Holiday': return `${year}-05-06`; // First Monday in May
    case 'Spring Bank Holiday': return `${year}-05-27`; // Last Monday in May
    case 'Summer Bank Holiday': return `${year}-08-26`; // Last Monday in August
    case 'Christmas Day': return `${year}-12-25`;
    case 'Boxing Day': return `${year}-12-26`;
    default: return null;
  }
};

// --- Holiday Fetching Logic ---
const BRASIL_API_URL = 'https://brasilapi.com.br/api/feriados/v1/';
const SCRAPE_API_URL = '/api/scrape-holidays'; // Our internal scraping endpoint

// Dados estáticos de feriados brasileiros para fallback
const BRAZILIAN_HOLIDAYS: Record<number, Holiday[]> = {
  2024: [
    { date: '2024-01-01', name: 'Confraternização Universal', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-02-13', name: 'Carnaval', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-03-29', name: 'Sexta-feira Santa', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-04-21', name: 'Tiradentes', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-05-01', name: 'Dia do Trabalho', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-05-30', name: 'Corpus Christi', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-09-07', name: 'Independência do Brasil', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-10-12', name: 'Nossa Senhora Aparecida', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-11-02', name: 'Finados', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-11-15', name: 'Proclamação da República', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-12-25', name: 'Natal', type: 'NATIONAL', description: 'Feriado Nacional' }
  ],
  2025: [
    { date: '2025-01-01', name: 'Confraternização Universal', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-03-04', name: 'Carnaval', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-04-18', name: 'Sexta-feira Santa', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-04-21', name: 'Tiradentes', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-05-01', name: 'Dia do Trabalho', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-06-19', name: 'Corpus Christi', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-09-07', name: 'Independência do Brasil', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-10-12', name: 'Nossa Senhora Aparecida', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-11-02', name: 'Finados', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-11-15', name: 'Proclamação da República', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-12-25', name: 'Natal', type: 'NATIONAL', description: 'Feriado Nacional' }
  ]
};



// Fetch from BrasilAPI
async function fetchBrasilApiHolidays(year: number): Promise<Holiday[]> {
  const url = `${BRASIL_API_URL}${year}`;
  console.log(`Attempting to fetch from BrasilAPI: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`BrasilAPI fetch failed for year ${year} with status ${response.status}`);
  }
  const data = await response.json();
  // Adapt BrasilAPI format to our Holiday interface
  return data.map((h: any) => ({
      date: h.date, // Already YYYY-MM-DD
      name: h.name,
      type: h.type.toUpperCase(), // e.g., 'national' -> 'NATIONAL'
  }));
}

// Fetch from our scraping endpoint
async function fetchScrapedHolidays(year: number): Promise<Holiday[]> {
    const url = `${SCRAPE_API_URL}?year=${year}`;
    console.log(`Attempting to fetch from Scrape API: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown scraping error' }));
        throw new Error(`Scrape API fetch failed for year ${year}: ${errorData.error || response.statusText}`);
    }
    const result = await response.json();
    if (!result.success || !Array.isArray(result.data)) {
        throw new Error('Scrape API did not return successful holiday data.');
    }
    // Data from scrape API should match our Holiday interface
    return result.data;
}

export default function CalendarioPage() {
  const { t, locale } = useI18n();
  const [allHolidays, setAllHolidays] = useState<Holiday[]>([]);
  const [viewDate, setViewDate] = useState(new Date()); // Date object for calendar view
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Removed fallback state, error message will indicate source failure
  // const [usingFallbackData, setUsingFallbackData] = useState(false);

  const currentYear = viewDate.getFullYear();

  useEffect(() => {
    const loadHolidays = async () => {
      setLoading(true);
      setError(null);
      let nationalHolidays: Holiday[] = [];
      let fetchSource = '';
      try {
        // For English locale, prioritize UK holidays
        if (locale === 'en-US') {
          // Add UK holidays
          const ukHolidays: Holiday[] = [];
          UK_HOLIDAYS.forEach(holiday => {
            const date = getUKHolidayDate(holiday.name, currentYear);
            if (date) {
              ukHolidays.push({
                ...holiday,
                date
              });
            }
          });
          nationalHolidays = ukHolidays;
          fetchSource = 'UK Holidays';
          console.log(`Added ${ukHolidays.length} UK holidays for ${currentYear}`);
        } else {
          // For Portuguese locale, use Brazilian holidays
          try {
              nationalHolidays = await fetchBrasilApiHolidays(currentYear);
              fetchSource = 'BrasilAPI';
              console.log(`Successfully fetched ${nationalHolidays.length} holidays from BrasilAPI for ${currentYear}`);
          } catch (brasilApiError: any) {
              console.warn(`BrasilAPI failed: ${brasilApiError.message}`);
              setError(`${t('calendario.failedToFetchBrasilApi')} (${brasilApiError.message}). ${t('calendario.tryingAlternative')}`); // Temporary error

              // 2. Try Scraping API as fallback
              try {
                  nationalHolidays = await fetchScrapedHolidays(currentYear);
                  fetchSource = 'Feriados.com.br (Scraped)';
                  setError(null); // Clear temporary error if scraping works
                  console.log(`Successfully fetched ${nationalHolidays.length} holidays via Scrape API for ${currentYear}`);
              } catch (scrapeError: any) {
                  console.error(`Scraping API failed: ${scrapeError.message}`);
                  // 3. Se ambos falharem, usar dados estáticos
                  console.log('Using static holiday data as last resort');
                  const staticHolidays = BRAZILIAN_HOLIDAYS[currentYear] || BRAZILIAN_HOLIDAYS[2024];
                  if (staticHolidays) {
                    nationalHolidays = staticHolidays;
                    fetchSource = 'Static Data';
                    setError(null);
                    console.log(`Using ${nationalHolidays.length} static holidays as fallback`);
                  } else {
                    throw new Error(t('calendario.failedToFetchFromAllSources'));
                  }
              }
          }
        }

        // Generate Macaé Holidays for the viewed year (only for Portuguese locale)
        let macaeHolidays: Holiday[] = [];
        if (locale === 'pt-BR') {
          macaeHolidays = MACAE_HOLIDAYS.map(h => {
              const date = getMacaeHolidayDate(h.name, currentYear);
              return date ? { ...h, date } : null;
          }).filter((h): h is Holiday => h !== null);
        }

        // Combine and remove potential duplicates
        const combinedHolidaysMap = new Map<string, Holiday>();
        // Add national holidays first
        nationalHolidays.forEach(h => combinedHolidaysMap.set(h.date + h.name, h));
        // Add Macaé holidays only for Portuguese locale
        if (locale === 'pt-BR') {
          macaeHolidays.forEach(h => combinedHolidaysMap.set(h.date + h.name, h));
        }

        const combinedHolidays = Array.from(combinedHolidaysMap.values());

        // Sort holidays by date
        combinedHolidays.sort((a, b) => a.date.localeCompare(b.date));

        setAllHolidays(combinedHolidays);
        if (error && fetchSource) setError(null); // Clear temporary error if we succeeded

      } catch (err: any) {
        console.error("Final Load Holidays Error:", err);
        setError(err.message || 'Falha grave ao carregar feriados.');
        setAllHolidays([]);
      } finally {
        setLoading(false);
      }
    };

    loadHolidays();
  }, [currentYear, t]); // Refetch when the viewed year or language changes

  // Function to customize tile content (add markers)
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dateString = date.toISOString().split('T')[0];
      const dayHolidays = allHolidays.filter(h => h.date === dateString);

      if (dayHolidays.length > 0) {
        // Prioritize Municipal for color if both exist
        const markerType = dayHolidays.some(h => h.type === 'MUNICIPAL') ? 'MUNICIPAL' : dayHolidays[0].type;
        return (
          <div className="holiday-markers absolute bottom-1 left-1/2 transform -translate-x-1/2 flex justify-center gap-1">
             {/* Single dot indicating a holiday exists, color based on priority */}
              <div
                title={dayHolidays.map(h => `${h.name} (${h.type})`).join('\n')} // Tooltip shows all
                className={`h-1.5 w-1.5 rounded-full ${markerType === 'MUNICIPAL' ? 'bg-orange-500' : 'bg-blue-500'}`}
              ></div>
          </div>
        );
      }
    }
    return null;
  };

  // Function to add CSS classes to holiday tiles
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dateString = date.toISOString().split('T')[0];
      if (allHolidays.some(h => h.date === dateString)) {
        return 'relative font-semibold'; // Make text bold and allow absolute positioning for markers
      }
    }
    return null;
  };

  // Get holidays for the currently viewed month
  const holidaysThisMonth = useMemo(() => {
    const month = viewDate.getMonth();
    const year = viewDate.getFullYear();
    return allHolidays.filter(h => {
      // Robust date parsing - create Date object in UTC to avoid timezone issues
      const [hYear, hMonth, hDay] = h.date.split('-').map(Number);
      const holidayDate = new Date(Date.UTC(hYear, hMonth - 1, hDay));
      return holidayDate.getUTCFullYear() === year && holidayDate.getUTCMonth() === month;
    });
  }, [allHolidays, viewDate]);

  // Handle active start date change (when user navigates months/years)
  const handleActiveStartDateChange = ({ activeStartDate }: { activeStartDate: Date | null }) => {
    if (activeStartDate) {
        // Update viewDate only if the month or year has changed
        if (activeStartDate.getFullYear() !== viewDate.getFullYear() || activeStartDate.getMonth() !== viewDate.getMonth()) {
        setViewDate(activeStartDate);
        }
    }
  };



  return (
    <MainLayout>
      <h1 className="text-3xl font-bold text-abz-text-black mb-2">{t('calendario.title')}</h1>
      <p className="text-gray-600 mb-6">{t('calendario.description')}</p>
      {/* Display specific error if loading failed */}
      {error && !loading && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 text-sm rounded-md flex items-center gap-2">
              <FiInfo />
              <span>{error}</span>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Column */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-lg shadow-md">
          {/* Show loading indicator on calendar */}
          {loading && <p className="text-center text-gray-500 mb-4">{t('calendario.loading')}</p>}

          <Calendar
            onActiveStartDateChange={handleActiveStartDateChange}
            // Prevent clicking/navigating while loading?
            // value={viewDate} // Use default value mechanism of react-calendar
            activeStartDate={viewDate} // Explicitly control the viewed month/year
            tileContent={tileContent}
            tileClassName={tileClassName}
            locale={locale}
            className="w-full border-none custom-calendar-styling" // Remove default border, add custom class
            showNeighboringMonth={false} // Hide days from prev/next month
          />
          {/* Legend */}
          <div className="flex justify-center gap-4 mt-4 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span> {t('calendario.nationalHoliday')}
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-500"></span> {t('calendario.municipalHoliday')}
            </div>
          </div>
        </div>

        {/* Holiday List Column */}
        <div className="lg:col-span-1 bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-abz-text-black mb-4 border-b pb-2">
            {t('calendario.holidaysInMonth')} {new Date(currentYear, viewDate.getMonth()).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
          </h2>
          {loading && <p className="text-gray-500">{t('calendario.loadingHolidays')}</p>}
          {!loading && error && holidaysThisMonth.length === 0 && (
              <p className="text-gray-500 text-sm italic">{t('calendario.couldNotLoadHolidays')}</p>
          )}
          {!loading && !error && holidaysThisMonth.length === 0 && (
            <p className="text-gray-500 text-sm italic">{t('calendario.noHolidaysThisMonth')}</p>
          )}
          {!loading && holidaysThisMonth.length > 0 && (
            <ul className="space-y-3 overflow-y-auto max-h-96 pr-2">
              {holidaysThisMonth.map(holiday => {
                  // Robust date parsing for display
                  const [hYear, hMonth, hDay] = holiday.date.split('-').map(Number);
                  const displayDate = new Date(Date.UTC(hYear, hMonth - 1, hDay));
                  return (
                <li
                  key={holiday.name + holiday.date}
                  className={`text-sm border-l-4 pl-3
                    ${holiday.type === 'MUNICIPAL' ? 'border-orange-500 bg-orange-50' : 'border-blue-500 bg-blue-50'}
                     p-2 rounded-r-md`}
                  >
                  <span className="font-semibold block text-abz-text-dark">
                         {displayDate.toLocaleDateString(locale, { day: '2-digit', timeZone: 'UTC' })} - {holiday.name}
                  </span>
                  <span className="text-xs text-gray-600">({holiday.type})</span>
                  {holiday.description && <p className="text-xs text-gray-500 mt-0.5">{holiday.description}</p>}
                </li>
                  );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Google Calendar Integration */}
      <div className="mt-8">
        <GoogleCalendarIntegration />
      </div>

      {/* Custom CSS for tile styling (existing styles can likely remain) */}
      <style jsx global>{`
        /* Calendar Styles */
        .custom-calendar-styling .react-calendar {
            border: none; /* Ensure no border */
            font-family: inherit; /* Use body font */
        }
        .custom-calendar-styling .react-calendar__navigation button {
            color: #0D1B42; /* ABZ Blue Dark */
            min-width: 44px;
            background: none;
            font-size: 1rem;
            font-weight: 600;
            padding: 8px 0;
        }
        .custom-calendar-styling .react-calendar__navigation button:disabled {
            background-color: #f0f0f0;
            color: #aaa;
        }
        .custom-calendar-styling .react-calendar__navigation button:enabled:hover,
        .custom-calendar-styling .react-calendar__navigation button:enabled:focus {
            background-color: #E0F2FE; /* ABZ Light Blue */
        }
        .custom-calendar-styling .react-calendar__month-view__weekdays {
            text-align: center;
            text-transform: uppercase;
            font-weight: bold;
            font-size: 0.75em;
            padding-bottom: 0.5em;
            color: #6339F5; /* ABZ Purple */
        }
        .custom-calendar-styling .react-calendar__month-view__weekdays__weekday {
            padding: 0.5em;
        }
        .custom-calendar-styling .react-calendar__month-view__days__day--weekend {
            color: #d10000; /* Red for weekends */
        }
        .custom-calendar-styling .react-calendar__month-view__days__day--neighboringMonth {
            color: #999; /* Lighter color for neighboring month days */
        }
        .custom-calendar-styling .react-calendar__tile {
            max-width: 100%;
            padding: 10px 6px;
            background: none;
            text-align: center;
            line-height: 1.5;
            font-size: 0.875rem;
            height: 60px; /* Fixed height for tiles */
            display: flex;
            flex-direction: column;
            justify-content: space-between; /* Space out number and markers */
            align-items: center;
        }
        .custom-calendar-styling .react-calendar__tile:disabled {
            background-color: #f0f0f0;
             color: #aaa;
        }
        .custom-calendar-styling .react-calendar__tile:enabled:hover,
        .custom-calendar-styling .react-calendar__tile:enabled:focus {
            background-color: #E0F2FE; /* ABZ Light Blue */
            border-radius: 4px;
        }
        .custom-calendar-styling .react-calendar__tile--now {
            background: #FFF3E0; /* Light Orange for Today */
            font-weight: bold;
            border-radius: 4px;
        }
        .custom-calendar-styling .react-calendar__tile--now:enabled:hover,
        .custom-calendar-styling .react-calendar__tile--now:enabled:focus {
             background: #FFE0B2; /* Darker Orange */
        }
        .custom-calendar-styling .react-calendar__tile--active { /* Style for selected day if needed */
            background: #6339F5; /* ABZ Purple */
            color: white;
            border-radius: 4px;
        }
        .custom-calendar-styling .react-calendar__tile--active:enabled:hover,
        .custom-calendar-styling .react-calendar__tile--active:enabled:focus {
            background: #5127d4; /* Darker Purple */
        }
        .custom-calendar-styling .react-calendar--selectRange .react-calendar__tile--hover {
            background-color: #e6e6fa; /* Light purple for range selection hover */
        }
        /* Ensure abbr (day number) is visible */
        .custom-calendar-styling .react-calendar__tile.relative abbr {
             position: relative; /* Make sure day number stays in flow */
             z-index: 1; /* Ensure number is above markers if overlapping */
             font-size: 0.9em;
             padding-bottom: 2px; /* Space between number and markers */
        }
      `}</style>
    </MainLayout>
  );
}