import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const fmt = (v: number) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + "M" : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(0) + "K" : String(Math.round(v)));

export function CashflowChart({ rows }: { rows: { year: number; revenue: number; cost: number; cashflow: number; cumulative: number }[] }) {
  return (
    <div dir="ltr"><ResponsiveContainer width="100%" height={200}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#7A7F73" }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "#7A7F73" }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
        <Bar dataKey="revenue" fill="#4B5343" radius={[6, 6, 0, 0]} />
        <Bar dataKey="cost" fill="#C4901D" radius={[6, 6, 0, 0]} />
        <Bar dataKey="cashflow" fill="#5E9C5A" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer></div>
  );
}

export function CumulativeChart({ rows }: { rows: { year: number; cumulative: number }[] }) {
  const data = [{ year: 0, cumulative: rows.length ? rows[0].cumulative - (rows[0] as { cashflow?: number }).cashflow! : 0 }, ...rows];
  return (
    <div dir="ltr"><ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <defs><linearGradient id="cum" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4B5343" stopOpacity={0.5} /><stop offset="100%" stopColor="#4B5343" stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#7A7F73" }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "#7A7F73" }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
        <Area type="monotone" dataKey="cumulative" stroke="#4B5343" strokeWidth={2.5} fill="url(#cum)" />
      </AreaChart>
    </ResponsiveContainer></div>
  );
}

export function RadarScores({ scores }: { scores: Record<string, number> }) {
  // simple horizontal bars (readable on small screens)
  return (
    <div className="space-y-2">
      {Object.entries(scores).map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-[12px]">
          <span className="w-[84px] text-muted capitalize">{k}</span>
          <div className="flex-1 h-2.5 rounded-full bg-olive-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${v}%`, background: v >= 70 ? "#5E9C5A" : v >= 45 ? "#C4901D" : "#F26B2B" }} /></div>
          <span className="w-8 text-end font-bold">{v}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ data }: { data: { name: string; value: number }[] }) {
  const colors = ["#4B5343", "#C4901D", "#F26B2B", "#5E9C5A", "#4F86C6", "#8E9484", "#20251E", "#B9BCB1"];
  return (
    <div dir="ltr"><ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="none">
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer></div>
  );
}

export function TrendLine({ data, keys }: { data: Record<string, number | string>[]; keys: string[] }) {
  const colors = ["#4B5343", "#C4901D", "#F26B2B"];
  return (
    <div dir="ltr"><ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#7A7F73" }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "#7A7F73" }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
        {keys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} strokeWidth={2.5} dot={false} />)}
      </LineChart>
    </ResponsiveContainer></div>
  );
}
