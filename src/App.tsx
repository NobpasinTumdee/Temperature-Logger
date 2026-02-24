import { useEffect, useState } from 'react';
import { supabase } from './supabase/supabaseClient';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import './App.css';

// --- Interfaces ---
interface SensorData {
  temperature: number;
  humidity: number;
  updated_at: string;
}

interface HourlyData {
  id: number;
  temperature: number;
  humidity: number;
  created_at: string;
}

// --- Helper Functions for Status ---
const getTempStatus = (temp: number) => {
  if (temp < 18) return { text: 'เย็นเกินไป', colorClass: 'status-warning' };
  if (temp > 32) return { text: 'ร้อนเกินไป!', colorClass: 'status-danger' };
  return { text: 'ปกติ สบายๆ', colorClass: 'status-normal' };
};

const getHumStatus = (hum: number) => {
  if (hum < 40) return { text: 'อากาศแห้ง', colorClass: 'status-warning' };
  if (hum > 70) return { text: 'ชื้นเกินไป', colorClass: 'status-warning' };
  return { text: 'ความชื้นเหมาะสม', colorClass: 'status-normal' };
};

// --- Donut Chart Component ---
const GlassDonutChart = ({ value, unit, color }: { value: number, unit: string, color: string, type: 'temp' | 'hum' }) => {
  const chartData = [
    { name: 'Value', value: value },
    { name: 'Empty', value: 100 - value },
  ];
  // สีของวงแหวนส่วนที่ "ว่างเปล่า" (สีขาวจางๆ โปร่งแสง)
  const emptyColor = 'rgba(255, 255, 255, 0.2)';

  return (
    <div className="donut-container">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={85}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell key="cell-value" fill={color} style={{ filter: `drop-shadow(0 0 8px ${color}aa)` }} />
            <Cell key="cell-empty" fill={emptyColor} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-inner-text">
        <div className="donut-value" style={{ color: color }}>{value.toFixed(1)}</div>
        <div className="donut-unit">{unit}</div>
      </div>
    </div>
  );
};

function App() {
  const [data, setData] = useState<SensorData | null>(null);
  const [hourlyLogs, setHourlyLogs] = useState<HourlyData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // 1. ดึงข้อมูลปัจจุบัน
      const { data: currentData, error: currentError } = await supabase
        .from('current_status')
        .select('*')
        .eq('id', 1)
        .single();

      if (currentData) setData(currentData);
      if (currentError) console.error("Error fetching current data:", currentError);

      // 2. ดึงข้อมูลสถิติรายชั่วโมง (24 ชั่วโมงล่าสุด)
      const { data: logData, error: logError } = await supabase
        .from('hourly_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(24);

      if (logData) setHourlyLogs(logData.reverse());
      if (logError) console.error("Error fetching hourly logs:", logError);
    };

    fetchData();

    // Realtime Subscription
    const channel = supabase
      .channel('realtime-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'current_status', filter: 'id=eq.1' }, (payload) => {
        setData(payload.new as SensorData);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!data) {
    return (
      <div className="main-container glass-panel fade-in-up">
        <div className="loading-container">กำลังเชื่อมต่อกับเซนเซอร์...</div>
      </div>
    );
  }

  const tempStatus = getTempStatus(data.temperature);
  const humStatus = getHumStatus(data.humidity);

  return (
    <div className='main'>
      <div className="main-container glass-panel fade-in-up">
        <header className="header">
          <h1>Smart Environment</h1>
          <p>Real-time Monitoring System</p>
        </header>

        <div className="cards-grid">
          {/* Temperature Card */}
          <div className="glass-card glass-panel fade-in-up delay-1">
            <h3 className="card-title">🌡️ Temperature</h3>
            <GlassDonutChart
              value={data.temperature}
              unit="°C"
              color="var(--color-temp)"
              type="temp"
            />
            <div className={`status-badge ${tempStatus.colorClass}`}>
              {tempStatus.text}
            </div>
            <div className="updated-time">
              Updated: {formatTime(data.updated_at)}
            </div>
          </div>

          {/* Humidity Card */}
          <div className="glass-card glass-panel fade-in-up delay-2">
            <h3 className="card-title">💧 Humidity</h3>
            <GlassDonutChart
              value={data.humidity}
              unit="%"
              color="var(--color-hum)"
              type="hum"
            />
            <div className={`status-badge ${humStatus.colorClass}`}>
              {humStatus.text}
            </div>
            <div className="updated-time">
              Updated: {formatTime(data.updated_at)}
            </div>
          </div>
        </div>

        {/* Hourly Chart Section */}
        <div className="chart-section glass-panel fade-in-up delay-2">
          <h2>Hourly Trends (24h)</h2>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyLogs} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.3)" />
                <XAxis dataKey="created_at" tickFormatter={formatTime} stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="var(--color-temp)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 'auto']} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--color-hum)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  labelFormatter={(label) => formatTime(label as string)}
                  contentStyle={{
                    backgroundColor: 'var(--glass-bg)',
                    backdropFilter: 'var(--backdrop-blur)',
                    borderRadius: '12px',
                    border: '1px solid var(--glass-border)',
                    boxShadow: 'var(--glass-shadow)'
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Line yAxisId="left" type="monotone" dataKey="temperature" name="Temp (°C)" stroke="var(--color-temp)" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: 'var(--color-temp)', stroke: 'white' }} />
                <Line yAxisId="right" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="var(--color-hum)" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: 'var(--color-hum)', stroke: 'white' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;