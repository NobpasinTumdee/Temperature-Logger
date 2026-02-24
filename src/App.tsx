import { useEffect, useState } from 'react';
import { supabase } from './supabase/supabaseClient';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css';

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

      // 2. ดึงข้อมูลสถิติรายชั่วโมง (เอา 24 ชั่วโมงล่าสุด)
      const { data: logData, error: logError } = await supabase
        .from('hourly_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(24);

      if (logData) {
        // กลับด้าน Array เพื่อให้กราฟแสดงจากอดีต -> ปัจจุบัน (ซ้ายไปขวา)
        setHourlyLogs(logData.reverse());
      }
      if (logError) console.error("Error fetching hourly logs:", logError);
    };

    fetchData();

    // เปิดช่องทางรับข้อมูล Realtime สำหรับค่าปัจจุบัน
    const channel = supabase
      .channel('realtime-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'current_status',
          filter: 'id=eq.1'
        },
        (payload) => {
          setData(payload.new as SensorData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ฟังก์ชันแปลงเวลาสำหรับแสดงในกราฟ
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="app-container">
      <header className="header fade-in">
        <h1>Smart Environment</h1>
        <p>Real-time Monitor System</p>
      </header>

      {/* ส่วนแสดงค่าแบบ Real-time */}
      {data ? (
        <div className="cards-container fade-in-up">
          <div className="card temp-card">
            <div className="card-icon">🌡️</div>
            <h3>Temperature</h3>
            <div className="value">
              {data.temperature.toFixed(1)} <span>°C</span>
            </div>
            <div className="updated-time">
              อัปเดตล่าสุด: {new Date(data.updated_at).toLocaleTimeString()}
            </div>
          </div>

          <div className="card hum-card">
            <div className="card-icon">💧</div>
            <h3>Humidity</h3>
            <div className="value">
              {data.humidity.toFixed(1)} <span>%</span>
            </div>
            <div className="updated-time">
              อัปเดตล่าสุด: {new Date(data.updated_at).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ) : (
        <div className="loading pulse">กำลังโหลดข้อมูล...</div>
      )}

      {/* ส่วนแสดงกราฟรายชั่วโมง */}
      <div className="chart-section fade-in-up delay-1">
        <h2>Hourly Trends (24h)</h2>
        {hourlyLogs.length > 0 ? (
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={hourlyLogs} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                <XAxis
                  dataKey="created_at"
                  tickFormatter={formatTime}
                  stroke="#888"
                  fontSize={12}
                />
                <YAxis yAxisId="left" stroke="#10b981" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" fontSize={12} />
                <Tooltip
                  labelFormatter={(label) => formatTime(label as string)}
                  contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="temperature"
                  name="Temp (°C)"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#10b981' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="humidity"
                  name="Humidity (%)"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#3b82f6' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="no-data">ยังไม่มีข้อมูลรายชั่วโมง</p>
        )}
      </div>
    </div>
  );
}

export default App;